// components/ConversationsPage.jsx
// 애플 스타일 - 깔끔하고 직관적인 대화 목록 페이지

import { useState, useEffect, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, RefreshCw, X, ExternalLink, User, Bot, UserCheck } from 'lucide-react';
import ConversationCard from './ConversationCard';

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
        '불편사항',
        '오류',
        '결제',
        '건의',
        '문의',
        '칭찬',
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
            console.error('Failed to fetch conversations:', error);
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
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
                <span className="text-gray-400">~</span>
                <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => {
                        setFilters({ ...filters, dateTo: e.target.value });
                        setCurrentPage(1);
                    }}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
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
                    <p className="text-gray-500">
                        {searchQuery || filters.channel !== 'all' || filters.category !== 'all'
                            ? '검색 결과가 없습니다'
                            : '대화가 없습니다'}
                    </p>
                </div>
            ) : (
                <>
                    {/* 대화 카드 그리드 */}
                    <div className="space-y-3">
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
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-gray-200">
                {/* 헤더 */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                            <span className="text-white text-sm font-semibold">
                                {conversation.userNameInitial || conversation.userName?.charAt(0) || '?'}
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
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 메시지 리스트 */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {detailData.messages && detailData.messages.length > 0 ? (
                        <div className="space-y-3">
                            {detailData.messages.map((msg, idx) => (
                                <MessageBubble key={idx} message={msg} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">메시지가 없습니다</p>
                        </div>
                    )}
                </div>

                {/* 하단 정보 */}
                <div className="px-6 py-4 bg-white border-t border-gray-200">
                    {/* 통계 */}
                    {detailData.stats && (
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-gray-900">
                                    {detailData.stats.userChats}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                                    <User className="w-3 h-3" />
                                    사용자
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">
                                    {detailData.stats.aiChats}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                                    <Bot className="w-3 h-3" />
                                    AI
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-600">
                                    {detailData.stats.agentChats}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                                    <UserCheck className="w-3 h-3" />
                                    상담원
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 메타 정보 */}
                    {detailData.conversation && (
                        <div className="space-y-3 mb-4">
                            {/* Summary */}
                            {detailData.conversation.summary && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <div className="text-xs font-semibold text-blue-700 mb-1">
                                        대화 요약
                                    </div>
                                    <div className="text-sm text-blue-900">
                                        {detailData.conversation.summary}
                                    </div>
                                </div>
                            )}

                            {/* Categories */}
                            {detailData.conversation.categories && detailData.conversation.categories.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-semibold text-gray-600">카테고리:</span>
                                    {detailData.conversation.categories.map((cat, idx) => (
                                        <span
                                            key={idx}
                                            className="text-xs px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-md font-medium"
                                        >
                                            {cat}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* 기존 메타 정보 */}
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <div className="flex items-center gap-3">
                                    <span>
                                        상태: <span className="font-medium text-gray-700">{detailData.conversation.status}</span>
                                    </span>
                                    <span>•</span>
                                    <span>
                                        채널: <span className="font-medium text-gray-700">{detailData.conversation.channel}</span>
                                    </span>
                                    <span>•</span>
                                    <span>
                                        모드: <span className="font-medium text-gray-700">{detailData.conversation.modeSnapshot || 'AUTO'}</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 슬랙 링크 */}
                    {detailData.slack?.slackUrl && (
                        <a
                            href={detailData.slack.slackUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
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
    const isUser = message.sender === 'user';
    const isAI = message.sender === 'ai';
    const isAgent = message.sender === 'admin' || message.sender === 'agent';

    const senderConfig = {
        user: {
            name: '사용자',
            icon: User,
            align: 'flex-row-reverse',
            bubbleBg: 'bg-blue-600 text-white',
            bubbleAlign: 'ml-auto',
            iconBg: 'bg-gray-300',
            iconColor: 'text-gray-700',
        },
        ai: {
            name: 'AI',
            icon: Bot,
            align: 'flex-row',
            bubbleBg: 'bg-gray-200 text-gray-900',
            bubbleAlign: 'mr-auto',
            iconBg: 'bg-blue-500',
            iconColor: 'text-white',
        },
        agent: {
            name: '상담원',
            icon: UserCheck,
            align: 'flex-row',
            bubbleBg: 'bg-purple-100 text-purple-900',
            bubbleAlign: 'mr-auto',
            iconBg: 'bg-purple-500',
            iconColor: 'text-white',
        },
    }[isUser ? 'user' : isAI ? 'ai' : 'agent'];

    const Icon = senderConfig.icon;

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className={`flex items-end gap-2 ${senderConfig.align}`}>
            {/* 아바타 (사용자 제외) */}
            {!isUser && (
                <div className={`flex-shrink-0 w-7 h-7 rounded-full ${senderConfig.iconBg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${senderConfig.iconColor}`} />
                </div>
            )}

            {/* 메시지 버블 */}
            <div className={`max-w-[70%] ${senderConfig.bubbleAlign}`}>
                {/* 발신자 이름 (사용자 제외) */}
                {!isUser && (
                    <div className="text-xs text-gray-500 mb-1 px-1">
                        {senderConfig.name}
                    </div>
                )}

                {/* 버블 */}
                <div className={`rounded-2xl px-4 py-2.5 ${senderConfig.bubbleBg}`}>
                    {/* 모드 스냅샷 */}
                    {message.modeSnapshot && (
                        <div className={`text-xs mb-1 ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
                            [{message.modeSnapshot}]
                        </div>
                    )}

                    {/* 텍스트 */}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {message.text || '(내용 없음)'}
                    </p>

                    {/* 이미지 */}
                    {message.pics && message.pics.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {message.pics.map((pic, idx) => (
                                <img
                                    key={idx}
                                    src={pic.url || pic}
                                    alt={`첨부 ${idx + 1}`}
                                    className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => window.open(pic.url || pic, '_blank')}
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* 시간 */}
                <div className={`text-xs text-gray-400 mt-1 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
                    {formatTime(message.timestamp)}
                </div>
            </div>
        </div>
    );
}