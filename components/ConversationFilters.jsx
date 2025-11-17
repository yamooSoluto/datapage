// components/ConversationFilters.jsx
// 대화 목록 필터 (활성화/보류/중요/완료)

import { useState } from 'react';
import { MessageCircle, Clock, Star, CheckCircle } from 'lucide-react';

export default function ConversationFilters({ onFilterChange, counts }) {
    const [activeFilter, setActiveFilter] = useState('active');

    const filters = [
        {
            id: 'active',
            label: '진행중',
            icon: MessageCircle,
            count: counts?.active || 0,
            color: 'blue'
        },
        {
            id: 'hold',
            label: '보류',
            icon: Clock,
            count: counts?.hold || 0,
            color: 'yellow'
        },
        {
            id: 'important',
            label: '중요',
            icon: Star,
            count: counts?.important || 0,
            color: 'red'
        },
        {
            id: 'completed',
            label: '완료',
            icon: CheckCircle,
            count: counts?.completed || 0,
            color: 'green'
        },
    ];

    const handleFilterClick = (filterId) => {
        setActiveFilter(filterId);
        onFilterChange?.(filterId);
    };

    const getButtonStyle = (filter) => {
        const isActive = activeFilter === filter.id;

        if (isActive) {
            const colors = {
                blue: 'bg-blue-500 text-white shadow-sm',
                yellow: 'bg-yellow-500 text-white shadow-sm',
                red: 'bg-red-500 text-white shadow-sm',
                green: 'bg-green-500 text-white shadow-sm',
            };
            return colors[filter.color] || colors.blue;
        }

        return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
    };

    const getCountStyle = (filter) => {
        const isActive = activeFilter === filter.id;

        if (isActive) {
            const colors = {
                blue: 'bg-blue-600',
                yellow: 'bg-yellow-600',
                red: 'bg-red-600',
                green: 'bg-green-600',
            };
            return `${colors[filter.color] || colors.blue} text-white`;
        }

        return 'bg-gray-200 text-gray-600';
    };

    return (
        <div className="flex items-center gap-2 p-4 bg-white border-b border-gray-100 overflow-x-auto">
            {filters.map((filter) => {
                const Icon = filter.icon;
                const isActive = activeFilter === filter.id;

                return (
                    <button
                        key={filter.id}
                        onClick={() => handleFilterClick(filter.id)}
                        className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium 
              transition-all whitespace-nowrap active:scale-95
              ${getButtonStyle(filter)}
            `}
                    >
                        <Icon
                            className={`w-4 h-4 ${filter.id === 'important' && isActive ? 'fill-current' : ''
                                }`}
                        />
                        <span>{filter.label}</span>
                        {filter.count > 0 && (
                            <span className={`
                text-xs px-2 py-0.5 rounded-full font-semibold
                ${getCountStyle(filter)}
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