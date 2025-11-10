// pages/api/onboarding/initialize.js
// ════════════════════════════════════════
// 온보딩 완료 시 Firestore 업데이트
// ✅ criteriaSheet는 서브컬렉션으로 저장
// ════════════════════════════════════════

import admin from 'firebase-admin';

// Firebase Admin 초기화
if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    let formattedKey = privateKey;
    if (privateKey) {
        if (privateKey.includes('\n')) {
            formattedKey = privateKey;
        } else if (privateKey.includes('\\n')) {
            formattedKey = privateKey.replace(/\\n/g, '\n');
        }
        formattedKey = formattedKey.replace(/^["']|["']$/g, '');
    }

    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: formattedKey,
            }),
        });
        console.log('✅ Firebase Admin initialized');
    } catch (initError) {
        console.error('❌ Firebase Admin initialization failed:', initError.message);
        throw initError;
    }
}

const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        tenantId,
        industry,
        selections,
        sheetData,
        // ✅ 온보딩에서 편집된 기본 정보
        brandName,
        email,
        address,
    } = req.body;

    if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required' });
    }

    try {
        const tenantRef = db.collection('tenants').doc(tenantId);

        // ✅ 1. 테넌트 문서에는 기본 정보만 저장
        const updateData = {
            // 온보딩 완료 플래그
            onboardingCompleted: true,
            onboardingCompletedAt: admin.firestore.FieldValue.serverTimestamp(),

            // 기본 정보 업데이트 (조건부)
            ...(brandName && { brandName }),
            ...(email && { email }),
            ...(address && { address }),
            ...(industry && { industry }),

            // 업데이트 타임스탬프
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await tenantRef.update(updateData);

        // ✅ 2. criteriaSheet는 서브컬렉션으로 저장
        if (sheetData) {
            const criteriaRef = tenantRef.collection('criteria').doc('sheets');
            await criteriaRef.set({
                ...sheetData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        // ✅ 3. selections도 서브컬렉션으로 저장
        if (selections) {
            const selectionsRef = tenantRef.collection('criteria').doc('selections');
            await selectionsRef.set({
                space: selections.space || [],
                facility: selections.facility || [],
                seat: selections.seat || [],
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        console.log(`✅ [Onboarding] ${tenantId} 온보딩 완료`, {
            brandName,
            email,
            industry,
            address,
            spaceCount: selections?.space?.length || 0,
            facilityCount: selections?.facility?.length || 0,
            seatCount: selections?.seat?.length || 0,
        });

        return res.status(200).json({
            success: true,
            message: '온보딩이 완료되었습니다.',
        });

    } catch (error) {
        console.error('❌ [Onboarding] Error:', error);
        return res.status(500).json({
            error: '온보딩 처리 중 오류가 발생했습니다.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
}