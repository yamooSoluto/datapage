// components/common/OptionPickerModal.jsx
import React from "react";
import { createPortal } from "react-dom";
import { X, Plus, Type, Clock, Calendar } from "lucide-react";

// 시간 정규화 유틸
function pad2(n) {
    return String(n).padStart(2, "0");
}

function normalizeHM(token) {
    if (!token) return null;
    let t = String(token).trim();
    let meridian = null;
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

function normalizeRange(raw) {
    if (!raw) return null;
    const s = String(raw).replace(/\s/g, "");
    const hasSep = s.includes("~") || s.includes("-");
    if (!hasSep) {
        return normalizeHM(s);
    }
    const [a, b] = s.split(s.includes("~") ? "~" : "-");
    const A = normalizeHM(a);
    const B = normalizeHM(b);
    if (!A || !B) return null;
    return A <= B ? `${A}~${B}` : `${B}~${A}`;
}

export default function OptionPickerModal({
    open,
    title,
    options = [],
    value = [],
    onChange,
    onClose,
    onAddOption,
}) {
    // ✅ [PATCH] 커스텀 추가는 항상 append 되도록
    const [sel, setSel] = React.useState(value ?? []);
    const uniq = (arr) => {
        const seen = new Set();
        return arr.filter((t) => {
            const k =
                typeof t === "string" ? t : t?.value ?? t?.label ?? JSON.stringify(t);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    };
    const appendTokens = (tokens) => {
        setSel((prev) => uniq([...(prev || []), ...tokens.filter(Boolean)]));
    };

    // 모달이 "열릴 때" 한 번만 초기화. 열린 동안엔 부모 리렌더로 초기화하지 않음.
    React.useEffect(() => {
        if (open) setSel(Array.isArray(value) ? [...value] : []);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const [q, setQ] = React.useState("");
    React.useEffect(() => {
        if (!open) setQ("");
    }, [open]);

    const [customMode, setCustomMode] = React.useState(null);
    const [textInput, setTextInput] = React.useState("");
    const [times, setTimes] = React.useState([]);
    const [startInput, setStartInput] = React.useState("09:00");
    const [endInput, setEndInput] = React.useState("");
    const [draftStart, setDraftStart] = React.useState(null);
    const [dates, setDates] = React.useState([]);
    const [customDate, setCustomDate] = React.useState("");

    // body 스크롤 방지
    React.useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [open]);

    const resetCustomMode = () => {
        setCustomMode(null);
        setTextInput("");
        setTimes([]);
        setStartInput("09:00");
        setEndInput("");
        setDraftStart(null);
        setDates([]);
        setCustomDate("");
    };

    if (!open) return null;

    const filtered = q
        ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase()))
        : options;

    const toggle = (v) => {
        setSel((curr) => (curr.includes(v) ? curr.filter((x) => x !== v) : [...curr, v]));
    };

    // 시간 관련 함수
    const addTimeToken = (raw) => {
        const rawTokens = String(raw)
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        let next = [...times];
        for (const token of rawTokens) {
            const norm = normalizeRange(token);
            if (norm && !next.includes(norm)) next.push(norm);
        }
        setTimes(next);
    };

    const toggleSingleTime = (hhmm) => {
        const norm = normalizeHM(hhmm);
        if (!norm) return;
        if (times.includes(norm)) setTimes(times.filter((t) => t !== norm));
        else setTimes([...times, norm]);
    };

    const removeTime = (t) => setTimes(times.filter((v) => v !== t));

    const onClickAddTime = () => {
        const s = startInput?.trim();
        const e = endInput?.trim();
        if (!s) return;
        if (s && !e) {
            toggleSingleTime(s);
        } else if (s && e) {
            addTimeToken(`${s}~${e}`);
        }
    };

    const allSlots = Array.from({ length: 24 * 2 }, (_, i) => {
        const h = String(Math.floor(i / 2)).padStart(2, "0");
        const m = i % 2 === 0 ? "00" : "30";
        return `${h}:${m}`;
    });

    const onQuickSlotClick = (slot) => {
        if (!draftStart) {
            setDraftStart(slot);
            return;
        }
        if (draftStart === slot) {
            toggleSingleTime(slot);
        } else {
            addTimeToken(`${draftStart}~${slot}`);
        }
        setDraftStart(null);
    };

    const quickRanges = ["09:00~18:00", "10:00~22:00", "12:00~13:00", "00:00~23:59"];
    const datePresets = [
        "월",
        "화",
        "수",
        "목",
        "금",
        "토",
        "일",
        "요일",
        "평일",
        "주말",
        "매일",
        "매월",
        "공휴일",
        "명절",
        "설날",
        "추석",
        "연중무휴",
    ];

    const toggleDate = (date) => {
        const next = dates.includes(date)
            ? dates.filter((d) => d !== date)
            : [...dates, date];
        setDates(next);
    };

    const addIsoDate = (iso) => {
        if (!iso) return;
        if (!dates.includes(iso)) setDates([...dates, iso]);
    };

    const confirmAddDate = () => {
        addIsoDate(customDate);
        setCustomDate("");
    };

    // ✅ 커스텀 입력 확정 시 append 방식으로만 동작
    const commitCustom = () => {
        if (customMode === "text") {
            const v = textInput.trim();
            if (v) {
                onAddOption?.(v);
                appendTokens([v]);
            }
        } else if (customMode === "time") {
            const labels = times.join(" / ");
            if (labels) {
                onAddOption?.(labels);
                appendTokens([labels]);
            }
        } else if (customMode === "date") {
            const labels = dates.join(" / ");
            if (labels) {
                onAddOption?.(labels);
                appendTokens([labels]);
            }
        }
        resetCustomMode();
    };

    const handleClose = () => {
        onChange?.(sel); // ✅ 항상 누적된 sel 반영
        onClose?.();
        resetCustomMode();
    };

    return createPortal(
        <div className="fixed inset-0 z-50 md:flex md:items-center md:justify-center md:p-4">
            <div className="absolute inset-0 bg-black/30" onClick={handleClose} />

            <div className="absolute bottom-0 left-0 right-0 md:relative md:w-full md:max-w-lg rounded-t-3xl md:rounded-3xl bg-white p-4 md:p-6 shadow-2xl space-y-3 max-h-[85vh] md:max-h-[80vh] overflow-auto">
                <div className="flex items-center justify-between sticky top-0 bg-white pb-2 -mt-1 z-10">
                    <div className="font-semibold text-base">{title}</div>
                    <button
                        onClick={handleClose}
                        className="h-9 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
                    >완료</button>
                </div>

                {/* 기본 모드 */}
                {!customMode && (
                    <>
                        <div className="flex gap-2">
                            <input
                                placeholder="검색"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                className="w-full h-10 rounded-lg border border-gray-300 px-3"
                            />
                            {q && !options.includes(q) && (
                                <button
                                    onClick={() => { onAddOption?.(q); setSel((c) => c.includes(q) ? c : [...c, q]); setQ(""); }}
                                    className="h-10 px-3 rounded-lg border border-dashed bg-white flex-shrink-0"
                                >➕</button>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setCustomMode("text")}
                                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-slate-600 text-white hover:bg-slate-700 transition-all text-xs font-medium shadow-sm"
                            >
                                <Type className="w-3.5 h-3.5" />
                                직접입력
                            </button>
                            <button
                                onClick={() => setCustomMode("time")}
                                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all text-xs font-medium shadow-sm"
                            >
                                <Clock className="w-3.5 h-3.5" />
                                시간
                            </button>
                            <button
                                onClick={() => setCustomMode("date")}
                                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-all text-xs font-medium shadow-sm"
                            >
                                <Calendar className="w-3.5 h-3.5" />
                                날짜
                            </button>
                        </div>

                        <div className="max-h-[40vh] overflow-auto pr-1 -mr-1">
                            <div className="flex flex-wrap gap-2">
                                {filtered.map((opt) => {
                                    const active = sel.includes(opt);
                                    return (
                                        <button
                                            key={opt}
                                            onClick={() => toggle(opt)}
                                            className={`h-9 px-3 rounded-full border ${active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                                        >
                                            {opt}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {/* 텍스트 입력 */}
                {customMode === 'text' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium">직접 입력</h3>
                            <button onClick={resetCustomMode} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <textarea
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            placeholder="내용을 입력하세요"
                            className="w-full h-32 rounded-lg border border-gray-300 px-3 py-2 resize-none"
                            autoFocus
                        />

                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={resetCustomMode}
                                className="h-10 px-4 rounded-lg border bg-white hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={commitCustom}
                                className="h-10 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                )}

                {/* 시간 선택 */}
                {customMode === 'time' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium">시간 선택</h3>
                            <button onClick={resetCustomMode} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* 직접 입력 */}
                        <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">직접 입력</div>
                            <div className="flex gap-2">
                                <input
                                    type="time"
                                    value={startInput}
                                    onChange={(e) => setStartInput(e.target.value)}
                                    className="flex-1 px-2 h-8 text-xs bg-gray-50 rounded-lg border border-gray-200"
                                />
                                <span className="self-center text-xs text-gray-400">~</span>
                                <input
                                    type="time"
                                    placeholder="(선택)"
                                    value={endInput}
                                    onChange={(e) => setEndInput(e.target.value)}
                                    className="flex-1 px-2 h-8 text-xs bg-gray-50 rounded-lg border border-gray-200"
                                />
                                <button
                                    className="px-3 h-8 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600"
                                    onClick={onClickAddTime}
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
                                        className="px-2.5 h-7 text-xs rounded-md bg-gray-100 border border-gray-200 hover:bg-gray-200"
                                        onClick={() => addTimeToken(r)}
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
                                    시작/종료 시간 선택
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
                                            className={`px-2 h-7 text-[10px] rounded-md border ${isStart ? 'bg-blue-600 text-white border-blue-600'
                                                : isSingleSelected ? 'bg-blue-100 text-blue-900 border-blue-200'
                                                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                                                }`}
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
                                            <button onClick={() => removeTime(t)} className="hover:text-red-600">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={resetCustomMode}
                                className="h-10 px-4 rounded-lg border bg-white hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={commitCustom}
                                className="h-10 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                            >
                                완료
                            </button>
                        </div>
                    </div>
                )}

                {/* 날짜 선택 */}
                {customMode === 'date' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium">날짜 선택</h3>
                            <button onClick={resetCustomMode} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* 특정 날짜 */}
                        <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">특정 날짜</div>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={customDate}
                                    onChange={(e) => setCustomDate(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmAddDate(); } }}
                                    className="flex-1 px-2 h-8 text-xs bg-gray-50 rounded-lg border border-gray-200"
                                />
                                <button
                                    onClick={confirmAddDate}
                                    className="px-3 h-8 bg-purple-500 text-white text-xs font-semibold rounded-lg hover:bg-purple-600"
                                >
                                    추가
                                </button>
                            </div>
                        </div>

                        {/* 프리셋 */}
                        <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">프리셋 (다중 선택)</div>
                            <div className="flex flex-wrap gap-1.5">
                                {datePresets.map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => toggleDate(p)}
                                        className={`px-2.5 h-7 text-xs font-medium rounded-lg ${dates.includes(p) ? "bg-purple-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                            }`}
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

                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={resetCustomMode}
                                className="h-10 px-4 rounded-lg border bg-white hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={commitCustom}
                                className="h-10 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                            >
                                완료
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}