// pages/api/ai/tone-correction.ts
import type { NextApiRequest, NextApiResponse } from "next";

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") return res.status(405).end();

    try {
        const {
            tenantId,
            chatId,
            conversationId, // chatId의 alias
            content,
            enableAI,
            planName,
            voice,
            contentType,
            toneFlags,
            requestId, // ✅ 추가
            source = 'web_portal', // ✅ 추가
        } = req.body || {};

        const actualChatId = conversationId || chatId;

        console.log("[tone-correction] Request:", {
            tenantId,
            chatId: actualChatId,
            contentLength: content?.length,
            enableAI,
            planName,
            requestId,
            source,
        });

        // 필수 파라미터 검증
        if (!tenantId || !actualChatId || !content) {
            return res.status(400).json({ error: "tenantId, chatId, content required" });
        }

        // AI 보정이 비활성화면 원본 그대로 반환
        if (!enableAI) {
            return res.status(200).json({
                ok: true,
                correctedText: content,
                source: 'original'
            });
        }

        // GCP 함수 URL
        const base = (process.env.GCLOUD_BASE_URL || "").replace(/\/+$/, "");
        if (!base) {
            return res.status(500).json({ error: "GCLOUD_BASE_URL not set" });
        }

        // ✅ n8n webhook URL (환경변수에서 가져오기)
        const n8nUrl = process.env.N8N_TONE_CORRECTION_WEBHOOK ||
            "https://soluto.app.n8n.cloud/webhook/tone-correction";

        // ✅ 페이로드 구성 (GCP 함수와 동일한 형식)
        const payload = {
            tenantId,
            conversationId: actualChatId,
            userMessage: "", // TODO: 실제 사용자 메시지 가져오기
            agentInstruction: content,
            mode: "mediated",
            source, // ✅ 'web_portal' 전달
            planName: planName || "trial",
            requestId, // ✅ 추가
            // Business 플랜 옵션
            ...(planName === 'business' ? {
                routing: "agent_mediation",
                voice: voice || "agent",
                contentType: contentType || "tone_correction",
                toneFlags: toneFlags || "",
            } : {}),
            // Pro 플랜 기본값
            ...(planName === 'pro' ? {
                routing: "agent_mediation",
                voice: "agent",
                contentType: "tone_correction",
                toneFlags: "",
            } : {}),
            previousMessages: [], // TODO: 최근 5개 메시지 가져오기
            executionMode: "production",
            // ✅ 웹포탈 콜백 URL (n8n이 여기로 POST)
            callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://your-vercel-app.vercel.app'}/api/ai/tone-result`,
        };

        console.log("[tone-correction] Calling n8n:", n8nUrl);

        // n8n webhook 호출
        const response = await fetch(n8nUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000), // 30초 타임아웃
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            console.error("[tone-correction] n8n error:", response.status, errorText);
            return res.status(502).json({
                error: "AI correction failed",
                detail: errorText
            });
        }

        const result = await response.json();
        console.log("[tone-correction] Success:", {
            hasResult: !!result.correctedText,
            length: result.correctedText?.length,
        });

        return res.status(200).json({
            ok: true,
            correctedText: result.correctedText || result.text || content,
            originalText: content,
            source: 'ai_corrected',
            metadata: {
                planName,
                voice,
                contentType,
                toneFlags,
            }
        });

    } catch (e: any) {
        console.error("[tone-correction] Error:", e);
        return res.status(500).json({
            error: e?.message || "unknown error",
            stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined
        });
    }
}