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

        const base = (process.env.GCLOUD_BASE_URL || "").replace(/\/$/, "");
        if (!base) {
            // 안전가드: 환경변수 없으면 명확히 알려주기
            return res.status(500).json({ error: "GCLOUD_BASE_URL not set" });
        }

        // GCP로 그대로 위임 (Slack 경로에서 쓰던 페이로드와 동일하게 맞춤)
        const payload = {
            conversationId: String(chatId),
            content: String(content),
            attachments: [],     // (파일 붙일거면 여기 확장)
            via: "agent",
            sent_as: "agent",
            tenantId: String(tenantId),
            mode: "agent_comment",
            confirmMode: false,
            mediatedSource: "agent_comment",
        };

        const r = await fetch(`${base}/api/n8n/send-final`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!r.ok) {
            const msg = await r.text().catch(() => "");
            return res.status(502).json({ error: `send-final failed: ${r.status} ${msg}` });
        }

        return res.status(200).json({ ok: true });
    } catch (e: any) {
        return res.status(500).json({ error: e?.message || "unknown error" });
    }
}
