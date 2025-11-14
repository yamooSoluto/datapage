// components/mypage/CriteriaSheetEditor.tsx
// ✅ 2025-11-07 모바일 UI 개선 버전 (로직은 기존과 동일)
// - 플로팅 액션 버튼으로 통합
// - 바텀시트 모달
// - 세그먼트 컨트롤
// - 카테고리 상단 고정
// - 저장 버튼 우측 상단으로 이동

import React from "react";
import {
    Plus, X, GripVertical, ChevronDown, Calendar, Clock, Type, Settings, Columns, Eye, EyeOff, Save, Edit3, Check, Download, RefreshCw
} from "lucide-react";
import {
    DndContext,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    closestCenter,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
    horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PRESET_ITEMS, SHEET_TEMPLATES } from "./criteriaSheetPresets";


// ---- Portal: 모달/드롭다운 클리핑 방지용 ----
import { createPortal } from "react-dom";

function Portal({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = React.useState(false);
    const [el] = React.useState(() => {
        const div = typeof document !== "undefined" ? document.createElement("div") : null;
        if (div) {
            div.style.position = "relative";
            div.style.zIndex = "9999";
        }
        return div;
    });

    React.useEffect(() => {
        if (!el || typeof document === "undefined") return;
        document.body.appendChild(el);
        setMounted(true);
        return () => { try { document.body.removeChild(el); } catch { } };
    }, [el]);

    if (!mounted || !el) return null;
    return createPortal(children, el);
}


// ────────────────────────────────────────────────────────────
// 유틸 (기존 유지)
// ────────────────────────────────────────────────────────────
const AUTO_SAVE_DEBOUNCE_MS = 2200;
const MIN_REMOTE_SAVE_INTERVAL_MS = 8000;

const pad2 = (n: number | string) => String(n).padStart(2, "0");
const pack = (arr?: string[] | string) => (Array.isArray(arr) ? arr.join(" / ") : String(arr || ""));
const unpack = (str?: string) => String(str || "").split(" / ").filter(Boolean);
const normalize = (s = "") => s.trim().toLowerCase();
const uniqNormPush = (arr: string[] = [], v: string) => {
    const nv = normalize(v);
    if (!nv) return arr;
    const has = arr.some((x) => normalize(x) === nv);
    return has ? arr : [...arr, v.trim()];
};

function normalizeHM(token?: string | null) {
    if (!token) return null;
    let t = String(token).trim();
    let meridian: "AM" | "PM" | null = null;
    if (t.includes("오전")) meridian = "AM";
    if (t.includes("오후")) meridian = "PM";
    t = t.replace(/오전|오후|\s/g, "");
    t = t.replace(/시/g, ":").replace(/분/g, "");

    if (/^\d{1,4}$/.test(t)) {
        if (t.length <= 2) {
            let h = Number(t);
            if (meridian === "PM" && h < 12) h += 12;
            if (meridian === "AM" && h === 12) h = 0;
            return `${pad2(h)}:00`;
        }
        if (t.length === 3) {
            let h = Number(t.slice(0, 1));
            let m = Number(t.slice(1));
            if (meridian === "PM" && h < 12) h += 12;
            if (meridian === "AM" && h === 12) h = 0;
            return `${pad2(h)}:${pad2(m)}`;
        }
        if (t.length === 4) {
            let h = Number(t.slice(0, 2));
            let m = Number(t.slice(2));
            if (meridian === "PM" && h < 12) h += 12;
            if (meridian === "AM" && h === 12) h = 0;
            return `${pad2(h)}:${pad2(m)}`;
        }
    }
    const m = t.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
    if (m) {
        let h = Number(m[1]);
        let mm = Number(m[2] || 0);
        if (meridian === "PM" && h < 12) h += 12;
        if (meridian === "AM" && h === 12) h = 0;
        return `${pad2(h)}:${pad2(mm)}`;
    }
    return null;
}

// === n8n 서버 릴레이(쓰로틀) ===
// (컴포넌트 내부로 이동됨 - tenantId 접근을 위해)

// ────────────────────────────────────────────────────────────
// 템플릿 헬퍼 (기존 유지)
// ────────────────────────────────────────────────────────────
function deriveTemplateFromItems(items: any[] = [], sheetId = "custom") {
    const labelMap: Record<string, string> = {
        existence: "존재",
        cost: "비용",
        location: "위치",
        usage: "이용",
        noise: "소음허용",
    };
    const buckets: Record<string, Set<string>> = {};
    for (const it of items) {
        const f = it?.facets || {};
        for (const k of Object.keys(f)) {
            const arr = Array.isArray(f[k]) ? f[k] : f[k] != null ? [f[k]] : [];
            (buckets[k] ||= new Set());
            arr.forEach((v: string) => String(v).trim() && buckets[k].add(String(v)));
        }
    }
    const facets = Object.entries(buckets).map(([k, set]) => ({
        key: k,
        label: labelMap[k] || k,
        type: "multi",
        options: Array.from(set),
    }));
    return facets;
}

function ensureTemplateShape(sheetId: string, existingTemplate?: any, derivedFacets: any[] = []) {
    const preset = SHEET_TEMPLATES[sheetId];
    const baseFacets = preset?.facets || derivedFacets || [];

    return {
        id: sheetId,
        title: preset?.title || sheetId,
        icon: preset?.icon || "🧩",
        facets: existingTemplate?.facets || baseFacets,
    };
}

// ────────────────────────────────────────────────────────────
// Sortable helpers (기존 유지)
// ────────────────────────────────────────────────────────────
function useSortableRow(id: string) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { background: "#eef5ff" } : {}),
    };
    return { attributes, listeners, setNodeRef, style, isDragging };
}


// ────────────────────────────────────────────────────────────
// 모바일 바텀시트 (신규 UI 컴포넌트)
// ────────────────────────────────────────────────────────────
function MobileBottomSheet({ isOpen, onClose, title, children, maxHeight = "85vh" }: any) {
    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <>
            {/* 백드롭 */}
            <div
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100]"
                onClick={onClose}
            />

            {/* 바텀시트 */}
            <div
                className="fixed inset-x-0 bottom-0 z-[101] bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out"
                style={{ maxHeight }}
            >
                {/* 드래그 핸들 */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                </div>

                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-3 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* 컨텐츠 */}
                <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: "calc(85vh - 120px)" }}>
                    {children}
                </div>
            </div>
        </>
    );
}

// ────────────────────────────────────────────────────────────
// InlineDropdown (기존 유지 - 모바일에서는 바텀시트로 자동 전환)
// ────────────────────────────────────────────────────────────
function InlineDropdown({
    row,  // 추가
    cellRef,
    facet,
    value,
    onChange,
    onClose,
    customOptions,
    onDeleteCustomOption,
    onUpdateFacetOptions,  // 새로 추가: facet.options 수정용
    library,  // 라이브러리 데이터
    openDropdown,  // 추가
    setOpenDropdown,  // 추가
    isEditMode,  // 추가
}: any) {
    const dropdownRef = React.useRef<HTMLDivElement | null>(null);
    const [selected, setSelected] = React.useState<string[]>(unpack(value));
    const [mode, setMode] = React.useState<null | "text" | "time" | "date">(null);
    const [textInput, setTextInput] = React.useState("");

    // 하단 옵션 편집 모드
    const [optionEditMode, setOptionEditMode] = React.useState(false);

    const [times, setTimes] = React.useState<string[]>([]);
    const [startInput, setStartInput] = React.useState("09:00");
    const [endInput, setEndInput] = React.useState("");
    const quickRanges = ["24시간", "오전", "오후", "09:00~18:00", "10:00~22:00"];

    const [dates, setDates] = React.useState<string[]>([]);
    const [customDate, setCustomDate] = React.useState("");

    const [isMobile, setIsMobile] = React.useState(false);
    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // 라이브러리 참조 타입 처리 - hooks는 항상 호출되어야 함 (Rules of Hooks)
    const isLibraryRef = facet.type === "library-ref";
    const libraryType = isLibraryRef ? (facet.libraryType || "links") : "links";

    // 디버깅: 모든 InlineDropdown 호출 시 facet 정보 확인
    React.useEffect(() => {
        console.log('InlineDropdown - Component rendered:', {
            facetType: facet.type,
            facetKey: facet.key,
            facetLabel: facet.label,
            isLibraryRef,
            libraryType,
            hasLibrary: !!library,
            libraryKeys: library ? Object.keys(library) : 'library is undefined',
            libraryValue: library?.[libraryType],
        });
    }, [facet.type, facet.key, isLibraryRef, libraryType, library]);

    // library prop이 없거나 구조가 다를 수 있으므로 안전하게 처리
    const libraryItems = React.useMemo(() => {
        if (!isLibraryRef) return {};

        console.log('InlineDropdown - Library processing:', {
            library,
            libraryType,
            hasLibrary: !!library,
            libraryTypeValue: library?.[libraryType],
            libraryTypeType: typeof library?.[libraryType],
            allLibraryKeys: library ? Object.keys(library) : []
        });

        if (!library) {
            console.warn('InlineDropdown - Library prop is missing or undefined');
            return {};
        }
        if (typeof library[libraryType] === 'object' && library[libraryType] !== null) {
            const items = library[libraryType];
            console.log(`InlineDropdown - Found library items for "${libraryType}":`, items, 'Keys:', Object.keys(items));
            return items;
        }
        console.warn(`InlineDropdown - Library type "${libraryType}" not found in library:`, library, 'Available keys:', Object.keys(library));
        return {};
    }, [isLibraryRef, library, libraryType]);

    const libraryOptions = React.useMemo(() => {
        if (!isLibraryRef) return [];

        // libraryItems가 비어있으면 library에서 직접 가져오기
        const items = Object.keys(libraryItems).length > 0
            ? libraryItems
            : (library?.[libraryType] || {});

        console.log('InlineDropdown - libraryOptions creation:', {
            libraryType,
            libraryItemsKeys: Object.keys(libraryItems),
            libraryDirectValue: library?.[libraryType],
            libraryDirectKeys: library?.[libraryType] ? Object.keys(library[libraryType]) : [],
            itemsKeys: Object.keys(items),
            items,
        });

        return Object.entries(items).map(([key, item]: any) => ({
            key,
            label: item?.label || item?.name || key,
            value: item?.value || item?.url || '',
        }));
    }, [isLibraryRef, libraryItems, library, libraryType]);

    const dropdownId = `${row.id}-${facet.key}`;
    const isDropdownOpen = openDropdown === dropdownId;

    // 드롭다운 위치 계산 (Portal 사용을 위해)
    const [libDropdownPosition, setLibDropdownPosition] = React.useState<{ top: number; left: number } | null>(null);

    // 디버깅: library 데이터 확인
    React.useEffect(() => {
        if (isLibraryRef) {
            console.log('Library Debug - State check:', {
                isEditMode,
                isDropdownOpen,
                dropdownId,
                libraryType,
                libraryOptionsLength: libraryOptions.length,
                libraryOptions,
                libDropdownPosition,
                hasCellRef: !!cellRef.current,
            });
        }

        if (isLibraryRef && isEditMode && isDropdownOpen) {
            console.log('Library Debug - Dropdown opened:', {
                libraryType,
                library,
                libraryItems,
                libraryOptions,
                libraryKeys: Object.keys(libraryItems),
                libraryOptionsLength: libraryOptions.length,
                libraryStructure: library ? Object.keys(library) : 'library is undefined',
                libDropdownPosition,
            });
        }
    }, [isLibraryRef, isEditMode, isDropdownOpen, dropdownId, libraryType, library, libraryItems, libraryOptions]);

    React.useLayoutEffect(() => {
        if (!isLibraryRef || !isDropdownOpen) {
            setLibDropdownPosition(null);
            return;
        }

        const updateLibDropdownPosition = () => {
            if (!cellRef.current) {
                console.log('Library Dropdown - cellRef not ready, retrying...');
                // cellRef가 준비되지 않았으면 약간 지연 후 다시 시도
                setTimeout(() => {
                    if (cellRef.current && isDropdownOpen) {
                        updateLibDropdownPosition();
                    }
                }, 10);
                return;
            }

            const cellRect = cellRef.current.getBoundingClientRect();
            const dropdownWidth = 300;
            const dropdownHeight = libraryOptions.length > 0
                ? Math.min(300, libraryOptions.length * 60 + 20)
                : 100; // 안내 메시지 높이
            const pad = 8;
            const vh = window.innerHeight;
            const vw = window.innerWidth;

            let left = cellRect.left;
            let top = cellRect.bottom + pad;

            // 화면 오른쪽을 벗어나면 왼쪽으로 조정
            if (left + dropdownWidth > vw - pad) {
                left = Math.max(pad, vw - dropdownWidth - pad);
            }

            // 화면 하단을 벗어나면 위로 조정
            if (top + dropdownHeight > vh - pad) {
                top = Math.max(pad, cellRect.top - dropdownHeight - pad);
            }

            const position = { top, left };
            console.log('Library Dropdown - Position calculated:', {
                position,
                cellRect,
                libraryOptionsLength: libraryOptions.length,
            });
            setLibDropdownPosition(position);
        };

        updateLibDropdownPosition();
        const handleScroll = () => updateLibDropdownPosition();
        const handleResize = () => updateLibDropdownPosition();

        window.addEventListener("scroll", handleScroll, true);
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("scroll", handleScroll, true);
            window.removeEventListener("resize", handleResize);
        };
    }, [isLibraryRef, isDropdownOpen, cellRef, libraryOptions.length]);

    // 라이브러리 참조 타입 처리 - 드롭다운으로
    if (isLibraryRef) {
        // 라이브러리에 존재하는 항목만 필터링
        const selectedKeys = React.useMemo(() => {
            const keys = value ? String(value).split(',').filter(Boolean) : [];
            return keys.filter(k => libraryItems[k] != null);
        }, [value, libraryItems]);

        const selectedLabels = selectedKeys
            .map(k => libraryItems[k]?.label || libraryItems[k]?.name || k)
            .filter(Boolean)
            .join(', ');

        // 임시 선택 상태 (확인 버튼을 누르기 전까지)
        const [tempSelectedKeys, setTempSelectedKeys] = React.useState<string[]>(selectedKeys);

        // 드롭다운이 열릴 때마다 현재 선택된 값으로 초기화 (유효한 항목만)
        React.useEffect(() => {
            if (isDropdownOpen) {
                setTempSelectedKeys(selectedKeys);
            }
        }, [isDropdownOpen, selectedKeys.join(',')]);

        // 라이브러리 항목이 삭제되었을 때 자동으로 정리
        React.useEffect(() => {
            const rawKeys = value ? String(value).split(',').filter(Boolean) : [];
            const validKeys = rawKeys.filter(k => libraryItems[k] != null);
            if (validKeys.length !== rawKeys.length && validKeys.join(',') !== value) {
                // 삭제된 항목이 있으면 자동으로 업데이트
                onChange(validKeys.join(','));
            }
        }, [libraryItems, value, onChange]);

        const handleApply = () => {
            onChange(tempSelectedKeys.join(','));
            setOpenDropdown(null);
        };

        return (
            <>
                <div className="relative inline-block w-full">
                    <button
                        ref={cellRef as any}
                        onClick={() => {
                            if (isEditMode) {
                                setOpenDropdown(isDropdownOpen ? null : dropdownId);
                            }
                        }}
                        disabled={!isEditMode}
                        className={`w-full px-3 py-2 text-left rounded-lg border transition-all duration-200 ${isEditMode
                            ? 'border-gray-300 hover:border-gray-900 hover:bg-gray-50 active:scale-[0.98]'
                            : 'border-transparent bg-transparent'
                            } ${selectedKeys.length > 0 ? 'text-gray-900' : 'text-gray-400'}`}
                        title={selectedLabels || '선택'}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm">
                                {selectedKeys.length > 0
                                    ? selectedKeys.length === 1
                                        ? selectedLabels
                                        : `${selectedKeys.length}개 선택됨`
                                    : '선택'}
                            </span>
                            {isEditMode && (
                                <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            )}
                        </div>
                    </button>
                </div>

                {/* Portal로 드롭다운 렌더링 (테이블 컨테이너 overflow 문제 해결) */}
                {isDropdownOpen && (
                    <Portal>
                        {(() => {
                            console.log('Library Dropdown Render Check:', {
                                isDropdownOpen,
                                libDropdownPosition,
                                libraryOptionsLength: libraryOptions.length,
                                libraryOptions,
                                hasPosition: !!libDropdownPosition,
                            });
                            return null;
                        })()}
                        {libDropdownPosition && (
                            libraryOptions.length > 0 ? (
                                <div
                                    ref={dropdownRef}
                                    className="library-dropdown fixed z-[1000] min-w-[200px] max-w-[320px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
                                    style={{
                                        top: `${libDropdownPosition.top}px`,
                                        left: `${libDropdownPosition.left}px`,
                                        width: '320px',
                                        maxHeight: '400px',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}
                                >
                                    <div className="p-2 space-y-0.5 overflow-y-auto flex-1" style={{ maxHeight: '320px' }}>
                                        {libraryOptions.map((opt: any) => {
                                            const isSelected = tempSelectedKeys.includes(opt.key);
                                            return (
                                                <label
                                                    key={opt.key}
                                                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-all duration-150 active:bg-gray-100"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            const newSelected = isSelected
                                                                ? tempSelectedKeys.filter((k: string) => k !== opt.key)
                                                                : [...tempSelectedKeys, opt.key];
                                                            setTempSelectedKeys(newSelected);
                                                        }}
                                                        className="mt-0.5 w-4 h-4 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer transition-all checked:bg-blue-600 checked:border-blue-600"
                                                        style={{
                                                            WebkitAppearance: 'checkbox',
                                                            appearance: 'checkbox',
                                                        }}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-gray-900 truncate">
                                                            {opt.label}
                                                        </div>
                                                        {opt.value && (
                                                            <div className="text-xs text-gray-500 truncate mt-0.5" title={opt.value}>
                                                                {opt.value}
                                                            </div>
                                                        )}
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <div className="border-t border-gray-200 p-3 bg-gray-50 flex items-center justify-between gap-2">
                                        <span className="text-xs text-gray-600">
                                            {tempSelectedKeys.length > 0 ? `${tempSelectedKeys.length}개 선택됨` : '선택 안 함'}
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setOpenDropdown(null)}
                                                className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-150 active:scale-95"
                                            >
                                                취소
                                            </button>
                                            <button
                                                onClick={handleApply}
                                                className="px-4 py-1.5 text-sm text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-all duration-150 active:scale-95 font-medium shadow-sm"
                                            >
                                                확인
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="fixed z-[1000] w-[300px] p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800"
                                    style={{
                                        top: `${libDropdownPosition.top}px`,
                                        left: `${libDropdownPosition.left}px`
                                    }}
                                >
                                    📚 라이브러리 탭에서 {facet.label}을 추가하세요
                                </div>
                            )
                        )}
                    </Portal>
                )}
                <style jsx>{`
                    @keyframes libraryDropdownFadeIn {
                        from {
                            opacity: 0;
                            transform: translateY(-8px) scale(0.98);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0) scale(1);
                        }
                    }
                    .library-dropdown {
                        animation: libraryDropdownFadeIn 0.2s ease-out;
                    }
                `}</style>
            </>
        );
    }

    const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
    const [isPositionReady, setIsPositionReady] = React.useState(false);

    React.useLayoutEffect(() => {
        if (isMobile) {
            setIsPositionReady(true);
            return;
        }

        let retryTimer: NodeJS.Timeout | null = null;

        const updatePosition = () => {
            if (!cellRef.current) {
                // cellRef가 아직 준비되지 않았으면 약간 지연 후 다시 시도
                if (retryTimer) clearTimeout(retryTimer);
                retryTimer = setTimeout(() => {
                    if (cellRef.current) {
                        updatePosition();
                    }
                }, 5); // 더 빠른 재시도
                return;
            }

            const cellRect = cellRef.current.getBoundingClientRect();
            const dropdownHeight = 560;
            const dropdownWidth = 420;
            const pad = 12;
            const vh = window.innerHeight;
            const vw = window.innerWidth;
            let left = cellRect.right + pad;
            if (left + dropdownWidth > vw - pad) left = cellRect.left - dropdownWidth - pad;
            left = Math.max(pad, Math.min(left, vw - dropdownWidth - pad));
            const spaceBelow = vh - cellRect.bottom;
            const spaceAbove = cellRect.top;
            let top;
            if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
                top = Math.max(pad, cellRect.top - dropdownHeight);
            } else {
                top = Math.min(cellRect.top, vh - dropdownHeight - pad);
            }
            // viewport 기준으로 위치 설정 (Portal 사용 시)
            setPosition({ top, left });
            setIsPositionReady(true);
        };

        // useLayoutEffect를 사용하여 DOM 업데이트 전에 위치 계산
        updatePosition();

        const handleScroll = () => {
            if (cellRef.current) updatePosition();
        };
        window.addEventListener("scroll", handleScroll, true);
        window.addEventListener("resize", updatePosition);

        return () => {
            if (retryTimer) clearTimeout(retryTimer);
            window.removeEventListener("scroll", handleScroll, true);
            window.removeEventListener("resize", updatePosition);
        };
    }, [cellRef, isMobile]);

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                cellRef.current &&
                !cellRef.current.contains(e.target as Node)
            ) {
                onChange(pack(selected));
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [selected, onChange, onClose, cellRef]);

    const toggleOption = (opt: string) => {
        if (facet.type === "single") {
            // single 타입: 단일 선택만 허용
            setSelected([opt]);
        } else {
            // multi 타입: 다중 선택 허용
            setSelected((prev) => (prev.includes(opt) ? prev.filter((v) => v !== opt) : [...prev, opt]));
        }
    };

    const addTextInput = () => {
        const text = textInput.trim();
        if (!text) return;
        setSelected((prev) => {
            // ✅ IME 꼬리(마지막 1글자) 방어: 기존 선택값의 마지막 글자와 동일한 1글자면 무시
            if (text.length === 1 && prev.some(v => v?.endsWith?.(text))) return prev;
            return uniqNormPush(prev, text);
        });
        setTextInput("");
        setMode(null);
    };

    const addTimeToken = (token: string) => {
        const norm = normalizeHM(token);
        const val = norm || token;
        setTimes((t) => (t.includes(val) ? t : [...t, val]));
    };

    const addTimeRange = () => {
        const s = normalizeHM(startInput);
        if (!s) return;
        const e = normalizeHM(endInput);
        const label = e ? `${s}~${e}` : s;
        setTimes((t) => (t.includes(label) ? t : [...t, label]));
        setStartInput("09:00");
        setEndInput("");
    };

    const commitTimes = () => {
        if (!times.length) return setMode(null);
        setSelected((prev) => uniqNormPush(prev, times.join(" / ")));
        setTimes([]);
        setMode(null);
    };

    const toggleDate = (d: string) =>
        setDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

    const addIsoDate = (iso: string) => iso && setDates((prev) => (prev.includes(iso) ? prev : [...prev, iso]));

    const commitDates = () => {
        if (!dates.length) return setMode(null);
        setSelected((prev) => uniqNormPush(prev, dates.join(" / ")));
        setDates([]);
        setMode(null);
    };

    const structuredOptions = React.useMemo(() => {
        const groups: Array<{ type: "single" | "group"; label?: string; items: string[] }> = [];
        const allFlat: string[] = [];
        const singles: string[] = []; // 개별 옵션들을 모아서 하나의 그룹으로

        (facet.options || []).forEach((opt: any) => {
            if (typeof opt === "string") {
                singles.push(opt);
                allFlat.push(opt);
            } else if (opt?.group && Array.isArray(opt.items)) {
                groups.push({ type: "group", label: opt.group, items: opt.items });
                opt.items.forEach((i: string) => allFlat.push(i));
            }
        });

        // 개별 옵션들이 있으면 하나의 그룹으로 추가
        if (singles.length > 0) {
            groups.unshift({ type: "single", items: singles });
        }

        const customs = (customOptions || []).filter(
            (c: string) => !allFlat.some((b) => normalize(b) === normalize(c))
        );

        return { groups, customs };
    }, [facet.options, customOptions]);

    const handleApply = () => {
        onChange(pack(selected));
        onClose();
    };

    const handleCancel = () => {
        setSelected(unpack(value));
        setMode(null);
        setTextInput("");
        setTimes([]);
        setDates([]);
        onClose();
    };

    const handleChipRemove = (chip: string) => {
        setSelected((prev) => prev.filter((item) => item !== chip));
    };

    // 하단 옵션 편집 핸들러들
    const handleDeleteOption = (optionToDelete: string) => {
        if (!onUpdateFacetOptions) return;

        // facet.options에서 해당 옵션 제거
        const newOptions = (facet.options || [])
            .map((opt: any) => {
                if (typeof opt === 'string') {
                    return opt !== optionToDelete ? opt : null;
                } else if (opt?.group && Array.isArray(opt.items)) {
                    // 그룹 내에서 항목 제거
                    const filteredItems = opt.items.filter((item: string) => item !== optionToDelete);
                    // 그룹 내 항목이 없으면 null 반환 (그룹 제거)
                    return filteredItems.length > 0 ? { ...opt, items: filteredItems } : null;
                }
                return opt;
            })
            .filter((opt: any) => opt !== null); // null 제거

        onUpdateFacetOptions(facet.key, newOptions);
    };

    const handleOptionDragEnd = (event: DragEndEvent, groupIndex: number) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const group = structuredOptions.groups[groupIndex];
        const oldIndex = group.items.indexOf(active.id as string);
        const newIndex = group.items.indexOf(over.id as string);

        if (oldIndex === -1 || newIndex === -1) return;

        const newItems = arrayMove(group.items, oldIndex, newIndex);

        // facet.options 업데이트
        const newOptions = (facet.options || []).map((opt: any, idx: number) => {
            if (idx === groupIndex) {
                if (typeof opt === 'string') {
                    return opt;
                } else if (opt?.group) {
                    return { ...opt, items: newItems };
                }
            }
            return opt;
        });

        onUpdateFacetOptions?.(facet.key, newOptions);
    };

    // Sortable 옵션 아이템 컴포넌트
    const SortableOptionItem = ({ label, groupIdx }: { label: string; groupIdx: number }) => {
        const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
            id: label,
            disabled: !optionEditMode
        });

        const style: React.CSSProperties = {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.5 : 1,
        };

        const active = selected.includes(label);

        return (
            <div
                ref={setNodeRef}
                style={style}
                className="relative"
            >
                <button
                    onClick={() => !optionEditMode && toggleOption(label)}
                    disabled={optionEditMode}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${optionEditMode
                        ? "bg-white text-slate-700 cursor-default"
                        : active
                            ? "bg-blue-600 text-white shadow"
                            : "bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                >
                    {optionEditMode && (
                        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-3 h-3 text-slate-400" />
                        </div>
                    )}
                    <span>{label}</span>
                </button>
                {optionEditMode && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`"${label}" 옵션을 삭제하시겠습니까?`)) {
                                handleDeleteOption(label);
                            }
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center shadow"
                    >
                        ×
                    </button>
                )}
            </div>
        );
    };

    const containerClass = isMobile
        ? "fixed inset-x-0 bottom-0 z-[1000] px-3 pb-4"
        : "fixed z-[1000]"; // 데스크톱에서도 fixed로 변경하여 Portal 사용 시 올바른 위치 계산

    const containerStyle = isMobile
        ? undefined
        : position
            ? {
                top: `${position.top}px`,
                left: `${position.left}px`
            }
            : undefined; // 위치가 계산되기 전까지는 렌더링하지 않으므로 스타일 불필요

    const dropdownJSX = (
        <>
            <div className={containerClass} style={containerStyle}>
                <div className={`w-full ${isMobile ? "max-h-[85vh]" : "w-[420px]"} inline-dropdown-anim`}>
                    <div
                        ref={dropdownRef}
                        className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
                    >
                        <div className="p-4 border-b border-slate-100 relative">
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div>
                                    <p className="text-[11px] uppercase tracking-wide text-slate-400">{facet.key}</p>
                                    <h3 className="text-lg font-semibold text-slate-900">{facet.label}</h3>
                                </div>
                                <button
                                    onClick={handleCancel}
                                    className="w-8 h-8 rounded-full border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center flex-shrink-0"
                                    aria-label="닫기"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="rounded-2xl p-3 bg-slate-50">
                                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                                    <span className="font-medium">{selected.length}개 선택됨</span>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => setMode((prev) => (prev === "text" ? null : "text"))}
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${mode === "text" ? "bg-slate-200 text-slate-700" : "text-slate-500 hover:bg-slate-200"}`}
                                            aria-label="직접 추가"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setMode((prev) => (prev === "time" ? null : "time"))}
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${mode === "time" ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:bg-slate-200"}`}
                                            aria-label="시간 선택"
                                        >
                                            <Clock className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setMode((prev) => (prev === "date" ? null : "date"))}
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${mode === "date" ? "bg-purple-100 text-purple-700" : "text-slate-500 hover:bg-slate-200"}`}
                                            aria-label="날짜 선택"
                                        >
                                            <Calendar className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="min-h-[48px]">
                                    {selected.length === 0 ? (
                                        <p className="text-sm text-slate-400">아직 선택된 값이 없습니다.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {selected.map((chip) => (
                                                <div key={chip} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-sm font-medium border border-slate-200 bg-white text-slate-700">
                                                    <span className="text-slate-800">{chip}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleChipRemove(chip);
                                                        }}
                                                        className="text-slate-400 hover:text-red-500 transition-colors"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {mode === "text" && (
                                    <form
                                        className="flex gap-2 pt-2 mt-2 border-t border-slate-200"
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            addTextInput();
                                        }}
                                    >
                                        <input
                                            autoFocus
                                            type="text"
                                            value={textInput}
                                            onChange={(e) => setTextInput(e.target.value)}
                                            placeholder="직접 입력"
                                            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm"
                                        />
                                        <button
                                            type="submit"
                                            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold"
                                        >
                                            추가
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold text-slate-500">🍭 사용 가능 옵션</p>
                                    <button
                                        onClick={() => setOptionEditMode((prev) => !prev)}
                                        className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${optionEditMode
                                            ? "bg-red-100 text-red-700 hover:bg-red-200"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                            }`}
                                    >
                                        {optionEditMode ? "완료" : "편집"}
                                    </button>
                                </div>

                                {/* 모든 옵션을 한 영역에 표시 */}
                                <div className="rounded-xl bg-slate-50 p-2.5">
                                    {structuredOptions.groups.map((group, groupIdx) => {
                                        const sensors = useSensors(
                                            useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
                                            useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
                                        );

                                        return (
                                            <div key={`group-${groupIdx}`} className="mb-2 last:mb-0">
                                                {group.type === "group" && group.label && (
                                                    <div className="text-[10px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                                                        <span role="img" aria-hidden="true">📂</span> {group.label}
                                                    </div>
                                                )}
                                                <DndContext
                                                    sensors={sensors}
                                                    collisionDetection={closestCenter}
                                                    onDragEnd={(event) => handleOptionDragEnd(event, groupIdx)}
                                                >
                                                    <SortableContext
                                                        items={group.items}
                                                        strategy={horizontalListSortingStrategy}
                                                    >
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {group.items.map((label) => (
                                                                <SortableOptionItem
                                                                    key={label}
                                                                    label={label}
                                                                    groupIdx={groupIdx}
                                                                />
                                                            ))}
                                                        </div>
                                                    </SortableContext>
                                                </DndContext>
                                            </div>
                                        );
                                    })}

                                    {/* 커스텀 옵션도 같은 영역에 표시 */}
                                    {(structuredOptions.customs || []).length > 0 && (
                                        <div className="pt-2 border-t border-slate-200">
                                            <div className="text-[10px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                                                <span role="img" aria-hidden="true">✏️</span> 직접 추가한 옵션
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {(structuredOptions.customs || []).map((label) => {
                                                    const active = selected.includes(label);
                                                    return (
                                                        <div key={`custom-${label}`} className="relative group">
                                                            <button
                                                                onClick={() => toggleOption(label)}
                                                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${active
                                                                    ? "bg-emerald-600 text-white"
                                                                    : "bg-white text-slate-700 hover:bg-slate-100"}`}
                                                            >
                                                                {label}
                                                            </button>
                                                            {onDeleteCustomOption && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (confirm(`"${label}" 옵션을 삭제할까요?`)) onDeleteCustomOption(label);
                                                                    }}
                                                                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    ×
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-3 border-t border-slate-100 bg-white flex gap-2 sticky bottom-0">
                            <button
                                onClick={handleCancel}
                                className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleApply}
                                className="flex-1 h-10 rounded-xl bg-blue-600 text-white font-semibold shadow text-sm hover:bg-blue-700"
                            >
                                적용
                            </button>
                        </div>

                        {mode === "time" && (
                            <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[1001] max-w-sm mx-auto rounded-2xl border border-blue-100 bg-white shadow-2xl overflow-hidden">
                                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                                    <span className="text-sm font-semibold text-blue-700">⏰ 시간 선택</span>
                                    <button onClick={() => setMode(null)} className="text-slate-400 hover:text-slate-600">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="p-4 max-h-[60vh] overflow-y-auto">
                                    {/* 퀵 선택 버튼 */}
                                    <div className="mb-4">
                                        <div className="text-[11px] text-slate-500 font-medium mb-2">빠른 선택</div>
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {quickRanges.map((qr) => (
                                                <button
                                                    key={qr}
                                                    onClick={() => addTimeToken(qr)}
                                                    className="px-2 py-2 rounded-lg text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors"
                                                >
                                                    {qr}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 시간 입력 */}
                                    <div className="mb-4">
                                        <div className="text-[11px] text-slate-500 font-medium mb-2">시간 설정</div>

                                        <div className="flex items-center gap-2 mb-3">
                                            {/* 시작 시간 */}
                                            <input
                                                type="time"
                                                value={startInput}
                                                onChange={(e) => setStartInput(e.target.value)}
                                                className="flex-1 h-11 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />

                                            <span className="text-slate-400">~</span>

                                            {/* 종료 시간 */}
                                            <div className="flex-1 relative">
                                                <input
                                                    type="time"
                                                    value={endInput}
                                                    onChange={(e) => setEndInput(e.target.value)}
                                                    className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:text-slate-700"
                                                    placeholder="선택"
                                                />
                                                {endInput && (
                                                    <button
                                                        onClick={() => setEndInput('')}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* 추가 버튼 */}
                                            <button
                                                onClick={() => {
                                                    addTimeRange();
                                                    setStartInput('09:00');
                                                    setEndInput('');
                                                }}
                                                className="h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm transition-colors flex-shrink-0"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <div className="text-[10px] text-slate-400 px-1">종료 시간은 선택사항입니다</div>
                                    </div>

                                    {/* 선택된 시간 표시 */}
                                    {times.length > 0 && (
                                        <div className="pt-4 border-t border-slate-100">
                                            <div className="text-[11px] text-slate-500 font-medium mb-2">선택된 시간</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {times.map((t) => (
                                                    <span key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-100 text-blue-800 text-xs font-medium">
                                                        {t}
                                                        <button
                                                            onClick={() => setTimes((prev) => prev.filter((x) => x !== t))}
                                                            className="hover:text-red-600 transition-colors"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 하단 버튼 */}
                                <div className="p-3 border-t border-slate-100 bg-white flex gap-2">
                                    <button
                                        onClick={() => {
                                            setTimes([]);
                                            setMode(null);
                                        }}
                                        className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={commitTimes}
                                        className="flex-1 h-11 rounded-xl bg-blue-600 text-white font-semibold shadow text-sm hover:bg-blue-700 transition-colors"
                                    >
                                        적용
                                    </button>
                                </div>
                            </div>
                        )}

                        {mode === "date" && (
                            <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[1001] max-w-sm mx-auto rounded-2xl border border-purple-100 bg-white shadow-2xl">
                                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                                    <span className="text-sm font-semibold text-purple-700">📅 날짜 선택</span>
                                    <button onClick={() => setMode(null)} className="text-slate-400 hover:text-slate-600">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="p-4">
                                    <input
                                        type="date"
                                        value={customDate}
                                        onChange={(e) => {
                                            setCustomDate(e.target.value);
                                            addIsoDate(e.target.value);
                                        }}
                                        className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm mb-3"
                                    />
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {["월", "화", "수", "목", "금", "토", "일", "평일", "주말", "매일", "공휴일", "명절"].map((p) => (
                                            <button
                                                key={p}
                                                onClick={() => toggleDate(p)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${dates.includes(p)
                                                    ? "bg-purple-600 text-white"
                                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                    {dates.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-100 mb-3">
                                            {dates.map((d) => (
                                                <span key={d} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-100 text-purple-800 text-xs font-medium">
                                                    {d}
                                                    <button onClick={() => toggleDate(d)} className="hover:text-red-500">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex gap-2 text-sm">
                                        <button
                                            onClick={() => setMode(null)}
                                            className="flex-1 h-11 rounded-xl border border-slate-200 hover:bg-slate-50 font-medium"
                                        >
                                            취소
                                        </button>
                                        <button
                                            onClick={commitDates}
                                            className="flex-1 h-11 rounded-xl bg-purple-600 text-white hover:bg-purple-700 font-semibold shadow-sm"
                                        >
                                            완료
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );

    // Portal로 감싸서 테이블 컨테이너 overflow 문제 해결 (모바일 + 데스크톱 모두)
    // 데스크톱에서는 fixed positioning과 viewport 기준 위치 계산 사용
    // 위치가 계산되기 전까지는 렌더링하지 않음 (깜빡임 방지)
    if (!isMobile && !position) {
        return null;
    }

    return (
        <>
            <Portal>
                {dropdownJSX}
            </Portal>
            <style jsx>{`
                @keyframes inlineDropdownFade {
                    from {
                        opacity: 0;
                        transform: translateY(12px) scale(0.98);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                .inline-dropdown-anim {
                    animation: inlineDropdownFade 0.18s ease-out;
                }
            `}</style>
        </>
    );
}


// ────────────────────────────────────────────────────────────
// ColumnManageBottomSheet - 미니멀 & 모던 디자인
// ────────────────────────────────────────────────────────────
function ColumnManageBottomSheet({ isOpen, onClose, sheetId, allFacets, visibleKeys, onToggle, onCreate, onReorder, onDelete }: any) {
    const [newFacetName, setNewFacetName] = React.useState("");
    const [localOrder, setLocalOrder] = React.useState<string[]>([]);

    React.useEffect(() => {
        if (isOpen) {
            // 표시 중인 것 먼저, 숨겨진 것 나중에
            const visible = allFacets.filter((f: any) => visibleKeys.includes(f.key)).map((f: any) => f.key);
            const hidden = allFacets.filter((f: any) => !visibleKeys.includes(f.key)).map((f: any) => f.key);
            setLocalOrder([...visible, ...hidden]);
        }
    }, [isOpen, allFacets, visibleKeys]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setLocalOrder((items) => {
            const oldIndex = items.indexOf(active.id as string);
            const newIndex = items.indexOf(over.id as string);
            const newOrder = arrayMove(items, oldIndex, newIndex);

            // 표시 중인 항목들의 순서만 업데이트
            const visibleInNewOrder = newOrder.filter(key => visibleKeys.includes(key));
            onReorder(visibleInNewOrder);

            return newOrder;
        });
    };

    const addNewFacet = () => {
        const name = newFacetName.trim();
        if (!name) return;

        // key 생성 - 전체 문자열을 하나의 key로 변환
        // 공백을 언더스코어로, 특수문자 제거
        const key = name
            .toLowerCase()
            .replace(/\s+/g, "_")  // 공백을 언더스코어로
            .replace(/[^\w가-힣]/g, "");  // 특수문자 제거, 한글/영문/숫자만

        // 중복 체크
        if (allFacets.some((f: any) => f.key === key)) {
            alert("이미 존재하는 열입니다.");
            return;
        }

        onCreate({
            key: key,
            label: name,
            type: "multi",
            options: [],
        });
        setNewFacetName("");
    };

    const presetFacets = SHEET_TEMPLATES[sheetId]?.facets || [];
    const availablePresets = presetFacets.filter(
        (pf: any) => !allFacets.some((f: any) => f.key === pf.key)
    );

    return (
        <MobileBottomSheet isOpen={isOpen} onClose={onClose} title="열 관리">
            <div className="space-y-5">
                {/* 통합된 열 관리 */}
                <div>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
                            <div className="space-y-1.5">
                                {localOrder.map((key) => {
                                    const facet = allFacets.find((f: any) => f.key === key);
                                    if (!facet) return null;
                                    const isVisible = visibleKeys.includes(key);

                                    return (
                                        <SortableColumnItem
                                            key={key}
                                            id={key}
                                            facet={facet}
                                            isVisible={isVisible}
                                            onToggle={() => onToggle(key, !isVisible)}
                                            onDelete={() => onDelete(key)}
                                        />
                                    );
                                })}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>

                {/* 새 열 추가 */}
                <div className="pt-3 border-t border-gray-100">
                    <div className="flex gap-2 mb-2">
                        <input
                            type="text"
                            value={newFacetName}
                            onChange={(e) => setNewFacetName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addNewFacet()}
                            placeholder="새 열 추가..."
                            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                            onClick={addNewFacet}
                            disabled={!newFacetName.trim()}
                            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                            추가
                        </button>
                    </div>

                    {/* 프리셋 */}
                    {availablePresets.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {availablePresets.map((pf: any) => (
                                <button
                                    key={pf.key}
                                    onClick={() => {
                                        onCreate(pf);
                                        onToggle(pf.key, true);
                                    }}
                                    className="px-2.5 py-1 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors font-medium"
                                >
                                    {pf.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </MobileBottomSheet>
    );
}

// 미니멀한 Sortable 열 아이템
function SortableColumnItem({ id, facet, isVisible, onToggle, onDelete }: any) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const [isHovered, setIsHovered] = React.useState(false);

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    // 핵심 facet만 삭제 불가 (필수 기준)
    const coreRequiredFacets = ['existence', 'handover', 'notes'];
    const isDeletable = !coreRequiredFacets.includes(facet.key);


    return (
        <div
            ref={setNodeRef}
            style={style}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isVisible
                ? 'bg-white hover:bg-gray-50 border border-gray-200'
                : 'bg-gray-50 hover:bg-gray-100 opacity-60 border border-gray-200'
                }`}
        >
            {/* 드래그 핸들 - 항상 표시 */}
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing touch-none"
            >
                <GripVertical className="w-5 h-5 text-gray-400" />
            </div>

            {/* 열 정보 */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <div className={`text-sm font-medium truncate ${isVisible ? 'text-gray-900' : 'text-gray-500'
                        }`}>
                        {facet.label}
                    </div>
                    {facet.type === 'library-ref' && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-medium whitespace-nowrap">
                            📚 라이브러리
                        </span>
                    )}
                </div>
                <div className="text-xs text-gray-400 truncate">{facet.key}</div>
            </div>

            {/* 삭제 버튼 - hover 시에만 표시 (커스텀 열만) */}
            {isDeletable && isHovered && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`"${facet.label}" 열을 삭제하시겠습니까?\n\n해당 열의 모든 데이터가 삭제됩니다.`)) {
                            onDelete();
                        }
                    }}
                    className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="삭제"
                >
                    <X className="w-4 h-4" />
                </button>
            )}

            {/* 미니멀 토글 */}
            <button
                onClick={onToggle}
                className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${isVisible ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
            >
                <div
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isVisible ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                />
            </button>
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// Row 컴포넌트 (기존 유지)
// ────────────────────────────────────────────────────────────
function Row({ row, children, isEditMode = false }: any) {
    const { attributes, listeners, setNodeRef, style, isDragging } = useSortableRow(row.id);
    return (
        <tr ref={setNodeRef} style={style} className={`hover:bg-gray-50 transition-colors ${isDragging ? "opacity-50" : ""}`}>
            {isEditMode && (
                <td className="px-1 align-top w-8">
                    <div className="flex items-center justify-center h-10">
                        <div
                            {...attributes}
                            {...listeners}
                            className="cursor-grab active:cursor-grabbing p-1 touch-none"
                        >
                            <GripVertical className="w-4 h-4 text-gray-400" />
                        </div>
                    </div>
                </td>
            )}
            {children}
        </tr>
    );
}

// ────────────────────────────────────────────────────────────
// CellEditor (기존 유지)
// ────────────────────────────────────────────────────────────
function CellEditor({ row, facet, sheetId, openDropdown, setOpenDropdown, updateCell, addCustomOption, deleteCustomOption, customOptions, isEditMode = false, onUpdateFacetOptions, library }: any) {
    const cellRef = React.useRef<HTMLButtonElement | HTMLTextAreaElement | null>(null);
    const dropdownRef = React.useRef<HTMLDivElement | null>(null);
    const value = row.facets[facet.key] || "";
    const values = unpack(value);
    const displayText =
        values.length === 0 ? "선택" : values.length === 1 ? values[0] : values.length === 2 ? values.join(", ") : `${values[0]} 외 ${values.length - 1}개`;
    const isOpen = openDropdown?.rowId === row.id && openDropdown?.facetKey === facet.key;
    const customKey = `${sheetId}::${facet.key}`;

    // 드롭다운 외부 클릭 시 닫기
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                cellRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                !cellRef.current.contains(event.target as Node)
            ) {
                // 라이브러리 참조 드롭다운이 열려있는지 확인
                const dropdownId = `${row.id}-${facet.key}`;
                if (openDropdown === dropdownId) {
                    setOpenDropdown(null);
                }
            }
        };

        // 라이브러리 참조 타입이고 드롭다운이 열려있을 때만 리스너 추가
        if (facet.type === 'library-ref' && openDropdown === `${row.id}-${facet.key}`) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [facet.type, openDropdown, row.id, facet.key, setOpenDropdown]);

    // existence 체크박스 확인 - 체크되지 않으면 다른 필드 비활성화
    const existenceValue = row.facets["existence"];
    const isExistenceChecked = existenceValue === "true" || existenceValue === true;
    const isDisabled = facet.key !== "existence" && facet.key !== "notes" && facet.key !== "handover" && !isExistenceChecked;

    // 체크박스 타입 처리
    if (facet.type === "checkbox") {
        const isChecked = value === "true" || value === true;
        return (
            <td className="px-3 py-2 align-top min-w-[80px]">
                <div className="flex items-center justify-center">
                    {isEditMode ? (
                        <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => updateCell(row.id, facet.key, String(e.target.checked))}
                            className="w-5 h-5 accent-blue-600 rounded cursor-pointer border-2 border-gray-300 checked:bg-blue-600 checked:border-blue-600"
                            style={{
                                WebkitAppearance: 'checkbox',
                                appearance: 'checkbox',
                            }}
                        />
                    ) : (
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isChecked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                            {isChecked && <Check className="w-3 h-3 text-white" />}
                        </div>
                    )}
                </div>
            </td>
        );
    }

    // 텍스트에어리어 타입 처리 (클릭 시 모달로 입력)
    if (facet.type === "textarea") {
        const [isModalOpen, setIsModalOpen] = React.useState(false);
        const [modalValue, setModalValue] = React.useState(value);

        const handleSave = () => {
            updateCell(row.id, facet.key, modalValue);
            setIsModalOpen(false);
        };

        return (
            <td className="px-3 py-2 align-top min-w-[140px] max-w-[200px]">
                {isEditMode ? (
                    <>
                        <button
                            onClick={() => {
                                setModalValue(value);
                                setIsModalOpen(true);
                            }}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-left hover:border-gray-400 transition-colors bg-white min-h-[40px] max-h-[60px] flex items-center overflow-hidden"
                        >
                            {value ? (
                                <span className="text-gray-900 line-clamp-2 w-full">{value}</span>
                            ) : (
                                <span className="text-gray-400">자유 입력</span>
                            )}
                        </button>

                        {/* 모달 - Portal로 렌더링하여 테이블 컨테이너 overflow 문제 해결 */}
                        {isModalOpen && (
                            <Portal>
                                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
                                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                        {/* 헤더 */}
                                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                                            <h3 className="text-lg font-semibold text-gray-900">비고</h3>
                                            <button
                                                onClick={() => setIsModalOpen(false)}
                                                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
                                            >
                                                <X className="w-5 h-5 text-gray-500" />
                                            </button>
                                        </div>

                                        {/* 내용 */}
                                        <div className="p-6">
                                            <textarea
                                                value={modalValue}
                                                onChange={(e) => setModalValue(e.target.value)}
                                                placeholder="답변시 참고 할 사항이 있다면 입력해주세요."
                                                rows={8}
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                                                autoFocus
                                            />
                                        </div>

                                        {/* 하단 버튼 */}
                                        <div className="flex items-center gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
                                            <button
                                                onClick={() => setIsModalOpen(false)}
                                                className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                                            >
                                                취소
                                            </button>
                                            <button
                                                onClick={handleSave}
                                                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors"
                                            >
                                                저장
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </Portal>
                        )}
                    </>
                ) : (
                    <div className="px-3 py-2 text-sm text-gray-700 min-h-[40px] max-h-[60px] flex items-center overflow-hidden">
                        <span className="line-clamp-2 w-full">{value || <span className="text-gray-400">-</span>}</span>
                    </div>
                )}
            </td>
        );
    }

    // single 타입 처리 - 단일 선택 (담당자 전달용)
    if (facet.type === "single") {
        return (
            <td className="px-3 py-2 align-top min-w-[140px] max-w-[200px]">
                {isEditMode ? (
                    <>
                        <button
                            ref={cellRef as any}
                            onClick={() => !isDisabled && setOpenDropdown({ rowId: row.id, facetKey: facet.key, cellRef })}
                            disabled={isDisabled}
                            className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center justify-between ${isDisabled
                                ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
                                : value
                                    ? "border-gray-300 bg-blue-50 text-blue-900 hover:border-blue-400"
                                    : "border-gray-200 text-gray-400 hover:border-gray-300"
                                }`}
                        >
                            <span className="block text-sm line-clamp-2 flex-1 min-w-0">{isDisabled ? "-" : (value || "선택")}</span>
                            {!isDisabled && <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2" />}
                        </button>

                        {isOpen && !isDisabled && (
                            <InlineDropdown
                                row={row}
                                cellRef={cellRef}
                                facet={facet}
                                value={value}
                                onChange={(newValue: string) => {
                                    updateCell(row.id, facet.key, newValue);
                                }}
                                onClose={() => setOpenDropdown(null)}
                                customOptions={[]}
                                onDeleteCustomOption={() => { }}
                                onUpdateFacetOptions={onUpdateFacetOptions}
                                library={library}
                                openDropdown={openDropdown}
                                setOpenDropdown={setOpenDropdown}
                                isEditMode={isEditMode}
                            />
                        )}
                    </>
                ) : (
                    <div className="px-3 py-2 text-sm text-gray-700 min-h-[40px] max-h-[60px] flex items-center overflow-hidden">
                        <span className="line-clamp-2 w-full">{isDisabled ? "-" : (value || <span className="text-gray-400">-</span>)}</span>
                    </div>
                )}
            </td>
        );
    }

    // library-ref 타입 처리 - InlineDropdown에서 직접 버튼과 드롭다운 렌더링
    if (facet.type === "library-ref") {
        const libraryType = facet.libraryType || "links";
        const libraryItems = library?.[libraryType] || {};

        // 라이브러리에 존재하는 항목만 필터링
        const validValues = React.useMemo(() => {
            return values.filter((v: string) => libraryItems[v] != null);
        }, [values, libraryItems]);

        // 라이브러리 항목이 삭제되었을 때 자동으로 정리
        React.useEffect(() => {
            if (validValues.length !== values.length && isEditMode) {
                // 삭제된 항목이 있으면 자동으로 업데이트
                const cleanedValue = validValues.length > 0 ? pack(validValues) : "";
                if (cleanedValue !== value) {
                    updateCell(row.id, facet.key, cleanedValue);
                }
            }
        }, [validValues.length, values.length, isEditMode, value, row.id, facet.key, updateCell]);

        return (
            <td className="px-3 py-2 align-top min-w-[140px] max-w-[200px]">
                {isEditMode ? (
                    <InlineDropdown
                        row={row}
                        cellRef={cellRef}
                        facet={facet}
                        value={validValues.length > 0 ? pack(validValues) : ""}
                        onChange={(newValue: string) => {
                            updateCell(row.id, facet.key, newValue);
                        }}
                        onClose={() => setOpenDropdown(null)}
                        customOptions={[]}
                        onDeleteCustomOption={() => { }}
                        onUpdateFacetOptions={onUpdateFacetOptions}
                        library={library}
                        openDropdown={openDropdown}
                        setOpenDropdown={setOpenDropdown}
                        isEditMode={isEditMode}
                    />
                ) : (
                    <div className="px-3 py-2 text-sm min-h-[40px] max-h-[60px] flex items-center overflow-hidden">
                        {validValues.length > 0 ? (
                            <div className="flex flex-wrap gap-1 w-full">
                                {validValues.map((v: string, idx: number) => {
                                    const item = libraryItems[v];
                                    const label = item?.label || item?.name || v;
                                    return (
                                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-medium line-clamp-1 max-w-full">
                                            {label}
                                        </span>
                                    );
                                })}
                            </div>
                        ) : (
                            <span className="text-gray-400">-</span>
                        )}
                    </div>
                )}
            </td>
        );
    }

    // 기본 multi 타입 처리 - existence 비활성화 로직 적용
    return (
        <td className="px-3 py-2 align-top min-w-[140px] max-w-[200px]">
            {isEditMode ? (
                <>
                    <button
                        ref={cellRef as any}
                        onClick={() => !isDisabled && setOpenDropdown({ rowId: row.id, facetKey: facet.key, cellRef })}
                        disabled={isDisabled}
                        className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center justify-between ${isDisabled
                            ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
                            : values.length > 0
                                ? "border-gray-300 bg-blue-50 text-blue-900 hover:border-blue-400"
                                : "border-gray-200 text-gray-400 hover:border-gray-300"
                            }`}
                    >
                        <span className="block text-sm line-clamp-2 flex-1 min-w-0">{isDisabled ? "-" : displayText}</span>
                        {!isDisabled && <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2" />}
                    </button>

                    {isOpen && !isDisabled && (
                        <InlineDropdown
                            row={row}
                            cellRef={cellRef}
                            facet={facet}
                            value={value}
                            onChange={(newValue: string) => {
                                updateCell(row.id, facet.key, newValue);
                                const added = unpack(newValue).filter((v) => !unpack(value).includes(v));
                                added.forEach((opt) => addCustomOption(customKey, opt));
                            }}
                            onClose={() => setOpenDropdown(null)}
                            customOptions={customOptions[customKey] || []}
                            onDeleteCustomOption={(opt: string) => deleteCustomOption(customKey, opt)}
                            onUpdateFacetOptions={onUpdateFacetOptions}
                            library={library}
                            openDropdown={openDropdown}
                            setOpenDropdown={setOpenDropdown}
                            isEditMode={isEditMode}
                        />
                    )}
                </>
            ) : (
                <div className="px-3 py-2 text-sm min-h-[40px] max-h-[60px] flex items-center overflow-hidden">
                    {isDisabled ? (
                        <span className="text-gray-400">-</span>
                    ) : values.length > 0 ? (
                        <div className="flex flex-wrap gap-1 w-full">
                            {values.map((v: string, idx: number) => (
                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-medium line-clamp-1 max-w-full">
                                    {v}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <span className="text-gray-400">-</span>
                    )}
                </div>
            )}
        </td>
    );
}

function FacetPivotView({ sheetId, template, items, onToggleMembership, customOptions, addCustomOption, isEditMode, library }: any) {
    // 체크박스 타입 제외한 facet만 사용
    const availableFacets = React.useMemo(() =>
        template.facets.filter((f: any) => f.type !== 'checkbox'),
        [template.facets]
    );

    const [facetKey, setFacetKey] = React.useState(() => (availableFacets?.[0]?.key || ""));
    const [viewType, setViewType] = React.useState<"grid" | "card">("card"); // 뷰 타입 상태

    const facet = React.useMemo(() =>
        availableFacets.find((f: any) => f.key === facetKey) || availableFacets[0] || null,
        [facetKey, availableFacets]
    );

    const options: string[] = React.useMemo(() => {
        if (!facet) return [];

        // 라이브러리 참조 타입인 경우
        if (facet.type === 'library-ref') {
            const libraryType = facet.libraryType || 'links';
            const libraryItems = library?.[libraryType] || {};
            return Object.keys(libraryItems);
        }

        // 일반 타입
        const base: string[] = [];
        (facet.options || []).forEach((opt: any) => {
            if (typeof opt === "string") base.push(opt);
            else if (opt?.group) (opt.items || []).forEach((i: string) => base.push(i));
        });
        const customKey = `${sheetId}::${facet.key}`;
        const customs = (customOptions[customKey] || []).filter((c: string) => !base.some((b) => normalize(b) === normalize(c)));
        return [...base, ...customs];
    }, [facet, sheetId, customOptions, library]);

    const [newOpt, setNewOpt] = React.useState("");
    const [optionError, setOptionError] = React.useState("");

    const addOpt = () => {
        const v = newOpt.trim();

        if (!v) {
            setOptionError("옵션 이름을 입력하세요");
            return;
        }

        if (!facet) {
            setOptionError("기준을 선택하세요");
            return;
        }

        const customKey = `${sheetId}::${facet.key}`;
        const existingOptions = [...(facet.options || []), ...(customOptions[customKey] || [])];
        const allOptions = existingOptions.map(opt =>
            typeof opt === 'string' ? opt : opt?.items || []
        ).flat();

        if (allOptions.some((opt: string) => normalize(opt) === normalize(v))) {
            setOptionError("이미 존재하는 옵션입니다");
            return;
        }

        addCustomOption(customKey, v);
        setNewOpt("");
        setOptionError("");
    };

    // 옵션별로 아이템 그룹핑 (카드 뷰용)
    const groupedByOption = React.useMemo(() => {
        if (!facet) return {};
        const groups: Record<string, any[]> = {};

        // 라이브러리 참조 타입인 경우 라이브러리 항목 가져오기
        const libraryType = facet.type === 'library-ref' ? (facet.libraryType || 'links') : null;
        const libraryItems = libraryType ? (library?.[libraryType] || {}) : null;

        options.forEach(option => {
            groups[option] = items.filter((item: any) => {
                const values = unpack(item.facets?.[facet.key] || "");
                // 라이브러리 참조 타입인 경우 라이브러리에 존재하는 항목만 필터링
                const validValues = libraryItems
                    ? values.filter((v: string) => libraryItems[v] != null)
                    : values;
                return validValues.some((v: string) => normalize(v) === normalize(option));
            });
        });

        return groups;
    }, [facet, options, items, library]);

    // 라이브러리 참조 타입의 옵션 라벨 가져오기
    const getOptionLabel = (optionKey: string) => {
        if (facet?.type === 'library-ref') {
            const libraryType = facet.libraryType || 'links';
            const libraryItems = library?.[libraryType] || {};
            return libraryItems[optionKey]?.label || optionKey;
        }
        return optionKey;
    };

    if (!facet || items.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <p className="text-gray-400">기준별 보기를 사용하려면 먼저 항목을 추가하세요.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 sm:space-y-4">
            {/* 헤더 - 모바일 최적화 */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2">
                    <Columns className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                    <span className="text-sm sm:text-base font-semibold text-gray-900">기준별 보기</span>
                </div>

                {/* 컨트롤 영역 - 모바일에서 세로 정렬 */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                    {/* 뷰 타입 토글 */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setViewType("card")}
                            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewType === "card"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                                }`}
                        >
                            카드
                        </button>
                        <button
                            onClick={() => setViewType("grid")}
                            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewType === "grid"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                                }`}
                        >
                            그리드
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">보기 기준:</label>
                        <select
                            value={facet?.key || ""}
                            onChange={(e) => setFacetKey(e.target.value)}
                            className="flex-1 h-9 sm:h-10 px-2 sm:px-3 pr-8 rounded-lg border border-gray-300 bg-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-gray-900 focus:border-transparent min-w-[120px] sm:min-w-[150px]"
                        >
                            {availableFacets.map((f: any) => (
                                <option key={f.key} value={f.key}>
                                    {f.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* 카드 뷰 */}
            {viewType === "card" && (
                <div className="space-y-3">
                    {options.map(option => {
                        const itemsInGroup = groupedByOption[option] || [];

                        return (
                            <div key={option} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                {/* 옵션 헤더 */}
                                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-gray-900">{getOptionLabel(option)}</h3>
                                        <span className="text-xs text-gray-500">
                                            {itemsInGroup.length}개 항목
                                        </span>
                                    </div>
                                </div>

                                {/* 항목 리스트 - 멀티셀렉 */}
                                <div className="p-3">
                                    {isEditMode ? (
                                        <>
                                            {/* 편집 모드: 멀티셀렉 */}
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {items.map((item: any) => {
                                                    const isSelected = itemsInGroup.find((i: any) => i.id === item.id);
                                                    return (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => onToggleMembership(item.id, facet.key, option, !isSelected)}
                                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isSelected
                                                                ? "bg-gray-900 text-white"
                                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                                }`}
                                                        >
                                                            {item.name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-xs text-gray-500">클릭하여 항목을 추가/제거하세요</p>
                                        </>
                                    ) : (
                                        <>
                                            {/* 일반 모드: 선택된 항목만 표시 */}
                                            {itemsInGroup.length > 0 ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {itemsInGroup.map((item: any) => (
                                                        <div
                                                            key={item.id}
                                                            className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm text-gray-700"
                                                        >
                                                            {item.name}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-400 py-2">이 옵션에 해당하는 항목이 없습니다</p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* 새 옵션 추가 (편집 모드) */}
                    {isEditMode && facet?.type !== 'library-ref' && (
                        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-4">
                            <div className="flex items-center gap-2">
                                <input
                                    value={newOpt}
                                    onChange={(e) => {
                                        setNewOpt(e.target.value);
                                        setOptionError("");
                                    }}
                                    onKeyDown={(e) => e.key === "Enter" && addOpt()}
                                    placeholder={`새 ${facet?.label || '옵션'} 추가 (예: 6층, 옥상)`}
                                    className={`flex-1 px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent ${optionError ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                                        }`}
                                />
                                <button
                                    onClick={addOpt}
                                    disabled={!newOpt.trim()}
                                    className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                                >
                                    추가
                                </button>
                            </div>
                            {optionError && (
                                <p className="text-xs text-red-600 mt-2">{optionError}</p>
                            )}
                        </div>
                    )}

                    {/* 라이브러리 참조 타입 안내 */}
                    {facet?.type === 'library-ref' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-start gap-2">
                                <span className="text-blue-600 text-lg">📚</span>
                                <div>
                                    <p className="text-sm font-medium text-blue-900">라이브러리 참조 필드</p>
                                    <p className="text-xs text-blue-700 mt-1">
                                        이 필드는 <strong>라이브러리 탭</strong>에서 관리됩니다.
                                        새 항목을 추가하려면 상단의 라이브러리 탭으로 이동하세요.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 그리드 뷰 - 스크롤 시 헤더/첫열 고정 */}
            {viewType === "grid" && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto max-h-[70vh] overflow-y-auto relative">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b sticky top-0 z-20">
                                <tr>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-[140px] sticky left-0 bg-gray-50 z-30 border-r border-gray-200">
                                        {facet?.label || "기준"}
                                    </th>
                                    {items.map((it: any) => (
                                        <th key={it.id} className="px-2 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-[100px] bg-gray-50">
                                            {it.name || "(이름 없음)"}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {options.map((opt) => (
                                    <tr key={opt} className="hover:bg-gray-50">
                                        <td className="px-3 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-200">
                                            {getOptionLabel(opt)}
                                        </td>
                                        {items.map((it: any) => {
                                            const rawValues = unpack(it.facets?.[facet.key] || "");
                                            // 라이브러리 참조 타입인 경우 라이브러리에 존재하는 항목만 필터링
                                            const libraryType = facet?.type === 'library-ref' ? (facet.libraryType || 'links') : null;
                                            const libraryItems = libraryType ? (library?.[libraryType] || {}) : null;
                                            const values = libraryItems
                                                ? rawValues.filter((v: string) => libraryItems[v] != null)
                                                : rawValues;
                                            const active = values.some((v: string) => normalize(v) === normalize(opt));
                                            return (
                                                <td key={it.id + opt} className="px-2 py-2 bg-white">
                                                    <button
                                                        onClick={() => isEditMode && onToggleMembership(it.id, facet.key, opt, !active)}
                                                        disabled={!isEditMode}
                                                        className={`w-full h-10 rounded-lg border-2 border-dashed text-sm font-medium transition-all ${active
                                                            ? "bg-gray-900 text-white border-gray-900 border-solid"
                                                            : "bg-white text-gray-400 border-gray-300 hover:border-gray-900 hover:text-gray-900"
                                                            } ${!isEditMode ? "cursor-default" : "cursor-pointer"}`}
                                                    >
                                                        {active ? "✓" : "+"}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* 새 옵션 추가 (편집 모드) */}
                    {isEditMode && facet?.type !== 'library-ref' && (
                        <div className="border-t border-gray-200 p-4 bg-gray-50">
                            <div className="flex items-center gap-2">
                                <input
                                    value={newOpt}
                                    onChange={(e) => {
                                        setNewOpt(e.target.value);
                                        setOptionError("");
                                    }}
                                    onKeyDown={(e) => e.key === "Enter" && addOpt()}
                                    placeholder={`새 ${facet?.label || '옵션'} 추가 (예: 6층, 옥상)`}
                                    className={`flex-1 px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent ${optionError ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                                        }`}
                                />
                                <button
                                    onClick={addOpt}
                                    disabled={!newOpt.trim()}
                                    className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                                >
                                    추가
                                </button>
                            </div>
                            {optionError && (
                                <p className="text-xs text-red-600 mt-2">{optionError}</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// LinkLibraryBottomSheet - 링크 라이브러리 관리
// ────────────────────────────────────────────────────────────
function LinkLibraryBottomSheet({ isOpen, onClose, linkLibrary, onUpdate }: any) {
    const [editingKey, setEditingKey] = React.useState<string | null>(null);
    const [editLabel, setEditLabel] = React.useState("");
    const [editValue, setEditValue] = React.useState("");
    const [editType, setEditType] = React.useState<"link" | "password">("link");
    const [newLabel, setNewLabel] = React.useState("");
    const [newValue, setNewValue] = React.useState("");
    const [newType, setNewType] = React.useState<"link" | "password">("link");

    const links = Object.entries(linkLibrary || {}).map(([key, data]: [string, any]) => ({
        key,
        ...data
    }));

    const startEdit = (link: any) => {
        setEditingKey(link.key);
        setEditLabel(link.label);
        setEditValue(link.value);
        setEditType(link.type || "link");
    };

    const saveEdit = () => {
        if (!editingKey || !editLabel.trim() || !editValue.trim()) return;

        const updated = {
            ...linkLibrary,
            [editingKey]: {
                label: editLabel.trim(),
                value: editValue.trim(),
                type: editType
            }
        };
        onUpdate(updated);
        setEditingKey(null);
    };

    const deleteLink = (key: string) => {
        if (!confirm("이 링크를 삭제하시겠습니까?")) return;
        const updated = { ...linkLibrary };
        delete updated[key];
        onUpdate(updated);
    };

    const addNew = () => {
        if (!newLabel.trim() || !newValue.trim()) return;

        const key = newLabel.toLowerCase().replace(/\s+/g, "_").replace(/[^\w가-힣]/g, "");
        if (linkLibrary[key]) {
            alert("이미 존재하는 링크입니다.");
            return;
        }

        const updated = {
            ...linkLibrary,
            [key]: {
                label: newLabel.trim(),
                value: newValue.trim(),
                type: newType
            }
        };
        onUpdate(updated);
        setNewLabel("");
        setNewValue("");
        setNewType("link");
    };

    return (
        <MobileBottomSheet isOpen={isOpen} onClose={onClose} title="링크 라이브러리">
            <div className="space-y-4">
                {/* 기존 링크 목록 */}
                <div className="space-y-2">
                    {links.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">
                            등록된 링크가 없습니다
                        </p>
                    ) : (
                        links.map((link) => (
                            <div key={link.key} className="bg-white border border-gray-200 rounded-lg p-3">
                                {editingKey === link.key ? (
                                    <div className="space-y-2">
                                        <input
                                            value={editLabel}
                                            onChange={(e) => setEditLabel(e.target.value)}
                                            placeholder="링크 이름"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900"
                                        />
                                        <input
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            placeholder="URL 또는 비밀번호"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900"
                                        />
                                        <select
                                            value={editType}
                                            onChange={(e) => setEditType(e.target.value as "link" | "password")}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900"
                                        >
                                            <option value="link">링크</option>
                                            <option value="password">비밀번호</option>
                                        </select>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={saveEdit}
                                                className="flex-1 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                                            >
                                                저장
                                            </button>
                                            <button
                                                onClick={() => setEditingKey(null)}
                                                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                                            >
                                                취소
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="flex items-start justify-between mb-1">
                                            <div className="flex-1">
                                                <h4 className="font-medium text-gray-900 text-sm">{link.label}</h4>
                                                <p className="text-xs text-gray-500 mt-0.5 break-all">{link.value}</p>
                                                <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                                    {link.type === "link" ? "링크" : "비밀번호"}
                                                </span>
                                            </div>
                                            <div className="flex gap-1 ml-2">
                                                <button
                                                    onClick={() => startEdit(link)}
                                                    className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => deleteLink(link.key)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* 새 링크 추가 */}
                <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">새 링크 추가</h3>
                    <div className="space-y-2">
                        <input
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            placeholder="링크 이름 (예: 스터디룸 예약)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900"
                        />
                        <input
                            value={newValue}
                            onChange={(e) => setNewValue(e.target.value)}
                            placeholder="URL 또는 비밀번호 (예: www.study.com)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900"
                        />
                        <select
                            value={newType}
                            onChange={(e) => setNewType(e.target.value as "link" | "password")}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900"
                        >
                            <option value="link">링크</option>
                            <option value="password">비밀번호</option>
                        </select>
                        <button
                            onClick={addNew}
                            disabled={!newLabel.trim() || !newValue.trim()}
                            className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                            추가
                        </button>
                    </div>
                </div>
            </div>
        </MobileBottomSheet>
    );
}

// ─────────────────────────────────────────────────────────────────────
// 🚀 메인 컴포넌트 (UI만 개선, 로직은 기존 유지)
// ─────────────────────────────────────────────────────────────────────
export default function CriteriaSheetEditor({ tenantId, initialData, templates, onSave, library }: any) {
    // 디버깅: library prop 확인
    React.useEffect(() => {
        console.log('CriteriaSheetEditor - Library prop:', {
            library,
            libraryType: typeof library,
            libraryKeys: library ? Object.keys(library) : 'library is undefined',
            libraryLinks: library?.links,
            libraryPasswords: library?.passwords,
            libraryRules: library?.rules,
            libraryInfo: library?.info,
        });
    }, [library]);

    // 기존 상태 관리 로직 그대로 유지
    const [data, setData] = React.useState<any>(() => {
        const defaults = {
            schemaVersion: "v2",
            sheets: ["공간", "시설"],
            activeSheet: "공간",
            items: {},
            customOptions: {},
            visibleFacets: {},
        };

        if (initialData && typeof initialData === "object") {
            const merged = { ...defaults, ...initialData };

            // items 구조 정규화
            const normalizedItems: Record<string, any[]> = {};
            if (merged.items && typeof merged.items === "object" && !Array.isArray(merged.items)) {
                Object.entries(merged.items).forEach(([sheetId, rows]) => {
                    normalizedItems[sheetId] = Array.isArray(rows) ? rows : [];
                });
            } else if (Array.isArray(merged.items)) {
                merged.items.forEach((entry: any) => {
                    const sheetId = entry?.sheetId || merged.sheets?.[0] || defaults.sheets[0];
                    (normalizedItems[sheetId] ||= []).push(entry);
                });
            } else {
                Object.entries(initialData).forEach(([key, value]) => {
                    if (Array.isArray(value) && key !== "sheets" && key !== "templates" && key !== "updatedAt") {
                        normalizedItems[key] = value;
                    }
                });
            }

            // sheets 배열 정리: templates, updatedAt 제거
            if (Array.isArray(merged.sheets)) {
                merged.sheets = merged.sheets.filter((s: string) =>
                    s !== 'templates' &&
                    s !== 'updatedAt' &&
                    s.trim() !== ''
                );
            }

            // sheets가 비어있으면 items 키에서 추출
            if (!merged.sheets || merged.sheets.length === 0) {
                const keys = Object.keys(initialData);
                const validSheets = keys.filter((k) =>
                    Array.isArray(initialData[k]) &&
                    k !== 'sheets' &&
                    k !== 'templates' &&
                    k !== 'updatedAt'
                );
                merged.sheets = validSheets.length > 0 ? validSheets : defaults.sheets;
            }

            // activeSheet가 templates이거나 유효하지 않으면 첫 번째 시트로
            if (!merged.activeSheet || merged.activeSheet === 'templates' || !merged.sheets.includes(merged.activeSheet)) {
                merged.activeSheet = merged.sheets[0];
            }

            // 🔥 각 시트에 items가 없으면 빈 배열로 초기화
            merged.sheets.forEach((sheetId: string) => {
                if (!normalizedItems[sheetId]) {
                    normalizedItems[sheetId] = [];
                }
            });

            merged.items = normalizedItems;

            return merged;
        }

        // 완전 초기 상태일 때는 빈 시트

        const initialItems: any = {};
        defaults.sheets.forEach((sheetId: string) => {
            const presets = PRESET_ITEMS[sheetId] || [];

            // required 항목만 자동 추가
            const requiredItems = presets
                .filter((p: any) => p.required === true)
                .map((p: any, idx: number) => ({
                    id: `init_${sheetId}_${Date.now()}_${idx}`,
                    name: p.name,
                    icon: p.icon,
                    facetRefs: { existence: ["없음"] },
                    order: idx,
                    createdAt: Date.now(),
                }));

            initialItems[sheetId] = requiredItems;
        });
        return {
            ...defaults,
            items: initialItems,
        };
    });

    const [viewMode, setViewMode] = React.useState<"item" | "facet">("item");
    const [openDropdown, setOpenDropdown] = React.useState<any>(null);

    // ---- 레이아웃 계산 ----
    const headerRef = React.useRef<HTMLDivElement | null>(null);
    const [headerH, setHeaderH] = React.useState(0);
    const [scrolled, setScrolled] = React.useState(false);

    // 하단 탭바/액션바 높이 가정(필요시 조절)
    const TABBAR_H = 64;     // 하단 네비 높이
    const ACTIONBAR_H = 56;  // 항목 추가 바 높이

    React.useEffect(() => {
        const r = () => setHeaderH(headerRef.current?.getBoundingClientRect().height || 0);
        r();
        window.addEventListener("resize", r);
        return () => window.removeEventListener("resize", r);
    }, []);

    // 상단 고정 영역 높이 측정
    const fixedTopRef = React.useRef<HTMLDivElement | null>(null);
    const [fixedTop, setFixedTop] = React.useState<number>(0);

    // 상단 스택 높이를 측정해 고정 영역의 top으로 사용
    React.useLayoutEffect(() => {
        const measure = () => {
            if (!fixedTopRef.current) return;
            const rect = fixedTopRef.current.getBoundingClientRect();
            // viewport 기준 top + 현재 스크롤량 = 문서 기준 절대 top
            const absoluteTop = rect.top + (window.scrollY || 0);
            setFixedTop(absoluteTop);
        };

        measure();
        window.addEventListener('resize', measure);
        window.addEventListener('orientationchange', measure);
        return () => {
            window.removeEventListener('resize', measure);
            window.removeEventListener('orientationchange', measure);
        };
    }, []);

    // === n8n 서버 릴레이(쓰로틀) ===
    const lastSyncedAt = React.useRef<number>(0);
    const syncTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const SYNC_INTERVAL = 8000; // 과호출 방지

    const requestServerSync = React.useCallback(() => {
        const run = async () => {
            try {
                const res = await fetch("/api/airtable/sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tenantId }),
                });
                if (!res.ok) throw new Error(await res.text());
                lastSyncedAt.current = Date.now();
                console.log("✅ n8n(server) 전송 OK");
            } catch (e) {
                console.error("⚠️ n8n(server) 전송 실패:", e);
            }
        };

        const now = Date.now();
        const remaining = SYNC_INTERVAL - (now - lastSyncedAt.current);
        if (remaining <= 0) {
            run();
        } else {
            if (syncTimer.current) clearTimeout(syncTimer.current);
            syncTimer.current = setTimeout(run, remaining);
        }
    }, [tenantId]);

    // 편집 모드 상태
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [newItemName, setNewItemName] = React.useState("");
    const [draftData, setDraftData] = React.useState<any>(null);

    // 모바일 UI 상태
    const [columnManageOpen, setColumnManageOpen] = React.useState(false);
    const [linkLibraryOpen, setLinkLibraryOpen] = React.useState(false); // 링크 라이브러리 모달

    // DnD Sensors (모바일 터치 지원)
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
    );

    // 템플릿 풀 (기존 로직 유지)
    const allTemplates = React.useMemo(() => {
        const sheetIds = Array.isArray(data.sheets)
            ? data.sheets.filter((s: string) => s !== 'templates' && s !== 'updatedAt')
            : [];
        const mergedIds = Array.from(new Set([...sheetIds, data.activeSheet].filter((s) => s && s !== 'templates' && s !== 'updatedAt')));
        const map: Record<string, any> = {};
        mergedIds.forEach((sid: string) => {
            // templates prop과 data.templates 모두 확인
            const fromTpl = templates?.[sid] || data.templates?.[sid];
            const derivedFacets = deriveTemplateFromItems(data?.items?.[sid] || [], sid);
            const baseTemplate = ensureTemplateShape(sid, fromTpl, derivedFacets);

            // SHEET_TEMPLATES에서 모든 기본 facet 가져와서 병합
            const templateKey = Object.keys(SHEET_TEMPLATES).find(key =>
                sid.toLowerCase().includes(key) || key.includes(sid.toLowerCase())
            ) || 'space';
            const defaultTemplate = SHEET_TEMPLATES[templateKey] || SHEET_TEMPLATES['space'];
            const defaultFacets = defaultTemplate.facets || [];

            // 기존 facet들과 기본 facet 병합 (중복 제거)
            const existingKeys = new Set(baseTemplate.facets.map((f: any) => f.key));
            const mergedFacets = [...baseTemplate.facets];

            defaultFacets.forEach((df: any) => {
                if (!existingKeys.has(df.key)) {
                    mergedFacets.push(df);
                    existingKeys.add(df.key);
                }
            });

            // 라이브러리 참조 facet들 - 라이브러리에 항목이 있으면 자동으로 추가
            const libraryTypes = ['links', 'passwords', 'rules', 'info'];
            libraryTypes.forEach((libType: string) => {
                const libraryItems = library?.[libType] || {};
                const hasItems = Object.keys(libraryItems).length > 0;

                // 라이브러리에 항목이 있고, 해당 facet이 없으면 추가
                if (hasItems && !existingKeys.has(libType)) {
                    const libraryFacet = defaultFacets.find((f: any) =>
                        f.type === 'library-ref' && f.libraryType === libType
                    );

                    if (libraryFacet) {
                        mergedFacets.push(libraryFacet);
                        existingKeys.add(libType);
                    } else {
                        // 기본 facet에 없으면 새로 생성
                        const labels: Record<string, string> = {
                            links: '링크',
                            passwords: '비밀번호',
                            rules: '규정',
                            info: '공통정보',
                        };

                        mergedFacets.push({
                            key: libType,
                            label: labels[libType] || libType,
                            type: 'library-ref',
                            libraryType: libType,
                        });
                        existingKeys.add(libType);
                    }
                }
            });

            map[sid] = {
                ...baseTemplate,
                facets: mergedFacets,
            };
        });
        return map;
    }, [data.sheets, data.activeSheet, data.items, data.templates, templates, library]);

    // 열 가시성 초기값 (기존 로직 유지)
    React.useEffect(() => {
        setData((prev: any) => {
            const nextVis: Record<string, string[]> = { ...prev.visibleFacets };
            for (const sid of prev.sheets) {
                if (!nextVis[sid] || nextVis[sid].length === 0) {
                    nextVis[sid] = (allTemplates[sid]?.facets || []).map((f: any) => f.key);
                }
            }
            return { ...prev, visibleFacets: nextVis };
        });
    }, [allTemplates]);

    const activeSheetId = data.activeSheet;
    const template = allTemplates[activeSheetId] || { id: activeSheetId, title: activeSheetId, icon: "🧩", facets: [] };
    const visibleFacetKeys: string[] = data.visibleFacets?.[activeSheetId] || template.facets.map((f: any) => f.key);
    const visibleFacets = template.facets.filter((f: any) => visibleFacetKeys.includes(f.key));

    // 행 정렬 - 편집 모드에서는 draftData 사용
    const activeItems = React.useMemo(() => {
        const currentData = isEditMode ? draftData : data;
        if (!currentData) return [];
        const arr = Array.isArray(currentData?.items?.[activeSheetId]) ? currentData.items[activeSheetId] : [];
        const sorted = [...arr].sort((a, b) => {
            const ao = a?.order ?? 1e9;
            const bo = b?.order ?? 1e9;
            if (ao !== bo) return ao - bo;
            return (a?.name || "").localeCompare(b?.name || "", "ko");
        });
        return sorted;
    }, [data.items, draftData, activeSheetId, isEditMode]);

    // 저장 디바운스 (편집 모드에서는 비활성화)
    const saveTimer = React.useRef<NodeJS.Timeout | null>(null);
    const lastAutoSaveAt = React.useRef<number>(0);
    const pendingAutoSave = React.useRef(false);

    // 편집 모드 핸들러
    const handleEnterEditMode = React.useCallback(() => {
        setDraftData(JSON.parse(JSON.stringify(data))); // 깊은 복사
        setIsEditMode(true);
    }, [data]);

    // ────────────────────────────────────────────────────────────
    // 저장/취소
    // ────────────────────────────────────────────────────────────
    const handleSaveEdits = React.useCallback(async () => {
        if (!draftData) return;

        try {
            const cleanSheets = draftData.sheets.filter((s: string) =>
                s !== "templates" && s !== "updatedAt"
            );

            const payload = {
                schemaVersion: draftData.schemaVersion,
                sheets: cleanSheets,
                activeSheet: draftData.activeSheet,
                items: draftData.items,
                customOptions: draftData.customOptions,
                visibleFacets: draftData.visibleFacets,
                linkLibrary: draftData.linkLibrary || {},
            };

            if (onSave) {
                await onSave(payload);
                requestServerSync();
            } else {
                console.log("📦 저장 (로컬)", payload);
            }

            // ✅ 저장 성공 → 서버 릴레이로 n8n 전송(쓰로틀)
            requestServerSync();

            // 저장 성공 후 실제 데이터에 반영
            setData(draftData);
            setIsEditMode(false);
            setDraftData(null);
            lastAutoSaveAt.current = Date.now();
        } catch (err) {
            console.error("Save error:", err);
            alert("❌ 저장 실패");
        }
    }, [draftData, onSave, requestServerSync]);


    const handleCancelEdits = React.useCallback(() => {
        setIsEditMode(false);
        setDraftData(null);
    }, []);

    const scheduleAutoSave = React.useCallback(() => {
        // 편집 모드에서는 자동저장 비활성화
        if (isEditMode) return;

        pendingAutoSave.current = true;
        if (saveTimer.current) clearTimeout(saveTimer.current);

        const elapsed = Date.now() - lastAutoSaveAt.current;
        const wait = Math.max(AUTO_SAVE_DEBOUNCE_MS, MIN_REMOTE_SAVE_INTERVAL_MS - elapsed);

        saveTimer.current = setTimeout(() => {
            pendingAutoSave.current = false;
            handleSave(true);
        }, wait);
    }, [isEditMode]);
    async function handleSave(silent = false) {
        if (saveTimer.current) {
            clearTimeout(saveTimer.current);
            saveTimer.current = null;
        }

        try {
            const cleanSheets = data.sheets.filter((s: string) =>
                s !== 'templates' &&
                s !== 'updatedAt'
            );

            const payload = {
                schemaVersion: data.schemaVersion,
                sheets: cleanSheets,
                activeSheet: data.activeSheet,
                items: data.items,
                customOptions: data.customOptions,
                visibleFacets: data.visibleFacets,
                linkLibrary: data.linkLibrary || {},
            };

            // ✅ onSave prop이 있으면 사용, 없으면 기본 동작
            if (onSave) {
                await onSave(payload);
            } else {
                // onSave가 없으면 로컬에만 저장 (개발 모드)
                console.log("📦 저장 (로컬)", payload);
            }

            lastAutoSaveAt.current = Date.now();
            pendingAutoSave.current = false;
        } catch (err) {
            console.error("Save error:", err);
            alert("❌ 저장 실패");
            pendingAutoSave.current = false;
        } finally {
            if (saveTimer.current) {
                clearTimeout(saveTimer.current);
                saveTimer.current = null;
            }
        }
    }

    React.useEffect(() => {
        return () => {
            if (saveTimer.current) {
                clearTimeout(saveTimer.current);
            }
        };
    }, []);

    // 행 관리 함수들 - 편집 모드에서는 draftData 수정
    const getCurrentData = () => isEditMode ? draftData : data;
    const setCurrentData = (updater: any) => {
        if (isEditMode) {
            setDraftData(updater);
        } else {
            setData(updater);
            scheduleAutoSave();
        }
    };

    const addRow = (presetName?: string) => {
        const preset = (PRESET_ITEMS[activeSheetId] || []).find((p: any) => p.name === presetName);
        const newId = `row_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const currentItems = getCurrentData().items[activeSheetId] || [];
        const newRow: any = {
            id: newId,
            name: presetName || "",
            facets: {},
            order: currentItems.length,
        };
        if (preset?.facets) {
            newRow.facets = { ...preset.facets };
        }
        setCurrentData((prev: any) => ({
            ...prev,
            items: {
                ...prev.items,
                [activeSheetId]: [...(prev.items[activeSheetId] || []), newRow],
            },
        }));
    };

    const removeRow = (rowId: string, rowName: string) => {
        const currentItems = getCurrentData().items[activeSheetId] || [];
        // 실제 아이템의 isRequired 체크 (우선순위 1)
        const currentItem = currentItems.find((r: any) => r.id === rowId);
        if (currentItem?.isRequired === true) {
            alert(`"${rowName}"은(는) 필수 항목이라 삭제할 수 없습니다.`);
            return;
        }

        // 프리셋에서 required 체크 (우선순위 2)
        const presets = PRESET_ITEMS[activeSheetId] || [];
        const preset = presets.find((p: any) => p.name === rowName);
        if (preset?.required === true) {
            alert(`"${rowName}"은(는) 필수 항목이라 삭제할 수 없습니다.`);
            return;
        }

        setCurrentData((prev: any) => ({
            ...prev,
            items: {
                ...prev.items,
                [activeSheetId]: prev.items[activeSheetId].filter((r: any) => r.id !== rowId),
            },
        }));
    };

    const updateRowName = (rowId: string, name: string) => {
        setCurrentData((prev: any) => ({
            ...prev,
            items: {
                ...prev.items,
                [activeSheetId]: prev.items[activeSheetId].map((r: any) =>
                    r.id === rowId ? { ...r, name } : r
                ),
            },
        }));
    };

    const updateCell = (rowId: string, facetKey: string, value: any) => {
        setCurrentData((prev: any) => ({
            ...prev,
            items: {
                ...prev.items,
                [activeSheetId]: prev.items[activeSheetId].map((r: any) =>
                    r.id === rowId ? { ...r, facets: { ...r.facets, [facetKey]: value } } : r
                ),
            },
        }));
    };

    const toggleFacetMembership = (
        sheetId: string,
        rowId: string,
        facetKey: string,
        option: string,
        enable: boolean
    ) => {
        if (!sheetId || !facetKey || !rowId || !option) return;

        setCurrentData((prev: any) => {
            const sheetItems = prev.items?.[sheetId] || [];
            const updatedSheet = sheetItems.map((item: any) => {
                if (item.id !== rowId) return item;

                const currentValues = unpack(item.facets?.[facetKey]);
                let nextValues: string[];

                if (enable) {
                    nextValues = uniqNormPush(currentValues, option);
                } else {
                    nextValues = currentValues.filter((val) => normalize(val) !== normalize(option));
                }

                const packed = pack(nextValues);
                const nextFacets = {
                    ...(item.facets || {}),
                    [facetKey]: packed,
                };

                if (!packed) {
                    delete nextFacets[facetKey];
                }

                return {
                    ...item,
                    facets: nextFacets,
                };
            });

            return {
                ...prev,
                items: {
                    ...prev.items,
                    [sheetId]: updatedSheet,
                },
            };
        });
    };

    const handleRowDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setCurrentData((prev: any) => {
            const oldItems = prev.items[activeSheetId] || [];
            const oldIndex = oldItems.findIndex((r: any) => r.id === active.id);
            const newIndex = oldItems.findIndex((r: any) => r.id === over.id);
            if (oldIndex === -1 || newIndex === -1) return prev;

            const reordered = arrayMove(oldItems, oldIndex, newIndex).map((r: any, i: number) => ({
                ...r,
                order: i,
            }));
            return {
                ...prev,
                items: { ...prev.items, [activeSheetId]: reordered },
            };
        });
        scheduleAutoSave();
    };

    // 기준 관리 함수들 (기존 로직 유지)
    const toggleFacetVisible = (facetKey: string, show: boolean) => {
        setData((prev: any) => {
            const current = prev.visibleFacets?.[activeSheetId] || [];
            const updated = show
                ? [...current, facetKey]
                : current.filter((k: string) => k !== facetKey);
            return {
                ...prev,
                visibleFacets: { ...prev.visibleFacets, [activeSheetId]: updated },
            };
        });
        scheduleAutoSave();
    };

    const createFacetToSheet = (facet: any) => {
        const updated = { ...allTemplates };
        if (!updated[activeSheetId].facets.some((f: any) => f.key === facet.key)) {
            updated[activeSheetId].facets = [...updated[activeSheetId].facets, facet];
        }
        setData((prev: any) => ({
            ...prev,
            templates: updated,
            visibleFacets: {
                ...prev.visibleFacets,
                [activeSheetId]: [...(prev.visibleFacets?.[activeSheetId] || []), facet.key],
            },
        }));
        scheduleAutoSave();
    };

    const reorderVisibleFacets = (keys: string[]) => {
        setData((prev: any) => ({
            ...prev,
            visibleFacets: { ...prev.visibleFacets, [activeSheetId]: keys },
        }));
        scheduleAutoSave();
    };

    const deleteFacet = (facetKey: string) => {
        setData((prev: any) => {
            const updated = { ...allTemplates };
            // facet 제거
            updated[activeSheetId].facets = updated[activeSheetId].facets.filter((f: any) => f.key !== facetKey);

            // visibleFacets에서도 제거
            const visibleKeys = (prev.visibleFacets?.[activeSheetId] || []).filter((k: string) => k !== facetKey);

            // 모든 항목에서 해당 facet 데이터 제거
            const updatedItems = { ...prev.items };
            if (updatedItems[activeSheetId]) {
                updatedItems[activeSheetId] = updatedItems[activeSheetId].map((item: any) => {
                    const newFacets = { ...item.facets };
                    delete newFacets[facetKey];
                    return { ...item, facets: newFacets };
                });
            }

            return {
                ...prev,
                templates: updated,
                visibleFacets: {
                    ...prev.visibleFacets,
                    [activeSheetId]: visibleKeys,
                },
                items: updatedItems,
            };
        });
        scheduleAutoSave();
    };

    const updateFacetOptions = (facetKey: string, newOptions: any[]) => {
        setData((prev: any) => {
            const updated = { ...allTemplates };
            const facetIndex = updated[activeSheetId].facets.findIndex((f: any) => f.key === facetKey);

            if (facetIndex !== -1) {
                updated[activeSheetId].facets[facetIndex] = {
                    ...updated[activeSheetId].facets[facetIndex],
                    options: newOptions,
                };
            }

            return {
                ...prev,
                templates: updated,
            };
        });
        scheduleAutoSave();
    };

    // 커스텀 옵션 함수들 (기존 로직 유지)
    const addCustomOption = (customKey: string, option: string) => {
        setData((prev: any) => {
            const current = prev.customOptions?.[customKey] || [];
            const normalized = option.trim();
            if (current.some((o: string) => normalize(o) === normalize(normalized))) return prev;

            return {
                ...prev,
                customOptions: {
                    ...prev.customOptions,
                    [customKey]: [...current, normalized],
                },
            };
        });
        scheduleAutoSave();
    };

    const deleteCustomOption = (customKey: string, option: string) => {
        setData((prev: any) => {
            const current = prev.customOptions?.[customKey] || [];
            return {
                ...prev,
                customOptions: {
                    ...prev.customOptions,
                    [customKey]: current.filter((o: string) => o !== option),
                },
            };
        });
        scheduleAutoSave();
    };

    // ────────────────────────────────────────────────────────────
    // Airtable 전송
    // ────────────────────────────────────────────────────────────
    const [isSyncing, setIsSyncing] = React.useState(false);

    const handleSyncToAirtable = async () => {
        if (!confirm('Airtable 질문 데이터셋을 업데이트하시겠습니까?\n\n모든 항목의 질문이 자동으로 생성됩니다.')) {
            return;
        }

        setIsSyncing(true);

        try {
            const response = await fetch('/api/airtable/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData?.error || errorData?.message || `HTTP ${response.status}`;
                throw new Error(errorMessage);
            }

            const result = await response.json();

            alert(`✅ Airtable 전송 완료!\n\n` +
                `• 항목: ${result.data.totalItems}개\n` +
                `• 질문: ${result.data.totalQuestions}개\n` +
                `• 시트: ${result.data.sheets.join(', ')}`);
        } catch (error: any) {
            console.error('Airtable sync error:', error);
            const errorMessage = error?.message || '알 수 없는 오류가 발생했습니다';
            alert(`❌ 전송 실패\n\n${errorMessage}\n\n잠시 후 다시 시도해주세요.`);
        } finally {
            setIsSyncing(false);
        }
    };


    // ────────────────────────────────────────────────────────────
    // 🎨 UI 렌더링 (모바일 최적화)
    // ────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50 pb-24 relative">
            {/* 설명 헤더 - 통일된 디자인 */}
            <div
                ref={headerRef}
                className={`sticky top-0 z-30 bg-white border-b border-gray-200 ${scrolled ? 'shadow-[0_1px_0_rgba(0,0,0,0.08)]' : ''}`}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-gray-600">
                            시트별로 항목을 관리하고, 기준을 설정하세요
                        </p>
                        {/* 우측: 액션 버튼 */}
                        {!isEditMode && activeItems.length > 0 && (
                            <button
                                onClick={handleSyncToAirtable}
                                disabled={isSyncing}
                                className="ml-auto px-2 sm:px-3 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                <span>{isSyncing ? '전송 중' : '전송'}</span>
                            </button>
                        )}

                        {/* 편집 모드 - 모바일 최적화 */}
                        {isEditMode && (
                            <div className="ml-auto flex items-center gap-1 sm:gap-2">
                                <button
                                    onClick={handleCancelEdits}
                                    className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-gray-100 text-gray-700 text-xs sm:text-sm font-medium hover:bg-gray-200 transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleSaveEdits}
                                    className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-yellow-400 text-gray-900 text-xs sm:text-sm font-semibold hover:bg-yellow-500 transition-colors"
                                >
                                    저장
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="w-full px-0 py-2 sm:py-4 space-y-3 sm:space-y-4">
                {/* Level 3: 시트 탭 - 조건부 정렬 + 마스크 */}
                <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-2 sm:py-3 sticky top-[57px] sm:top-[73px] z-30 overflow-visible">
                    <div className="relative overflow-visible">
                        {/* 마스크 블러 - 편집 중에만 표시 */}
                        {isEditMode && (
                            <>
                                {/* 좌측 마스크 */}
                                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none z-10"></div>

                                {/* 우측 마스크 (+ 버튼 배경) */}
                                <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white via-white to-transparent pointer-events-none z-10"></div>
                            </>
                        )}

                        {/* 스크롤 컨테이너 - 조건부 정렬 */}
                        <div className={`flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide ${isEditMode ? 'justify-start px-8 pr-20' : 'justify-center px-4'}`}>
                            {(data.sheets || []).map((sheetId: string) => {
                                const t = allTemplates[sheetId] || { icon: "🧩", title: sheetId };
                                const isActive = activeSheetId === sheetId;
                                const itemCount = data.items[sheetId]?.length || 0;
                                return (
                                    <div key={sheetId} className="flex items-center gap-1 flex-shrink-0 relative">
                                        <button
                                            onClick={() => {
                                                setData((prev: any) => ({ ...prev, activeSheet: sheetId }));
                                            }}
                                            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${isActive
                                                ? "bg-gray-900 text-white"
                                                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                                                }`}
                                        >
                                            {t.title}
                                            {itemCount > 0 && (
                                                <span className={`ml-1 sm:ml-2 text-xs ${isActive ? "text-gray-300" : "text-gray-400"}`}>
                                                    {itemCount}
                                                </span>
                                            )}
                                        </button>
                                        {/* 편집 모드에서 삭제 뱃지 - 우측 상단 (안쪽!) */}
                                        {isEditMode && data.sheets.length > 1 && (
                                            <button
                                                onClick={() => {
                                                    if (confirm(`"${t.title}" 시트를 삭제하시겠습니까?\n\n모든 데이터가 삭제됩니다.`)) {
                                                        const newSheets = data.sheets.filter((s: string) => s !== sheetId);
                                                        const newItems = { ...data.items };
                                                        delete newItems[sheetId];
                                                        setData((prev: any) => ({
                                                            ...prev,
                                                            sheets: newSheets,
                                                            items: newItems,
                                                            activeSheet: prev.activeSheet === sheetId ? newSheets[0] : prev.activeSheet,
                                                        }));
                                                    }
                                                }}
                                                className="absolute top-0 right-0 w-5 h-5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center justify-center shadow-md z-20"
                                                title="시트 삭제"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* 작고 미니멀한 + 버튼 - 편집 중에만 */}
                        {isEditMode && (
                            <button
                                onClick={() => {
                                    const sheetName = prompt("새 시트 이름을 입력하세요:");
                                    if (sheetName && sheetName.trim()) {
                                        const sheetId = sheetName.toLowerCase().replace(/\s+/g, "_");
                                        if (data.sheets.includes(sheetId)) {
                                            alert("이미 존재하는 시트입니다.");
                                            return;
                                        }

                                        // SHEET_TEMPLATES에서 기본 facet 구조 가져오기
                                        // 시트 이름이 space, facility, seat 등과 매칭되면 해당 템플릿 사용, 아니면 space 템플릿을 기본으로 사용
                                        const templateKey = Object.keys(SHEET_TEMPLATES).find(key =>
                                            sheetId.toLowerCase().includes(key) || key.includes(sheetId.toLowerCase())
                                        ) || 'space';

                                        const defaultTemplate = SHEET_TEMPLATES[templateKey] || SHEET_TEMPLATES['space'];
                                        const defaultFacets = defaultTemplate.facets || [];

                                        // 빈 행 하나 추가
                                        const defaultItem = {
                                            id: `new_${sheetId}_${Date.now()}`,
                                            name: "",
                                            facets: {},
                                            order: 0,
                                            createdAt: Date.now(),
                                        };

                                        // 새 시트 데이터 생성
                                        const newSheetData = {
                                            sheets: [...data.sheets, sheetId],
                                            items: { ...data.items, [sheetId]: [defaultItem] },
                                            visibleFacets: {
                                                ...data.visibleFacets,
                                                [sheetId]: defaultFacets.map((f: any) => f.key),
                                            },
                                            activeSheet: sheetId,
                                            // 템플릿 정보도 저장 (allTemplates에서 사용)
                                            templates: {
                                                ...(data.templates || {}),
                                                [sheetId]: {
                                                    id: sheetId,
                                                    title: sheetName.trim(),
                                                    icon: defaultTemplate.icon || "🧩",
                                                    facets: defaultFacets,
                                                },
                                            },
                                        };

                                        // data 업데이트
                                        setData((prev: any) => ({
                                            ...prev,
                                            ...newSheetData,
                                        }));

                                        // 편집 모드일 때는 draftData도 업데이트
                                        if (isEditMode && draftData) {
                                            setDraftData((prev: any) => ({
                                                ...prev,
                                                ...newSheetData,
                                            }));
                                        }

                                        // 편집 모드가 아니면 자동으로 편집 모드 진입
                                        if (!isEditMode) {
                                            const updatedData = {
                                                ...data,
                                                ...newSheetData,
                                            };
                                            setDraftData(JSON.parse(JSON.stringify(updatedData)));
                                            setIsEditMode(true);
                                        }
                                    }
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 transition-all flex items-center justify-center text-gray-600 shadow-sm z-20"
                                title="시트 추가"
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Level 4: 뷰 토글 - 모바일 최적화 */}
                <div className="flex justify-center py-2 px-4 sm:px-6">
                    <div className="relative inline-flex items-center gap-0.5 p-0.5 bg-black/5 rounded-full">
                        {/* 슬라이더 */}
                        <div
                            className={`absolute top-0.5 bottom-0.5 w-[calc(50%-1px)] transition-all duration-300 ease-out bg-white rounded-full shadow-lg ${viewMode === "item" ? 'left-0.5' : 'left-[calc(50%+1px)]'
                                }`}
                        />

                        <button
                            onClick={() => setViewMode("item")}
                            className={`relative z-10 w-16 sm:w-20 px-2 sm:px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${viewMode === "item" ? 'text-gray-900' : 'text-gray-500'
                                }`}
                        >
                            항목별
                        </button>

                        <button
                            onClick={() => setViewMode("facet")}
                            className={`relative z-10 w-16 sm:w-20 px-2 sm:px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${viewMode === "facet" ? 'text-gray-900' : 'text-gray-500'
                                }`}
                        >
                            기준별
                        </button>
                    </div>
                </div>

                {/* 앵커: 테이블 영역 바로 위 */}
                <div ref={fixedTopRef} id="sheet-fixed-anchor" />

                {/* 테이블 영역 */}
                {viewMode === "item" && (
                    <div
                        className="fixed inset-x-0 bg-white shadow-sm overflow-hidden z-20"
                        style={{
                            top: fixedTop || 160, // 초기 값(대략치) ; 실제로는 measure로 곧 갱신됨
                            bottom: isEditMode
                                ? `calc(env(safe-area-inset-bottom) + var(--bottom-nav-h, 64px) + ${ACTIONBAR_H}px)`
                                : 'calc(env(safe-area-inset-bottom) + var(--bottom-nav-h, 64px))'
                        }}
                    >
                        {/* 가로가 넘치면 가로 스크롤 허용, 내부만 부드럽게 스크롤 */}
                        <div className="h-full w-full overflow-auto">
                            <div className="min-w-max">
                                {activeItems.length === 0 ? (
                                    <div className="px-4 py-20 text-center">
                                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                                            <Plus className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <p className="text-lg font-medium text-gray-900 mb-2">항목이 없습니다</p>
                                        <p className="text-sm text-gray-500">
                                            {isEditMode ? "하단의 항목 추가 바에서 첫 번째 항목을 추가해보세요" : "편집 모드에서 항목을 추가할 수 있습니다"}
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragEnd={handleRowDragEnd}
                                        >
                                            <table className="w-full">
                                                <thead className="bg-gray-50 border-b sticky top-0 z-20 shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
                                                    <tr>
                                                        {isEditMode && <th className="w-8 bg-gray-50"></th>}
                                                        <th className="px-2 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-[100px] sticky left-0 bg-gray-50 z-30 border-r border-gray-200">
                                                            이름
                                                        </th>
                                                        {visibleFacets.map((facet: any) => {
                                                            // 컬럼 타입에 따라 너비 조정
                                                            let widthClass = "";
                                                            if (facet.type === "checkbox") {
                                                                widthClass = "min-w-[80px]"; // 체크박스는 두 글자 한 줄로 들어가도록 여유 있게
                                                            } else if (facet.key === "notes" || facet.type === "textarea") {
                                                                widthClass = "w-[250px]"; // 비고는 더 넓게
                                                            } else if (facet.key === "location") {
                                                                widthClass = "w-[120px]"; // 위치는 중간
                                                            }
                                                            // 나머지는 자동 너비 (widthClass 없음)

                                                            return (
                                                                <th
                                                                    key={facet.key}
                                                                    className={`px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase ${widthClass} bg-gray-50`}
                                                                >
                                                                    {facet.label}
                                                                </th>
                                                            );
                                                        })}
                                                        <th className="w-16 px-2 bg-gray-50">
                                                            <button
                                                                onClick={() => setColumnManageOpen(true)}
                                                                className="w-8 h-8 rounded-lg hover:bg-gray-200 flex items-center justify-center transition-colors mx-auto"
                                                                title="열 관리"
                                                            >
                                                                <Settings className="w-4 h-4 text-gray-600" />
                                                            </button>
                                                        </th>
                                                        <th className="w-12 bg-gray-50"></th>
                                                    </tr>
                                                </thead>
                                                <SortableContext
                                                    items={activeItems.map((r: any) => r.id)}
                                                    strategy={verticalListSortingStrategy}
                                                >
                                                    <tbody className="divide-y divide-gray-100">
                                                        {activeItems.map((row: any) => (
                                                            <Row key={row.id} row={row} isEditMode={isEditMode}>
                                                                <td className="px-2 py-2 align-top sticky left-0 bg-white z-10 border-r border-gray-200 w-[100px]">
                                                                    {isEditMode ? (
                                                                        <input
                                                                            type="text"
                                                                            value={row.name}
                                                                            onChange={(e) => updateRowName(row.id, e.target.value)}
                                                                            placeholder="항목명"
                                                                            className={`w-full px-2 py-1.5 rounded-lg border-transparent hover:border-transparent focus:border-transparent transition-all text-xs font-medium ${row.name
                                                                                ? "bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                                : "bg-white text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:text-gray-900"
                                                                                }`}
                                                                        />
                                                                    ) : (
                                                                        <div className="px-2 py-2 text-xs font-medium text-gray-900 min-h-[32px] flex items-start overflow-hidden">
                                                                            <span className="line-clamp-3 w-full break-words">{row.name || <span className="text-gray-400">항목명</span>}</span>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                {visibleFacets.map((facet: any) => (
                                                                    <CellEditor
                                                                        key={facet.key}
                                                                        row={row}
                                                                        facet={facet}
                                                                        sheetId={activeSheetId}
                                                                        openDropdown={openDropdown}
                                                                        setOpenDropdown={setOpenDropdown}
                                                                        updateCell={updateCell}
                                                                        addCustomOption={addCustomOption}
                                                                        deleteCustomOption={deleteCustomOption}
                                                                        customOptions={isEditMode ? draftData?.customOptions : data.customOptions}
                                                                        isEditMode={isEditMode}
                                                                        onUpdateFacetOptions={updateFacetOptions}
                                                                        library={library}
                                                                    />
                                                                ))}
                                                                <td className="px-2 text-right align-top">
                                                                    {isEditMode && (
                                                                        <button
                                                                            onClick={() => removeRow(row.id, row.name)}
                                                                            disabled={row.isRequired === true}
                                                                            className={`w-9 h-9 rounded-lg transition-colors ${row.isRequired
                                                                                ? 'text-gray-300 cursor-not-allowed'
                                                                                : 'text-red-600 hover:bg-red-50'
                                                                                }`}
                                                                            title={row.isRequired ? "필수 항목 (삭제 불가)" : "삭제"}
                                                                        >
                                                                            <X className="w-4 h-4 mx-auto" />
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </Row>
                                                        ))}
                                                    </tbody>
                                                </SortableContext>
                                            </table>
                                        </DndContext>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === "facet" && (
                    <div className="bg-white rounded-2xl shadow-sm p-4">
                        <FacetPivotView
                            sheetId={activeSheetId}
                            template={template}
                            items={activeItems}
                            customOptions={data.customOptions || {}}
                            addCustomOption={addCustomOption}
                            isEditMode={isEditMode}
                            library={library}
                            onToggleMembership={(rowId: string, facetKey: string, option: string, enable: boolean) =>
                                toggleFacetMembership(activeSheetId, rowId, facetKey, option, enable)
                            }
                        />
                    </div>
                )}
            </div>

            {/* 플로팅 액션 버튼 제거 - 인라인 버튼으로 대체 */}

            {/* 바텀시트들 */}
            <ColumnManageBottomSheet
                isOpen={columnManageOpen}
                onClose={() => setColumnManageOpen(false)}
                sheetId={activeSheetId}
                allFacets={React.useMemo(() => {
                    // SHEET_TEMPLATES에서 모든 기본 facet 가져오기
                    const templateKey = Object.keys(SHEET_TEMPLATES).find(key =>
                        activeSheetId.toLowerCase().includes(key) || key.includes(activeSheetId.toLowerCase())
                    ) || 'space';
                    const defaultTemplate = SHEET_TEMPLATES[templateKey] || SHEET_TEMPLATES['space'];
                    const defaultFacets = defaultTemplate.facets || [];

                    // 현재 템플릿의 facet들과 병합 (중복 제거)
                    const existingKeys = new Set(template.facets.map((f: any) => f.key));
                    const mergedFacets = [...template.facets];

                    // 기본 facet 중 아직 추가되지 않은 것들 추가
                    defaultFacets.forEach((df: any) => {
                        if (!existingKeys.has(df.key)) {
                            mergedFacets.push(df);
                            existingKeys.add(df.key);
                        }
                    });

                    // 라이브러리 참조 facet들 - 라이브러리에 항목이 있으면 자동으로 추가
                    const libraryTypes = ['links', 'passwords', 'rules', 'info'];
                    libraryTypes.forEach((libType: string) => {
                        const libraryItems = library?.[libType] || {};
                        const hasItems = Object.keys(libraryItems).length > 0;

                        // 라이브러리에 항목이 있고, 해당 facet이 없으면 추가
                        if (hasItems && !existingKeys.has(libType)) {
                            const libraryFacet = defaultFacets.find((f: any) =>
                                f.type === 'library-ref' && f.libraryType === libType
                            );

                            if (libraryFacet) {
                                mergedFacets.push(libraryFacet);
                                existingKeys.add(libType);
                            } else {
                                // 기본 facet에 없으면 새로 생성
                                const labels: Record<string, string> = {
                                    links: '링크',
                                    passwords: '비밀번호',
                                    rules: '규정',
                                    info: '공통정보',
                                };

                                mergedFacets.push({
                                    key: libType,
                                    label: labels[libType] || libType,
                                    type: 'library-ref',
                                    libraryType: libType,
                                });
                                existingKeys.add(libType);
                            }
                        }
                    });

                    return mergedFacets;
                }, [template.facets, activeSheetId, library])}
                visibleKeys={visibleFacetKeys}
                onToggle={toggleFacetVisible}
                onCreate={createFacetToSheet}
                onReorder={reorderVisibleFacets}
                onDelete={deleteFacet}
            />

            <LinkLibraryBottomSheet
                isOpen={linkLibraryOpen}
                onClose={() => setLinkLibraryOpen(false)}
                linkLibrary={data.linkLibrary || {}}
                onUpdate={(updated: any) => {
                    setData((prev: any) => ({ ...prev, linkLibrary: updated }));
                    scheduleAutoSave();
                }}
            />

            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>

            {/* FAB - 편집 버튼 (모바일 최적화) */}
            {!isEditMode && (
                <button
                    onClick={handleEnterEditMode}
                    className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-900 text-white shadow-lg hover:bg-gray-800 transition-all hover:scale-105 active:scale-95 z-40 flex items-center justify-center"
                    aria-label="편집 모드"
                >
                    <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
            )}

            {/* 항목 추가 고정 바 - 편집 모드에서만 표시 */}
            {isEditMode && (
                <div
                    className="fixed inset-x-0 bg-white border-t border-gray-200 shadow-lg z-30"
                    style={{
                        bottom: 'calc(env(safe-area-inset-bottom) + var(--bottom-nav-h, 64px))',
                        height: `${ACTIONBAR_H}px`
                    }}
                >
                    <div className="max-w-2xl mx-auto h-full px-4 flex items-center gap-2">
                        <input
                            type="text"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    // ✅ 한글 IME 조합 중이면 Enter 무시
                                    // @ts-ignore
                                    if (e.nativeEvent?.isComposing) return;
                                    if (newItemName.trim()) {
                                        addRow(newItemName.trim());
                                        setNewItemName('');
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }
                                }
                            }}
                            placeholder="항목명 입력 (실제 이용 중인 명칭을 입력해주세요)"
                            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                        />
                        <button
                            onClick={() => {
                                if (newItemName.trim()) {
                                    addRow(newItemName.trim());
                                    setNewItemName('');
                                }
                            }}
                            disabled={!newItemName.trim()}
                            className="px-5 py-2.5 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-sm"
                        >
                            추가
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}