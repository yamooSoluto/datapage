// components/common/YamooCard.tsx
// 야무 브랜드 감성의 카드 컴포넌트

import React from 'react';

interface YamooCardProps {
    children: React.ReactNode;
    variant?: 'default' | 'gradient' | 'glass';
    hover?: boolean;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    className?: string;
}

export default function YamooCard({
    children,
    variant = 'default',
    hover = true,
    padding = 'md',
    className = '',
}: YamooCardProps) {
    const baseClasses = 'rounded-2xl transition-all duration-200';

    const variantClasses = {
        default: 'bg-white/80 backdrop-blur-sm border border-gray-100/50 shadow-sm',
        gradient: 'bg-gradient-to-br from-pink-50/50 via-yellow-50/50 to-sky-50/50 backdrop-blur-sm border border-white/50',
        glass: 'bg-white/40 backdrop-blur-xl border border-white/60 shadow-lg',
    };

    const paddingClasses = {
        none: '',
        sm: 'p-3',
        md: 'p-5',
        lg: 'p-6',
    };

    const hoverClasses = hover
        ? 'hover:shadow-md hover:-translate-y-0.5 hover:border-yellow-200/50'
        : '';

    return (
        <div className={`${baseClasses} ${variantClasses[variant]} ${paddingClasses[padding]} ${hoverClasses} ${className}`}>
            {children}
        </div>
    );
}

// 사용 예시:
// <YamooCard variant="gradient" hover>
//     <h3>제목</h3>
//     <p>내용</p>
// </YamooCard>