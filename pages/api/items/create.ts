// pages/api/items/create.ts
// POST /api/items/create - Create item using service

import type { NextApiRequest, NextApiResponse } from 'next';
import { createItem } from '@/functions/src/services/items.service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { tenantId, ...data } = req.body;

        if (!tenantId) {
            return res.status(400).json({ error: 'tenantId is required' });
        }

        const item = await createItem(tenantId, data);
        return res.status(200).json({ ok: true, item });
    } catch (error: any) {
        console.error('[items/create]', error);
        return res.status(500).json({ error: 'internal_error', message: error.message });
    }
}

