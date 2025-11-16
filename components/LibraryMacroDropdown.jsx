// components/LibraryMacroDropdown.jsx
// 메시지 입력창에서 # 트리거로 라이브러리 값을 삽입할 수 있는 드롭다운

import { useEffect, useRef, useState } from 'react';
import { Link as LinkIcon, Lock, FileText, Info, Hash } from 'lucide-react';

const CATEGORY_CONFIG = {
    links: {
        icon: LinkIcon,
        label: "링크",
        color: "text-blue-600 bg-blue-50",
    },
    passwords: {
        icon: Lock,
        label: "비밀번호",
        color: "text-red-600 bg-red-50",
    },
    rules: {
        icon: FileText,
        label: "규정",
        color: "text-green-600 bg-green-50",
    },
    info: {
        icon: Info,
        label: "공통정보",
        color: "text-purple-600 bg-purple-50",
    },
};

/**
 * LibraryMacroDropdown
 * 
 * @param {Object} props
 * @param {Object} props.libraryData - { links: {...}, passwords: {...}, rules: {...}, info: {...} }
 * @param {string} props.searchQuery - # 이후 검색어
 * @param {Function} props.onSelect - (value: string) => void
 * @param {Object} props.position - { top, left } 드롭다운 위치
 * @param {Function} props.onClose - 드롭다운 닫기
 */
export default function LibraryMacroDropdown({
    libraryData,
    searchQuery = '',
    onSelect,
    position,
    onClose,
}) {
    const dropdownRef = useRef(null);
    const [selectedIndex, setSelectedIndex] = useState(0);

    // 모든 라이브러리 항목을 배열로 변환
    const allItems = Object.entries(libraryData || {}).flatMap(([category, items]) =>
        Object.entries(items || {}).map(([key, item]) => ({
            category,
            key,
            label: item.label,
            value: item.value,
        }))
    );

    // 검색 필터링
    const filteredItems = searchQuery
        ? allItems.filter(
            (item) =>
                item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.value.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : allItems;

    // 외부 클릭 감지
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                onClose?.();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // 키보드 네비게이션
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!filteredItems.length) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex((prev) => Math.max(prev - 1, 0));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (filteredItems[selectedIndex]) {
                        onSelect?.(filteredItems[selectedIndex].value);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose?.();
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [filteredItems, selectedIndex, onSelect, onClose]);

    // 선택된 항목이 보이도록 스크롤
    useEffect(() => {
        if (!dropdownRef.current) return;
        const selectedElement = dropdownRef.current.querySelector(`[data-index="${selectedIndex}"]`);
        if (selectedElement) {
            selectedElement.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth',
            });
        }
    }, [selectedIndex]);

    if (!filteredItems.length) {
        return (
            <div
                ref={dropdownRef}
                className="absolute z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
                style={{
                    bottom: position?.bottom || 'auto',
                    left: position?.left || 0,
                    minWidth: '320px',
                    maxWidth: '400px',
                }}
            >
                <div className="p-4 text-center text-gray-500 text-sm">
                    <Hash className="w-5 h-5 mx-auto mb-2 text-gray-400" />
                    검색 결과가 없습니다
                </div>
            </div>
        );
    }

    return (
        <div
            ref={dropdownRef}
            className="absolute z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
            style={{
                bottom: position?.bottom || 'auto',
                left: position?.left || 0,
                minWidth: '320px',
                maxWidth: '400px',
                maxHeight: '320px',
            }}
        >
            {/* 헤더 */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-gray-600" />
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        라이브러리
                    </span>
                    {searchQuery && (
                        <span className="text-xs text-gray-500">
                            "{searchQuery}" 검색 중
                        </span>
                    )}
                </div>
            </div>

            {/* 항목 리스트 */}
            <div className="overflow-y-auto max-h-[280px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                {filteredItems.map((item, index) => {
                    const config = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.info;
                    const Icon = config.icon;
                    const isSelected = index === selectedIndex;

                    return (
                        <button
                            key={`${item.category}-${item.key}`}
                            data-index={index}
                            onClick={() => onSelect?.(item.value)}
                            className={`w-full px-4 py-3 flex items-start gap-3 transition-colors text-left ${isSelected
                                ? 'bg-blue-50 border-l-4 border-blue-600'
                                : 'hover:bg-gray-50 border-l-4 border-transparent'
                                }`}
                        >
                            {/* 아이콘 */}
                            <div
                                className={`flex-shrink-0 w-8 h-8 rounded-full ${config.color} flex items-center justify-center mt-0.5`}
                            >
                                <Icon className="w-4 h-4" />
                            </div>

                            {/* 내용 */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-semibold text-gray-900 truncate">
                                        {item.label}
                                    </span>
                                    <span className="text-xs text-gray-400 px-1.5 py-0.5 rounded bg-gray-100 flex-shrink-0">
                                        {config.label}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-600 line-clamp-2 break-all">
                                    {item.value}
                                </p>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* 푸터 힌트 */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>↑↓ 이동</span>
                    <span>Enter 선택</span>
                    <span>Esc 닫기</span>
                </div>
            </div>

            <style jsx>{`
                .scrollbar-thin::-webkit-scrollbar {
                    width: 6px;
                }
                .scrollbar-thin::-webkit-scrollbar-track {
                    background: #f3f4f6;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb {
                    background: #d1d5db;
                    border-radius: 3px;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb:hover {
                    background: #9ca3af;
                }
            `}</style>
        </div>
    );
}