// components/mypage/CriteriaSheetEditor.tsx
// ✅ 2025-11-07 모바일 UI 개선 버전 (로직은 기존과 동일)
// - 플로팅 액션 버튼으로 통합
// - 바텀시트 모달
// - 세그먼트 컨트롤
// - 카테고리 상단 고정
// - 저장 버튼 우측 상단으로 이동

import React from "react";
import {
    Plus, X, GripVertical, ChevronDown, Calendar, Clock, Type, Settings, Columns, Eye, EyeOff, Save, Edit3, Check
} from "lucide-react";
import {
    DndContext,
    PointerSensor,
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
// 서버 API (기존 유지)
// ────────────────────────────────────────────────────────────
const apiCreateItem = async (
    tenantId: string,
    data: { sheetId: string; name: string; facetRefs?: { [facetId: string]: string[] } }
) => {
    const res = await fetch("/api/items/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, ...data }),
    });
    if (!res.ok) throw new Error("Failed to create item");
    return res.json();
};

const apiUpdateItem = async (tenantId: string, itemId: string, updates: any) => {
    const res = await fetch("/api/items/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, itemId, updates }),
    });
    if (!res.ok) throw new Error("Failed to update item");
    return res.json();
};

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

function useSortableCol(id: string) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        ...(isDragging ? { opacity: 0.5 } : {}),
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
// 플로팅 액션 버튼 (신규 UI 컴포넌트)
// ────────────────────────────────────────────────────────────
function FloatingActionButton({ onQuickAdd, onColumnManage, onAddEmpty }: any) {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <>
            {/* 백드롭 */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-[90]"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* 서브 메뉴 */}
            {isOpen && (
                <div className="fixed bottom-24 right-5 z-[91] flex flex-col gap-3">
                    <button
                        onClick={() => {
                            onQuickAdd();
                            setIsOpen(false);
                        }}
                        className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all"
                    >
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Plus className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="font-medium text-gray-700 whitespace-nowrap">프리셋 추가</span>
                    </button>
                    <button
                        onClick={() => {
                            onColumnManage();
                            setIsOpen(false);
                        }}
                        className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all"
                    >
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <Settings className="w-5 h-5 text-purple-600" />
                        </div>
                        <span className="font-medium text-gray-700 whitespace-nowrap">기준 관리</span>
                    </button>
                    <button
                        onClick={() => {
                            onAddEmpty();
                            setIsOpen(false);
                        }}
                        className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all"
                    >
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                            <Plus className="w-5 h-5 text-green-600" />
                        </div>
                        <span className="font-medium text-gray-700 whitespace-nowrap">빈 행 추가</span>
                    </button>
                </div>
            )}

            {/* 메인 버튼 */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-5 right-5 z-[92] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all ${isOpen
                    ? 'bg-gray-700 rotate-45'
                    : 'bg-blue-600 hover:bg-blue-700'
                    }`}
            >
                <Plus className="w-7 h-7 text-white" />
            </button>
        </>
    );
}

// ────────────────────────────────────────────────────────────
// 세그먼트 컨트롤 (신규 UI 컴포넌트)
// ────────────────────────────────────────────────────────────
function SegmentedControl({ value, onChange, options }: any) {
    return (
        <div className="inline-flex bg-gray-100 rounded-xl p-1">
            {options.map((option: any) => (
                <button
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${value === option.value
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600'
                        }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// SortableOptionButton (편집모드용 정렬 가능한 옵션 버튼)
// ────────────────────────────────────────────────────────────
function SortableOptionButton({
    label,
    active,
    isSelected,
    onToggleSelection
}: {
    label: string;
    active: boolean;
    isSelected: boolean;
    onToggleSelection: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: label });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative rounded-lg ${isDragging ? "ring-2 ring-blue-200" : ""}`}
        >
            <button
                onClick={onToggleSelection}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${active
                    ? "bg-blue-600 text-white shadow"
                    : isSelected
                        ? "bg-red-100 text-red-700 ring-1 ring-red-300"
                        : "bg-white text-slate-700 hover:bg-slate-100"
                    }`}
            >
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => { }}
                    className="w-3 h-3 accent-blue-600"
                />
                <span>{label}</span>
                <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-3 h-3 text-slate-400" />
                </span>
            </button>
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// InlineDropdown (기존 유지 - 모바일에서는 바텀시트로 자동 전환)
// ────────────────────────────────────────────────────────────
function InlineDropdown({
    cellRef,
    facet,
    value,
    onChange,
    onClose,
    customOptions,
    onDeleteCustomOption,
    onUpdateFacetOptions,  // 새로 추가: facet.options 수정용
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

    const handleBulkDeleteOptions = () => {
        if (!optionBulkSelection.length || !onUpdateFacetOptions) return;

        const newOptions = (facet.options || [])
            .map((opt: any) => {
                if (typeof opt === 'string') {
                    return !optionBulkSelection.includes(opt) ? opt : null;
                } else if (opt?.group && Array.isArray(opt.items)) {
                    // 그룹 내에서 선택된 항목들 제거
                    const filteredItems = opt.items.filter((item: string) => !optionBulkSelection.includes(item));
                    // 그룹 내 항목이 없으면 null 반환 (그룹 제거)
                    return filteredItems.length > 0 ? { ...opt, items: filteredItems } : null;
                }
                return opt;
            })
            .filter((opt: any) => opt !== null); // null 제거

        onUpdateFacetOptions(facet.key, newOptions);
        setOptionBulkSelection([]);
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
                                            useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
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
// QuickAddBottomSheet - 미니멀 & 모던 디자인
// ────────────────────────────────────────────────────────────
function QuickAddBottomSheet({ isOpen, onClose, sheetId, onAdd, onAddAll }: any) {
    const [customName, setCustomName] = React.useState("");
    const presets = PRESET_ITEMS[sheetId] || [];

    const add = (name?: string) => {
        if (!name?.trim()) return;
        onAdd(name.trim());
        setCustomName("");
        onClose();
    };

    return (
        <MobileBottomSheet isOpen={isOpen} onClose={onClose} title="항목 추가">
            <div className="space-y-5">
                {/* 직접 입력 */}
                <div className="flex gap-2">
                    <input
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && add(customName)}
                        placeholder="항목명 입력..."
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                    />
                    <button
                        onClick={() => add(customName)}
                        disabled={!customName.trim()}
                        className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                        추가
                    </button>
                </div>

                {/* 프리셋 */}
                {presets.length > 0 && (
                    <div className="pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-gray-500">프리셋에서 선택</span>
                            <button
                                onClick={() => {
                                    onAddAll(presets.map((p: any) => p.name));
                                    onClose();
                                }}
                                className="text-xs text-blue-600 font-medium hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                            >
                                전체 추가
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            {presets.map((p: any) => (
                                <button
                                    key={p.name}
                                    onClick={() => add(p.name)}
                                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left group"
                                >
                                    <span className="text-xl group-hover:scale-110 transition-transform">{p.icon || "📌"}</span>
                                    <span className="font-medium text-gray-900 text-sm truncate">{p.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
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

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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
                <div className={`text-sm font-medium truncate ${isVisible ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                    {facet.label}
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
function CellEditor({ row, facet, sheetId, openDropdown, setOpenDropdown, updateCell, addCustomOption, deleteCustomOption, customOptions, isEditMode = false, onUpdateFacetOptions }: any) {
    const cellRef = React.useRef<HTMLButtonElement | HTMLTextAreaElement | null>(null);
    const value = row.facets[facet.key] || "";
    const values = unpack(value);
    const displayText =
        values.length === 0 ? "선택" : values.length === 1 ? values[0] : values.length === 2 ? values.join(", ") : `${values[0]} 외 ${values.length - 1}개`;
    const isOpen = openDropdown?.rowId === row.id && openDropdown?.facetKey === facet.key;
    const customKey = `${sheetId}::${facet.key}`;

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

// ────────────────────────────────────────────────────────────
// FacetPivotView (기준 보기)
// ────────────────────────────────────────────────────────────
function FacetListItem({ facet, items, onToggle, customOptions, addCustomOption }: any) {
    const customKey = `pivot::${facet.key}`;

    const grouped = React.useMemo(() => {
        const map: Record<string, any[]> = {};

        const flatOptions: string[] = [];
        (facet.options || []).forEach((opt: any) => {
            if (typeof opt === "string") {
                flatOptions.push(opt);
            } else if (opt?.group && Array.isArray(opt.items)) {
                opt.items.forEach((item: string) => flatOptions.push(item));
            }
        });

        const customs = customOptions || [];
        [...flatOptions, ...customs].forEach((opt) => {
            map[opt] = [];
        });

        items.forEach((item: any) => {
            const values = unpack(item.facetRefs?.[facet.key] || item.facets?.[facet.key]);
            if (values.length === 0) {
                if (!map["미지정"]) map["미지정"] = [];
                map["미지정"].push(item);
            } else {
                values.forEach((val) => {
                    if (!map[val]) map[val] = [];
                    map[val].push(item);
                });
            }
        });

        return map;
    }, [facet, items, customOptions]);

    return (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
            <div className="px-5 py-4 bg-gray-50 border-b">
                <h3 className="text-lg font-semibold text-gray-900">{facet.label}</h3>
                <p className="text-sm text-gray-500 mt-1">{facet.key}</p>
            </div>

            <div className="divide-y divide-gray-100">
                {Object.entries(grouped).map(([option, optionItems]: [string, any]) => (
                    <div key={option} className="px-5 py-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-base font-medium text-gray-900">{option}</span>
                                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                                    {optionItems.length}
                                </span>
                            </div>
                        </div>

                        {optionItems.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {optionItems.map((item: any) => {
                                    const hasThisOption = unpack(
                                        item.facetRefs?.[facet.key] || item.facets?.[facet.key]
                                    ).includes(option);

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => onToggle(item.id, facet.key, option, !hasThisOption)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${hasThisOption
                                                ? "bg-blue-600 text-white"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                }`}
                                        >
                                            {item.icon && <span className="mr-1">{item.icon}</span>}
                                            {item.name}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400">해당하는 항목이 없습니다</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function FacetPivotView({ sheetId, template, items, onToggleMembership, customOptions, addCustomOption }: any) {
    // 체크박스 타입 제외한 facet만 사용
    const availableFacets = React.useMemo(() =>
        template.facets.filter((f: any) => f.type !== 'checkbox'),
        [template.facets]
    );

    const [facetKey, setFacetKey] = React.useState(() => (availableFacets?.[0]?.key || ""));
    const facet = React.useMemo(() =>
        availableFacets.find((f: any) => f.key === facetKey) || availableFacets[0] || null,
        [facetKey, availableFacets]
    );

    const options: string[] = React.useMemo(() => {
        if (!facet) return [];
        const base: string[] = [];
        (facet.options || []).forEach((opt: any) => {
            if (typeof opt === "string") base.push(opt);
            else if (opt?.group) (opt.items || []).forEach((i: string) => base.push(i));
        });
        const customKey = `${sheetId}::${facet.key}`;
        const customs = (customOptions[customKey] || []).filter((c: string) => !base.some((b) => normalize(b) === normalize(c)));
        return [...base, ...customs];
    }, [facet, sheetId, customOptions]);

    const [newOpt, setNewOpt] = React.useState("");
    const [optionError, setOptionError] = React.useState("");

    const addOpt = () => {
        // 공백 제거하고 trimmed 값만 사용
        const v = newOpt.trim();

        // 유효성 검사
        if (!v) {
            setOptionError("옵션 이름을 입력하세요");
            return;
        }

        if (!facet) {
            setOptionError("기준을 선택하세요");
            return;
        }

        // 이미 존재하는 옵션인지 확인
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

    if (!facet || items.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <p className="text-gray-400">기준 중심 보기를 사용하려면 먼저 항목을 추가하세요.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
                <div className="flex flex-col gap-4">
                    {/* 헤더와 기준 선택 */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Columns className="w-5 h-5 text-gray-600" />
                            <span className="font-semibold text-gray-900">기준 중심 보기</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">보기 기준:</label>
                            <select
                                value={facet?.key || ""}
                                onChange={(e) => setFacetKey(e.target.value)}
                                className="h-10 px-3 pr-8 rounded-lg border border-gray-300 bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[150px]"
                            >
                                {availableFacets.map((f: any) => (
                                    <option key={f.key} value={f.key}>
                                        {f.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 새 옵션 추가 */}
                    <div className="pt-2 border-t">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">새 옵션:</label>
                            <div className="flex-1">
                                <input
                                    value={newOpt}
                                    onChange={(e) => {
                                        setNewOpt(e.target.value);
                                        setOptionError("");
                                    }}
                                    onKeyDown={(e) => e.key === "Enter" && addOpt()}
                                    placeholder={`${facet?.label || '기준'} 옵션 입력 (예: 빈백)`}
                                    className={`w-full h-10 px-3 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${optionError ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                                        }`}
                                />
                                {optionError && (
                                    <p className="text-xs text-red-600 mt-1">{optionError}</p>
                                )}
                            </div>
                            <button
                                onClick={addOpt}
                                disabled={!newOpt.trim()}
                                className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-4 h-4 inline mr-1" />
                                추가
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                    <thead className="bg-gray-50 border-b sticky top-0">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-[220px]">{facet?.label || "기준"}</th>
                            {items.map((it: any) => (
                                <th key={it.id} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase min-w-[160px]">
                                    {it.name || "(이름 없음)"}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {options.map((opt) => (
                            <tr key={opt} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{opt}</td>
                                {items.map((it: any) => {
                                    const values = unpack(it.facets[facet.key] || "");
                                    const active = values.some((v) => normalize(v) === normalize(opt));
                                    return (
                                        <td key={it.id + opt} className="px-4 py-2">
                                            <button
                                                onClick={() => onToggleMembership(it.id, facet.key, opt, !active)}
                                                className={`w-full h-9 rounded-lg border text-sm font-medium transition-colors ${active
                                                    ? "bg-blue-600 text-white border-blue-600"
                                                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                                                    }`}
                                            >
                                                {active ? "✔ 배정됨" : "+ 추가"}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// 🚀 메인 컴포넌트 (UI만 개선, 로직은 기존 유지)
// ─────────────────────────────────────────────────────────────────────
export default function CriteriaSheetEditor({ tenantId, initialData, templates, onSave }: any) {
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
            };

            if (onSave) {
                await onSave(payload);
            } else {
                console.log("📦 저장 (로컬)", payload);
            }

            // 저장 성공 후 실제 데이터에 반영
            setData(draftData);
            setIsEditMode(false);
            setDraftData(null);
            lastAutoSaveAt.current = Date.now();
        } catch (err) {
            console.error("Save error:", err);
            alert("❌ 저장 실패");
        }
    }, [draftData, onSave]);

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

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    // ────────────────────────────────────────────────────────────
    // 🎨 UI 렌더링 (모바일 최적화)
    // ────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* 헤더 */}
            <div className="bg-white border-b sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">데이터 관리</h1>
                            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                                {isEditMode ? "편집 중..." : "자동 저장됨"}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {isEditMode ? (
                                <>
                                    <button
                                        onClick={handleCancelEdits}
                                        className="flex items-center gap-2 h-10 px-4 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                        <span className="hidden sm:inline">취소</span>
                                    </button>
                                    <button
                                        onClick={handleSaveEdits}
                                        className="flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-lg"
                                    >
                                        <Check className="w-4 h-4" />
                                        <span className="hidden sm:inline">저장</span>
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={handleEnterEditMode}
                                    className="flex items-center gap-2 h-10 px-4 rounded-xl bg-white border-2 border-gray-200 text-gray-700 font-medium hover:border-blue-500 hover:text-blue-600 transition-all"
                                >
                                    <Edit3 className="w-4 h-4" />
                                    <span className="hidden sm:inline">편집</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
                {/* 카테고리 탭 (상단 고정) */}
                <div className="bg-white rounded-2xl shadow-sm p-3 sticky top-[73px] z-20">
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {(data.sheets || []).map((sheetId: string) => {
                            const t = allTemplates[sheetId] || { icon: "🧩", title: sheetId };
                            const isActive = activeSheetId === sheetId;
                            const itemCount = data.items[sheetId]?.length || 0;
                            return (
                                <button
                                    key={sheetId}
                                    onClick={() => {
                                        setData((prev: any) => ({ ...prev, activeSheet: sheetId }));
                                    }}
                                    className={`flex-shrink-0 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${isActive
                                        ? "bg-blue-600 text-white shadow-md"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                >
                                    <span className="mr-2">{t.icon}</span>
                                    {t.title}
                                    {itemCount > 0 && (
                                        <span
                                            className={`ml-2 text-xs px-2 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-gray-200"
                                                }`}
                                        >
                                            {itemCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 보기 모드 (세그먼트 컨트롤) */}
                <div className="bg-white rounded-2xl shadow-sm p-4">
                    <SegmentedControl
                        value={viewMode}
                        onChange={setViewMode}
                        options={[
                            { value: "item", label: "항목별 보기" },
                            { value: "facet", label: "기준별 보기" },
                        ]}
                    />
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
                                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-[240px]">
                                                    이름
                                                </th>
                                                {visibleFacets.map((facet: any) => (
                                                    <th
                                                        key={facet.key}
                                                        className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase"
                                                    >
                                                        {facet.label}
                                                    </th>
                                                ))}
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
                                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium"
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

            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}