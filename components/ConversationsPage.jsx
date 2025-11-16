// components/ConversationsPage.jsx
// CRM 메인 페이지 - 웹: 2-column 레이아웃 / 모바일: 모달 방식

import { useState, useEffect, useMemo } from 'react';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    X,
    User,
    Calendar,
    Filter,
    Sparkles as SparklesIcon,
    MessageSquare,
    Clock,
    AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConversationCard from './ConversationCard';
import ConversationDetail from './ConversationDetail';
import AIComposerModal from './AIComposerModal';
import { GlobalModeToggle } from './GlobalModeToggle';

export default function ConversationsPage({ tenantId }) {
    const [conversations, setConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showAIModal, setShowAIModal] = useState(false);
    const [globalMode, setGlobalMode] = useState('AUTO'); // 'AUTO' | 'CONFIRM'
    const [isUpdating, setIsUpdating] = useState(false);
    const [libraryData, setLibraryData] = useState(null); // ✅ 라이브러리 데이터

    // 빠른 필터
    const [quickFilter, setQuickFilter] = useState('all'); // 'all' | 'today' | 'unanswered' | 'ai' | 'agent'

    const [filters, setFilters] = useState({
        channel: 'all',
        category: 'all',
        dateFrom: '',
        dateTo: '',
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);

    const availableCategories = [
        '결제/환불',
        '예약/변경',
        '이용/시설',
        '상품/서비스',
        '시스템/오류',
        '건의/요청',
        '이벤트/쿠폰',
        '기타',
    ];

    useEffect(() => {
        fetchConversations();
        fetchLibraryData();
    }, [tenantId]);

    // ✅ 라이브러리 데이터 가져오기
    const fetchLibraryData = async () => {
        if (!tenantId) return;
        try {
            const res = await fetch(`/api/library/get?tenantId=${tenantId}`);
            if (res.ok) {
                const data = await res.json();
                setLibraryData(
                    data.library || {
                        links: {},
                        passwords: {},
                        rules: {},
                        info: {},
                    }
                );
            }
        } catch (error) {
            console.error('Failed to fetch library data:', error);
            // 기본값 설정
            setLibraryData({
                links: {},
                passwords: {},
                rules: {},
                info: {},
            });
        }
    };

    const fetchConversations = async (options = {}) => {
        const { skipLoading = false } = options;

        if (!skipLoading) setLoading(true);
        try {
            const params = new URLSearchParams({ tenant: tenantId || '', limit: 500 });
            const res = await fetch(`/api/conversations/list?${params}`);
            const data = await res.json();
            setConversations(data.conversations || []);
            setCurrentPage(1);
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
        } finally {
            if (!skipLoading) setLoading(false);
        }
    };

    // ✅ 상단에서 한눈에 보는 간단 통계
    const conversationStats = useMemo(() => {
        if (!conversations || conversations.length === 0) {
            return { today: 0, unanswered: 0, ai: 0, agent: 0, total: 0 };
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        let today = 0;
        let unanswered = 0;
        let ai = 0;
        let agent = 0;

        for (const c of conversations) {
            const last = c.lastMessageAt ? new Date(c.lastMessageAt) : null;
            if (last && last >= todayStart) today += 1;

            if (c.status === 'waiting' || !c.lastAgentMessage) {
                unanswered += 1;
            }
            if (c.hasAIResponse) ai += 1;
            if (c.hasAgentResponse) agent += 1;
        }

        return {
            today,
            unanswered,
            ai,
            agent,
            total: conversations.length,
        };
    }, [conversations]);

    // 빠른 필터 적용
    const applyQuickFilter = (convs) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        switch (quickFilter) {
            case 'today':
                return convs.filter((c) => new Date(c.lastMessageAt) >= today);

            case 'unanswered':
                return convs.filter(
                    (c) => c.status === 'waiting' || !c.lastAgentMessage
                );

            case 'ai':
                return convs.filter((c) => c.hasAIResponse);

            case 'agent':
                return convs.filter((c) => c.hasAgentResponse);

            default:
                return convs;
        }
    };

    const filteredConversations = useMemo(() => {
        let result = [...conversations];

        // 빠른 필터 적용
        result = applyQuickFilter(result);

        // 채널 필터
        if (filters.channel !== 'all') {
            result = result.filter((c) => c.channel === filters.channel);
        }

        // 카테고리 필터
        if (filters.category !== 'all') {
            result = result.filter(
                (c) => c.categories && c.categories.includes(filters.category)
            );
        }

        // 날짜 필터
        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            result = result.filter((c) => new Date(c.lastMessageAt) >= fromDate);
        }
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59);
            result = result.filter((c) => new Date(c.lastMessageAt) <= toDate);
        }

        // 검색
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (c) =>
                    c.userName?.toLowerCase().includes(q) ||
                    c.summary?.toLowerCase().includes(q) ||
                    c.chatId?.toLowerCase().includes(q)
            );
        }

        return result.sort(
            (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
        );
    }, [conversations, filters, searchQuery, quickFilter]);

    const totalPages = Math.ceil(filteredConversations.length / itemsPerPage);
    const paginatedConversations = filteredConversations.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // 전송 핸들러
    const handleSend = async ({
        text,
        attachments,
        tenantId: detailTenantId,
        chatId: detailChatId,
    }) => {
        const effectiveTenantId =
            detailTenantId ||
            tenantId ||
            selectedConv?.tenant ||
            selectedConv?.tenantId ||
            (typeof selectedConv?.id === 'string' &&
                selectedConv.id.includes('_')
                ? selectedConv.id.split('_')[0]
                : null);

        const effectiveChatId = detailChatId || selectedConv?.chatId;

        if (!effectiveChatId) {
            console.error('[ConversationsPage] No chatId found');
            throw new Error('대화 ID를 찾을 수 없습니다');
        }

        if (!effectiveTenantId) {
            console.error('[ConversationsPage] No tenantId found');
            throw new Error('테넌트 ID를 찾을 수 없습니다');
        }

        const finalText = text || '';
        const finalTextTrimmed = finalText.trim();

        if (!finalTextTrimmed && (!attachments || attachments.length === 0)) {
            console.error('[ConversationsPage] No content or attachments to send');
            throw new Error('전송할 내용이 없습니다.');
        }

        try {
            const payload = {
                tenantId: effectiveTenantId,
                chatId: effectiveChatId,
                content: finalTextTrimmed,
                attachments: Array.isArray(attachments) ? attachments : [],
            };

            const response = await fetch('/api/conversations/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `전송 실패: ${response.status}`);
            }

            const result = await response.json();

            // 🔹 1) 리스트는 "조용히" 비동기 리프레시 (로딩 플래그 X, await X)
            fetchConversations({ skipLoading: true }).catch((e) => {
                console.warn('[ConversationsPage] silent refresh failed:', e);
            });

            // 🔹 2) 선택된 대화만 살짝 메타 업데이트 (완전 필수는 아님)
            setSelectedConv((prev) => {
                if (!prev || prev.chatId !== effectiveChatId) return prev;
                return {
                    ...prev,
                    lastMessageAt: new Date().toISOString(),
                    lastAgentMessage: finalTextTrimmed || prev.lastAgentMessage,
                    hasAgentResponse: true,
                };
            });

            return result;
        } catch (error) {
            console.error('[ConversationsPage] Failed to send message:', error);
            throw error;
        }
    };

    const handleAISend = async (aiContent) => {
        if (!selectedConv) return;
        return handleSend({
            text: aiContent,
            attachments: [],
            tenantId,
            chatId: selectedConv.chatId,
        });
    };

    const handleModeToggle = async () => {
        const nextMode = globalMode === 'AUTO' ? 'CONFIRM' : 'AUTO';
        setIsUpdating(true);

        try {
            const response = await fetch('/api/tenants/policy', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: tenantId,
                    defaultMode: nextMode,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setGlobalMode(nextMode);
                toast.success(
                    nextMode === 'CONFIRM'
                        ? '🟡 모든 답변을 검토 후 전송합니다'
                        : '🟢 AI가 자동으로 답변합니다'
                );
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Mode toggle error:', error);
            toast.error('모드 변경에 실패했습니다');
        } finally {
            setIsUpdating(false);
        }
    };

    const resetFilters = () => {
        setFilters({
            channel: 'all',
            category: 'all',
            dateFrom: '',
            dateTo: '',
        });
        setSearchQuery('');
        setQuickFilter('all');
        setCurrentPage(1);
    };

    const modeTitle =
        globalMode === 'CONFIRM' ? '컨펌 모드 (검토 후 전송)' : '자동 응답 모드';
    const modeSubtitle =
        globalMode === 'CONFIRM'
            ? 'AI가 초안을 만들고, 확인 후 버튼으로 전송해요.'
            : '회원 문의에 AI가 바로 답변을 전송해요.';

    return (
        <div className="fixed top-12 left-0 right-0 bottom-0 flex bg-gray-50 overflow-hidden md:top-12">
            {/* 메인 컨텐츠 */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                        <p className="text-gray-600">대화 목록을 불러오는 중...</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* 좌측: 대화 리스트 */}
                    <div className="flex flex-col w-full lg:w-[400px] xl:w-[450px] border-r border-gray-200 bg-white h-full overflow-hidden z-10">
                        {/* 좌측 헤더 */}
                        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-gray-200 bg-white/90 backdrop-blur">
                            {/* 타이틀 + 새로고침 + 오늘/미답변 요약 */}
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <h1 className="text-xl font-semibold text-gray-900">
                                        대화 관리
                                    </h1>
                                    <p className="mt-1 text-xs text-gray-700 md:text-gray-500">
                                        오늘{' '}
                                        <span className="font-semibold text-gray-900 md:text-gray-800">
                                            {conversationStats.today}
                                        </span>
                                        건 · 미답변{' '}
                                        <span className="font-semibold text-rose-600 md:text-rose-500">
                                            {conversationStats.unanswered}
                                        </span>
                                        건
                                    </p>
                                </div>
                                <button
                                    onClick={() => fetchConversations()}
                                    className="mt-1 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="새로고침"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                </button>
                            </div>

                            {/* 모드 카드 */}
                            <div className="mb-3 rounded-2xl border border-gray-100 bg-gradient-to-r from-yellow-50/70 via-white to-blue-50/60 px-3 py-2.5 flex items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-900 md:text-gray-800">
                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-100">
                                            <SparklesIcon className="w-3 h-3 text-yellow-600" />
                                        </span>
                                        <span className="truncate">{modeTitle}</span>
                                    </div>
                                    <p className="mt-0.5 text-[11px] text-gray-700 md:text-gray-500 leading-snug">
                                        {modeSubtitle}
                                    </p>
                                </div>
                                <div className="flex-shrink-0">
                                    <GlobalModeToggle
                                        mode={globalMode}
                                        onToggle={handleModeToggle}
                                        disabled={isUpdating}
                                    />
                                </div>
                            </div>

                            {/* 검색 + 필터 카드 */}
                            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                                {/* 검색 */}
                                <div className="relative mb-2.5">
                                    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="이름, 내용 검색..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{ fontSize: '16px' }}
                                        className="w-full pl-8 pr-8 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-blue-500 text-[13px] text-gray-900 placeholder-gray-400"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* 빠른 필터 + 상세 필터 버튼 한 줄 정렬 */}
                                <div className="flex items-center gap-2">
                                    {/* 빠른 필터 */}
                                    <div className="flex flex-1 flex-wrap gap-1.5">
                                        {[
                                            { key: 'all', label: '전체', icon: MessageSquare },
                                            { key: 'today', label: '오늘', icon: Clock },
                                            {
                                                key: 'unanswered',
                                                label: '미답변',
                                                icon: AlertCircle,
                                            },
                                        ].map(({ key, label, icon: Icon }) => (
                                            <button
                                                key={key}
                                                onClick={() => {
                                                    setQuickFilter(key);
                                                    setCurrentPage(1);
                                                }}
                                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all ${quickFilter === key
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                                    }`}
                                            >
                                                <Icon className="w-3.5 h-3.5" />
                                                {label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* 상세 필터 토글 */}
                                    <button
                                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${showAdvancedFilters
                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                            }`}
                                    >
                                        <Filter className="w-3.5 h-3.5" />
                                        {showAdvancedFilters ? '필터 닫기' : '상세 필터'}
                                    </button>
                                </div>

                                {/* 고급 필터 */}
                                {showAdvancedFilters && (
                                    <div className="mt-3 pt-2 border-t border-gray-200 space-y-2.5 md:space-y-2">
                                        <div className="grid grid-cols-2 gap-2 md:gap-2.5">
                                            <div>
                                                <label className="block text-[10px] md:text-[11px] font-medium text-gray-600 md:text-gray-700 mb-1 md:mb-1.5">
                                                    채널
                                                </label>
                                                <select
                                                    value={filters.channel}
                                                    onChange={(e) => {
                                                        setFilters({
                                                            ...filters,
                                                            channel: e.target.value,
                                                        });
                                                        setCurrentPage(1);
                                                    }}
                                                    style={{ fontSize: '16px' }} // 모바일 화면 확대 방지
                                                    className="w-full px-2.5 md:px-3 py-1.5 md:py-2 text-xs md:text-sm border border-gray-200 rounded-lg md:rounded-xl bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                                >
                                                    <option value="all">전체 채널</option>
                                                    <option value="kakao">카카오톡</option>
                                                    <option value="naver">네이버톡톡</option>
                                                    <option value="widget">위젯</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] md:text-[11px] font-medium text-gray-600 md:text-gray-700 mb-1 md:mb-1.5">
                                                    카테고리
                                                </label>
                                                <select
                                                    value={filters.category}
                                                    onChange={(e) => {
                                                        setFilters({
                                                            ...filters,
                                                            category: e.target.value,
                                                        });
                                                        setCurrentPage(1);
                                                    }}
                                                    style={{ fontSize: '16px' }} // 모바일 화면 확대 방지
                                                    className="w-full px-2.5 md:px-3 py-1.5 md:py-2 text-xs md:text-sm border border-gray-200 rounded-lg md:rounded-xl bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                                >
                                                    <option value="all">전체 카테고리</option>
                                                    {availableCategories.map((cat) => (
                                                        <option key={cat} value={cat}>
                                                            {cat}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 md:gap-2.5">
                                            <div>
                                                <label className="block text-[10px] md:text-[11px] font-medium text-gray-600 md:text-gray-700 mb-1 md:mb-1.5">
                                                    시작일
                                                </label>
                                                <input
                                                    type="date"
                                                    value={filters.dateFrom}
                                                    onChange={(e) => {
                                                        setFilters({
                                                            ...filters,
                                                            dateFrom: e.target.value,
                                                        });
                                                        setCurrentPage(1);
                                                    }}
                                                    style={{ fontSize: '16px' }} // 모바일 화면 확대 방지
                                                    className="w-full px-2.5 md:px-3 py-1.5 md:py-2 text-xs md:text-sm border border-gray-200 rounded-lg md:rounded-xl bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[10px] md:text-[11px] font-medium text-gray-600 md:text-gray-700 mb-1 md:mb-1.5">
                                                    종료일
                                                </label>
                                                <input
                                                    type="date"
                                                    value={filters.dateTo}
                                                    onChange={(e) => {
                                                        setFilters({
                                                            ...filters,
                                                            dateTo: e.target.value,
                                                        });
                                                        setCurrentPage(1);
                                                    }}
                                                    style={{ fontSize: '16px' }} // 모바일 화면 확대 방지
                                                    className="w-full px-2.5 md:px-3 py-1.5 md:py-2 text-xs md:text-sm border border-gray-200 rounded-lg md:rounded-xl bg-white text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            onClick={resetFilters}
                                            className="w-full mt-1 px-3 py-1.5 md:py-2 bg-gray-100 md:bg-gray-200 text-gray-700 rounded-lg md:rounded-xl hover:bg-gray-200 md:hover:bg-gray-300 transition-colors text-xs md:text-sm font-medium"
                                        >
                                            필터 초기화
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 리스트 영역 */}
                        <div
                            className="flex-1 overflow-y-auto px-3 py-3"
                            style={{
                                WebkitOverflowScrolling: 'touch',
                                touchAction: 'pan-y',
                                overscrollBehavior: 'contain',
                            }}
                            onTouchStart={(e) => {
                                // 터치 이벤트가 리스트 영역에서 시작되면 상위로 전파 방지
                                e.stopPropagation();
                            }}
                            onTouchMove={(e) => {
                                // 스크롤 중일 때는 상위로 전파 방지
                                e.stopPropagation();
                            }}
                        >
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
                                            onClick={() => setSelectedConv(conv)}
                                            isSelected={selectedConv?.id === conv.id}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 페이지네이션 */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-gray-200">
                                <button
                                    onClick={() =>
                                        setCurrentPage((prev) => Math.max(1, prev - 1))
                                    }
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

                    {/* 우측: 대화 상세 (웹 전용) */}
                    <div className="hidden lg:flex flex-1 bg-gray-50 overflow-hidden">
                        {selectedConv ? (
                            <ConversationDetail
                                conversation={selectedConv}
                                tenantId={tenantId}
                                onClose={() => setSelectedConv(null)}
                                onSend={handleSend}
                                onOpenAICorrector={() => setShowAIModal(true)}
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
                </>
            )}

            {/* 모바일: 대화 상세 모달 */}
            {selectedConv && (
                <div className="lg:hidden z-[100]">
                    <ConversationDetail
                        conversation={selectedConv}
                        tenantId={tenantId}
                        onClose={() => setSelectedConv(null)}
                        onSend={handleSend}
                        onOpenAICorrector={() => setShowAIModal(true)}
                        isEmbedded={false}
                        libraryData={libraryData}
                    />
                </div>
            )}

            {/* AI 보정 모달 */}
            {showAIModal && selectedConv && (
                <AIComposerModal
                    conversation={selectedConv}
                    tenantId={tenantId}
                    planName="business"
                    libraryData={libraryData} // ✅ 라이브러리 데이터 전달
                    onClose={() => setShowAIModal(false)}
                    onSend={handleAISend}
                />
            )}

            {/* 스크롤바 숨김 스타일 */}
            <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        /* 드롭다운 스타일 개선 */
        select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.75rem center;
          background-size: 0.75rem;
          padding-right: 2rem;
        }
        @media (min-width: 768px) {
          select {
            background-size: 0.875rem;
            padding-right: 2.25rem;
          }
        }
      `}</style>
        </div>
    );
}
