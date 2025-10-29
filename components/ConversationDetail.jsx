// components/ConversationDetail.jsx
// 애플 스타일 대화 상세 모달
// 깔끔하고 직관적인 메시지 표시

import React, { useState, useEffect } from 'react';
import { X, Bot, User, UserCheck, Calendar, MessageSquare, ExternalLink } from 'lucide-react';

export default function ConversationDetail({ conversation, onClose }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (conversation) {
            fetchMessages();
        }
    }, [conversation]);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                tenant: conversation.tenantId,
                chatId: conversation.chatId,
            });

            const res = await fetch(`/api/conversations/detail?${params}`);
            const data = await res.json();
            setMessages(data.messages || []);
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        } finally {
            setLoading(false);
        }
    };

    // 메시지 발신자 아이콘
    const getSenderIcon = (sender) => {
        if (sender === 'ai') return <Bot className="w-4 h-4 text-blue-500" />;
        if (sender === 'agent') return <UserCheck className="w-4 h-4 text-purple-500" />;
        return <User className="w-4 h-4 text-gray-500" />;
    };

    // 메시지 발신자 배경색
    const getSenderBgColor = (sender) => {
        if (sender === 'ai') return 'bg-blue-50';
        if (sender === 'agent') return 'bg-purple-50';
        return 'bg-gray-50';
    };

    // 메시지 발신자 이름
    const getSenderName = (sender) => {
        if (sender === 'ai') return 'AI 응답';
        if (sender === 'agent') return '상담사';
        return conversation.userName || '고객';
    };

    // 시간 포맷
    const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // 배경 클릭 시 닫기
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleBackdropClick}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* 헤더 */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                            <span className="text-white text-lg font-semibold">
                                {conversation.userName?.charAt(0) || '?'}
                            </span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">
                                {conversation.userName || '익명'}
                            </h2>
                            <p className="text-sm text-gray-500 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                {conversation.messageCount?.total || 0}개의 메시지
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                    >
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                {/* 메타 정보 */}
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-600">채널:</span>
                        <span className="px-2 py-1 bg-white rounded-lg font-semibold">
                            {conversation.channel === 'widget' && '💬 위젯'}
                            {conversation.channel === 'naver' && '🟢 네이버'}
                            {conversation.channel === 'kakao' && '💛 카카오'}
                            {conversation.channel === 'channeltalk_kakao' && '📱 채널톡(카카오)'}
                            {conversation.channel === 'channeltalk_naver' && '📱 채널톡(네이버)'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-600">상태:</span>
                        <span className={`px-2 py-1 rounded-lg font-semibold ${conversation.status === 'waiting' ? 'bg-orange-100 text-orange-700' :
                            conversation.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                'bg-green-100 text-green-700'
                            }`}>
                            {conversation.status === 'waiting' ? '대기중' :
                                conversation.status === 'in_progress' ? '진행중' : '완료'}
                        </span>
                    </div>
                    {conversation.isTask && (
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg font-semibold">
                                🔖 업무
                            </span>
                        </div>
                    )}
                    {conversation.slackUrl && (
                        <a
                            href={conversation.slackUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-lg font-semibold hover:bg-purple-200 transition-colors"
                        >
                            Slack
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>

                {/* 메시지 목록 */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-200 border-t-blue-600" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="text-center py-20">
                            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">메시지가 없습니다</p>
                        </div>
                    ) : (
                        messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`flex items-start gap-3 p-4 rounded-xl ${getSenderBgColor(msg.sender)} transition-all hover:shadow-sm`}
                            >
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                                    {getSenderIcon(msg.sender)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-semibold text-gray-900">
                                            {getSenderName(msg.sender)}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {formatTime(msg.timestamp)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                                        {msg.content}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* 푸터 */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>마지막 메시지: {formatTime(conversation.lastMessageAt)}</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}