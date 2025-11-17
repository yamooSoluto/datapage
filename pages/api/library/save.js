// pages/api/library/save.js
// 라이브러리 데이터 저장 (서브컬렉션)

import { db } from '@/lib/firebase-admin';

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
        const libraryRef = tenantRef.collection('library');

        // ✅ 각 타입을 서브컬렉션 문서로 저장 (수정됨)
        const types = ['links', 'passwords', 'rules', 'info'];
        const batch = db.batch();

        types.forEach((type) => {
            const docRef = libraryRef.doc(type);
            batch.set(docRef, {
                items: library[type] || {},
                updatedAt: new Date().toISOString(),
            }, { merge: true });
        });

        await batch.commit();

        console.log(`✅ [Library Save] ${tenantId} library saved to subcollection`);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Library save error:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
}