// pages/api/ai/tone-poll.ts
// AI 보정 결과를 폴링으로 가져오는 엔드포인트
// ✅ conversationId만 사용 (동시 요청 방지로 충분)

import type { NextApiRequest, NextApiResponse } from "next";

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") return res.status(405).end();

    try {
        const { conversationId } = req.query;

        // ✅ conversationId 필수
        if (!conversationId || typeof conversationId !== 'string') {
            return res.status(400).json({ error: "conversationId required" });
        }

        // 저장된 결과 확인
        global.aiResults = global.aiResults || {};
        const result = global.aiResults[conversationId];

        if (!result) {
            // 아직 결과 없음
            return res.status(200).json({
                ready: false,
                message: "AI correction in progress...",
            });
        }

        // 결과 있음 - 반환 후 삭제
        delete global.aiResults[conversationId];

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