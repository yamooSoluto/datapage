// pages/api/ai/tone-poll.ts
// 프론트엔드가 conversationId로 결과를 폴링하는 API

import type { NextApiRequest, NextApiResponse } from "next";
import { resultStore } from "./tone-result";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") return res.status(405).end();

    try {
        const { conversationId } = req.query;

        if (!conversationId || typeof conversationId !== 'string') {
            return res.status(400).json({ error: "conversationId required" });
        }

        // ✅ resultStore에서 찾기
        const result = resultStore.get(conversationId);

        if (!result) {
            // 아직 결과가 없음 (처리 중)
            return res.status(200).json({
                ok: true,
                status: 'pending',
                message: 'AI 보정 처리 중...',
            });
        }

        // ✅ 결과가 있으면 반환하고 삭제
        console.log("[tone-poll] Result found for:", conversationId);
        resultStore.delete(conversationId); // 한 번 읽으면 삭제

        return res.status(200).json({
            ok: true,
            status: 'completed',
            correctedText: result.correctedText,
            originalText: result.originalText,
            metadata: result.metadata,
        });

    } catch (e: any) {
        console.error("[tone-poll] Error:", e);
        return res.status(500).json({
            error: e?.message || "Failed to poll result",
        });
    }
}
