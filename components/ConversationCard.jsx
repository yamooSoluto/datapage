// components/ConversationCard.jsx
// 애플 스타일 - 절제되고 깔끔한 디자인
// 높이 최소화, 불필요한 정보 제거

import React from 'react';
import { MessageSquare, User, Bot, UserCheck } from 'lucide-react';

const ConversationCard = React.memo(({ conversation, onClick, isSelected }) => {
    // 상대 시간 계산
    const getRelativeTime = (dateString) => {
        if (!dateString) return '';
        const now = new Date();
        const date = new Date(dateString);
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return '방금';
        if (minutes < 60) return `${minutes}분`;
        if (hours < 24) return `${hours}시간`;
        if (days < 7) return `${days}일`;
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    };

    // 채널 이모지 (간결하게)
    const getChannelEmoji = (channel) => {
        const map = {
            widget: '💬',
            naver: '🟢',
            kakao: '💛',
            channeltalk_kakao: '📱',
            channeltalk_naver: '📱',
        };
        return map[channel] || '💬';
    };

    // 상태 색상 (애플 스타일 - 부드러운 색상)
    const getStatusColor = (status) => {
        const colors = {
            waiting: 'bg-orange-50 text-orange-600',
            in_progress: 'bg-blue-50 text-blue-600',
            resolved: 'bg-green-50 text-green-600',
        };
        return colors[status] || 'bg-gray-50 text-gray-600';
    };

    const relativeTime = getRelativeTime(conversation.lastMessageAt);
    const channelEmoji = getChannelEmoji(conversation.channel);
    const statusColor = getStatusColor(conversation.status);

    return (
        <div
            onClick={onClick}
            className={`
        group relative bg-white rounded-xl p-3.5
        border border-gray-100
        hover:border-gray-200 hover:shadow-sm
        active:scale-[0.99]
        transition-all duration-200 cursor-pointer
        ${isSelected ? 'ring-2 ring-blue-500 border-transparent' : ''}
      `}
        >
            <div className="flex items-center gap-3">
                {/* 아바타 (작게) */}
                <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <span className="text-white text-sm font-semibold">
                            {conversation.userName?.charAt(0) || '?'}
                        </span>
                    </div>
                </div>

                {/* 메인 정보 */}
                <div className="flex-1 min-w-0">
                    {/* 상단: 이름 + 채널 + 시간 */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 truncate">
                                {conversation.userName || '익명'}
                            </h3>
                            <span className="text-base flex-shrink-0">{channelEmoji}</span>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                            {relativeTime}
                        </span>
                    </div>

                    {/* 메시지 미리보기 */}
                    <p className="text-sm text-gray-600 truncate mb-1.5">
                        {conversation.lastMessageText || '메시지 없음'}
                    </p>

                    {/* 하단: 통계 + 상태 */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                                <MessageSquare className="w-3.5 h-3.5" />
                                {conversation.messageCount?.total || 0}
                            </span>
                            {conversation.messageCount?.user > 0 && (
                                <span className="flex items-center gap-1">
                                    <User className="w-3.5 h-3.5" />
                                    {conversation.messageCount.user}
                                </span>
                            )}
                            {conversation.messageCount?.ai > 0 && (
                                <span className="flex items-center gap-1 text-blue-500">
                                    <Bot className="w-3.5 h-3.5" />
                                    {conversation.messageCount.ai}
                                </span>
                            )}
                            {conversation.messageCount?.agent > 0 && (
                                <span className="flex items-center gap-1 text-purple-500">
                                    <UserCheck className="w-3.5 h-3.5" />
                                    {conversation.messageCount.agent}
                                </span>
                            )}
                        </div>

                        {/* 상태 (작은 점으로 표시 - 애플 스타일) */}
                        <div className="flex items-center gap-1.5">
                            {conversation.isTask && (
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" title="업무" />
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                                {conversation.status === 'waiting' ? '대기'
                                    : conversation.status === 'in_progress' ? '진행'
                                        : '완료'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

ConversationCard.displayName = 'ConversationCard';

export default ConversationCard;