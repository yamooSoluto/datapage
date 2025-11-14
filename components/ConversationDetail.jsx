// components/ConversationDetail.jsx
// 애플 스타일 대화 상세 모달 - 클라이언트 중심 최적화 (tenantId 우선 사용)

import { useState, useEffect, useRef } from 'react';
import { X, User, Bot, UserCheck, ZoomIn, Paperclip, Send, Sparkles } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebaseClient';
import AIComposerModal from './AIComposerModal';

export default function ConversationDetail({ conversation, onClose, onSend, onOpenAICorrector, tenantId, planName = 'trial', isEmbedded = false }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const initialLoadedRef = useRef(false); // ✅ 초기 로딩 완료 플래그 (클로저 문제 방지)
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

    // 초기 로딩은 onSnapshot useEffect에서 처리

    useEffect(() => {
        if (detail?.messages && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [detail?.messages]);

    // ✅ 키보드 열릴 때 스크롤 조정 및 전체 스크롤 방지
    useEffect(() => {
        const handleFocus = (e) => {
            // 전체 페이지 스크롤 방지
            e.preventDefault?.();

            // 키보드가 열리면 메시지 영역을 조금 위로 스크롤
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
        };

        const handleBlur = () => {
            // 포커스 해제 시에도 스크롤 방지 유지
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        };

        const textarea = textareaRef.current;
        textarea?.addEventListener('focus', handleFocus);
        textarea?.addEventListener('blur', handleBlur);

        return () => {
            textarea?.removeEventListener('focus', handleFocus);
            textarea?.removeEventListener('blur', handleBlur);
        };
    }, []);

    // ✅ Firestore 실시간 리스너: 모달이 열려 있는 동안 새 메시지 자동 감지
    useEffect(() => {
        if (!chatId || !effectiveTenantId) {
            setLoading(false);
            initialLoadedRef.current = false;
            return;
        }

        const docId = `${effectiveTenantId}_${chatId}`;
        const docRef = doc(db, 'FAQ_realtime_cw', docId);

        console.log('[ConversationDetail] Setting up Firestore listener for:', docId);

        // 초기 로딩 시작 (chatId가 변경되면 초기화)
        setLoading(true);
        initialLoadedRef.current = false;

        // 실시간 리스너 등록 (초기 데이터도 자동으로 받아옴)
        const unsubscribe = onSnapshot(
            docRef,
            (snapshot) => {
                if (!snapshot.exists()) {
                    console.warn('[ConversationDetail] Document does not exist:', docId);
                    // 초기 로딩일 때만 로딩 상태 변경
                    if (!initialLoadedRef.current) {
                        setLoading(false);
                        initialLoadedRef.current = true;
                    }
                    setDetail(null);
                    return;
                }

                const data = snapshot.data();

                // messages 배열 추출 및 변환
                const messages = Array.isArray(data.messages)
                    ? data.messages.map(m => ({
                        sender: m.sender,
                        text: m.text || '',
                        pics: Array.isArray(m.pics) ? m.pics : [],
                        timestamp: m.timestamp?.toDate?.()?.toISOString() || m.timestamp || new Date().toISOString(),
                        msgId: m.msgId || null,
                        modeSnapshot: m.modeSnapshot || null,
                    }))
                    : [];

                // conversation 정보 업데이트
                setDetail({
                    conversation: {
                        id: snapshot.id,
                        chatId: data.chat_id || chatId,
                        userId: data.user_id,
                        userName: data.user_name || '익명',
                        brandName: data.brandName || null,
                        channel: data.channel || 'unknown',
                        status: data.status || 'waiting',
                        modeSnapshot: data.modeSnapshot || 'AUTO',
                        lastMessageAt: data.lastMessageAt?.toDate?.()?.toISOString() || data.lastMessageAt,
                        cwConversationId: data.cw_conversation_id || null,
                        summary: typeof data.summary === 'string' && data.summary.trim() ? data.summary.trim() : null,
                        category: data.category || null,
                        categories: data.category ? data.category.split('|').map(c => c.trim()) : [],
                    },
                    messages,
                });

                // ✅ 초기 로딩일 때만 로딩 상태 변경 (이후 업데이트는 조용히)
                const isInitialLoad = !initialLoadedRef.current;
                if (isInitialLoad) {
                    setLoading(false);
                    initialLoadedRef.current = true;
                }

                console.log('[ConversationDetail] Firestore update received:', {
                    messagesCount: messages.length,
                    lastMessage: messages[messages.length - 1]?.text?.substring(0, 50),
                    isInitialLoad,
                });
            },
            (error) => {
                console.error('[ConversationDetail] Firestore listener error:', error);
                // 초기 로딩일 때만 로딩 상태 변경
                if (!initialLoadedRef.current) {
                    setLoading(false);
                    initialLoadedRef.current = true;
                }
                // 에러 발생 시 기존 fetchDetail로 폴백
                fetchDetail({ skipLoading: true }).catch((e) => {
                    console.error('[ConversationDetail] Fallback fetchDetail failed:', e);
                });
            }
        );

        // 클린업: 모달이 닫히거나 chatId가 변경되면 리스너 해제
        return () => {
            console.log('[ConversationDetail] Cleaning up Firestore listener');
            unsubscribe();
            initialLoadedRef.current = false; // 리스너 해제 시 플래그도 초기화
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatId, effectiveTenantId]);

    const fetchDetail = async (options = {}) => {
        const { skipLoading = false } = options;

        if (!chatId) {
            console.error('[ConversationDetail] Cannot fetch detail: chatId is missing');
            return;
        }

        if (!skipLoading) {
            setLoading(true);
        }

        try {
            const res = await fetch(
                `/api/conversations/detail?tenant=${effectiveTenantId}&chatId=${chatId}`
            );
            if (!res.ok) {
                throw new Error(`Failed to fetch: ${res.status}`);
            }

            const data = await res.json();
            setDetail(data);
        } catch (error) {
            console.error('[ConversationDetail] Failed to fetch detail:', error);
            if (!skipLoading) {
                setDetail(null);
            }
        } finally {
            if (!skipLoading) {
                setLoading(false);
            }
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

        if (!hasText && !hasAttachments) return;

        setSending(true);

        console.log('[ConversationDetail] Sending:', {
            hasText,
            textLength: text.length,
            attachmentsCount: attachments.length,
            tenantId: effectiveTenantId,
            chatId: chatId,
        });

        const savedDraft = draft;
        const savedAttachments = [...attachments];

        // ================================================
        // ① 옵티미스틱 메시지 (UI 먼저 반응)
        // ================================================
        const tempId = `local-${Date.now()}`;
        const optimisticMessage = {
            sender: 'agent',
            text: text || '',
            pics: savedAttachments.map(att => att.preview || att.url || '').filter(Boolean),
            timestamp: new Date().toISOString(),
            msgId: tempId,
            _status: 'pending',
        };

        setDetail(prev =>
            prev
                ? { ...prev, messages: [...(prev.messages || []), optimisticMessage] }
                : prev
        );

        // ================================================
        // ② 입력창/첨부 즉시 리셋 (로딩감 제거 → 체감 속도↑)
        // ================================================
        setDraft('');
        setAttachments([]);
        try { localStorage.removeItem(draftKey); } catch (e) { }
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        try {
            // ================================================
            // ③ 실제 전송 (UI는 이미 반응했기 때문에 기다릴 필요 없음)
            // ================================================
            await onSend?.({
                text: text || '',
                attachments: savedAttachments.map(att => ({
                    name: att.name,
                    type: att.type,
                    size: att.size,
                    base64: att.base64,
                })),
                tenantId: effectiveTenantId,
                chatId: chatId,
            });

            // ================================================
            // ④ 성공 → pending → sent
            // ================================================
            setDetail(prev => {
                if (!prev?.messages) return prev;
                return {
                    ...prev,
                    messages: prev.messages.map(m =>
                        m.msgId === tempId ? { ...m, _status: 'sent' } : m
                    ),
                };
            });

            // ================================================
            // ⑤ “전체 새로고침 없이” 백그라운드만 갈아끼우기
            //    (스피너 없음, 화면 깜빡임 없음)
            // ================================================
            fetchDetail({ skipLoading: true }).catch(err => {
                console.error('[ConversationDetail] refresh fail:', err);
            });

        } catch (error) {
            console.error('[ConversationDetail] Send failed:', error);

            // ⑥ 실패 → 버블만 error 처리
            setDetail(prev => {
                if (!prev?.messages) return prev;
                return {
                    ...prev,
                    messages: prev.messages.map(m =>
                        m.msgId === tempId ? { ...m, _status: 'error' } : m
                    ),
                };
            });

            // 입력값 복원
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
            {/* 임베디드 모드: 모달 없이 전체 화면 사용 */}
            {isEmbedded ? (
                <div className="flex flex-col h-full w-full bg-white overflow-hidden">
                    {/* 헤더 */}
                    <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 flex-shrink-0 bg-white">
                        <div className="flex items-center gap-3">{/* ✅ 리스트와 동일한 아바타 스타일 적용 */}
                            {(() => {
                                // ConversationCard와 동일한 로직
                                const getAvatarStyle = () => {
                                    if (!conversation.hasSlackCard && !conversation.taskType) {
                                        return {
                                            bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
                                            text: 'text-white'
                                        };
                                    }
                                    if (conversation.taskType === 'shadow') {
                                        return {
                                            bg: 'bg-gradient-to-br from-gray-300 to-gray-400',
                                            text: 'text-gray-600'
                                        };
                                    }
                                    if (conversation.taskType === 'work') {
                                        return {
                                            bg: 'bg-gradient-to-br from-yellow-400 to-orange-500',
                                            text: 'text-white'
                                        };
                                    }
                                    if (conversation.taskType === 'confirm') {
                                        return {
                                            bg: 'bg-gradient-to-br from-purple-400 to-purple-500',
                                            text: 'text-white'
                                        };
                                    }
                                    if (conversation.taskType === 'agent') {
                                        return {
                                            bg: 'bg-gradient-to-br from-red-400 to-red-500',
                                            text: 'text-white'
                                        };
                                    }
                                    return {
                                        bg: 'bg-gradient-to-br from-indigo-400 to-indigo-500',
                                        text: 'text-white'
                                    };
                                };

                                const avatarStyle = getAvatarStyle();
                                return (
                                    <div className={`w-10 h-10 rounded-full ${avatarStyle.bg} flex items-center justify-center`}>
                                        <span className={`${avatarStyle.text} text-sm font-semibold`}>
                                            {conversation.userNameInitial || conversation.userName?.charAt(0) || '?'}
                                        </span>
                                    </div>
                                );
                            })()}
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">{conversation.userName || '익명'}</h2>
                                <p className="text-xs text-gray-500">
                                    {conversation.channel || 'unknown'} • {chatId || 'N/A'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* AI 보정 버튼 */}
                            {(planName === 'pro' || planName === 'business') && (
                                <button
                                    onClick={() => setShowAIComposer(true)}
                                    className="px-3 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all flex items-center gap-2 text-sm font-medium"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    AI 보정
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 메시지 영역 */}
                    <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50">
                        {loading || !detail ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600 mb-4" />
                                <p className="text-gray-600">메시지를 불러오는 중...</p>
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
                                    <MessageBubble
                                        key={msg.msgId || idx}
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

                    {/* 입력 영역 */}
                    <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-white">
                        {/* 요약 정보 */}
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
                                            <>
                                                <img
                                                    src={att.preview}
                                                    alt={att.name}
                                                    className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                                                />
                                                <button
                                                    onClick={() => removeAttachment(idx)}
                                                    disabled={uploading}
                                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-100 md:opacity-90 md:group-hover:opacity-100 transition-opacity shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    ×
                                                </button>
                                            </>
                                        ) : (
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
                            <div className="mb-2 text-sm text-blue-600 flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-200 border-t-blue-600" />
                                파일 업로드 중...
                            </div>
                        )}

                        {/* 입력창 */}
                        <div className="flex items-end gap-2">
                            <input
                                type="file"
                                ref={filePickerRef}
                                onChange={(e) => handleFiles(e.target.files)}
                                className="hidden"
                                multiple
                                accept="image/*,.pdf"
                            />

                            <button
                                onClick={() => filePickerRef.current?.click()}
                                disabled={sending || uploading}
                                className="flex-shrink-0 p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Paperclip className="w-5 h-5" />
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
                                placeholder="메시지를 입력하세요..."
                                disabled={sending || uploading}
                                style={{
                                    minHeight: '42px',
                                    maxHeight: '120px',
                                    fontSize: '16px' // iOS 자동 확대 방지
                                }}
                                className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                                rows={1}
                            />

                            <button
                                onClick={handleSend}
                                disabled={!canSend || sending || uploading}
                                className={`flex-shrink-0 p-2.5 rounded-xl transition-all ${canSend && !sending && !uploading
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>

                        {/* 데스크톱 힌트 */}
                        <div className="hidden md:block mt-2 text-xs text-gray-400 text-center">
                            Enter 전송 • Shift+Enter 줄바꿈
                        </div>
                    </div>

                    {/* 모바일 키보드 대응 스타일 */}
                    <style jsx>{`
                        @media (max-width: 768px) {
                            input, textarea, select {
                                font-size: 16px !important;
                                -webkit-text-size-adjust: 100%;
                            }
                        }
                    `}</style>
                </div>
            ) : (
                /* 모달 모드: 기존 코드 유지 */
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={(e) => e.target === e.currentTarget && onClose()}
                >
                    <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[80vh] flex flex-col border border-gray-200">
                        {/* 헤더 */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                            <div className="flex items-center gap-3">{/* ✅ 리스트와 동일한 아바타 스타일 적용 */}
                                {(() => {
                                    const getAvatarStyle = () => {
                                        if (!conversation.hasSlackCard && !conversation.taskType) {
                                            return {
                                                bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
                                                text: 'text-white'
                                            };
                                        }
                                        if (conversation.taskType === 'shadow') {
                                            return {
                                                bg: 'bg-gradient-to-br from-gray-300 to-gray-400',
                                                text: 'text-gray-600'
                                            };
                                        }
                                        if (conversation.taskType === 'work') {
                                            return {
                                                bg: 'bg-gradient-to-br from-yellow-400 to-orange-500',
                                                text: 'text-white'
                                            };
                                        }
                                        if (conversation.taskType === 'confirm') {
                                            return {
                                                bg: 'bg-gradient-to-br from-purple-400 to-purple-500',
                                                text: 'text-white'
                                            };
                                        }
                                        if (conversation.taskType === 'agent') {
                                            return {
                                                bg: 'bg-gradient-to-br from-red-400 to-red-500',
                                                text: 'text-white'
                                            };
                                        }
                                        return {
                                            bg: 'bg-gradient-to-br from-indigo-400 to-indigo-500',
                                            text: 'text-white'
                                        };
                                    };

                                    const avatarStyle = getAvatarStyle();
                                    return (
                                        <div className={`w-10 h-10 rounded-full ${avatarStyle.bg} flex items-center justify-center`}>
                                            <span className={`${avatarStyle.text} text-sm font-semibold`}>
                                                {conversation.userNameInitial || conversation.userName?.charAt(0) || '?'}
                                            </span>
                                        </div>
                                    );
                                })()}
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">{conversation.userName || '익명'}</h2>
                                    <p className="text-xs text-gray-500">
                                        {conversation.channel || 'unknown'} • {chatId || 'N/A'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* AI 보정 버튼 */}
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
                            {loading || !detail ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600 mb-4" />
                                    <p className="text-gray-600">메시지를 불러오는 중...</p>
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
                                        <MessageBubble
                                            key={msg.msgId || idx}
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
                                                        disabled={uploading}
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
                                    disabled={uploading}
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
                                    value={draft} // ❌ sending 여부에 따라 바꾸지 않기
                                    onChange={(e) => {
                                        if (!uploading) {            // ❌ sending은 무시
                                            setDraft(e.target.value);
                                            autoResize(e.target);
                                        }
                                    }}
                                    onKeyDown={onKeyDown}
                                    onPaste={onPaste}
                                    placeholder={uploading ? '파일 처리 중...' : '메시지 입력...'}
                                    disabled={uploading}             // ❌ sending으로 disable 안 함
                                    enterKeyHint="send"
                                    style={{
                                        fontSize: '16px' // iOS 자동 확대 방지
                                    }}
                                    className="flex-1 resize-none bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50 max-h-[120px]"
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
                                    {/* 항상 아이콘만 */}
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
                        </div>
                    </div>
                </div>
            )}

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
                    onSend={async (text) => {
                        const trimmed = (text || '').trim();

                        // 혹시라도 빈 문자열이면 여기서 한 번 더 방어
                        if (!trimmed) {
                            throw new Error('전송할 내용이 없습니다.');
                        }

                        // 🔗 ConversationsPage.handleSend가 기대하는 형태로 변환해서 전달
                        await onSend?.({
                            text: trimmed,
                            attachments: [],              // AI 보정으로 보낼 때는 첨부 없음
                            tenantId: effectiveTenantId,  // 위에서 계산한 tenant
                            chatId,                       // 위에서 계산한 chatId
                        });

                        // ✅ 상세는 조용히 리프레시 (skipLoading: true)
                        fetchDetail({ skipLoading: true }).catch(e => {
                            console.error('[ConversationDetail] Failed to refresh after AI send:', e);
                        });
                    }}
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

    // ✅ 이미지 소스 정리 (string or {url})
    const imageSources = (message.pics || [])
        .map((pic) => (typeof pic === "string" ? pic : pic.url))
        .filter(Boolean);

    const hasImages = imageSources.length > 0;
    const hasText = !!message.text?.trim();

    // 텍스트도 없고 이미지도 없으면 렌더 안 함
    if (!hasText && !hasImages) return null;

    const imagesToShow = imageSources.slice(0, 4);
    const extraCount = imageSources.length > 4 ? imageSources.length - 4 : 0;

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

                {/* ▶ 텍스트 + 이미지가 같이 있을 때: 말풍선 안에 둘 다 */}
                {hasText && (
                    <div className={`rounded-2xl px-4 py-2.5 ${senderCfg.bubbleBg}`}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {message.text}
                        </p>

                        {hasImages && (
                            <div className="mt-2">
                                {imageSources.length === 1 ? (
                                    // 단일 이미지: 가로로 넉넉하게 표시
                                    <button
                                        type="button"
                                        className="relative overflow-hidden rounded-xl max-w-xs cursor-pointer"
                                        onClick={() => onImageClick?.(imageSources[0])}
                                    >
                                        <img
                                            src={imageSources[0]}
                                            alt="첨부 이미지"
                                            className="w-full max-h-80 object-cover"
                                            loading="lazy"
                                        />
                                    </button>
                                ) : (
                                    // 여러 이미지: 2x2 그리드 + 정사각 + object-cover
                                    <div className="grid grid-cols-2 gap-1 mt-1">
                                        {imagesToShow.map((src, idx) => {
                                            const showOverlay =
                                                extraCount > 0 && idx === imagesToShow.length - 1;
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className="relative overflow-hidden rounded-lg aspect-square cursor-pointer"
                                                    onClick={() => onImageClick?.(src)}
                                                >
                                                    <img
                                                        src={src}
                                                        alt={`첨부 ${idx + 1}`}
                                                        className="w-full h-full object-cover"
                                                        loading="lazy"
                                                    />
                                                    {showOverlay && (
                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                            <span className="text-white text-sm font-semibold">
                                                                +{extraCount}
                                                            </span>
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ▶ 텍스트 없이 이미지만 있을 때: 말풍선 없이 이미지 블록만 */}
                {!hasText && hasImages && (
                    <div className="space-y-2">
                        {imageSources.length === 1 ? (
                            <button
                                type="button"
                                className="relative overflow-hidden rounded-xl max-w-xs cursor-pointer"
                                onClick={() => onImageClick?.(imageSources[0])}
                            >
                                <img
                                    src={imageSources[0]}
                                    alt="첨부 이미지"
                                    className="w-full max-h-80 object-cover"
                                    loading="lazy"
                                />
                            </button>
                        ) : (
                            <div className="grid grid-cols-2 gap-1">
                                {imagesToShow.map((src, idx) => {
                                    const showOverlay =
                                        extraCount > 0 && idx === imagesToShow.length - 1;
                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            className="relative overflow-hidden rounded-lg aspect-square cursor-pointer"
                                            onClick={() => onImageClick?.(src)}
                                        >
                                            <img
                                                src={src}
                                                alt={`첨부 ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                            {showOverlay && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                    <span className="text-white text-sm font-semibold">
                                                        +{extraCount}
                                                    </span>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
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