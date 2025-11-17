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
        const response = {
            ok: true,
            message: {
                msgId: result?.messageId || `agent_${Date.now()}`,
                text,
            },
        };

        // ✅ 상담원 답변 후 슬랙 카드 축소
        try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'https://app.yamoo.ai.kr';
            const minimizeResponse = await fetch(`${baseUrl}/api/slack/minimize-card`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: tenant,
                    chatId: chatId,
                    minimizedBy: 'agent',
                    reason: '상담원 답변',
                }),
            });

            const minimizeResult = await minimizeResponse.json();
            console.log('[conversations/reply] Slack card minimized:', minimizeResult);
        } catch (minimizeError) {
            console.error('[conversations/reply] Failed to minimize slack card:', minimizeError);
            // 카드 축소 실패해도 답변 전송은 성공
        }

        return res.status(200).json(response);
    } catch (e) {
        console.error("[conversations/reply] error:", e?.message || e);
        return res.status(500).json({
            error: "internal_error",
            detail: e?.message || String(e),
        });
    }
}