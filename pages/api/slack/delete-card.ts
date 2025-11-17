// pages/api/slack/delete-card.ts
// 슬랙 카드를 완전히 삭제 (회원 완료 처리 시)

import type { NextApiRequest, NextApiResponse } from 'next';
import { WebClient } from '@slack/web-api';
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
        const {
            tenantId,
            chatId,
            reason = 'user_completed',
        } = req.body;

        console.log('[delete-card] Request:', { tenantId, chatId, reason });

        if (!tenantId || !chatId) {
            return res.status(400).json({ error: 'tenantId and chatId required' });
        }

        // 1. slack_threads 조회
        const threadDocId = `${tenantId}_${chatId}`;
        const threadRef = db.collection('slack_threads').doc(threadDocId);
        const threadDoc = await threadRef.get();

        if (!threadDoc.exists) {
            console.log('[delete-card] No slack thread found:', threadDocId);
            return res.status(200).json({
                ok: true,
                message: 'No slack thread to delete',
            });
        }

        const threadData = threadDoc.data();
        const { channel_id, thread_ts, minimized_ts, card_status } = threadData;

        // 이미 삭제된 경우
        if (card_status === 'deleted') {
            console.log('[delete-card] Card already deleted');
            return res.status(200).json({
                ok: true,
                message: 'Card already deleted',
            });
        }

        // 2. 슬랙 토큰 가져오기
        const integDoc = await db.collection('integrations').doc(tenantId).get();
        if (!integDoc.exists) {
            return res.status(404).json({ error: 'Integration not found' });
        }

        const slackToken = integDoc.data()?.slack?.bot_token;
        if (!slackToken) {
            return res.status(400).json({ error: 'Slack token not found' });
        }

        const slack = new WebClient(slackToken);

        // 3. 슬랙 메시지 삭제
        const deletedMessages: string[] = [];

        // 축소 카드가 있으면 먼저 삭제
        if (minimized_ts) {
            try {
                await slack.chat.delete({
                    channel: channel_id,
                    ts: minimized_ts,
                });
                deletedMessages.push(minimized_ts);
                console.log('[delete-card] Minimized card deleted:', minimized_ts);
            } catch (error: any) {
                console.warn('[delete-card] Failed to delete minimized card:', error.message);
            }
        }

        // 원본 카드도 삭제 (혹시 남아있다면)
        if (thread_ts && thread_ts !== minimized_ts) {
            try {
                await slack.chat.delete({
                    channel: channel_id,
                    ts: thread_ts,
                });
                deletedMessages.push(thread_ts);
                console.log('[delete-card] Original card deleted:', thread_ts);
            } catch (error: any) {
                console.warn('[delete-card] Failed to delete original card:', error.message);
            }
        }

        // 4. Firestore 업데이트
        await threadRef.update({
            card_status: 'deleted',
            deleted_at: admin.firestore.FieldValue.serverTimestamp(),
            deleted_reason: reason,
            deleted_messages: deletedMessages,
        });

        // 5. FAQ_realtime_cw 업데이트
        const convRef = db.collection('FAQ_realtime_cw').doc(threadDocId);
        const convDoc = await convRef.get();

        if (convDoc.exists) {
            await convRef.update({
                slack_card_status: 'deleted',
                user_completed: reason === 'user_completed',
                user_completed_at: reason === 'user_completed'
                    ? admin.firestore.FieldValue.serverTimestamp()
                    : null,
            });
        }

        return res.status(200).json({
            ok: true,
            deleted: true,
            deletedMessages,
            cardStatus: 'deleted',
        });
    } catch (error: any) {
        console.error('[delete-card] Error:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error',
        });
    }
}