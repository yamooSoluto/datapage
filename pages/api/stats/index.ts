// pages/api/stats/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import statsHandler from './[tenant]';

export default async function statsIndex(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // ✅ tenantId 또는 tenant 파라미터를 모두 받을 수 있도록 개선
    const tenantId =
        (Array.isArray(req.query.tenantId) ? req.query.tenantId[0] : req.query.tenantId) ||
        (Array.isArray(req.query.tenant) ? req.query.tenant[0] : req.query.tenant);

    if (!tenantId) {
        console.error('❌ stats/index.ts: tenant 파라미터 누락:', req.query);
        return res.status(400).json({ error: 'tenantId or tenant is required' });
    }

    // ✅ [tenant].js가 기대하는 형식으로 변환
    req.query.tenant = tenantId;

    console.log(`✅ stats/index.ts: ${tenantId}로 요청 전달`);

    // ✅ [tenant].js 핸들러로 전달
    return statsHandler(req as any, res as any);
}