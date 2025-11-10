// components/common/SegmentControl.tsx
// 야무 브랜드 감성의 세그먼트 컨트롤

import React from 'react';

interface SegmentOption {
    key: string;
    label: string;
}

interface SegmentControlProps {
    options: SegmentOption[];
    active: string;
    onChange: (key: string) => void;
    size?: 'sm' | 'md' | 'lg';
}

export default function SegmentControl({
    options,
    active,
    onChange,
    size = 'md'
}: SegmentControlProps) {
    const sizeClasses = {
        sm: 'w-24 px-4 py-1.5 text-xs',
        md: 'w-32 px-6 py-2 text-sm',
        lg: 'w-40 px-8 py-2.5 text-base',
    };

    const activeIndex = options.findIndex(opt => opt.key === active);
    const segmentWidth = `calc(${100 / options.length}% - ${options.length > 1 ? '2px' : '0px'})`;
    const segmentLeft = `calc(${(100 / options.length) * activeIndex}% + 2px)`;

    return (
        <div className="inline-flex items-center gap-0.5 p-0.5 bg-gradient-to-r from-pink-100/40 via-yellow-100/40 to-sky-100/40 backdrop-blur-sm rounded-full border border-white/50">
            {/* 활성 슬라이더 - 노란색 그라데이션 */}
            <div
                className="absolute top-0.5 bottom-0.5 bg-gradient-to-r from-yellow-300 to-amber-300 rounded-full shadow-sm transition-all duration-300 ease-out"
                style={{
                    width: segmentWidth,
                    left: segmentLeft,
                }}
            />

            {options.map((option) => {
                const isActive = active === option.key;
                return (
                    <button
                        key={option.key}
                        onClick={() => onChange(option.key)}
                        className={`
                            relative z-10 ${sizeClasses[size]} font-medium rounded-full transition-colors
                            ${isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}
                        `}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

// 사용 예시:
// <SegmentControl
//     options={[
//         { key: 'data', label: '데이터' },
//         { key: 'library', label: '라이브러리' }
//     ]}
//     active={activeTab}
//     onChange={setActiveTab}
//     size="md"
// />