import type { NextApiRequest, NextApiResponse } from 'next';
import statsHandler from './[tenant]';

export default async function statsIndex(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return statsHandler(req as any, res as any);
    }

    const tenantId =
        (Array.isArray(req.query.tenantId) ? req.query.tenantId[0] : req.query.tenantId) ||
        (Array.isArray(req.query.tenant) ? req.query.tenant[0] : req.query.tenant);

    if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required' });
    }

    (req.query as any).tenantId = tenantId;

    return statsHandler(req as any, res as any);
}
