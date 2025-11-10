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

    // 라이브러리 참조 타입 처리 - 드롭다운으로
    if (facet.type === "library-ref") {
        const libraryType = facet.libraryType || "links";
        const libraryItems = library?.[libraryType] || {};
        const libraryOptions = Object.entries(libraryItems).map(([key, item]: any) => ({
            key,
            label: item.label,
            value: item.value,
        }));

        const selectedKeys = value ? String(value).split(',').filter(Boolean) : [];
        const selectedLabels = selectedKeys
            .map(k => libraryItems[k]?.label)
            .filter(Boolean)
            .join(', ');

        const dropdownId = `${row.id}-${facet.key}`;
        const isDropdownOpen = openDropdown === dropdownId;

        return (
            <div className="relative inline-block w-full">
                <button
                    ref={cellRef as any}
                    onClick={() => {
                        if (isEditMode) {
                            setOpenDropdown(isDropdownOpen ? null : dropdownId);
                        }
                    }}
                    disabled={!isEditMode}
                    className={`w-full px-3 py-2 text-left rounded-lg border transition-all ${isEditMode
                        ? 'border-gray-300 hover:border-gray-900 hover:bg-gray-50'
                        : 'border-transparent bg-transparent'
                        } ${selectedKeys.length > 0 ? 'text-gray-900' : 'text-gray-400'}`}
                    title={selectedLabels || '선택'}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm">
                            {selectedLabels || '선택'}
                        </span>
                        {isEditMode && libraryOptions.length > 0 && (
                            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                    </div>
                </button>

                {isDropdownOpen && libraryOptions.length > 0 && (
                    <div
                        ref={dropdownRef}
                        className="absolute z-50 mt-1 w-full min-w-[200px] max-h-[300px] overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200"
                    >
                        <div className="p-2 space-y-1">
                            {libraryOptions.map((opt: any) => {
                                const isSelected = selectedKeys.includes(opt.key);
                                return (
                                    <label
                                        key={opt.key}
                                        className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => {
                                                const newSelected = isSelected
                                                    ? selectedKeys.filter((k: string) => k !== opt.key)
                                                    : [...selectedKeys, opt.key];
                                                onChange(newSelected.join(','));
                                            }}
                                            className="mt-0.5 w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-2 focus:ring-gray-900"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-900 truncate">
                                                {opt.label}
                                            </div>
                                            <div className="text-xs text-gray-500 truncate" title={opt.value}>
                                                {opt.value}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                )}

                {!isDropdownOpen && libraryOptions.length === 0 && isEditMode && (
                    <div className="absolute z-50 mt-1 w-full p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                        📚 라이브러리 탭에서 {facet.label}을 추가하세요
                    </div>
                )}
            </div>
        );
    }

    const [position, setPosition] = React.useState({ top: 0, left: 0 });
    React.useEffect(() => {
        if (isMobile) return;
        if (!cellRef.current || !dropdownRef.current) return;
        const updatePosition = () => {
            const cellRect = cellRef.current!.getBoundingClientRect();
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
            setPosition({ top, left });
        };
        updatePosition();
        const handleScroll = () => updatePosition();
        window.addEventListener("scroll", handleScroll, true);
        window.addEventListener("resize", handleScroll);
        return () => {
            window.removeEventListener("scroll", handleScroll, true);
            window.removeEventListener("resize", handleScroll);
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
        setSelected((prev) => uniqNormPush(prev, text));
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

    const handleReorderOptions = (newOrder: any[]) => {
        if (!onUpdateFacetOptions) return;
        onUpdateFacetOptions(facet.key, newOrder);
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
        : "absolute z-[1000]";

    const containerStyle = isMobile ? undefined : { top: position.top, left: position.left };

    return (
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
// QuickAddBottomSheet - 간소화 버전 (프리셋 제거)
// ────────────────────────────────────────────────────────────
function QuickAddBottomSheet({ isOpen, onClose, sheetId, onAdd, onAddAll }: any) {
    const [customName, setCustomName] = React.useState("");

    const add = (name?: string) => {
        if (!name?.trim()) return;
        onAdd(name.trim());
        setCustomName("");
    };

    return (
        <MobileBottomSheet isOpen={isOpen} onClose={onClose} title="항목 추가">
            <div className="space-y-3">
                <div className="flex gap-2">
                    <input
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                add(customName);
                            }
                        }}
                        placeholder="항목명 입력 (예: 현관, 로비, 복도)"
                        className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                        autoFocus
                    />
                    <button
                        onClick={() => add(customName)}
                        disabled={!customName.trim()}
                        className="px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                        추가
                    </button>
                </div>
                <p className="text-xs text-gray-500">
                    Enter 키를 눌러 빠르게 추가할 수 있습니다
                </p>
            </div>
        </MobileBottomSheet>
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

    // 타입별 아이콘 표시
    const getTypeIcon = () => {
        if (facet.type === 'library-ref') {
            return '📚'; // 라이브러리 참조
        }
        if (facet.type === 'multi') {
            return '☐'; // 멀티셀렉
        }
        if (facet.type === 'checkbox') {
            return '✓'; // 체크박스
        }
        return '○'; // 단일
    };

    const getTypeLabel = () => {
        if (facet.type === 'library-ref') {
            return '라이브러리';
        }
        if (facet.type === 'multi') {
            return '멀티';
        }
        if (facet.type === 'checkbox') {
            return '체크';
        }
        return '단일';
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isVisible
                ? 'bg-white hover:bg-gray-50'
                : 'bg-gray-50 hover:bg-gray-100 opacity-60'
                }`}
        >
            {/* 드래그 핸들 - hover 시에만 표시 */}
            <div
                {...attributes}
                {...listeners}
                className={`cursor-grab active:cursor-grabbing transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'
                    }`}
            >
                <GripVertical className="w-4 h-4 text-gray-400" />
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
            <td className="px-2 align-top">
                <div className="flex items-center justify-center h-10">
                    {isEditMode ? (
                        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-4 h-4 text-gray-400" />
                        </div>
                    ) : (
                        <div className="w-4 h-4" />
                    )}
                </div>
            </td>
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
            <td className="px-3 py-2 align-top">
                <div className="flex items-center justify-center">
                    {isEditMode ? (
                        <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => updateCell(row.id, facet.key, String(e.target.checked))}
                            className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
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

    // 텍스트에어리어 타입 처리 (비고는 항상 활성화, 다른 셀과 동일한 높이)
    if (facet.type === "textarea") {
        return (
            <td className="px-3 py-2 align-top">
                {isEditMode ? (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => updateCell(row.id, facet.key, e.target.value)}
                        placeholder="비고 입력..."
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                ) : (
                    <div className="px-3 py-2 text-sm text-gray-700 min-h-[40px] flex items-center">
                        {value || <span className="text-gray-400">-</span>}
                    </div>
                )}
            </td>
        );
    }

    // single 타입 처리 - 단일 선택 (담당자 전달용)
    if (facet.type === "single") {
        return (
            <td className="px-3 py-2 align-top">
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
                            <span className="block truncate text-sm">{isDisabled ? "-" : (value || "선택")}</span>
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
                    <div className="px-3 py-2 text-sm text-gray-700 min-h-[40px] flex items-center">
                        {isDisabled ? "-" : (value || <span className="text-gray-400">-</span>)}
                    </div>
                )}
            </td>
        );
    }

    // 기본 multi 타입 처리 - existence 비활성화 로직 적용
    return (
        <td className="px-3 py-2 align-top">
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
                        <span className="block truncate text-sm">{isDisabled ? "-" : displayText}</span>
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
                <div className="px-3 py-2 text-sm min-h-[40px] flex items-center">
                    {isDisabled ? (
                        <span className="text-gray-400">-</span>
                    ) : values.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {values.map((v: string, idx: number) => (
                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-medium">
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

        options.forEach(option => {
            groups[option] = items.filter((item: any) => {
                const values = unpack(item.facets?.[facet.key] || "");
                return values.some((v: string) => normalize(v) === normalize(option));
            });
        });

        return groups;
    }, [facet, options, items]);

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
        <div className="space-y-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2">
                    <Columns className="w-5 h-5 text-gray-600" />
                    <span className="font-semibold text-gray-900">기준별 보기</span>
                </div>
                <div className="flex items-center gap-3">
                    {/* 뷰 타입 토글 */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setViewType("card")}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewType === "card"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                                }`}
                        >
                            카드
                        </button>
                        <button
                            onClick={() => setViewType("grid")}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewType === "grid"
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                                }`}
                        >
                            그리드
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">보기 기준:</label>
                        <select
                            value={facet?.key || ""}
                            onChange={(e) => setFacetKey(e.target.value)}
                            className="h-10 px-3 pr-8 rounded-lg border border-gray-300 bg-white text-sm font-medium focus:ring-2 focus:ring-gray-900 focus:border-transparent min-w-[150px]"
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
                                    placeholder={`새 ${facet?.label || '옵션'} 추가 (실제 이용하는 명칭을 적어주세요)`}
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

            {/* 그리드 뷰 */}
            {viewType === "grid" && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-[140px] sticky left-0 bg-gray-50 z-10">
                                        {facet?.label || "기준"}
                                    </th>
                                    {items.map((it: any) => (
                                        <th key={it.id} className="px-2 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-[100px]">
                                            {it.name || "(이름 없음)"}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {options.map((opt) => (
                                    <tr key={opt} className="hover:bg-gray-50">
                                        <td className="px-3 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                                            {getOptionLabel(opt)}
                                        </td>
                                        {items.map((it: any) => {
                                            const values = unpack(it.facets?.[facet.key] || "");
                                            const active = values.some((v: string) => normalize(v) === normalize(opt));
                                            return (
                                                <td key={it.id + opt} className="px-2 py-2">
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
                                    placeholder={`새 ${facet?.label || '옵션'} 추가 (실제 이용하는 명칭을 적어주세요)`}
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

    // 편집 모드 상태
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [draftData, setDraftData] = React.useState<any>(null);

    // 모바일 UI 상태
    const [quickAddOpen, setQuickAddOpen] = React.useState(false);
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
            const fromTpl = templates?.[sid];
            const derivedFacets = deriveTemplateFromItems(data?.items?.[sid] || [], sid);
            map[sid] = ensureTemplateShape(sid, fromTpl, derivedFacets);
        });
        return map;
    }, [data.sheets, data.activeSheet, data.items, templates]);

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
    // n8n 데이터 전송 함수
    // ────────────────────────────────────────────────────────────
    const prepareForVectorization = (sheets: string[], items: any, lib: any) => {
        const result: any[] = [];

        sheets.forEach((sheetId: string) => {
            const sheetItems = items[sheetId] || [];
            const template = allTemplates[sheetId] || {};

            sheetItems.forEach((item: any) => {
                const vectorItem: any = {
                    name: item.name,
                    sheet: template.title || sheetId,
                };

                template.facets?.forEach((facet: any) => {
                    const rawValue = item.facets?.[facet.key];
                    const label = facet.label;

                    if (!rawValue && rawValue !== false && rawValue !== "false") {
                        return;
                    }

                    switch (facet.type) {
                        case "checkbox":
                            vectorItem[label] = rawValue === "true" || rawValue === true;
                            break;

                        case "library-ref":
                            const libraryType = facet.libraryType || "links";
                            const libraryItems = lib?.[libraryType] || {};
                            const keys = String(rawValue).split(',').filter(Boolean);

                            const libraryValues: any = {};
                            keys.forEach((key: string) => {
                                if (libraryItems[key]) {
                                    libraryValues[libraryItems[key].label] = libraryItems[key].value;
                                }
                            });

                            vectorItem[label] = libraryValues;
                            break;

                        case "multi":
                            vectorItem[label] = String(rawValue)
                                .split(',')
                                .filter(Boolean)
                                .map((v: string) => v.trim());
                            break;

                        case "single":
                        case "textarea":
                        default:
                            vectorItem[label] = String(rawValue);
                            break;
                    }
                });

                result.push(vectorItem);
            });
        });

        return result;
    };

    const syncToN8n = async (sheets: string[], items: any, lib: any, tid: string) => {
        try {
            const vectorData = prepareForVectorization(sheets, items, lib);

            const response = await fetch('https://soluto.app.n8n.cloud/webhook/criteria-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: tid,
                    timestamp: new Date().toISOString(),
                    items: vectorData
                })
            });

            if (!response.ok) {
                throw new Error(`n8n sync failed: ${response.status}`);
            }

            console.log('✅ n8n 데이터 전송 완료:', vectorData.length, '개 항목');
        } catch (error) {
            console.error('⚠️ n8n 데이터 전송 실패:', error);
            throw error;
        }
    };

    // ────────────────────────────────────────────────────────────
    // 저장/취소
    // ────────────────────────────────────────────────────────────
    const handleSaveEdits = React.useCallback(async () => {
        if (!draftData) return;

        try {
            const cleanSheets = draftData.sheets.filter((s: string) =>
                s !== 'templates' &&
                s !== 'updatedAt'
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
            } else {
                console.log("📦 저장 (로컬)", payload);
            }

            // n8n 데이터 전송 (비동기, 실패해도 저장은 완료)
            syncToN8n(cleanSheets, draftData.items, library, tenantId).catch(err => {
                console.error('⚠️ n8n 데이터 전송 실패:', err);
            });

            // 저장 성공 후 실제 데이터에 반영
            setData(draftData);
            setIsEditMode(false);
            setDraftData(null);
            lastAutoSaveAt.current = Date.now();
        } catch (err) {
            console.error("Save error:", err);
            alert("❌ 저장 실패");
        }
    }, [draftData, onSave, library, tenantId]);

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

    const addRowsBulk = (names: string[]) => {
        const presets = PRESET_ITEMS[activeSheetId] || [];
        const currentItems = getCurrentData().items[activeSheetId] || [];
        const newRows = names.map((name, idx) => {
            const preset = presets.find((p: any) => p.name === name);
            return {
                id: `row_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 9)}`,
                name,
                facets: preset?.facets || {},
                order: currentItems.length + idx,
            };
        });
        setCurrentData((prev: any) => ({
            ...prev,
            items: {
                ...prev.items,
                [activeSheetId]: [...(prev.items[activeSheetId] || []), ...newRows],
            },
        }));
    };

    const removeRow = (rowId: string, rowName: string) => {
        // 프리셋에서 required 체크
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
    // Airtable 데이터 전송
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
                throw new Error('데이터 전송 실패');
            }

            const result = await response.json();

            alert(`✅ Airtable 데이터 전송 완료!\n\n` +
                `• 항목: ${result.data.totalItems}개\n` +
                `• 질문: ${result.data.totalQuestions}개\n` +
                `• 시트: ${result.data.sheets.join(', ')}`);
        } catch (error) {
            console.error('Airtable sync error:', error);
            alert('❌ 데이터 전송 실패\n\n잠시 후 다시 시도해주세요.');
        } finally {
            setIsSyncing(false);
        }
    };

    // ────────────────────────────────────────────────────────────
    // CSV 내보내기
    // ────────────────────────────────────────────────────────────
    const exportToCSV = () => {
        const items = activeItems;
        if (!items || items.length === 0) {
            alert("내보낼 데이터가 없습니다.");
            return;
        }

        // CSV 헤더 생성
        const headers = ["항목명"];
        visibleFacets.forEach((facet: any) => {
            headers.push(facet.label);
        });

        // CSV 데이터 생성
        const rows = items.map((item: any) => {
            const row = [item.name || ""];

            visibleFacets.forEach((facet: any) => {
                const value = item.facets?.[facet.key] || "";

                // 라이브러리 참조 타입인 경우 label로 변환
                if (facet.type === "library-ref") {
                    const libraryType = facet.libraryType || "links";
                    const libraryItems = library?.[libraryType] || {};
                    const keys = String(value).split(',').filter(Boolean);
                    const labels = keys
                        .map(k => libraryItems[k]?.label)
                        .filter(Boolean)
                        .join(', ');
                    row.push(labels || "");
                } else if (facet.type === "checkbox") {
                    // 체크박스는 O/X로
                    row.push(value === "true" ? "O" : "X");
                } else {
                    // 일반 필드
                    row.push(String(value).replace(/,/g, '、')); // 쉼표를 점으로 변경
                }
            });

            return row;
        });

        // CSV 문자열 생성
        const csvContent = [
            headers.map(h => `"${h}"`).join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // BOM 추가 (엑셀에서 한글 깨짐 방지)
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

        // 다운로드
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${template.title}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ────────────────────────────────────────────────────────────
    // 🎨 UI 렌더링 (모바일 최적화)
    // ────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50 pb-24 relative">
            {/* Level 2: 페이지 설명 헤더 */}
            <div className="bg-white border-b sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
                    <div className="flex items-center justify-between">
                        {/* 좌측: 설명 텍스트 */}
                        <p className="text-sm text-gray-600">
                            시트별로 항목을 관리하고, 기준을 설정하세요
                        </p>

                        {/* 우측: 액션 버튼 */}
                        {!isEditMode && activeItems.length > 0 && (
                            <button
                                onClick={handleSyncToAirtable}
                                disabled={isSyncing}
                                className="px-3 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">{isSyncing ? '데이터 전송 중...' : '데이터 전송'}</span>
                            </button>
                        )}

                        {/* 편집 모드 */}
                        {isEditMode && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCancelEdits}
                                    className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleSaveEdits}
                                    className="px-4 py-2 rounded-xl bg-yellow-400 text-gray-900 font-semibold hover:bg-yellow-500 transition-colors"
                                >
                                    저장
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
                {/* 시트 탭 - 애플 스타일 */}
                <div className="bg-white rounded-2xl shadow-sm p-3 sticky top-[73px] z-20">
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                        {(data.sheets || []).map((sheetId: string) => {
                            const t = allTemplates[sheetId] || { icon: "🧩", title: sheetId };
                            const isActive = activeSheetId === sheetId;
                            const itemCount = data.items[sheetId]?.length || 0;
                            return (
                                <div key={sheetId} className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                        onClick={() => {
                                            setData((prev: any) => ({ ...prev, activeSheet: sheetId }));
                                        }}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${isActive
                                            ? "bg-gray-900 text-white"
                                            : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                                            }`}
                                    >
                                        {t.title}
                                        {itemCount > 0 && (
                                            <span className={`ml-2 text-xs ${isActive ? "text-gray-300" : "text-gray-400"}`}>
                                                {itemCount}
                                            </span>
                                        )}
                                    </button>
                                    {/* 편집 모드에서 삭제 버튼 표시 */}
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
                                            className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center justify-center flex-shrink-0"
                                            title="시트 삭제"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        {/* 시트 추가 버튼 */}
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
                                        setData((prev: any) => ({
                                            ...prev,
                                            sheets: [...prev.sheets, sheetId],
                                            items: { ...prev.items, [sheetId]: [] },
                                            activeSheet: sheetId,
                                        }));
                                    }
                                }}
                                className="flex-shrink-0 w-9 h-9 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center text-gray-600"
                                title="시트 추가"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* 🎨 Level 4: 뷰 토글 - 미니 세그먼트 */}
                <div className="flex justify-center">
                    <div className="relative inline-flex items-center gap-0.5 p-0.5 bg-black/5 rounded-full">
                        {/* 슬라이더 */}
                        <div
                            className={`absolute top-0.5 bottom-0.5 w-[calc(50%-1px)] transition-all duration-300 ease-out bg-white rounded-full shadow-lg ${viewMode === "item" ? 'left-0.5' : 'left-[calc(50%+1px)]'
                                }`}
                        />

                        <button
                            onClick={() => setViewMode("item")}
                            className={`relative z-10 w-20 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${viewMode === "item" ? 'text-gray-900' : 'text-gray-500'
                                }`}
                        >
                            항목별
                        </button>

                        <button
                            onClick={() => setViewMode("facet")}
                            className={`relative z-10 w-20 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${viewMode === "facet" ? 'text-gray-900' : 'text-gray-500'
                                }`}
                        >
                            기준별
                        </button>
                    </div>
                </div>

                {/* 테이블 영역 */}
                {viewMode === "item" && (
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        {activeItems.length === 0 ? (
                            <div className="px-4 py-20 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                                    <Plus className="w-8 h-8 text-gray-400" />
                                </div>
                                <p className="text-lg font-medium text-gray-900 mb-2">항목이 없습니다</p>
                                <p className="text-sm text-gray-500 mb-6">
                                    첫 번째 항목을 추가해보세요
                                </p>
                                {isEditMode && (
                                    <button
                                        onClick={() => setQuickAddOpen(true)}
                                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                                    >
                                        <Plus className="w-5 h-5" />
                                        항목 추가
                                    </button>
                                )}
                            </div>
                        ) : (

                            <div className="overflow-x-auto">
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleRowDragEnd}
                                >
                                    <table className="w-full min-w-[800px]">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="w-8"></th>
                                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-[180px]">
                                                    이름
                                                </th>
                                                {visibleFacets.map((facet: any) => {
                                                    // 컬럼 타입에 따라 너비 조정
                                                    let widthClass = "";
                                                    if (facet.type === "checkbox") {
                                                        widthClass = "w-20"; // 체크박스는 좁게
                                                    } else if (facet.key === "notes" || facet.type === "textarea") {
                                                        widthClass = "w-[200px]"; // 비고는 넓게
                                                    } else if (facet.key === "location") {
                                                        widthClass = "w-[120px]"; // 위치는 중간
                                                    }
                                                    // 나머지는 자동 너비 (widthClass 없음)

                                                    return (
                                                        <th
                                                            key={facet.key}
                                                            className={`px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase ${widthClass}`}
                                                        >
                                                            {facet.label}
                                                        </th>
                                                    );
                                                })}
                                                {isEditMode && (
                                                    <th className="w-16 px-2">
                                                        <button
                                                            onClick={() => setColumnManageOpen(true)}
                                                            className="w-8 h-8 rounded-lg hover:bg-gray-200 flex items-center justify-center transition-colors mx-auto"
                                                            title="열 관리"
                                                        >
                                                            <Settings className="w-4 h-4 text-gray-600" />
                                                        </button>
                                                    </th>
                                                )}
                                                <th className="w-12"></th>
                                            </tr>
                                        </thead>
                                        <SortableContext
                                            items={activeItems.map((r: any) => r.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <tbody className="divide-y divide-gray-100">
                                                {activeItems.map((row: any) => (
                                                    <Row key={row.id} row={row} isEditMode={isEditMode}>
                                                        <td className="px-3 py-2 align-top">
                                                            {isEditMode ? (
                                                                <input
                                                                    type="text"
                                                                    value={row.name}
                                                                    onChange={(e) => updateRowName(row.id, e.target.value)}
                                                                    placeholder="항목명"
                                                                    className={`w-full px-3 py-2 rounded-lg border transition-all text-sm font-medium ${row.name
                                                                        ? "border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                        : "border-gray-200 bg-white text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:text-gray-900"
                                                                        }`}
                                                                />
                                                            ) : (
                                                                <div className="px-3 py-2 text-sm font-medium text-gray-900 min-h-[40px] flex items-center">
                                                                    {row.name || <span className="text-gray-400">항목명</span>}
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
                                                                    className="w-9 h-9 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                                                                    title="삭제"
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

                                {/* 인라인 행 추가 버튼 - 편집 모드에서만 표시 */}
                                {isEditMode && (
                                    <div className="border-t p-3">
                                        <button
                                            onClick={() => setQuickAddOpen(true)}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 hover:border-gray-900 hover:bg-gray-50 transition-all font-medium"
                                        >
                                            <Plus className="w-5 h-5" />
                                            <span>항목 추가</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
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
            <QuickAddBottomSheet
                isOpen={quickAddOpen}
                onClose={() => setQuickAddOpen(false)}
                sheetId={activeSheetId}
                onAdd={addRow}
                onAddAll={addRowsBulk}
            />

            <ColumnManageBottomSheet
                isOpen={columnManageOpen}
                onClose={() => setColumnManageOpen(false)}
                sheetId={activeSheetId}
                allFacets={template.facets}
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

            {/* FAB - 편집 버튼 (애플 스타일) */}
            {!isEditMode && (
                <button
                    onClick={handleEnterEditMode}
                    className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gray-900 text-white shadow-lg hover:bg-gray-800 transition-all hover:scale-105 active:scale-95 z-40 flex items-center justify-center"
                    aria-label="편집 모드"
                >
                    <Edit3 className="w-5 h-5" />
                </button>
            )}
        </div>
    );
}