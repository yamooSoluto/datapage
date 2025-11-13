// pages/api/ai/tone-poll.ts
// AI 보정 결과를 폴링으로 가져오는 엔드포인트
// ✅ requestId 또는 conversationId로 조회 가능

import type { NextApiRequest, NextApiResponse } from "next";

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") return res.status(405).end();

    try {
        const { requestId, conversationId } = req.query;

        // ✅ requestId 또는 conversationId 중 하나는 필수
        if (!requestId && !conversationId) {
            return res.status(400).json({ error: "requestId or conversationId required" });
        }

        const lookupKey = (typeof requestId === 'string' ? requestId : null) ||
            (typeof conversationId === 'string' ? conversationId : null);

        if (!lookupKey) {
            return res.status(400).json({ error: "Invalid requestId or conversationId" });
        }

        console.log("[tone-poll] Polling for:", {
            requestId: typeof requestId === 'string' ? requestId : null,
            conversationId: typeof conversationId === 'string' ? conversationId : null,
            lookupKey,
        });

        // 저장된 결과 확인
        global.aiResults = global.aiResults || {};

        // ✅ 디버깅: 현재 저장된 모든 키 출력
        const availableKeys = Object.keys(global.aiResults);
        console.log("[tone-poll] Available keys:", availableKeys);
        console.log("[tone-poll] Looking for:", lookupKey);
        console.log("[tone-poll] Key exists?", lookupKey in global.aiResults);

        const result = global.aiResults[lookupKey];

        if (!result) {
            // 아직 결과 없음
            console.log("[tone-poll] ❌ Result not found");

            return res.status(200).json({
                ready: false,
                message: "AI correction in progress...",
                // 디버깅용 (개발 환경에서만)
                debug: process.env.NODE_ENV === 'development' ? {
                    lookupKey,
                    availableKeys,
                } : undefined
            });
        }

        // 결과 있음 - 반환 후 삭제
        console.log("[tone-poll] ✅ Result found!");

        // ✅ 찾은 키 삭제 (requestId 또는 conversationId)
        delete global.aiResults[lookupKey];

        // ✅ 양방향 저장된 경우 다른 키도 삭제
        if (typeof requestId === 'string' && requestId !== lookupKey && result.conversationId) {
            delete global.aiResults[requestId];
        }
        if (typeof conversationId === 'string' && conversationId !== lookupKey && result.conversationId) {
            delete global.aiResults[conversationId];
        }

        return res.status(200).json({
            ready: true,
            ...result,
        });

    } catch (e: any) {
        console.error("[tone-poll] Error:", e);
        return res.status(500).json({
            error: e?.message || "unknown error",
        });
    }
}