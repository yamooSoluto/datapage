// components/ConversationDetail.jsx
// 애플 스타일 대화 상세 모달
// 깔끔하고 직관적인 메시지 표시

import { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, TrendingUp, Clock, User, Bot, UserCheck } from 'lucide-react';

export default function ConversationDetail({ conversation, onClose }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        fetchDetail();
    }, [conversation.chatId]);

    useEffect(() => {
        // 메시지 로드 후 맨 아래로 스크롤
        if (detail?.messages && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [detail?.messages]);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const tenantId = conversation.id?.split('_')[0] || 'default';
            const res = await fetch(
                `/api/conversations/detail?tenant=${tenantId}&chatId=${conversation.chatId}`
            );
            const data = await res.json();
            setDetail(data);
        } catch (error) {
            console.error('Failed to fetch detail:', error);
        } finally {
            setLoading(false);
        }
    };

    // ESC 키로 닫기
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl">
                {/* 헤더 - 애플 스타일 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                            <span className="text-white text-sm font-semibold">
                                {conversation.userName?.charAt(0) || '?'}
                            </span>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">
                                {conversation.userName || '익명'}
                            </h2>
                            <p className="text-xs text-gray-500 font-mono">
                                {conversation.chatId}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 메시지 영역 */}
                <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600" />
                        </div>
                    ) : detail?.messages && detail.messages.length > 0 ? (
                        <div className="space-y-3">
                            {detail.messages.map((msg, idx) => (
                                <MessageBubble key={idx} message={msg} />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                                <User className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500">메시지가 없습니다</p>
                        </div>
                    )}
                </div>

                {/* 하단 정보 - 애플 스타일 */}
                <div className="px-6 py-4 bg-white border-t border-gray-100">
                    {/* 통계 */}
                    {detail?.stats && (
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-gray-900">
                                    {detail.stats.userChats}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                                    <User className="w-3 h-3" />
                                    사용자
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">
                                    {detail.stats.aiChats}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                                    <Bot className="w-3 h-3" />
                                    AI
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-600">
                                    {detail.stats.agentChats}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                                    <UserCheck className="w-3 h-3" />
                                    상담원
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 메타 정보 */}
                    {detail?.conversation && (
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                            <div className="flex items-center gap-3">
                                <span>상태: <span className="font-medium text-gray-700">{detail.conversation.status}</span></span>
                                <span>•</span>
                                <span>채널: <span className="font-medium text-gray-700">{detail.conversation.channel}</span></span>
                                <span>•</span>
                                <span>모드: <span className="font-medium text-gray-700">{detail.conversation.modeSnapshot || 'AUTO'}</span></span>
                            </div>
                        </div>
                    )}

                    {/* 슬랙 링크 */}
                    {detail?.slack?.slackUrl && (
                        <a
                            href={detail.slack.slackUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Slack에서 보기
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

// 메시지 버블 컴포넌트 - 애플 iMessage 스타일
function MessageBubble({ message }) {
    const isUser = message.sender === 'user';
    const isAI = message.sender === 'ai';
    const isAgent = message.sender === 'admin' || message.sender === 'agent';

    // 발신자 설정
    const senderConfig = {
        user: {
            name: '사용자',
            icon: User,
            align: 'flex-row-reverse',
            bubbleBg: 'bg-blue-600 text-white',
            bubbleAlign: 'ml-auto',
            iconBg: 'bg-gray-300',
            iconColor: 'text-gray-700',
        },
        ai: {
            name: 'AI',
            icon: Bot,
            align: 'flex-row',
            bubbleBg: 'bg-gray-200 text-gray-900',
            bubbleAlign: 'mr-auto',
            iconBg: 'bg-blue-500',
            iconColor: 'text-white',
        },
        agent: {
            name: '상담원',
            icon: UserCheck,
            align: 'flex-row',
            bubbleBg: 'bg-purple-100 text-purple-900',
            bubbleAlign: 'mr-auto',
            iconBg: 'bg-purple-500',
            iconColor: 'text-white',
        },
    }[isUser ? 'user' : isAI ? 'ai' : 'agent'];

    const Icon = senderConfig.icon;

    // 시간 포맷
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className={`flex items-end gap-2 ${senderConfig.align}`}>
            {/* 아바타 (사용자 제외) */}
            {!isUser && (
                <div className={`flex-shrink-0 w-7 h-7 rounded-full ${senderConfig.iconBg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${senderConfig.iconColor}`} />
                </div>
            )}

            {/* 메시지 버블 */}
            <div className={`max-w-[70%] ${senderConfig.bubbleAlign}`}>
                {/* 발신자 이름 (사용자 제외) */}
                {!isUser && (
                    <div className="text-xs text-gray-500 mb-1 px-1">
                        {senderConfig.name}
                    </div>
                )}

                {/* 버블 */}
                <div className={`rounded-2xl px-4 py-2.5 ${senderConfig.bubbleBg}`}>
                    {/* 모드 스냅샷 */}
                    {message.modeSnapshot && (
                        <div className={`text-xs mb-1 ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
                            [{message.modeSnapshot}]
                        </div>
                    )}

                    {/* 텍스트 */}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {message.text || '(내용 없음)'}
                    </p>

                    {/* 이미지 */}
                    {message.pics && message.pics.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {message.pics.map((pic, idx) => (
                                <img
                                    key={idx}
                                    src={pic}
                                    alt={`첨부 ${idx + 1}`}
                                    className="w-20 h-20 object-cover rounded-lg"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* 시간 */}
                <div className={`text-xs text-gray-400 mt-1 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
                    {formatTime(message.timestamp)}
                </div>
            </div>
        </div>
    );
}