// pages/api/items/update.ts
// PUT /api/items/update - Update item using service

import type { NextApiRequest, NextApiResponse } from 'next';
import { updateItem } from '@/functions/src/services/items.service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { tenantId, itemId, updates } = req.body;

        if (!tenantId || !itemId) {
            return res.status(400).json({ error: 'tenantId and itemId are required' });
        }

        await updateItem(tenantId, itemId, updates);
        return res.status(200).json({ ok: true });
    } catch (error: any) {
        console.error('[items/update]', error);
        return res.status(500).json({ error: 'internal_error', message: error.message });
    }
}

