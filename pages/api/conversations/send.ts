// pages/api/conversations/send.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { sendFinal } from "../n8n/send-final"; // ✅ 공통 모듈 재사용

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

    try {
        const { tenantId, chatId, content } = req.body || {};
        if (!tenantId || !chatId || !content || !String(content).trim()) {
            return res.status(400).json({ error: "tenantId, chatId, content required" });
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 포탈 전송은 "사람 에이전트 관점"으로 sendFinal 호출
        // Firestore 반영 + Chatwoot + 각 채널 웹훅 모두 sendFinal에서 처리
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const result = await sendFinal({
            conversationId: chatId,
            content: String(content),
            attachments: [],
            via: "agent",
            sent_as: "agent",
            tenantId: String(tenantId),
            mode: "agent_comment",
            confirmBypass: true, // 상담원 전송은 CONFIRM 게이트 우회
            mediatedSource: "agent_comment",
        });

        // (드물게 차단된 케이스 — ex. 이미 닫힌 대화 등)
        if (result?.blocked) {
            return res.status(200).json(result);
        }

        return res.status(200).json({ ok: true });
    } catch (e: any) {
        console.error("[conversations/send] error:", e?.message || e);
        return res.status(500).json({ error: e?.message || "unknown error" });
    }
}
