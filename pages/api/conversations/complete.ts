// pages/api/conversations/complete.ts
// 회원이 완료 처리 - 슬랙 카드 삭제

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { tenantId, chatId } = req.body;

        console.log('[complete] Request:', { tenantId, chatId });

        if (!tenantId || !chatId) {
            return res.status(400).json({ error: 'tenantId and chatId required' });
        }

        // 1. 대화 문서 업데이트
        const convRef = db.collection('FAQ_realtime_cw').doc(`${tenantId}_${chatId}`);
        const convDoc = await convRef.get();

        if (!convDoc.exists) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        await convRef.update({
            user_completed: true,
            user_completed_at: admin.firestore.FieldValue.serverTimestamp(),
            status: 'completed', // 상태도 완료로 변경
        });

        // 2. 슬랙 카드 삭제 호출
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.yamoo.ai.kr';

        try {
            const deleteResponse = await fetch(`${baseUrl}/api/slack/delete-card`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId,
                    chatId,
                    reason: 'user_completed',
                }),
            });

            const deleteResult = await deleteResponse.json();
            console.log('[complete] Slack card deleted:', deleteResult);
        } catch (error: any) {
            console.error('[complete] Failed to delete slack card:', error);
            // 슬랙 카드 삭제 실패해도 완료 처리는 성공
        }

        return res.status(200).json({
            ok: true,
            completed: true,
            message: '완료 처리되었습니다',
        });
    } catch (error: any) {
        console.error('[complete] Error:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error',
        });
    }
}