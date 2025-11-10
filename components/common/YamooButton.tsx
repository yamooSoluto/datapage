// components/common/YamooButton.tsx
// 야무 브랜드 감성의 버튼 컴포넌트

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface YamooButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    icon?: LucideIcon;
    disabled?: boolean;
    fullWidth?: boolean;
    className?: string;
}

export default function YamooButton({
    children,
    onClick,
    variant = 'primary',
    size = 'md',
    icon: Icon,
    disabled = false,
    fullWidth = false,
    className = '',
}: YamooButtonProps) {
    const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses = {
        primary: 'bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
        secondary: 'bg-white/80 backdrop-blur-sm text-gray-700 border border-gray-200/50 hover:bg-white hover:border-gray-300',
        outline: 'bg-transparent text-gray-700 border border-gray-200/50 hover:bg-white/50 hover:border-gray-300',
        ghost: 'bg-transparent text-gray-600 hover:bg-white/50 hover:text-gray-900',
    };

    const sizeClasses = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-5 py-2 text-sm',
        lg: 'px-7 py-3 text-base',
    };

    const widthClass = fullWidth ? 'w-full' : '';

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
        >
            {Icon && <Icon className="w-4 h-4" />}
            {children}
        </button>
    );
}

// 사용 예시:
// <YamooButton variant="primary" icon={Plus}>
//     추가하기
// </YamooButton>