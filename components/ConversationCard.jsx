// components/ConversationCard.jsx
// 애플 스타일 - 절제되고 깔끔한 디자인
// 채널 이모지 제거, 카테고리 태그 추가, 업무 타입별 차별화

import React from 'react';
import { MessageSquare, User, Bot, UserCheck, Tag } from 'lucide-react';

const ConversationCard = React.memo(({ conversation, onClick, isSelected }) => {
    // 디버그 로그 추가
    if (conversation.hasSlackCard) {
        console.log('🔍 슬랙 카드 정보:', {
            chatId: conversation.chatId,
            hasSlackCard: conversation.hasSlackCard,
            taskType: conversation.taskType,
            slackCardType: conversation.slackCardType,
            isTask: conversation.isTask
        });
    }

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

    // ✅ 카테고리 색상 매핑
    const getCategoryColor = (category) => {
        const colors = {
            '불편사항': 'bg-orange-50 text-orange-600 border-orange-200',
            '오류': 'bg-red-50 text-red-600 border-red-200',
            '결제': 'bg-blue-50 text-blue-600 border-blue-200',
            '건의': 'bg-purple-50 text-purple-600 border-purple-200',
            '문의': 'bg-gray-50 text-gray-600 border-gray-200',
            '칭찬': 'bg-green-50 text-green-600 border-green-200',
            '기타': 'bg-gray-50 text-gray-500 border-gray-200',
        };
        return colors[category] || 'bg-gray-50 text-gray-500 border-gray-200';
    };

    // ✅ 업무 타입별 썸네일 스타일
    const getAvatarStyle = () => {
        if (!conversation.hasSlackCard) {
            // 슬랙 카드 없음 - 기본 스타일
            return {
                bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
                text: 'text-white'
            };
        }

        if (conversation.taskType === 'shadow') {
            // Shadow/Skip 카드 - 그레이톤 (자동 처리됨)
            return {
                bg: 'bg-gradient-to-br from-gray-300 to-gray-400',
                text: 'text-gray-600'
            };
        }

        if (conversation.taskType === 'work') {
            // 업무 카드 (create/update/upgrade) - 강조 색상
            return {
                bg: 'bg-gradient-to-br from-yellow-400 to-orange-500',
                text: 'text-white'
            };
        }

        // 기타
        return {
            bg: 'bg-gradient-to-br from-purple-400 to-purple-500',
            text: 'text-white'
        };
    };

    const relativeTime = getRelativeTime(conversation.lastMessageAt);
    const avatarStyle = getAvatarStyle();

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
                {/* ✅ 아바타 - 업무 타입별 색상 */}
                <div className="flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full ${avatarStyle.bg} flex items-center justify-center`}>
                        <span className={`${avatarStyle.text} text-sm font-semibold`}>
                            {conversation.userNameInitial || conversation.userName?.charAt(0) || '?'}
                        </span>
                    </div>
                </div>

                {/* 메인 정보 */}
                <div className="flex-1 min-w-0">
                    {/* 상단: 이름 + 시간 */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {conversation.userName || '익명'}
                        </h3>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                            {relativeTime}
                        </span>
                    </div>

                    {/* 메시지 미리보기 - summary 우선 */}
                    <p className="text-sm text-gray-600 truncate mb-2">
                        {conversation.summary || conversation.lastMessageText || '메시지 없음'}
                    </p>

                    {/* ✅ 카테고리 태그 */}
                    {conversation.categories && conversation.categories.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                            {conversation.categories.slice(0, 3).map((cat, idx) => (
                                <span
                                    key={idx}
                                    className={`text-xs px-2 py-0.5 rounded-full font-medium border ${getCategoryColor(cat)}`}
                                >
                                    {cat}
                                </span>
                            ))}
                            {conversation.categories.length > 3 && (
                                <span className="text-xs text-gray-400">
                                    +{conversation.categories.length - 3}
                                </span>
                            )}
                        </div>
                    )}

                    {/* 하단: 통계 */}
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
                            {/* ✅ Agent 카운트 표시 */}
                            {conversation.messageCount?.agent > 0 && (
                                <span className="flex items-center gap-1 text-purple-500">
                                    <UserCheck className="w-3.5 h-3.5" />
                                    {conversation.messageCount.agent}
                                </span>
                            )}
                        </div>

                        {/* ✅ 업무 타입 표시 */}
                        <div className="flex items-center gap-1.5">
                            {conversation.taskType === 'work' && (
                                <span
                                    className="w-1.5 h-1.5 rounded-full bg-orange-500"
                                    title="업무 필요"
                                />
                            )}
                            {conversation.taskType === 'shadow' && (
                                <span
                                    className="w-1.5 h-1.5 rounded-full bg-gray-400"
                                    title="자동 처리됨"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

ConversationCard.displayName = 'ConversationCard';

export default ConversationCard;