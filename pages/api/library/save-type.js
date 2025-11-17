// pages/api/library/save-type.js
// 특정 타입만 저장 (최적화)

import { db } from '@/lib/firebase-admin';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { tenantId, type, items } = req.body;

        if (!tenantId || !type || !items) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const validTypes = ['links', 'passwords', 'rules', 'info'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: 'Invalid type' });
        }

        // 특정 타입만 저장
        const docRef = db.collection('tenants').doc(tenantId).collection('library').doc(type);

        await docRef.set({
            items: items,
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        res.status(200).json({
            success: true,
            message: `${type} saved successfully`
        });
    } catch (error) {
        console.error('Library save error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// 사용 예시:
// POST /api/library/save-type
// body: { tenantId: 'xxx', type: 'links', items: {...} }