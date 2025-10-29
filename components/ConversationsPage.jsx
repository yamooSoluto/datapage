// components/ConversationsPage.jsx
// 검색, 필터, 페이지네이션이 포함된 대화 목록 페이지
// 애플 스타일 - 깔끔하고 직관적

import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import ConversationCard from './ConversationCard';
import ConversationDetail from './ConversationDetail';

export default function ConversationsPage({ tenantId }) {
    const [conversations, setConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [loading, setLoading] = useState(false);

    // 필터 & 검색
    const [filters, setFilters] = useState({
        status: 'all',
        channel: 'all',
        dateFrom: '',
        dateTo: '',
    });
    const [searchQuery, setSearchQuery] = useState('');

    // 페이지네이션
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // 데이터 로드
    useEffect(() => {
        fetchConversations();
    }, [tenantId]);

    const fetchConversations = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                tenant: tenantId,
                limit: 500,
            });

            const res = await fetch(`/api/conversations/list?${params}`);
            const data = await res.json();
            setConversations(data.conversations || []);
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    // 필터링 & 검색 로직
    const filteredConversations = useMemo(() => {
        let result = [...conversations];

        // 상태 필터
        if (filters.status !== 'all') {
            result = result.filter(c => c.status === filters.status);
        }

        // 채널 필터
        if (filters.channel !== 'all') {
            result = result.filter(c => c.channel === filters.channel);
        }

        // 날짜 필터
        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            result = result.filter(c => {
                const convDate = new Date(c.lastMessageAt);
                return convDate >= fromDate;
            });
        }
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59);
            result = result.filter(c => {
                const convDate = new Date(c.lastMessageAt);
                return convDate <= toDate;
            });
        }

        // 검색 (사용자 이름 + 메시지 내용)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(c =>
                c.userName?.toLowerCase().includes(query) ||
                c.lastMessageText?.toLowerCase().includes(query) ||
                c.chatId?.toLowerCase().includes(query)
            );
        }

        return result;
    }, [conversations, filters, searchQuery]);

    // 페이지네이션
    const totalPages = Math.ceil(filteredConversations.length / itemsPerPage);
    const paginatedConversations = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        return filteredConversations.slice(start, end);
    }, [filteredConversations, currentPage, itemsPerPage]);

    // 페이지 변경 시 맨 위로 스크롤
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentPage]);

    // 필터 초기화
    const resetFilters = () => {
        setFilters({
            status: 'all',
            channel: 'all',
            dateFrom: '',
            dateTo: '',
        });
        setSearchQuery('');
        setCurrentPage(1);
    };

    return (
        <div className="space-y-4">
            {/* 검색 바 */}
            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        placeholder="이름, 메시지 내용 검색..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white/70 backdrop-blur-sm rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                    />
                </div>
                <button
                    onClick={fetchConversations}
                    disabled={loading}
                    className="p-2.5 bg-white/70 hover:bg-white rounded-xl transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* 필터 바 */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
                {/* 상태 필터 */}
                <select
                    value={filters.status}
                    onChange={(e) => {
                        setFilters({ ...filters, status: e.target.value });
                        setCurrentPage(1);
                    }}
                    className="px-3 py-2 bg-white/70 border-0 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                    <option value="all">전체 상태</option>
                    <option value="waiting">대기중</option>
                    <option value="in_progress">진행중</option>
                    <option value="resolved">해결됨</option>
                </select>

                {/* 채널 필터 */}
                <select
                    value={filters.channel}
                    onChange={(e) => {
                        setFilters({ ...filters, channel: e.target.value });
                        setCurrentPage(1);
                    }}
                    className="px-3 py-2 bg-white/70 border-0 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                    <option value="all">전체 채널</option>
                    <option value="widget">💬 위젯</option>
                    <option value="naver">🟢 네이버</option>
                    <option value="kakao">💛 카카오</option>
                    <option value="channeltalk_kakao">📱 채널톡(카카오)</option>
                    <option value="channeltalk_naver">📱 채널톡(네이버)</option>
                </select>

                {/* 날짜 필터 */}
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => {
                            setFilters({ ...filters, dateFrom: e.target.value });
                            setCurrentPage(1);
                        }}
                        className="px-3 py-2 bg-white/70 border-0 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-400">~</span>
                    <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => {
                            setFilters({ ...filters, dateTo: e.target.value });
                            setCurrentPage(1);
                        }}
                        className="px-3 py-2 bg-white/70 border-0 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* 초기화 버튼 */}
                {(filters.status !== 'all' || filters.channel !== 'all' || filters.dateFrom || filters.dateTo || searchQuery) && (
                    <button
                        onClick={resetFilters}
                        className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                    >
                        초기화
                    </button>
                )}

                {/* 개수 선택 */}
                <select
                    value={itemsPerPage}
                    onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                    }}
                    className="ml-auto px-3 py-2 bg-white/70 border-0 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                    <option value={10}>10개씩</option>
                    <option value={20}>20개씩</option>
                    <option value={50}>50개씩</option>
                    <option value={100}>100개씩</option>
                </select>
            </div>

            {/* 대화 목록 */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-200 border-t-blue-600" />
                </div>
            ) : paginatedConversations.length === 0 ? (
                <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-16 text-center">
                    <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">
                        {searchQuery || filters.status !== 'all' || filters.channel !== 'all'
                            ? '검색 결과가 없습니다'
                            : '대화 내역이 없습니다'}
                    </p>
                </div>
            ) : (
                <>
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

                    {/* 페이지네이션 */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-8">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg hover:bg-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>

                            <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(page => {
                                        if (page === 1 || page === totalPages) return true;
                                        if (Math.abs(page - currentPage) <= 1) return true;
                                        return false;
                                    })
                                    .map((page, idx, arr) => (
                                        <React.Fragment key={page}>
                                            {idx > 0 && arr[idx - 1] !== page - 1 && (
                                                <span className="px-2 text-gray-400">···</span>
                                            )}
                                            <button
                                                onClick={() => setCurrentPage(page)}
                                                className={`
                          min-w-[36px] h-9 rounded-lg font-medium text-sm transition-all
                          ${page === currentPage
                                                        ? 'bg-blue-600 text-white'
                                                        : 'text-gray-700 hover:bg-white/70'
                                                    }
                        `}
                                            >
                                                {page}
                                            </button>
                                        </React.Fragment>
                                    ))}
                            </div>

                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg hover:bg-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}

                    {/* 페이지 정보 */}
                    <p className="text-center text-sm text-gray-500 mt-4">
                        {filteredConversations.length}개 중 {((currentPage - 1) * itemsPerPage) + 1}-
                        {Math.min(currentPage * itemsPerPage, filteredConversations.length)}개 표시
                    </p>
                </>
            )}

            {/* 대화 상세 모달 */}
            {selectedConv && (
                <ConversationDetail
                    conversation={selectedConv}
                    onClose={() => setSelectedConv(null)}
                />
            )}
        </div>
    );
}