// pages/api/conversations/send.ts
import type { NextApiRequest, NextApiResponse } from "next";

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") return res.status(405).end();

    try {
        // ✅ 디버깅: 전체 요청 본문 로그
        console.log("[send.ts] Raw request body:", JSON.stringify(req.body, null, 2));
        console.log("[send.ts] Request body type:", typeof req.body);
        console.log("[send.ts] Request body keys:", req.body ? Object.keys(req.body) : []);

        const { tenantId, chatId, content, attachments } = req.body || {};

        console.log("[send.ts] Parsed values:", {
            tenantId,
            chatId,
            chatIdType: typeof chatId,
            hasContent: !!content,
            contentLength: content?.length,
            attachmentsCount: attachments?.length || 0,
        });

        // ✅ 필수 파라미터 검증
        if (!tenantId || !chatId) {
            console.error("[send.ts] Missing required params:", { tenantId, chatId });
            return res.status(400).json({ error: "tenantId and chatId are required" });
        }

        // ✅ 텍스트 또는 첨부파일 중 하나는 있어야 함 (더 관대한 검증)
        const hasText = content && String(content).trim().length > 0;
        const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

        if (!hasText && !hasAttachments) {
            console.error("[send.ts] No content or attachments");
            return res.status(400).json({ error: "content or attachments required" });
        }

        const base = (process.env.GCLOUD_BASE_URL || "").replace(/\/+$/, "");
        if (!base) {
            console.error("[send.ts] GCLOUD_BASE_URL not set");
            return res.status(500).json({ error: "GCLOUD_BASE_URL not set" });
        }

        // ✅ GCP 실제 라우트: /api/n8n/send-final
        const url = `${base}/api/n8n/send-final`;

        // ✅ 첨부파일 처리
        const processedAttachments = hasAttachments
            ? attachments.map(att => ({
                type: "document",
                source: {
                    type: "base64",
                    media_type: att.type || "application/octet-stream",
                    data: att.base64,
                },
                // 파일명 포함 (선택적)
                ...(att.name ? { cache_control: { type: "ephemeral" } } : {}),
            }))
            : [];

        const payload = {
            conversationId: String(chatId),
            content: String(content || ''), // ✅ 빈 문자열도 허용
            attachments: processedAttachments,
            via: "agent",
            sent_as: "agent",
            tenantId: String(tenantId),
            mode: "agent_comment",
            confirmMode: false,
            mediatedSource: "agent_comment",
        };

        console.log("[send.ts] Sending to:", url);
        console.log("[send.ts] Payload summary:", {
            conversationId: payload.conversationId,
            contentLength: payload.content.length,
            attachmentsCount: processedAttachments.length,
            tenantId: payload.tenantId,
        });

        const r = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // ✅ 토큰 헤더 추가
                ...(process.env.N8N_PROXY_TOKEN ? { "x-n8n-token": process.env.N8N_PROXY_TOKEN } : {}),
            },
            body: JSON.stringify(payload),
        });

        console.log("[send.ts] Response status:", r.status);

        if (!r.ok) {
            const text = await r.text().catch(() => "");
            console.error("[send.ts] GCP error:", text);
            return res.status(502).json({
                error: `send-final failed: ${r.status}`,
                detail: text,
                url: url
            });
        }

        const result = await r.json().catch(() => ({}));
        console.log("[send.ts] Success:", result);
        return res.status(200).json({ ok: true, ...result });
    } catch (e: any) {
        console.error("[send.ts] Error:", e);
        return res.status(500).json({
            error: e?.message || "unknown error",
            stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined
        });
    }
}