// pages/api/ai/tone-correction-status.ts
// 클라이언트가 상태를 확인하기 위한 폴링 API

import type { NextApiRequest, NextApiResponse } from "next";
import { requestStore } from "./tone-correction-async";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") return res.status(405).end();

    try {
        const { requestId } = req.query;

        if (!requestId || typeof requestId !== 'string') {
            return res.status(400).json({ error: "requestId required" });
        }

        // ✅ requestStore에서 찾기
        const request = requestStore.get(requestId);

        if (!request) {
            return res.status(404).json({
                error: "Request not found or expired",
                status: 'not_found',
            });
        }

        // ✅ 상태 반환
        if (request.status === 'completed') {
            return res.status(200).json({
                ok: true,
                status: 'completed',
                result: request.result,
            });
        }

        if (request.status === 'error') {
            return res.status(200).json({
                ok: false,
                status: 'error',
                error: request.error || 'Unknown error',
            });
        }

        // pending or processing
        return res.status(200).json({
            ok: true,
            status: request.status,
            message: 'AI 보정 처리 중...',
        });

    } catch (e: any) {
        console.error("[tone-correction-status] Error:", e);
        return res.status(500).json({
            error: e?.message || "Status check error",
        });
    }
}
