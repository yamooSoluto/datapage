// components/ConversationActions.jsx
// 대화 상태 관리 액션 버튼 (보류/중요/완료만)

import { useMemo, useState } from 'react';
import { Clock, Star, CheckCircle2, Loader2 } from 'lucide-react';

export default function ConversationActions({
    conversation,
    tenantId,
    onStatusChange
}) {
    const [loading, setLoading] = useState(false);
    const [note, setNote] = useState('');

    const isOnHold = useMemo(() => {
        const status = (conversation?.status || conversation?.archive_status || '').toLowerCase();
        return status === 'hold';
    }, [conversation?.status, conversation?.archive_status]);

    const isImportant = useMemo(() => {
        if (typeof conversation?.important === 'boolean') {
            return conversation.important;
        }
        return (conversation?.archive_status || '') === 'important';
    }, [conversation?.important, conversation?.archive_status]);

    // 상태 변경 핸들러
    const handleArchiveToggle = async (target) => {
        if (loading) return;

        const nextArchiveStatus = (() => {
            if (target === 'hold') {
                return isOnHold ? null : 'hold';
            }
            if (target === 'important') {
                return isImportant ? null : 'important';
            }
            return null;
        })();

        setLoading(true);
        try {
            const response = await fetch('/api/conversations/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: tenantId,
                    chatId: conversation.chatId || conversation.id,
                    archiveStatus: nextArchiveStatus,
                    note: note || null,
                }),
            });

            if (!response.ok) {
                throw new Error('상태 변경 실패');
            }

            const result = await response.json();
            console.log('[Actions] Status changed:', result);

            // 부모 컴포넌트에 알림
            onStatusChange?.(result.status || result.archiveStatus);

            // 상태 초기화
            setNote('');
        } catch (error) {
            console.error('[Actions] Error:', error);
            alert('상태 변경에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 완료 처리
    const handleComplete = async () => {
        if (loading) return;

        const confirmed = window.confirm('이 대화를 완료 처리하시겠습니까?\n슬랙 카드가 삭제됩니다.');
        if (!confirmed) return;

        setLoading(true);
        try {
            const response = await fetch('/api/conversations/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: tenantId,
                    chatId: conversation.chatId || conversation.id,
                }),
            });

            if (!response.ok) {
                throw new Error('완료 처리 실패');
            }

            const result = await response.json();
            console.log('[Actions] Completed:', result);

            // 부모 컴포넌트에 알림
            if (onStatusChange) {
                onStatusChange('completed');
            }

            alert('✅ 완료 처리되었습니다.');
        } catch (error) {
            console.error('[Actions] Error:', error);
            alert('완료 처리에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 버튼 공통 스타일
    const getButtonStyle = (isActive) => {
        const baseStyle = "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all";

        if (isActive) {
            return `${baseStyle} text-white shadow-sm`;
        }

        return `${baseStyle} bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95`;
    };

    return (
        <div className="border-t border-gray-100 p-4 bg-white">
            {/* 액션 버튼 */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* 보류 */}
                <button
                    onClick={() => handleArchiveToggle('hold')}
                    disabled={loading}
                    className={`${getButtonStyle(isOnHold)} ${isOnHold ? 'bg-yellow-500' : ''}`}
                >
                    {loading && isOnHold ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Clock className="w-4 h-4" />
                    )}
                    <span>보류</span>
                </button>

                {/* 중요 */}
                <button
                    onClick={() => handleArchiveToggle('important')}
                    disabled={loading}
                    className={`${getButtonStyle(isImportant)} ${isImportant ? 'bg-red-500' : ''}`}
                >
                    {loading && isImportant ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Star className={`w-4 h-4 ${isImportant ? 'fill-current' : ''}`} />
                    )}
                    <span>중요</span>
                </button>

                {/* 구분선 */}
                <div className="w-px h-6 bg-gray-300 mx-1" />

                {/* 완료 */}
                <button
                    onClick={handleComplete}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 active:scale-95 transition-all disabled:opacity-50 shadow-sm"
                >
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>완료</span>
                </button>
            </div>

            {/* 현재 상태 표시 */}
            {(isOnHold || isImportant) && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {isOnHold && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                            <Clock className="w-3 h-3" />
                            <span>보류 중</span>
                        </div>
                    )}
                    {isImportant && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <Star className="w-3 h-3 fill-current" />
                            <span>중요 표시</span>
                        </div>
                    )}
                    {conversation.archive_note && (
                        <span className="text-xs text-gray-500">
                            {conversation.archive_note}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}