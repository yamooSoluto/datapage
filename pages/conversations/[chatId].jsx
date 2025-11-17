// pages/conversations/[chatId].jsx
// 대화 Direct Link - ConversationDetail 컴포넌트 사용

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db } from '@/lib/firebase-client';
import { auth, getCurrentClaims } from '@/lib/firebase-auth';
import ConversationDetail from '@/components/ConversationDetail'; // ✅ 추가

export default function ConversationDirectLink() {
    const router = useRouter();
    const { chatId } = router.query;

    const [conversation, setConversation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tenantId, setTenantId] = useState(null);

    // ✅ 1. tenantId 확인 (Auth 상태 구독)
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                // 로그인 안 됨 → 리다이렉트
                const returnUrl = encodeURIComponent(`/conversations/${chatId}`);
                router.push(`/login?redirect=${returnUrl}`);
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
                console.error('[DirectLink] Auth error:', err);
                setError('인증 오류');
                setLoading(false);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [chatId, router]);

    // ✅ 2. 대화 정보 로드 (한 번만)
    useEffect(() => {
        if (!router.isReady || !chatId || !tenantId) return;

        const loadConversation = async () => {
            try {
                const docId = `${tenantId}_${chatId}`;
                console.log('[DirectLink] Loading:', docId);

                const docRef = doc(db, 'FAQ_realtime_cw', docId);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) {
                    setError('대화를 찾을 수 없습니다.');
                    setLoading(false);
                    return;
                }

                const data = docSnap.data();

                // ✅ ConversationDetail 컴포넌트에 맞는 형식
                setConversation({
                    id: docSnap.id,
                    chatId: data.chat_id || chatId,
                    userId: data.user_id,
                    userName: data.user_name || '익명',
                    brandName: data.brandName || null,
                    channel: data.channel || 'unknown',
                    status: data.status || 'waiting',
                    modeSnapshot: data.modeSnapshot || 'AUTO',
                    lastMessageAt: data.lastMessageAt?.toDate?.()?.toISOString(),
                    summary: data.summary || null,
                    category: data.category || null,
                    hasSlackCard: data.hasSlackCard || false,
                    routing: data.routing || {},
                    route: data.routing?.route || data.route,
                });

                setLoading(false);
                setError(null);
            } catch (err) {
                console.error('[DirectLink] Load error:', err);

                if (err.code === 'permission-denied') {
                    setError('접근 권한이 없습니다. 로그인을 확인해주세요.');
                } else {
                    setError('데이터를 불러올 수 없습니다.');
                }

                setLoading(false);
            }
        };

        loadConversation();
    }, [router.isReady, chatId, tenantId]);

    // ✅ 로딩 UI
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 relative">
                        <div className="absolute inset-0 border-4 border-blue-200 rounded-full" />
                        <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />
                    </div>
                    <p className="text-gray-600 font-medium">대화를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    // ✅ 에러 UI
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">오류</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/conversations')}
                        className="w-full px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-medium transition-colors"
                    >
                        목록으로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    // ✅ ConversationDetail 컴포넌트 사용
    if (!conversation) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <ConversationDetail
                conversation={conversation}
                tenantId={tenantId}
                onClose={() => router.push('/conversations')}
            />
        </div>
    );
}