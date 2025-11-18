// pages/conversations/[chatId].jsx
// 대화 Direct Link - ConversationDetail 컴포넌트 사용

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, getCurrentClaims } from '@/lib/firebase-auth';
import ConversationDetail from '@/components/ConversationDetail';

export default function ConversationDirectLink() {
    const router = useRouter();
    const { chatId: rawChatId } = router.query;

    const chatId =
        Array.isArray(rawChatId) ? rawChatId[0] : rawChatId || null;

    const [tenantId, setTenantId] = useState(null);
    const [conversation, setConversation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!router.isReady || !chatId) return;

        let unsub;

        const init = async () => {
            unsub = onAuthStateChanged(auth, async (user) => {
                if (!user) {
                    // 🔐 로그인 안 된 상태 → 로그인 페이지로 이동
                    const returnUrl = encodeURIComponent(`/conversations/${chatId}`);
                    router.replace(`/auth/login?redirect=${returnUrl}`);
                    return;
                }

                try {
                    setLoading(true);
                    setError('');

                    // ✅ 커스텀 클레임에서 tenantId 가져오기
                    const claims = await getCurrentClaims();
                    const tid =
                        claims?.tenantId ||
                        claims?.tenant_id ||
                        claims?.tenant ||
                        null;

                    if (!tid) {
                        throw new Error('tenantId 정보를 찾을 수 없습니다.');
                    }

                    setTenantId(tid);

                    // ✅ 대화 상세 정보 API 호출
                    const res = await fetch(
                        `/api/conversations/detail?tenant=${encodeURIComponent(
                            tid
                        )}&chatId=${encodeURIComponent(chatId)}`
                    );

                    if (!res.ok) {
                        if (res.status === 404) {
                            throw new Error('해당 대화를 찾을 수 없습니다.');
                        }
                        throw new Error(`대화 정보를 불러오지 못했습니다. (${res.status})`);
                    }

                    const data = await res.json();

                    // detail.js 의 응답 형식: { conversation, messages, ... } :contentReference[oaicite:1]{index=1}
                    if (data.conversation) {
                        setConversation(data.conversation);
                    } else {
                        throw new Error('대화 데이터가 비어 있습니다.');
                    }
                } catch (err) {
                    console.error('[ConversationDirectLink] error:', err);
                    setError(err.message || '알 수 없는 오류가 발생했습니다.');
                } finally {
                    setLoading(false);
                }
            });
        };

        init();

        return () => {
            if (unsub) unsub();
        };
    }, [router.isReady, chatId, router]);

    // ─── UI 상태 처리 ─────────────────────────────

    if (!router.isReady || !chatId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-gray-500 text-sm">대화 정보를 준비하고 있어요...</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-600 text-sm">대화 내용을 불러오는 중입니다...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="bg-white shadow-md rounded-xl px-6 py-4 max-w-sm text-center border border-gray-100">
                    <p className="text-sm text-gray-800 font-medium mb-2">
                        대화를 열 수 없습니다
                    </p>
                    <p className="text-xs text-gray-500 mb-4">{error}</p>
                    <button
                        onClick={() => router.push('/mypage')}
                        className="px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                        대화 목록으로 이동
                    </button>
                </div>
            </div>
        );
    }

    if (!conversation || !tenantId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-gray-500 text-sm">
                    유효한 대화 데이터를 찾을 수 없습니다.
                </p>
            </div>
        );
    }

    // ✅ 실제 상세 UI: 기존 ConversationDetail 재사용
    return (
        <div className="min-h-screen bg-gray-50">
            <ConversationDetail
                conversation={conversation}
                tenantId={tenantId}
                planName="business"
                isEmbedded={false}
                onClose={() => router.push('/mypage')}
            />
        </div>
    );
}
