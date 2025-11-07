// pages/api/registry/facet.ts
// POST /api/registry/facet - Create facet using service

import type { NextApiRequest, NextApiResponse } from 'next';
import { createFacet } from '@/functions/src/services/registry.service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { tenantId, ...data } = req.body;

        if (!tenantId) {
            return res.status(400).json({ error: 'tenantId is required' });
        }

        const facet = await createFacet(tenantId, data);
        return res.status(200).json({ ok: true, facet });
    } catch (error: any) {
        console.error('[registry/facet]', error);
        return res.status(500).json({ error: 'internal_error', message: error.message });
    }
}

