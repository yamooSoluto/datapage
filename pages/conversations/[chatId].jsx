// pages/conversations/[chatId].jsx
// 대화 Direct Link - ConversationDetail 컴포넌트 사용

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { auth, getCurrentClaims } from "@/lib/firebase-auth";
import ConversationDetail from "@/components/ConversationDetail";

export default function ConversationDirectLink() {
    const router = useRouter();
    const { chatId: rawChatId } = router.query;

    // /conversations/[chatId] 에서 chatId 값
    const chatId =
        Array.isArray(rawChatId) ? rawChatId[0] : rawChatId || null;

    const [tenantId, setTenantId] = useState(null);
    const [conversation, setConversation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authChecked, setAuthChecked] = useState(false);
    const [error, setError] = useState("");

    // 1) 로그인 상태 + tenantId 확인
    useEffect(() => {
        if (!router.isReady) return;

        const unsub = onAuthStateChanged(auth, async (user) => {
            try {
                if (!user) {
                    // 🔐 로그인 안 된 상태 – 페이지는 살아 있고, 안내만 보여줄 거라
                    setAuthChecked(true);
                    setTenantId(null);
                    setLoading(false);
                    return;
                }

                const claims = await getCurrentClaims().catch(() => null);
                const tid =
                    claims?.tenantId ||
                    claims?.tenant_id ||
                    claims?.tenant ||
                    null;

                if (!tid) {
                    setError("tenant 정보를 찾을 수 없습니다.");
                    setLoading(false);
                    setAuthChecked(true);
                    return;
                }

                setTenantId(tid);
                setAuthChecked(true);
            } catch (e) {
                console.error("[ConversationDirectLink] auth error:", e);
                setError("인증 정보를 확인하는 중 오류가 발생했습니다.");
                setAuthChecked(true);
                setLoading(false);
            }
        });

        return () => unsub();
    }, [router.isReady]);

    // 2) tenantId + chatId 로 대화 상세 불러오기
    useEffect(() => {
        if (!authChecked) return;
        if (!tenantId || !chatId) {
            // 로그인 안된 상태거나 필수값 없음
            setLoading(false);
            return;
        }

        const fetchDetail = async () => {
            try {
                setLoading(true);
                setError("");

                const res = await fetch(
                    `/api/conversations/detail?tenant=${encodeURIComponent(
                        tenantId
                    )}&chatId=${encodeURIComponent(chatId)}`
                );

                if (!res.ok) {
                    if (res.status === 404) {
                        throw new Error("해당 대화를 찾을 수 없습니다.");
                    }
                    throw new Error(`대화 정보를 불러오지 못했습니다. (${res.status})`);
                }

                const data = await res.json();
                if (!data.conversation) {
                    throw new Error("대화 데이터가 비어 있습니다.");
                }

                setConversation(data.conversation);
            } catch (e) {
                console.error("[ConversationDirectLink] fetch error:", e);
                setError(e.message || "대화 정보를 불러오는 중 오류가 발생했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchDetail();
    }, [authChecked, tenantId, chatId]);

    // ─── 화면 상태별 UI ─────────────────────────────

    // 아직 라우터도 준비 안 됐거나 chatId 없음
    if (!router.isReady || !chatId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-gray-500 text-sm">대화 정보를 준비하고 있어요...</p>
            </div>
        );
    }

    // 로딩 중
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

    // 로그인 안 된 상태
    if (authChecked && !tenantId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="bg-white shadow-md rounded-xl px-6 py-4 max-w-sm text-center border border-gray-100">
                    <p className="text-sm text-gray-800 font-medium mb-2">
                        이 대화를 보려면 로그인이 필요해요
                    </p>
                    <p className="text-xs text-gray-500 mb-4">
                        로그인 후 다시{" "}
                        <span className="font-mono text-[11px] bg-gray-100 px-1 rounded">
                            /conversations/{chatId}
                        </span>{" "}
                        주소로 접속하시면 됩니다.
                    </p>
                    <button
                        onClick={() => router.push("/")}
                        className="px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                        로그인 페이지로 이동
                    </button>
                </div>
            </div>
        );
    }

    // 에러
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="bg-white shadow-md rounded-xl px-6 py-4 max-w-sm text-center border border-gray-100">
                    <p className="text-sm text-gray-800 font-medium mb-2">
                        대화를 열 수 없습니다
                    </p>
                    <p className="text-xs text-gray-500 mb-4">{error}</p>
                    <button
                        onClick={() => router.push("/mypage")}
                        className="px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                        대화 목록으로 이동
                    </button>
                </div>
            </div>
        );
    }

    // 유효한 데이터 없음
    if (!conversation || !tenantId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-gray-500 text-sm">
                    유효한 대화 데이터를 찾을 수 없습니다.
                </p>
            </div>
        );
    }

    // 실제 상세 화면
    return (
        <div className="min-h-screen bg-gray-50">
            <ConversationDetail
                conversation={conversation}
                tenantId={tenantId}
                isEmbedded={false}
                planName={conversation.plan || "trial"}
                onClose={() => router.push("/mypage")}
            />
        </div>
    );
}
