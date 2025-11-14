// pages/api/tenants/policy.js
import { adminDb } from '@/lib/firebase-admin';
import admin from 'firebase-admin';

export default async function handler(req, res) {
    if (req.method !== 'PATCH') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { tenantId, defaultMode } = req.body;

    if (!['AUTO', 'CONFIRM', 'AGENT'].includes(defaultMode)) {
        return res.status(400).json({ error: 'Invalid mode' });
    }

    try {
        const tenantRef = adminDb.collection('Tenants').doc(tenantId);

        // 트랜잭션으로 원자성 보장
        await adminDb.runTransaction(async (transaction) => {
            const tenantDoc = await transaction.get(tenantRef);

            if (!tenantDoc.exists) {
                throw new Error('Tenant not found');
            }

            // 1. 테넌트 정책 업데이트
            transaction.update(tenantRef, {
                'policy.defaultMode': defaultMode,
                'policy.confirmSticky': true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            // 2. 전역 모드 문서 업데이트
            const globalModeRef = adminDb
                .collection('Conversation_Mode')
                .doc(`${tenantId}_global`);

            transaction.set(globalModeRef, {
                tenantId,
                sticky: true,
                mode: defaultMode,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
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