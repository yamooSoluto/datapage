// pages/conversations-all-in-one.jsx
// 단일 파일 버전 - 모든 기능 통합
// 검색, 필터, 페이지네이션, 상세 모달 포함
// 애플 스타일 - 깔끔하고 직관적

import { useState, useEffect, useMemo, useRef } from 'react';
import {
    Search, ChevronLeft, ChevronRight, RefreshCw, X, ExternalLink,
    MessageSquare, User, Bot, UserCheck
} from 'lucide-react';

export default function ConversationsAllInOne({ tenantId = 't_01K4AY0QPK6P49FFHTG8AEFM4X' }) {
    const [conversations, setConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);

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
            console.error('Failed to fetch:', error);
        } finally {
            setLoading(false);
        }
    };

    // 상세 정보 로드
    const fetchDetail = async (conv) => {
        setSelectedConv(conv);
        setDetailLoading(true);
        try {
            const tenant = conv.id?.split('_')[0] || tenantId;
            const res = await fetch(
                `/api/conversations/detail?tenant=${tenant}&chatId=${conv.chatId}`
            );
            const data = await res.json();
            setSelectedDetail(data);
        } catch (error) {
            console.error('Failed to fetch detail:', error);
        } finally {
            setDetailLoading(false);
        }
    };

    const closeDetail = () => {
        setSelectedConv(null);
        setSelectedDetail(null);
    };

    // 필터링 & 검색
    const filteredConversations = useMemo(() => {
        let result = [...conversations];

        if (filters.status !== 'all') {
            result = result.filter(c => c.status === filters.status);
        }

        if (filters.channel !== 'all') {
            result = result.filter(c => c.channel === filters.channel);
        }

        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            result = result.filter(c => new Date(c.lastMessageAt) >= fromDate);
        }

        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59);
            result = result.filter(c => new Date(c.lastMessageAt) <= toDate);
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

    // 페이지네이션
    const totalPages = Math.ceil(filteredConversations.length / itemsPerPage);
    const paginatedConversations = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredConversations.slice(start, start + itemsPerPage);
    }, [filteredConversations, currentPage, itemsPerPage]);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentPage]);

    const resetFilters = () => {
        setFilters({ status: 'all', channel: 'all', dateFrom: '', dateTo: '' });
        setSearchQuery('');
        setCurrentPage(1);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* 헤더 */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-30 backdrop-blur-lg bg-white/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="py-4 flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">대화 목록</h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {filteredConversations.length}개의 대화
                            </p>
                        </div>
                        <button
                            onClick={fetchConversations}
                            disabled={loading}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* 검색 */}
                    <div className="pb-4">
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
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    {/* 필터 */}
                    <div className="pb-4 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                        <select
                            value={filters.status}
                            onChange={(e) => {
                                setFilters({ ...filters, status: e.target.value });
                                setCurrentPage(1);
                            }}
                            className="px-3 py-1.5 bg-gray-100 border-0 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">전체 상태</option>
                            <option value="waiting">대기중</option>
                            <option value="in_progress">진행중</option>
                            <option value="resolved">해결됨</option>
                        </select>

                        <select
                            value={filters.channel}
                            onChange={(e) => {
                                setFilters({ ...filters, channel: e.target.value });
                                setCurrentPage(1);
                            }}
                            className="px-3 py-1.5 bg-gray-100 border-0 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">전체 채널</option>
                            <option value="widget">💬 위젯</option>
                            <option value="naver">🟢 네이버</option>
                            <option value="kakao">💛 카카오</option>
                        </select>

                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => {
                                setFilters({ ...filters, dateFrom: e.target.value });
                                setCurrentPage(1);
                            }}
                            className="px-3 py-1.5 bg-gray-100 border-0 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-gray-400">~</span>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => {
                                setFilters({ ...filters, dateTo: e.target.value });
                                setCurrentPage(1);
                            }}
                            className="px-3 py-1.5 bg-gray-100 border-0 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500"
                        />

                        {(filters.status !== 'all' || filters.channel !== 'all' || filters.dateFrom || filters.dateTo || searchQuery) && (
                            <button
                                onClick={resetFilters}
                                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
                            >
                                초기화
                            </button>
                        )}

                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="ml-auto px-3 py-1.5 bg-gray-100 border-0 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500"
                        >
                            <option value={10}>10개씩</option>
                            <option value={20}>20개씩</option>
                            <option value={50}>50개씩</option>
                            <option value={100}>100개씩</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* 대화 목록 */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-200 border-t-blue-600" />
                    </div>
                ) : paginatedConversations.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                            <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500">
                            {searchQuery || filters.status !== 'all' ? '검색 결과가 없습니다' : '대화 내역이 없습니다'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            {paginatedConversations.map((conv) => (
                                <ConversationCard
                                    key={conv.id}
                                    conversation={conv}
                                    onClick={() => fetchDetail(conv)}
                                    isSelected={selectedConv?.id === conv.id}
                                />
                            ))}
                        </div>

                        {/* 페이지네이션 */}
                        {totalPages > 1 && (
                            <div className="mt-8 flex items-center justify-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
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
                            ${page === currentPage ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}
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
                                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        )}

                        <p className="text-center text-sm text-gray-500 mt-4">
                            {filteredConversations.length}개 중 {((currentPage - 1) * itemsPerPage) + 1}-
                            {Math.min(currentPage * itemsPerPage, filteredConversations.length)}개 표시
                        </p>
                    </>
                )}
            </main>

            {/* 상세 모달 */}
            {selectedConv && (
                <DetailModal
                    conversation={selectedConv}
                    detail={selectedDetail}
                    loading={detailLoading}
                    onClose={closeDetail}
                />
            )}
        </div>
    );
}

// 대화 카드 컴포넌트
function ConversationCard({ conversation, onClick, isSelected }) {
    const getRelativeTime = (dateString) => {
        if (!dateString) return '';
        const now = new Date();
        const date = new Date(dateString);
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return '방금';
        if (minutes < 60) return `${minutes}분`;
        if (hours < 24) return `${hours}시간`;
        if (days < 7) return `${days}일`;
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    };

    const getChannelEmoji = (channel) => {
        const map = {
            widget: '💬',
            naver: '🟢',
            kakao: '💛',
            channeltalk_kakao: '📱',
            channeltalk_naver: '📱',
        };
        return map[channel] || '💬';
    };

    const getStatusColor = (status) => {
        const colors = {
            waiting: 'bg-orange-50 text-orange-600',
            in_progress: 'bg-blue-50 text-blue-600',
            resolved: 'bg-green-50 text-green-600',
        };
        return colors[status] || 'bg-gray-50 text-gray-600';
    };

    return (
        <div
            onClick={onClick}
            className={`
        bg-white rounded-xl p-3.5 border border-gray-100
        hover:border-gray-200 hover:shadow-sm active:scale-[0.99]
        transition-all duration-200 cursor-pointer
        ${isSelected ? 'ring-2 ring-blue-500 border-transparent' : ''}
      `}
        >
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-semibold">
                        {conversation.userName?.charAt(0) || '?'}
                    </span>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 truncate">
                                {conversation.userName || '익명'}
                            </h3>
                            <span className="text-base">{getChannelEmoji(conversation.channel)}</span>
                        </div>
                        <span className="text-xs text-gray-400">
                            {getRelativeTime(conversation.lastMessageAt)}
                        </span>
                    </div>

                    <p className="text-sm text-gray-600 truncate mb-1.5">
                        {conversation.lastMessageText || '메시지 없음'}
                    </p>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                                <MessageSquare className="w-3.5 h-3.5" />
                                {conversation.messageCount?.total || 0}
                            </span>
                            {conversation.messageCount?.user > 0 && (
                                <span className="flex items-center gap-1">
                                    <User className="w-3.5 h-3.5" />
                                    {conversation.messageCount.user}
                                </span>
                            )}
                            {conversation.messageCount?.ai > 0 && (
                                <span className="flex items-center gap-1 text-blue-500">
                                    <Bot className="w-3.5 h-3.5" />
                                    {conversation.messageCount.ai}
                                </span>
                            )}
                            {conversation.messageCount?.agent > 0 && (
                                <span className="flex items-center gap-1 text-purple-500">
                                    <UserCheck className="w-3.5 h-3.5" />
                                    {conversation.messageCount.agent}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5">
                            {conversation.isTask && (
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(conversation.status)}`}>
                                {conversation.status === 'waiting' ? '대기'
                                    : conversation.status === 'in_progress' ? '진행'
                                        : '완료'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 상세 모달
function DetailModal({ conversation, detail, loading, onClose }) {
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (detail?.messages && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [detail?.messages]);

    return (
        <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                            <span className="text-white text-sm font-semibold">
                                {conversation.userName?.charAt(0) || '?'}
                            </span>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">
                                {conversation.userName || '익명'}
                            </h2>
                            <p className="text-xs text-gray-500 font-mono">
                                {conversation.chatId}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600" />
                        </div>
                    ) : detail?.messages?.length > 0 ? (
                        <div className="space-y-3">
                            {detail.messages.map((msg, idx) => (
                                <MessageBubble key={idx} message={msg} />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    ) : (
                        <div className="text-center py-20 text-gray-500">메시지가 없습니다</div>
                    )}
                </div>

                <div className="px-6 py-4 bg-white border-t border-gray-100">
                    {detail?.stats && (
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold">{detail.stats.userChats}</div>
                                <div className="text-xs text-gray-500 mt-1">사용자</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">{detail.stats.aiChats}</div>
                                <div className="text-xs text-gray-500 mt-1">AI</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-600">{detail.stats.agentChats}</div>
                                <div className="text-xs text-gray-500 mt-1">상담원</div>
                            </div>
                        </div>
                    )}
                    {detail?.slack?.slackUrl && (
                        <a
                            href={detail.slack.slackUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Slack에서 보기
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}

// 메시지 버블
function MessageBubble({ message }) {
    const isUser = message.sender === 'user';
    const isAI = message.sender === 'ai';

    const config = isUser
        ? { align: 'ml-auto', bg: 'bg-blue-600 text-white', name: '사용자' }
        : isAI
            ? { align: 'mr-auto', bg: 'bg-gray-200 text-gray-900', name: 'AI' }
            : { align: 'mr-auto', bg: 'bg-purple-100 text-purple-900', name: '상담원' };

    return (
        <div className={`max-w-[70%] ${config.align}`}>
            {!isUser && (
                <div className="text-xs text-gray-500 mb-1 px-1">{config.name}</div>
            )}
            <div className={`rounded-2xl px-4 py-2.5 ${config.bg}`}>
                <p className="text-sm whitespace-pre-wrap break-words">
                    {message.text || '(내용 없음)'}
                </p>
                {message.pics?.length > 0 && (
                    <div className="mt-2 flex gap-2">
                        {message.pics.map((pic, idx) => (
                            <img key={idx} src={pic} alt="" className="w-20 h-20 object-cover rounded-lg" />
                        ))}
                    </div>
                )}
            </div>
            {message.timestamp && (
                <div className={`text-xs text-gray-400 mt-1 px-1 ${isUser ? 'text-right' : ''}`}>
                    {new Date(message.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </div>
            )}
        </div>
    );
}