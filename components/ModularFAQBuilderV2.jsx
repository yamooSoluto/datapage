// components/ModularFAQBuilderV2.jsx
"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    Clock, Calendar, Sparkles, Zap, X, GripVertical, Check,
    ChevronDown, Hash, Plus, Scissors, LayoutGrid, ChevronLeft, ChevronRight, Search
} from "lucide-react";
import { createPortal } from "react-dom";
import {
    getKeywords,
    getPresetOptions,
    getQASetOptions,
    ENDING_CONTEXTS,
    getPlaceholderCycle,
    TOP_CATS,
} from "./faq/taxonomy";



// ✅ 모듈 타입 (단순화)
const MODULE_TYPES = {
    TIME: 'TIME', // 시간 (멀티 + 자유 입력)
    DATE: 'DATE', // 날짜 (멀티)
    ENDING: 'ENDING', // 어미 (싱글)
    CRITERIA: 'CRITERIA', // 기준 값 (CRITERIA 드롭다운)
    SYMBOL: 'SYMBOL', // 특수문자 (텍스트 취급)
    TEXT: 'TEXT', // 자유 텍스트
};


// ─────────────────────────────────────────────────────────────
// 공통 유틸
// ─────────────────────────────────────────────────────────────
function pad2(n) {
    return String(n).padStart(2, '0');
}

// HH:mm 으로 정규화 (09, 9시, 오후 3시 30분 등도 처리)
function normalizeHM(token) {
    if (!token) return null;
    let t = String(token).trim();
    // 오전/오후 처리
    let meridian = null;
    if (t.includes('오전')) meridian = 'AM';
    if (t.includes('오후')) meridian = 'PM';
    t = t.replace(/오전|오후|\s/g, '');
    t = t.replace(/시/g, ':').replace(/분/g, '');

    // 숫자만 (예: 9 → 09:00, 930 → 09:30)
    if (/^\d{1,4}$/.test(t)) {
        if (t.length <= 2) {
            let h = Number(t);
            if (meridian === 'PM' && h < 12) h += 12; // 오후 1~11시
            if (meridian === 'AM' && h === 12) h = 0; // 오전 12시 → 00
            return `${pad2(h)}:00`;
        }
        if (t.length === 3) {
            let h = Number(t.slice(0, 1));
            let m = Number(t.slice(1));
            if (meridian === 'PM' && h < 12) h += 12;
            if (meridian === 'AM' && h === 12) h = 0;
            return `${pad2(h)}:${pad2(m)}`;
        }
        if (t.length === 4) {
            let h = Number(t.slice(0, 2));
            let m = Number(t.slice(2));
            if (meridian === 'PM' && h < 12) h += 12;
            if (meridian === 'AM' && h === 12) h = 0;
            return `${pad2(h)}:${pad2(m)}`;
        }
    }

    // HH:mm 형태
    const m = t.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
    if (m) {
        let h = Number(m[1]);
        let mm = Number(m[2] || 0);
        if (meridian === 'PM' && h < 12) h += 12;
        if (meridian === 'AM' && h === 12) h = 0;
        return `${pad2(h)}:${pad2(mm)}`;
    }

    return null; // 인식 불가
}

// 단일시간 또는 범위 문자열 정규화
function normalizeRange(raw) {
    if (!raw) return null;
    const s = String(raw).replace(/\s/g, '');
    const hasSep = s.includes('~') || s.includes('-');
    if (!hasSep) {
        return normalizeHM(s); // 단일 시간
    }
    const [a, b] = s.split(s.includes('~') ? '~' : '-');
    const A = normalizeHM(a);
    const B = normalizeHM(b);
    if (!A || !B) return null;
    // 기본은 시간순 정렬 (야간跨일까지 필요하면 이 부분만 주석 처리하고 A~B 그대로)
    return A <= B ? `${A}~${B}` : `${B}~${A}`;
}


// 새 드롭 캐럿 (얇은 커서막대)
function DropCaret() {
    return (
        <span
            className="
    inline-block w-[2px] h-[1.1em] bg-blue-500 rounded-full mx-0.5 animate-pulse
    relative top-[0.15em]
  "
            aria-hidden
        />
    );
}


// ✅ CategoryNav (모바일 대응 패치 버전)
function CategoryNav({ categories, value, onChange }) {
    const items = Object.entries(categories).map(([key, v]) => ({
        key,
        label: v.label,
        keywords: v.keywords || [],
    }));

    const wrapRef = React.useRef(null);
    const tabRefs = React.useRef({});
    const [openPicker, setOpenPicker] = React.useState(false);
    const [canLeft, setCanLeft] = React.useState(false);
    const [canRight, setCanRight] = React.useState(false);

    const updateShadows = React.useCallback(() => {
        const el = wrapRef.current;
        if (!el) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        setCanLeft(scrollLeft > 0);
        setCanRight(scrollLeft < scrollWidth - clientWidth - 1);
    }, []);

    React.useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        updateShadows();
        const onScroll = () => updateShadows();
        el.addEventListener("scroll", onScroll, { passive: true });
        const ro = new ResizeObserver(updateShadows);
        ro.observe(el);
        return () => {
            el.removeEventListener("scroll", onScroll);
            ro.disconnect();
        };
    }, [updateShadows]);

    // 선택 탭을 중앙으로 스크롤
    React.useEffect(() => {
        const el = wrapRef.current;
        const tab = tabRefs.current[value];
        if (!el || !tab) return;
        const target =
            tab.offsetLeft - el.clientWidth / 2 + tab.clientWidth / 2;
        const clamped = Math.max(
            0,
            Math.min(target, el.scrollWidth - el.clientWidth)
        );
        el.scrollTo({ left: clamped, behavior: "smooth" });
    }, [value]);

    const scrollBy = (dx) => {
        const el = wrapRef.current;
        if (!el) return;
        el.scrollBy({ left: dx, behavior: "smooth" });
    };

    return (
        <div className="relative w-full block overflow-visible">
            <div className="flex items-center gap-2">
                {/* 좌측 스크롤 버튼 (태블릿 이상에서만) */}
                <button
                    onClick={() => scrollBy(-160)}
                    className={`hidden sm:flex shrink-0 w-8 h-8 rounded-full border border-gray-200 items-center justify-center bg-white
            transition-opacity ${canLeft ? "opacity-100" : "opacity-0 pointer-events-none"
                        }`}
                    aria-label="왼쪽으로"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                {/* ✅ 모바일 가로 스크롤 영역 */}
                <div
                    ref={wrapRef}
                    className="
     relative flex-1 overflow-x-auto whitespace-nowrap scroll-smooth py-1
     [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
     [-webkit-overflow-scrolling:touch] [touch-action:pan-x] overscroll-x-contain
     snap-x snap-mandatory
   "
                    style={
                        (canLeft || canRight)
                            ? {
                                WebkitMaskImage:
                                    'linear-gradient(to right, transparent 0, black 14px, black calc(100% - 14px), transparent 100%)',
                                maskImage:
                                    'linear-gradient(to right, transparent 0, black 14px, black calc(100% - 14px), transparent 100%)'
                            }
                            : undefined
                    }
                >


                    {/* ✅ 스냅 포인트 적용된 탭들 */}
                    <div className="inline-flex gap-6 px-1">
                        {items.map((it) => {
                            const active = value === it.key;
                            return (
                                <button
                                    key={it.key}
                                    ref={(r) => (tabRefs.current[it.key] = r)}
                                    onClick={() => onChange?.(it.key)}
                                    className={`
                    snap-start inline-flex items-center h-9 px-3 rounded-full text-sm border
                    transition-all select-none
                    ${active
                                            ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95"
                                        }
                  `}
                                    aria-pressed={active}
                                >
                                    {categories[it.key]?.label || it.key}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 우측: 전체보기(바텀시트) */}
                <button
                    onClick={() => setOpenPicker(true)}
                    className="shrink-0 w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 active:scale-95"
                    aria-label="전체 카테고리"
                >
                    <LayoutGrid className="w-4 h-4" />
                </button>

                {/* 우측 스크롤 버튼 (태블릿 이상에서만) */}
                <button
                    onClick={() => scrollBy(160)}
                    className={`hidden sm:flex shrink-0 w-8 h-8 rounded-full border border-gray-200 items-center justify-center bg-white
            transition-opacity ${canRight ? "opacity-100" : "opacity-0 pointer-events-none"
                        }`}
                    aria-label="오른쪽으로"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {openPicker && (
                <CategoryPickerSheet
                    categories={categories}
                    value={value}
                    onClose={() => setOpenPicker(false)}
                    onSelect={(k) => {
                        onChange?.(k);
                        setOpenPicker(false);
                    }}
                />
            )}
        </div>
    );
}


function CategoryPickerSheet({ categories, value, onSelect, onClose }) {
    const all = React.useMemo(
        () => Object.entries(categories).map(([key, v]) => ({ key, label: v.label, keywords: v.keywords || [] })),
        [categories]
    );
    const [query, setQuery] = React.useState('');

    const list = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return all;
        return all.filter(({ label, keywords }) =>
            label.toLowerCase().includes(q) || (keywords || []).some(k => String(k).toLowerCase().includes(q))
        );
    }, [all, query]);

    return (
        <div className="fixed inset-0 z-[60]">
            {/* Dim */}
            <button className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-label="닫기" />
            {/* Sheet */}
            <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl border-t border-gray-200">
                <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300 my-3" />
                <div className="px-4 pb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                autoFocus
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="분류/키워드 검색"
                                className="w-full h-10 rounded-xl border border-gray-200 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            />
                        </div>
                        <button
                            onClick={onClose}
                            className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white hover:bg-gray-50"
                        >
                            닫기
                        </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {list.map((it) => {
                            const active = value === it.key;
                            return (
                                <button
                                    key={it.key}
                                    onClick={() => onSelect?.(it.key)}
                                    className={`
                    flex items-center h-10 px-3 rounded-xl border text-sm
                    ${active
                                            ? 'bg-blue-600 border-blue-600 text-white'
                                            : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'}
                  `}
                                >
                                    <span className="truncate">{it.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* 힌트 */}
                    <p className="mt-3 text-[11px] text-gray-500">• 키워드로도 검색돼요 (예: “주차”, “정기권”, “영수증”).</p>
                    <div className="h-2" />
                </div>
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────────────────────
// 시간 모듈 (단일/범위 통합 + 입력 강화 + 빠른 패턴)
// ─────────────────────────────────────────────────────────────
const TimeModule = ({ data, onChange, onRemove, isEditing }) => {
    const [expanded, setExpanded] = useState(false);
    const ref = useRef(null);

    // 입력 상태: 하나만 채우면 단일, 둘 다 채우면 범위
    const [startInput, setStartInput] = useState('09:00');
    const [endInput, setEndInput] = useState('');

    // 그리드 범위 시작점
    const [draftStart, setDraftStart] = useState(null);

    useEffect(() => {
        const close = (e) => ref.current && !ref.current.contains(e.target) && setExpanded(false);
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const times = data.times || [];
    const commit = (list) => onChange({ times: list });

    // 공통 추가 (콤마로 여러 개 가능, 단일/범위 자동 판별)
    const addToken = (raw) => {
        const rawTokens = String(raw).split(',').map((t) => t.trim()).filter(Boolean);
        let next = [...times];
        for (const token of rawTokens) {
            const norm = normalizeRange(token);
            if (norm && !next.includes(norm)) next.push(norm);
        }
        commit(next);
    };

    // 단일 토글
    const toggleSingle = (hhmm) => {
        const norm = normalizeHM(hhmm);
        if (!norm) return;
        if (times.includes(norm)) commit(times.filter((t) => t !== norm));
        else commit([...times, norm]);
    };

    const removeTime = (t) => commit(times.filter((v) => v !== t));

    // 30분 슬롯
    const allSlots = Array.from({ length: 24 * 2 }, (_, i) => {
        const h = String(Math.floor(i / 2)).padStart(2, '0');
        const m = i % 2 === 0 ? '00' : '30';
        return `${h}:${m}`;
    });

    // 슬롯 클릭: 시작이 없으면 시작 지정, 같은 칸 두 번 → 단일, 다른 칸 → 범위
    const onQuickSlotClick = (slot) => {
        if (!draftStart) {
            setDraftStart(slot);
            return;
        }
        if (draftStart === slot) {
            toggleSingle(slot);    // 같은 칸 두 번 → 단일
        } else {
            addToken(`${draftStart}~${slot}`); // 서로 다른 칸 → 범위
        }
        setDraftStart(null);
    };

    // 빠른 패턴
    const quickRanges = ['09:00~18:00', '10:00~22:00', '12:00~13:00', '00:00~23:59'];

    const onClickAdd = () => {
        const s = startInput?.trim();
        const e = endInput?.trim();
        if (!s) return;
        if (s && !e) {
            // 단일
            toggleSingle(s);
        } else if (s && e) {
            // 범위
            addToken(`${s}~${e}`);
        }
    };

    return (
        <div ref={ref} className="relative inline-block">
            {/* 칩 */}
            <div
                onClick={() => isEditing && setExpanded(!expanded)}
                className={`inline-flex items-center gap-1.5 px-3 h-8 bg-blue-50 rounded-lg shadow-sm text-sm font-medium cursor-pointer hover:shadow-md transition-all ${isEditing ? '' : 'opacity-40'}`}
            >
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-blue-900">{times.length > 0 ? times.join(', ') : '시간'}</span>
                {isEditing && (
                    <>
                        <ChevronDown className={`w-3 h-3 text-blue-600 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-1 text-blue-400 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </>
                )}
            </div>

            {/* 팝오버 */}
            {expanded && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-2xl shadow-2xl p-3 z-50 min-w-[320px] w-[360px]">
                    <div className="space-y-3" onMouseDown={(e) => e.stopPropagation()}>
                        {/* 이중 입력: 하나면 단일, 둘이면 범위 */}
                        <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">직접 입력</div>
                            <div className="flex gap-2">
                                <input
                                    type="time" step="300"
                                    value={startInput}
                                    onChange={(e) => setStartInput(e.target.value)}
                                    className="no-drag flex-1 px-2 h-8 text-xs bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                                />
                                <span className="self-center text-xs text-gray-400">~</span>
                                <input
                                    type="time" step="300"
                                    placeholder="(선택)"
                                    value={endInput}
                                    onChange={(e) => setEndInput(e.target.value)}
                                    className="no-drag flex-1 px-2 h-8 text-xs bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                                />
                                <button
                                    className="no-drag px-3 h-8 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-all"
                                    onClick={onClickAdd}
                                >
                                    추가
                                </button>
                            </div>
                            <p className="mt-1 text-[10px] text-gray-500">• 종료 시간을 비워두면 단일 시간으로 추가됩니다.</p>
                        </div>

                        {/* 빠른 패턴 */}
                        <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">빠른 패턴</div>
                            <div className="flex flex-wrap gap-1.5">
                                {quickRanges.map((r) => (
                                    <button
                                        key={r}
                                        className="no-drag px-2.5 h-7 text-xs rounded-md bg-gray-100 border border-gray-200 hover:bg-gray-200"
                                        onClick={() => addToken(r)}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 30분 슬롯 그리드 */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-xs font-semibold text-gray-700">
                                    시작 시간과 종료시간을 선택해주세요
                                </div>
                                <div className="text-[10px] text-gray-500">{draftStart ? `시작: ${draftStart}` : '시작을 선택하세요'}</div>
                            </div>
                            <div className="grid grid-cols-6 gap-1 max-h-[160px] overflow-auto pr-1">
                                {allSlots.map((slot) => {
                                    const isSingleSelected = times.includes(slot);
                                    const isStart = draftStart === slot;
                                    return (
                                        <button
                                            key={slot}
                                            onClick={() => onQuickSlotClick(slot)}
                                            className={`
                        no-drag px-2 h-7 text-[10px] rounded-md border
                        ${isStart ? 'bg-blue-600 text-white border-blue-600'
                                                    : isSingleSelected ? 'bg-blue-100 text-blue-900 border-blue-200'
                                                        : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'}
                      `}
                                        >
                                            {slot}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 선택된 시간 */}
                        {times.length > 0 && (
                            <div>
                                <div className="text-xs font-semibold text-gray-700 mb-2">선택된 시간</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {times.map((t) => (
                                        <div key={t} className="inline-flex items-center gap-1 px-2.5 h-7 bg-blue-100 text-blue-900 text-xs font-medium rounded-lg">
                                            {t}
                                            <button onClick={() => removeTime(t)} className="no-drag hover:text-red-600">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// 날짜 모듈 (멀티) — onChange 즉시추가 → 확정추가(Enter/버튼) 방식
// ─────────────────────────────────────────────────────────────
const DateModule = ({ data, onChange, onRemove, isEditing }) => {
    const [expanded, setExpanded] = React.useState(false);
    const [customDate, setCustomDate] = React.useState("");   // ★ 추가: 입력값 보관
    const ref = React.useRef(null);

    React.useEffect(() => {
        const close = (e) => ref.current && !ref.current.contains(e.target) && setExpanded(false);
        // 모바일 대응을 위해 pointerdown 사용
        document.addEventListener("pointerdown", close, { passive: true });
        return () => document.removeEventListener("pointerdown", close);
    }, []);

    const presets = ["월", "화", "수", "목", "금", "토", "일", "요일", "평일", "주말", "매일", "매월", "공휴일", "명절", "설날", "추석", "연중무휴"];
    const dates = data.dates || [];

    const toggleDate = (date) => {
        const next = dates.includes(date) ? dates.filter((d) => d !== date) : [...dates, date];
        onChange({ dates: next });
    };

    // ★ 확정 추가 로직
    const addIsoDate = (iso) => {
        if (!iso) return;
        if (!dates.includes(iso)) onChange({ dates: [...dates, iso] });
    };
    const confirmAdd = () => {
        addIsoDate(customDate);
        setCustomDate("");
    };

    return (
        <div ref={ref} className="relative inline-block">
            <div
                onClick={() => isEditing && setExpanded(!expanded)}
                className={`inline-flex items-center gap-1.5 px-3 h-8 bg-purple-50 rounded-lg shadow-sm text-sm font-medium cursor-pointer hover:shadow-md transition-all ${isEditing ? "" : "opacity-40"}`}
            >
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                <span className="text-purple-900">{dates.length > 0 ? dates.join(", ") : "날짜"}</span>
                {isEditing && (
                    <>
                        <ChevronDown className={`w-3 h-3 text-purple-600 transition-transform ${expanded ? "rotate-180" : ""}`} />
                        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-1 text-purple-400 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </>
                )}
            </div>

            {expanded && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-2xl shadow-2xl p-3 z-50 min-w-[280px]">
                    <div className="space-y-3">
                        {/* ▶ 특정 날짜: onChange로는 state만, Enter/버튼에서만 리스트에 추가 */}
                        <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">특정 날짜</div>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={customDate}
                                    onChange={(e) => setCustomDate(e.target.value)}   // ★ 즉시 추가 금지
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmAdd(); } }}
                                    className="flex-1 px-2 h-8 text-xs bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                                />
                                <button
                                    onClick={confirmAdd}
                                    className="px-3 h-8 bg-purple-500 text-white text-xs font-semibold rounded-lg hover:bg-purple-600 transition-all"
                                >
                                    추가
                                </button>
                            </div>
                        </div>

                        {/* 프리셋 (다중 선택) */}
                        <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">프리셋 (다중 선택)</div>
                            <div className="flex flex-wrap gap-1.5">
                                {presets.map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => toggleDate(p)}
                                        className={`px-2.5 h-7 text-xs font-medium rounded-lg transition-all ${dates.includes(p) ? "bg-purple-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 선택된 날짜 */}
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
                    </div>
                </div>
            )}
        </div>
    );
};


/** 화면 폭 감지 (모바일 판별) */
function useIsSmall() {
    const [isSmall, setIsSmall] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(max-width: 640px)');
        const update = () => setIsSmall(mq.matches);
        update();
        mq.addEventListener?.('change', update);
        return () => mq.removeEventListener?.('change', update);
    }, []);
    return isSmall;
}

/** 모바일 전면 바텀시트 편집기 */
function TextEditorSheet({ initial, onClose, onConfirm, onSplit }) {
    const [val, setVal] = useState(initial || '');
    const taRef = useRef(null);

    // 자동 높이
    const autoGrow = () => {
        const el = taRef.current;
        if (!el) return;
        el.style.height = '0px';
        el.style.height = el.scrollHeight + 'px';
    };
    useEffect(() => { autoGrow(); }, [val]);
    useEffect(() => { setTimeout(() => taRef.current?.focus(), 0); }, []);

    return createPortal(
        <div className="fixed inset-0 z-[70]">
            <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="닫기" />
            <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[85vh]">
                <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300 mb-3" />
                <div className="text-sm font-semibold text-gray-900 mb-2">텍스트 편집</div>

                <textarea
                    ref={taRef}
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    onKeyDown={(e) => {
                        // Enter 저장, Shift+Enter 줄바꿈
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            onConfirm(val);
                        }
                    }}
                    rows={1}
                    placeholder="내용을 입력하세요"
                    className="w-full resize-none rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    style={{ minHeight: 44 }}
                />

                <div className="mt-3 flex items-center justify-between">
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                const pos = taRef.current?.selectionStart || 0;
                                onSplit?.(pos);
                            }}
                            className="h-9 px-3 rounded-lg border text-sm bg-white hover:bg-gray-50 flex items-center gap-1"
                        >
                            <Scissors className="w-4 h-4" /> 여기서 분할
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="h-9 px-3 rounded-lg border text-sm bg-white hover:bg-gray-50">취소</button>
                        <button
                            onClick={() => onConfirm(val)}
                            className="h-9 px-4 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
                        >
                            저장
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─────────────────────────────────────────────────────────────
// 어미 모듈 (싱글 선택)
// ─────────────────────────────────────────────────────────────
const EndingModule = ({ data, onChange, onRemove, isEditing }) => {
    const [expanded, setExpanded] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const handle = (e) => ref.current && !ref.current.contains(e.target) && setExpanded(false);
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    const selected = data.selected || data.options?.[0] || '';

    const pick = (ending) => onChange({ ...data, selected: ending });

    return (
        <div ref={ref} className="relative inline-block">
            <div
                onClick={() => isEditing && setExpanded(!expanded)}
                className={`inline-flex items-center gap-1.5 px-3 h-8 bg-amber-50 rounded-lg shadow-sm text-sm font-medium cursor-pointer hover:shadow-md transition-all ${isEditing ? '' : 'opacity-40'
                    }`}
            >
                <span className="text-amber-900">{selected || data.options?.[0]}</span>
                {isEditing && (
                    <>
                        <ChevronDown className={`w-3 h-3 text-amber-600 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-1 text-amber-400 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </>
                )}
            </div>

            {expanded && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-2xl p-2 z-50 min-w-[140px]">
                    <div className="text-xs font-semibold text-gray-700 mb-2 px-1">하나만 선택</div>
                    {data.options.map((option) => (
                        <button
                            key={option}
                            onClick={() => pick(option)}
                            className={`w-full text-left px-3 h-8 text-sm rounded-lg transition-all ${selected === option ? 'bg-amber-100 font-semibold' : 'hover:bg-gray-100'
                                }`}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// 텍스트 칩 + 커서 위치 분할 삽입
// ─────────────────────────────────────────────────────────────
const TextChip = ({ data, onRemove, isEditing, onEdit, onSplitAtCaret }) => {
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [editValue, setEditValue] = React.useState(data.text || '');
    const inputRef = React.useRef(null);
    const composingRef = React.useRef(false); // 한글 조합 보호

    // ✅ 부모에서 data.text 바뀌면, 편집 중이 아닐 때 즉시 동기화
    React.useEffect(() => {
        if (!isEditMode) setEditValue(data.text || '');
    }, [data.text, isEditMode]);

    React.useEffect(() => {
        if (isEditMode && inputRef.current) inputRef.current.focus();
    }, [isEditMode]);

    const openEdit = () => {
        setEditValue(data.text || '');
        setIsEditMode(true);
    };

    const commit = (val) => {
        onEdit?.(val ?? '');
        setIsEditMode(false);
    };

    if (isEditMode && isEditing) {
        return (
            <div className="inline-flex items-center gap-1 bg-white rounded-lg shadow-sm px-2 h-8 border-2 border-blue-400">
                <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onCompositionStart={() => (composingRef.current = true)}
                    onCompositionEnd={(e) => {
                        composingRef.current = false;
                        setEditValue(e.currentTarget.value);
                    }}
                    onBlur={() => commit(editValue)}
                    onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
                            const caret = e.currentTarget.selectionStart || 0;
                            onSplitAtCaret?.(caret);
                            return;
                        }
                        if (!composingRef.current && e.key === 'Enter') commit(editValue);
                    }}
                    className="bg-transparent text-sm font-medium text-gray-900 focus:outline-none w-64 max-w-[70vw]"
                />
                <button
                    title="커서 위치에 모듈 삽입 (⌘/Ctrl+I)"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        const caret = inputRef.current?.selectionStart || 0;
                        onSplitAtCaret?.(caret);
                    }}
                    className="text-blue-500 hover:text-blue-700 p-1"
                >
                    <Scissors className="w-3.5 h-3.5" />
                </button>
            </div>
        );
    }

    return (
        <div
            onDoubleClick={() => isEditing && openEdit()}
            className={`inline-flex items-center gap-1.5 px-3 h-8 bg-white rounded-lg shadow-sm text-sm font-medium hover:shadow-md transition-all ${isEditing ? 'cursor-text' : 'opacity-40'
                }`}
        >
            <span className="text-gray-900">{data.text}</span>
            {isEditing && (
                <button onClick={onRemove} className="ml-1 text-gray-400 hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// CRITERIA Chip (드롭다운 기준 값 - 멀티셀렉 지원)
// ─────────────────────────────────────────────────────────────
const CriteriaChip = ({ data, onRemove, isEditing, onChange }) => {
    const [showDropdown, setShowDropdown] = React.useState(false);
    const dropdownRef = React.useRef(null);

    const options = data.options || [];
    const selected = data.selected || []; // 배열로 변경
    const criteriaLabel = data.label || '선택';
    const isMulti = data.multi !== false; // 기본값 true (멀티셀렉)

    // 선택된 값들을 문자열로 표시
    const displayText = Array.isArray(selected) && selected.length > 0
        ? selected.join(', ')
        : (typeof selected === 'string' ? selected : '선택');

    // 드롭다운 외부 클릭 감지
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showDropdown]);

    const handleToggle = (option) => {
        if (!isMulti) {
            // 싱글 셀렉
            onChange?.({ ...data, selected: option });
            setShowDropdown(false);
            return;
        }

        // 멀티 셀렉
        const currentSelected = Array.isArray(selected) ? selected : [];
        const newSelected = currentSelected.includes(option)
            ? currentSelected.filter(item => item !== option)
            : [...currentSelected, option];

        onChange?.({ ...data, selected: newSelected });
    };

    if (!isEditing) {
        return (
            <div className="inline-flex items-center gap-1.5 px-3 h-8 bg-emerald-100 rounded-lg text-sm font-medium opacity-40">
                <span className="text-emerald-800">{displayText}</span>
            </div>
        );
    }

    return (
        <div className="inline-flex relative" ref={dropdownRef}>
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="inline-flex items-center gap-1.5 px-3 h-8 bg-emerald-100 rounded-lg shadow-sm text-sm font-medium hover:shadow-md transition-all cursor-pointer"
            >
                <span className="text-emerald-800 font-semibold">{displayText}</span>
                <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
            </button>

            {isEditing && (
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
                    className="ml-1.5 text-gray-400 hover:text-red-500"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}

            {/* 드롭다운 메뉴 */}
            {showDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100 flex items-center justify-between">
                        <span>{criteriaLabel}</span>
                        {isMulti && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                                다중선택
                            </span>
                        )}
                    </div>
                    {options.map((option, idx) => {
                        const isSelected = Array.isArray(selected)
                            ? selected.includes(option)
                            : selected === option;

                        return (
                            <button
                                key={idx}
                                onClick={() => handleToggle(option)}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-emerald-50 transition-colors flex items-center gap-2 ${isSelected
                                    ? 'bg-emerald-50 text-emerald-700 font-medium'
                                    : 'text-gray-700'
                                    }`}
                            >
                                {isMulti && (
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSelected
                                        ? 'bg-emerald-500 border-emerald-500'
                                        : 'border-gray-300'
                                        }`}>
                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                )}
                                <span>{option}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};


// ─────────────────────────────────────────────────────────────
// 드래그 가능한 모듈 래퍼 + 사이 삽입 포인트
// ─────────────────────────────────────────────────────────────
const DraggableModule = ({
    module, index, mode, isEditing,
    registerRef,
    onUpdate, onRemove, onEdit, onRequestSplitInsert,
    onPointerStart,
    drag,
}) => {
    const ModuleComponent = {
        [MODULE_TYPES.TIME]: TimeModule,
        [MODULE_TYPES.DATE]: DateModule,
        [MODULE_TYPES.ENDING]: EndingModule,
        [MODULE_TYPES.CRITERIA]: CriteriaChip,
        [MODULE_TYPES.SYMBOL]: TextChip,
        [MODULE_TYPES.TEXT]: TextChip,
    }[module.type];

    // 칩 외형 최소 통일(필요시 모듈 내부 스타일 유지)
    return (
        <div
            data-mod-idx={index}
            data-mod-mode={mode}
            ref={(el) => registerRef(mode, index, el)}
            onPointerDown={(e) => { if (isEditing) onPointerStart(e, mode, index); }}

            className={`inline-flex items-center select-none ${isEditing ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`
            }
            style={
                {
                    visibility: (drag?.active && drag.mode === mode && drag.from === index) ? 'hidden' : 'visible',
                    touchAction: isEditing ? 'manipulation' : 'auto'
                }
            }
        >
            <ModuleComponent
                data={module.data}
                onChange={(newData) => onUpdate(index, newData)}
                onRemove={() => onRemove(index)}
                onEdit={(text) => onUpdate(index, { text })}
                onSplitAtCaret={(caret) => onRequestSplitInsert(index, caret)}
                isEditing={isEditing}
            />
        </div>
    );
};


// ─────────────────────────────────────────────────────────────
// 어미 그룹 / 특수문자 / 카테고리
// ─────────────────────────────────────────────────────────────
const ENDING_GROUPS = [
    ['입니다', '이에요', '에요'],
    ['가능여부', '가능해요', '자유롭게 가능해요', '불가해요', '안돼요'],
    ['가능해요', '가능합니다', '돼요', '됩니다'],
    ['있어요', '있습니다', '없어요', '없습니다'],
    ['해주세요', '부탁드립니다', '해주시면 됩니다'],
];

const SYMBOLS = ['~', ',', '.', '/', '(', ')', '[', ']', '-', '·'];

// ─────────────────────────────────────────────────────────────
// 모듈 → 텍스트 변환 (텍스트화 버튼에서 사용)
// ─────────────────────────────────────────────────────────────
const moduleToText = (module) => {
    switch (module.type) {
        case MODULE_TYPES.TIME:
            return module.data.times?.join(', ') || '';
        case MODULE_TYPES.DATE:
            return module.data.dates?.join(', ') || '';
        case MODULE_TYPES.NUMBER:
            return `${module.data.value || '0'}${module.data.unit || ''}`;
        case MODULE_TYPES.ENDING:
            return module.data.selected || module.data.options?.[0] || '';
        case MODULE_TYPES.CRITERIA:
            // 배열이면 join, 문자열이면 그대로
            return Array.isArray(module.data.selected)
                ? module.data.selected.join(', ')
                : (module.data.selected || module.data.options?.[0] || '');
        case MODULE_TYPES.SYMBOL:
        case MODULE_TYPES.TEXT:
            return module.data.text || '';
        default:
            return '';
    }
};

const modulesToPlain = (mods) => mods.map(moduleToText).join(' ');


// ─────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────
export default function ModularFAQBuilderV2({ onComplete, onCancel, tenantDict = { facilities: [], passes: [], menu: [] }, }) {
    const [mainCategory, setMainCategory] = useState('facility'); // 대분류 (싱글)

    // ✅ 최상단 카테고리 (SUB_CATS 제거됨)
    const [topCat, setTopCat] = useState("facility");   // 기본: 시설/비품
    const [selectedMod, setSelectedMod] = useState("프린터");

    const [questionModules, setQuestionModules] = useState([]);
    const [answerModules, setAnswerModules] = useState([]);
    const [currentMode, setCurrentMode] = useState('question');
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [showPresetPanel, setShowPresetPanel] = useState(false);

    // state
    const [lastQaSetId, setLastQaSetId] = useState("");
    const qaSetOptions = useMemo(() => getQASetOptions(topCat), [topCat]);

    // 메모: 카테고리 변하면 키워드/프리셋/플레이스홀더 갱신
    const keywordList = useMemo(() => getKeywords(topCat), [topCat]);
    const presetOptions = useMemo(() => getPresetOptions(topCat, currentMode), [topCat, currentMode]);
    const phPool = useMemo(() => getPlaceholderCycle(topCat, currentMode), [topCat, currentMode]);

    const [placeholderIdx, setPlaceholderIdx] = useState(0);
    const rotatePh = () => setPlaceholderIdx(i => (phPool.length ? (i + 1) % phPool.length : 0));

    // 기존 onPickSinglePreset / onPickQASet 대신 이걸로 통일
    function applyQaSetAndRemember(id, { append = false } = {}) {
        const s = qaSetOptions.find(o => o.id === id);
        if (!s) return;

        const built = s.build({ modName: selectedMod || "모듈" });
        const q = (built.question || []).map(m => ({ id: Date.now() + Math.random(), ...m }));
        const a = (built.answer || []).map(m => ({ id: Date.now() + Math.random(), ...m }));

        if (append) {
            setQuestionModules(prev => [...prev, ...q]);
            setAnswerModules(prev => [...prev, ...a]);
        } else {
            setQuestionModules(q);
            setAnswerModules(a);
        }

        // ✅ 드롭다운에 선택값 유지
        setLastQaSetId(id);
    }
    // ✅ 카테고리(최상단 or 서브) 바뀔 때마다 드롭다운 첫 값 자동 선택 & 즉시 주입
    useEffect(() => {
        if (!qaSetOptions || qaSetOptions.length === 0) return;
        const firstId = qaSetOptions[0].id;
        applyQaSetAndRemember(firstId); // reset 주입
    }, [topCat]);  // ← 카테고리 버튼이 바뀔 때마다 실행

    // ✅ 어미(ENDING) 후보를 카테고리/모드에 맞춰 동기화
    // Note: taxonomy-v2에서는 각 모듈이 자체적으로 context를 가지므로 
    // 전역 동기화가 필요없음
    function syncEndingOptions() {
        // 더 이상 사용하지 않음 (각 ENDING 모듈이 자체 context 사용)
    }


    const [insertIndex, setInsertIndex] = useState(null); // 사이 삽입 인덱스


    // 드래그 상태(롱프레스 → 드래그 시작)
    const [drag, setDrag] = useState({ active: false, from: null, mode: null }); // from=index
    const [drop, setDrop] = useState({ index: null, mode: null });

    // 최신값을 이벤트 리스너에서 안전하게 읽기 위한 ref
    const dragRef = useRef(drag);
    const dropRef = useRef(drop);

    // state와 ref를 동시에 갱신하는 헬퍼
    const setDragState = (next) => { dragRef.current = next; setDrag(next); };
    const setDropState = (next) => { dropRef.current = next; setDrop(next); };

    // ✅ 고스트(떠 있는 미리보기)용
    const [ghost, setGhost] = useState(null);
    // ghost: { w, h, x, y, offsetX, offsetY, mode, from }

    const ghostElRef = useRef(null);      // DOM 업데이트 빠르게
    const rafRef = useRef(null);          // requestAnimationFrame
    const ghostPosRef = useRef({ x: 0, y: 0 });

    // 각 리스트 컨테이너 & 아이템 refs
    const qWrapRef = useRef(null);
    const aWrapRef = useRef(null);
    const itemRefs = useRef({ question: new Map(), answer: new Map() }); // index -> element


    // ✅ 텐넌트 커스텀 모듈 이름 모음 (안전한 메모이즈)
    const tenantModules = useMemo(() => {
        const f = Array.isArray(tenantDict?.facilities) ? tenantDict.facilities : [];
        const p = Array.isArray(tenantDict?.passes) ? tenantDict.passes : [];
        const m = Array.isArray(tenantDict?.menu) ? tenantDict.menu : [];
        return [...f, ...p, ...m]
            .map(v => (typeof v === "string" ? v : v?.name))
            .filter(Boolean);
    }, [tenantDict]);


    useEffect(() => {
        if (tenantModules.length) {
            // 처음 로드되었거나 기본값일 때만 최초 칩으로 교체
            setSelectedMod(prev =>
                prev && prev !== "프린터" ? prev : tenantModules[0]
            );
        }
    }, [tenantModules]);


    // 프리셋이 없을 때 최소 조합으로 만들어주는 기본 빌더
    const buildFallback = (mode, modName) => {
        if (mode === "question") {
            return [
                { type: MODULE_TYPES.TEXT, data: { text: `${modName}` } },
                { type: MODULE_TYPES.TEXT, data: { text: "어떻게 이용하나요?" } },
            ];
        }
        return [
            { type: MODULE_TYPES.TEXT, data: { text: `${modName} 안내드립니다.` } },
        ];
    };

    function applyPresetReset(presetId) {

        const found = presetOptions.find(p => p.id === presetId);
        const built = (found?.build?.({ modName: selectedMod, MODULE_TYPES })
            || buildFallback(currentMode, selectedMod))
            .map(m => ({ id: Date.now() + Math.random(), ...m }));
        if (currentMode === "question") setQuestionModules(built);
        else setAnswerModules(built);
    }

    // ✅ 하단 가이드/키데이터/담당자 전달
    const [guideOpen, setGuideOpen] = useState(false);
    const [guideModules, setGuideModules] = useState([]); // 프리셋+모듈 조합 가능
    const [keydataOpen, setKeydataOpen] = useState(false);
    const [keydata, setKeydata] = useState([]); // 단순 키-값 or 텍스트 모듈로 구성해도 됨
    const [handoff, setHandoff] = useState("none"); // none | required | conditional
    const [guideText, setGuideText] = useState("");



    function registerRef(mode, index, el) {
        const m = itemRefs.current[mode];
        if (!m) return;
        if (el) m.set(index, el); else m.delete(index);
    }

    useEffect(() => {
        // 드래그 중 바디 스크롤/선택 방지
        if (drag.active) {
            const prev = document.body.style.userSelect;
            document.body.style.userSelect = 'none';
            return () => { document.body.style.userSelect = prev; };
        }
    }, [drag.active]);


    function isInteractive(el) {
        return !!el?.closest?.('button, input, select, textarea, [role="button"], [contenteditable="true"], .no-drag');
    }
    // 포인터 기반 DnD
    function handlePointerStart(e, mode, index) {
        // 현재 편집 중인 영역만 드래그 허용
        const isQ = mode === 'question';
        if (!((isQ && currentMode === 'question') || (!isQ && currentMode === 'answer'))) return;

        // 인터랙티브 요소 클릭은 드래그 무시 (드롭다운/인풋/버튼 보장)
        if (isInteractive(e.target)) return;

        const isMouse = e.pointerType === 'mouse';
        const LONGPRESS_MS = 150;       // 터치만 사용
        const MOVE_THRESHOLD = 8;

        const startX = e.clientX ?? (e.touches?.[0]?.clientX || 0);
        const startY = e.clientY ?? (e.touches?.[0]?.clientY || 0);
        let lastX = startX, lastY = startY;
        let activated = false;

        const wrap = isQ ? qWrapRef.current : aWrapRef.current;

        const activate = () => {
            if (activated) return;
            activated = true;
            setDragState({ active: true, from: index, mode });
            setDropState({ index: index, mode });
            if (wrap) wrap.style.touchAction = 'none'; // 스크롤 잠금
            // pointer capture (지원되는 브라우저만)
            try { e.currentTarget?.setPointerCapture?.(e.pointerId); } catch { }
            // 🔹 고스트 생성: 현재 아이템의 크기/오프셋 측정
            const el = itemRefs.current[mode]?.get(index);
            if (el) {
                const r = el.getBoundingClientRect();
                const sx = (e.clientX ?? e.touches?.[0]?.clientX ?? r.left);
                const sy = (e.clientY ?? e.touches?.[0]?.clientY ?? r.top);
                setGhost({
                    w: r.width,
                    h: r.height,
                    x: sx, y: sy,
                    offsetX: sx - r.left,
                    offsetY: sy - r.top,
                    mode, from: index,
                    elRef: ghostElRef,
                });
                ghostPosRef.current = { x: sx, y: sy };
            }
        };

        let timer = null;
        if (!isMouse) timer = setTimeout(activate, LONGPRESS_MS); // 터치만 롱프레스

        const computeDropIndex = (x, y) => {
            // 1) 포인트 하위 요소에서 가까운 칩 찾기
            let host = document.elementFromPoint(x, y);
            host = host?.closest?.('[data-mod-idx][data-mod-mode]') || null;

            // 못 찾으면 centers로 근접값
            if (!host) {
                const map = itemRefs.current[mode];
                if (map && map.size) {
                    let best = { idx: null, dist: Infinity, after: false };
                    [...map.entries()].forEach(([i, el]) => {
                        if (!el) return;
                        const r = el.getBoundingClientRect();
                        const cx = r.left + r.width / 2;
                        const cy = r.top + r.height / 2;
                        const d = Math.hypot(cx - x, cy - y);
                        const after = x > cx;
                        if (d < best.dist) best = { idx: Number(i) + (after ? 1 : 0), dist: d, after };
                    });
                    return best.idx ?? null;
                }
                return null;
            }

            const overIdx = Number(host.getAttribute('data-mod-idx'));
            const r = host.getBoundingClientRect();
            const after = x > r.left + r.width / 2;
            return overIdx + (after ? 1 : 0);
        };

        const onMove = (ev) => {
            const x = ev.clientX ?? (ev.touches?.[0]?.clientX || lastX);
            const y = ev.clientY ?? (ev.touches?.[0]?.clientY || lastY);
            lastX = x; lastY = y;

            if (!activated) {
                const moved = Math.hypot(x - startX, y - startY);
                if (isMouse && moved > MOVE_THRESHOLD) {
                    activate(); // 마우스는 이동으로만 시작
                } else if (!isMouse && moved > MOVE_THRESHOLD) {
                    // 터치는 롱프레스 전에 움직이면 스크롤 제스처로 간주 → 드래그 취소
                    clear();
                }
                return;
            }

            // 🔹 고스트 위치 부드럽게 업데이트 (re-render 없이)
            // 🔹 가장 간단/안정: state로 고스트 좌표 업데이트
            setGhost(g => (g ? { ...g, x, y } : g));

            const idx = computeDropIndex(x, y);
            if (idx != null) setDropState({ index: idx, mode });
            // 기본 제스처 방지
            if (ev.cancelable) ev.preventDefault();
        };

        const onEnd = () => {
            clearTimeout(timer);
            if (wrap) wrap.style.touchAction = '';

            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);

            const d = dragRef.current;
            const dp = dropRef.current;

            if (d.active && dp.mode === d.mode && dp.index != null && d.from != null) {
                const applyReorder = (arr) => {
                    const from = d.from;
                    let to = dp.index;
                    const next = arr.slice();
                    const item = next.splice(from, 1)[0];
                    if (to > from) to -= 1;
                    next.splice(to, 0, item);
                    return next;
                };

                if (mode === 'question') setQuestionModules(applyReorder);
                else setAnswerModules(applyReorder);
            }

            // 🔹 고스트 제거
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            setGhost(null);

            setDragState({ active: false, from: null, mode: null });
            setDropState({ index: null, mode: null });
        };

        const clear = () => {
            clearTimeout(timer);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onEnd);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);
            setDragState({ active: false, from: null, mode: null });
            setDropState({ index: null, mode: null });
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
    }

    // 떠 있는 미리보기 컴포넌트
    function FloatingGhost({ ghost, children }) {
        if (!ghost) return null;
        const style = {
            position: 'fixed',
            left: 0,
            top: 0,
            width: ghost.w,
            height: ghost.h,
            transform: `translate3d(${ghost.x - ghost.offsetX}px, ${ghost.y - ghost.offsetY}px, 0)`,
            pointerEvents: 'none',
            zIndex: 1000,
            filter: 'drop-shadow(0 8px 20px rgba(0,0,0,.12))',
        };
        return createPortal(
            <div ref={ghost.elRef} style={style} className="pointer-events-none">
                {children}
            </div>,
            document.body
        );
    }

    const setMods = (mods) => (currentMode === 'question' ? setQuestionModules(mods) : setAnswerModules(mods));
    const getMods = () => (currentMode === 'question' ? questionModules : answerModules);

    const addModule = (type, data) => {
        const module = { id: Date.now() + Math.random(), type, data };
        const mods = getMods();
        let next = [];
        if (insertIndex === null || insertIndex === undefined) next = [...mods, module];
        else next = [...mods.slice(0, insertIndex), module, ...mods.slice(insertIndex)];
        setMods(next);
        setInsertIndex(insertIndex === null ? null : insertIndex + 1);
    };

    const updateModule = (index, newData) => {
        const mods = getMods();
        const updated = [...mods];
        updated[index] = { ...updated[index], data: newData };
        setMods(updated);
    };

    const removeModule = (index) => {
        const mods = getMods().filter((_, i) => i !== index);
        setMods(mods);
    };

    const handleDragStart = (index) => setDraggedIndex(index);
    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;
        const mods = [...getMods()];
        const dragged = mods[draggedIndex];
        mods.splice(draggedIndex, 1);
        mods.splice(index, 0, dragged);
        setMods(mods);
        setDraggedIndex(index);
    };

    const textify = () => {
        const mods = getMods();
        const plain = modulesToPlain(mods);
        setMods([{ id: Date.now(), type: MODULE_TYPES.TEXT, data: { text: plain } }]);
    };

    const onRequestSplitInsert = (index, caret) => {
        // TEXT 모듈 분할 후 사이에 삽입 포인트 설정
        const mods = [...getMods()];
        const node = mods[index];
        const text = String(node?.data?.text || '');
        const left = text.slice(0, caret);
        const right = text.slice(caret);
        const leftNode = { ...node, id: Date.now() + Math.random(), data: { text: left } };
        const rightNode = { ...node, id: Date.now() + Math.random(), data: { text: right } };
        const next = [...mods.slice(0, index), leftNode, rightNode, ...mods.slice(index + 1)];
        setMods(next);
        setInsertIndex(index + 1); // 분할 사이에 삽입
    };

    const handleComplete = () => {
        const question = modulesToPlain(questionModules);
        const answer = modulesToPlain(answerModules);
        if (!question.trim() || !answer.trim()) {
            alert('질문과 답변을 모두 작성해주세요!');
            return;
        }
        onComplete?.({
            question,
            answer,
            questionModules,
            answerModules,
            category: { top: topCat },  // sub 제거됨
            handoff,                                     // none | required | conditional
            guideText,
            keydata,                                     // [{key, value}]
        });
    };


    const applyPreset = (preset) => {
        // 1) 모듈 프리셋이 있으면 구조를 유지하여 추가
        if (preset.qMods || preset.aMods) {
            if (preset.qMods) setQuestionModules([...questionModules, ...preset.qMods.map((m) => ({ id: Date.now() + Math.random(), ...m }))]);
            if (preset.aMods) setAnswerModules([...answerModules, ...preset.aMods.map((m) => ({ id: Date.now() + Math.random(), ...m }))]);
        } else {
            // 2) 텍스트 프리셋은 텍스트 모듈로 추가
            setQuestionModules([...questionModules, { id: Date.now(), type: MODULE_TYPES.TEXT, data: { text: preset.q } }]);
            setAnswerModules([...answerModules, { id: Date.now() + 1, type: MODULE_TYPES.TEXT, data: { text: preset.a } }]);
        }
        setShowPresetPanel(false);
    };

    return (
        <div className="space-y-5" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
            {/* 대분류 (싱글) */}
            <CategoryNav
                categories={TOP_CATS}
                value={topCat}
                onChange={setTopCat}
            />
            {/* ===== 상단 제어 영역 (sticky) ===== */}
            <div className="sticky top-0 z-10 bg-white pb-3 pt-1">


                {/* 프리셋 드롭다운 바 (질문/답변에 따라 목록 달라짐) */}
                <div className="mt-3 flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* 모듈 선택칩 (테넌트 온보딩/마이페이지 설정 모듈) */}
                        <div className="flex items-center gap-2 overflow-x-auto">
                            <span className="text-xs text-gray-600 shrink-0">모듈:</span>
                            {((tenantModules && tenantModules.length)
                                ? tenantModules
                                : ["프린터", "자유석", "휴게존"]
                            ).map((n) => {
                                const active = selectedMod === n;
                                return (
                                    <button
                                        key={n}
                                        onClick={() => setSelectedMod(n)}
                                        className={`h-7 px-3 rounded-full text-xs border shrink-0 ${active
                                            ? "bg-blue-600 text-white border-blue-600"
                                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                            }`}
                                    >
                                        {n}
                                    </button>
                                );
                            })}
                        </div>

                        {/* 프리셋 드롭다운 */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">프리셋:</span>
                            <select
                                value={lastQaSetId || ""} // ✅ 선택값 유지
                                onChange={(e) => applyQaSetAndRemember(e.target.value)}
                                className="h-9 rounded-lg border border-gray-300 px-3 text-sm bg-white"
                            >
                                {/* 대표 플레이스홀더(모드/카테고리 따라 다르게 유지) */}
                                <option value="" disabled>
                                    {phPool[placeholderIdx] || "프리셋 선택 시 질문/답변에 동시에 적용"}
                                </option>

                                {qaSetOptions.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.label.replace("{모듈}", selectedMod || "모듈")} {/* ✅ 세트명 노출 없이 */}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 예시 키워드: 선택된 모듈의 내부 값 → 없으면 카테고리 기본값 */}
                    <div className="flex flex-wrap gap-1.5">
                        {(() => {
                            const vals =
                                (typeof getModuleValues === "function"
                                    ? getModuleValues(profile || {}, topCat, selectedMod)
                                    : []) || [];
                            const fallback =
                                (typeof DEFAULT_MODULE_VALUES !== "undefined" &&
                                    DEFAULT_MODULE_VALUES &&
                                    DEFAULT_MODULE_VALUES[topCat]) || [];
                            const show = Array.isArray(vals) && vals.length > 0 ? vals : fallback;

                            return (show || []).map((v) => (
                                <span
                                    key={`${selectedMod || "모듈"}:${String(v)}`}
                                    className="px-2.5 h-7 rounded-full bg-gray-100 text-gray-700 text-[11px] inline-flex items-center"
                                >
                                    {String(v)}
                                </span>
                            ));
                        })()}
                    </div>
                </div>
            </div>


            {/* 미리보기: 질문 + 답변 세트 - 편집중일 때 함께 sticky */}
            <div className={`space-y-3 ${(currentMode === 'question' || currentMode === 'answer') ? 'sticky top-0 z-20 bg-white py-2' : ''}`}>
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-900">질문</span>
                        {currentMode === 'question' && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    textify();
                                }}
                                className="px-3 h-7 text-xs font-medium rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                            >
                                문자로 변환
                            </button>
                        )}
                    </div>

                    <div
                        ref={qWrapRef}
                        onClick={() => setCurrentMode('question')}
                        className={`
                            relative cursor-pointer transition-all duration-200
                            ${currentMode === 'question'
                                ? 'min-h-[96px] p-4 rounded-xl bg-white border border-gray-300'
                                : 'h-12 px-4 rounded-lg bg-gray-50 border border-transparent hover:bg-gray-100 overflow-hidden'
                            }
                        `}
                    >
                        {currentMode === 'question' ? (
                            <div className="flex flex-wrap gap-2 items-start [-webkit-overflow-scrolling:touch] [touch-action:pan-y] overscroll-contain">
                                {drop.mode === 'question' && drop.index === 0 && <DropCaret />}
                                {questionModules.map((module, index) => (
                                    <React.Fragment key={module.id}>
                                        <DraggableModule
                                            module={module}
                                            index={index}
                                            mode="question"
                                            isEditing={currentMode === 'question'}
                                            registerRef={registerRef}
                                            onUpdate={updateModule}
                                            onRemove={removeModule}
                                            onRequestSplitInsert={onRequestSplitInsert}
                                            onPointerStart={handlePointerStart}
                                            drag={drag}
                                        />
                                        {drop.mode === 'question' && drop.index === index + 1 && <DropCaret />}
                                    </React.Fragment>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center h-full overflow-hidden">
                                <span className="text-sm text-gray-400 truncate">
                                    {questionModules.length > 0
                                        ? modulesToPlain(questionModules)
                                        : '질문을 작성해주세요'
                                    }
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 미리보기: 답변 */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-900">답변</span>
                        {currentMode === 'answer' && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    textify();
                                }}
                                className="px-3 h-7 text-xs font-medium rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                            >
                                문자로 변환
                            </button>
                        )}
                    </div>
                    <div
                        ref={aWrapRef}
                        onClick={() => setCurrentMode('answer')}
                        className={`
                            relative cursor-pointer transition-all duration-200
                            ${currentMode === 'answer'
                                ? 'min-h-[110px] p-4 rounded-xl bg-white border border-gray-300'
                                : 'h-12 px-4 rounded-lg bg-gray-50 border border-transparent hover:bg-gray-100 overflow-hidden'
                            }
                        `}
                    >
                        {currentMode === 'answer' ? (
                            <div className="flex flex-wrap gap-2 items-start [-webkit-overflow-scrolling:touch] [touch-action:pan-y] overscroll-contain">
                                {drop.mode === 'answer' && drop.index === 0 && <DropCaret />}
                                {answerModules.length > 0 ? (
                                    answerModules.map((module, index) => (
                                        <React.Fragment key={module.id}>
                                            <DraggableModule
                                                module={module}
                                                index={index}
                                                mode="answer"
                                                isEditing={currentMode === 'answer'}
                                                registerRef={registerRef}
                                                onUpdate={updateModule}
                                                onRemove={removeModule}
                                                onEdit={() => { }}
                                                onRequestSplitInsert={onRequestSplitInsert}
                                                onPointerStart={handlePointerStart}
                                                drag={drag}
                                            />
                                            {drop.mode === 'answer' && drop.index === index + 1 && <DropCaret />}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <span className="text-gray-400 text-sm">답변도 조합하세요</span>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center h-full overflow-hidden">
                                <span className="text-sm text-gray-400 truncate">
                                    {answerModules.length > 0
                                        ? modulesToPlain(answerModules)
                                        : '답변을 작성해주세요'
                                    }
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {ghost && (
                <FloatingGhost ghost={ghost}>
                    {(() => {
                        const mode = ghost.mode;
                        const from = ghost.from;
                        const mods = mode === 'question' ? questionModules : answerModules;
                        const m = mods[from];
                        if (!m) return null;
                        const ModuleComponent = {
                            [MODULE_TYPES.TIME]: TimeModule,
                            [MODULE_TYPES.DATE]: DateModule,
                            [MODULE_TYPES.ENDING]: EndingModule,
                            [MODULE_TYPES.SYMBOL]: TextChip,
                            [MODULE_TYPES.TEXT]: TextChip,
                        }[m.type];
                        return (
                            <div className="inline-flex">
                                <ModuleComponent
                                    data={m.data}
                                    isEditing={false}
                                    onChange={() => { }}
                                    onRemove={() => { }}
                                />
                            </div>
                        );
                    })()}
                </FloatingGhost>
            )}

            {/* 모듈 추가 툴바 (어디든 삽입 가능) */}
            <div>
                <div className="text-xs font-semibold text-gray-900 mb-2">모듈{insertIndex !== null && insertIndex !== undefined ? ` (삽입 위치: ${insertIndex})` : ''}</div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => addModule(MODULE_TYPES.TEXT, { text: '' })} className="px-3 h-9 text-xs font-semibold rounded-xl bg-white shadow-sm hover:shadow-md active:scale-95 transition-all">
                        📝 텍스트
                    </button>
                    <button onClick={() => addModule(MODULE_TYPES.TIME, { times: [] })} className="px-3 h-9 text-xs font-semibold rounded-xl bg-white shadow-sm hover:shadow-md active:scale-95 transition-all">
                        ⏰ 시간
                    </button>
                    <button onClick={() => addModule(MODULE_TYPES.DATE, { dates: [] })} className="px-3 h-9 text-xs font-semibold rounded-xl bg-white shadow-sm hover:shadow-md active:scale-95 transition-all">
                        🗓 날짜
                    </button>
                </div>
            </div>

            {/* 프리셋 패널 */}
            {showPresetPanel && (
                <div className="p-4 bg-white rounded-2xl shadow-lg border border-gray-200">
                    <div className="text-sm font-semibold text-gray-900 mb-3">✨ 자주 묻는 질문 (클릭하면 추가)</div>
                    <div className="space-y-2">
                        {currentCategoryData.presets.map((preset, idx) => (
                            <button
                                key={idx}
                                onClick={() => applyPreset(preset)}
                                className="w-full text-left bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-all"
                            >
                                <div className="font-semibold text-sm text-gray-900 mb-1">{preset.q}</div>
                                <div className="text-xs text-gray-600">{preset.a}</div>
                                {preset.qMods || preset.aMods ? (
                                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                        <Sparkles className="w-3 h-3" /> 모듈 프리셋
                                    </div>
                                ) : null}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 키워드: taxonomy.js의 getKeywords(topKey, subKey) 사용 */}
            <div>
                <div className="text-xs font-semibold text-gray-900 mb-2">키워드</div>
                <div className="flex flex-wrap gap-2">
                    {getKeywords(topCat).map((keyword) => (
                        <button
                            key={keyword}
                            onClick={() => addModule(MODULE_TYPES.TEXT, { text: keyword })}
                            className="px-4 h-9 bg-white text-gray-900 text-sm font-medium rounded-full shadow-sm hover:shadow-md active:scale-95 transition-all"
                        >
                            {keyword}
                        </button>
                    ))}
                </div>
            </div>

            {/* 어미 (싱글 셀렉) */}
            <div>
                <div className="text-xs font-semibold text-gray-900 mb-2">어미 (하나 선택)</div>
                <div className="flex flex-wrap gap-2">
                    {ENDING_GROUPS.map((group, idx) => (
                        <button
                            key={idx}
                            onClick={() => addModule(MODULE_TYPES.ENDING, { options: group, selected: group[0] })}
                            className="px-4 h-9 bg-gray-100 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-200 active:scale-95 transition-all"
                        >
                            {group[0]}
                        </button>
                    ))}
                </div>
            </div>

            {/* 특수문자 */}
            <div>
                <div className="text-xs font-semibold text-gray-900 mb-2">특수문자</div>
                <div className="flex flex-wrap gap-2">
                    {SYMBOLS.map((symbol) => (
                        <button
                            key={symbol}
                            onClick={() => addModule(MODULE_TYPES.SYMBOL, { text: symbol })}
                            className="w-9 h-9 bg-gray-100 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-200 active:scale-95 transition-all"
                        >
                            {symbol}
                        </button>
                    ))}
                </div>
            </div>
            {/* ── 메타: 담당자 전달 / 가이드 / 키데이터 ───────────── */}
            <div className="space-y-3">
                {/* 담당자 전달 여부 */}
                <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-900">담당자 전달</span>
                    {["none", "required", "conditional"].map(v => (
                        <button
                            key={v}
                            onClick={() => {
                                setHandoff(v);
                                if (v === "conditional") setGuideOpen(true);
                            }}
                            className={`h-7 px-3 text-xs rounded-full border ${handoff === v ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200"}`}
                        >
                            {v === "none" ? "필요 없음" : v === "required" ? "필요함" : "조건부 전달"}
                        </button>
                    ))}
                </div>

                {/* 가이드(접힘) */}
                <div>
                    <button
                        onClick={() => setGuideOpen((s) => !s)}
                        className="text-xs text-gray-700 underline underline-offset-4"
                    >
                        {guideOpen ? "가이드 숨기기" : "가이드 작성(선택)"}
                    </button>
                    {guideOpen && (
                        <div className="mt-2 p-3 rounded-xl border border-gray-200 bg-gray-50">
                            <div className="text-[11px] text-gray-500 mb-2">• 답변 시 주의사항/내부 메모. 프리셋/모듈 추가 가능</div>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {/* 간단 프리셋 버튼 (필요시 taxonomy.guidePresets에서 가져오도록 확장) */}
                                {["개인정보 수집 후 안내", "지점별 정책 상이", "현장 확인 필요"].map(g => (
                                    <button key={g} onClick={() => setGuideModules(m => [...m, { id: Date.now() + Math.random(), type: "TEXT", data: { text: g } }])}
                                        className="h-7 px-3 rounded-full bg-white border border-gray-200 text-xs">
                                        {g}
                                    </button>
                                ))}
                            </div>
                            {/* 미니 에디터: TEXT 칩만 사용 (원하면 TIME/DATE도 가능) */}
                            <div className="flex flex-wrap gap-2">
                                {guideModules.map((m, i) => (
                                    <div key={m.id} className="inline-flex items-center gap-1 px-2.5 h-7 bg-white border border-gray-200 rounded-lg text-xs">
                                        <input
                                            value={m.data.text}
                                            onChange={(e) => {
                                                const next = [...guideModules];
                                                next[i] = { ...m, data: { text: e.target.value } };
                                                setGuideModules(next);
                                            }}
                                            className="bg-transparent outline-none w-40"
                                        />
                                        <button onClick={() => setGuideModules(guideModules.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500">
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => setGuideModules([...guideModules, { id: Date.now() + Math.random(), type: "TEXT", data: { text: "" } }])}
                                    className="h-7 px-3 rounded-lg bg-gray-900 text-white text-xs"
                                >
                                    + 추가
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 키데이터(접힘) */}
                <div>
                    <button
                        onClick={() => setKeydataOpen((s) => !s)}
                        className="text-xs text-gray-700 underline underline-offset-4"
                    >
                        {keydataOpen ? "Key Data 숨기기" : "Key Data 선택(선택)"}
                    </button>
                    {keydataOpen && (
                        <div className="mt-2 p-3 rounded-xl border border-gray-200 bg-gray-50">
                            <div className="text-[11px] text-gray-500 mb-2">• 자주 쓰는 내부 값(예: 현관비밀번호, 공유링크 등)</div>
                            <div className="flex flex-wrap gap-2">
                                {keydata.map((kv, i) => (
                                    <div key={i} className="inline-flex items-center gap-2 px-2.5 h-8 bg-white border border-gray-200 rounded-lg text-xs">
                                        <input
                                            placeholder="라벨"
                                            value={kv.key || ""}
                                            onChange={(e) => {
                                                const next = [...keydata]; next[i] = { ...kv, key: e.target.value }; setKeydata(next);
                                            }}
                                            className="w-28 bg-transparent outline-none"
                                        />
                                        <span className="text-gray-400">:</span>
                                        <input
                                            placeholder="값"
                                            value={kv.value || ""}
                                            onChange={(e) => {
                                                const next = [...keydata]; next[i] = { ...kv, value: e.target.value }; setKeydata(next);
                                            }}
                                            className="w-40 bg-transparent outline-none"
                                        />
                                        <button onClick={() => setKeydata(keydata.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500">✕</button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => setKeydata([...keydata, { key: "", value: "" }])}
                                    className="h-7 px-3 rounded-lg bg-gray-900 text-white text-xs"
                                >
                                    + 추가
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>


            {/* 하단 버튼 */}
            <div className="flex gap-3 pt-2">
                <button onClick={onCancel} className="px-6 h-12 bg-gray-100 text-gray-900 font-semibold rounded-xl hover:bg-gray-200 active:scale-95 transition-all">
                    취소
                </button>
                <button onClick={handleComplete} className="flex-1 h-12 bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2">
                    <Check className="w-5 h-5" /> 완료
                </button>
            </div>

            {/* 도움말 */}
            <div className="text-[11px] text-gray-500">
                <p>• 드래그로 순서 변경 / 칩 더블클릭으로 텍스트 편집 / (⌘/Ctrl+I)로 커서 위치에 모듈 삽입</p>
                <p>• "문자로 변환"는 모듈 → 문자열 단방향입니다. (문자열 → 모듈 복원은 하지 않음)</p>
            </div>
        </div>
    );
}

// ModularFAQBuilderV2.jsx 맨 아래 어딘가에 추가
export { TextEditorSheet as MiniTextSheet };
export { DateModule as MiniDateModule };   // 날짜 모듈
export { TimeModule as MiniTimeModule };   // 시간 모듈
