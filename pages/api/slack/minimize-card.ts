// pages/api/slack/minimize-card.ts
// 슬랙 카드를 축소된 버전으로 교체

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
            minimizedBy = 'system', // 'confirm' | 'agent' | 'system' | 'user'
            reason,
            agentName, // 상담원 이름 (agent인 경우)
        } = req.body;

        console.log('[minimize-card] Request:', { tenantId, chatId, minimizedBy, reason });

        if (!tenantId || !chatId) {
            return res.status(400).json({ error: 'tenantId and chatId required' });
        }

        // 1. slack_threads 조회
        const threadDocId = `${tenantId}_${chatId}`;
        const threadRef = db.collection('slack_threads').doc(threadDocId);
        const threadDoc = await threadRef.get();

        if (!threadDoc.exists) {
            console.log('[minimize-card] No slack thread found:', threadDocId);
            return res.status(404).json({ error: 'Slack thread not found' });
        }

        const threadData = threadDoc.data();
        const { channel_id, thread_ts, card_status } = threadData;

        // 이미 축소되었거나 삭제된 경우
        if (card_status === 'minimized' || card_status === 'deleted') {
            console.log('[minimize-card] Card already processed:', card_status);
            return res.status(200).json({
                ok: true,
                message: 'Card already processed',
                cardStatus: card_status,
            });
        }

        // 2. 대화 정보 조회 (카드에 표시할 내용)
        const convDoc = await db
            .collection('FAQ_realtime_cw')
            .doc(threadDocId)
            .get();

        const convData = convDoc.exists ? convDoc.data() : {};
        const userName = convData.user_name || '익명';
        const category = convData.category || '기타';
        const archiveStatus = convData.archive_status || null; // ✅ 보관 상태

        // 3. 슬랙 토큰 가져오기
        const integDoc = await db.collection('integrations').doc(tenantId).get();
        if (!integDoc.exists) {
            return res.status(404).json({ error: 'Integration not found' });
        }

        const slackToken = integDoc.data()?.slack?.bot_token;
        if (!slackToken) {
            return res.status(400).json({ error: 'Slack token not found' });
        }

        const slack = new WebClient(slackToken);

        // 4. 원본 카드 삭제 시도 (실패해도 계속 진행)
        try {
            await slack.chat.delete({
                channel: channel_id,
                ts: thread_ts,
            });
            console.log('[minimize-card] Original card deleted');
        } catch (error: any) {
            console.warn('[minimize-card] Failed to delete original card:', error.message);
            // 이미 삭제되었거나 권한 문제일 수 있음 - 계속 진행
        }

        // 5. 축소 카드 생성
        const minimizedCard = buildMinimizedCard({
            userName,
            category,
            chatId,
            minimizedBy,
            reason,
            agentName,
            archiveStatus, // ✅ 보관 상태 추가
            portalUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.yamoo.ai.kr'}/conversations/${chatId}`,
        });

        // 6. 축소 카드 전송 (같은 thread에)
        const result = await slack.chat.postMessage({
            channel: channel_id,
            thread_ts: thread_ts,
            ...minimizedCard,
        });

        console.log('[minimize-card] Minimized card posted:', result.ts);

        // 7. Firestore 업데이트
        await threadRef.update({
            card_status: 'minimized',
            minimized_at: admin.firestore.FieldValue.serverTimestamp(),
            minimized_by: minimizedBy,
            minimized_ts: result.ts,
            minimized_reason: reason || null,
        });

        // 8. FAQ_realtime_cw 업데이트
        if (convDoc.exists) {
            await convDoc.ref.update({
                slack_card_status: 'minimized',
            });
        }

        return res.status(200).json({
            ok: true,
            oldTs: thread_ts,
            newTs: result.ts,
            cardStatus: 'minimized',
        });
    } catch (error: any) {
        console.error('[minimize-card] Error:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error',
        });
    }
}

// ✅ 축소 카드 빌더
function buildMinimizedCard({
    userName,
    category,
    chatId,
    minimizedBy,
    reason,
    agentName,
    archiveStatus, // ✅ 추가
    portalUrl,
}: {
    userName: string;
    category: string;
    chatId: string;
    minimizedBy: string;
    reason?: string;
    agentName?: string;
    archiveStatus?: string | null; // ✅ 추가
    portalUrl: string;
}) {
    const timestamp = new Date().toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    // ✅ 보관 상태별 프리픽스
    let archivePrefix = '';
    let archiveBadge = '';

    if (archiveStatus === 'keep') {
        archivePrefix = '📦 보관 - ';
        archiveBadge = ' | 📦 보관됨';
    } else if (archiveStatus === 'hold') {
        archivePrefix = '⏸️ 보류 - ';
        archiveBadge = ' | ⏸️ 보류됨';
    } else if (archiveStatus === 'important') {
        archivePrefix = '⭐ 중요 - ';
        archiveBadge = ' | ⭐ 중요';
    }

    let icon = ':white_check_mark:';
    let statusText = '승인 완료';
    let contextText = `승인: ${timestamp}`;

    if (minimizedBy === 'agent') {
        icon = ':bust_in_silhouette:';
        statusText = '상담 완료';
        contextText = agentName
            ? `담당: ${agentName} | ${timestamp}`
            : `상담 완료 | ${timestamp}`;
    } else if (minimizedBy === 'confirm') {
        icon = ':white_check_mark:';
        statusText = '승인 완료';
        contextText = `승인: ${timestamp} | AI 답변 전송됨`;
    } else if (minimizedBy === 'system') {
        icon = ':robot_face:';
        statusText = '자동 답변';
        contextText = `답변: ${timestamp}`;
    }

    if (reason) {
        contextText += ` | ${reason}`;
    }

    // ✅ 보관 상태 추가
    contextText += archiveBadge;

    return {
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `${archivePrefix}${icon} *${statusText}* | ${userName} | ${category}`,
                },
            },
            {
                type: 'context',
                elements: [
                    {
                        type: 'mrkdwn',
                        text: contextText,
                    },
                ],
            },
            {
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: {
                            type: 'plain_text',
                            text: '상세보기',
                            emoji: true,
                        },
                        url: portalUrl,
                        action_id: 'view_detail',
                    },
                ],
            },
        ],
    };
}