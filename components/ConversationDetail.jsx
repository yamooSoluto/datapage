// components/ConversationDetail.jsx
// 애플 스타일 대화 상세 모달 - 클라이언트 중심 최적화 (tenantId 우선 사용)
// ✨ 라이브러리 매크로 기능 추가: # 입력 시 라이브러리 항목 선택 가능

import { useState, useEffect, useRef } from 'react';
import { X, User, Bot, UserCheck, ZoomIn, Paperclip, Send, Sparkles, Bookmark, Check } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase-client';
import AIComposerModal from './AIComposerModal';
import LibraryMacroDropdown from './LibraryMacroDropdown'; // ✅ 추가

const SWIPE_COMPLETE_THRESHOLD = 80;
const MAX_SWIPE_DISTANCE = 160;

export default function ConversationDetail({ conversation, onClose, onSend, onOpenAICorrector, onPendingDraftCleared, onStatusChange, tenantId, planName = 'trial', isEmbedded = false, libraryData }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const initialLoadedRef = useRef(false); // ✅ 초기 로딩 완료 플래그 (클로저 문제 방지)
    const [imagePreview, setImagePreview] = useState(null);
    const [showAIComposer, setShowAIComposer] = useState(false); // ✅ AI 보정 모달 상태
    const [composerInitialText, setComposerInitialText] = useState(""); // ✅ 컨펌 초안 수정용
    const [composerMode, setComposerMode] = useState('ai'); // 'ai' | 'confirm-edit'
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null); // 메시지 스크롤 컨테이너 ref
    const firestorePermissionDeniedRef = useRef(false); // ✅ Firestore 권한 오류 플래그
    const currentChatIdRef = useRef(null); // ✅ 현재 로드된 chatId 추적

    // 입력바 상태
    const [draft, setDraft] = useState('');
    const [attachments, setAttachments] = useState([]); // { file, url, name, type }
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const filePickerRef = useRef(null);
    const textareaRef = useRef(null);

    // ✅ 라이브러리 매크로 상태
    const [showLibraryDropdown, setShowLibraryDropdown] = useState(false);
    const [macroSearchQuery, setMacroSearchQuery] = useState('');
    const [macroTriggerPosition, setMacroTriggerPosition] = useState(null);
    const [cursorPosition, setCursorPosition] = useState(0);

    // ✅ tenantId를 상위에서 추출 (먼저 정의)
    const effectiveTenantId =
        tenantId ||
        conversation?.tenant ||
        conversation?.tenantId ||
        conversation?.tenant_id ||
        (typeof conversation?.id === 'string' && conversation.id.includes('_')
            ? conversation.id.split('_')[0]
            : null) ||
        'default';

    // ✅ chatId 안전하게 추출 (snake_case 포함)
    const baseChatId =
        conversation?.chatId ||
        conversation?.chat_id ||
        conversation?.id ||
        '';

    const resolvedChatId =
        (detail?.conversation?.chatId || detail?.conversation?.chat_id) ||
        baseChatId;

    // ✅ 로컬 스토리지 키 (effectiveTenantId와 chatId 사용)
    const draftKey = resolvedChatId ? `draft_${effectiveTenantId}_${resolvedChatId}` : null;

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
    const [pendingDraftDismissed, setPendingDraftDismissed] = useState(false);

    // ✅ 대화 변경 시 입력바와 상태 초기화
    useEffect(() => {
        setDraft('');
        setAttachments((prev) => {
            prev.forEach((att) => {
                if (att?.preview) {
                    URL.revokeObjectURL(att.preview);
                }
            });
            return [];
        });
        setPendingDraftDismissed(false);
    }, [baseChatId, effectiveTenantId]);

    const applyLocalArchiveStatus = (status) => {
        setDetail((prev) => {
            if (!prev?.conversation) return prev;
            const archiveValue = status === 'active' ? null : status;
            return {
                ...prev,
                conversation: {
                    ...prev.conversation,
                    archive_status: archiveValue,
                    archiveStatus: archiveValue,
                    currentArchiveStatus: status,
                    status: status === 'completed' ? 'completed' : prev.conversation.status,
                },
            };
        });
    };

    // ✅ 상태 변경 핸들러
    const handleStatusChange = (newStatus) => {
        if (!newStatus) return;

        console.log('[ConversationDetail] Status changed:', newStatus);
        applyLocalArchiveStatus(newStatus);
        onStatusChange?.(newStatus, {
            chatId: resolvedChatId,
            tenantId: effectiveTenantId,
        });

        if (newStatus === 'completed') {
            // 완료 시 모달 닫기
            onClose?.();
        }
    };

    // ✅ 저장 상태 관리
    const [isSaved, setIsSaved] = useState(false);
    const [savingStatus, setSavingStatus] = useState(false);
    const [completing, setCompleting] = useState(false);

    // ✅ 스와이프 완료 상태
    const [swipeX, setSwipeX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const swipeStartXRef = useRef(0);

    // ✅ 초기 저장 상태 로드
    useEffect(() => {
        const archiveStatus = conversation?.archive_status || conversation?.archiveStatus;
        setIsSaved(archiveStatus === 'saved');
    }, [conversation]);

    // ✅ 저장 토글
    const toggleSaved = async () => {
        if (savingStatus) return;

        const newStatus = isSaved ? null : 'saved';
        setSavingStatus(true);

        try {
            const response = await fetch('/api/conversations/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: effectiveTenantId,
                    chatId: resolvedChatId,
                    archiveStatus: newStatus,
                }),
            });

            if (!response.ok) throw new Error('저장 실패');

            setIsSaved(!isSaved);
            console.log('[ConversationDetail] Saved status:', newStatus);
            handleStatusChange(newStatus ? 'saved' : 'active');
        } catch (error) {
            console.error('[ConversationDetail] Save error:', error);
            alert('저장에 실패했습니다.');
        } finally {
            setSavingStatus(false);
        }
    };

    // ✅ 스와이프로 완료 처리
    const handleSwipeStart = (e) => {
        if (e.touches.length !== 1) return;
        swipeStartXRef.current = e.touches[0].clientX;
        setIsSwiping(true);
        setSwipeX(0);
    };

    const handleSwipeMove = (e) => {
        if (!isSwiping || completing) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - swipeStartXRef.current;

        // 우측 스와이프만 (왼쪽은 무시)
        if (diff > 0) {
            setSwipeX(Math.min(diff, MAX_SWIPE_DISTANCE));
        } else {
            setSwipeX(0);
        }
    };

    const handleSwipeEnd = () => {
        if (!isSwiping) return;
        if (swipeX > SWIPE_COMPLETE_THRESHOLD) {
            completeConversation();
        } else {
            setSwipeX(0);
            setIsSwiping(false);
        }
    };

    const completeConversation = async ({ confirmMessage } = {}) => {
        if (completing) return;

        if (confirmMessage) {
            const confirmed = window.confirm(confirmMessage);
            if (!confirmed) {
                setSwipeX(0);
                setIsSwiping(false);
                return;
            }
        }

        setCompleting(true);

        try {
            const response = await fetch('/api/conversations/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: effectiveTenantId,
                    chatId: resolvedChatId,
                    archiveStatus: 'completed',
                }),
            });

            if (!response.ok) throw new Error('완료 처리 실패');

            console.log('[ConversationDetail] Completed conversation');
            handleStatusChange('completed');
        } catch (error) {
            console.error('[ConversationDetail] Complete error:', error);
            alert('완료 처리에 실패했습니다.');
        } finally {
            setCompleting(false);
            setSwipeX(0);
            setIsSwiping(false);
        }
    };

    // ✅ conversation/tenant 변경 시 초기 상세 정보 로드 및 상태 리셋
    useEffect(() => {
        if (!baseChatId || !effectiveTenantId) {
            console.warn('[ConversationDetail] Missing chatId or tenantId');
            setLoading(false);
            return;
        }

        const chatIdentity = `${effectiveTenantId}::${baseChatId}`;
        const chatChanged = currentChatIdRef.current !== chatIdentity;

        if (chatChanged) {
            console.log('[ConversationDetail] Chat changed, resetting state:', baseChatId);
            currentChatIdRef.current = chatIdentity;
            setDetail(null);
            setLoading(true);
            firestorePermissionDeniedRef.current = false;
        }

        let isMounted = true;

        const loadInitialDetail = async () => {
            try {
                await fetchDetail({
                    chatId: baseChatId,
                });
            } catch (error) {
                if (isMounted) {
                    console.error('[ConversationDetail] Failed to load detail via API:', error);
                }
            }
        };

        loadInitialDetail();

        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseChatId, effectiveTenantId]);

    // 초기 로딩은 onSnapshot useEffect에서 처리

    useEffect(() => {
        if (detail?.messages && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [detail?.messages]);

    // ✅ 모바일 키보드 대응: textarea focus 시 스크롤 조정 및 하단 탭 숨기기
    useEffect(() => {
        if (!textareaRef.current) return;

        const textarea = textareaRef.current;
        const handleFocus = () => {
            // 하단 탭 숨기기를 위해 커스텀 이벤트 발생 (MinimalHeader가 감지하도록)
            const focusEvent = new FocusEvent('focusin', { bubbles: true, cancelable: true });
            textarea.dispatchEvent(focusEvent);

            // 모바일에서 키보드가 나타날 때 입력창이 가려지지 않도록 스크롤
            setTimeout(() => {
                if (textarea) {
                    textarea.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'nearest'
                    });
                }
            }, 300); // 키보드 애니메이션 대기
        };

        const handleBlur = () => {
            // 하단 탭 표시를 위해 커스텀 이벤트 발생
            const blurEvent = new FocusEvent('focusout', { bubbles: true, cancelable: true });
            textarea.dispatchEvent(blurEvent);

            // 키보드가 사라질 때 스크롤 위치 조정 (필요시)
            setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 100);
        };

        textarea.addEventListener('focus', handleFocus);
        textarea.addEventListener('blur', handleBlur);

        return () => {
            textarea.removeEventListener('focus', handleFocus);
            textarea.removeEventListener('blur', handleBlur);
        };
    }, []);

    // ✅ Firestore 실시간 리스너: 모달이 열려 있는 동안 새 메시지 자동 감지
    useEffect(() => {
        if (!baseChatId || !effectiveTenantId) {
            setLoading(false);
            initialLoadedRef.current = false;
            return;
        }

        // ✅ 권한 오류가 발생한 경우 Firestore 리스너를 사용하지 않고 API만 사용 (주기적 폴링)
        if (firestorePermissionDeniedRef.current) {
            console.log('[ConversationDetail] Firestore permission denied, using API polling');

            fetchDetail().catch((e) => {
                console.error('[ConversationDetail] Initial fetchDetail failed:', e);
                setLoading(false);
                initialLoadedRef.current = true;
            });

            const pollingInterval = setInterval(() => {
                fetchDetail({ skipLoading: true }).catch((e) => {
                    console.error('[ConversationDetail] Polling fetchDetail failed:', e);
                });
            }, 5000);

            return () => {
                clearInterval(pollingInterval);
            };
        }

        const q = query(
            collection(db, 'FAQ_realtime_cw'),
            where('tenant_id', '==', effectiveTenantId),
            where('chat_id', '==', String(baseChatId)),
            orderBy('lastMessageAt', 'desc')
        );

        console.log('[ConversationDetail] Setting up Firestore listener for chat:', effectiveTenantId, baseChatId);

        setLoading(true);
        initialLoadedRef.current = false;

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                if (snapshot.empty) {
                    console.warn('[ConversationDetail] No docs for chat:', baseChatId);
                    if (!initialLoadedRef.current) {
                        setLoading(false);
                        initialLoadedRef.current = true;
                    }
                    return;
                }

                const docs = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    data: doc.data(),
                }));

                const serverMessages = docs.flatMap((doc) =>
                    normalizeServerMessages(doc.data?.messages)
                );

                const uniqueMessages = sortAndDedupeMessages(serverMessages);

                setDetail((prev) => {
                    const baseDetail = prev || {
                        conversation: conversation || {},
                        messages: [],
                    };

                    const firstDoc = docs[0];
                    const docData = firstDoc?.data || {};
                    const docConversation = firstDoc
                        ? {
                            id: firstDoc.id,
                            chatId: docData.chat_id || docData.chatId || baseChatId,
                            userId: docData.user_id ?? baseDetail.conversation?.userId,
                            userName: docData.user_name || baseDetail.conversation?.userName || '익명',
                            brandName: docData.brandName || docData.brand_name || baseDetail.conversation?.brandName || null,
                            channel: docData.channel || baseDetail.conversation?.channel || 'unknown',
                            status: docData.status || baseDetail.conversation?.status || 'waiting',
                            modeSnapshot: docData.modeSnapshot || baseDetail.conversation?.modeSnapshot || 'AUTO',
                            draftStatus: docData.draft_status ?? baseDetail.conversation?.draftStatus ?? null,
                            aiDraft: docData.ai_draft ?? baseDetail.conversation?.aiDraft ?? null,
                            confirmThreadTs: docData.confirm_thread_ts ?? baseDetail.conversation?.confirmThreadTs ?? null,
                            confirmThreadChannel: docData.confirm_thread_channel ?? baseDetail.conversation?.confirmThreadChannel ?? null,
                            lastMessageAt: docData.lastMessageAt?.toDate?.()?.toISOString() || docData.lastMessageAt || baseDetail.conversation?.lastMessageAt || null,
                            cwConversationId: docData.cw_conversation_id ?? baseDetail.conversation?.cwConversationId ?? null,
                            summary:
                                (typeof docData.summary === 'string' && docData.summary.trim()
                                    ? docData.summary.trim()
                                    : null) ??
                                baseDetail.conversation?.summary ??
                                null,
                            category: docData.category ?? baseDetail.conversation?.category ?? null,
                            categories: docData.category
                                ? docData.category.split('|').map((c) => c.trim())
                                : baseDetail.conversation?.categories || [],
                        }
                        : baseDetail.conversation;

                    const targetChatId =
                        docConversation?.chatId ||
                        docConversation?.chat_id ||
                        baseChatId;

                    const optimisticMessages =
                        targetChatId &&
                            (baseDetail.conversation?.chatId === targetChatId ||
                                baseDetail.conversation?.chat_id === targetChatId)
                            ? (baseDetail.messages || []).filter(
                                (m) => m._status === 'pending' || m._status === 'sent'
                            )
                            : [];

                    const mergedMessages = mergeOptimisticMessages(
                        uniqueMessages,
                        optimisticMessages
                    );

                    return {
                        ...baseDetail,
                        conversation: {
                            ...baseDetail.conversation,
                            ...docConversation,
                        },
                        messages: mergedMessages,
                    };
                });

                const isInitialLoad = !initialLoadedRef.current;

                if (isInitialLoad) {
                    setLoading(false);
                    initialLoadedRef.current = true;
                }

                const lastMessage = uniqueMessages[uniqueMessages.length - 1];
                console.log('[ConversationDetail] Firestore update received:', {
                    docs: docs.length,
                    messagesCount: uniqueMessages.length,
                    lastMessage: lastMessage?.text?.substring(0, 50),
                    isInitialLoad,
                });
            },
            (error) => {
                const isPermissionError = error?.code === 'permission-denied' ||
                    error?.code === 'PERMISSION_DENIED' ||
                    error?.message?.includes('permission') ||
                    error?.message?.includes('Permission');

                if (isPermissionError) {
                    console.warn('[ConversationDetail] Firestore permission denied, switching to API-only mode:', error);
                    firestorePermissionDeniedRef.current = true;
                    unsubscribe();
                    if (!initialLoadedRef.current) {
                        setLoading(true);
                    }
                    fetchDetail().catch((e) => {
                        console.error('[ConversationDetail] Fallback fetchDetail failed:', e);
                        if (!initialLoadedRef.current) {
                            setLoading(false);
                            initialLoadedRef.current = true;
                        }
                    });
                    return;
                }

                console.error('[ConversationDetail] Firestore listener error:', error);
                if (!initialLoadedRef.current) {
                    setLoading(false);
                    initialLoadedRef.current = true;
                }
                fetchDetail({ skipLoading: true }).catch((e) => {
                    console.error('[ConversationDetail] Fallback fetchDetail failed:', e);
                });
            }
        );

        return () => {
            console.log('[ConversationDetail] Cleaning up Firestore listener');
            unsubscribe();
            initialLoadedRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseChatId, effectiveTenantId]);

    // ✅ 서버 메시지 정규화 헬퍼 함수 (Firestore Timestamp 및 일반 문자열 모두 처리)
    const normalizeServerMessages = (messages) => {
        if (!Array.isArray(messages)) return [];
        return messages.map(m => {
            // pics 배열 추출: pics가 있으면 사용, 없으면 attachments에서 변환
            let pics = [];
            if (Array.isArray(m.pics) && m.pics.length > 0) {
                pics = m.pics;
            } else if (Array.isArray(m.attachments) && m.attachments.length > 0) {
                // attachments 배열에서 url 추출
                pics = m.attachments
                    .map(att => (typeof att === 'string' ? att : att.url))
                    .filter(Boolean);
            }

            return {
                sender: m.sender,
                text: m.text || '',
                pics: pics,
                timestamp: m.timestamp?.toDate?.()?.toISOString() || m.timestamp || new Date().toISOString(),
                msgId: m.msgId || m.message_id || null, // message_id도 확인
                modeSnapshot: m.modeSnapshot || null,
            };
        });
    };

    const sortAndDedupeMessages = (messages) => {
        if (!Array.isArray(messages)) return [];

        const sorted = [...messages].sort((a, b) => {
            const tsA = new Date(a.timestamp || 0).getTime();
            const tsB = new Date(b.timestamp || 0).getTime();
            return tsA - tsB;
        });

        const seen = new Set();
        const unique = [];

        sorted.forEach((msg) => {
            const tsKey = new Date(msg.timestamp || 0).getTime();
            const textKey = (msg.text || '').slice(0, 50);
            const picsLen = (msg.pics || []).length;
            const key = msg.msgId || `${msg.sender || 'unknown'}_${tsKey}_${textKey}_${picsLen}`;

            if (!seen.has(key)) {
                seen.add(key);
                unique.push(msg);
            }
        });

        return unique;
    };

    // ✅ 옵티미스틱 메시지와 서버 메시지 병합 헬퍼 함수
    const mergeOptimisticMessages = (serverMessages, optimisticMessages) => {
        const serverMsgIds = new Set(serverMessages.map(m => m.msgId).filter(Boolean));

        // 서버에 저장된 옵티미스틱 메시지 제거
        const remaining = optimisticMessages.filter(opt => {
            // msgId로 매칭
            if (opt.msgId && serverMsgIds.has(opt.msgId)) return false;

            // 타임스탬프 + 내용으로 매칭
            const optTime = new Date(opt.timestamp).getTime();
            const optText = (opt.text || '').trim();
            const optPicsCount = (opt.pics || []).length;

            return !serverMessages.some(server => {
                const serverTime = new Date(server.timestamp).getTime();
                const timeDiff = Math.abs(optTime - serverTime);
                const serverText = (server.text || '').trim();
                const serverPicsCount = (server.pics || []).length;

                // 사진만: 타임스탬프 + 사진 개수만
                if (!optText && !serverText && optPicsCount > 0 && serverPicsCount > 0) {
                    return timeDiff < 10000 && optPicsCount === serverPicsCount;
                }
                // 텍스트 있음: 타임스탬프 + 텍스트 + 사진 개수
                if (optText && serverText) {
                    return timeDiff < 5000 && optText === serverText && optPicsCount === serverPicsCount;
                }
                return false;
            });
        });

        return [...serverMessages, ...remaining];
    };

    const fetchDetail = async (options = {}) => {
        const { skipLoading = false, chatId: chatIdOverride } = options;
        const targetChatId = chatIdOverride || resolvedChatId;

        if (!targetChatId) {
            console.error('[ConversationDetail] Cannot fetch detail: chatId is missing');
            return;
        }

        if (!skipLoading) {
            setLoading(true);
        }

        try {
            const res = await fetch(
                `/api/conversations/detail?tenant=${effectiveTenantId}&chatId=${targetChatId}`
            );
            if (!res.ok) {
                throw new Error(`Failed to fetch: ${res.status}`);
            }

            const data = await res.json();

            setDetail(prev => {
                const baseDetail = prev && typeof prev === 'object' ? prev : {};

                const isSameChat =
                    targetChatId &&
                    (baseDetail?.conversation?.chatId === targetChatId ||
                        baseDetail?.conversation?.chat_id === targetChatId);

                const optimisticMessages = isSameChat
                    ? (baseDetail?.messages || []).filter(
                        (m) => m._status === 'pending' || m._status === 'sent'
                    )
                    : [];

                const serverMessages = normalizeServerMessages(data.messages);

                return {
                    ...baseDetail,
                    ...data,
                    messages: mergeOptimisticMessages(serverMessages, optimisticMessages),
                };
            });
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

    // ✅ # 트리거 감지 및 라이브러리 드롭다운 처리
    const handleDraftChange = (e) => {
        const value = e.target.value;
        const cursorPos = e.target.selectionStart;

        setDraft(value);
        setCursorPosition(cursorPos);
        autoResize(e.target);

        // # 트리거 감지
        const textBeforeCursor = value.substring(0, cursorPos);
        const lastHashIndex = textBeforeCursor.lastIndexOf('#');

        if (lastHashIndex !== -1) {
            const textAfterHash = textBeforeCursor.substring(lastHashIndex + 1);

            // # 이후에 공백이 없고, 라이브러리 데이터가 있으면 드롭다운 표시
            if (!textAfterHash.includes(' ') && libraryData) {
                setMacroSearchQuery(textAfterHash);

                // ✅ 위치 계산을 먼저 완료한 후 드롭다운 표시 (깜빡임 방지)
                if (textareaRef.current) {
                    // 먼저 드롭다운 숨김 (깜빡임 방지)
                    setShowLibraryDropdown(false);

                    // 위치를 먼저 계산
                    const rect = textareaRef.current.getBoundingClientRect();
                    const inputBottom = window.innerHeight - rect.top; // 입력창 아래부터 화면 상단까지 거리

                    // 위치를 먼저 설정
                    setMacroTriggerPosition({
                        bottom: inputBottom + 8, // 입력창 바로 위 8px
                        left: rect.left,
                    });

                    // 위치 설정이 완료된 후 다음 프레임에서 드롭다운 표시 (이중 requestAnimationFrame으로 확실히 보장)
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            setShowLibraryDropdown(true);
                        });
                    });
                } else {
                    setShowLibraryDropdown(false);
                    setMacroTriggerPosition(null);
                }
            } else {
                setShowLibraryDropdown(false);
                setMacroTriggerPosition(null);
            }
        } else {
            setShowLibraryDropdown(false);
            setMacroTriggerPosition(null);
        }
    };

    // ✅ 라이브러리 항목 선택 처리
    const handleLibrarySelect = (value) => {
        if (!textareaRef.current) return;

        const textBeforeCursor = draft.substring(0, cursorPosition);
        const textAfterCursor = draft.substring(cursorPosition);
        const lastHashIndex = textBeforeCursor.lastIndexOf('#');

        if (lastHashIndex !== -1) {
            // # 부분을 선택한 값으로 교체
            const newText =
                draft.substring(0, lastHashIndex) +
                value +
                ' ' + // 공백 추가
                textAfterCursor;

            setDraft(newText);

            // 커서 위치 조정
            const newCursorPos = lastHashIndex + value.length + 1;
            setTimeout(() => {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                autoResize(textareaRef.current);
            }, 0);
        }

        setShowLibraryDropdown(false);
        setMacroSearchQuery('');
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
            chatId: resolvedChatId,
        });

        const savedDraft = draft;
        const savedAttachments = [...attachments];

        // ================================================
        // ① 옵티미스틱 메시지 (UI 먼저 반응)
        // 사진만 전송할 때는 text가 빈 문자열, pics만 있음 (카카오톡처럼 버블 없이 이미지만 표시)
        // ================================================
        const tempId = `local-${Date.now()}`;
        const optimisticMessage = {
            sender: 'agent',
            text: text || '', // 사진만 전송할 때는 빈 문자열
            pics: savedAttachments.map(att => att.preview || att.url || '').filter(Boolean), // blob URL (preview)
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
                chatId: resolvedChatId,
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
            // ⑤ Firestore 리스너가 자동으로 업데이트하므로 fetchDetail 불필요
            //    (옵티미스틱 메시지가 보존되고, 서버 메시지가 자동으로 추가됨)
            // ================================================
            // fetchDetail 제거: Firestore 리스너가 자동으로 업데이트함

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
        // ✅ 드롭다운이 열려있으면 Enter는 드롭다운에서 처리
        if (showLibraryDropdown) {
            // LibraryMacroDropdown에서 처리하도록 함
            return;
        }

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

    const openAIComposer = (text = '', mode = 'ai') => {
        setComposerInitialText(text);
        setComposerMode(mode);
        setShowAIComposer(true);
    };

    // ✅ 컨펌 초안 관련 상태 계산
    const conversationData = detail?.conversation;
    const draftCreatedAt =
        conversationData?.draftCreatedAt ||
        conversation?.draftCreatedAt ||
        null;
    const isConfirmMode = conversationData?.modeSnapshot === "CONFIRM";
    const hasPendingDraft = isConfirmMode && conversationData?.draftStatus === "pending_approval" && !!conversationData?.aiDraft;
    const pendingDraftText = hasPendingDraft ? conversationData.aiDraft : "";
    const pendingDraftKey = hasPendingDraft
        ? `${conversationData?.chatId || conversationData?.chat_id || conversation?.chatId || conversation?.chat_id || 'unknown'}_${conversationData?.draftStatus}_${conversationData?.aiDraft}_${draftCreatedAt || ''}`
        : null;
    const messages = Array.isArray(detail?.messages) ? detail.messages : [];
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    const lastSender = lastMessage?.sender || null;
    const lastSenderIsAgent = lastSender === 'admin' || lastSender === 'agent';
    const normalizedStatus = (conversationData?.status || conversation?.status || '').toLowerCase();
    const hasExternalAnswer = normalizedStatus === 'completed' || lastSenderIsAgent;
    const showPendingDraftCard = hasPendingDraft && !pendingDraftDismissed && !hasExternalAnswer;
    const confirmThreadTs = conversationData?.confirmThreadTs || null;
    const confirmThreadChannel = conversationData?.confirmThreadChannel || null;

    // ✅ 승인 대기 상태가 Firestore에서 해제되면 자동으로 UI 업데이트
    useEffect(() => {
        // hasPendingDraft가 false가 되면 (슬랙/포탈에서 전송 완료)
        if (!hasPendingDraft && pendingDraftDismissed) {
            setPendingDraftDismissed(false);
            console.log('[ConversationDetail] Pending draft cleared - status:', conversationData?.draftStatus);
        }

        // status가 completed가 되어도 초기화
        if (normalizedStatus === 'completed' && pendingDraftDismissed) {
            setPendingDraftDismissed(false);
            console.log('[ConversationDetail] Conversation completed - clearing draft dismissed state');
        }
    }, [hasPendingDraft, pendingDraftDismissed, normalizedStatus, conversationData?.draftStatus]);

    useEffect(() => {
        if (pendingDraftKey) {
            setPendingDraftDismissed(false);
        }
    }, [pendingDraftKey]);

    useEffect(() => {
        if (hasPendingDraft && hasExternalAnswer) {
            setPendingDraftDismissed(true);
        }
    }, [hasPendingDraft, hasExternalAnswer]);

    // ✅ 포탈에서 메시지 전송하는 공통 함수
    const sendFinalViaPortal = async (text, options = {}) => {
        const targetChatId = conversationData?.chatId || conversationData?.chat_id || resolvedChatId;
        if (!targetChatId || !effectiveTenantId) return;

        // ✅ 중복 전송 방지
        if (sending) {
            console.log('[sendFinalViaPortal] Already sending, ignoring duplicate request');
            return;
        }

        setSending(true); // ✅ 로딩 시작

        try {
            const res = await fetch("/api/conversations/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tenantId: effectiveTenantId,
                    chatId: targetChatId,
                    content: text,
                    attachments: [],
                    // 🔹 컨펌용 공통 옵션
                    ...options,
                }),
            });

            const data = await res.json();
            if (!data.ok && !res.ok) {
                throw new Error(data.error || `전송 실패: ${res.status}`);
            }

            // ✅ 전송 성공 시 즉시 UI 업데이트
            setDetail(prev => {
                if (!prev?.conversation) return prev;
                return {
                    ...prev,
                    conversation: {
                        ...prev.conversation,
                        aiDraft: null,
                        draftStatus: 'approved',
                        draftCreatedAt: null,
                    },
                };
            });

            setPendingDraftDismissed(true);

            // ✅ 상위 컴포넌트에 알림
            onPendingDraftCleared?.({
                chatId: conversationData?.chatId || conversationData?.chat_id || conversation?.chatId || conversation?.chat_id || null,
                tenantId: effectiveTenantId,
            });

            // success 후 detail 리프레시
            fetchDetail({ skipLoading: true }).catch((e) => {
                console.error('[ConversationDetail] Failed to refresh after send:', e);
            });

        } catch (error) {
            console.error('[ConversationDetail] Send message error:', error);
            alert(`메시지 전송에 실패했습니다: ${error.message}`);
            throw error;
        } finally {
            setSending(false); // ✅ 로딩 종료
        }
    };

    // ✅ 그대로 전송 핸들러
    const handleSendDraftAsIs = async () => {
        if (!hasPendingDraft || sending) return; // ✅ 중복 방지
        const text = conversationData.aiDraft;

        await sendFinalViaPortal(text, {
            via: "ai",
            sent_as: "ai",
            mode: "confirm_approved",   // 👈 postSendConfirmation용 라벨
            confirmMode: true,
            confirmBypass: true,        // 👈 ★ 이게 핵심: 컨펌게이트 통과
            slackCleanup: {
                shouldCleanupCard: true,
                shouldPostFeedback: true,
                confirmThreadTs: confirmThreadTs,
                channelId: confirmThreadChannel,
            },
        });

        // ✅ sendFinalViaPortal에서 이미 처리하므로 여기서는 불필요
    };

    // ✅ 수정 후 전송 핸들러
    const handleEditDraft = () => {
        if (!hasPendingDraft) return;
        openAIComposer(conversationData.aiDraft, 'confirm-edit');
    };

    return (
        <>
            {/* 임베디드 모드: 모달 없이 전체 화면 사용 */}
            {isEmbedded ? (
                <div
                    className="flex flex-col w-full bg-white overflow-hidden"
                    style={{
                        height: '100dvh', // 동적 viewport (모바일 주소창 고려)
                        height: '-webkit-fill-available', // Safari 대응
                    }}
                >
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
                                {/* 요약을 여기로 이동 */}
                                {detail?.conversation?.summary ? (
                                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                                        💡 {detail.conversation.summary}
                                    </p>
                                ) : (
                                    <p className="text-xs text-gray-500">
                                        {conversation.channel || 'unknown'}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={toggleSaved}
                                disabled={savingStatus}
                                className={`p-2 rounded-lg transition-all disabled:opacity-50 ${isSaved ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}
                                title={isSaved ? "저장 취소" : "저장"}
                                aria-pressed={isSaved}
                                aria-label={isSaved ? "대화 저장 해제" : "대화 저장"}
                            >
                                <Bookmark
                                    className="w-5 h-5 transition-all"
                                    fill={isSaved ? 'currentColor' : 'none'}
                                />
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    completeConversation({
                                        confirmMessage: '이 대화를 완료 처리하시겠습니까?\n완료된 대화는 "완료" 탭에서 확인할 수 있습니다.',
                                    })
                                }
                                disabled={completing}
                                className="hidden sm:inline-flex p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                title="대화 완료 처리"
                                aria-label="대화 완료 처리"
                            >
                                <Check className="w-5 h-5" />
                            </button>

                            {/* AI 보정 버튼 */}
                            {(planName === 'pro' || planName === 'business') && (
                                <button
                                    onClick={() => openAIComposer(draft)}
                                    className="px-3 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all flex items-center gap-2 text-sm font-medium"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    AI 보정
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 메시지 영역 */}
                    <div
                        ref={messagesContainerRef}
                        className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50"
                        style={{
                            WebkitOverflowScrolling: 'touch',
                            touchAction: 'pan-y',
                            overscrollBehavior: 'contain',
                            minHeight: 0, // flex-1이 제대로 작동하도록
                        }}
                    >
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

                    {/* 입력 영역 - 키보드 위 고정 */}
                    <div
                        className="flex-shrink-0 px-4 py-4 border-t border-gray-200 bg-white relative"
                        style={{
                            // 모바일에서 키보드 위에 고정
                            position: 'sticky',
                            bottom: 0,
                            zIndex: 10,
                        }}
                    >
                        {/* ✅ 라이브러리 드롭다운 - position이 계산된 후에만 렌더링 (깜빡임 방지) */}
                        {showLibraryDropdown && libraryData && macroTriggerPosition && (
                            <LibraryMacroDropdown
                                libraryData={libraryData}
                                searchQuery={macroSearchQuery}
                                onSelect={handleLibrarySelect}
                                position={macroTriggerPosition}
                                onClose={() => {
                                    setShowLibraryDropdown(false);
                                    setMacroTriggerPosition(null);
                                }}
                            />
                        )}

                        {/* 🔹 컨펌 초안 카드 */}
                        {showPendingDraftCard && (
                            <div className="mb-3 p-3 rounded-xl border border-yellow-200 bg-yellow-50/80">
                                <div className="flex items-start justify-between mb-1 gap-3">
                                    <div>
                                        <span className="text-xs font-semibold text-yellow-700 block">
                                            🟡 컨펌 모드 · 답변 승인 대기 중
                                        </span>
                                        <span className="text-[11px] text-yellow-500">
                                            포탈에서 승인 / 수정 후 전송할 수 있어요
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPendingDraftDismissed(true)}
                                        className="p-1 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100 rounded-full transition-colors"
                                        aria-label="승인 안내 닫기"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">
                                    {pendingDraftText}
                                </p>

                                <div className="flex justify-end gap-2 mt-3">
                                    <button
                                        type="button"
                                        onClick={handleSendDraftAsIs}
                                        className="px-3 py-1.5 text-xs rounded-lg bg-yellow-500 text-white font-semibold hover:bg-yellow-600 transition-colors"
                                    >
                                        ✅ 그대로 전송
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleEditDraft}
                                        className="px-3 py-1.5 text-xs rounded-lg border border-yellow-300 text-yellow-700 bg-white hover:bg-yellow-50 transition-colors"
                                    >
                                        ✏️ 수정 후 전송
                                    </button>
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

                            {/* ✅ AI 보정 버튼 */}
                            <button
                                onClick={() => openAIComposer(draft)}
                                disabled={sending || uploading}
                                className="flex-shrink-0 p-2.5 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                aria-label="AI 보정"
                                title="AI 톤 보정"
                            >
                                <Sparkles className="w-5 h-5 text-purple-600 group-hover:text-purple-700" />
                            </button>

                            <textarea
                                ref={textareaRef}
                                value={draft}
                                onChange={handleDraftChange}
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
                            /* iOS Safari 주소창 대응 */
                            .conversation-container {
                                height: 100dvh;
                                height: -webkit-fill-available;
                            }
                            
                            /* 입력창 항상 보이게 */
                            .input-area {
                                position: sticky;
                                bottom: 0;
                                background: white;
                                z-index: 10;
                            }
                            
                            /* 폰트 크기 16px 이상 (iOS 자동 확대 방지) */
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
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 pt-16 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pt-16 md:pb-20"
                    onClick={(e) => e.target === e.currentTarget && onClose()}
                >
                    {/* 스와이프 완료 힌트 배경 */}
                    {swipeX > 0 && (
                        <div
                            className="fixed inset-0 bg-gradient-to-r from-green-400/80 to-green-500/80 flex items-center justify-center px-6 z-0 pointer-events-none"
                            style={{ opacity: Math.min(swipeX / SWIPE_COMPLETE_THRESHOLD, 1) }}
                        >
                            <div className="text-white flex flex-col items-center gap-3 text-center">
                                <Check className="w-8 h-8" strokeWidth={2.5} />
                                <span className="text-base sm:text-lg font-semibold">
                                    우측으로 스와이프하면 완료 처리됩니다
                                </span>
                            </div>
                        </div>
                    )}

                    <div
                        className="bg-white rounded-2xl max-w-3xl w-full max-h-[75vh] flex flex-col border border-gray-200 relative z-10"
                        onTouchStart={handleSwipeStart}
                        onTouchMove={handleSwipeMove}
                        onTouchEnd={handleSwipeEnd}
                        style={{
                            transform: `translateX(${swipeX}px)`,
                            transition: isSwiping ? 'none' : 'transform 0.2s ease-out',
                        }}
                    >
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
                                    {/* 요약을 여기로 이동 */}
                                    {detail?.conversation?.summary ? (
                                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                            {detail.conversation.summary}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-gray-500">
                                            {conversation.channel || 'unknown'}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* 북마크 저장 버튼 */}
                                <button
                                    type="button"
                                    onClick={toggleSaved}
                                    disabled={savingStatus}
                                    className={`p-2 rounded-lg transition-all disabled:opacity-50 ${isSaved ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}
                                    title={isSaved ? "저장 취소" : "저장"}
                                    aria-pressed={isSaved}
                                    aria-label={isSaved ? "대화 저장 해제" : "대화 저장"}
                                >
                                    <Bookmark
                                        className="w-5 h-5 transition-all"
                                        fill={isSaved ? 'currentColor' : 'none'}
                                    />
                                </button>

                                {/* 데스크톱 완료 버튼 */}
                                <button
                                    type="button"
                                    onClick={() =>
                                        completeConversation({
                                            confirmMessage: '이 대화를 완료 처리하시겠습니까?\n완료된 대화는 "완료" 탭에서 확인할 수 있습니다.',
                                        })
                                    }
                                    disabled={completing}
                                    className="hidden sm:inline-flex p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="대화 완료 처리"
                                    aria-label="대화 완료 처리"
                                >
                                    <Check className="w-5 h-5" />
                                </button>

                                {/* AI 보정 버튼 */}
                                {(planName === 'pro' || planName === 'business') && (
                                    <button
                                        onClick={() => openAIComposer(draft)}
                                        className="px-3 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all flex items-center gap-2 text-sm font-medium"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        <span className="hidden sm:inline">AI 보정</span>
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
                        <div
                            ref={messagesContainerRef}
                            className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50"
                            style={{
                                WebkitOverflowScrolling: 'touch',
                                touchAction: 'pan-y',
                                overscrollBehavior: 'contain',
                                minHeight: 0, // flex-1이 제대로 작동하도록
                            }}
                        >
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

                        {/* 입력 영역 - 키보드 위 고정 */}
                        <div
                            className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-white rounded-b-2xl relative"
                            style={{
                                // 모바일에서 키보드 위에 고정
                                position: 'sticky',
                                bottom: 0,
                                zIndex: 10,
                            }}
                        >
                            {/* ✅ 라이브러리 드롭다운 - position이 계산된 후에만 렌더링 (깜빡임 방지) */}
                            {showLibraryDropdown && libraryData && macroTriggerPosition && (
                                <LibraryMacroDropdown
                                    libraryData={libraryData}
                                    searchQuery={macroSearchQuery}
                                    onSelect={handleLibrarySelect}
                                    position={macroTriggerPosition}
                                    onClose={() => {
                                        setShowLibraryDropdown(false);
                                        setMacroTriggerPosition(null);
                                    }}
                                />
                            )}

                            {/* 🔹 컨펌 초안 카드 */}
                            {showPendingDraftCard && (
                                <div className="mb-3 p-3 rounded-xl border border-yellow-200 bg-yellow-50/80">
                                    <div className="flex items-start justify-between mb-1 gap-3">
                                        <div>
                                            <span className="text-xs font-semibold text-yellow-700 block">
                                                🟡 컨펌 모드 · 답변 승인 대기 중
                                            </span>
                                            <span className="text-[11px] text-yellow-500">
                                                포탈에서 승인 / 수정 후 전송할 수 있어요
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPendingDraftDismissed(true)}
                                            className="p-1 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100 rounded-full transition-colors"
                                            aria-label="승인 안내 닫기"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">
                                        {pendingDraftText}
                                    </p>

                                    <div className="flex justify-end gap-2 mt-3">
                                        <button
                                            type="button"
                                            onClick={handleSendDraftAsIs}
                                            className="px-3 py-1.5 text-xs rounded-lg bg-yellow-500 text-white font-semibold hover:bg-yellow-600 transition-colors"
                                        >
                                            ✅ 그대로 전송
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleEditDraft}
                                            className="px-3 py-1.5 text-xs rounded-lg border border-yellow-300 text-yellow-700 bg-white hover:bg-yellow-50 transition-colors"
                                        >
                                            ✏️ 수정 후 전송
                                        </button>
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
                                    onClick={() => openAIComposer(draft)}
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
                                            handleDraftChange(e);
                                        }
                                    }}
                                    onKeyDown={onKeyDown}
                                    onPaste={onPaste}
                                    placeholder={uploading ? '파일 처리 중...' : '메시지 입력...'}
                                    disabled={uploading}             // ❌ sending으로 disable 안 함
                                    enterKeyHint="send"
                                    style={{ fontSize: '16px' }} // 모바일 화면 확대 방지
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
                    className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
                    onClick={() => setImagePreview(null)}
                >
                    {/* 닫기 버튼 - 모바일: 하단 중앙, 데스크톱: 우측 상단 */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setImagePreview(null);
                        }}
                        className="fixed md:absolute bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:top-16 md:right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm z-10"
                        aria-label="닫기"
                    >
                        <X className="w-6 h-6 text-white" />
                    </button>
                    {/* ESC 키 안내 (모바일 제외) */}
                    <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/50 text-white text-xs rounded-lg backdrop-blur-sm hidden md:block">
                        ESC로 닫기
                    </div>
                    <img
                        src={imagePreview}
                        alt="미리보기"
                        className="max-w-full max-h-full object-contain cursor-pointer"
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
                    initialText={composerInitialText}
                    libraryData={libraryData} // ✅ 라이브러리 데이터 전달
                    mode={composerMode}
                    onClose={() => {
                        setShowAIComposer(false);
                        setComposerInitialText(""); // 닫을 때 초기화
                        setComposerMode('ai');
                    }}
                    onSend={async (text) => {
                        const trimmed = (text || '').trim();

                        // 혹시라도 빈 문자열이면 여기서 한 번 더 방어
                        if (!trimmed) {
                            throw new Error('전송할 내용이 없습니다.');
                        }

                        try {
                            // 🔹 컨펌 초안 수정 시에는 sendFinalViaPortal 사용
                            if (isConfirmMode && composerInitialText) {
                                await sendFinalViaPortal(trimmed, {
                                    via: "ai",
                                    sent_as: "ai",
                                    mode: "confirm_edited",
                                    confirmMode: true,
                                    confirmBypass: true,
                                    slackCleanup: {
                                        shouldCleanupCard: true,
                                        shouldPostFeedback: true,
                                        confirmThreadTs: confirmThreadTs,
                                        channelId: confirmThreadChannel,
                                    },
                                });
                                setComposerInitialText(""); // 전송 후 초기화
                            } else {
                                // 🔗 일반 AI 보정: ConversationsPage.handleSend가 기대하는 형태로 변환해서 전달
                                await onSend?.({
                                    text: trimmed,
                                    attachments: [],              // AI 보정으로 보낼 때는 첨부 없음
                                    tenantId: effectiveTenantId,  // 위에서 계산한 tenant
                                    chatId: resolvedChatId,       // 위에서 계산한 chatId
                                });
                            }

                            // ✅ 전송 성공 시 즉시 모달 닫기
                            setShowAIComposer(false);
                            setComposerMode('ai');
                            setComposerInitialText("");

                            // ✅ 상세는 조용히 리프레시 (skipLoading: true)
                            fetchDetail({ skipLoading: true }).catch(e => {
                                console.error('[ConversationDetail] Failed to refresh after AI send:', e);
                            });
                        } catch (error) {
                            // 에러는 AIComposerModal에서 처리
                            throw error;
                        }
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