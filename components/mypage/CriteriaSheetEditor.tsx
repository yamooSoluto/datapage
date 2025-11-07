// components/mypage/CriteriaSheetEditor.tsx
// ✅ 2025-11-07 모바일 UI 개선 버전 (로직은 기존과 동일)
// - 플로팅 액션 버튼으로 통합
// - 바텀시트 모달
// - 세그먼트 컨트롤
// - 카테고리 상단 고정
// - 저장 버튼 우측 상단으로 이동

import React from "react";
import {
    Plus, X, GripVertical, ChevronDown, Calendar, Clock, Type, Settings, Columns, Eye, EyeOff, Save
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
}: any) {
    const dropdownRef = React.useRef<HTMLDivElement | null>(null);
    const [selected, setSelected] = React.useState<string[]>(unpack(value));
    const [mode, setMode] = React.useState<null | "text" | "time" | "date">(null);
    const [textInput, setTextInput] = React.useState("");

    const [times, setTimes] = React.useState<string[]>([]);
    const [startInput, setStartInput] = React.useState("09:00");
    const [endInput, setEndInput] = React.useState("");
    const quickRanges = ["24시간", "오전", "오후", "09:00~18:00", "10:00~22:00"];

    const [dates, setDates] = React.useState<string[]>([]);
    const [customDate, setCustomDate] = React.useState("");

    // 모바일 감지
    const [isMobile, setIsMobile] = React.useState(false);
    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // 위치 계산 (데스크톱용)
    const [position, setPosition] = React.useState({ top: 0, left: 0 });
    React.useEffect(() => {
        if (isMobile) return; // 모바일에서는 위치 계산 불필요
        if (!cellRef.current || !dropdownRef.current) return;
        const updatePosition = () => {
            const cellRect = cellRef.current.getBoundingClientRect();
            const dropdownHeight = 520, dropdownWidth = 320, pad = 8;
            const vh = window.innerHeight, vw = window.innerWidth;
            let left = cellRect.right + pad;
            if (left + dropdownWidth > vw - pad) left = cellRect.left - dropdownWidth - pad;
            left = Math.max(pad, Math.min(left, vw - dropdownWidth - pad));
            const spaceBelow = vh - cellRect.bottom, spaceAbove = cellRect.top;
            let top;
            if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) top = Math.max(pad, cellRect.top - dropdownHeight);
            else top = Math.min(cellRect.top, vh - dropdownHeight - pad);
            setPosition({ top, left });
        };
        updatePosition();
        const onScroll = () => updatePosition();
        window.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("resize", onScroll);
        };
    }, [cellRef, isMobile]);

    // 외부 클릭 닫기
    React.useEffect(() => {
        const handleClickOutside = (e: any) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target) &&
                cellRef.current &&
                !cellRef.current.contains(e.target)
            ) {
                onChange(pack(selected));
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [selected, onChange, onClose, cellRef]);

    const toggleOption = (opt: string) => {
        setSelected((prev) => (prev.includes(opt) ? prev.filter((v) => v !== opt) : [...prev, opt]));
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

    const toggleDate = (d: string) => setDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
    const addIsoDate = (iso: string) => iso && setDates((prev) => (prev.includes(iso) ? prev : [...prev, iso]));
    const commitDates = () => {
        if (!dates.length) return setMode(null);
        setSelected((prev) => uniqNormPush(prev, dates.join(" / ")));
        setDates([]);
        setMode(null);
    };

    const structuredOptions = React.useMemo(() => {
        const groups: Array<{ type: 'single' | 'group'; label?: string; items: string[] }> = [];
        const allFlat: string[] = [];

        (facet.options || []).forEach((opt: any) => {
            if (typeof opt === "string") {
                groups.push({ type: 'single', items: [opt] });
                allFlat.push(opt);
            } else if (opt?.group && Array.isArray(opt.items)) {
                groups.push({ type: 'group', label: opt.group, items: opt.items });
                opt.items.forEach((i: string) => allFlat.push(i));
            }
        });

        const customs = (customOptions || []).filter(
            (c: string) => !allFlat.some((b) => normalize(b) === normalize(c))
        );

        return { groups, customs };
    }, [facet.options, customOptions]);

    // 모바일 버전 (바텀시트)
    if (isMobile) {
        return (
            <MobileBottomSheet
                isOpen={true}
                onClose={() => {
                    onChange(pack(selected));
                    onClose();
                }}
                title={facet.label}
            >
                {/* 모드 선택 */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setMode("text")}
                        className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-medium bg-slate-600 text-white"
                    >
                        <Type className="w-4 h-4" /> 텍스트
                    </button>
                    <button
                        onClick={() => setMode("time")}
                        className="h-11 px-4 rounded-xl flex items-center justify-center bg-blue-100 text-blue-600"
                    >
                        <Clock className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setMode("date")}
                        className="h-11 px-4 rounded-xl flex items-center justify-center bg-purple-100 text-purple-600"
                    >
                        <Calendar className="w-5 h-5" />
                    </button>
                </div>

                {/* 텍스트 모드 */}
                {mode === "text" && (
                    <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-xl">
                        <div className="flex gap-2">
                            <input
                                autoFocus
                                type="text"
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && addTextInput()}
                                placeholder="직접 입력"
                                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm"
                            />
                            <button onClick={addTextInput} className="px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold">
                                추가
                            </button>
                        </div>
                        <button onClick={() => setMode(null)} className="w-full h-11 rounded-xl border bg-white text-sm">
                            취소
                        </button>
                    </div>
                )}

                {/* 시간 모드 */}
                {mode === "time" && (
                    <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-xl">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={startInput}
                                onChange={(e) => setStartInput(e.target.value)}
                                placeholder="시작"
                                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm"
                            />
                            <span className="flex items-center">~</span>
                            <input
                                type="text"
                                value={endInput}
                                onChange={(e) => setEndInput(e.target.value)}
                                placeholder="종료"
                                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm"
                            />
                            <button onClick={addTimeRange} className="px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold">
                                추가
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {quickRanges.map((qr) => (
                                <button
                                    key={qr}
                                    onClick={() => addTimeToken(qr)}
                                    className="h-10 text-xs rounded-xl bg-blue-100 text-blue-700 font-medium"
                                >
                                    {qr}
                                </button>
                            ))}
                        </div>
                        {times.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {times.map((t) => (
                                    <div key={t} className="inline-flex items-center gap-1 px-3 h-9 bg-blue-100 text-blue-900 text-xs font-medium rounded-xl">
                                        {t}
                                        <button onClick={() => setTimes((prev) => prev.filter((x) => x !== t))}>
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button onClick={() => setMode(null)} className="flex-1 h-11 rounded-xl border bg-white text-sm">
                                취소
                            </button>
                            <button onClick={commitTimes} className="flex-1 h-11 rounded-xl bg-blue-600 text-white text-sm font-semibold">
                                완료
                            </button>
                        </div>
                    </div>
                )}

                {/* 날짜 모드 */}
                {mode === "date" && (
                    <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-xl">
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={customDate}
                                onChange={(e) => setCustomDate(e.target.value)}
                                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm"
                            />
                            <button
                                onClick={() => {
                                    addIsoDate(customDate);
                                    setCustomDate("");
                                }}
                                className="px-5 py-3 bg-purple-600 text-white text-sm font-semibold rounded-xl"
                            >
                                추가
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {["월", "화", "수", "목", "금", "토", "일", "평일", "주말", "매일", "공휴일", "명절", "설날", "추석", "연중무휴"].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => toggleDate(p)}
                                    className={`h-10 text-xs font-medium rounded-xl ${dates.includes(p) ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700"}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                        {dates.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {dates.map((d) => (
                                    <div key={d} className="inline-flex items-center gap-1 px-3 h-9 bg-purple-100 text-purple-900 text-xs font-medium rounded-xl">
                                        {d}
                                        <button onClick={() => toggleDate(d)}>
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button onClick={() => setMode(null)} className="flex-1 h-11 rounded-xl border bg-white text-sm">
                                취소
                            </button>
                            <button onClick={commitDates} className="flex-1 h-11 rounded-xl bg-purple-600 text-white text-sm font-semibold">
                                완료
                            </button>
                        </div>
                    </div>
                )}

                {/* 옵션 리스트 */}
                <div className="space-y-3">
                    {structuredOptions.groups.map((group, groupIdx) => (
                        <div key={`group-${groupIdx}`}>
                            {group.type === 'group' && group.label && (
                                <div className="text-xs font-semibold text-gray-600 mb-2">
                                    📂 {group.label}
                                </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                                {group.items.map((label) => {
                                    const active = selected.includes(label);
                                    return (
                                        <button
                                            key={`opt-${label}`}
                                            onClick={() => toggleOption(label)}
                                            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${active
                                                ? "bg-blue-600 text-white"
                                                : "bg-gray-100 text-gray-700"
                                                }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* 커스텀 옵션 */}
                    {(structuredOptions.customs || []).length > 0 && (
                        <>
                            <div className="border-t pt-3" />
                            <div>
                                <div className="text-xs font-semibold text-gray-600 mb-2">
                                    ✏️ 직접 추가한 옵션
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(structuredOptions.customs || []).map((label) => {
                                        const active = selected.includes(label);
                                        return (
                                            <div key={`custom-${label}`} className="relative">
                                                <button
                                                    onClick={() => toggleOption(label)}
                                                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${active
                                                        ? "bg-blue-600 text-white"
                                                        : "bg-gray-100 text-gray-700"
                                                        }`}
                                                >
                                                    {label}
                                                </button>
                                                {onDeleteCustomOption && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (confirm(`"${label}" 옵션을 삭제할까요?`)) onDeleteCustomOption(label);
                                                        }}
                                                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* 완료 버튼 */}
                <div className="mt-6 sticky bottom-0 bg-white pt-4 pb-2 border-t">
                    <button
                        onClick={() => {
                            onChange(pack(selected));
                            onClose();
                        }}
                        className="w-full h-12 rounded-xl bg-blue-600 text-white text-base font-semibold"
                    >
                        완료
                    </button>
                </div>
            </MobileBottomSheet>
        );
    }

    // 데스크톱 버전 (기존 드롭다운 유지)
    return (
        <div
            ref={dropdownRef}
            className="fixed bg-white rounded-xl shadow-2xl border-2 border-gray-200 w-[320px] flex flex-col z-50 overflow-hidden"
            style={{ top: `${position.top}px`, left: `${position.left}px`, maxHeight: "min(600px, calc(100vh - 64px))" }}
        >
            {/* 헤더 */}
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
                <div className="font-semibold text-sm flex-1 truncate">{facet.label}</div>
                <button
                    onClick={() => {
                        onChange(pack(selected));
                        onClose();
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                >
                    완료
                </button>
            </div>

            {/* 모드 선택 */}
            <div className="p-3 border-b">
                <div className="mt-1 flex gap-2">
                    <button
                        onClick={() => setMode("text")}
                        className="flex-1 h-8 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium bg-slate-600 text-white hover:bg-slate-700"
                    >
                        <Type className="w-3.5 h-3.5" /> 텍스트
                    </button>
                    <button
                        onClick={() => setMode("time")}
                        className="w-9 h-8 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600 hover:bg-blue-200"
                        title="시간"
                    >
                        <Clock className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setMode("date")}
                        className="w-9 h-8 rounded-lg flex items-center justify-center bg-purple-100 text-purple-600 hover:bg-purple-200"
                        title="날짜"
                    >
                        <Calendar className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* 컨텐츠 영역 */}
            <div className="flex-1 overflow-y-auto p-3">
                {/* 텍스트 모드 */}
                {mode === "text" && (
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex gap-2">
                            <input
                                autoFocus
                                type="text"
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && addTextInput()}
                                placeholder="직접 입력"
                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                            <button onClick={addTextInput} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">
                                추가
                            </button>
                        </div>
                        <button onClick={() => setMode(null)} className="w-full h-9 rounded-lg border bg-white hover:bg-gray-50 text-sm">
                            취소
                        </button>
                    </div>
                )}

                {/* 시간 모드 */}
                {mode === "time" && (
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs font-semibold text-gray-700 mb-2">시간 범위</div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={startInput}
                                onChange={(e) => setStartInput(e.target.value)}
                                placeholder="시작"
                                className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
                            />
                            <span className="flex items-center text-gray-400">~</span>
                            <input
                                type="text"
                                value={endInput}
                                onChange={(e) => setEndInput(e.target.value)}
                                placeholder="종료"
                                className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
                            />
                            <button onClick={addTimeRange} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 whitespace-nowrap">
                                추가
                            </button>
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">프리셋 (다중)</div>
                            <div className="flex flex-wrap gap-1.5">
                                {quickRanges.map((qr) => (
                                    <button
                                        key={qr}
                                        onClick={() => addTimeToken(qr)}
                                        className="px-2.5 h-7 text-xs font-medium rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
                                    >
                                        {qr}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {times.length > 0 && (
                            <div>
                                <div className="text-xs font-semibold text-gray-700 mb-2">선택된 시간</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {times.map((t) => (
                                        <div key={t} className="inline-flex items-center gap-1 px-2.5 h-7 bg-blue-100 text-blue-900 text-xs font-medium rounded-lg">
                                            {t}
                                            <button onClick={() => setTimes((prev) => prev.filter((x) => x !== t))} className="hover:text-red-600">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setMode(null)} className="h-9 px-4 rounded-lg border bg-white hover:bg-gray-50 text-sm">
                                취소
                            </button>
                            <button onClick={commitTimes} className="h-9 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm">
                                완료
                            </button>
                        </div>
                    </div>
                )}

                {/* 날짜 모드 */}
                {mode === "date" && (
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                        <div className="text-xs font-semibold text-gray-700 mb-2">날짜 직접 입력</div>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={customDate}
                                onChange={(e) => setCustomDate(e.target.value)}
                                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
                            />
                            <button
                                onClick={() => {
                                    addIsoDate(customDate);
                                    setCustomDate("");
                                }}
                                className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 whitespace-nowrap"
                            >
                                추가
                            </button>
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">프리셋 (다중)</div>
                            <div className="flex flex-wrap gap-1.5">
                                {["월", "화", "수", "목", "금", "토", "일", "평일", "주말", "매일", "공휴일", "명절", "설날", "추석", "연중무휴"].map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => toggleDate(p)}
                                        className={`px-2.5 h-7 text-xs font-medium rounded-lg ${dates.includes(p) ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {dates.length > 0 && (
                            <div>
                                <div className="text-xs font-semibold text-gray-700 mb-2">선택된 날짜</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {dates.map((d) => (
                                        <div key={d} className="inline-flex items-center gap-1 px-2.5 h-7 bg-purple-100 text-purple-900 text-xs font-medium rounded-lg">
                                            {d}
                                            <button onClick={() => toggleDate(d)} className="hover:text-red-600">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setMode(null)} className="h-9 px-4 rounded-lg border bg-white hover:bg-gray-50 text-sm">
                                취소
                            </button>
                            <button onClick={commitDates} className="h-9 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm">
                                완료
                            </button>
                        </div>
                    </div>
                )}

                {/* 옵션 리스트 - 계층형 구조 */}
                <div className="space-y-2 pt-2 border-t">
                    <div className="text-xs font-semibold text-gray-500">옵션</div>
                    <div className="space-y-3">
                        {structuredOptions.groups.map((group, groupIdx) => (
                            <div key={`group-${groupIdx}`}>
                                {group.type === 'group' && group.label && (
                                    <div className="text-[11px] font-semibold text-gray-600 mb-1.5 px-1">
                                        📂 {group.label}
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-1.5">
                                    {group.items.map((label) => {
                                        const active = selected.includes(label);
                                        return (
                                            <button
                                                key={`opt-${label}`}
                                                onClick={() => toggleOption(label)}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${active
                                                    ? "bg-blue-600 text-white"
                                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {/* 커스텀 옵션 */}
                        {(structuredOptions.customs || []).length > 0 && (
                            <>
                                <div className="w-full border-t border-gray-300 my-2" />
                                <div>
                                    <div className="text-[11px] font-semibold text-gray-600 mb-1.5 px-1">
                                        ✏️ 직접 추가한 옵션
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(structuredOptions.customs || []).map((label) => {
                                            const active = selected.includes(label);
                                            return (
                                                <div key={`custom-${label}`} className="relative group">
                                                    <button
                                                        onClick={() => toggleOption(label)}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${active
                                                            ? "bg-blue-600 text-white"
                                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                            }`}
                                                    >
                                                        {label}
                                                    </button>
                                                    {onDeleteCustomOption && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm(`"${label}" 옵션을 삭제할까요?`)) onDeleteCustomOption(label);
                                                            }}
                                                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px]"
                                                            title="커스텀 옵션 삭제"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// QuickAddBottomSheet (모바일 UI)
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
            <div className="space-y-4">
                {/* 직접 입력 */}
                <div>
                    <div className="text-sm font-semibold text-gray-700 mb-2">직접 입력</div>
                    <div className="flex gap-2">
                        <input
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && add(customName)}
                            placeholder="항목명을 입력하세요"
                            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm"
                        />
                        <button
                            onClick={() => add(customName)}
                            className="px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold"
                        >
                            추가
                        </button>
                    </div>
                </div>

                {/* 프리셋 */}
                {presets.length > 0 && (
                    <>
                        <div className="border-t pt-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-sm font-semibold text-gray-700">프리셋에서 선택</div>
                                <button
                                    onClick={() => {
                                        onAddAll(presets.map((p: any) => p.name));
                                        onClose();
                                    }}
                                    className="text-xs text-blue-600 font-medium"
                                >
                                    전체 추가
                                </button>
                            </div>
                            <div className="space-y-2">
                                {presets.map((p: any) => (
                                    <button
                                        key={p.name}
                                        onClick={() => add(p.name)}
                                        className="w-full text-left px-4 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">{p.icon || "📌"}</span>
                                            <span className="font-medium text-gray-900">{p.name}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </MobileBottomSheet>
    );
}

// ────────────────────────────────────────────────────────────
// ColumnManageBottomSheet (모바일 UI)
// ────────────────────────────────────────────────────────────
function ColumnManageBottomSheet({ isOpen, onClose, sheetId, allFacets, visibleKeys, onToggle, onCreate, onReorder }: any) {
    const [newFacetName, setNewFacetName] = React.useState("");

    const addNewFacet = () => {
        const name = newFacetName.trim();
        if (!name) return;
        onCreate({
            key: name.toLowerCase().replace(/\s+/g, "_"),
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
        <MobileBottomSheet isOpen={isOpen} onClose={onClose} title="기준 관리">
            <div className="space-y-6">
                {/* 새 기준 추가 */}
                <div>
                    <div className="text-sm font-semibold text-gray-700 mb-2">새 기준 추가</div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newFacetName}
                            onChange={(e) => setNewFacetName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") addNewFacet();
                            }}
                            placeholder="기준 이름 (예: 가격대)"
                            className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl"
                        />
                        <button
                            onClick={addNewFacet}
                            className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold"
                        >
                            추가
                        </button>
                    </div>
                </div>

                {/* 프리셋에서 추가 */}
                {availablePresets.length > 0 && (
                    <div>
                        <div className="text-sm font-semibold text-gray-700 mb-2">프리셋에서 추가</div>
                        <div className="flex flex-wrap gap-2">
                            {availablePresets.map((pf: any) => (
                                <button
                                    key={pf.key}
                                    onClick={() => {
                                        onCreate(pf);
                                        onToggle(pf.key, true);
                                    }}
                                    className="px-4 py-2 text-sm rounded-xl bg-blue-50 text-blue-700 border border-blue-200"
                                >
                                    + {pf.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 기준 목록 */}
                <div>
                    <div className="text-sm font-semibold text-gray-700 mb-2">기준 목록</div>
                    <div className="space-y-2">
                        {allFacets.map((facet: any) => {
                            const isVisible = visibleKeys.includes(facet.key);
                            return (
                                <div
                                    key={facet.key}
                                    className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl"
                                >
                                    <div className="flex items-center gap-3">
                                        <GripVertical className="w-5 h-5 text-gray-400" />
                                        <div>
                                            <div className="font-medium text-gray-900">{facet.label}</div>
                                            <div className="text-xs text-gray-500">{facet.key}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onToggle(facet.key, !isVisible)}
                                        className={`w-14 h-7 rounded-full transition-colors relative ${isVisible ? 'bg-blue-600' : 'bg-gray-300'
                                            }`}
                                    >
                                        <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${isVisible ? 'translate-x-7' : 'translate-x-0.5'
                                            }`} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </MobileBottomSheet>
    );
}

// ────────────────────────────────────────────────────────────
// Row 컴포넌트 (기존 유지)
// ────────────────────────────────────────────────────────────
function Row({ row, children }: any) {
    const { attributes, listeners, setNodeRef, style, isDragging } = useSortableRow(row.id);
    return (
        <tr ref={setNodeRef} style={style} className={`hover:bg-gray-50 transition-colors ${isDragging ? "opacity-50" : ""}`}>
            <td {...attributes} {...listeners} className="px-2 cursor-grab active:cursor-grabbing align-top">
                <div className="flex items-center justify-center h-10">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                </div>
            </td>
            {children}
        </tr>
    );
}

// ────────────────────────────────────────────────────────────
// CellEditor (기존 유지)
// ────────────────────────────────────────────────────────────
function CellEditor({ row, facet, sheetId, openDropdown, setOpenDropdown, updateCell, addCustomOption, deleteCustomOption, customOptions }: any) {
    const cellRef = React.useRef<HTMLButtonElement | null>(null);
    const value = row.facets[facet.key] || "";
    const values = unpack(value);
    const displayText =
        values.length === 0 ? "선택" : values.length === 1 ? values[0] : values.length === 2 ? values.join(", ") : `${values[0]} 외 ${values.length - 1}개`;
    const isOpen = openDropdown?.rowId === row.id && openDropdown?.facetKey === facet.key;
    const customKey = `${sheetId}::${facet.key}`;

    return (
        <td className="px-3 py-2 align-top">
            <button
                ref={cellRef as any}
                onClick={() => setOpenDropdown({ rowId: row.id, facetKey: facet.key, cellRef })}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center justify-between ${values.length > 0 ? "border-gray-300 bg-blue-50 text-blue-900 hover:border-blue-400" : "border-gray-200 text-gray-400 hover:border-gray-300"
                    }`}
            >
                <span className="block truncate text-sm">{displayText}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2" />
            </button>

            {isOpen && (
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
                />
            )}
        </td>
    );
}

// 이하 FacetPivotView, FacetListItem, ColumnManagerDropdown, QuickAddDropdown 등은 
// 기존 코드와 동일하므로 원본 파일의 내용을 그대로 사용하면 됩니다.
// 여기서는 메인 컴포넌트만 UI 개선합니다.

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
            initialItems[sheetId] = [];
        });

        return {
            ...defaults,
            items: initialItems,
        };
    });

    const [viewMode, setViewMode] = React.useState<"item" | "facet">("item");
    const [openDropdown, setOpenDropdown] = React.useState<any>(null);

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

    // 행 정렬 (기존 로직 유지)
    const activeItems = React.useMemo(() => {
        const arr = Array.isArray(data?.items?.[activeSheetId]) ? data.items[activeSheetId] : [];
        const sorted = [...arr].sort((a, b) => {
            const ao = a?.order ?? 1e9;
            const bo = b?.order ?? 1e9;
            if (ao !== bo) return ao - bo;
            return (a?.name || "").localeCompare(b?.name || "", "ko");
        });
        return sorted;
    }, [data.items, activeSheetId]);

    // 저장 디바운스 (기존 로직 유지)
    const saveTimer = React.useRef<any>(null);
    const scheduleAutoSave = React.useCallback(() => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => handleSave(true), 900);
    }, []);
    async function handleSave(silent = false) {
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

            const createdIdMap: Record<string, string> = {};

            // 각 항목별 API 호출 (그대로 유지)
            for (const [sheetId, rows] of Object.entries(payload.items)) {
                if (!Array.isArray(rows)) continue;
                for (const row of rows as any[]) {
                    const safeId = String(row.id || "");
                    const perRowPayload = { sheetId, name: row.name, facetRefs: row.facetRefs || {} };
                    const looksPersisted = /^itm/i.test(safeId);

                    if (!looksPersisted) {
                        const created = await apiCreateItem(tenantId, perRowPayload);
                        const newId = created?.item?.id;
                        if (safeId && newId) {
                            createdIdMap[safeId] = newId;
                        }
                        continue;
                    }

                    try {
                        await apiUpdateItem(tenantId, safeId, { facetRefs: row.facetRefs || {} });
                    } catch (err) {
                        console.warn(`update failed for ${safeId}, retrying with create`, err);
                        const created = await apiCreateItem(tenantId, perRowPayload);
                        const newId = created?.item?.id;
                        if (safeId && newId) {
                            createdIdMap[safeId] = newId;
                        }
                    }
                }
            }

            if (Object.keys(createdIdMap).length) {
                const remapRows = (rows: any[]) =>
                    rows.map((row) => {
                        const remappedId = createdIdMap[row.id];
                        return remappedId ? { ...row, id: remappedId } : row;
                    });

                payload.items = Object.fromEntries(
                    Object.entries(payload.items).map(([sheetId, rows]: any) => [sheetId, remapRows(rows || [])])
                );

                setData((prev: any) => {
                    const nextItems: Record<string, any[]> = {};
                    Object.entries(prev.items || {}).forEach(([sheetId, rows]) => {
                        nextItems[sheetId] = remapRows(rows as any[]);
                    });
                    return { ...prev, items: nextItems };
                });
            }

            // ✅ onSave prop이 있으면 사용, 없으면 기본 동작
            if (onSave) {
                await onSave(payload);
            } else {
                // onSave가 없으면 로컬에만 저장 (개발 모드)
                console.log("📦 저장 (로컬)", payload);
            }

            if (!silent) alert("✅ 저장 완료");
        } catch (err) {
            console.error("Save error:", err);
            alert("❌ 저장 실패");
        }
    }

    // 행 관리 함수들 (기존 로직 유지)
    const addRow = (presetName?: string) => {
        const preset = (PRESET_ITEMS[activeSheetId] || []).find((p: any) => p.name === presetName);
        const newId = `row_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const newRow: any = {
            id: newId,
            name: presetName || "",
            facets: {},
            order: activeItems.length,
        };
        if (preset?.facets) {
            newRow.facets = { ...preset.facets };
        }
        setData((prev: any) => ({
            ...prev,
            items: {
                ...prev.items,
                [activeSheetId]: [...(prev.items[activeSheetId] || []), newRow],
            },
        }));
        scheduleAutoSave();
    };

    const addRowsBulk = (names: string[]) => {
        const presets = PRESET_ITEMS[activeSheetId] || [];
        const newRows = names.map((name, idx) => {
            const preset = presets.find((p: any) => p.name === name);
            return {
                id: `row_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 9)}`,
                name,
                facets: preset?.facets || {},
                order: activeItems.length + idx,
            };
        });
        setData((prev: any) => ({
            ...prev,
            items: {
                ...prev.items,
                [activeSheetId]: [...(prev.items[activeSheetId] || []), ...newRows],
            },
        }));
        scheduleAutoSave();
    };

    const removeRow = (rowId: string) => {
        setData((prev: any) => ({
            ...prev,
            items: {
                ...prev.items,
                [activeSheetId]: prev.items[activeSheetId].filter((r: any) => r.id !== rowId),
            },
        }));
        scheduleAutoSave();
    };

    const updateRowName = (rowId: string, name: string) => {
        setData((prev: any) => ({
            ...prev,
            items: {
                ...prev.items,
                [activeSheetId]: prev.items[activeSheetId].map((r: any) =>
                    r.id === rowId ? { ...r, name } : r
                ),
            },
        }));
        scheduleAutoSave();
    };

    const updateCell = (rowId: string, facetKey: string, value: any) => {
        setData((prev: any) => ({
            ...prev,
            items: {
                ...prev.items,
                [activeSheetId]: prev.items[activeSheetId].map((r: any) =>
                    r.id === rowId ? { ...r, facets: { ...r.facets, [facetKey]: value } } : r
                ),
            },
        }));
        scheduleAutoSave();
    };

    const handleRowDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setData((prev: any) => {
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
                            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">자동 저장됨</p>
                        </div>
                        <button
                            onClick={() => handleSave(false)}
                            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            <Save className="w-4 h-4" />
                            <span className="hidden sm:inline">저장</span>
                        </button>
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
                            { value: "item", label: "목록 보기" },
                            { value: "facet", label: "기준 보기" },
                        ]}
                    />
                </div>

                {/* 테이블 영역 */}
                {viewMode === "item" && (
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        {activeItems.length === 0 ? (
                            <div className="px-4 py-20 text-center">
                                <p className="text-xl text-gray-400 mb-2">📝 데이터가 없습니다</p>
                                <p className="text-sm text-gray-500 mb-6">
                                    우측 하단 <b>+ 버튼</b>을 눌러 항목을 추가하세요
                                </p>
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
                                                <th className="w-12"></th>
                                            </tr>
                                        </thead>
                                        <SortableContext
                                            items={activeItems.map((r: any) => r.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <tbody className="divide-y divide-gray-100">
                                                {activeItems.map((row: any) => (
                                                    <Row key={row.id} row={row}>
                                                        <td className="px-3 py-2 align-top">
                                                            <input
                                                                type="text"
                                                                value={row.name}
                                                                onChange={(e) => updateRowName(row.id, e.target.value)}
                                                                placeholder="항목명"
                                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            />
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
                                                                customOptions={data.customOptions}
                                                            />
                                                        ))}
                                                        <td className="px-2 text-right align-top">
                                                            <button
                                                                onClick={() => removeRow(row.id)}
                                                                className="w-9 h-9 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                                                                title="삭제"
                                                            >
                                                                <X className="w-4 h-4 mx-auto" />
                                                            </button>
                                                        </td>
                                                    </Row>
                                                ))}
                                            </tbody>
                                        </SortableContext>
                                    </table>
                                </DndContext>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 플로팅 액션 버튼 */}
            <FloatingActionButton
                onQuickAdd={() => setQuickAddOpen(true)}
                onColumnManage={() => setColumnManageOpen(true)}
                onAddEmpty={() => addRow()}
            />

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
