// pages/api/ai/tone-correction-callback.ts
// n8n에서 완료 시 호출하는 Webhook

import type { NextApiRequest, NextApiResponse } from "next";
import { requestStore } from "./tone-correction-async";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") return res.status(405).end();

    try {
        const {
            requestId,
            output,
            correctedText,
            text,
            response,
            error,
            metadata,
        } = req.body || {};

        console.log("[tone-correction-callback] Received:", {
            requestId,
            hasOutput: !!output,
            hasCorrectedText: !!correctedText,
            hasError: !!error,
            bodyKeys: Object.keys(req.body || {}),
        });

        if (!requestId) {
            console.error("[tone-correction-callback] Missing requestId");
            return res.status(400).json({ error: "requestId required" });
        }

        // ✅ requestStore에서 찾기
        const request = requestStore.get(requestId);
        if (!request) {
            console.error("[tone-correction-callback] Request not found:", requestId);
            // 이미 처리되었거나 만료된 경우
            return res.status(404).json({ error: "Request not found or expired" });
        }

        // ✅ 에러 처리
        if (error) {
            console.error("[tone-correction-callback] n8n error:", error);
            requestStore.set(requestId, {
                ...request,
                status: 'error',
                error: error,
            });
            return res.status(200).json({ ok: true, status: 'error' });
        }

        // ✅ 다양한 필드명 지원
        const finalText = correctedText || output || text || response;

        if (!finalText) {
            console.error("[tone-correction-callback] No text in response");
            requestStore.set(requestId, {
                ...request,
                status: 'error',
                error: 'No corrected text in response',
            });
            return res.status(200).json({ ok: true, status: 'error' });
        }

        // ✅ JSON.stringify로 이중 인코딩된 경우 처리
        let processedText = finalText;
        if (typeof processedText === 'string' && processedText.startsWith('"') && processedText.endsWith('"')) {
            try {
                processedText = JSON.parse(processedText);
            } catch (e) {
                console.warn("[tone-correction-callback] Failed to parse double-encoded string:", e);
            }
        }

        console.log("[tone-correction-callback] Success:", {
            requestId,
            textLength: processedText?.length,
            textPreview: processedText?.substring(0, 50),
        });

        // ✅ 결과 저장
        requestStore.set(requestId, {
            ...request,
            status: 'completed',
            result: {
                correctedText: processedText,
                metadata: metadata || null,
            },
        });

        return res.status(200).json({ ok: true, status: 'completed' });

    } catch (e: any) {
        console.error("[tone-correction-callback] Error:", e);
        return res.status(500).json({
            error: e?.message || "Callback processing error",
        });
    }
}
