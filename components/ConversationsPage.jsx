// components/ConversationsPage.jsx
// 기존 작동 로직 유지 + 아이폰 메시지 스타일 디자인 적용

import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, RefreshCw, X, ExternalLink, User, Bot, UserCheck, Send, Wand2, ZoomIn } from 'lucide-react';
import ConversationCard from './ConversationCard';
import ConversationDetail from './ConversationDetail';

export default function ConversationsPage({ tenantId }) {
    const [conversations, setConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [detailData, setDetailData] = useState(null);
    const [loading, setLoading] = useState(false);

    const [filters, setFilters] = useState({
        channel: 'all',
        category: 'all',
        dateFrom: '',
        dateTo: '',
    });
    const [searchQuery, setSearchQuery] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const availableCategories = [
        '결제/환불',
        '예약/변경',
        '이용/시설',
        '상품/서비스',
        '시스템/오류',
        '건의/요청',
        '이벤트/쿠폰',
        '기타'
    ];

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
            console.error('대화 목록 조회 실패:', error);
            setConversations([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchConversationDetail = async (conv) => {
        if (!tenantId || !conv.chatId) return;

        setSelectedConv(conv);
        setLoading(true);

        try {
            const res = await fetch(`/api/conversations/detail?tenant=${tenantId}&chatId=${conv.chatId}`);
            const data = await res.json();
            if (data.error) {
                console.error('❌ 대화 상세 조회 실패:', data.error);
                setDetailData(null);
                return;
            }
            setDetailData(data);
        } catch (error) {
            console.error('❌ 대화 상세 조회 에러:', error);
            setDetailData(null);
        } finally {
            setLoading(false);
        }
    };

    // 메시지 전송 후 새로고침 (추가된 기능)
    const refreshDetail = async (conv) => {
        if (!tenantId || !conv.chatId) return;

        try {
            const res = await fetch(`/api/conversations/detail?tenant=${tenantId}&chatId=${conv.chatId}`);
            const data = await res.json();
            if (!data.error) {
                setDetailData(data);
                // 목록도 새로고침
                await fetchConversations();
            }
        } catch (error) {
            console.error('❌ 새로고침 에러:', error);
        }
    };

    const closeDetail = () => {
        setSelectedConv(null);
        setDetailData(null);
    };

    const filteredConversations = useMemo(() => {
        let result = [...conversations];

        if (filters.channel !== 'all') {
            result = result.filter(c => c.channel === filters.channel);
        }

        if (filters.category !== 'all') {
            result = result.filter(c =>
                c.categories && c.categories.includes(filters.category)
            );
        }

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

    const paginatedConversations = useMemo(() => {
        const startIdx = (currentPage - 1) * itemsPerPage;
        return filteredConversations.slice(startIdx, startIdx + itemsPerPage);
    }, [filteredConversations, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredConversations.length / itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [filters, searchQuery]);

    return (
        <div className="min-h-screen bg-gray-50 py-6">
            <div className="max-w-7xl mx-auto px-4">
                {/* 헤더 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">대화 관리</h1>
                            <p className="text-sm text-gray-500 mt-1">
                                총 {filteredConversations.length}개의 대화
                            </p>
                        </div>
                        <button
                            onClick={fetchConversations}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            새로고침
                        </button>
                    </div>

                    {/* 필터 영역 */}
                    <div className="space-y-4">
                        {/* 검색바 */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="사용자 이름, 메시지, 대화 ID 검색..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* 필터 옵션들 */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <select
                                value={filters.channel}
                                onChange={(e) => setFilters(prev => ({ ...prev, channel: e.target.value }))}
                                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">모든 채널</option>
                                <option value="naver">네이버</option>
                                <option value="kakao">카카오</option>
                                <option value="widget">웹 위젯</option>
                                <option value="unknown">기타</option>
                            </select>

                            <select
                                value={filters.category}
                                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">모든 카테고리</option>
                                {availableCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>

                            <input
                                type="date"
                                value={filters.dateFrom}
                                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />

                            <input
                                type="date"
                                value={filters.dateTo}
                                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* 대화 목록 */}
                {loading && conversations.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
                        <div className="flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-200 border-t-blue-600 mb-4" />
                            <p className="text-gray-500">대화 목록을 불러오는 중...</p>
                        </div>
                    </div>
                ) : filteredConversations.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
                        <div className="text-center">
                            <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">검색 결과가 없습니다</p>
                            <button
                                onClick={() => {
                                    setFilters({ channel: 'all', category: 'all', dateFrom: '', dateTo: '' });
                                    setSearchQuery('');
                                }}
                                className="mt-4 text-sm text-blue-600 hover:text-blue-700"
                            >
                                필터 초기화
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="space-y-3">
                            {paginatedConversations.map((conv) => (
                                <div
                                    key={conv.id}
                                    onClick={() => fetchConversationDetail(conv)}
                                    className="cursor-pointer"
                                >
                                    <ConversationCard conversation={conv} />
                                </div>
                            ))}
                        </div>

                        {/* 페이지네이션 */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-6">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                    이전
                                </button>

                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">
                                        페이지 {currentPage} / {totalPages}
                                    </span>
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
                            {filteredConversations.length}개 중 {((currentPage - 1) * itemsPerPage) + 1}-
                            {Math.min(currentPage * itemsPerPage, filteredConversations.length)}개 표시
                        </p>
                    </>
                )}

                {/* 대화 상세 모달 - onRefresh 추가 */}
                {selectedConv && detailData && (
                    <ConversationDetail
                        conversation={selectedConv}
                        detailData={detailData}
                        onClose={closeDetail}
                        onRefresh={refreshDetail}
                    />
                )}
            </div>
        </div>
    );
}