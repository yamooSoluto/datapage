// pages/api/templates.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/firebase-admin';

// 기본 템플릿 정의
const DEFAULT_TEMPLATES = {
    space: {
        id: 'space',
        title: '공간',
        icon: '🏢',
        facets: [
            {
                key: 'existence',
                label: '존재',
                type: 'checkbox',
                default: false
            },
            {
                key: 'location',
                label: '위치',
                type: 'multi',
                options: ['1층', '2층', '3층', '지하']
            },
            {
                key: 'noise',
                label: '소음',
                type: 'multi',
                options: ['조용', '보통', '시끄러움']
            },
            {
                key: 'access',
                label: '이용',
                type: 'multi',
                options: ['자유 이용', '예약 필요', '제한적']
            },
            {
                key: 'hours',
                label: '운영시간',
                type: 'multi',
                options: ['24시간', '영업시간 동안', '특정 시간대만']
            }
        ]
    },

    facility: {
        id: 'facility',
        title: '시설',
        icon: '🔧',
        facets: [
            {
                key: 'existence',
                label: '존재',
                type: 'checkbox',
                default: false
            },
            {
                key: 'location',
                label: '위치',
                type: 'multi',
                options: ['로비', '1층', '2층', '3층', '각 층', '전체']
            },
            {
                key: 'cost',
                label: '비용',
                type: 'multi',
                options: ['무료', '유료', '일부 유료']
            },
            {
                key: 'hours',
                label: '이용시간',
                type: 'multi',
                options: ['24시간', '영업시간', '특정 시간대']
            },
            {
                key: 'quantity',
                label: '수량',
                type: 'multi',
                options: ['1개', '2개', '3개 이상', '층별 1개', '다수']
            }
        ]
    },

    seat: {
        id: 'seat',
        title: '좌석',
        icon: '💺',
        facets: [
            {
                key: 'existence',
                label: '존재',
                type: 'checkbox',
                default: false
            },
            {
                key: 'capacity',
                label: '정원',
                type: 'multi',
                options: ['1인', '2인', '4인', '6인', '8인 이상']
            },
            {
                key: 'type',
                label: '유형',
                type: 'multi',
                options: ['오픈', '칸막이', '반개방', '폐쇄형', '룸']
            },
            {
                key: 'price',
                label: '가격대',
                type: 'multi',
                options: ['기본', '프리미엄', '최고가']
            },
            {
                key: 'features',
                label: '특징',
                type: 'multi',
                options: ['창가', '콘센트', 'USB', '모니터', '조용', '넓음']
            }
        ]
    }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const tenant = String(req.query.tenant || '').trim();
    if (!tenant) return res.status(400).json({ error: 'tenant required' });

    const ref = db.collection('tenants').doc(tenant).collection('meta').doc('templates');

    try {
        if (req.method === 'GET') {
            const snap = await ref.get();

            if (!snap.exists) {
                // 기본 템플릿 반환
                return res.status(200).json({
                    templates: DEFAULT_TEMPLATES
                });
            }

            return res.status(200).json(snap.data());
        }

        if (req.method === 'PUT') {
            const { templates } = req.body;

            await ref.set({
                templates,
                updatedAt: Date.now()
            }, { merge: true });

            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: 'method not allowed' });
    } catch (e: any) {
        console.error('[templates]', e);
        return res.status(500).json({ error: 'internal_error' });
    }
}