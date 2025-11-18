// components/ConversationCard.jsx
// 차분하고 깔끔한 디자인 - 모든 기능 유지

import React from 'react';
import { MessageSquare, User, Bot, UserCheck, Tag, Image as ImageIcon } from 'lucide-react';

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

    // ✅ 카테고리 색상 매핑 - 작은 점으로 표시
    const getCategoryDotColor = (category) => {
        const colors = {
            '결제/환불': 'bg-blue-500',
            '예약/변경': 'bg-purple-500',
            '이용/시설': 'bg-green-500',
            '상품/서비스': 'bg-orange-500',
            '시스템/오류': 'bg-red-500',
            '건의/요청': 'bg-yellow-500',
            '이벤트/쿠폰': 'bg-pink-500',
            '기타': 'bg-gray-400',
        };
        return colors[category] || 'bg-gray-400';
    };

    // ✅ 먼저 계산: 승인 대기 상태 확인
    const relativeTime = getRelativeTime(conversation.lastMessageAt);
    const normalizedStatus = (conversation.status || '').toLowerCase();
    const isPendingApproval =
        conversation.draftStatus === 'pending_approval' && normalizedStatus !== 'completed';

    // ✅ 업무 타입별 썸네일 스타일
    const getAvatarStyle = () => {
        // ✅ 승인 대기 최우선 - 주황색
        if (isPendingApproval) {
            return {
                bg: 'bg-orange-100',
                text: 'text-orange-700',
                border: 'border-2 border-orange-400',
                pulse: true,
            };
        }

        if (!conversation.hasSlackCard && !conversation.taskType) {
            return {
                bg: 'bg-gray-100',
                text: 'text-gray-700',
                border: '',
            };
        }

        if (conversation.taskType === 'shadow') {
            return {
                bg: 'bg-gray-100',
                text: 'text-gray-500',
                border: '',
            };
        }

        if (conversation.taskType === 'work') {
            return {
                bg: 'bg-orange-50',
                text: 'text-orange-700',
                border: 'border border-orange-200',
            };
        }

        if (conversation.taskType === 'confirm') {
            return {
                bg: 'bg-purple-50',
                text: 'text-purple-700',
                border: 'border border-purple-200',
            };
        }

        if (conversation.taskType === 'agent') {
            return {
                bg: 'bg-red-50',
                text: 'text-red-700',
                border: 'border border-red-200',
            };
        }

        return {
            bg: 'bg-blue-50',
            text: 'text-blue-700',
            border: 'border border-blue-200',
        };
    };

    const avatarStyle = getAvatarStyle();

    return (
        <div
            onClick={onClick}
            className={`
                group relative bg-white rounded-lg p-3
                border transition-all duration-150 cursor-pointer
                ${isSelected
                    ? 'border-gray-300 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
            `}
        >
            <div className="flex items-start gap-3">
                {/* ✅ 아바타 - 업무 타입별 색상 */}
                <div className="flex-shrink-0 relative">
                    {/* 펄스 애니메이션 (승인 대기 시) */}
                    {avatarStyle.pulse && (
                        <div className="absolute inset-0 bg-orange-400 rounded-full animate-ping opacity-30"></div>
                    )}

                    <div className={`relative w-10 h-10 rounded-full ${avatarStyle.bg} ${avatarStyle.border} flex items-center justify-center`}>
                        <span className={`${avatarStyle.text} text-sm font-medium`}>
                            {conversation.userNameInitial || conversation.userName?.charAt(0) || '?'}
                        </span>
                    </div>
                </div>

                {/* 메인 정보 */}
                <div className="flex-1 min-w-0">
                    {/* 상단: 이름 + 시간 */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 truncate">
                                {conversation.userName || '익명'}
                            </h3>
                            {/* ✅ 카테고리 - 작은 점 + 텍스트 */}
                            {conversation.categories && conversation.categories.length > 0 && (
                                <div className="flex items-center gap-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${getCategoryDotColor(conversation.categories[0])}`} />
                                    <span className="text-xs text-gray-600">
                                        {conversation.categories[0]}
                                    </span>
                                </div>
                            )}
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                            {relativeTime}
                        </span>
                    </div>

                    {/* ✅ 승인 대기 상태 */}
                    {isPendingApproval && (
                        <div className="mb-1.5">
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                                승인 대기
                            </span>
                        </div>
                    )}

                    {/* 메시지 미리보기 */}
                    <div className="flex items-start gap-2 mb-2">
                        {/* 썸네일 표시 */}
                        {conversation.hasImages && conversation.firstThumbnailUrl && (
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                                <img
                                    src={conversation.firstThumbnailUrl}
                                    alt="첨부 이미지"
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400 text-xs">🖼️</div>';
                                    }}
                                />
                            </div>
                        )}

                        {/* 텍스트 미리보기 */}
                        <p className="flex-1 text-sm text-gray-700 line-clamp-2">
                            {conversation.summary || conversation.lastMessageText || '메시지 없음'}
                            {conversation.imageCount > 1 && (
                                <span className="ml-1 text-xs text-gray-400">
                                    +{conversation.imageCount - 1}
                                </span>
                            )}
                        </p>
                    </div>

                    {/* 하단: 통계 */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-gray-500">
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
                                <span className="flex items-center gap-1 text-blue-600">
                                    <Bot className="w-3.5 h-3.5" />
                                    {conversation.messageCount.ai}
                                </span>
                            )}
                            {conversation.messageCount?.agent > 0 && (
                                <span className="flex items-center gap-1 text-green-600">
                                    <UserCheck className="w-3.5 h-3.5" />
                                    {conversation.messageCount.agent}
                                </span>
                            )}
                            {conversation.hasImages && (
                                <span className="flex items-center gap-1 text-purple-600" title={`이미지 ${conversation.imageCount}개`}>
                                    <ImageIcon className="w-3.5 h-3.5" />
                                    {conversation.imageCount}
                                </span>
                            )}
                        </div>

                        {/* ✅ 업무 타입 표시 */}
                        <div className="flex items-center gap-1.5">
                            {conversation.taskType === 'work' && (
                                <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                                    업무
                                </span>
                            )}
                            {conversation.taskType === 'shadow' && (
                                <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-gray-50 text-gray-600">
                                    자동
                                </span>
                            )}
                            {conversation.taskType === 'confirm' && (
                                <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                    승인
                                </span>
                            )}
                            {conversation.taskType === 'agent' && (
                                <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                                    상담
                                </span>
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