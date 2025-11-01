// pages/api/faqs/index.ts

import { db } from '@/lib/firebase';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const tenantId = String(req.query.tenantId || '');
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });

    const col = db.collection('tenants').doc(tenantId).collection('faqs');

    if (req.method === 'GET') {
        const qs = await col.orderBy('updatedAt', 'desc').limit(200).get();
        return res.json({ ok: true, items: qs.docs.map(d => ({ id: d.id, ...d.data() })) });
    }

    if (req.method === 'POST') {
        const data = req.body || {};
        const now = Date.now();
        const doc = {
            questions: data.questions || [],
            answer: data.answer || '',
            staffHandoff: data.staffHandoff || '필요없음',
            guide: data.guide || '',
            keyData: data.keyData || '',
            tags: data.tags || [],
            isActive: data.isActive ?? true,
            createdAt: now,
            updatedAt: now,
        };
        const ref = await col.add(doc);
        // 큐 등록 (upsert)
        await db.collection('tenants').doc(tenantId).collection('vector_queue').add({
            action: 'upsert', faqId: ref.id,
            payload: { tenantId, questions: doc.questions, answer: doc.answer, tags: doc.tags },
            createdAt: now, status: 'queued'
        });
        return res.json({ ok: true, id: ref.id });
    }

    return res.status(405).end();
}
