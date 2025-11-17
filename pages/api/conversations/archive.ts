// pages/api/conversations/archive.ts
// 대화를 보관/보류/중요 표시

import type { NextApiRequest, NextApiResponse } from 'next';
import admin, { db } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            tenantId,
            chatId,
            archiveStatus, // 'keep' | 'hold' | 'important' | null
            note,
        } = req.body;

        console.log('[archive] Request:', { tenantId, chatId, archiveStatus, note });

        if (!tenantId || !chatId) {
            return res.status(400).json({ error: 'tenantId and chatId required' });
        }

        // 유효한 archiveStatus 값 확인
        const validStatuses = ['keep', 'hold', 'important', null];
        if (!validStatuses.includes(archiveStatus)) {
            return res.status(400).json({
                error: 'Invalid archiveStatus. Must be: keep, hold, important, or null'
            });
        }
        const normalizedStatus = archiveStatus === 'keep' ? null : archiveStatus;

        // 1. FAQ_realtime_cw 업데이트
        const convRef = db.collection('FAQ_realtime_cw').doc(`${tenantId}_${chatId}`);
        const convDoc = await convRef.get();

        if (!convDoc.exists) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const convData = convDoc.data() || {};
        const currentStatus = convData.status || 'waiting';
        const wasOnHold = currentStatus === 'hold';
        const storedPrevStatus = convData.status_before_hold || null;
        const currentImportant = typeof convData.important === 'boolean'
            ? convData.important
            : convData.archive_status === 'important';

        const updates: Record<string, any> = {
            archive_note: note || null,
        };

        let nextStatus = currentStatus;
        let nextImportant = currentImportant;
        let nextArchiveStatus: 'hold' | 'important' | null = normalizedStatus;

        if (normalizedStatus === 'hold') {
            const prevStatusToStore = wasOnHold
                ? (storedPrevStatus || 'waiting')
                : currentStatus;

            updates.archive_status = 'hold';
            updates.archived_at = admin.firestore.FieldValue.serverTimestamp();
            updates.status = 'hold';
            updates.important = false;
            updates.status_before_hold = prevStatusToStore;

            nextStatus = 'hold';
            nextImportant = false;
            nextArchiveStatus = 'hold';
        } else if (normalizedStatus === 'important') {
            updates.archive_status = 'important';
            updates.archived_at = admin.firestore.FieldValue.serverTimestamp();
            updates.important = true;
            nextImportant = true;
            nextArchiveStatus = 'important';

            if (wasOnHold) {
                const restoredStatus = storedPrevStatus || 'waiting';
                updates.status = restoredStatus;
                updates.status_before_hold = admin.firestore.FieldValue.delete();
                nextStatus = restoredStatus;
            }
        } else {
            updates.archive_status = null;
            updates.archived_at = null;
            updates.important = false;
            updates.status_before_hold = admin.firestore.FieldValue.delete();
            nextArchiveStatus = null;
            nextImportant = false;

            if (wasOnHold) {
                const restoredStatus = storedPrevStatus || 'waiting';
                updates.status = restoredStatus;
                nextStatus = restoredStatus;
            }
        }

        await convRef.update(updates);

        // 2. 슬랙 카드 업데이트 (있으면)
        const threadDoc = await db.collection('slack_threads')
            .doc(`${tenantId}_${chatId}`)
            .get();

        if (threadDoc.exists) {
            const threadData = threadDoc.data();
            const { card_status, minimized_ts } = threadData;

            // 카드가 minimized 상태이고 minimized_ts가 있으면 업데이트
            if (card_status === 'minimized' && minimized_ts) {
                try {
                    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.yamoo.ai.kr';
                    const updateResponse = await fetch(`${baseUrl}/api/slack/update-archive-status`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tenantId,
                            chatId,
                            archiveStatus: nextArchiveStatus,
                        }),
                    });

                    const updateResult = await updateResponse.json();
                    console.log('[archive] Slack card updated:', updateResult);

                    return res.status(200).json({
                        ok: true,
                        archiveStatus: nextArchiveStatus,
                        status: nextStatus,
                        important: nextImportant,
                        slackUpdated: updateResult.ok,
                    });
                } catch (error: any) {
                    console.error('[archive] Failed to update slack card:', error);
                    // 슬랙 업데이트 실패해도 Firestore는 성공
                }
            }
        }

        return res.status(200).json({
            ok: true,
            archiveStatus: nextArchiveStatus,
            status: nextStatus,
            important: nextImportant,
            slackUpdated: false,
        });
    } catch (error: any) {
        console.error('[archive] Error:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error',
        });
    }
}