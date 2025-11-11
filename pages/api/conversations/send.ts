// /pages/api/conversations/send.ts
import { sendFinal } from "../n8n/send-final";

export default async function handler(req, res) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "method_not_allowed" });
        }

        const { tenantId, chatId, content } = req.body || {};

        // 입력 검증
        if (!tenantId || !chatId || !String(content || "").trim()) {
            return res.status(400).json({ error: "tenantId, chatId, content required" });
        }

        // sendFinal 직접 호출 (reply.js와 동일한 방식)
        const result = await sendFinal({
            conversationId: chatId,
            content: String(content).trim(),
            attachments: [],
            via: "agent",
            sent_as: "agent",
            tenantId: tenantId,
            mode: "direct",
            confirmBypass: true, // 상담원 답장은 CONFIRM 게이트 우회
        });

        // (드물게 차단된 케이스 — ex. 이미 닫힌 대화 등)
        if (result?.blocked) {
            return res.status(200).json({ ok: true, blocked: true, ...result });
        }

        return res.status(200).json({
            ok: true,
            messageId: result?.messageId
        });
    } catch (e) {
        console.error("[conversations/send] error:", e?.message || e);
        return res.status(500).json({
            error: "internal_error",
            detail: e?.message || String(e),
        });
    }
}
