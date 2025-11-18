// components/ConversationFilters.jsx
// 대화 목록 필터 (진행중/저장/완료) - 깔끔한 디자인

import { useState } from 'react';
import { MessageCircle, Bookmark, CheckCircle } from 'lucide-react';

export default function ConversationFilters({ onFilterChange, counts }) {
    const [activeFilter, setActiveFilter] = useState('active');

    const filters = [
        {
            id: 'active',
            label: '진행중',
            icon: MessageCircle,
            count: counts?.active || 0,
        },
        {
            id: 'saved',
            label: '저장',
            icon: Bookmark,
            count: counts?.saved || (counts?.hold || 0) + (counts?.important || 0),
        },
        {
            id: 'completed',
            label: '완료',
            icon: CheckCircle,
            count: counts?.completed || 0,
        },
    ];

    const handleFilterClick = (filterId) => {
        setActiveFilter(filterId);
        onFilterChange?.(filterId);
    };

    return (
        <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-gray-100">
            {filters.map((filter) => {
                const Icon = filter.icon;
                const isActive = activeFilter === filter.id;

                return (
                    <button
                        key={filter.id}
                        onClick={() => handleFilterClick(filter.id)}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium 
                            transition-all whitespace-nowrap
                            ${isActive
                                ? 'bg-gray-900 text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                            }
                        `}
                    >
                        <Icon className={`w-4 h-4 ${filter.id === 'saved' && isActive ? 'fill-current' : ''}`} />
                        <span>{filter.label}</span>
                        {filter.count > 0 && (
                            <span className={`
                                text-xs px-1.5 py-0.5 rounded-md font-semibold min-w-[20px] text-center
                                ${isActive
                                    ? 'bg-white/20 text-white'
                                    : 'bg-gray-200 text-gray-600'
                                }
                            `}>
                                {filter.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}