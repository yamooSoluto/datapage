// components/ConversationActions.jsx
// 대화 상태 관리 - 모바일 스와이프 + 상단 저장 아이콘

import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';

export default function ConversationActions({
    conversation,
    tenantId,
    onStatusChange
}) {
    const [currentStatus, setCurrentStatus] = useState('active');
    const [saving, setSaving] = useState(false);

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
        } else if (archiveStatus === 'saved' || archiveStatus === 'hold' || archiveStatus === 'important' || conversation.important) {
            setCurrentStatus('saved');
        } else {
            setCurrentStatus('active');
        }
    }, [conversation]);

    const effectiveTenantId =
        tenantId ||
        conversation?.tenant ||
        conversation?.tenantId ||
        conversation?.tenant_id ||
        (typeof conversation?.id === 'string' && conversation.id.includes('_')
            ? conversation.id.split('_')[0]
            : null);

    const handleSaveToggle = async () => {
        if (saving) return;

        const targetStatus = currentStatus === 'saved' ? 'active' : 'saved';
        const chatId =
            conversation?.chatId ||
            conversation?.chat_id ||
            conversation?.id;

        if (!effectiveTenantId || !chatId) {
            console.error('[ConversationActions] Missing tenantId or chatId');
            alert('필수 정보가 없어 상태를 변경할 수 없습니다.');
            return;
        }

        // ✅ 낙관적 업데이트: 즉시 UI 변경
        const previousStatus = currentStatus;
        setCurrentStatus(targetStatus);
        onStatusChange?.(targetStatus, {
            chatId,
            tenantId: effectiveTenantId,
        });

        setSaving(true);
        try {
            const response = await fetch('/api/conversations/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: effectiveTenantId,
                    chatId,
                    archiveStatus: targetStatus === 'active' ? null : targetStatus,
                }),
            });

            if (!response.ok) throw new Error('상태 변경 실패');

            await response.json();
        } catch (error) {
            console.error('[ConversationActions] Save toggle error:', error);
            // ✅ 실패 시 원래 상태로 복구
            setCurrentStatus(previousStatus);
            onStatusChange?.(previousStatus, {
                chatId,
                tenantId: effectiveTenantId,
            });
            alert('저장 상태 변경에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const isSaved = currentStatus === 'saved';

    return (
        <button
            onClick={handleSaveToggle}
            disabled={saving}
            className="p-2 transition-all active:scale-95 disabled:opacity-50"
            aria-label={isSaved ? '저장 취소' : '저장'}
        >
            <Bookmark
                className={`w-5 h-5 transition-colors ${isSaved
                    ? 'text-blue-500 fill-current'
                    : 'text-gray-400'
                    }`}
            />
        </button>
    );
}