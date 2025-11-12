// components/ConversationDetail.jsx (patched)
// 
// ✅ 변경 요약
// - 전체 레이아웃/스타일은 그대로 유지
// - 하단 "요약" 영역을 제거하고, 그 위치에 "답변 작성" 컴포저(에디터) 삽입
// - 보정하기(모달) 버튼을 별도로 두되, 즉시 실행되지 않도록 모달에서 한 번 더 확인 후 요청
// - 가벼운 아키텍처: 포털은 UI + API 트리거만 담당(연산은 GCF/n8n에서 수행)
// - plan(플랜)별 제약 반영: starter=보정 불가, pro=기본 보정, business/enterprise=고급 옵션
// 
// 필요 API (Next.js API 라우트 예시)
//   POST /api/conversations/send      { tenantId, chatId, content }
//   POST /api/ai/correct              { tenantId, chatId, content, options }
//   GET  /api/conversations/detail    (기존 유지)

import { useState, useEffect, useRef, useMemo } from 'react';
import { X, ExternalLink, User, Bot, UserCheck, ZoomIn, Wand2, Send } from 'lucide-react';

export default function ConversationDetail({ conversation, onClose }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imagePreview, setImagePreview] = useState(null);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [openCorrection, setOpenCorrection] = useState(false);
    const [confirmSend, setConfirmSend] = useState(false); // 오작동 방지: 2단계 전송
    const messagesEndRef = useRef(null);

    // 플랜(기본값 business) — 상위에서 내려주면 사용, 없으면 detail→tenant→subscription에서 유추
    const plan = useMemo(() => {
        const p = conversation?.plan
            || detail?.tenant?.subscription?.plan
            || detail?.conversation?.plan
            || 'business';
        return String(p || 'business').toLowerCase();
    }, [conversation?.plan, detail?.tenant, detail?.conversation]);

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
            const res = await fetch(`/api/conversations/detail?tenant=${tenantId}&chatId=${conversation.chatId}`);
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

    const tenantId = useMemo(() => conversation.id?.split('_')[0] || 'default', [conversation.id]);

    // ─────────────────────────────────────────────
    // 전송 (회원에게 바로 발송)
    // ─────────────────────────────────────────────
    const sendNow = async () => {
        if (!draft.trim()) return;
        if (!confirmSend) {
            // 1차 클릭 → 확인 단계로 전환
            setConfirmSend(true);
            setTimeout(() => setConfirmSend(false), 3500); // 3.5초 안에 한 번 더 누르면 전송
            return;
        }

        setSending(true);
        try {
            const res = await fetch('/api/conversations/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId, chatId: conversation.chatId, content: draft })
            });
            if (!res.ok) throw new Error('send fail');
            setDraft('');
            setConfirmSend(false);
            // 최신 메시지 다시 가져오기
            await fetchDetail();
        } catch (e) {
            console.error(e);
            alert('전송 중 문제가 발생했습니다.');
        } finally {
            setSending(false);
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
                                <span className="text-white text-sm font-semibold">{conversation.userName?.charAt(0) || '?'}</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">{conversation.userName || '익명'}</h2>
                                <p className="text-xs text-gray-500">{conversation.channel || 'unknown'} • {conversation.chatId}</p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* 메시지 영역 - 전체 화면 활용 */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 bg-white">
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
                                                year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
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

                        {/* 통계 - 인라인 표시 */}
                        {detail?.stats && (
                            <div className="mt-4 mb-2 flex justify-center">
                                <div className="inline-flex gap-4 px-4 py-2 bg-gray-50 rounded-full text-xs">
                                    <div className="flex items-center gap-1">
                                        <User className="w-3 h-3 text-gray-500" />
                                        <span className="text-gray-700">{detail.stats.userChats}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Bot className="w-3 h-3 text-blue-500" />
                                        <span className="text-blue-600">{detail.stats.aiChats}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <UserCheck className="w-3 h-3 text-purple-500" />
                                        <span className="text-purple-600">{detail.stats.agentChats}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 답변 입력창 - 하단 고정 */}
                    <ReplyComposer
                        plan={plan}
                        value={draft}
                        onChange={setDraft}
                        onSend={sendNow}
                        sending={sending}
                        onOpenCorrection={() => setOpenCorrection(true)}
                    />
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
                    <img src={imagePreview} alt="미리보기" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
                </div>
            )}

            {/* 보정 모달 */}
            {openCorrection && (
                <CorrectionModal
                    plan={plan}
                    tenantId={tenantId}
                    chatId={conversation.chatId}
                    initialText={draft}
                    onClose={() => setOpenCorrection(false)}
                    onDone={() => {
                        // 보정 요청 후, 잠깐 기다렸다가 새로고침 유도(비동기 결과는 Firestore/GCF에서 반영)
                        setTimeout(fetchDetail, 1500);
                    }}
                />
            )}
        </>
    );
}

// ─────────────────────────────────────────────
// 하위 구성요소
// ─────────────────────────────────────────────
function Stat({ label, value, icon: Icon, valueClass }) {
    return (
        <div className="text-center">
            <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                <Icon className="w-3 h-3" /> {label}
            </div>
        </div>
    );
}

function ReplyComposer({ plan, value, onChange, onSend, sending, onOpenCorrection }) {
    const isStarter = plan === 'starter';

    return (
        <div className="absolute bottom-0 left-0 right-0 bg-white/98 backdrop-blur-xl border-t border-gray-200/50">
            <div className="px-2 py-2 flex items-end gap-1.5 max-w-4xl mx-auto">
                {/* Plus 버튼 (AI 보정 / 추가 기능) */}
                <button
                    type="button"
                    onClick={onOpenCorrection}
                    disabled={isStarter}
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                              transition-all duration-200 active:scale-90
                              ${isStarter
                            ? 'text-gray-300'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    aria-label="AI 보정 및 추가 기능"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                </button>

                {/* 입력 필드 컨테이너 */}
                <div className="flex-1 min-w-0">
                    <div className="relative">
                        <textarea
                            value={value}
                            onChange={(e) => {
                                onChange(e.target.value);
                                // 자동 높이 조절
                                e.target.style.height = '36px';
                                e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    onSend();
                                }
                            }}
                            placeholder="메시지"
                            className="w-full resize-none bg-gray-100 
                                     px-4 py-2 pr-12 text-[15px] leading-5
                                     border-0 focus:outline-none focus:ring-0
                                     placeholder-gray-500
                                     transition-all duration-200"
                            style={{
                                minHeight: '36px',
                                maxHeight: '120px',
                                borderRadius: value && value.split('\n').length > 1 ? '18px' : '18px',
                                overflowY: 'auto'
                            }}
                            rows={1}
                        />

                        {/* 전송 버튼 - 입력 필드 내부 오른쪽 */}
                        {value.trim() && (
                            <button
                                type="button"
                                onClick={onSend}
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

            {/* Safe Area 패딩 (iPhone 하단 영역) */}
            <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </div>
    );
}

function CorrectionModal({ plan, tenantId, chatId, initialText, onClose, onDone }) {
    const [text, setText] = useState(initialText || '');
    const [loading, setLoading] = useState(false);
    const isStarter = plan === 'starter';
    const isPro = plan === 'pro';

    // business/enterprise/trial 에서만 고급 옵션 노출
    const showAdvanced = !isStarter && !isPro;

    const [voice, setVoice] = useState('agent');
    const [contentType, setContentType] = useState('tone_correction');
    const [flags, setFlags] = useState({
        auto_contextual: false,
        expanded_text: false,
        concise_core: false,
        with_emojis: false,
        no_emojis: false,
        empathetic: false,
        playful_humor: false,
        firm: false,
        translate: false,
    });

    const toggleFlag = (k) => setFlags((p) => ({ ...p, [k]: !p[k] }));

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
                    options: showAdvanced
                        ? { voice, contentType, toneFlags: Object.keys(flags).filter((k) => flags[k]) }
                        : { voice: 'agent', contentType: 'tone_correction', toneFlags: [] },
                }),
            });
            if (!res.ok) throw new Error('request fail');
            onDone?.();
            onClose?.();
        } catch (e) {
            console.error(e);
            alert('보정 요청 중 문제가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div className="relative bg-white w-full max-w-2xl rounded-2xl border border-gray-200 shadow-xl">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="text-base font-semibold">AI 보정하기</h3>
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {isStarter ? (
                        <div className="text-sm text-gray-500">
                            Starter 플랜에서는 보정하기 기능을 사용할 수 없습니다.
                        </div>
                    ) : (
                        <>
                            <div className="text-[13px] text-gray-500">보정은 서버(n8n/GCF)에서 수행됩니다. 포털은 요청만 보내며 가볍게 유지됩니다.</div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">대상 메시지</label>
                                <textarea
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    className="w-full min-h-[120px] rounded-lg border border-gray-200 focus:border-gray-300 focus:ring-0 px-3 py-2 text-sm"
                                />
                            </div>

                            {showAdvanced ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">말투</label>
                                        <div className="flex items-center gap-2 text-sm">
                                            <label className={`px-3 py-1.5 rounded-lg border cursor-pointer ${voice === 'agent' ? 'border-gray-900' : 'border-gray-200'}`}>
                                                <input type="radio" name="voice" className="hidden" checked={voice === 'agent'} onChange={() => setVoice('agent')} />
                                                상담원 ver
                                            </label>
                                            <label className={`px-3 py-1.5 rounded-lg border cursor-pointer ${voice === 'chatbot' ? 'border-gray-900' : 'border-gray-200'}`}>
                                                <input type="radio" name="voice" className="hidden" checked={voice === 'chatbot'} onChange={() => setVoice('chatbot')} />
                                                챗봇 ver
                                            </label>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">보정 내용</label>
                                        <div className="flex items-center gap-2 text-sm">
                                            <label className={`px-3 py-1.5 rounded-lg border cursor-pointer ${contentType === 'tone_correction' ? 'border-gray-900' : 'border-gray-200'}`}>
                                                <input type="radio" name="ctype" className="hidden" checked={contentType === 'tone_correction'} onChange={() => setContentType('tone_correction')} />
                                                문장 다듬기
                                            </label>
                                            <label className={`px-3 py-1.5 rounded-lg border cursor-pointer ${contentType === 'policy_based' ? 'border-gray-900' : 'border-gray-200'}`}>
                                                <input type="radio" name="ctype" className="hidden" checked={contentType === 'policy_based'} onChange={() => setContentType('policy_based')} />
                                                규정/데이터 반영
                                            </label>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="text-sm font-medium text-gray-700">옵션</label>
                                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[13px]">
                                            {[
                                                ['auto_contextual', '알아서 자연스럽게'],
                                                ['expanded_text', '풍성하게'],
                                                ['concise_core', '담백하게'],
                                                ['with_emojis', '이모티콘 O'],
                                                ['no_emojis', '이모티콘 X'],
                                                ['empathetic', '공감 한 스푼'],
                                                ['playful_humor', '유머 한 스푼'],
                                                ['firm', '단호하게'],
                                                ['translate', '번역 포함'],
                                            ].map(([k, label]) => (
                                                <label key={k} className={`px-3 py-1.5 rounded-lg border cursor-pointer ${flags[k] ? 'border-gray-900' : 'border-gray-200'}`}>
                                                    <input type="checkbox" className="hidden" checked={!!flags[k]} onChange={() => toggleFlag(k)} />
                                                    {label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500">Pro 플랜: 기본 톤 보정으로 전송됩니다.</div>
                            )}
                        </>
                    )}
                </div>

                <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
                    <button className="h-9 px-3 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50" onClick={onClose}>취소</button>
                    <button
                        className={`h-9 px-3 rounded-lg text-sm font-medium flex items-center gap-1.5 ${isStarter ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-black'}`}
                        disabled={isStarter || loading || !text.trim()}
                        onClick={request}
                    >
                        <Wand2 className="w-4 h-4" /> {loading ? '요청 중...' : '보정 요청'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// 메시지 버블 (원본 구조 유지)
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
                                <div className="relative group cursor-pointer overflow-hidden rounded-lg" onClick={() => onImageClick(message.pics[0].url || message.pics[0])}>
                                    <img
                                        src={message.pics[0].url || message.pics[0]}
                                        alt="첨부 이미지"
                                        className="w-full h-auto max-h-80 object-contain rounded-lg"
                                        onError={(e) => { e.target.parentElement.innerHTML = `<div class='w-full h-32 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-sm'>이미지를 불러올 수 없습니다</div>`; }}
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
                                        <div key={idx} className="relative group cursor-pointer overflow-hidden rounded-lg aspect-square" onClick={() => onImageClick(pic.url || pic)}>
                                            <img
                                                src={pic.url || pic}
                                                alt={`첨부 ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                                onError={(e) => { e.target.parentElement.innerHTML = `<div class='w-full h-full bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs'>오류</div>`; }}
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