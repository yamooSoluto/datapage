// pages/api/library/get-type.js
// 특정 타입만 조회 (최적화)

import { db } from '@/lib/firebase';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { tenantId, type } = req.query;

        if (!tenantId) {
            return res.status(400).json({ error: 'tenantId is required' });
        }

        // type이 없으면 전체 조회
        if (!type) {
            const libraryRef = db.collection('tenants').doc(tenantId).collection('library');
            const snapshot = await libraryRef.get();

            const library = {
                links: {},
                passwords: {},
                rules: {},
                info: {},
            };

            snapshot.forEach((doc) => {
                const docType = doc.id;
                const data = doc.data();

                if (library.hasOwnProperty(docType)) {
                    library[docType] = data.items || {};
                }
            });

            return res.status(200).json({ library });
        }

        // 특정 타입만 조회 (최적화)
        const validTypes = ['links', 'passwords', 'rules', 'info'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: 'Invalid type' });
        }

        const docRef = db.collection('tenants').doc(tenantId).collection('library').doc(type);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(200).json({ [type]: {} });
        }

        const data = doc.data();
        res.status(200).json({ [type]: data.items || {} });
    } catch (error) {
        console.error('Library get error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// 사용 예시:
// GET /api/library/get-type?tenantId=xxx&type=links  → links만 조회
// GET /api/library/get-type?tenantId=xxx             → 전체 조회