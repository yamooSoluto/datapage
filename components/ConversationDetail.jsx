// components/ConversationDetail.jsx
// 애플 스타일 대화 상세 모달 - 클라이언트 중심 최적화

import { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, User, Bot, UserCheck, ZoomIn } from 'lucide-react';

export default function ConversationDetail({ conversation, onClose }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imagePreview, setImagePreview] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        fetchDetail();
    }, [conversation.chatId]);

    useEffect(() => {
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

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                if (imagePreview) {
                    setImagePreview(null);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose, imagePreview]);

    return (
        <>
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={(e) => e.target === e.currentTarget && onClose()}
            >
                <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-gray-200">
                    {/* 헤더 */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                                <span className="text-white text-sm font-semibold">
                                    {conversation.userName?.charAt(0) || '?'}
                                </span>
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">
                                    {conversation.userName || '익명'}
                                </h2>
                                <p className="text-xs text-gray-500">
                                    {conversation.channel || 'unknown'} • {conversation.chatId}
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
                                {/* 시작 날짜 표시 */}
                                {detail.messages[0]?.timestamp && (
                                    <div className="flex items-center justify-center my-4">
                                        <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                                            {new Date(detail.messages[0].timestamp).toLocaleDateString('ko-KR', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                weekday: 'long'
                                            })}
                                        </div>
                                    </div>
                                )}

                                {detail.messages.map((msg, idx) => (
                                    <MessageBubble
                                        key={idx}
                                        message={msg}
                                        onImageClick={(url) => setImagePreview(url)}
                                    />
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

                    {/* 하단 정보 - 배경 투명 */}
                    <div className="px-6 py-4 flex-shrink-0">
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
                            <div className="space-y-3">
                                {/* 요약 - 깔끔하게 */}
                                {detail.conversation.summary && (
                                    <div className="text-sm text-gray-700">
                                        <span className="font-semibold">요약</span> {detail.conversation.summary}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 이미지 프리뷰 모달 */}
            {imagePreview && (
                <div
                    className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
                    onClick={() => setImagePreview(null)}
                >
                    <button
                        onClick={() => setImagePreview(null)}
                        className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img
                        src={imagePreview}
                        alt="미리보기"
                        className="max-w-full max-h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}

// 메시지 버블 컴포넌트
function MessageBubble({ message, onImageClick }) {
    const isUser = message.sender === 'user';

    // ✅ 상담원 구분 로직 개선: modeSnapshot이 AGENT면 상담원으로 처리
    const isAgent =
        message.sender === 'admin' ||
        message.sender === 'agent' ||
        (message.sender === 'ai' && message.modeSnapshot === 'AGENT');

    // ✅ AI는 상담원이 아닌 경우에만
    const isAI = message.sender === 'ai' && !isAgent;

    const senderConfig = {
        user: {
            name: '사용자',
            icon: User,
            align: 'flex-row',
            bubbleBg: 'bg-gray-200 text-gray-900',
            bubbleAlign: 'mr-auto',
            iconBg: 'bg-gray-300',
            iconColor: 'text-gray-700',
        },
        ai: {
            name: 'AI',
            icon: Bot,
            align: 'flex-row-reverse',
            bubbleBg: 'bg-blue-600 text-white',
            bubbleAlign: 'ml-auto',
            iconBg: 'bg-blue-500',
            iconColor: 'text-white',
        },
        agent: {
            name: '상담원',
            icon: UserCheck,
            align: 'flex-row-reverse',
            bubbleBg: 'bg-purple-600 text-white',
            bubbleAlign: 'ml-auto',
            iconBg: 'bg-purple-500',
            iconColor: 'text-white',
        },
    }[isUser ? 'user' : isAgent ? 'agent' : 'ai'];

    const Icon = senderConfig.icon;

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
            {/* 아바타 */}
            <div className={`flex-shrink-0 w-7 h-7 rounded-full ${senderConfig.iconBg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${senderConfig.iconColor}`} />
            </div>

            {/* 메시지 버블 */}
            <div className={`max-w-[80%] ${senderConfig.bubbleAlign}`}>
                {/* 발신자 이름 */}
                <div className="text-xs text-gray-500 mb-1 px-1">
                    {senderConfig.name}
                </div>

                {/* 버블 */}
                <div className={`rounded-2xl px-4 py-2.5 ${senderConfig.bubbleBg}`}>
                    {/* 텍스트 */}
                    {message.text && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {message.text}
                        </p>
                    )}

                    {/* 이미지 - 최적화된 레이아웃 */}
                    {message.pics && message.pics.length > 0 && (
                        <div className={`${message.text ? 'mt-2' : ''} space-y-2`}>
                            {message.pics.length === 1 ? (
                                /* 단일 이미지 - 버블 내부에 딱 맞게 */
                                <div
                                    className="relative group cursor-pointer overflow-hidden rounded-lg"
                                    onClick={() => onImageClick(message.pics[0].url || message.pics[0])}
                                >
                                    <img
                                        src={message.pics[0].url || message.pics[0]}
                                        alt="첨부 이미지"
                                        className="w-full h-auto max-h-80 object-contain rounded-lg"
                                        onError={(e) => {
                                            e.target.parentElement.innerHTML = `
                                                <div class="w-full h-32 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                                                    이미지를 불러올 수 없습니다
                                                </div>
                                            `;
                                        }}
                                    />
                                    {/* 호버 시 확대 아이콘 */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
                                            <ZoomIn className="w-5 h-5 text-gray-900" />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* 다중 이미지 - 2열 그리드 */
                                <div className="grid grid-cols-2 gap-2">
                                    {message.pics.map((pic, idx) => (
                                        <div
                                            key={idx}
                                            className="relative group cursor-pointer overflow-hidden rounded-lg aspect-square"
                                            onClick={() => onImageClick(pic.url || pic)}
                                        >
                                            <img
                                                src={pic.url || pic}
                                                alt={`첨부 ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.target.parentElement.innerHTML = `
                                                        <div class="w-full h-full bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                                                            오류
                                                        </div>
                                                    `;
                                                }}
                                            />
                                            {/* 호버 시 확대 아이콘 */}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-1.5">
                                                    <ZoomIn className="w-4 h-4 text-gray-900" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
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