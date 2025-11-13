// components/ConversationDetail.jsx
// 애플 스타일 대화 상세 모달 - 클라이언트 중심 최적화 (tenantId 우선 사용)

import { useState, useEffect, useRef } from 'react';
import { X, User, Bot, UserCheck, ZoomIn, Paperclip, Send, Sparkles } from 'lucide-react';
import AIComposerModal from './AIComposerModal';

export default function ConversationDetail({ conversation, onClose, onSend, onOpenAICorrector, tenantId, planName = 'trial' }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imagePreview, setImagePreview] = useState(null);
    const [showAIComposer, setShowAIComposer] = useState(false); // ✅ AI 보정 모달 상태
    const messagesEndRef = useRef(null);

    // 입력바 상태
    const [draft, setDraft] = useState('');
    const [attachments, setAttachments] = useState([]); // { file, url, name, type }
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const filePickerRef = useRef(null);
    const textareaRef = useRef(null);

    // ✅ tenantId를 상위에서 추출 (먼저 정의)
    const effectiveTenantId =
        tenantId ||
        conversation?.tenant ||
        conversation?.tenantId ||
        (typeof conversation?.id === 'string' && conversation.id.includes('_')
            ? conversation.id.split('_')[0]
            : null) ||
        'default';

    // ✅ chatId 안전하게 추출
    const chatId = conversation?.chatId || conversation?.id || '';

    // ✅ 로컬 스토리지 키 (effectiveTenantId와 chatId 사용)
    const draftKey = chatId ? `draft_${effectiveTenantId}_${chatId}` : null;

    // ✅ 컴포넌트 마운트 시 저장된 draft 복원
    useEffect(() => {
        if (!draftKey) return;
        try {
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
                setDraft(savedDraft);
                console.log('[ConversationDetail] Restored draft from localStorage');
            }
        } catch (e) {
            console.error('[ConversationDetail] Failed to restore draft:', e);
        }
    }, [draftKey]);

    // ✅ draft 변경 시 로컬 스토리지에 저장
    useEffect(() => {
        if (!draftKey) return;
        try {
            if (draft.trim()) {
                localStorage.setItem(draftKey, draft);
            } else {
                localStorage.removeItem(draftKey);
            }
        } catch (e) {
            console.error('[ConversationDetail] Failed to save draft:', e);
        }
    }, [draft, draftKey]);

    // ✅ AI 보정 모달
    const [showAICorrector, setShowAICorrector] = useState(false);

    useEffect(() => {
        if (!chatId) {
            console.error('[ConversationDetail] No chatId available');
            setLoading(false);
            return;
        }
        fetchDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatId, effectiveTenantId]);

    useEffect(() => {
        if (detail?.messages && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [detail?.messages]);

    const fetchDetail = async () => {
        if (!chatId) {
            console.error('[ConversationDetail] Cannot fetch detail: chatId is missing');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/conversations/detail?tenant=${effectiveTenantId}&chatId=${chatId}`);
            if (!res.ok) {
                throw new Error(`Failed to fetch: ${res.status}`);
            }
            const data = await res.json();
            setDetail(data);
        } catch (error) {
            console.error('[ConversationDetail] Failed to fetch detail:', error);
            setDetail(null);
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

    const handleFiles = async (files) => {
        const arr = Array.from(files || []);
        if (arr.length === 0) return;

        // ✅ 파일 크기 검증 (15MB 제한 - base64 인코딩 후 약 20MB)
        const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
        const oversizedFiles = arr.filter(file => file.size > MAX_FILE_SIZE);

        if (oversizedFiles.length > 0) {
            const fileNames = oversizedFiles.map(f => f.name).join(', ');
            alert(`다음 파일이 너무 큽니다 (최대 15MB):\n${fileNames}\n\n더 작은 파일로 다시 시도해주세요.`);
            return;
        }

        setUploading(true);
        try {
            // 파일을 base64로 변환하거나 미리보기 URL 생성
            const newAttachments = await Promise.all(
                arr.map(async (file) => {
                    // 이미지 파일만 미리보기 지원
                    const isImage = file.type.startsWith('image/');
                    const preview = isImage ? URL.createObjectURL(file) : null;

                    // 파일을 base64로 변환 (실제 전송용)
                    const base64 = await fileToBase64(file);

                    return {
                        file,
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        preview,
                        base64,
                    };
                })
            );

            setAttachments((prev) => [...prev, ...newAttachments].slice(0, 10));
        } catch (error) {
            console.error('Failed to process files:', error);
            alert('파일 처리에 실패했습니다.');
        } finally {
            setUploading(false);
        }
    };

    // 파일을 base64로 변환하는 헬퍼 함수
    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1]; // "data:image/png;base64," 부분 제거
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const autoResize = (el) => {
        if (!el) return;
        el.style.height = 'auto';
        const newHeight = Math.min(el.scrollHeight, 120);
        el.style.height = newHeight + 'px';
    };

    const handleSend = async () => {
        if (sending || uploading) return;

        const text = (draft || '').trim();
        const hasText = text.length > 0;
        const hasAttachments = attachments.length > 0;

        // 텍스트 또는 첨부파일이 있어야 함
        if (!hasText && !hasAttachments) return;

        setSending(true);

        console.log('[ConversationDetail] Sending:', {
            hasText,
            textLength: text.length,
            attachmentsCount: attachments.length,
            tenantId: effectiveTenantId,
            chatId: chatId,
        });

        // ✅ 전송 전 내용 저장 (에러 시 복원용)
        const savedDraft = draft;
        const savedAttachments = [...attachments];

        try {
            // ✅ tenantId와 첨부파일 정보를 포함하여 전달
            await onSend?.({
                text: text || '', // ✅ 빈 문자열도 명시적으로 전달
                attachments: attachments.map(att => ({
                    name: att.name,
                    type: att.type,
                    size: att.size,
                    base64: att.base64,
                })),
                tenantId: effectiveTenantId,
                chatId: chatId,
            });

            // ✅ 전송 성공 후에만 입력창 비우기
            setDraft('');
            setAttachments([]);

            // ✅ 로컬 스토리지에서도 삭제
            try {
                localStorage.removeItem(draftKey);
            } catch (e) {
                console.error('[ConversationDetail] Failed to clear draft:', e);
            }

            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
            await fetchDetail(); // 전송 후 최신 메시지 불러오기
        } catch (error) {
            console.error('[ConversationDetail] Send failed:', error);
            // ✅ 에러 시 입력 내용 복원
            setDraft(savedDraft);
            setAttachments(savedAttachments);
            alert('메시지 전송에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setSending(false);
        }
    };

    const onKeyDown = (e) => {
        // ✅ 모바일/작은 화면에서는 Enter를 줄바꿈으로, 데스크톱에서는 전송으로
        // 768px 미만을 모바일로 간주 (Tailwind의 md 브레이크포인트)
        const isMobile = window.innerWidth < 768;

        if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
            // 데스크톱: Shift 없는 Enter는 전송
            e.preventDefault();
            handleSend();
        }
        // 모바일: Enter는 줄바꿈 (기본 동작)
        // 데스크톱: Shift+Enter는 줄바꿈 (기본 동작)
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

    const removeAttachment = (index) => {
        setAttachments(prev => {
            const newAttachments = prev.filter((_, i) => i !== index);
            // 미리보기 URL 해제
            const removed = prev[index];
            if (removed.preview) {
                URL.revokeObjectURL(removed.preview);
            }
            return newAttachments;
        });
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
                                    {conversation.channel || 'unknown'} • {chatId || 'N/A'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* ✅ AI 보정 버튼 */}
                            {(planName === 'pro' || planName === 'business') && (
                                <button
                                    onClick={() => setShowAIComposer(true)}
                                    className="px-3 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all flex items-center gap-2 text-sm font-medium"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    AI 보정
                                </button>
                            )}

                            <button
                                onClick={onClose}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
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
                    <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-white rounded-b-2xl">
                        {/* ✅ 요약 정보 - 입력창 위로 이동 + 스타일 개선 */}
                        {detail?.conversation?.summary && (
                            <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                <div className="text-sm text-blue-900">
                                    <span className="font-semibold">💡 요약:</span> {detail.conversation.summary}
                                </div>
                            </div>
                        )}

                        {/* 첨부 파일 미리보기 */}
                        {attachments.length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-2">
                                {attachments.map((att, idx) => (
                                    <div key={idx} className="relative group">
                                        {att.preview ? (
                                            // 이미지 미리보기
                                            <>
                                                <img
                                                    src={att.preview}
                                                    alt={att.name}
                                                    className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                                                />
                                                <button
                                                    onClick={() => removeAttachment(idx)}
                                                    disabled={sending || uploading}
                                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-100 md:opacity-90 md:group-hover:opacity-100 transition-opacity shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                                    aria-label="첨부파일 삭제"
                                                >
                                                    ×
                                                </button>
                                            </>
                                        ) : (
                                            // 일반 파일 (PDF 등)
                                            <div className="relative">
                                                <div className="w-20 h-20 bg-gray-100 rounded-lg border border-gray-200 flex flex-col items-center justify-center p-2">
                                                    <Paperclip className="w-6 h-6 text-gray-400 mb-1" />
                                                    <span className="text-xs text-gray-600 truncate w-full text-center">
                                                        {att.name.slice(0, 8)}...
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {formatFileSize(att.size)}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => removeAttachment(idx)}
                                                    disabled={sending || uploading}
                                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-100 md:opacity-90 md:group-hover:opacity-100 transition-opacity shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                                    aria-label="첨부파일 삭제"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 업로드 중 표시 */}
                        {uploading && (
                            <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-200 border-t-blue-600" />
                                <span className="text-sm text-blue-900">파일 처리 중...</span>
                            </div>
                        )}

                        {/* 입력바 */}
                        <div className="flex items-end gap-2">
                            <button
                                onClick={() => filePickerRef.current?.click()}
                                disabled={sending || uploading}
                                className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="첨부"
                            >
                                <Paperclip className="w-4 h-4 text-gray-600" />
                            </button>

                            {/* ✅ AI 보정 버튼 - AIComposerModal 연결 */}
                            <button
                                onClick={() => setShowAIComposer(true)}
                                disabled={sending || uploading}
                                className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 active:scale-95 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                aria-label="AI 보정"
                                title="AI 톤 보정"
                            >
                                <Sparkles className="w-4 h-4 text-purple-600 group-hover:text-purple-700" />
                            </button>

                            <textarea
                                ref={textareaRef}
                                value={sending ? '전송 중...' : draft}
                                onChange={(e) => {
                                    if (!sending && !uploading) {
                                        setDraft(e.target.value);
                                        autoResize(e.target);
                                    }
                                }}
                                onKeyDown={onKeyDown}
                                onPaste={onPaste}
                                placeholder={sending ? '전송 중...' : uploading ? '파일 처리 중...' : '메시지 입력...'}
                                disabled={sending || uploading}
                                enterKeyHint="send"
                                className="flex-1 resize-none bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50 disabled:cursor-wait max-h-[120px]"
                                rows={1}
                            />

                            <button
                                onClick={handleSend}
                                disabled={!canSend || sending || uploading}
                                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${canSend && !sending && !uploading
                                    ? 'bg-blue-500 hover:bg-blue-600 active:scale-95 text-white shadow-sm'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                                aria-label="전송"
                            >
                                {sending ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
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

            {/* ✅ AI Composer 모달 */}
            {showAIComposer && (
                <AIComposerModal
                    conversation={conversation}
                    tenantId={effectiveTenantId}
                    planName={planName}
                    onClose={() => setShowAIComposer(false)}
                    onSend={onSend}
                />
            )}

            {/* ✅ AI 보정 모달 */}
            {showAICorrector && (
                <AICorrector
                    conversation={conversation}
                    tenantId={effectiveTenantId}
                    onClose={() => setShowAICorrector(false)}
                    onSend={async (data) => {
                        // AI 보정된 메시지 전송
                        await onSend?.(data);
                        setShowAICorrector(false);
                    }}
                />
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

                {/* ✅ 텍스트가 없고 이미지만 있을 때는 말풍선 스타일 다르게 적용 */}
                {!message.text && message.pics && message.pics.length > 0 ? (
                    // 이미지만 있을 때: 말풍선 없이 이미지만 표시
                    <div className="space-y-2">
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
                ) : (
                    // 텍스트가 있거나 텍스트와 이미지가 함께 있을 때: 기존 말풍선 스타일
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
                )}

                {/* ⬇️ 시간 정렬도 스왑: user=좌, ai/agent=우 */}
                <div className={`text-xs text-gray-400 mt-1 px-1 ${isUser ? "text-left" : "text-right"}`}>
                    {fmtTime(message.timestamp)}
                </div>
            </div>
        </div>
    );
}