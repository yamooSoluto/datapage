// pages/api/ai/tone-result.ts
// n8n에서 AI 보정 결과를 받는 콜백 엔드포인트

import type { NextApiRequest, NextApiResponse } from "next";

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") return res.status(405).end();

    try {
        const {
            tenantId,
            conversationId,
            correctedText,
            originalText,
            metadata,
            requestId, // 클라이언트에서 생성한 고유 ID
        } = req.body || {};

        console.log("[tone-result] Received:", {
            tenantId,
            conversationId,
            requestId,
            textLength: correctedText?.length,
        });

        if (!conversationId || !correctedText) {
            return res.status(400).json({ error: "conversationId and correctedText required" });
        }

        // ✅ 결과를 임시 저장소에 저장 (Redis 권장, 없으면 메모리)
        // 클라이언트가 폴링으로 가져가도록
        global.aiResults = global.aiResults || {};
        global.aiResults[requestId || conversationId] = {
            conversationId,
            correctedText,
            originalText,
            metadata,
            timestamp: Date.now(),
        };

        // 5분 후 자동 삭제
        setTimeout(() => {
            delete global.aiResults[requestId || conversationId];
        }, 5 * 60 * 1000);

        console.log("[tone-result] Stored result for:", requestId || conversationId);

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