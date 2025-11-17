// components/ConversationActions.jsx
// 대화 상태 관리 액션 버튼 (보류/중요/완료) - 모바일 최적화

import { useEffect, useState } from 'react';
import { Clock, Star, CheckCircle2, Loader2 } from 'lucide-react';

export default function ConversationActions({
    conversation,
    tenantId,
    onStatusChange
}) {
    const [loading, setLoading] = useState(null); // 어떤 버튼이 로딩중인지 추적
    const [currentStatus, setCurrentStatus] = useState('active');

    useEffect(() => {
        if (!conversation) {
            setCurrentStatus('active');
            return;
        }

        if (conversation.currentArchiveStatus) {
            setCurrentStatus(conversation.currentArchiveStatus);
            return;
        }

        const archiveStatus = (conversation.archive_status || conversation.archiveStatus || '').toLowerCase();
        const status = (conversation.status || '').toLowerCase();

        if (archiveStatus === 'completed' || status === 'completed') {
            setCurrentStatus('completed');
        } else if (archiveStatus === 'hold' || status === 'hold') {
            setCurrentStatus('hold');
        } else if (archiveStatus === 'important' || conversation.important) {
            setCurrentStatus('important');
        } else {
            setCurrentStatus('active');
        }
    }, [conversation]);

    const handleStatusChange = async (newStatus) => {
        if (loading) return;

        if (newStatus === 'completed') {
            const confirmed = window.confirm(
                '이 대화를 완료 처리하시겠습니까?\n완료된 대화는 "완료" 탭에서 확인할 수 있습니다.'
            );
            if (!confirmed) return;
        }

        const targetStatus = currentStatus === newStatus ? 'active' : newStatus;
        const chatId = conversation?.chatId || conversation?.id;

        if (!tenantId || !chatId) {
            console.error('[ConversationActions] Missing tenantId or chatId');
            alert('필수 정보가 없어 상태를 변경할 수 없습니다.');
            return;
        }

        setLoading(newStatus);
        try {
            const response = await fetch('/api/conversations/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId,
                    chatId,
                    archiveStatus: targetStatus === 'active' ? null : targetStatus,
                }),
            });

            if (!response.ok) throw new Error('상태 변경 실패');

            await response.json();
            setCurrentStatus(targetStatus);
            onStatusChange?.(targetStatus);
        } catch (error) {
            console.error('[ConversationActions] Status change error:', error);
            alert('상태 변경에 실패했습니다.');
        } finally {
            setLoading(null);
        }
    };

    const statusConfig = {
        hold: {
            label: '보류',
            icon: Clock,
            activeClass: 'bg-yellow-500 text-white',
            inactiveClass: 'bg-gray-100 text-gray-600',
            ringClass: 'ring-yellow-500',
        },
        important: {
            label: '중요',
            icon: Star,
            activeClass: 'bg-red-500 text-white',
            inactiveClass: 'bg-gray-100 text-gray-600',
            ringClass: 'ring-red-500',
            fill: true,
        },
        completed: {
            label: '완료',
            icon: CheckCircle2,
            activeClass: 'bg-green-500 text-white',
            inactiveClass: 'bg-gray-100 text-gray-600',
            ringClass: 'ring-green-500',
        },
    };

    return (
        <div className="border-t border-gray-100 bg-white">
            <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-3 scrollbar-hide">
                {Object.entries(statusConfig).map(([key, config]) => {
                    const Icon = config.icon;
                    const isActive = currentStatus === key;
                    const isLoading = loading === key;

                    return (
                        <button
                            key={key}
                            onClick={() => handleStatusChange(key)}
                            disabled={loading !== null}
                            className={`
                                flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium
                                transition-all whitespace-nowrap active:scale-95 disabled:opacity-50
                                ${isActive ? config.activeClass : config.inactiveClass}
                                ${isActive ? 'shadow-sm ring-2 ring-offset-1 ' + config.ringClass : 'hover:bg-gray-200'}
                            `}
                        >
                            {isLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Icon className={`w-3.5 h-3.5 ${config.fill && isActive ? 'fill-current' : ''}`} />
                            )}
                            <span className="hidden sm:inline">{config.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}