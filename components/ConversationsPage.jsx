// components/ConversationsPage.jsx
// CRM 메인 페이지 - 웹: 2-column 레이아웃 / 모바일: 모달 방식

import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, RefreshCw, X, User, Calendar, Filter, Sparkles as SparklesIcon, MessageSquare, Clock } from 'lucide-react';
import ConversationCard from './ConversationCard';
import ConversationDetail from './ConversationDetail';
import AIComposerModal from './AIComposerModal';

export default function ConversationsPage({ tenantId }) {
    const [conversations, setConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showAIModal, setShowAIModal] = useState(false);

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
    }, [tenantId]);

    // ✅ 웹에서 전체 스크롤 방지 (각 섹션만 스크롤 가능하도록)
    useEffect(() => {
        // body 스크롤 방지
        const originalBodyOverflow = document.body.style.overflow;
        const originalHtmlOverflow = document.documentElement.style.overflow;

        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        return () => {
            // 컴포넌트 언마운트 시 확실히 복원
            document.body.style.overflow = originalBodyOverflow || '';
            document.documentElement.style.overflow = originalHtmlOverflow || '';

            // 추가 안전장치: 명시적으로 auto로 설정
            if (!document.body.style.overflow) {
                document.body.style.overflow = 'auto';
            }
            if (!document.documentElement.style.overflow) {
                document.documentElement.style.overflow = 'auto';
            }
        };
    }, []);

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

    // 빠른 필터 적용
    const applyQuickFilter = (convs) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        switch (quickFilter) {
            case 'today':
                return convs.filter(c => new Date(c.lastMessageAt) >= today);

            case 'unanswered':
                return convs.filter(c => c.status === 'waiting' || !c.lastAgentMessage);

            case 'ai':
                return convs.filter(c => c.hasAIResponse);

            case 'agent':
                return convs.filter(c => c.hasAgentResponse);

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
            result = result.filter((c) => c.categories && c.categories.includes(filters.category));
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

        return result.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
    }, [conversations, filters, searchQuery, quickFilter]);

    const totalPages = Math.ceil(filteredConversations.length / itemsPerPage);
    const paginatedConversations = filteredConversations.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // 전송 핸들러
    const handleSend = async ({ text, attachments, tenantId: detailTenantId, chatId: detailChatId }) => {
        const effectiveTenantId = detailTenantId ||
            tenantId ||
            selectedConv?.tenant ||
            selectedConv?.tenantId ||
            (typeof selectedConv?.id === 'string' && selectedConv.id.includes('_')
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

    return (
        <div className="fixed inset-0 flex bg-gray-50 overflow-hidden">
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
                    <div className="flex flex-col w-full lg:w-[400px] xl:w-[450px] border-r border-gray-200 bg-white h-full max-h-full overflow-hidden">
                        {/* 좌측 헤더 */}
                        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                                <h1 className="text-xl font-bold text-gray-900">대화 관리</h1>
                                <button
                                    onClick={() => fetchConversations()}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="새로고침"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                </button>
                            </div>

                            {/* 검색 */}
                            <div className="relative mb-3">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="이름, 내용 검색..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ fontSize: '16px' }}
                                    className="w-full pl-9 pr-9 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900 placeholder-gray-400"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* 빠른 필터 */}
                            <div className="flex flex-wrap gap-2 mb-3">
                                {[
                                    { key: 'all', label: '전체', icon: MessageSquare },
                                    { key: 'today', label: '오늘', icon: Clock },
                                ].map(({ key, label, icon: Icon }) => (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            setQuickFilter(key);
                                            setCurrentPage(1);
                                        }}
                                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${quickFilter === key
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* 상세 필터 토글 - 더 눈에 띄게 */}
                            <button
                                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all w-full ${showAdvancedFilters
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                <Filter className="w-3.5 h-3.5" />
                                {showAdvancedFilters ? '필터 숨기기' : '상세 필터'}
                            </button>

                            {/* 고급 필터 */}
                            {showAdvancedFilters && (
                                <div className="mt-3 space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">채널</label>
                                        <select
                                            value={filters.channel}
                                            onChange={(e) => {
                                                setFilters({ ...filters, channel: e.target.value });
                                                setCurrentPage(1);
                                            }}
                                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-xs"
                                        >
                                            <option value="all">전체 채널</option>
                                            <option value="kakao">카카오톡</option>
                                            <option value="naver">네이버톡톡</option>
                                            <option value="widget">위젯</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">카테고리</label>
                                        <select
                                            value={filters.category}
                                            onChange={(e) => {
                                                setFilters({ ...filters, category: e.target.value });
                                                setCurrentPage(1);
                                            }}
                                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-xs"
                                        >
                                            <option value="all">전체 카테고리</option>
                                            {availableCategories.map((cat) => (
                                                <option key={cat} value={cat}>
                                                    {cat}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">시작일</label>
                                        <input
                                            type="date"
                                            value={filters.dateFrom}
                                            onChange={(e) => {
                                                setFilters({ ...filters, dateFrom: e.target.value });
                                                setCurrentPage(1);
                                            }}
                                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-xs"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 mb-1">종료일</label>
                                        <input
                                            type="date"
                                            value={filters.dateTo}
                                            onChange={(e) => {
                                                setFilters({ ...filters, dateTo: e.target.value });
                                                setCurrentPage(1);
                                            }}
                                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-xs"
                                        />
                                    </div>

                                    <button
                                        onClick={resetFilters}
                                        className="w-full px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-xs font-medium"
                                    >
                                        필터 초기화
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 리스트 영역 */}
                        <div className="flex-1 overflow-y-auto px-3 py-3 pb-safe">
                            {paginatedConversations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12">
                                    <User className="w-12 h-12 mb-4 opacity-50" />
                                    <p className="text-sm font-medium">대화가 없습니다</p>
                                    <p className="text-xs text-gray-400 mt-1">필터를 변경해보세요</p>
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
                                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 우측: 대화 상세 (웹 전용) */}
                    <div className="hidden lg:flex flex-1 bg-gray-50 overflow-hidden h-full">
                        {selectedConv ? (
                            <ConversationDetail
                                conversation={selectedConv}
                                tenantId={tenantId}
                                onClose={() => setSelectedConv(null)}
                                onSend={handleSend}
                                onOpenAICorrector={() => setShowAIModal(true)}
                                isEmbedded={true}
                            />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 h-full">
                                <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
                                <p className="text-lg font-medium">대화를 선택해주세요</p>
                                <p className="text-sm mt-2">좌측 리스트에서 대화를 클릭하면 내용을 확인할 수 있습니다</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* 모바일: 대화 상세 모달 */}
            {selectedConv && (
                <div className="lg:hidden">
                    <ConversationDetail
                        conversation={selectedConv}
                        tenantId={tenantId}
                        onClose={() => setSelectedConv(null)}
                        onSend={handleSend}
                        onOpenAICorrector={() => setShowAIModal(true)}
                        isEmbedded={false}
                    />
                </div>
            )}

            {/* AI 보정 모달 */}
            {showAIModal && selectedConv && (
                <AIComposerModal
                    conversation={selectedConv}
                    tenantId={tenantId}
                    planName="business"
                    onClose={() => setShowAIModal(false)}
                    onSend={handleAISend}
                />
            )}

            {/* 스크롤바 숨김 스타일 및 하단 탭 여백 */}
            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                /* 모바일 하단 탭 높이만큼 여백 추가 */
                @media (max-width: 768px) {
                    .pb-safe {
                        padding-bottom: calc(60px + env(safe-area-inset-bottom));
                    }
                }
            `}</style>
        </div>
    );
}