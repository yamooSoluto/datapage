// pages/api/ai/tone-result.ts
// n8n에서 AI 보정 완료 시 호출하는 Webhook (기존 비동기 방식)
// conversationId를 키로 사용

import type { NextApiRequest, NextApiResponse } from "next";

// ✅ 메모리 저장소 (conversationId를 키로 사용)
// 프로덕션에서는 Redis나 DB 사용 권장
const resultStore = new Map<string, {
    correctedText: string;
    originalText?: string;
    metadata?: any;
    timestamp: number;
}>();

// ✅ 30분 후 자동 정리
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of resultStore.entries()) {
        if (now - value.timestamp > 30 * 60 * 1000) {
            resultStore.delete(key);
        }
    }
}, 5 * 60 * 1000); // 5분마다 정리

export { resultStore }; // 다른 API에서 접근 가능

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") return res.status(405).end();

    try {
        console.log("[tone-result] Raw request:", {
            method: req.method,
            headers: req.headers,
            bodyType: typeof req.body,
            bodyKeys: req.body ? Object.keys(req.body) : [],
            bodyRaw: JSON.stringify(req.body, null, 2),
        });

        // ✅ n8n이 보내는 형식 처리
        // 때로는 { url, method, body } 형식으로 감싸져서 옴
        let payload = req.body;

        if (payload.body && typeof payload.body === 'object') {
            // n8n이 { url, method, body } 형식으로 보낸 경우
            payload = payload.body;
        }

        const {
            tenantId,
            conversationId,
            correctedText,
            originalText,
            metadata,
            requestId, // 있을 수도 있음
        } = payload;

        console.log("[tone-result] Parsed data:", {
            tenantId,
            conversationId,
            requestId,
            correctedTextLength: correctedText?.length,
            originalTextLength: originalText?.length,
            hasMetadata: !!metadata,
        });

        // ✅ conversationId가 필수
        if (!conversationId) {
            console.error("[tone-result] Missing conversationId");
            return res.status(400).json({ error: "conversationId required" });
        }

        if (!correctedText) {
            console.error("[tone-result] Missing correctedText");
            return res.status(400).json({ error: "correctedText required" });
        }

        // ✅ conversationId를 키로 저장
        resultStore.set(conversationId, {
            correctedText,
            originalText,
            metadata,
            timestamp: Date.now(),
        });

        console.log("[tone-result] Stored result for:", conversationId);

        return res.status(200).json({
            ok: true,
            conversationId,
            message: "Result stored successfully",
        });

    } catch (e: any) {
        console.error("[tone-result] Error:", e);
        return res.status(500).json({
            error: e?.message || "Failed to store result",
        });
    }
}
