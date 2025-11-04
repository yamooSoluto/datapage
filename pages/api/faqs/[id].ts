//pages/api/faqs/[id].ts

import { db } from '@/lib/firebase';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const tenantId = String(req.query.tenantId || '');
    const id = String(req.query.id || '');
    if (!tenantId || !id) return res.status(400).json({ error: 'tenantId & id required' });

    const ref = db.collection('tenants').doc(tenantId).collection('faqs').doc(id);

    if (req.method === 'PUT' || req.method === 'PATCH') {
        const body = req.body || {};
        body.updatedAt = Date.now();
        await ref.set(body, { merge: true });

        // isActive 변경/내용 변경 → 큐 등록
        await db.collection('tenants').doc(tenantId).collection('vector_queue').add({
            action: body.isActive === false ? 'delete' : 'upsert',
            faqId: id,
            payload: body.isActive === false ? undefined : {
                tenantId, questions: body.questions, answer: body.answer, tags: body.tags
            },
            createdAt: Date.now(), status: 'queued'
        });

        return res.json({ ok: true });
    }

    if (req.method === 'DELETE') {
        await ref.delete();
        await db.collection('tenants').doc(tenantId).collection('vector_queue').add({
            action: 'delete', faqId: id, createdAt: Date.now(), status: 'queued'
        });
        return res.json({ ok: true });
    }

    return res.status(405).end();
}
