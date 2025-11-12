// components/ConversationDetail.jsx
// 애플 스타일 대화 상세 모달 - 클라이언트 중심 최적화 (tenantId 우선 사용)

import { useState, useEffect, useRef } from 'react';
import { X, User, Bot, UserCheck, ZoomIn, Paperclip, Send, Sparkles } from 'lucide-react';

export default function ConversationDetail({ conversation, onClose, onSend, onOpenAICorrector, tenantId }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imagePreview, setImagePreview] = useState(null);
    const messagesEndRef = useRef(null);

    // 입력바 상태
    const [draft, setDraft] = useState('');
    const [attachments, setAttachments] = useState([]); // { file, url }
    const [sending, setSending] = useState(false);
    const filePickerRef = useRef(null);
    const textareaRef = useRef(null);

    // ✅ tenantId를 상위에서 추출
    const effectiveTenantId =
        tenantId ||
        conversation?.tenant ||
        conversation?.tenantId ||
        (typeof conversation?.id === 'string' && conversation.id.includes('_')
            ? conversation.id.split('_')[0]
            : null) ||
        'default';

    useEffect(() => {
        fetchDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversation?.chatId, effectiveTenantId]);

    useEffect(() => {
        if (detail?.messages && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [detail?.messages]);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/conversations/detail?tenant=${effectiveTenantId}&chatId=${conversation.chatId}`);
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
                if (imagePreview) setImagePreview(null);
                else onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose, imagePreview]);

    const canSend = draft.trim().length > 0 || attachments.length > 0;

    const handleFiles = (files) => {
        const arr = Array.from(files || []);
        const next = arr.map((file) => ({ file, url: URL.createObjectURL(file) }));
        setAttachments((prev) => [...prev, ...next].slice(0, 10));
    };

    const autoResize = (el) => {
        if (!el) return;
        el.style.height = 'auto';
        const newHeight = Math.min(el.scrollHeight, 120);
        el.style.height = newHeight + 'px';
    };

    const handleSend = async () => {
        if (sending) return;
        const text = (draft || '').trim();
        if (!text && attachments.length === 0) return;
        setSending(true);
        try {
            // ✅ tenantId를 포함하여 전달
            await onSend?.({
                text,
                attachments,
                tenantId: effectiveTenantId,
                chatId: conversation.chatId
            });
            setDraft('');
            setAttachments([]);
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
            await fetchDetail(); // 전송 후 최신 메시지 불러오기
        } catch (error) {
            console.error('[ConversationDetail] Send failed:', error);
            alert('메시지 전송에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setSending(false);
        }
    };

    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const onPaste = (e) => {
        const items = e.clipboardData?.items || [];
        const files = [];
        for (const it of items) {
            if (it.kind === 'file') {
                const f = it.getAsFile();
                if (f) files.push(f);
            }
        }
        if (files.length) {
            e.preventDefault();
            handleFiles(files);
        }
    };

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
                                <h2 className="text-lg font-semibold text-gray-900">{conversation.userName || '익명'}</h2>
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
                                {detail.messages[0]?.timestamp && (
                                    <div className="flex items-center justify-center my-4">
                                        <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                                            {new Date(detail.messages[0].timestamp).toLocaleDateString('ko-KR', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                weekday: 'long',
                                            })}
                                        </div>
                                    </div>
                                )}

                                {detail.messages.map((msg, idx) => (
                                    <MessageBubble key={idx} message={msg} onImageClick={(url) => setImagePreview(url)} />
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

                    {/* 입력 영역 */}
                    <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-white">
                        {/* 첨부 이미지 */}
                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {attachments.map((att, idx) => (
                                    <div key={idx} className="relative group">
                                        <img
                                            src={att.url}
                                            alt={`첨부 ${idx + 1}`}
                                            className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                                        />
                                        <button
                                            onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 입력바 */}
                        <div className="flex items-end gap-2">
                            <button
                                onClick={() => filePickerRef.current?.click()}
                                disabled={sending}
                                className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="첨부"
                            >
                                <Paperclip className="w-4 h-4 text-gray-600" />
                            </button>

                            <textarea
                                ref={textareaRef}
                                value={draft}
                                onChange={(e) => {
                                    setDraft(e.target.value);
                                    autoResize(e.target);
                                }}
                                onKeyDown={onKeyDown}
                                onPaste={onPaste}
                                placeholder="메시지 입력..."
                                disabled={sending}
                                className="flex-1 resize-none bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50 max-h-[120px]"
                                rows={1}
                            />

                            <button
                                onClick={handleSend}
                                disabled={!canSend || sending}
                                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${canSend && !sending
                                    ? 'bg-blue-500 hover:bg-blue-600 active:scale-95 text-white shadow-sm'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                                aria-label="전송"
                            >
                                <Send className="w-4 h-4" />
                            </button>

                            <input
                                ref={filePickerRef}
                                type="file"
                                accept="image/*,video/*,application/pdf"
                                multiple
                                className="hidden"
                                onChange={(e) => handleFiles(e.target.files)}
                            />
                        </div>

                        {/* 하단 정보 */}
                        <div className="mt-3">
                            {detail?.conversation?.summary && (
                                <div className="bg-transparent text-sm text-gray-700">
                                    <span className="font-semibold">요약</span> {detail.conversation.summary}
                                </div>
                            )}
                        </div>
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

function StatBlock({ label, value, Icon, valueClass = '' }) {
    return (
        <div className="text-center">
            <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                <Icon className="w-3 h-3" />
                {label}
            </div>
        </div>
    );
}

// 메시지 버블 (user / ai / agent)
function MessageBubble({ message, onImageClick }) {
    const isUser =
        message.sender === "user";
    const isAgent =
        message.sender === "admin" ||
        message.sender === "agent" ||
        (message.sender === "ai" && message.modeSnapshot === "AGENT");

    // 🔁 정렬만 스왑: user=좌측, ai/agent=우측
    const senderCfg = {
        user: {
            name: "사용자",
            icon: User,
            align: "flex-row",              // ← 좌측
            bubbleBg: "bg-blue-600 text-white",
            bubbleAlign: "mr-auto",         // ← 좌측
            iconBg: "bg-gray-300",
            iconColor: "text-gray-700",
        },
        ai: {
            name: "AI",
            icon: Bot,
            align: "flex-row-reverse",      // → 우측
            bubbleBg: "bg-gray-200 text-gray-900",
            bubbleAlign: "ml-auto",         // → 우측
            iconBg: "bg-blue-500",
            iconColor: "text-white",
        },
        agent: {
            name: "상담원",
            icon: UserCheck,
            align: "flex-row-reverse",      // → 우측
            bubbleBg: "bg-purple-100 text-purple-900",
            bubbleAlign: "ml-auto",         // → 우측
            iconBg: "bg-purple-500",
            iconColor: "text-white",
        },
    }[isUser ? "user" : isAgent ? "agent" : "ai"];

    const Icon = senderCfg.icon;

    const fmtTime = (ts) =>
        ts
            ? new Date(ts).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
            : "";

    return (
        <div className={`flex items-end gap-2 ${senderCfg.align}`}>
            {/* 아이콘은 기존 로직 유지: user는 아이콘 숨김 */}
            {!isUser && (
                <div className={`flex-shrink-0 w-7 h-7 rounded-full ${senderCfg.iconBg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${senderCfg.iconColor}`} />
                </div>
            )}

            <div className={`max-w-[80%] ${senderCfg.bubbleAlign}`}>
                {!isUser && <div className="text-xs text-gray-500 mb-1 px-1">{senderCfg.name}</div>}

                <div className={`rounded-2xl px-4 py-2.5 ${senderCfg.bubbleBg}`}>
                    {message.text && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
                    )}

                    {message.pics && message.pics.length > 0 && (
                        <div className={`${message.text ? "mt-2" : ""} space-y-2`}>
                            {message.pics.length === 1 ? (
                                <div
                                    className="relative group cursor-pointer overflow-hidden rounded-lg"
                                    onClick={() => onImageClick?.(message.pics[0].url || message.pics[0])}
                                >
                                    <img
                                        src={message.pics[0].url || message.pics[0]}
                                        alt="첨부 이미지"
                                        className="w-full h-auto max-h-80 object-contain rounded-lg"
                                        onError={(e) => {
                                            e.target.parentElement.innerHTML =
                                                '<div class="w-full h-32 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-sm">이미지를 불러올 수 없습니다</div>';
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {message.pics.map((pic, idx) => (
                                        <div
                                            key={idx}
                                            className="relative group cursor-pointer overflow-hidden rounded-lg aspect-square"
                                            onClick={() => onImageClick?.(pic.url || pic)}
                                        >
                                            <img
                                                src={pic.url || pic}
                                                alt={`첨부 ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.target.parentElement.innerHTML =
                                                        '<div class="w-full h-full bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">오류</div>';
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ⬇️ 시간 정렬도 스왑: user=좌, ai/agent=우 */}
                <div className={`text-xs text-gray-400 mt-1 px-1 ${isUser ? "text-left" : "text-right"}`}>
                    {fmtTime(message.timestamp)}
                </div>
            </div>
        </div>
    );
}