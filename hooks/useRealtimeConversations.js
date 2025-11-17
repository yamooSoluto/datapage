// hooks/useRealtimeConversations.js
// Firebase 실시간 리스너를 활용한 대화 리스트 자동 업데이트

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, limit as fbLimit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase-client';

/**
 * 실시간 대화 리스트 훅
 * Firestore 변경사항을 실시간으로 감지하여 자동으로 대화 목록 업데이트
 * 
 * @param {string} tenantId - 테넌트 ID
 * @param {string} channel - 채널 필터 ('all', 'kakao', 'naver', 'widget')
 * @param {number} pageSize - 페이지당 항목 수 (기본 30)
 * @returns {object} { conversations, loading, error, hasMore, loadMore, refresh }
 */
export function useRealtimeConversations(tenantId, channel = 'all', pageSize = 30) {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hasMore, setHasMore] = useState(true);

    const chatIdMapRef = useRef(new Map()); // chat_id별 최신 문서 추적
    const unsubscribeRef = useRef(null);
    const isInitialLoadRef = useRef(true);

    // ✅ 실시간 Firestore 리스너 설정
    useEffect(() => {
        if (!tenantId) {
            setLoading(false);
            return;
        }

        console.log('[useRealtimeConversations] Setting up realtime listener:', { tenantId, channel });
        setLoading(true);
        setError(null);
        isInitialLoadRef.current = true;

        let q = query(
            collection(db, 'FAQ_realtime_cw'),
            where('tenant_id', '==', tenantId),
            orderBy('lastMessageAt', 'desc'),
            fbLimit(pageSize * 2) // 중복 제거를 위해 넉넉히 가져옴
        );

        // 채널 필터
        if (channel !== 'all') {
            q = query(
                collection(db, 'FAQ_realtime_cw'),
                where('tenant_id', '==', tenantId),
                where('channel', '==', normalizeChannel(channel)),
                orderBy('lastMessageAt', 'desc'),
                fbLimit(pageSize * 2)
            );
        }

        const unsubscribe = onSnapshot(
            q,
            async (snapshot) => {
                try {
                    console.log('[useRealtimeConversations] Snapshot received:', {
                        size: snapshot.size,
                        changes: snapshot.docChanges().map(c => ({ type: c.type, id: c.doc.id })),
                        isInitial: isInitialLoadRef.current
                    });

                    // ✅ chat_id별 최신 문서만 유지 (중복 제거)
                    const chatMap = new Map();
                    snapshot.docs.forEach(doc => {
                        const data = doc.data();
                        const chatId = data.chat_id;

                        if (!chatMap.has(chatId)) {
                            chatMap.set(chatId, { doc, data });
                        } else {
                            const existing = chatMap.get(chatId);
                            const existingTs = existing.data.lastMessageAt?.toMillis?.() || 0;
                            const currentTs = data.lastMessageAt?.toMillis?.() || 0;

                            if (currentTs > existingTs) {
                                chatMap.set(chatId, { doc, data });
                            }
                        }
                    });

                    chatIdMapRef.current = chatMap;

                    // ✅ stats_conversations에서 추가 정보 가져오기 (배치)
                    const uniqueDocs = Array.from(chatMap.values())
                        .sort((a, b) => {
                            const tsA = a.data.lastMessageAt?.toMillis?.() || 0;
                            const tsB = b.data.lastMessageAt?.toMillis?.() || 0;
                            return tsB - tsA;
                        })
                        .slice(0, pageSize);

                    const statsPromises = uniqueDocs.map(async ({ data }) => {
                        const statsDocId = `${tenantId}_${data.chat_id}`;
                        try {
                            const statsRef = await import('firebase/firestore').then(m => m.doc(db, 'stats_conversations', statsDocId));
                            const statsSnap = await import('firebase/firestore').then(m => m.getDoc(statsRef));
                            return statsSnap.exists() ? { chatId: data.chat_id, stats: statsSnap.data() } : { chatId: data.chat_id, stats: null };
                        } catch (e) {
                            console.error('[useRealtimeConversations] Failed to fetch stats for:', data.chat_id, e);
                            return { chatId: data.chat_id, stats: null };
                        }
                    });

                    const statsResults = await Promise.all(statsPromises);
                    const statsMap = new Map(statsResults.map(r => [r.chatId, r.stats]));

                    // ✅ 대화 목록 변환
                    const conversationList = uniqueDocs.map(({ doc, data }) => {
                        const msgs = Array.isArray(data.messages) ? data.messages : [];
                        const stats = statsMap.get(data.chat_id);

                        const userCount = stats?.user_chats || 0;
                        const aiCount = stats?.ai_allchats || 0;
                        const agentCount = stats?.agent_chats || 0;
                        const totalCount = userCount + aiCount + agentCount;

                        const lastMsg = msgs[msgs.length - 1] || null;

                        // 이미지 스캔
                        const allPics = [];
                        msgs.forEach(m => {
                            if (Array.isArray(m.pics) && m.pics.length) {
                                m.pics.forEach(p => {
                                    if (p?.url) allPics.push(p.url);
                                });
                            }
                        });

                        // 업무 판별
                        const { everWork, lastSlackRoute } = getTaskFlagsFromStats(stats);
                        const slackRoute = data.slack_route || lastSlackRoute || null;

                        const extractMiddleChar = (name) => {
                            if (!name || name.length < 3) return name?.charAt(0) || '?';
                            const parts = name.trim().split(/\s+/);
                            if (parts.length > 1) return parts[1]?.charAt(0) || parts[0]?.charAt(1) || '?';
                            const mid = Math.floor(name.length / 2);
                            return name.charAt(mid);
                        };

                        return {
                            id: doc.id,
                            chatId: data.chat_id,
                            userId: data.user_id,
                            userName: data.user_name || '익명',
                            userNameInitial: extractMiddleChar(data.user_name),
                            brandName: data.brand_name || data.brandName || null,
                            channel: data.channel || 'unknown',
                            status: data.status || 'waiting',
                            modeSnapshot: data.modeSnapshot || 'AUTO',
                            lastMessageAt: data.lastMessageAt?.toDate?.()?.toISOString() || null,
                            lastMessageText: data.summary || lastMsg?.text?.slice(0, 80) || (allPics.length > 0 ? `(이미지 ${allPics.length}개)` : ''),
                            summary: data.summary || null,
                            task: data.task || null,
                            draftStatus: data.draft_status || null,
                            hasPendingDraft: data.draft_status === 'pending_approval',
                            hasImages: allPics.length > 0,
                            imageCount: allPics.length,
                            firstImageUrl: allPics[0] || null,
                            messageCount: { user: userCount, ai: aiCount, agent: agentCount, total: totalCount },
                            category: data.category || null,
                            categories: data.category ? data.category.split('|').map(c => c.trim()) : [],
                            isTask: everWork,
                            isTaskEver: everWork,
                            taskType: everWork ? 'work' : null,
                            slackCardType: slackRoute || null,
                        };
                    });

                    setConversations(conversationList);
                    setHasMore(snapshot.size >= pageSize * 2);

                    if (isInitialLoadRef.current) {
                        setLoading(false);
                        isInitialLoadRef.current = false;
                        console.log('[useRealtimeConversations] Initial load completed:', conversationList.length);
                    } else {
                        console.log('[useRealtimeConversations] Realtime update applied:', conversationList.length);
                    }

                } catch (err) {
                    console.error('[useRealtimeConversations] Error processing snapshot:', err);
                    setError(err.message);
                    setLoading(false);
                }
            },
            (err) => {
                console.error('[useRealtimeConversations] Firestore listener error:', err);
                setError(err.message);
                setLoading(false);
            }
        );

        unsubscribeRef.current = unsubscribe;

        return () => {
            console.log('[useRealtimeConversations] Cleaning up listener');
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, [tenantId, channel, pageSize]);

    // ✅ 수동 새로고침
    const refresh = () => {
        console.log('[useRealtimeConversations] Manual refresh triggered');
        isInitialLoadRef.current = true;
        setLoading(true);
    };

    // ✅ 더 로드 (현재는 API 폴백 필요 - 페이지네이션)
    const loadMore = async () => {
        console.log('[useRealtimeConversations] loadMore called (not implemented yet)');
        // TODO: cursor 기반 페이지네이션 구현
    };

    return {
        conversations,
        loading,
        error,
        hasMore,
        loadMore,
        refresh,
    };
}

// ✅ 헬퍼 함수들
function normalizeChannel(val) {
    const v = String(val || '').toLowerCase();
    if (!v) return 'unknown';
    if (v.includes('naver') || v === 'api') return 'naver';
    if (v.includes('kakao')) return 'kakao';
    if (v.includes('widget') || v.includes('web')) return 'widget';
    return 'unknown';
}

function getTaskFlagsFromStats(stats) {
    if (!stats) {
        return { everWork: false, lastSlackRoute: null };
    }

    const routeUpdate = stats.route_update || 0;
    const routeUpgrade = stats.route_upgrade_task || 0;
    const routeCreate = stats.route_create || 0;
    const lastSlackRoute = stats.last_slack_route || null;

    let everWork = false;

    if (routeUpdate > 0 || routeUpgrade > 0 || routeCreate > 0) {
        everWork = true;
    } else if (lastSlackRoute) {
        const s = String(lastSlackRoute || '').toLowerCase();
        const re = /\b(create|update|upgrade)\b/i;
        if (!s.includes('shadow') && re.test(s)) {
            everWork = true;
        }
    }

    return { everWork, lastSlackRoute };
}