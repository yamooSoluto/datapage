// components/ConversationsPage.jsx
// CRM 메인 페이지 - 모바일 최적화 + 빠른 필터

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

    const fetchConversations = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ tenant: tenantId || '', limit: 500 });
            const res = await fetch(`/api/conversations/list?${params}`);
            const data = await res.json();
            setConversations(data.conversations || []);
            setCurrentPage(1);
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
        } finally {
            setLoading(false);
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
                // TODO: 실제 답변 여부 확인 로직
                return convs.filter(c => c.status === 'waiting' || !c.lastAgentMessage);

            case 'ai':
                // TODO: AI 자동 답변한 대화
                return convs.filter(c => c.hasAIResponse);

            case 'agent':
                // TODO: 상담사가 답변한 대화
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

    // ✅ 상세 모달 → 전송 핸들러 (ConversationDetail에서 전달하는 형식에 맞춤)
    const handleSend = async ({ text, attachments, tenantId: detailTenantId, chatId: detailChatId }) => {
        // ✅ 디버깅: 입력값 확인
        console.log('[ConversationsPage] handleSend called with:', {
            detailTenantId,
            propTenantId: tenantId,
            selectedConvTenant: selectedConv?.tenant,
            selectedConvTenantId: selectedConv?.tenantId,
            selectedConvId: selectedConv?.id,
            detailChatId,
            selectedConvChatId: selectedConv?.chatId,
        });

        // ✅ tenantId 우선순위: ConversationDetail에서 전달한 값 > prop > selectedConv에서 추출
        const effectiveTenantId = detailTenantId ||
            tenantId ||
            selectedConv?.tenant ||
            selectedConv?.tenantId ||
            (typeof selectedConv?.id === 'string' && selectedConv.id.includes('_')
                ? selectedConv.id.split('_')[0]
                : null);

        // ✅ chatId: ConversationDetail에서 전달한 값 > selectedConv
        const effectiveChatId = detailChatId || selectedConv?.chatId;

        if (!effectiveChatId) {
            console.error('[ConversationsPage] No chatId found');
            throw new Error('대화 ID를 찾을 수 없습니다');
        }

        if (!effectiveTenantId) {
            console.error('[ConversationsPage] No tenantId found:', {
                detailTenantId,
                propTenantId: tenantId,
                selectedConv,
            });
            throw new Error('테넌트 ID를 찾을 수 없습니다');
        }

        console.log('[ConversationsPage] Sending message:', {
            tenantId: effectiveTenantId,
            chatId: effectiveChatId,
            textLength: text?.length,
            attachmentsCount: attachments?.length || 0
        });

        try {
            const response = await fetch('/api/conversations/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: effectiveTenantId, // ✅ tenantId로 변경
                    chatId: effectiveChatId, // ✅ 전달받은 chatId 사용
                    content: text || '', // ✅ content로 변경
                    attachments: Array.isArray(attachments) ? attachments : [], // ✅ attachments로 변경
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Failed to send message');
            }

            console.log('[ConversationsPage] Message sent successfully');

            // 대화 목록 새로고침
            await fetchConversations();

            // 선택된 대화 상세 새로고침
            if (selectedConv?.chatId) {
                const detailRes = await fetch(`/api/conversations/detail?tenant=${tenantId}&chatId=${selectedConv.chatId}`);
                const detailData = await detailRes.json();
                setSelectedConv(detailData.conversation);
            }
        } catch (error) {
            console.error('[ConversationsPage] Send error:', error);
            throw error;
        }
    };

    // ✅ AI 모달에서 전송 처리
    const handleAISend = async (text) => {
        if (!selectedConv) {
            console.error('[ConversationsPage] No conversation selected for AI send');
            return;
        }

        // ✅ tenantId 추출
        const effectiveTenantId = tenantId ||
            selectedConv?.tenant ||
            selectedConv?.tenantId ||
            (typeof selectedConv?.id === 'string' && selectedConv.id.includes('_')
                ? selectedConv.id.split('_')[0]
                : null);

        if (!effectiveTenantId) {
            console.error('[ConversationsPage] No tenantId found for AI send');
            throw new Error('테넌트 ID를 찾을 수 없습니다');
        }

        const effectiveChatId = selectedConv?.chatId || selectedConv?.id;

        if (!effectiveChatId) {
            console.error('[ConversationsPage] No chatId found for AI send');
            throw new Error('대화 ID를 찾을 수 없습니다');
        }

        console.log('[ConversationsPage] AI send:', {
            tenantId: effectiveTenantId,
            chatId: effectiveChatId,
            textPreview: text?.substring(0, 50)
        });

        // ✅ 객체 방식으로 호출 (tenantId와 chatId 포함)
        await handleSend({
            text: text || '',
            attachments: [],
            tenantId: effectiveTenantId,
            chatId: effectiveChatId,
        });
        setShowAIModal(false);
    };

    // 오늘 빠른 필터
    const setTodayFilter = () => {
        setQuickFilter('today');
        setCurrentPage(1);
    };

    const resetFilters = () => {
        setQuickFilter('all');
        setFilters({ channel: 'all', category: 'all', dateFrom: '', dateTo: '' });
        setSearchQuery('');
        setCurrentPage(1);
    };

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* 헤더 - 모바일 최적화 */}
            <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="px-4 sm:px-6 py-4">
                    {/* 상단: 제목 + 새로고침 */}
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">고객 문의</h1>
                            <p className="text-xs sm:text-sm text-gray-500 mt-1">
                                전체 {filteredConversations.length}건
                            </p>
                        </div>
                        <button
                            onClick={fetchConversations}
                            disabled={loading}
                            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm sm:text-base"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">새로고침</span>
                        </button>
                    </div>

                    {/* 빠른 필터 - 가로 스크롤 */}
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
                        <button
                            onClick={() => { setQuickFilter('all'); setCurrentPage(1); }}
                            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${quickFilter === 'all'
                                ? 'bg-blue-500 text-white shadow-md'
                                : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            전체
                        </button>
                        <button
                            onClick={setTodayFilter}
                            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${quickFilter === 'today'
                                ? 'bg-green-500 text-white shadow-md'
                                : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <Calendar className="w-4 h-4" />
                            오늘
                        </button>
                        <button
                            onClick={() => { setQuickFilter('unanswered'); setCurrentPage(1); }}
                            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${quickFilter === 'unanswered'
                                ? 'bg-orange-500 text-white shadow-md'
                                : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <Clock className="w-4 h-4" />
                            미답변
                        </button>
                        <button
                            onClick={() => { setQuickFilter('ai'); setCurrentPage(1); }}
                            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${quickFilter === 'ai'
                                ? 'bg-purple-500 text-white shadow-md'
                                : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <SparklesIcon className="w-4 h-4" />
                            AI 답변
                        </button>
                        <button
                            onClick={() => { setQuickFilter('agent'); setCurrentPage(1); }}
                            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${quickFilter === 'agent'
                                ? 'bg-indigo-500 text-white shadow-md'
                                : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <MessageSquare className="w-4 h-4" />
                            상담사 답변
                        </button>
                    </div>

                    {/* 검색 */}
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="고객명, 내용, 채팅ID 검색..."
                            className="w-full pl-10 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 text-gray-900 placeholder-gray-400 text-sm sm:text-base"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setCurrentPage(1);
                                }}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {/* 고급 필터 토글 */}
                    <button
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        <Filter className="w-4 h-4" />
                        {showAdvancedFilters ? '필터 숨기기' : '상세 필터'}
                    </button>

                    {/* 고급 필터 - 세로 배치 (모바일 최적화) */}
                    {showAdvancedFilters && (
                        <div className="mt-4 space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">채널</label>
                                <select
                                    value={filters.channel}
                                    onChange={(e) => {
                                        setFilters({ ...filters, channel: e.target.value });
                                        setCurrentPage(1);
                                    }}
                                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900 text-sm"
                                >
                                    <option value="all">전체 채널</option>
                                    <option value="kakao">카카오톡</option>
                                    <option value="naver">네이버톡톡</option>
                                    <option value="widget">위젯</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">카테고리</label>
                                <select
                                    value={filters.category}
                                    onChange={(e) => {
                                        setFilters({ ...filters, category: e.target.value });
                                        setCurrentPage(1);
                                    }}
                                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900 text-sm"
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
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">시작일</label>
                                <input
                                    type="date"
                                    value={filters.dateFrom}
                                    onChange={(e) => {
                                        setFilters({ ...filters, dateFrom: e.target.value });
                                        setCurrentPage(1);
                                    }}
                                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900 text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">종료일</label>
                                <input
                                    type="date"
                                    value={filters.dateTo}
                                    onChange={(e) => {
                                        setFilters({ ...filters, dateTo: e.target.value });
                                        setCurrentPage(1);
                                    }}
                                    className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-900 text-sm"
                                />
                            </div>

                            <button
                                onClick={resetFilters}
                                className="w-full px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                            >
                                필터 초기화
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* 대화 목록 */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                        <p className="text-gray-600">대화 목록을 불러오는 중...</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                        {paginatedConversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                <User className="w-12 h-12 mb-4 opacity-50" />
                                <p className="text-lg font-medium">대화가 없습니다</p>
                                <p className="text-sm text-gray-400 mt-2">필터를 변경하거나 검색어를 확인해주세요</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                                {paginatedConversations.map((conv) => (
                                    <ConversationCard
                                        key={conv.id}
                                        conversation={conv}
                                        onClick={() => setSelectedConv(conv)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 페이지네이션 */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 px-4 sm:px-6 py-4 bg-white border-t border-gray-200">
                            <button
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border-2 border-gray-200 rounded-lg hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                            >
                                <ChevronLeft className="w-5 h-5" />
                                <span className="hidden sm:inline">이전</span>
                            </button>

                            <div className="text-sm font-medium text-gray-700">
                                {currentPage} / {totalPages}
                            </div>

                            <button
                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border-2 border-gray-200 rounded-lg hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                            >
                                <span className="hidden sm:inline">다음</span>
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* 대화 상세 모달 */}
            {selectedConv && (
                <ConversationDetail
                    conversation={selectedConv}
                    tenantId={tenantId}
                    onClose={() => setSelectedConv(null)}
                    onSend={handleSend}
                    onOpenAICorrector={() => setShowAIModal(true)}
                />
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

            {/* 스크롤바 숨김 스타일 */}
            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}