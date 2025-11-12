// components/ConversationDetail.jsx
// 정상 작동 로직 + 아이폰 메시지 스타일 UI
import { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, User, Bot, UserCheck, ZoomIn, Wand2, Send } from 'lucide-react';

export default function ConversationDetail({ conversation, detailData, onClose, onRefresh }) {
    const [imagePreview, setImagePreview] = useState(null);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [openCorrection, setOpenCorrection] = useState(false);
    const messagesEndRef = useRef(null);

    // 플랜 정보 (detailData에서 가져오기)
    const plan = detailData?.tenant?.plan || 'business';

    // 메시지 스크롤
    useEffect(() => {
        if (detailData?.messages && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [detailData?.messages]);

    // ESC 키 처리
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                if (imagePreview) {
                    setImagePreview(null);
                } else if (openCorrection) {
                    setOpenCorrection(false);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose, imagePreview, openCorrection]);

    const sendMessage = async () => {
        if (!draft.trim() || sending) return;

        setSending(true);
        try {
            const tenantId = conversation.id?.split('_')[0];
            const res = await fetch('/api/conversations/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId,
                    chatId: conversation.chatId,
                    content: draft
                })
            });

            if (!res.ok) throw new Error('Send failed');

            setDraft('');
            // 부모 컴포넌트에 새로고침 요청
            if (onRefresh) onRefresh(conversation);

        } catch (err) {
            console.error('Send error:', err);
            alert('전송 실패');
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl">
                    {/* 헤더 */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                                <span className="text-white text-sm font-semibold">
                                    {conversation.userNameInitial || conversation.userName?.charAt(0) || '?'}
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

                        <div className="flex items-center gap-2">
                            {detailData?.slack?.slackUrl && (
                                <a
                                    href={detailData.slack.slackUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    <ExternalLink className="w-5 h-5" />
                                </a>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* 메시지 영역 - 전체 화면 활용, 하단 입력창 공간 확보 */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 bg-white relative">
                        {detailData?.messages && detailData.messages.length > 0 ? (
                            <div className="space-y-3">
                                {/* 날짜 표시 */}
                                {detailData.messages[0]?.timestamp && (
                                    <div className="flex items-center justify-center my-4">
                                        <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                                            {new Date(detailData.messages[0].timestamp).toLocaleDateString('ko-KR', {
                                                year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
                                            })}
                                        </div>
                                    </div>
                                )}

                                {detailData.messages.map((msg, idx) => (
                                    <MessageBubble
                                        key={idx}
                                        message={msg}
                                        onImageClick={setImagePreview}
                                    />
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        ) : (
                            <div className="text-center py-20">
                                <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">메시지가 없습니다</p>
                            </div>
                        )}

                        {/* 통계 - 메시지 영역 하단에 작게 표시 */}
                        {detailData?.stats && (
                            <div className="mt-4 mb-2 flex justify-center">
                                <div className="inline-flex gap-4 px-4 py-2 bg-gray-50 rounded-full text-xs">
                                    <div className="flex items-center gap-1">
                                        <User className="w-3 h-3 text-gray-500" />
                                        <span className="text-gray-700">{detailData.stats.userChats}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Bot className="w-3 h-3 text-blue-500" />
                                        <span className="text-blue-600">{detailData.stats.aiChats}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <UserCheck className="w-3 h-3 text-purple-500" />
                                        <span className="text-purple-600">{detailData.stats.agentChats}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 답변 입력창 - 아이폰 스타일 하단 고정 */}
                    <div className="absolute bottom-0 left-0 right-0 bg-white/98 backdrop-blur-xl border-t border-gray-200/50">
                        <div className="px-2 py-2 flex items-end gap-1.5 max-w-4xl mx-auto">
                            {/* Plus 버튼 (AI 보정) */}
                            <button
                                type="button"
                                onClick={() => setOpenCorrection(true)}
                                disabled={plan === 'starter'}
                                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                                          transition-all duration-200 active:scale-90
                                          ${plan === 'starter'
                                        ? 'text-gray-300'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                aria-label="AI 보정"
                            >
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="16" />
                                    <line x1="8" y1="12" x2="16" y2="12" />
                                </svg>
                            </button>

                            {/* 입력 필드 */}
                            <div className="flex-1 min-w-0">
                                <div className="relative">
                                    <textarea
                                        value={draft}
                                        onChange={(e) => {
                                            setDraft(e.target.value);
                                            e.target.style.height = '36px';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                sendMessage();
                                            }
                                        }}
                                        placeholder="메시지"
                                        className="w-full resize-none bg-gray-100 
                                                 px-4 py-2 pr-12 text-[15px] leading-5
                                                 border-0 focus:outline-none focus:ring-0
                                                 placeholder-gray-500 rounded-[18px]
                                                 transition-all duration-200"
                                        style={{
                                            minHeight: '36px',
                                            maxHeight: '120px',
                                            overflowY: 'auto'
                                        }}
                                        rows={1}
                                    />

                                    {/* 전송 버튼 - 텍스트 있을 때만 표시 */}
                                    {draft.trim() && (
                                        <button
                                            type="button"
                                            onClick={sendMessage}
                                            disabled={sending}
                                            className={`absolute right-1.5 bottom-1.5 w-7 h-7 rounded-full
                                                      flex items-center justify-center transition-all duration-200
                                                      ${sending
                                                    ? 'bg-gray-400'
                                                    : 'bg-blue-500 hover:bg-blue-600 active:scale-90'
                                                } text-white shadow-sm`}
                                        >
                                            {sending ? (
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Safe Area 패딩 */}
                        <div className="h-[env(safe-area-inset-bottom,0px)]" />
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
                        className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg"
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

            {/* AI 보정 모달 */}
            {openCorrection && (
                <CorrectionModal
                    plan={plan}
                    tenantId={conversation.id?.split('_')[0]}
                    chatId={conversation.chatId}
                    initialText={draft}
                    onClose={() => setOpenCorrection(false)}
                    onDone={(corrected) => {
                        setDraft(corrected);
                        setOpenCorrection(false);
                    }}
                />
            )}
        </>
    );
}

// 메시지 버블 - CS 관점 (회원 문의 왼쪽, AI/상담원 답변 오른쪽)
function MessageBubble({ message, onImageClick }) {
    const isUser = message.sender === 'user';
    const isAgent = message.sender === 'admin' || message.sender === 'agent' || (message.sender === 'ai' && message.modeSnapshot === 'AGENT');
    const isAI = message.sender === 'ai' && !isAgent;

    const senderConfig = {
        user: {
            name: '회원',
            icon: User,
            align: 'flex-row',
            bubbleBg: 'bg-blue-500 text-white',
            bubbleAlign: 'mr-auto',
            iconBg: 'bg-gray-300',
            iconColor: 'text-gray-700'
        },
        ai: {
            name: 'AI',
            icon: Bot,
            align: 'flex-row-reverse',
            bubbleBg: 'bg-gray-200 text-gray-900',
            bubbleAlign: 'ml-auto',
            iconBg: 'bg-blue-500',
            iconColor: 'text-white'
        },
        agent: {
            name: '상담원',
            icon: UserCheck,
            align: 'flex-row-reverse',
            bubbleBg: 'bg-purple-100 text-purple-900',
            bubbleAlign: 'ml-auto',
            iconBg: 'bg-purple-500',
            iconColor: 'text-white'
        },
    }[isUser ? 'user' : isAgent ? 'agent' : 'ai'];

    const Icon = senderConfig.icon;

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className={`flex items-end gap-2 ${senderConfig.align} mb-1`}>
            {isUser && (
                <div className={`flex-shrink-0 w-6 h-6 rounded-full ${senderConfig.iconBg} flex items-center justify-center mb-1`}>
                    <Icon className={`w-3.5 h-3.5 ${senderConfig.iconColor}`} />
                </div>
            )}

            <div className={`max-w-[70%] ${senderConfig.bubbleAlign}`}>
                {isUser && <div className="text-[10px] text-gray-500 mb-1 px-2">{senderConfig.name}</div>}

                <div className={`rounded-2xl px-3 py-2 ${senderConfig.bubbleBg} ${!isUser ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
                    {message.text && (
                        <p className="text-[14px] leading-[1.4] whitespace-pre-wrap break-words">{message.text}</p>
                    )}

                    {message.pics && message.pics.length > 0 && (
                        <div className={`${message.text ? 'mt-2' : ''} space-y-2`}>
                            {message.pics.length === 1 ? (
                                <div
                                    className="relative group cursor-pointer overflow-hidden rounded-lg"
                                    onClick={() => onImageClick(message.pics[0].url || message.pics[0])}
                                >
                                    <img
                                        src={message.pics[0].url || message.pics[0]}
                                        alt="첨부 이미지"
                                        className="w-full h-auto max-h-80 object-contain rounded-lg"
                                        onError={(e) => {
                                            e.target.parentElement.innerHTML = `<div class='w-full h-32 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-sm'>이미지를 불러올 수 없습니다</div>`;
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
                                            <ZoomIn className="w-5 h-5 text-gray-900" />
                                        </div>
                                    </div>
                                </div>
                            ) : (
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
                                                    e.target.parentElement.innerHTML = `<div class='w-full h-full bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs'>오류</div>`;
                                                }}
                                            />
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

                <div className={`text-[10px] text-gray-400 mt-0.5 px-1 ${!isUser ? 'text-right' : 'text-left'}`}>{formatTime(message.timestamp)}</div>
            </div>
        </div>
    );
}

// AI 보정 모달 (간단 버전)
function CorrectionModal({ plan, tenantId, chatId, initialText, onClose, onDone }) {
    const [text, setText] = useState(initialText || '');
    const [loading, setLoading] = useState(false);

    const request = async () => {
        if (!text.trim()) return;
        setLoading(true);
        try {
            const res = await fetch('/api/ai/correct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId,
                    chatId,
                    content: text,
                    options: { voice: 'agent', contentType: 'tone_correction', toneFlags: [] }
                }),
            });
            if (!res.ok) throw new Error('request fail');
            const data = await res.json();
            onDone(data.corrected || text);
        } catch (err) {
            alert('보정 요청 실패');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[55]">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">AI 보정</h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <textarea
                    className="w-full h-32 px-3 py-2 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="보정할 메시지..."
                />

                <div className="mt-4 flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                        취소
                    </button>
                    <button
                        onClick={request}
                        disabled={loading || !text.trim()}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50 flex items-center gap-2"
                    >
                        <Wand2 className="w-4 h-4" />
                        {loading ? '보정 중...' : '보정'}
                    </button>
                </div>
            </div>
        </div>
    );
}