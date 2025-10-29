// components/ConversationsPage.jsx
// 검색, 필터, 페이지네이션이 포함된 대화 목록 페이지
// 애플 스타일 - 깔끔하고 직관적

import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, RefreshCw, X, ExternalLink, User, Bot, UserCheck } from 'lucide-react';
import ConversationCard from './ConversationCard';

export default function ConversationsPage({ tenantId }) {
    const [conversations, setConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [detailData, setDetailData] = useState(null); // ✅ 상세 데이터 추가
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

    // ✅ 대화 상세 가져오기 함수 추가
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
            console.log('✅ 대화 상세 로드 완료:', data);
        } catch (error) {
            console.error('❌ 대화 상세 조회 에러:', error);
            setDetailData(null);
        } finally {
            setLoading(false);
        }
    };

    // ✅ 모달 닫기 함수 추가
    const closeDetail = () => {
        setSelectedConv(null);
        setDetailData(null);
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
                                onClick={() => fetchConversationDetail(conv)} // ✅ 수정됨
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

            {/* ✅ 대화 상세 모달 - 수정됨 */}
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

// ✅ 대화 상세 모달 컴포넌트 추가
function ConversationDetailModal({ conversation, detailData, onClose }) {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-6 py-4 flex items-center justify-between border-b">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                            <span className="text-white text-sm font-semibold">
                                {conversation.userName?.charAt(0) || '?'}
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
                                <div className="text-xs text-gray-600 mt-1">사용자 메시지</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">{detailData.stats.aiChats}</div>
                                <div className="text-xs text-gray-600 mt-1">AI 처리</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">{detailData.stats.agentChats}</div>
                                <div className="text-xs text-gray-600 mt-1">상담원 개입</div>
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

// ✅ 메시지 버블 컴포넌트 추가
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