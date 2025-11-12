// components/ConversationsPage.jsx
// 애플 스타일 - 깔끔하고 직관적인 대화 목록 페이지 (기존 기능 그대로 + 답장 모달 연동)

import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, RefreshCw, X, User } from 'lucide-react';
import ConversationCard from './ConversationCard';
import ConversationDetail from './ConversationDetail';

export default function ConversationsPage({ tenantId }) {
    const [conversations, setConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [loading, setLoading] = useState(false);

    const [filters, setFilters] = useState({
        channel: 'all',
        category: 'all',
        dateFrom: '',
        dateTo: '',
    });
    const [searchQuery, setSearchQuery] = useState('');

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const filteredConversations = useMemo(() => {
        let result = [...conversations];

        if (filters.channel !== 'all') {
            result = result.filter((c) => c.channel === filters.channel);
        }

        if (filters.category !== 'all') {
            result = result.filter((c) => c.categories && c.categories.includes(filters.category));
        }

        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            result = result.filter((c) => new Date(c.lastMessageAt) >= fromDate);
        }
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59);
            result = result.filter((c) => new Date(c.lastMessageAt) <= toDate);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (c) =>
                    c.userName?.toLowerCase().includes(q) ||
                    c.lastMessageText?.toLowerCase().includes(q) ||
                    c.chatId?.toLowerCase().includes(q)
            );
        }

        return result;
    }, [conversations, filters, searchQuery]);

    const totalPages = Math.ceil(filteredConversations.length / itemsPerPage);
    const paginatedConversations = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        return filteredConversations.slice(start, end);
    }, [filteredConversations, currentPage, itemsPerPage]);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentPage]);

    const resetFilters = () => {
        setFilters({ channel: 'all', category: 'all', dateFrom: '', dateTo: '' });
        setSearchQuery('');
        setCurrentPage(1);
    };

    // 상세 모달 → 전송 핸들러
    const handleSend = async ({ text, attachments }) => {
        if (!selectedConv) return;

        // ✅ tenantId prop을 최우선 사용, 대화 객체의 tenant/tenantId로 폴백
        const tenant =
            tenantId ||
            selectedConv.tenant ||
            selectedConv.tenantId ||
            (typeof selectedConv.id === 'string' && selectedConv.id.includes('_')
                ? selectedConv.id.split('_')[0]
                : null) ||
            'default';

        const form = new FormData();
        form.append('tenant', tenant);
        form.append('chatId', selectedConv.chatId);
        form.append('text', text || '');

        attachments?.forEach((att, i) => {
            if (att?.file) form.append('files[]', att.file, att.file.name || `file-${i}`);
        });

        const res = await fetch('/api/conversations/send', {
            method: 'POST',
            body: form,
        });

        if (!res.ok) {
            const msg = await res.text().catch(() => '');
            throw new Error(`send failed: ${res.status} ${msg}`);
        }
        // 성공 시 상세 모달 내부에서 fetchDetail() 재호출됨
    };

    return (
        <div className="space-y-6">
            {/* 검색 바 */}
            <div className="flex gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        placeholder="이름, 메시지 내용 검색..."
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    />
                </div>
                <button
                    onClick={fetchConversations}
                    disabled={loading}
                    className="p-3 bg-white border border-gray-200 hover:border-gray-300 rounded-xl transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* 필터 바 */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
                {/* 카테고리 필터 */}
                <select
                    value={filters.category}
                    onChange={(e) => {
                        setFilters({ ...filters, category: e.target.value });
                        setCurrentPage(1);
                    }}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-yellow-400 cursor-pointer"
                >
                    <option value="all">전체 카테고리</option>
                    {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>
                            {cat}
                        </option>
                    ))}
                </select>

                {/* 채널 필터 */}
                <select
                    value={filters.channel}
                    onChange={(e) => {
                        setFilters({ ...filters, channel: e.target.value });
                        setCurrentPage(1);
                    }}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-yellow-400 cursor-pointer"
                >
                    <option value="all">전체 채널</option>
                    <option value="widget">위젯</option>
                    <option value="naver">네이버</option>
                    <option value="kakao">카카오</option>
                </select>

                {/* 날짜 필터 */}
                <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => {
                        setFilters({ ...filters, dateFrom: e.target.value });
                        setCurrentPage(1);
                    }}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
                <span className="text-gray-400">~</span>
                <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => {
                        setFilters({ ...filters, dateTo: e.target.value });
                        setCurrentPage(1);
                    }}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />

                {/* 필터 초기화 */}
                {(filters.channel !== 'all' || filters.category !== 'all' || filters.dateFrom || filters.dateTo || searchQuery) && (
                    <button
                        onClick={resetFilters}
                        className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                        <X className="w-4 h-4" />
                        초기화
                    </button>
                )}
            </div>

            {/* 대화 리스트 */}
            {loading && conversations.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-yellow-400" />
                </div>
            ) : paginatedConversations.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
                    <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">{searchQuery || filters.channel !== 'all' || filters.category !== 'all' ? '검색 결과가 없습니다' : '대화가 없습니다'}</p>
                </div>
            ) : (
                <>
                    {/* 카드 그리드(기존 유지) */}
                    <div className="space-y-3">
                        {paginatedConversations.map((conv) => (
                            <ConversationCard
                                key={conv.id || conv.chatId}
                                conversation={conv}
                                onClick={() => setSelectedConv({ ...conv, tenant: tenantId /* ✅ tenant 주입 */ })}
                                isSelected={(selectedConv?.id || selectedConv?.chatId) === (conv.id || conv.chatId)}
                            />
                        ))}
                    </div>

                    {/* 페이지네이션 */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-6">
                            <button
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                                이전
                            </button>

                            <div className="text-sm text-gray-600">페이지 {currentPage} / {totalPages}</div>

                            <button
                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                다음
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {/* 페이지 정보 */}
                    <p className="text-center text-sm text-gray-500 mt-4">
                        {filteredConversations.length}개 중 {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredConversations.length)}개 표시
                    </p>
                </>
            )}

            {/* 상세 모달 (답장 가능) */}
            {selectedConv && (
                <ConversationDetail
                    conversation={selectedConv}
                    tenantId={tenantId}
                    onClose={() => setSelectedConv(null)}
                    onSend={handleSend}
                    onOpenAICorrector={() => console.log('open AI corrector modal')}
                />
            )}
        </div>
    );
}
