// pages/api/onboarding.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/firebase';
import {
    getDefaultItemsForIndustry,
    getExampleDataForIndustry,
    getRequiredItems,
    getOptionalItems
} from '@/components/onboarding/config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const tenant = String(req.query.tenant || '').trim();
    if (!tenant) return res.status(400).json({ error: 'tenant required' });

    if (req.method === 'POST') {
        const {
            industry,
            useExampleData = true,
            selectedOptionalItems = {} // { spaces: ['스터디룸', '포커스존'], facilities: ['커피머신'] }
        } = req.body;

        if (!industry) {
            return res.status(400).json({ error: 'industry required' });
        }

        try {
            const batch = db.batch();

            // 1. 업종 저장
            const profileRef = db.collection('tenants').doc(tenant)
                .collection('meta').doc('profile');
            batch.set(profileRef, {
                industry,
                onboardingCompleted: true,
                createdAt: Date.now()
            }, { merge: true });

            // 2. 업종별 기본 아이템 가져오기
            const defaultItems = getDefaultItemsForIndustry(industry);
            const exampleData = useExampleData
                ? getExampleDataForIndustry(industry)
                : {};

            // 3. 각 카테고리별 아이템 생성
            const categories = ['spaces', 'facilities', 'seats', 'passes', 'features', 'policies'];

            categories.forEach(category => {
                const items = defaultItems[category] || [];
                const selectedOptional = selectedOptionalItems[category] || [];

                items.forEach((item, index) => {
                    // 필수 아이템이거나, 선택된 선택 아이템만 생성
                    const shouldCreate = item.required || selectedOptional.includes(item.name);

                    if (!shouldCreate) return;

                    const itemRef = db.collection('tenants').doc(tenant)
                        .collection('items').doc();

                    const hasExample = !!exampleData[category]?.[item.name];
                    const itemData = {
                        type: category.slice(0, -1), // 'spaces' → 'space'
                        category: category,
                        name: item.name,
                        order: index,
                        isDefault: true,
                        isRequired: item.required, // 🆕 필수 여부
                        isExample: hasExample,
                        data: exampleData[category]?.[item.name] || {
                            existence: item.existence
                        },
                        createdAt: Date.now()
                    };

                    batch.set(itemRef, itemData);
                });
            });

            await batch.commit();

            // 생성된 아이템 개수 계산
            const itemsCreated = {};
            categories.forEach(category => {
                const items = defaultItems[category] || [];
                const selectedOptional = selectedOptionalItems[category] || [];
                itemsCreated[category] = items.filter(item =>
                    item.required || selectedOptional.includes(item.name)
                ).length;
            });

            return res.status(200).json({
                ok: true,
                itemsCreated
            });
        } catch (e: any) {
            console.error('[onboarding]', e);
            return res.status(500).json({ error: 'internal_error', message: e.message });
        }
    }

    // GET: 온보딩 상태 확인
    if (req.method === 'GET') {
        try {
            const profileRef = db.collection('tenants').doc(tenant)
                .collection('meta').doc('profile');
            const snap = await profileRef.get();

            if (!snap.exists) {
                return res.status(200).json({
                    onboardingCompleted: false
                });
            }

            const data = snap.data();
            return res.status(200).json({
                onboardingCompleted: data.onboardingCompleted || false,
                industry: data.industry || ''
            });
        } catch (e: any) {
            console.error('[onboarding GET]', e);
            return res.status(500).json({ error: 'internal_error' });
        }
    }

    return res.status(405).json({ error: 'method not allowed' });
}