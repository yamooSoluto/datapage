// components/mypage/CriteriaSheetEditor_Final.tsx
// ✅ 2025-11-07 개선 버전
// - 기준 추가/관리: 열 헤더 드롭다운으로 통합
// - 드래그앤드롭: 열/행 정렬 정상 동작
// - 빈 테이블: 초기 상태 깔끔하게 (templates/updatedAt 제거)
// - 프리셋: 별도 파일로 분리

import React from "react";
import {
    Plus, X, GripVertical, ChevronDown, Calendar, Clock, Type, Settings, Columns, Eye, EyeOff
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
// 서버 API
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
// 유틸
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

// 시간 파서
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
// 템플릿 헬퍼
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
// Sortable helpers
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
// Dropdown (검색 제거 버전)
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

    // 시간
    const [times, setTimes] = React.useState<string[]>([]);
    const [startInput, setStartInput] = React.useState("09:00");
    const [endInput, setEndInput] = React.useState("");
    const quickRanges = ["24시간", "오전", "오후", "09:00~18:00", "10:00~22:00"];

    // 날짜
    const [dates, setDates] = React.useState<string[]>([]);
    const [customDate, setCustomDate] = React.useState("");

    // 위치 계산
    const [position, setPosition] = React.useState({ top: 0, left: 0 });
    React.useEffect(() => {
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
    }, [cellRef]);

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

    // 시간
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

    // 날짜
    const toggleDate = (d: string) => setDates((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
    const addIsoDate = (iso: string) => iso && setDates((prev) => (prev.includes(iso) ? prev : [...prev, iso]));
    const commitDates = () => {
        if (!dates.length) return setMode(null);
        setSelected((prev) => uniqNormPush(prev, dates.join(" / ")));
        setDates([]);
        setMode(null);
    };

    // 옵션 평탄화 + 계층형 구조 유지
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

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* 선택됨 */}
                {selected.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-xs font-semibold text-gray-500">선택됨</div>
                        <div className="flex flex-wrap gap-1.5">
                            {selected.map((val, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => toggleOption(val)}
                                    className="group px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 flex items-center gap-1"
                                >
                                    <span className="truncate max-w-[220px]">{val}</span>
                                    <X className="w-3 h-3 opacity-70 group-hover:opacity-100" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 텍스트 입력 */}
                {mode === "text" && (
                    <div className="space-y-3">
                        <textarea
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    addTextInput();
                                }
                            }}
                            placeholder="내용 입력 후 Enter"
                            className="w-full px-3 py-2 rounded-lg border text-sm min-h-[80px]"
                            autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setMode(null)} className="h-9 px-4 rounded-lg border bg-white hover:bg-gray-50 text-sm">
                                취소
                            </button>
                            <button onClick={addTextInput} className="h-9 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm">
                                추가
                            </button>
                        </div>
                    </div>
                )}

                {/* 시간 */}
                {mode === "time" && (
                    <div className="space-y-3">
                        <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">직접 입력</div>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="time"
                                    value={startInput}
                                    onChange={(e) => setStartInput(e.target.value)}
                                    className="flex-1 px-2 py-1.5 text-xs bg-gray-50 rounded-lg border"
                                />
                                <span className="text-xs text-gray-400">~</span>
                                <input
                                    type="time"
                                    value={endInput}
                                    onChange={(e) => setEndInput(e.target.value)}
                                    placeholder="(선택)"
                                    className="flex-1 px-2 py-1.5 text-xs bg-gray-50 rounded-lg border"
                                />
                                <button onClick={addTimeRange} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 whitespace-nowrap">
                                    추가
                                </button>
                            </div>
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">빠른 패턴</div>
                            <div className="flex flex-wrap gap-1.5">
                                {quickRanges.map((r) => (
                                    <button key={r} className="px-2.5 h-7 text-xs rounded-md bg-gray-100 border hover:bg-gray-200" onClick={() => addTimeToken(r)}>
                                        {r}
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
                                            <button onClick={() => setTimes((a) => a.filter((x) => x !== t))} className="hover:text-red-600">
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

                {/* 날짜 */}
                {mode === "date" && (
                    <div className="space-y-3">
                        <div className="text-xs font-semibold text-gray-700 mb-2">특정 날짜</div>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={customDate}
                                onChange={(e) => setCustomDate(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addIsoDate(customDate);
                                        setCustomDate("");
                                    }
                                }}
                                className="flex-1 px-2 py-1.5 text-xs bg-gray-50 rounded-lg border"
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
// 열 헤더 드롭다운 (기준 관리)
// ────────────────────────────────────────────────────────────
function ColumnManagerDropdown({
    sheetId,
    allFacets,
    visibleKeys,
    onReorder,
    onToggle,
    onCreate,
}: {
    sheetId: string;
    allFacets: any[];
    visibleKeys: string[];
    onReorder: (keys: string[]) => void;
    onToggle: (key: string, show: boolean) => void;
    onCreate: (facet: any) => void;
}) {
    const [open, setOpen] = React.useState(false);
    const [newFacetName, setNewFacetName] = React.useState("");
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // 외부 클릭 닫기
    React.useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = allFacets.findIndex((f) => f.key === active.id);
        const newIndex = allFacets.findIndex((f) => f.key === over.id);

        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(allFacets, oldIndex, newIndex);
        onReorder(reordered.map((f) => f.key));
    };

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

    // 프리셋에서 가져올 수 있는 기준들
    const presetFacets = SHEET_TEMPLATES[sheetId]?.facets || [];
    const availablePresets = presetFacets.filter(
        (pf: any) => !allFacets.some((f) => f.key === pf.key)
    );

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setOpen(!open)}
                className="h-9 px-3 rounded-lg border bg-white hover:bg-gray-50 flex items-center gap-2 text-sm"
            >
                <Settings className="w-4 h-4" />
                기준 관리
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border-2 border-gray-200 z-50 max-h-[600px] flex flex-col">
                    {/* 헤더 */}
                    <div className="px-4 py-3 border-b bg-gray-50">
                        <h3 className="font-semibold text-sm">기준 추가 및 관리</h3>
                    </div>

                    {/* 프리셋에서 가져오기 */}
                    {availablePresets.length > 0 && (
                        <div className="p-3 border-b">
                            <div className="text-xs font-semibold text-gray-600 mb-2">프리셋에서 추가</div>
                            <div className="flex flex-wrap gap-1.5">
                                {availablePresets.map((pf: any) => (
                                    <button
                                        key={pf.key}
                                        onClick={() => {
                                            onCreate(pf);
                                            onToggle(pf.key, true);
                                        }}
                                        className="px-2.5 py-1.5 text-xs rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                                    >
                                        + {pf.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 새 기준 추가 */}
                    <div className="p-3 border-b">
                        <div className="text-xs font-semibold text-gray-600 mb-2">새 기준 추가</div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newFacetName}
                                onChange={(e) => setNewFacetName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") addNewFacet();
                                }}
                                placeholder="기준 이름 (예: 가격대)"
                                className="flex-1 px-3 py-2 text-sm border rounded-lg"
                            />
                            <button
                                onClick={addNewFacet}
                                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                            >
                                추가
                            </button>
                        </div>
                    </div>

                    {/* 기준 목록 (드래그 정렬 + 가시성) */}
                    <div className="flex-1 overflow-y-auto p-3">
                        <div className="text-xs font-semibold text-gray-600 mb-2">기준 목록 (드래그로 순서 변경)</div>
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext items={allFacets.map((f) => f.key)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-1.5">
                                    {allFacets.map((facet) => (
                                        <FacetListItem
                                            key={facet.key}
                                            facet={facet}
                                            visible={visibleKeys.includes(facet.key)}
                                            onToggle={() => onToggle(facet.key, !visibleKeys.includes(facet.key))}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>
            )}
        </div>
    );
}

function FacetListItem({ facet, visible, onToggle }: any) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: facet.key });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-2 p-2 rounded-lg border bg-gray-50 hover:bg-gray-100"
        >
            <span {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
                <GripVertical className="w-4 h-4" />
            </span>
            <button
                onClick={onToggle}
                className="flex-shrink-0"
            >
                {visible ? (
                    <Eye className="w-4 h-4 text-blue-600" />
                ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                )}
            </button>
            <span className="text-sm flex-1">{facet.label}</span>
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// 상단 Quick actions (항목 추가)
// ────────────────────────────────────────────────────────────
function QuickAddDropdown({ sheetId, onAdd, onAddAll }: { sheetId: string; onAdd: (name: string) => void; onAddAll: (names: string[]) => void }) {
    const [open, setOpen] = React.useState(false);
    const [customName, setCustomName] = React.useState("");
    const presets = PRESET_ITEMS[sheetId] || [];

    const add = (name?: string) => {
        if (!name?.trim()) return;
        onAdd(name.trim());
        setOpen(false);
        setCustomName("");
    };

    const addAll = () => {
        if (!presets.length) return;
        onAddAll(presets.map((p) => p.name));
        setOpen(false);
    };

    return (
        <div className="relative">
            <button onClick={() => setOpen((v) => !v)} className="h-10 px-3 rounded-lg border bg-white hover:bg-gray-50 flex items-center gap-2">
                <Plus className="w-4 h-4" /> 항목 추가
            </button>
            {open && (
                <div className="absolute z-30 mt-2 w-64 bg-white border rounded-xl shadow-lg p-2">
                    <div className="max-h-64 overflow-auto">
                        {presets.map((p) => (
                            <button key={p.name} onClick={() => add(p.name)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50">
                                <span className="mr-2">{p.icon}</span>
                                {p.name}
                            </button>
                        ))}
                        {presets.length > 0 && (
                            <button onClick={addAll} className="w-full mt-2 h-9 rounded-lg border bg-gray-50 hover:bg-gray-100 text-sm">
                                프리셋 전체 추가
                            </button>
                        )}
                        <div className="my-2 border-t" />
                        <div className="px-2 pb-2">
                            <div className="text-[11px] text-gray-500 mb-1">직접 입력</div>
                            <div className="flex gap-2">
                                <input
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && add(customName)}
                                    placeholder="항목명"
                                    className="flex-1 px-2 py-2 border rounded-lg text-sm"
                                />
                                <button onClick={() => add(customName)} className="px-3 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">
                                    추가
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// 셀 에디터
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

// ────────────────────────────────────────────────────────────
// 피벗(기준 중심) 테이블
// ────────────────────────────────────────────────────────────
function FacetPivotView({ sheetId, template, items, onToggleMembership, customOptions, addCustomOption }: any) {
    const [facetKey, setFacetKey] = React.useState(() => (template.facets?.[0]?.key || ""));
    const facet = React.useMemo(() => template.facets.find((f: any) => f.key === facetKey) || template.facets[0] || null, [facetKey, template]);

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
    const addOpt = () => {
        const v = newOpt.trim();
        if (!v || !facet) return;
        addCustomOption(`${sheetId}::${facet.key}`, v);
        setNewOpt("");
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
            <div className="p-4 border-b flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                    <Columns className="w-4 h-4" />
                    <span className="font-medium">기준 중심 보기</span>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={facet?.key || ""}
                        onChange={(e) => setFacetKey(e.target.value)}
                        className="h-10 px-3 rounded-lg border bg-white"
                    >
                        {template.facets.map((f: any) => (
                            <option key={f.key} value={f.key}>
                                {f.label}
                            </option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                        <input
                            value={newOpt}
                            onChange={(e) => setNewOpt(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addOpt()}
                            placeholder="옵션 추가"
                            className="h-10 px-3 rounded-lg border"
                        />
                        <button onClick={addOpt} className="h-10 px-3 rounded-lg bg-blue-600 text-white">
                            추가
                        </button>
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
                                <td className="px-4 py-3 text-sm text-gray-700">{opt}</td>
                                {items.map((it: any) => {
                                    const values = unpack(it.facets[facet.key] || "");
                                    const active = values.some((v) => normalize(v) === normalize(opt));
                                    return (
                                        <td key={it.id + opt} className="px-4 py-2">
                                            <button
                                                onClick={() => onToggleMembership(it.id, facet.key, opt, !active)}
                                                className={`w-full h-9 rounded-lg border text-sm ${active
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

// ────────────────────────────────────────────────────────────
// 메인
// ────────────────────────────────────────────────────────────
export default function CriteriaSheetEditorFinal({ tenantId, initialData, templates, onSave }: any) {
    const [viewMode, setViewMode] = React.useState<"item" | "facet">("item");

    const [data, setData] = React.useState(() => {
        const defaults = {
            schemaVersion: 3,
            sheets: ["space", "facility", "seat"], // 공간, 시설, 좌석
            activeSheet: "facility",
            items: { space: [], facility: [], seat: [] as any[] },
            customOptions: {} as Record<string, string[]>,
            visibleFacets: {} as Record<string, string[]>,
        };

        // initialData에서 sheets가 명시적으로 있으면 그대로 사용
        // 없으면 배열 필드들을 찾되 templates, updatedAt 제외
        if (initialData) {
            const merged = { ...defaults, ...initialData };

            // sheets가 있으면 templates, updatedAt 필터링
            if (Array.isArray(merged.sheets)) {
                merged.sheets = merged.sheets.filter((s: string) =>
                    s !== 'templates' &&
                    s !== 'updatedAt'
                );
            }

            // sheets가 없거나 비어있으면 배열 필드에서 추출
            if (!Array.isArray(merged.sheets) || !merged.sheets.length) {
                const keys = Object.keys(initialData);
                const validSheets = keys.filter((k) =>
                    Array.isArray(initialData[k]) &&
                    k !== 'templates' &&
                    k !== 'updatedAt'
                );
                merged.sheets = validSheets.length > 0 ? validSheets : defaults.sheets;
            }

            if (!merged.activeSheet || merged.activeSheet === 'templates') {
                merged.activeSheet = merged.sheets[0];
            }

            return merged;
        }

        return defaults;
    });

    // 템플릿 풀
    const allTemplates = React.useMemo(() => {
        const sheetIds = Array.isArray(data.sheets) ? data.sheets : [];
        const mergedIds = Array.from(new Set([...sheetIds, data.activeSheet].filter(Boolean)));
        const map: Record<string, any> = {};
        mergedIds.forEach((sid: string) => {
            const fromTpl = templates?.[sid];
            const derivedFacets = deriveTemplateFromItems(data?.items?.[sid] || [], sid);
            map[sid] = ensureTemplateShape(sid, fromTpl, derivedFacets);
        });
        return map;
    }, [data.sheets, data.activeSheet, data.items, templates]);

    // 열 가시성 초기값
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

    // 행 정렬
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

    const [openDropdown, setOpenDropdown] = React.useState<any>(null);

    // 저장 디바운스
    const saveTimer = React.useRef<any>(null);
    const scheduleAutoSave = React.useCallback(() => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => handleSave(true), 900);
    }, []);

    async function handleSave(silent = false) {
        try {
            // templates, updatedAt 등 메타데이터 제거
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
            for (const [sheetId, rows] of Object.entries(payload.items)) {
                if (!Array.isArray(rows)) continue;
                for (const row of rows as any[]) {
                    if (String(row.id || "").startsWith("row_")) {
                        await apiCreateItem(tenantId, { sheetId, name: row.name, facetRefs: row.facetRefs || {} });
                    } else {
                        await apiUpdateItem(tenantId, row.id, { facetRefs: row.facetRefs || {} });
                    }
                }
            }
            if (!silent) alert("✅ 저장 완료!");
            onSave && onSave(payload);
        } catch (e) {
            if (!silent) alert("❌ 저장 실패");
        }
    }

    // 행 관리
    const addRow = (name = "") => {
        setData((prev: any) => {
            const rows = prev.items[activeSheetId] || [];
            const nextOrder = rows.length ? Math.max(...rows.map((r: any) => r.order || 0)) + 1 : 1;
            const newRow = {
                id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                name,
                facets: {},
                order: nextOrder,
                createdAt: Date.now(),
            };
            return { ...prev, items: { ...prev.items, [activeSheetId]: [...rows, newRow] } };
        });
        scheduleAutoSave();
    };
    const addRowsBulk = (names: string[]) => {
        setData((prev: any) => {
            const rows = prev.items[activeSheetId] || [];
            let nextOrder = rows.length ? Math.max(...rows.map((r: any) => r.order || 0)) + 1 : 1;
            const add = names.map((n) => ({
                id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                name: n,
                facets: {},
                order: nextOrder++,
                createdAt: Date.now(),
            }));
            return { ...prev, items: { ...prev.items, [activeSheetId]: [...rows, ...add] } };
        });
        scheduleAutoSave();
    };
    const removeRow = (rowId: string) => {
        setData((prev: any) => ({
            ...prev,
            items: { ...prev.items, [activeSheetId]: (prev.items[activeSheetId] || []).filter((r: any) => r.id !== rowId) },
        }));
        scheduleAutoSave();
    };
    const updateRowName = (rowId: string, name: string) => {
        setData((prev: any) => ({
            ...prev,
            items: {
                ...prev.items,
                [activeSheetId]: (prev.items[activeSheetId] || []).map((r: any) => (r.id === rowId ? { ...r, name } : r)),
            },
        }));
        scheduleAutoSave();
    };
    const updateCell = (rowId: string, facetKey: string, value: string) => {
        setData((prev: any) => {
            const rows = (prev.items[activeSheetId] || []).map((r: any) =>
                r.id === rowId ? { ...r, facets: { ...r.facets, [facetKey]: value } } : r
            );
            return { ...prev, items: { ...prev.items, [activeSheetId]: rows } };
        });
        scheduleAutoSave();
    };

    // 커스텀 옵션
    const addCustomOption = (customKey: string, option: string) => {
        const val = String(option || "").trim();
        if (!val) return;
        setData((prev: any) => {
            const cur = prev.customOptions[customKey] || [];
            const next = uniqNormPush(cur, val);
            if (next === cur) return prev;
            return { ...prev, customOptions: { ...prev.customOptions, [customKey]: next } };
        });
        scheduleAutoSave();
    };
    const deleteCustomOption = (customKey: string, option: string) => {
        setData((prev: any) => ({
            ...prev,
            customOptions: {
                ...prev.customOptions,
                [customKey]: (prev.customOptions[customKey] || []).filter((opt: string) => normalize(opt) !== normalize(option)),
            },
        }));
        scheduleAutoSave();
    };

    // 열 관리
    const reorderVisibleFacets = (keys: string[]) => {
        setData((prev: any) => ({ ...prev, visibleFacets: { ...prev.visibleFacets, [activeSheetId]: keys } }));
        scheduleAutoSave();
    };
    const toggleFacetVisible = (facetKey: string, show: boolean) => {
        setData((prev: any) => {
            const set = new Set(prev.visibleFacets[activeSheetId] || []);
            show ? set.add(facetKey) : set.delete(facetKey);
            return { ...prev, visibleFacets: { ...prev.visibleFacets, [activeSheetId]: Array.from(set) } };
        });
        scheduleAutoSave();
    };
    const createFacetToSheet = (facet: any) => {
        const key = facet.key;
        if (!key) return;
        setData((prev: any) => {
            const vis = new Set(prev.visibleFacets[activeSheetId] || []);
            vis.add(key);
            return { ...prev, visibleFacets: { ...prev.visibleFacets, [activeSheetId]: Array.from(vis) } };
        });
        allTemplates[activeSheetId].facets = [...allTemplates[activeSheetId].facets, facet];
    };

    // 피벗 토글
    const onToggleMembership = (rowId: string, facetKey: string, optLabel: string, add: boolean) => {
        setData((prev: any) => {
            const rows = (prev.items[activeSheetId] || []).map((r: any) => {
                if (r.id !== rowId) return r;
                const cur = unpack(r.facets[facetKey] || "");
                const next = add
                    ? uniqNormPush(cur, optLabel)
                    : cur.filter((v) => normalize(v) !== normalize(optLabel));
                return { ...r, facets: { ...r.facets, [facetKey]: pack(next) } };
            });
            return { ...prev, items: { ...prev.items, [activeSheetId]: rows } };
        });
        scheduleAutoSave();
    };

    // 드래그앤드롭
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const handleRowDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const from = activeItems.findIndex((r: any) => r.id === active.id);
        const to = activeItems.findIndex((r: any) => r.id === over.id);
        if (from === -1 || to === -1) return;
        const next = arrayMove(activeItems, from, to);
        setData((prev: any) => ({
            ...prev,
            items: {
                ...prev.items,
                [activeSheetId]: next.map((r: any, i: number) => ({ ...r, order: i + 1 })),
            },
        }));
        scheduleAutoSave();
    };

    function Row({ row, children }: any) {
        const { attributes, listeners, setNodeRef, style } = useSortableRow(row.id);
        return (
            <tr ref={setNodeRef} style={style} className="hover:bg-gray-50">
                <td className="px-2 py-2 w-8 align-top">
                    <button {...attributes} {...listeners} className="cursor-grab text-gray-400 mt-2 hover:text-gray-600" title="행 순서 변경">
                        <GripVertical className="w-4 h-4" />
                    </button>
                </td>
                {children}
            </tr>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* 헤더 */}
                <div className="bg-white rounded-2xl shadow-sm p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">데이터 관리</h1>
                            <p className="text-sm text-gray-500 mt-1">셀을 누르면 옵션 패널이 열립니다. 행/열 드래그로 순서 변경 가능.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <QuickAddDropdown sheetId={activeSheetId} onAdd={addRow} onAddAll={addRowsBulk} />
                            <ColumnManagerDropdown
                                sheetId={activeSheetId}
                                allFacets={template.facets}
                                visibleKeys={visibleFacetKeys}
                                onReorder={(keys) => {
                                    // 전체 facets 순서 재정렬
                                    const reordered = keys
                                        .map((key) => template.facets.find((f: any) => f.key === key))
                                        .filter(Boolean);
                                    allTemplates[activeSheetId].facets = reordered;
                                    reorderVisibleFacets(keys);
                                }}
                                onToggle={toggleFacetVisible}
                                onCreate={createFacetToSheet}
                            />
                            <button onClick={() => handleSave(false)} className="h-10 px-4 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                                💾 저장
                            </button>
                        </div>
                    </div>
                </div>

                {/* 탭 & 보기모드 */}
                <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
                    <div className="flex gap-2 overflow-x-auto pb-2">
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
                                    className={`flex-shrink-0 px-4 py-2.5 rounded-xl font-medium transition-all ${isActive ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                >
                                    <span className="mr-2">{t.icon}</span>
                                    {t.title}
                                    {itemCount > 0 && (
                                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-gray-200"}`}>{itemCount}</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode("item")}
                            className={`h-9 px-3 rounded-lg border text-sm ${viewMode === "item" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"}`}
                        >
                            아이템 중심
                        </button>
                        <button
                            onClick={() => setViewMode("facet")}
                            className={`h-9 px-3 rounded-lg border text-sm ${viewMode === "facet" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"}`}
                        >
                            기준 중심
                        </button>
                    </div>
                </div>

                {viewMode === "facet" ? (
                    <FacetPivotView
                        sheetId={activeSheetId}
                        template={template}
                        items={activeItems}
                        onToggleMembership={onToggleMembership}
                        customOptions={data.customOptions}
                        addCustomOption={addCustomOption}
                    />
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        {activeItems.length === 0 ? (
                            <div className="px-4 py-20 text-center">
                                <p className="text-xl text-gray-400 mb-2">📝 데이터가 없습니다</p>
                                <p className="text-sm text-gray-500 mb-6">상단 <b>항목 추가</b> 버튼으로 시작하세요</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleRowDragEnd}
                                >
                                    <table className="w-full min-w-[1000px]">
                                        <thead className="bg-gray-50 border-b sticky top-0">
                                            <tr>
                                                <th className="w-8"></th>
                                                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-[240px]">이름</th>
                                                {visibleFacets.map((facet: any) => (
                                                    <th key={facet.key} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                                                        {facet.label}
                                                    </th>
                                                ))}
                                                <th className="w-12"></th>
                                            </tr>
                                        </thead>
                                        <SortableContext items={activeItems.map((r: any) => r.id)} strategy={verticalListSortingStrategy}>
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
                                                                deleteCustomOption={(ck: string, opt: string) => deleteCustomOption(ck, opt)}
                                                                customOptions={data.customOptions}
                                                            />
                                                        ))}
                                                        <td className="px-2 text-right align-top">
                                                            <button onClick={() => removeRow(row.id)} className="w-9 h-9 rounded-lg text-red-600 hover:bg-red-50 transition-colors" title="삭제">
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

                        {/* 하단 액션 */}
                        <div className="border-t p-4 flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
                            <button
                                onClick={() => addRow()}
                                className="w-full md:w-auto px-6 py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                                ➕ 빈 행 추가
                            </button>
                            <div className="text-xs text-gray-500">자동 저장(0.9s) · 모바일 가로 스와이프</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}