// pages/api/items/delete.ts
// DELETE /api/items/delete - Delete item using service

import type { NextApiRequest, NextApiResponse } from 'next';
import { deleteItem } from '@/functions/src/services/items.service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { tenantId, itemId } = req.body;

        if (!tenantId || !itemId) {
            return res.status(400).json({ error: 'tenantId and itemId are required' });
        }

        await deleteItem(tenantId, itemId);
        return res.status(200).json({ ok: true });
    } catch (error: any) {
        console.error('[items/delete]', error);
        return res.status(500).json({ error: 'internal_error', message: error.message });
    }
}