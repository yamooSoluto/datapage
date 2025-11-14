// pages/api/tenants/policy.js
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
    if (req.method !== 'PATCH') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { tenantId, defaultMode } = req.body;

    if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required' });
    }

    if (!['AUTO', 'CONFIRM', 'AGENT'].includes(defaultMode)) {
        return res.status(400).json({ error: 'Invalid mode' });
    }

    try {
        const tenantRef = db.collection('tenants').doc(tenantId);

        // 트랜잭션으로 원자성 보장
        await db.runTransaction(async (transaction) => {
            const tenantDoc = await transaction.get(tenantRef);

            if (!tenantDoc.exists) {
                console.error(`[API] Tenant not found: ${tenantId}`);
                throw new Error(`Tenant not found: ${tenantId}`);
            }

            // 1. 테넌트 정책 업데이트
            transaction.update(tenantRef, {
                'policy.defaultMode': defaultMode,
                'policy.confirmSticky': true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // 2. 전역 모드 문서 업데이트
            const globalModeRef = db
                .collection('Conversation_Mode')
                .doc(`${tenantId}_global`);

            // createdAt은 첫 생성 시에만 설정 (merge: true로 기존 문서는 유지)
            const existingDoc = await transaction.get(globalModeRef);
            const updateData = {
                tenantId,
                sticky: true,
                mode: defaultMode,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            if (!existingDoc.exists) {
                updateData.createdAt = admin.firestore.FieldValue.serverTimestamp();
            }

            transaction.set(globalModeRef, updateData, { merge: true });
        });

        return res.status(200).json({
            success: true,
            defaultMode,
            message: `전역 모드가 ${defaultMode}로 변경되었습니다`
        });

    } catch (error) {
        console.error('[API] Policy update error:', error);
        return res.status(500).json({
            error: error.message,
            details: 'Failed to update tenant policy'
        });
    }
}