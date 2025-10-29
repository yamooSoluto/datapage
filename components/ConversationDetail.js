// components/ConversationDetail.js
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function ConversationDetail({ conversation, onClose }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDetail();
    }, [conversation.chatId]);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const parts = conversation.id.split('_');
            const tenantId = parts.length >= 3 ? `${parts[0]}_${parts[1]}` : parts[0];

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

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
                {/* 헤더 */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-gray-900 truncate">
                            {conversation.userName}
                        </h2>
                        <div className="flex items-center space-x-2 mt-1">
                            <p className="text-sm text-gray-500">
                                {conversation.chatId}
                            </p>
                            {conversation.brandName && (
                                <>
                                    <span className="text-gray-300">•</span>
                                    <span className="text-sm text-gray-500">
                                        {conversation.brandName}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="flex-shrink-0 ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 메시지 목록 */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : detail?.messages?.length > 0 ? (
                        detail.messages.map((msg, idx) => (
                            <MessageBubble key={msg.msgId || idx} message={msg} />
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <p className="text-sm">메시지가 없습니다</p>
                        </div>
                    )}
                </div>

                {/* 하단 정보 */}
                {detail?.conversation && (
                    <div className="p-6 border-t border-gray-200 bg-white">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                            <div className="space-y-1">
                                <div className="text-gray-500 text-xs">상태</div>
                                <div className="font-medium">{detail.conversation.status}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-gray-500 text-xs">채널</div>
                                <div className="font-medium">{detail.conversation.channel}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-gray-500 text-xs">모드</div>
                                <div className="font-medium">{detail.conversation.currentMode || detail.conversation.modeSnapshot}</div>
                            </div>
                            {detail.conversation.sessionCount > 1 && (
                                <div className="space-y-1">
                                    <div className="text-gray-500 text-xs">세션</div>
                                    <div className="font-medium">{detail.conversation.sessionCount}개</div>
                                </div>
                            )}
                        </div>

                        {detail.stats && (
                            <div className="grid grid-cols-3 gap-4 text-sm mb-4 p-3 bg-gray-50 rounded-lg">
                                <div className="text-center">
                                    <div className="text-gray-500 text-xs">사용자</div>
                                    <div className="font-semibold text-blue-600">{detail.stats.userChats}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-gray-500 text-xs">AI</div>
                                    <div className="font-semibold text-green-600">{detail.stats.aiChats}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-gray-500 text-xs">상담사</div>
                                    <div className="font-semibold text-purple-600">{detail.stats.agentChats}</div>
                                </div>
                            </div>
                        )}

                        {detail.slack && (
                            <a
                                href={detail.slack.slackUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center space-x-2 w-full px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                                </svg>
                                <span>Slack에서 보기</span>
                            </a>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function MessageBubble({ message }) {
    const isUser = message.sender === 'user';
    const isAI = message.sender === 'ai';
    const isAgent = message.sender === 'admin' || message.sender === 'agent';

    const bgColor = isUser
        ? 'bg-blue-600 text-white'
        : isAI
            ? 'bg-gray-100 text-gray-900'
            : 'bg-purple-100 text-purple-900';

    const alignment = isUser ? 'items-end' : 'items-start';

    return (
        <div className={`flex flex-col ${alignment}`}>
            <div className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${bgColor}`}>
                {!isUser && (
                    <div className={`text-xs mb-1.5 ${isAI ? 'text-gray-500' : 'text-purple-700'}`}>
                        {isAI ? '🤖 AI 답변' : `👨‍💼 ${message.senderName || '상담사'}`}
                    </div>
                )}

                {message.text && (
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {message.text}
                    </p>
                )}

                {(message.pics?.length > 0 || message.attachments?.length > 0) && (
                    <div className="mt-2 space-y-1.5">
                        {[...(message.pics || []), ...(message.attachments || [])].map((file, idx) => {
                            const fileUrl = typeof file === 'string' ? file : (file?.url || '');
                            const fileName = typeof file === 'object' ? (file?.name || file?.type || '첨부파일') : '첨부파일';

                            if (!fileUrl) return null;

                            if (fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                                return (
                                    <a
                                        key={idx}
                                        href={fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block"
                                    >
                                        <img
                                            src={fileUrl}
                                            alt={fileName}
                                            className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                            loading="lazy"
                                        />
                                    </a>
                                );
                            }

                            return (
                                <a
                                    key={idx}
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center space-x-1.5 text-xs underline hover:no-underline transition-all ${isUser ? 'text-blue-100 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                                >
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    <span className="truncate">{fileName}</span>
                                </a>
                            );
                        })}
                    </div>
                )}

                {message.timestamp && (
                    <div className={`text-xs mt-1.5 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
                        {format(new Date(message.timestamp), 'a h:mm', { locale: ko })}
                    </div>
                )}
            </div>

            {message.private && (
                <div className="text-xs text-gray-400 mt-1 flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>비공개 메모</span>
                </div>
            )}
        </div>
    );
}