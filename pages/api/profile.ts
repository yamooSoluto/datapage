// pages/api/profile.ts
import { db } from '@/lib/firebase'; // Admin
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const tenantId = String(req.query.tenantId || '');
  if (!tenantId) return res.status(400).json({ error: 'tenantId required' });

  const ref = db.collection('tenants').doc(tenantId).collection('profile').doc('profile');

  if (req.method === 'GET') {
    const snap = await ref.get();
    return res.json({ ok: true, data: snap.exists ? snap.data() : null });
  }

  if (req.method === 'PUT') {
    const body = req.body || {};
    body.updatedAt = Date.now();
    await ref.set(body, { merge: true });
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
