// components/LibraryMacroDropdown.jsx
// 메시지 입력창에서 # 트리거로 라이브러리 값을 삽입할 수 있는 드롭다운
// ✨ 콤팩트 & 모바일 최적화 & 카테고리 그룹 표시

import { useEffect, useRef, useState } from 'react';
import { Hash } from 'lucide-react';

/**
 * LibraryMacroDropdown - 카테고리 그룹 표시 버전
 * 
 * @param {Object} props
 * @param {Object} props.libraryData - { links: {...}, passwords: {...}, ... }
 * @param {string} props.searchQuery - # 이후 검색어
 * @param {Function} props.onSelect - (value: string) => void
 * @param {Object} props.position - { bottom, left } 드롭다운 위치
 * @param {Function} props.onClose - 드롭다운 닫기
 */
// 한글 카테고리 매핑
const CATEGORY_LABELS = {
    links: '링크',
    passwords: '비밀번호',
    rules: '규정',
    info: '공통정보',
};

export default function LibraryMacroDropdown({
    libraryData,
    searchQuery = '',
    onSelect,
    position,
    onClose,
}) {
    const dropdownRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [isPositioned, setIsPositioned] = useState(false);

    // 모바일 감지
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // ✅ 키보드 감지: 드롭다운이 표시되면 키보드가 올라온 것으로 간주
    useEffect(() => {
        // 드롭다운이 실제로 표시되고 위치가 계산되었을 때만 키보드 이벤트 발생
        if (isPositioned && position && typeof window !== 'undefined') {
            // 커스텀 이벤트를 발생시켜 MinimalHeader의 키보드 감지 로직에 알림
            const event = new CustomEvent('keyboard-visibility-change', {
                detail: { visible: true }
            });
            window.dispatchEvent(event);
        }

        return () => {
            // 드롭다운이 닫힐 때 키보드가 사라진 것으로 간주
            if (isPositioned && typeof window !== 'undefined') {
                const event = new CustomEvent('keyboard-visibility-change', {
                    detail: { visible: false }
                });
                window.dispatchEvent(event);
            }
        };
    }, [isPositioned, position]);

    // ✅ 위치 계산 완료 후 렌더링 (깜빡임 방지)
    useEffect(() => {
        if (position) {
            // 위치가 설정되면 즉시 표시
            setIsPositioned(true);
        } else {
            setIsPositioned(false);
        }
    }, [position]);

    // 모든 라이브러리 항목을 배열로 변환
    const allItems = Object.entries(libraryData || {}).flatMap(([category, items]) =>
        Object.entries(items || {}).map(([key, item]) => ({
            category,
            categoryLabel: CATEGORY_LABELS[category] || category, // 한글 매핑
            categoryKey: category, // 영문 key 유지
            key,
            label: item.label,
            value: item.value,
        }))
    );

    // 검색 필터링 및 우선순위 정렬
    let exactMatches = [];
    let categoryMatches = [];

    if (searchQuery) {
        const query = searchQuery.toLowerCase();

        allItems.forEach((item) => {
            const labelMatch = item.label.toLowerCase().includes(query);
            const valueMatch = item.value.toLowerCase().includes(query);
            const categoryMatch = item.categoryLabel.toLowerCase().includes(query); // 한글로 검색

            if (labelMatch || valueMatch) {
                exactMatches.push(item);
            } else if (categoryMatch) {
                categoryMatches.push(item);
            }
        });
    }

    const filteredItems = searchQuery
        ? [...exactMatches, ...categoryMatches]
        : allItems;

    // 카테고리별로 그룹화 (카테고리 매칭 항목들만)
    const categoryGroups = categoryMatches.reduce((acc, item) => {
        if (!acc[item.category]) {
            acc[item.category] = [];
        }
        acc[item.category].push(item);
        return acc;
    }, {});

    // 외부 클릭 감지
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                // 드롭다운 닫기 전에 키보드 이벤트 발생
                if (typeof window !== 'undefined') {
                    const event = new CustomEvent('keyboard-visibility-change', {
                        detail: { visible: false }
                    });
                    window.dispatchEvent(event);
                }
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
                        // 선택 시 드롭다운 닫기 전에 키보드 이벤트 발생
                        if (typeof window !== 'undefined') {
                            const event = new CustomEvent('keyboard-visibility-change', {
                                detail: { visible: false }
                            });
                            window.dispatchEvent(event);
                        }
                        onSelect?.(filteredItems[selectedIndex].value);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    // 드롭다운 닫기 전에 키보드 이벤트 발생
                    if (typeof window !== 'undefined') {
                        const event = new CustomEvent('keyboard-visibility-change', {
                            detail: { visible: false }
                        });
                        window.dispatchEvent(event);
                    }
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

    // 검색 결과가 없으면 모달 표시 안 함
    if (!filteredItems.length) {
        return null;
    }

    // 위치가 계산되지 않았으면 렌더링하지 않음 (깜빡임 방지)
    if (!isPositioned && !position) {
        return null;
    }

    return (
        <div
            ref={dropdownRef}
            className="fixed z-[100] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
            style={{
                // ✅ 개선된 위치 계산 - 키보드가 올라온 경우 하단 탭 높이 제외
                bottom: position?.bottom || (isMobile ? '72px' : 'auto'),
                left: isMobile ? '16px' : (position?.left || 0),
                right: isMobile ? '16px' : 'auto',
                width: isMobile ? 'auto' : '360px',
                maxHeight: isMobile ? '180px' : '320px', // 모바일 더 작게
                opacity: isPositioned ? 1 : 0, // 위치 계산 완료 전에는 투명
                transition: 'opacity 0.1s ease-out', // 부드러운 전환
            }}
        >
            {/* 헤더 */}
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-gray-600" />
                    <span className="text-xs font-semibold text-gray-700">
                        라이브러리
                    </span>
                    {searchQuery && (
                        <span className="text-xs text-gray-500">
                            "{searchQuery}"
                        </span>
                    )}
                </div>
                <div className="text-xs text-gray-400">
                    {filteredItems.length}개
                </div>
            </div>

            {/* 항목 리스트 */}
            <div
                ref={scrollContainerRef}
                className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                style={{
                    maxHeight: isMobile ? '200px' : '280px',
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-y',
                    overscrollBehavior: 'contain',
                }}
                onTouchStart={(e) => {
                    // 스크롤 영역에서 터치 시작 시 이벤트 전파 방지
                    const target = e.currentTarget;
                    const isScrollable = target.scrollHeight > target.clientHeight;
                    if (isScrollable) {
                        e.stopPropagation();
                    }
                }}
                onTouchMove={(e) => {
                    // 스크롤 중에는 항상 전파 방지
                    const target = e.currentTarget;
                    const isScrollable = target.scrollHeight > target.clientHeight;
                    if (isScrollable) {
                        e.stopPropagation();
                    }
                }}
                onWheel={(e) => {
                    // 마우스 휠 이벤트도 전파 방지
                    e.stopPropagation();
                }}
            >
                {/* 1. 정확 매칭 항목들 */}
                {exactMatches.map((item, index) => {
                    const isSelected = index === selectedIndex;

                    return (
                        <button
                            key={`exact-${item.category}-${item.key}`}
                            data-index={index}
                            onClick={() => {
                                // 선택 시 드롭다운 닫기 전에 키보드 이벤트 발생
                                if (typeof window !== 'undefined') {
                                    const event = new CustomEvent('keyboard-visibility-change', {
                                        detail: { visible: false }
                                    });
                                    window.dispatchEvent(event);
                                }
                                onSelect?.(item.value);
                            }}
                            className={`w-full px-4 py-2.5 flex items-start gap-3 transition-colors text-left ${isSelected
                                ? 'bg-blue-50 border-l-4 border-blue-600'
                                : 'hover:bg-gray-50 border-l-4 border-transparent'
                                }`}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-gray-900 mb-1">
                                    {item.label}
                                </div>
                                <p className="text-xs text-gray-600 truncate">
                                    {item.value}
                                </p>
                            </div>
                        </button>
                    );
                })}

                {/* 2. 카테고리 매칭 항목들 (그룹으로 표시) */}
                {searchQuery && Object.entries(categoryGroups).map(([category, items], groupIdx) => {
                    const startIndex = exactMatches.length +
                        Object.entries(categoryGroups)
                            .slice(0, groupIdx)
                            .reduce((sum, [, grpItems]) => sum + grpItems.length, 0);

                    return (
                        <div key={`category-${category}`}>
                            {/* 카테고리 헤더 */}
                            <div className="px-4 py-2 bg-gray-50 border-y border-gray-100 flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-600">
                                    🏷️ {items[0]?.categoryLabel || category}
                                </span>
                                <span className="text-xs text-gray-400">
                                    {items.length}개
                                </span>
                            </div>

                            {/* 카테고리 항목들 */}
                            {items.map((item, idx) => {
                                const itemIndex = startIndex + idx;
                                const isSelected = itemIndex === selectedIndex;

                                return (
                                    <button
                                        key={`cat-${item.category}-${item.key}`}
                                        data-index={itemIndex}
                                        onClick={() => {
                                            // 선택 시 드롭다운 닫기 전에 키보드 이벤트 발생
                                            if (typeof window !== 'undefined') {
                                                const event = new CustomEvent('keyboard-visibility-change', {
                                                    detail: { visible: false }
                                                });
                                                window.dispatchEvent(event);
                                            }
                                            onSelect?.(item.value);
                                        }}
                                        className={`w-full px-4 py-2.5 flex items-start gap-3 transition-colors text-left ${isSelected
                                            ? 'bg-blue-50 border-l-4 border-blue-600'
                                            : 'hover:bg-gray-50 border-l-4 border-transparent'
                                            }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-900 mb-1">
                                                {item.label}
                                            </div>
                                            <p className="text-xs text-gray-500 truncate">
                                                {item.value}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}

                {/* 3. 검색어 없을 때 전체 표시 (카테고리별 그룹화) */}
                {!searchQuery && (() => {
                    const grouped = allItems.reduce((acc, item) => {
                        if (!acc[item.category]) {
                            acc[item.category] = [];
                        }
                        acc[item.category].push(item);
                        return acc;
                    }, {});

                    let globalIndex = 0;

                    return Object.entries(grouped).map(([category, items]) => (
                        <div key={`all-category-${category}`}>
                            {/* 카테고리 헤더 */}
                            <div className="px-4 py-2 bg-gray-50 border-y border-gray-100 flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-600">
                                    🏷️ {items[0]?.categoryLabel || category}
                                </span>
                            </div>

                            {/* 카테고리 항목들 */}
                            {items.map((item) => {
                                const itemIndex = globalIndex++;
                                const isSelected = itemIndex === selectedIndex;

                                return (
                                    <button
                                        key={`all-${item.category}-${item.key}`}
                                        data-index={itemIndex}
                                        onClick={() => {
                                            // 선택 시 드롭다운 닫기 전에 키보드 이벤트 발생
                                            if (typeof window !== 'undefined') {
                                                const event = new CustomEvent('keyboard-visibility-change', {
                                                    detail: { visible: false }
                                                });
                                                window.dispatchEvent(event);
                                            }
                                            onSelect?.(item.value);
                                        }}
                                        className={`w-full px-4 py-2.5 flex items-start gap-3 transition-colors text-left ${isSelected
                                            ? 'bg-blue-50 border-l-4 border-blue-600'
                                            : 'hover:bg-gray-50 border-l-4 border-transparent'
                                            }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-900 mb-1">
                                                {item.label}
                                            </div>
                                            <p className="text-xs text-gray-500 truncate">
                                                {item.value}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ));
                })()}
            </div>

            {/* 푸터 힌트 - PC에서만 */}
            {!isMobile && (
                <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span>↑↓ 이동</span>
                        <span>Enter 선택</span>
                        <span>Esc 닫기</span>
                    </div>
                </div>
            )}

            <style jsx>{`
                .scrollbar-thin::-webkit-scrollbar {
                    width: 4px;
                }
                .scrollbar-thin::-webkit-scrollbar-track {
                    background: #f3f4f6;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb {
                    background: #d1d5db;
                    border-radius: 2px;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb:hover {
                    background: #9ca3af;
                }
            `}</style>
        </div>
    );
}