// pages/api/slack/delete-card.ts
// 슬랙 카드 삭제 (완료 처리 + 그림자 카드 확인 완료)

import type { NextApiRequest, NextApiResponse } from 'next';
import { WebClient } from '@slack/web-api';
import admin, { db } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            tenantId,
            chatId,
            reason = 'user_completed',
            // 'user_completed' - 사용자가 완료 버튼 클릭
            // 'shadow_card_viewed' - 그림자 카드 확인 완료 (자동 삭제)
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

        // 원본 카드도 삭제
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

        // 5. FAQ_realtime_cw 업데이트 (reason에 따라 다르게)
        const convRef = db.collection('FAQ_realtime_cw').doc(threadDocId);
        const convDoc = await convRef.get();

        if (convDoc.exists) {
            const updateData: any = {
                slack_card_status: 'deleted',
                slack_card_deleted_at: admin.firestore.FieldValue.serverTimestamp(),
            };

            if (reason === 'user_completed') {
                // ✅ 사용자가 완료 버튼 클릭
                updateData.user_completed = true;
                updateData.user_completed_at = admin.firestore.FieldValue.serverTimestamp();
                updateData.status = 'completed';
            } else if (reason === 'shadow_card_viewed') {
                // ✅ 그림자 카드 확인 완료 (자동 정리)
                updateData.shadow_card_viewed = true;
                updateData.shadow_card_viewed_at = admin.firestore.FieldValue.serverTimestamp();
                // status는 그대로 유지 (포탈에서 계속 확인 가능)
            }

            await convRef.update(updateData);

            console.log('[delete-card] FAQ_realtime_cw updated:', {
                reason,
                updateData: Object.keys(updateData),
            });
        }

        return res.status(200).json({
            ok: true,
            deleted: true,
            deletedMessages,
            cardStatus: 'deleted',
            reason,
        });
    } catch (error: any) {
        console.error('[delete-card] Error:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error',
        });
    }
}