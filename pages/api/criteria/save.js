// pages/api/criteria/save.js
// criteria sheet 데이터 저장 (서브컬렉션)

import { db } from '@/lib/firebase-admin';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { tenantId, criteriaSheet } = req.body;

        if (!tenantId) {
            return res.status(400).json({ error: 'tenantId is required' });
        }

        if (!criteriaSheet) {
            return res.status(400).json({ error: 'criteriaSheet data is required' });
        }

        const tenantRef = db.collection('tenants').doc(tenantId);

        // ✅ 서브컬렉션으로 저장 (수정됨)
        const criteriaRef = tenantRef.collection('criteria').doc('sheets');
        await criteriaRef.set({
            ...criteriaSheet,
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        console.log(`✅ [Criteria Save] ${tenantId} criteria sheets saved to subcollection`);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Criteria save error:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
}