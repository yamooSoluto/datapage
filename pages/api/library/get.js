// pages/api/library/get.js
// 라이브러리 데이터 불러오기 (서브컬렉션)

import { db } from '@/lib/firebase-admin';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { tenantId } = req.query;

        if (!tenantId) {
            return res.status(400).json({ error: 'tenantId is required' });
        }

        // 서브컬렉션에서 라이브러리 데이터 읽기
        const libraryRef = db.collection('tenants').doc(tenantId).collection('library');
        const snapshot = await libraryRef.get();

        const library = {
            links: {},
            passwords: {},
            rules: {},
            info: {},
        };

        // 각 문서(links, passwords, rules, info)를 읽어서 병합
        snapshot.forEach((doc) => {
            const type = doc.id; // 'links', 'passwords', 'rules', 'info'
            const data = doc.data();

            if (library.hasOwnProperty(type)) {
                library[type] = data.items || {};
            }
        });

        res.status(200).json({ library });
    } catch (error) {
        console.error('Library get error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}