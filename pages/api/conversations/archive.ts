// pages/api/conversations/archive.ts
// 대화를 저장/완료 표시 (status와 별개)

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
            archiveStatus, // 'saved' | 'completed' | null (기존 'hold', 'important'도 'saved'로 처리)
            note,
        } = req.body;

        console.log('[archive] Request:', { tenantId, chatId, archiveStatus, note });

        if (!tenantId || !chatId) {
            return res.status(400).json({ error: 'tenantId and chatId required' });
        }

        // 유효한 archiveStatus 값 확인 (기존 값도 허용하되 saved로 변환)
        const validStatuses = ['saved', 'completed', 'hold', 'important', null];
        if (!validStatuses.includes(archiveStatus)) {
            return res.status(400).json({
                error: 'Invalid archiveStatus. Must be: saved, completed, or null'
            });
        }

        // 기존 hold, important를 saved로 변환
        let normalizedStatus = archiveStatus;
        if (archiveStatus === 'hold' || archiveStatus === 'important') {
            normalizedStatus = 'saved';
        }

        // 1. FAQ_realtime_cw 업데이트
        let convRef = db.collection('FAQ_realtime_cw').doc(`${tenantId}_${chatId}`);
        let convDoc = await convRef.get();

        // ✅ 문서가 없으면 tenant/chatId 조건으로 재검색 (이전 데이터 호환)
        if (!convDoc.exists) {
            const fallbackSnap = await db.collection('FAQ_realtime_cw')
                .where('tenant_id', '==', tenantId)
                .where('chat_id', '==', chatId)
                .orderBy('lastMessageAt', 'desc')
                .limit(1)
                .get();

            if (!fallbackSnap.empty) {
                convDoc = fallbackSnap.docs[0];
                convRef = convDoc.ref;
            }
        }

        if (!convDoc.exists) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // 업데이트할 데이터 준비
        const updateData: any = {
            archive_status: normalizedStatus, // saved/completed/null
            archived_at: normalizedStatus ? admin.firestore.FieldValue.serverTimestamp() : null,
            archive_note: note || null,
        };

        // important 필드는 saved일 때만 true (기존 로직 호환성 유지)
        if (normalizedStatus === 'saved') {
            updateData.important = true;
        } else if (normalizedStatus === null) {
            updateData.important = false;
        }

        await convRef.update(updateData);

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
                            archiveStatus: normalizedStatus,
                        }),
                    });

                    const updateResult = await updateResponse.json();
                    console.log('[archive] Slack card updated:', updateResult);

                    return res.status(200).json({
                        ok: true,
                        archiveStatus: normalizedStatus,
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
            archiveStatus: normalizedStatus,
            slackUpdated: false,
        });
    } catch (error: any) {
        console.error('[archive] Error:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error',
        });
    }
}