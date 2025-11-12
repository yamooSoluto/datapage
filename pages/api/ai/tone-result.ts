// pages/api/ai/tone-result.ts
// n8n에서 AI 보정 결과를 받는 콜백 엔드포인트

import type { NextApiRequest, NextApiResponse } from "next";

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") return res.status(405).end();

    try {
        // ✅ 디버깅: 전체 요청 정보 로그
        console.log("[tone-result] Raw request:", {
            method: req.method,
            headers: req.headers,
            bodyType: typeof req.body,
            bodyKeys: req.body ? Object.keys(req.body) : [],
            bodyRaw: JSON.stringify(req.body, null, 2),
        });

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
            requestId, // 클라이언트에서 생성한 고유 ID
            // ✅ n8n이 다른 필드명으로 보낼 수 있음
            conversation_id,
            corrected_text,
            original_text,
            request_id,
            tenant_id,
        } = body;

        // ✅ 필드명 매핑 (n8n이 snake_case로 보낼 수 있음)
        const finalConversationId = conversationId || conversation_id;
        const finalCorrectedText = correctedText || corrected_text;
        const finalOriginalText = originalText || original_text;
        const finalRequestId = requestId || request_id;
        const finalTenantId = tenantId || tenant_id;

        console.log("[tone-result] Parsed data:", {
            tenantId: finalTenantId,
            conversationId: finalConversationId,
            requestId: finalRequestId,
            correctedTextLength: finalCorrectedText?.length,
            originalTextLength: finalOriginalText?.length,
            hasMetadata: !!metadata,
        });

        if (!finalConversationId || !finalCorrectedText) {
            console.error("[tone-result] Missing required fields:", {
                conversationId: finalConversationId,
                correctedText: finalCorrectedText,
                rawBody: JSON.stringify(body, null, 2),
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

        // ✅ 결과를 임시 저장소에 저장 (Redis 권장, 없으면 메모리)
        // 클라이언트가 폴링으로 가져가도록
        global.aiResults = global.aiResults || {};
        const storageKey = finalRequestId || finalConversationId;

        global.aiResults[storageKey] = {
            conversationId: finalConversationId,
            correctedText: finalCorrectedText,
            originalText: finalOriginalText,
            metadata,
            timestamp: Date.now(),
        };

        // 5분 후 자동 삭제
        setTimeout(() => {
            delete global.aiResults[storageKey];
        }, 5 * 60 * 1000);

        console.log("[tone-result] Stored result for:", storageKey);

        return res.status(200).json({
            ok: true,
            message: "Result stored successfully"
        });

    } catch (e: any) {
        console.error("[tone-result] Error:", e);
        return res.status(500).json({
            error: e?.message || "unknown error",
        });
    }
}