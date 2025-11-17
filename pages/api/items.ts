// pages/api/items.ts
// POST /api/items - 추가
// PUT /api/items - 수정
// DELETE /api/items - 삭제


import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const tenant = String(req.query.tenant || '').trim();
    if (!tenant) return res.status(400).json({ error: 'tenant required' });

    try {
        // POST: 아이템 추가
        if (req.method === 'POST') {
            const payload = req.body;
            const itemRef = db.collection('tenants').doc(tenant).collection('items').doc();

            await itemRef.set({
                id: itemRef.id,
                ...payload,
                createdAt: Date.now()
            });

            return res.status(200).json({ ok: true, id: itemRef.id });
        }

        // PUT: 아이템 수정
        if (req.method === 'PUT') {
            const { id, patch } = req.body;
            if (!id) return res.status(400).json({ error: 'id required' });

            const itemRef = db.collection('tenants').doc(tenant).collection('items').doc(id);

            await itemRef.update({
                ...patch,
                updatedAt: Date.now()
            });

            return res.status(200).json({ ok: true });
        }

        // DELETE: 아이템 삭제
        if (req.method === 'DELETE') {
            const id = String(req.query.id || '').trim();
            if (!id) return res.status(400).json({ error: 'id required' });

            const itemRef = db.collection('tenants').doc(tenant).collection('items').doc(id);
            await itemRef.delete();

            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: 'method not allowed' });
    } catch (e: any) {
        console.error('[items]', e);
        return res.status(500).json({ error: 'internal_error', message: e.message });
    }
}