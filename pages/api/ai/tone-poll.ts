// pages/api/ai/tone-poll.ts
// AI 보정 결과를 폴링으로 가져오는 엔드포인트

import type { NextApiRequest, NextApiResponse } from "next";

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") return res.status(405).end();

    try {
        const { requestId } = req.query;

        if (!requestId || typeof requestId !== 'string') {
            return res.status(400).json({ error: "requestId required" });
        }

        console.log("[tone-poll] Polling for requestId:", requestId);

        // 저장된 결과 확인
        global.aiResults = global.aiResults || {};

        // ✅ 디버깅: 현재 저장된 모든 키 출력
        const availableKeys = Object.keys(global.aiResults);
        console.log("[tone-poll] Available keys:", availableKeys);
        console.log("[tone-poll] Looking for:", requestId);
        console.log("[tone-poll] Key exists?", requestId in global.aiResults);

        const result = global.aiResults[requestId];

        if (!result) {
            // 아직 결과 없음
            console.log("[tone-poll] ❌ Result not found");

            return res.status(200).json({
                ready: false,
                message: "AI correction in progress...",
                // 디버깅용 (개발 환경에서만)
                debug: process.env.NODE_ENV === 'development' ? {
                    requestId,
                    availableKeys,
                } : undefined
            });
        }

        // 결과 있음 - 반환 후 삭제
        console.log("[tone-poll] ✅ Result found!");
        delete global.aiResults[requestId];

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