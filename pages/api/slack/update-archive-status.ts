// pages/api/slack/update-archive-status.ts
// 축소된 슬랙 카드의 보관 상태 업데이트

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
        const { tenantId, chatId, archiveStatus } = req.body;

        console.log('[update-archive-status] Request:', { tenantId, chatId, archiveStatus });

        if (!tenantId || !chatId) {
            return res.status(400).json({ error: 'tenantId and chatId required' });
        }

        // 1. slack_threads 조회
        const threadDocId = `${tenantId}_${chatId}`;
        const threadRef = db.collection('slack_threads').doc(threadDocId);
        const threadDoc = await threadRef.get();

        if (!threadDoc.exists) {
            console.log('[update-archive-status] No slack thread found');
            return res.status(404).json({ error: 'Slack thread not found' });
        }

        const threadData = threadDoc.data();
        const { channel_id, minimized_ts, card_status } = threadData;

        // minimized 상태가 아니거나 minimized_ts가 없으면 업데이트 불가
        if (card_status !== 'minimized' || !minimized_ts) {
            console.log('[update-archive-status] Card not in minimized state');
            return res.status(400).json({
                error: 'Card must be in minimized state to update archive status'
            });
        }

        // 2. 대화 정보 조회
        const convDoc = await db.collection('FAQ_realtime_cw').doc(threadDocId).get();
        const convData = convDoc.exists ? convDoc.data() : {};
        const userName = convData.user_name || '익명';
        const category = convData.category || '기타';

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

        // 4. 업데이트된 카드 빌드
        const updatedCard = buildMinimizedCardWithArchive({
            userName,
            category,
            chatId,
            minimizedBy: threadData.minimized_by || 'system',
            archiveStatus,
            portalUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.yamoo.ai.kr'}/conversations/${chatId}`,
        });

        // 5. 슬랙 메시지 업데이트
        await slack.chat.update({
            channel: channel_id,
            ts: minimized_ts,
            ...updatedCard,
        });

        console.log('[update-archive-status] Slack card updated');

        // 6. Firestore 업데이트
        await threadRef.update({
            archive_status: archiveStatus,
        });

        return res.status(200).json({
            ok: true,
            archiveStatus,
        });
    } catch (error: any) {
        console.error('[update-archive-status] Error:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error',
        });
    }
}

// ✅ 보관 상태가 포함된 축소 카드 빌더
function buildMinimizedCardWithArchive({
    userName,
    category,
    chatId,
    minimizedBy,
    archiveStatus,
    portalUrl,
}: {
    userName: string;
    category: string;
    chatId: string;
    minimizedBy: string;
    archiveStatus: string | null;
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

    // 보관 상태별 프리픽스
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

    // 상태별 아이콘과 텍스트
    let icon = ':white_check_mark:';
    let statusText = '처리 완료';

    if (minimizedBy === 'agent') {
        icon = ':bust_in_silhouette:';
        statusText = '상담 완료';
    } else if (minimizedBy === 'confirm') {
        icon = ':white_check_mark:';
        statusText = '승인 완료';
    } else if (minimizedBy === 'system') {
        icon = ':robot_face:';
        statusText = '자동 답변';
    }

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
                        text: `${timestamp}${archiveBadge}`,
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