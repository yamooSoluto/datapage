// pages/api/conversations/send.ts
import type { NextApiRequest, NextApiResponse } from "next";

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") return res.status(405).end();

    try {
        const { tenantId, chatId, content } = req.body || {};
        if (!tenantId || !chatId || !content || !String(content).trim()) {
            return res.status(400).json({ error: "tenantId, chatId, content required" });
        }

        const base = (process.env.GCLOUD_BASE_URL || "").replace(/\/+$/, "");
        if (!base) return res.status(500).json({ error: "GCLOUD_BASE_URL not set" });

        // ✅ GCP 실제 라우트: /api/n8n/send-final (슬랙 코드와 동일한 경로)
        const url = `${base}/api/n8n/send-final`;

        const payload = {
            conversationId: String(chatId),
            content: String(content),
            attachments: [],
            via: "agent",
            sent_as: "agent",
            tenantId: String(tenantId),
            mode: "agent_comment",
            confirmMode: false,
            mediatedSource: "agent_comment",
        };

        console.log("[send.ts] Sending to:", url);
        console.log("[send.ts] Payload:", JSON.stringify(payload, null, 2));

        const r = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // ✅ 토큰 헤더 추가 (GCP의 verifyN8NToken이 이 값을 확인)
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