// components/ConversationsPage.jsx
// 검색, 필터, 페이지네이션이 포함된 대화 목록 페이지
// 애플 스타일 - 깔끔하고 직관적
// ✅ 카테고리 필터 추가, status 필터 제거

import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, RefreshCw, X, ExternalLink, User, Bot, UserCheck } from 'lucide-react';
import ConversationCard from './ConversationCard';

export default function ConversationsPage({ tenantId }) {
    const [conversations, setConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [detailData, setDetailData] = useState(null);
    const [loading, setLoading] = useState(false);

    // ✅ 필터 & 검색 (status 제거, category 추가)
    const [filters, setFilters] = useState({
        channel: 'all',
        category: 'all', // ✅ 카테고리 필터 추가
        dateFrom: '',
        dateTo: '',
    });
    const [searchQuery, setSearchQuery] = useState('');

    // 페이지네이션
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // ✅ 사용 가능한 카테고리 목록
    const availableCategories = [
        '불편사항',
        '오류',
        '결제',
        '건의',
        '문의',
        '칭찬',
        '기타'
    ];

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

    // 대화 상세 가져오기
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

    // 모달 닫기
    const closeDetail = () => {
        setSelectedConv(null);
        setDetailData(null);
    };

    // ✅ 필터링 & 검색 로직 (status 제거, category 추가)
    const filteredConversations = useMemo(() => {
        let result = [...conversations];

        // 채널 필터
        if (filters.channel !== 'all') {
            result = result.filter(c => c.channel === filters.channel);
        }

        // ✅ 카테고리 필터
        if (filters.category !== 'all') {
            result = result.filter(c =>
                c.categories && c.categories.includes(filters.category)
            );
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
            channel: 'all',
            category: 'all',
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

            {/* ✅ 필터 바 - status 제거, category 추가 */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2">
                {/* ✅ 카테고리 필터 */}
                <select
                    value={filters.category}
                    onChange={(e) => {
                        setFilters({ ...filters, category: e.target.value });
                        setCurrentPage(1);
                    }}
                    className="px-3 py-2 bg-white/70 border-0 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                    <option value="all">전체 카테고리</option>
                    {availableCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
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
                    <option value="widget">위젯</option>
                    <option value="naver">네이버톡톡</option>
                    <option value="kakao">카카오톡</option>
                    <option value="channeltalk_kakao">채널톡(카카오)</option>
                    <option value="channeltalk_naver">채널톡(네이버)</option>
                </select>

                {/* 날짜 필터 */}
                <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => {
                        setFilters({ ...filters, dateFrom: e.target.value });
                        setCurrentPage(1);
                    }}
                    className="px-3 py-2 bg-white/70 border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="시작일"
                />
                <span className="text-gray-400">~</span>
                <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => {
                        setFilters({ ...filters, dateTo: e.target.value });
                        setCurrentPage(1);
                    }}
                    className="px-3 py-2 bg-white/70 border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="종료일"
                />

                {/* 필터 초기화 버튼 */}
                {(filters.channel !== 'all' || filters.category !== 'all' || filters.dateFrom || filters.dateTo || searchQuery) && (
                    <button
                        onClick={resetFilters}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center gap-1"
                    >
                        <X className="w-4 h-4" />
                        초기화
                    </button>
                )}
            </div>

            {/* 통계 정보 */}
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                    <span className="text-gray-600">
                        전체 <span className="font-bold text-gray-900">{conversations.length}</span>건
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600">
                        필터 <span className="font-bold text-blue-600">{filteredConversations.length}</span>건
                    </span>
                </div>

                {/* 페이지당 개수 선택 */}
                <select
                    value={itemsPerPage}
                    onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                    }}
                    className="px-3 py-1.5 bg-white/70 border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                    <option value={10}>10개씩</option>
                    <option value={20}>20개씩</option>
                    <option value={50}>50개씩</option>
                    <option value={100}>100개씩</option>
                </select>
            </div>

            {/* 대화 목록 */}
            {loading && conversations.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600" />
                </div>
            ) : paginatedConversations.length === 0 ? (
                <div className="text-center py-20">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                        <Search className="w-10 h-10 text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-lg">검색 결과가 없습니다</p>
                    <button
                        onClick={resetFilters}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        필터 초기화
                    </button>
                </div>
            ) : (
                <>
                    <div className="space-y-2">
                        {paginatedConversations.map((conv) => (
                            <ConversationCard
                                key={conv.id}
                                conversation={conv}
                                onClick={() => fetchConversationDetail(conv)}
                                isSelected={selectedConv?.id === conv.id}
                            />
                        ))}
                    </div>

                    {/* 페이지네이션 */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg hover:bg-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>

                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 7) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 4) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPages - 3) {
                                        pageNum = totalPages - 6 + i;
                                    } else {
                                        pageNum = currentPage - 3 + i;
                                    }

                                    return (
                                        <React.Fragment key={pageNum}>
                                            {i === 0 && currentPage > 4 && totalPages > 7 && (
                                                <>
                                                    <button
                                                        onClick={() => setCurrentPage(1)}
                                                        className="min-w-[32px] h-8 rounded-lg hover:bg-white/70 transition-colors text-sm font-medium"
                                                    >
                                                        1
                                                    </button>
                                                    <span className="px-1 text-gray-400">...</span>
                                                </>
                                            )}
                                            <button
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`min-w-[32px] h-8 rounded-lg transition-colors text-sm font-medium ${currentPage === pageNum
                                                    ? 'bg-blue-600 text-white'
                                                    : 'hover:bg-white/70'
                                                    }`}
                                            >
                                                {pageNum}
                                            </button>
                                            {i === 6 && currentPage < totalPages - 3 && totalPages > 7 && (
                                                <>
                                                    <span className="px-1 text-gray-400">...</span>
                                                    <button
                                                        onClick={() => setCurrentPage(totalPages)}
                                                        className="min-w-[32px] h-8 rounded-lg hover:bg-white/70 transition-colors text-sm font-medium"
                                                    >
                                                        {totalPages}
                                                    </button>
                                                </>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
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
            {selectedConv && detailData && (
                <ConversationDetailModal
                    conversation={selectedConv}
                    detailData={detailData}
                    onClose={closeDetail}
                />
            )}
        </div>
    );
}

// 대화 상세 모달 컴포넌트
function ConversationDetailModal({ conversation, detailData, onClose }) {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-6 py-4 flex items-center justify-between border-b">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                            <span className="text-white text-sm font-semibold">
                                {conversation.userNameInitial || conversation.userName?.charAt(0) || '?'}
                            </span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">
                                {conversation.userName || '익명'}
                            </h2>
                            <p className="text-xs text-gray-500 font-mono">
                                {conversation.chatId}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                {/* 메시지 리스트 */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
                    {detailData.messages && detailData.messages.length > 0 ? (
                        <div className="space-y-3">
                            {detailData.messages.map((msg, idx) => (
                                <MessageBubble key={idx} message={msg} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            메시지가 없습니다
                        </div>
                    )}
                </div>

                {/* 통계 & 슬랙 링크 */}
                <div className="border-t bg-gray-50 px-6 py-4">
                    {detailData.stats && (
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-gray-800">{detailData.stats.userChats}</div>
                                <div className="text-xs text-gray-600 mt-1 flex items-center justify-center gap-1">
                                    <User className="w-3 h-3" />
                                    사용자
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">{detailData.stats.aiChats}</div>
                                <div className="text-xs text-gray-600 mt-1 flex items-center justify-center gap-1">
                                    <Bot className="w-3 h-3" />
                                    AI
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-600">{detailData.stats.agentChats}</div>
                                <div className="text-xs text-gray-600 mt-1 flex items-center justify-center gap-1">
                                    <UserCheck className="w-3 h-3" />
                                    상담원
                                </div>
                            </div>
                        </div>
                    )}

                    {detailData.slack?.slackUrl && (
                        <a
                            href={detailData.slack.slackUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all font-semibold shadow-lg hover:shadow-xl"
                        >
                            <ExternalLink className="w-4 h-4" />
                            슬랙에서 보기
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

// 메시지 버블 컴포넌트
function MessageBubble({ message }) {
    const senderConfig = {
        user: {
            bg: 'bg-gradient-to-br from-gray-100 to-gray-50',
            icon: '👤',
            label: '사용자',
        },
        ai: {
            bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50',
            icon: '🤖',
            label: 'AI',
        },
        agent: {
            bg: 'bg-gradient-to-br from-green-50 to-green-100/50',
            icon: '👨‍💼',
            label: '상담원',
        },
        admin: {
            bg: 'bg-gradient-to-br from-purple-50 to-purple-100/50',
            icon: '👨‍💼',
            label: '관리자',
        }
    }[message.sender] || {
        bg: 'bg-gray-50',
        icon: '❓',
        label: '알수없음',
    };

    return (
        <div className={`${senderConfig.bg} rounded-xl p-4 shadow-sm border border-gray-100/50`}>
            {/* 메시지 헤더 */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-700">
                        {senderConfig.icon} {senderConfig.label}
                    </span>
                    {message.modeSnapshot && (
                        <span className="text-xs px-2 py-0.5 bg-white/70 rounded-full text-gray-600 font-semibold">
                            {message.modeSnapshot}
                        </span>
                    )}
                </div>
                <span className="text-xs text-gray-500">
                    {message.timestamp
                        ? new Date(message.timestamp).toLocaleString('ko-KR', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })
                        : '-'
                    }
                </span>
            </div>

            {/* 메시지 내용 */}
            <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                {message.text || ''}
            </div>

            {/* 이미지 첨부 */}
            {message.pics && message.pics.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {message.pics.map((pic, picIdx) => (
                        <div
                            key={picIdx}
                            className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden border border-gray-300"
                        >
                            <img
                                src={pic}
                                alt={`첨부 이미지 ${picIdx + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999" font-family="sans-serif"%3E🖼️%3C/text%3E%3C/svg%3E';
                                }}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}