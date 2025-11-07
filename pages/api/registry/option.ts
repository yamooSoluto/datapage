// pages/api/registry/option.ts
// POST /api/registry/option - Find or create option using service

import type { NextApiRequest, NextApiResponse } from 'next';
import { findOrCreateOption } from '@/functions/src/services/registry.service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { tenantId, facetId, label, code } = req.body;

        if (!tenantId || !facetId || !label) {
            return res.status(400).json({ error: 'tenantId, facetId, and label are required' });
        }

        const option = await findOrCreateOption(tenantId, facetId, label, code);
        return res.status(200).json({ ok: true, option });
    } catch (error: any) {
        console.error('[registry/option]', error);
        return res.status(500).json({ error: 'internal_error', message: error.message });
    }
}

