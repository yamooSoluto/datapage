// pages/api/ai/tone-result.ts
// n8n에서 AI 보정 결과를 받는 콜백 엔드포인트

import type { NextApiRequest, NextApiResponse } from "next";

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") return res.status(405).end();

    try {
        // ✅ n8n이 보내는 다양한 형식 처리
        let body = req.body || {};

        // n8n이 body를 중첩해서 보낼 수 있음 (예: { body: { ... } })
        if (body.body && typeof body.body === 'object') {
            body = body.body;
        }

        // n8n이 data 필드로 보낼 수 있음
        if (body.data && typeof body.data === 'object') {
            body = body.data;
        }

        const {
            tenantId,
            conversationId,
            correctedText,
            originalText,
            metadata,
            userMessage, // ✅ 고객 메시지
            previousMessages, // ✅ 최근 메시지들
            requestId, // ✅ n8n이 보낼 수 있지만 무시 (conversationId만 사용)
            // ✅ n8n이 다른 필드명으로 보낼 수 있음
            conversation_id,
            corrected_text,
            original_text,
            tenant_id,
            user_message,
            previous_messages,
            // ✅ n8n이 보낼 수 있는 추가 필드들
            customerMessage,
            recentMessages,
            customer_message,
            recent_messages,
        } = body;

        // ✅ 필드명 매핑 (conversationId만 사용)
        const finalConversationId = conversationId || conversation_id;
        const finalCorrectedText = correctedText || corrected_text;
        const finalOriginalText = originalText || original_text;
        const finalTenantId = tenantId || tenant_id;
        // ✅ 다양한 필드명으로 userMessage 받기
        const finalUserMessage = userMessage ||
            user_message ||
            customerMessage ||
            customer_message ||
            '';
        // ✅ 다양한 필드명으로 previousMessages 받기
        const finalPreviousMessages = previousMessages ||
            previous_messages ||
            recentMessages ||
            recent_messages ||
            [];

        if (!finalConversationId || !finalCorrectedText) {
            console.error("[tone-result] Missing required fields:", {
                conversationId: finalConversationId,
                correctedText: finalCorrectedText,
            });
            return res.status(400).json({
                error: "conversationId and correctedText required",
                received: {
                    conversationId: finalConversationId,
                    correctedText: finalCorrectedText ? 'present' : 'missing',
                    bodyKeys: Object.keys(body),
                }
            });
        }

        // ✅ 결과 데이터 (conversationId만 사용)
        global.aiResults = global.aiResults || {};

        // ✅ n8n이 보내는 모든 데이터 활용
        const resultData = {
            conversationId: finalConversationId,
            correctedText: finalCorrectedText,
            originalText: finalOriginalText,
            customerMessage: finalUserMessage, // ✅ 고객 메시지 포함
            recentMessages: finalPreviousMessages, // ✅ 최근 메시지 포함
            tenantId: finalTenantId, // ✅ tenantId도 저장
            metadata: metadata || {}, // ✅ metadata 포함
            timestamp: Date.now(),
            // ✅ n8n이 보낸 원본 데이터도 보관 (디버깅용)
            rawData: {
                tenantId: finalTenantId,
                conversationId: finalConversationId,
                originalText: finalOriginalText,
                correctedText: finalCorrectedText,
            },
        };

        // ✅ conversationId로만 저장
        global.aiResults[finalConversationId] = resultData;

        // 5분 후 자동 삭제
        setTimeout(() => {
            delete global.aiResults[finalConversationId];
        }, 5 * 60 * 1000);

        return res.status(200).json({
            ok: true,
            message: "Result stored successfully",
            conversationId: finalConversationId,
        });

    } catch (e: any) {
        console.error("[tone-result] Error:", e);
        return res.status(500).json({
            error: e?.message || "unknown error",
        });
    }
}
