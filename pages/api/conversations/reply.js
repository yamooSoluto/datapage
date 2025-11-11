// /pages/api/conversations/reply.ts
export const config = { regions: ['icn1'] };

import { sendFinal } from "../n8n/send-final"; // ✅ 공통 모듈 재사용

export default async function handler(req, res) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "method_not_allowed" });
        }

        const { tenant, chatId, text } = req.body || {};
        if (!tenant || !chatId || !String(text || "").trim()) {
            return res.status(400).json({ error: "tenant, chatId, text required" });
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 포탈 답장은 “사람 에이전트 관점”으로 sendFinal 호출
        // Firestore 반영 + Chatwoot + 각 채널 웹훅 모두 sendFinal에서 처리
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const result = await sendFinal({
            conversationId: chatId,
            content: text,
            attachments: [],
            via: "agent",
            sent_as: "agent",
            tenantId: tenant,
            mode: "direct",
            confirmBypass: true, // 상담원 답장은 CONFIRM 게이트 우회
        });

        // (드물게 차단된 케이스 — ex. 이미 닫힌 대화 등)
        if (result?.blocked) {
            return res.status(200).json(result);
        }

        // 정상 응답
        return res.status(200).json({
            ok: true,
            message: {
                msgId: result?.messageId || `agent_${Date.now()}`,
                text,
            },
        });
    } catch (e) {
        console.error("[conversations/reply] error:", e?.message || e);
        return res.status(500).json({
            error: "internal_error",
            detail: e?.message || String(e),
        });
    }
}
