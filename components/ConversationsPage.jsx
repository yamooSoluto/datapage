// components/ConversationsPage.jsx
// CRM 메인 페이지 - 웹: 2-column / 모바일: 모달
// ✅ Firestore 실시간 리스너 + chat_id 기준 dedup
// ✅ 진행중/저장/완료 필터는 archive_status 기반으로 분리 가능

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    User,
    Filter,
    MessageSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase-client';
import ConversationCard from './ConversationCard';
import ConversationDetail from './ConversationDetail';
import AIComposerModal from './AIComposerModal';
import { GlobalModeToggle } from './GlobalModeToggle';
import ConversationFilters from './ConversationFilters';

const toISOStringSafe = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') {
        try {
            return value.toDate().toISOString();
        } catch (_) { }
    }
    if (typeof value.seconds === 'number') {
        return new Date(value.seconds * 1000).toISOString();
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const splitCategories = (value) => {
    if (!value || typeof value !== 'string') return [];
    return value
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean);
};

const extractUserInitial = (name) => {
    if (!name || typeof name !== 'string') return '?';
    const trimmed = name.trim();
    if (!trimmed) return '?';
    const parts = trimmed.split(/\s+/);
    if (parts.length > 1) return parts[1]?.[0] || parts[0]?.[0] || '?';
    const mid = Math.floor(trimmed.length / 2);
    return trimmed[mid] || trimmed[0] || '?';
};

const extractLastMessageSnippet = (docData) => {
    if (typeof docData?.summary === 'string' && docData.summary.trim()) {
        return docData.summary.trim();
    }
    const messages = Array.isArray(docData?.messages) ? docData.messages : [];
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const text = (messages[i]?.text || '').trim();
        if (text) return text.slice(0, 140);
    }
    return '';
};

const collectImageMeta = (docData) => {
    const messages = Array.isArray(docData?.messages) ? docData.messages : [];
    const pics = [];
    messages.forEach((m) => {
        if (Array.isArray(m?.pics)) {
            m.pics.forEach((pic) => {
                if (typeof pic === 'string') {
                    pics.push(pic);
                } else if (pic?.url) {
                    pics.push(pic.url);
                }
            });
        }
    });
    return {
        hasImages: pics.length > 0,
        imageCount: pics.length,
        firstImageUrl: pics[0] || null,
        firstThumbnailUrl: pics[0] || null,
    };
};

const deriveChatIdFromDoc = (docId, docData) => {
    if (docData?.chat_id || docData?.chatId) return docData.chat_id || docData.chatId;
    if (typeof docId === 'string' && docId.includes('_')) {
        return docId.split('_').slice(1).join('_');
    }
    return docId || null;
};

const buildConversationFromRealtimeDoc = (docData, docId, tenantId) => {
    if (!docData) return null;
    const chatId = deriveChatIdFromDoc(docId, docData);
    if (!chatId) return null;
    const lastMessageAt = toISOStringSafe(docData.lastMessageAt) || new Date().toISOString();
    const summary = extractLastMessageSnippet(docData);
    const categories = splitCategories(docData.category);
    const imageMeta = collectImageMeta(docData);
    const hasPendingDraft = docData.draft_status === 'pending_approval';

    const lastMessageText =
        summary || (imageMeta.hasImages ? `(이미지 ${imageMeta.imageCount}개)` : '');

    return {
        id: docId || `${tenantId || docData.tenant_id || docData.tenantId || 'tenant'}_${chatId}`,
        chatId,
        tenantId: tenantId || docData.tenant_id || docData.tenantId || null,
        userId: docData.user_id || docData.userId || null,
        userName: docData.user_name || docData.userName || '익명',
        userNameInitial: extractUserInitial(docData.user_name || docData.userName),
        brandName: docData.brand_name || docData.brandName || null,
        channel: docData.channel || 'unknown',
        status: docData.status || 'waiting',
        modeSnapshot: docData.modeSnapshot || docData.mode_snapshot || 'AUTO',
        lastMessageAt,
        lastMessageText,
        summary: summary || null,
        task: docData.task || null,
        hasImages: imageMeta.hasImages,
        imageCount: imageMeta.imageCount,
        firstImageUrl: imageMeta.firstImageUrl,
        firstThumbnailUrl: imageMeta.firstThumbnailUrl,
        hasPendingDraft,
        draftStatus: docData.draft_status || null,
        draftCreatedAt: toISOStringSafe(docData.draft_created_at) || null,
        category: categories[0] || null,
        categories,
        hasSlackCard: !!docData.hasSlackCard,
        isTask: !!docData.isTask,
        taskType: docData.taskType || null,
        slackCardType: docData.slackCardType || null,
        hasAIResponse: docData.hasAIResponse || docData.has_ai_response || false,
        hasAgentResponse: docData.hasAgentResponse || docData.has_agent_response || false,
        messageCount: docData.messageCount || { user: 0, ai: 0, agent: 0, total: 0 },
        archive_status: docData.archive_status || null,
        archive_note: docData.archive_note || null,
        archived_at: toISOStringSafe(docData.archived_at) || null,
    };
};

export default function ConversationsPage({ tenantId }) {
    const [conversations, setConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showAIModal, setShowAIModal] = useState(false);
    const [globalMode, setGlobalMode] = useState('AUTO');
    const [isUpdating, setIsUpdating] = useState(false);
    const [libraryData, setLibraryData] = useState(null);

    const [quickFilter, setQuickFilter] = useState('all');
    const [archiveFilter, setArchiveFilter] = useState('active');

    const [filters, setFilters] = useState({
        channel: 'all',
        category: 'all',
        dateFrom: '',
        dateTo: '',
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const firestorePermissionDeniedRef = useRef(false);

    // Firestore 실시간 리스너
    useEffect(() => {
        if (!tenantId || !db || firestorePermissionDeniedRef.current) {
            return;
        }

        setLoading(true);

        const q = query(
            collection(db, 'FAQ_realtime_cw'),
            where('tenant_id', '==', tenantId),
            orderBy('lastMessageAt', 'desc')
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const chatMap = new Map();

                snapshot.docs.forEach((doc) => {
                    const docData = doc.data();
                    const chatId = deriveChatIdFromDoc(doc.id, docData);
                    if (!chatId) return;

                    const lastMessageTs = docData.lastMessageAt?.toMillis?.() || 0;

                    if (!chatMap.has(chatId)) {
                        chatMap.set(chatId, { doc, docData, lastMessageTs });
                    } else {
                        const existing = chatMap.get(chatId);
                        if (lastMessageTs > existing.lastMessageTs) {
                            chatMap.set(chatId, { doc, docData, lastMessageTs });
                        }
                    }
                });

                const convs = [];
                chatMap.forEach(({ doc, docData }) => {
                    const conv = buildConversationFromRealtimeDoc(docData, doc.id, tenantId);
                    if (conv) convs.push(conv);
                });

                convs.sort((a, b) => {
                    const tsA = new Date(a.lastMessageAt).getTime();
                    const tsB = new Date(b.lastMessageAt).getTime();
                    return tsB - tsA;
                });

                setConversations(convs);
                setLoading(false);

                if (selectedConv) {
                    const updated = convs.find((c) => c.chatId === selectedConv.chatId);
                    if (updated) {
                        setSelectedConv(updated);
                    }
                }
            },
            (error) => {
                if (error.code === 'permission-denied') {
                    firestorePermissionDeniedRef.current = true;
                    setLoading(false);
                } else {
                    console.error('[ConversationsPage] Snapshot error:', error);
                    setLoading(false);
                }
            }
        );

        return () => {
            unsubscribe();
        };
    }, [tenantId, selectedConv?.chatId]);

    // 라이브러리 데이터
    useEffect(() => {
        if (!tenantId) return;
        const loadLibrary = async () => {
            try {
                const res = await fetch(`/api/library/list?tenant=${tenantId}`);
                if (res.ok) {
                    const data = await res.json();
                    setLibraryData(data.library || []);
                }
            } catch (e) {
                console.error('[ConversationsPage] Library load error:', e);
            }
        };
        loadLibrary();
    }, [tenantId]);

    // 글로벌 모드
    useEffect(() => {
        if (!tenantId) return;
        const loadMode = async () => {
            try {
                const res = await fetch(`/api/mode/get?tenant=${tenantId}`);
                if (res.ok) {
                    const data = await res.json();
                    setGlobalMode(data.mode || 'AUTO');
                }
            } catch (e) {
                console.error('[ConversationsPage] Mode load error:', e);
            }
        };
        loadMode();
    }, [tenantId]);

    // 필터링 & 검색
    const filteredConversations = useMemo(() => {
        let result = [...conversations];

        // archiveFilter → 진행중/저장/완료 등 탭에 맞게 조정 가능
        if (archiveFilter !== 'all') {
            result = result.filter((conv) => {
                const archiveStatus = String(conv.archive_status || '').toLowerCase();
                const important = conv.important === true;

                switch (archiveFilter) {
                    case 'active':
                        return !archiveStatus || (archiveStatus !== 'hold' && archiveStatus !== 'important' && archiveStatus !== 'completed');
                    case 'hold':
                        return archiveStatus === 'hold';
                    case 'important':
                        return important || archiveStatus === 'important';
                    case 'completed':
                        return archiveStatus === 'completed';
                    default:
                        return true;
                }
            });
        }

        // 빠른 필터
        if (quickFilter !== 'all') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            switch (quickFilter) {
                case 'today':
                    result = result.filter((conv) => {
                        const msgDate = new Date(conv.lastMessageAt);
                        msgDate.setHours(0, 0, 0, 0);
                        return msgDate.getTime() === today.getTime();
                    });
                    break;
                case 'unanswered':
                    result = result.filter((conv) => {
                        const { ai = 0, agent = 0 } = conv.messageCount || {};
                        return ai + agent === 0;
                    });
                    break;
                case 'ai':
                    result = result.filter((conv) => {
                        const { ai = 0 } = conv.messageCount || {};
                        return ai > 0;
                    });
                    break;
                case 'agent':
                    result = result.filter((conv) => {
                        const { agent = 0 } = conv.messageCount || {};
                        return agent > 0;
                    });
                    break;
                default:
                    break;
            }
        }

        // 채널 필터
        if (filters.channel !== 'all') {
            result = result.filter((conv) => conv.channel === filters.channel);
        }

        // 카테고리 필터
        if (filters.category !== 'all') {
            result = result.filter((conv) =>
                conv.categories?.includes(filters.category)
            );
        }

        // 날짜 필터
        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            result = result.filter((conv) => {
                const msgDate = new Date(conv.lastMessageAt);
                return msgDate >= fromDate;
            });
        }

        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            result = result.filter((conv) => {
                const msgDate = new Date(conv.lastMessageAt);
                return msgDate <= toDate;
            });
        }

        // 검색
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter((conv) => {
                return (
                    conv.userName?.toLowerCase().includes(q) ||
                    conv.lastMessageText?.toLowerCase().includes(q) ||
                    conv.summary?.toLowerCase().includes(q) ||
                    conv.chatId?.toLowerCase().includes(q)
                );
            });
        }

        return result;
    }, [conversations, archiveFilter, quickFilter, filters, searchQuery]);

    // 페이지네이션
    const totalPages = Math.ceil(filteredConversations.length / itemsPerPage);
    const paginatedConversations = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredConversations.slice(start, start + itemsPerPage);
    }, [filteredConversations, currentPage, itemsPerPage]);

    const resetFilters = () => {
        setFilters({
            channel: 'all',
            category: 'all',
            dateFrom: '',
            dateTo: '',
        });
        setSearchQuery('');
        setQuickFilter('all');
        setArchiveFilter('active');
        setCurrentPage(1);
    };

    const handleConversationSelect = useCallback((conv) => {
        setSelectedConv(conv);
    }, []);

    const handleSend = async (payload) => {
        try {
            const response = await fetch('/api/conversations/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId,
                    chatId: payload.chatId,
                    text: payload.text,
                    attachments: payload.attachments || [],
                }),
            });

            if (!response.ok) throw new Error('전송 실패');

            toast.success('메시지가 전송되었습니다');
        } catch (error) {
            console.error('[ConversationsPage] Send error:', error);
            toast.error('메시지 전송에 실패했습니다');
            throw error;
        }
    };

    const handleAISend = async (payload) => {
        try {
            const response = await fetch('/api/conversations/send-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId,
                    chatId: payload.chatId,
                    text: payload.text,
                    mode: payload.mode || 'ai',
                }),
            });

            if (!response.ok) throw new Error('AI 전송 실패');

            toast.success('AI 메시지가 전송되었습니다');
            setShowAIModal(false);
        } catch (error) {
            console.error('[ConversationsPage] AI send error:', error);
            toast.error('AI 메시지 전송에 실패했습니다');
            throw error;
        }
    };

    const handlePendingDraftCleared = useCallback(() => {
        if (selectedConv) {
            setSelectedConv((prev) => ({
                ...prev,
                hasPendingDraft: false,
                draftStatus: null,
            }));
        }
    }, [selectedConv]);

    const handleDetailStatusChange = useCallback(
        (newStatus, context) => {
            setConversations((prev) =>
                prev.map((conv) => {
                    if (conv.chatId === context.chatId) {
                        return {
                            ...conv,
                            archive_status: newStatus === 'active' ? null : newStatus,
                            status: newStatus === 'completed' ? 'completed' : conv.status,
                        };
                    }
                    return conv;
                })
            );

            if (selectedConv?.chatId === context.chatId) {
                setSelectedConv((prev) => ({
                    ...prev,
                    archive_status: newStatus === 'active' ? null : newStatus,
                    status: newStatus === 'completed' ? 'completed' : prev.status,
                }));
            }

            if (newStatus === 'completed') {
                setSelectedConv(null);
            }
        },
        [selectedConv]
    );

    const handleGlobalModeChange = async (newMode) => {
        setIsUpdating(true);
        try {
            const response = await fetch('/api/mode/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId,
                    mode: newMode,
                }),
            });

            if (!response.ok) throw new Error('모드 변경 실패');

            setGlobalMode(newMode);
            toast.success(`모드가 ${newMode}로 변경되었습니다`);
        } catch (error) {
            console.error('[ConversationsPage] Mode change error:', error);
            toast.error('모드 변경에 실패했습니다');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {loading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            )}

            {/* 좌측 리스트 */}
            <div className="flex flex-col w-full lg:w-[400px] xl:w-[480px] border-r border-gray-200 bg-white">
                {/* 헤더 */}
                <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                        <h1 className="text-xl font-bold text-gray-900">대화 목록</h1>
                        <GlobalModeToggle
                            currentMode={globalMode}
                            onModeChange={handleGlobalModeChange}
                            isUpdating={isUpdating}
                        />
                    </div>

                    {/* 검색 */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="이름, 메시지 내용 검색..."
                            className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {/* 빠른 필터 */}
                    <div className="flex gap-2 mt-3 overflow-x-auto">
                        {[
                            { key: 'all', label: '전체' },
                            { key: 'today', label: '오늘' },
                            { key: 'unanswered', label: '미답변' },
                            { key: 'ai', label: 'AI 답변' },
                            { key: 'agent', label: '상담원 답변' },
                        ].map((item) => (
                            <button
                                key={item.key}
                                onClick={() => {
                                    setQuickFilter(item.key);
                                    setCurrentPage(1);
                                }}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${quickFilter === item.key
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    {/* Archive 필터 (진행중/저장/완료 탭 역할) */}
                    <ConversationFilters
                        archiveFilter={archiveFilter}
                        onArchiveFilterChange={(newFilter) => {
                            setArchiveFilter(newFilter);
                            setCurrentPage(1);
                        }}
                    />

                    {/* 고급 필터 */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 mt-3 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        <Filter className="w-4 h-4" />
                        고급 필터
                    </button>

                    {showFilters && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-xl space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    채널
                                </label>
                                <select
                                    value={filters.channel}
                                    onChange={(e) => {
                                        setFilters({ ...filters, channel: e.target.value });
                                        setCurrentPage(1);
                                    }}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="all">전체</option>
                                    <option value="kakao">카카오톡</option>
                                    <option value="naver">네이버 톡톡</option>
                                    <option value="widget">웹 위젯</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        시작일
                                    </label>
                                    <input
                                        type="date"
                                        value={filters.dateFrom}
                                        onChange={(e) => {
                                            setFilters({ ...filters, dateFrom: e.target.value });
                                            setCurrentPage(1);
                                        }}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        종료일
                                    </label>
                                    <input
                                        type="date"
                                        value={filters.dateTo}
                                        onChange={(e) => {
                                            setFilters({ ...filters, dateTo: e.target.value });
                                            setCurrentPage(1);
                                        }}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={resetFilters}
                                className="w-full px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                            >
                                필터 초기화
                            </button>
                        </div>
                    )}
                </div>

                {/* 리스트 */}
                <div className="flex-1 overflow-y-auto px-3 py-3">
                    {paginatedConversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
                            <User className="w-12 h-12 mb-4 opacity-50" />
                            <p className="text-sm font-medium">대화가 없습니다</p>
                            <p className="text-xs text-gray-400 mt-1">
                                필터를 변경해보세요
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {paginatedConversations.map((conv) => (
                                <ConversationCard
                                    key={conv.id}
                                    conversation={conv}
                                    onClick={() => handleConversationSelect(conv)}
                                    isSelected={selectedConv?.chatId === conv.chatId}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-gray-200">
                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="text-xs font-medium text-gray-700">
                            {currentPage} / {totalPages}
                        </div>

                        <button
                            onClick={() =>
                                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                            }
                            disabled={currentPage === totalPages}
                            className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* 우측: 상세 (웹) */}
            <div className="hidden lg:flex flex-1 bg-gray-50 overflow-hidden">
                {selectedConv ? (
                    <ConversationDetail
                        conversation={selectedConv}
                        tenantId={tenantId}
                        onClose={() => setSelectedConv(null)}
                        onSend={handleSend}
                        onOpenAICorrector={() => setShowAIModal(true)}
                        onPendingDraftCleared={handlePendingDraftCleared}
                        onStatusChange={handleDetailStatusChange}
                        isEmbedded={true}
                        libraryData={libraryData}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
                        <p className="text-lg font-medium">대화를 선택해주세요</p>
                        <p className="text-sm mt-2">
                            좌측 리스트에서 대화를 클릭하면 내용을 확인할 수 있습니다
                        </p>
                    </div>
                )}
            </div>

            {/* 모바일: 상세 모달 */}
            {selectedConv && (
                <div className="lg:hidden z-[100]">
                    <ConversationDetail
                        conversation={selectedConv}
                        tenantId={tenantId}
                        onClose={() => setSelectedConv(null)}
                        onSend={handleSend}
                        onOpenAICorrector={() => setShowAIModal(true)}
                        onPendingDraftCleared={handlePendingDraftCleared}
                        onStatusChange={handleDetailStatusChange}
                        isEmbedded={false}
                        libraryData={libraryData}
                    />
                </div>
            )}

            {/* AI 보정/작성 모달 */}
            {showAIModal && selectedConv && (
                <AIComposerModal
                    conversation={selectedConv}
                    tenantId={tenantId}
                    planName="business"
                    libraryData={libraryData}
                    onClose={() => setShowAIModal(false)}
                    onSend={handleAISend}
                />
            )}
        </div>
    );
}
