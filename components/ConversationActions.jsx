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

    const handleSaveToggle = async () => {
        if (saving) return;

        const targetStatus = currentStatus === 'saved' ? 'active' : 'saved';
        const chatId = conversation?.chatId || conversation?.id;

        if (!tenantId || !chatId) {
            console.error('[ConversationActions] Missing tenantId or chatId');
            alert('필수 정보가 없어 상태를 변경할 수 없습니다.');
            return;
        }

        setSaving(true);
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
            console.error('[ConversationActions] Save toggle error:', error);
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
            className={`
                p-2 rounded-full transition-all active:scale-90 disabled:opacity-50
                ${isSaved
                    ? 'text-blue-500 hover:bg-blue-50'
                    : 'text-gray-400 hover:bg-gray-100'
                }
            `}
            aria-label={isSaved ? '저장 취소' : '저장'}
        >
            <Bookmark
                className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`}
            />
        </button>
    );
}