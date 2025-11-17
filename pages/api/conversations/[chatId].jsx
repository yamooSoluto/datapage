// pages/conversations/[chatId].jsx
// 대화 상세 페이지 - 실시간 업데이트

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db } from '@/lib/firebase-client';
import { auth, getCurrentClaims } from '@/lib/firebase-auth';

export default function ConversationDetail() {
    const router = useRouter();
    const { chatId } = router.query;

    const [conversation, setConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tenantId, setTenantId] = useState(null);

    // ✅ 1. tenantId 확인 (Auth 상태 구독)
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setTenantId(null);
                setError('로그인이 필요합니다.');
                setLoading(false);
                return;
            }

            try {
                const claims = await getCurrentClaims();

                if (!claims?.allowedTenants || claims.allowedTenants.length === 0) {
                    setTenantId(null);
                    setError('접근 권한이 없습니다.');
                    setLoading(false);
                    return;
                }

                setTenantId(claims.allowedTenants[0]);
                setError(null);
            } catch (err) {
                console.error('[Detail] Auth error:', err);
                setError('인증 오류');
                setLoading(false);
            }
        });

        return () => {
            unsubscribe();
        };
    }, []);

    // ✅ 2. 실시간 리스너 설정
    useEffect(() => {
        if (!router.isReady || !chatId || !tenantId) return;

        setLoading(true);

        const docId = `${tenantId}_${chatId}`;
        console.log('[Detail] Listening to:', docId);

        const unsubscribe = onSnapshot(
            doc(db, 'FAQ_realtime_cw', docId),
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();

                    console.log('[Detail] Data updated:', {
                        lastMessageAt: data.lastMessageAt?.toDate(),
                        messageCount: data.messages?.length,
                    });

                    // 대화 정보
                    setConversation({
                        id: snapshot.id,
                        chatId: data.chat_id,
                        userId: data.user_id,
                        userName: data.user_name || '익명',
                        brandName: data.brandName || null,
                        channel: data.channel || 'unknown',
                        status: data.status || 'waiting',
                        modeSnapshot: data.modeSnapshot || 'AUTO',
                        lastMessageAt: data.lastMessageAt?.toDate?.()?.toISOString(),
                        summary: data.summary || null,
                        category: data.category || null,
                    });

                    // 메시지 정렬
                    const sortedMessages = (data.messages || [])
                        .slice()
                        .sort((a, b) =>
                            (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0)
                        );

                    setMessages(sortedMessages.map(m => ({
                        sender: m.sender,
                        text: m.text || '',
                        pics: m.pics || [],
                        timestamp: m.timestamp?.toDate?.()?.toISOString(),
                        msgId: m.msgId || null,
                    })));

                    setLoading(false);
                    setError(null);
                } else {
                    setError('대화를 찾을 수 없습니다.');
                    setLoading(false);
                }
            },
            (err) => {
                console.error('[Detail] Firestore error:', err);

                // 권한 오류 처리
                if (err.code === 'permission-denied') {
                    setError('접근 권한이 없습니다. 로그인을 확인해주세요.');
                } else {
                    setError('데이터를 불러올 수 없습니다.');
                }

                setLoading(false);
            }
        );

        // ✅ 3. 클린업
        return () => {
            console.log('[Detail] Cleanup listener');
            unsubscribe();
        };
    }, [router.isReady, chatId, tenantId]);

    // UI 렌더링
    if (loading) {
        return <div>로딩 중...</div>;
    }

    if (error) {
        return (
            <div className="error">
                <h2>오류</h2>
                <p>{error}</p>
                <button onClick={() => router.push('/conversations')}>
                    목록으로
                </button>
            </div>
        );
    }

    if (!conversation) {
        return <div>대화를 찾을 수 없습니다.</div>;
    }

    return (
        <div className="conversation-detail">
            <div className="header">
                <h1>{conversation.userName}님의 대화</h1>
                <div className="meta">
                    <span className="channel">{conversation.channel}</span>
                    <span className="status">{conversation.status}</span>
                    <span className="mode">{conversation.modeSnapshot}</span>
                </div>
            </div>

            <div className="messages">
                {messages.map((msg, idx) => (
                    <div key={msg.msgId || idx} className={`message ${msg.sender}`}>
                        <div className="message-content">
                            <p>{msg.text}</p>

                            {msg.pics && msg.pics.length > 0 && (
                                <div className="images">
                                    {msg.pics.map((pic, i) => (
                                        <img
                                            key={i}
                                            src={pic.thumbnail_url || pic.url}
                                            alt={`이미지 ${i + 1}`}
                                            onClick={() => window.open(pic.url, '_blank')}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        <span className="timestamp">
                            {new Date(msg.timestamp).toLocaleString('ko-KR')}
                        </span>
                    </div>
                ))}
            </div>

            {conversation.summary && (
                <div className="summary">
                    <h3>요약</h3>
                    <p>{conversation.summary}</p>
                </div>
            )}
        </div>
    );
}