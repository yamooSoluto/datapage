// pages/api/library/save.js
// 라이브러리 데이터 저장

import { db } from '@/lib/firebase';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { tenantId, library } = req.body;

        if (!tenantId) {
            return res.status(400).json({ error: 'tenantId is required' });
        }

        if (!library) {
            return res.status(400).json({ error: 'library data is required' });
        }

        const tenantRef = db.collection('tenants').doc(tenantId);

        // library 필드 업데이트
        await tenantRef.set({
            library: library
        }, { merge: true });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Library save error:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
}
