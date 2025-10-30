import React, { useState, useRef, useEffect } from 'react';
import { Clock, Calendar, Sparkles, Zap, X, GripVertical, Check, ChevronDown, Hash, Plus, Scissors } from 'lucide-react';

// ✅ 모듈 타입 (단순화)
const MODULE_TYPES = {
    WEEKDAY: 'WEEKDAY', // 요일 (멀티)
    TIME: 'TIME', // 시간 (멀티 + 자유 입력)
    DATE: 'DATE', // 날짜 (멀티)
    NUMBER: 'NUMBER', // 숫자
    ENDING: 'ENDING', // 어미 (싱글)
    SYMBOL: 'SYMBOL', // 특수문자 (텍스트 취급)
    TEXT: 'TEXT', // 자유 텍스트
    TAG: 'TAG',
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

// 09:00~18:00 같은 범위 파싱
function normalizeRange(raw) {
    if (!raw) return null;
    const s = String(raw).replace(/\s/g, '');
    const sep = s.includes('~') ? '~' : s.includes('-') ? '-' : null;
    if (!sep) return normalizeHM(s);
    const [a, b] = s.split(sep);
    const A = normalizeHM(a);
    const B = normalizeHM(b);
    if (!A || !B) return null;
    // 시분 비교하여 A<=B 보장 (야간跨일 처리까지는 단순화)
    return `${A}~${B}`;
}

// ─────────────────────────────────────────────────────────────
// 요일 모듈 (멀티)
// ─────────────────────────────────────────────────────────────
const WeekdayModule = ({ data, onChange, onRemove, isEditing }) => {
    const [expanded, setExpanded] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const handle = (e) => ref.current && !ref.current.contains(e.target) && setExpanded(false);
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    const weekdays = ['월', '화', '수', '목', '금', '토', '일', '평일', '주말', '매일'];
    const selected = data.days || [];

    const toggleDay = (day) => {
        const newDays = selected.includes(day) ? selected.filter((d) => d !== day) : [...selected, day];
        onChange({ days: newDays });
    };

    return (
        <div ref={ref} className="relative inline-block">
            <div
                onClick={() => isEditing && setExpanded(!expanded)}
                className={`inline-flex items-center gap-1.5 px-3 h-8 bg-indigo-50 rounded-lg shadow-sm text-sm font-medium cursor-pointer hover:shadow-md transition-all ${isEditing ? '' : 'opacity-40'
                    }`}
            >
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-indigo-900">{selected.length > 0 ? selected.join(', ') : '요일'}</span>
                {isEditing && (
                    <>
                        <ChevronDown className={`w-3 h-3 text-indigo-600 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-1 text-indigo-400 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </>
                )}
            </div>

            {expanded && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-2xl p-3 z-50 min-w-[200px]">
                    <div className="text-xs font-semibold text-gray-700 mb-2">요일 (다중 선택)</div>
                    <div className="flex flex-wrap gap-1.5">
                        {weekdays.map((day) => (
                            <button
                                key={day}
                                onClick={() => toggleDay(day)}
                                className={`px-2.5 h-7 text-xs font-medium rounded-lg transition-all ${selected.includes(day) ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// 시간 모듈 (멀티 + 자유 입력 + 초간단 레인지 빌더)
// ─────────────────────────────────────────────────────────────
const TimeModule = ({ data, onChange, onRemove, isEditing }) => {
    const [expanded, setExpanded] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [draftStart, setDraftStart] = useState(null); // 빠른 범위 시작점
    const ref = useRef(null);

    useEffect(() => {
        const handle = (e) => ref.current && !ref.current.contains(e.target) && setExpanded(false);
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    const times = data.times || [];

    const addToken = (raw) => {
        // 콤마 분리 다중 입력 허용
        const rawTokens = String(raw).split(',').map((t) => t.trim()).filter(Boolean);
        let next = [...times];
        for (const token of rawTokens) {
            const norm = normalizeRange(token);
            if (norm && !next.includes(norm)) next.push(norm);
        }
        onChange({ times: next });
    };

    const addTimeFromInput = () => {
        if (!inputValue.trim()) return;
        addToken(inputValue.trim());
        setInputValue('');
    };

    const removeTime = (time) => onChange({ times: times.filter((t) => t !== time) });

    const allSlots = Array.from({ length: 24 * 2 }, (_, i) => {
        const h = Math.floor(i / 2);
        const m = i % 2 === 0 ? '00' : '30';
        return `${pad2(h)}:${m}`;
    });

    const onQuickSlotClick = (slot) => {
        if (!draftStart) {
            setDraftStart(slot);
        } else {
            // 범위 완성
            const A = draftStart;
            const B = slot;
            const idxA = allSlots.indexOf(A);
            const idxB = allSlots.indexOf(B);
            if (idxA <= idxB) addToken(`${A}~${B}`);
            else addToken(`${B}~${A}`);
            setDraftStart(null);
        }
    };

    return (
        <div ref={ref} className="relative inline-block">
            <div
                onClick={() => isEditing && setExpanded(!expanded)}
                className={`inline-flex items-center gap-1.5 px-3 h-8 bg-blue-50 rounded-lg shadow-sm text-sm font-medium cursor-pointer hover:shadow-md transition-all ${isEditing ? '' : 'opacity-40'
                    }`}
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

            {expanded && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-2xl shadow-2xl p-3 z-50 min-w-[320px] w-[360px]">
                    <div className="space-y-3">
                        {/* 자유 입력 */}
                        <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">시간 입력 (콤마로 여러 개)</div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addTimeFromInput()}
                                    placeholder="09:00, 13:30, 09:00~18:00, 오전9시~오후6시"
                                    className="flex-1 px-2 h-8 text-xs bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                                />
                                <button onClick={addTimeFromInput} className="px-3 h-8 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-all">
                                    추가
                                </button>
                            </div>
                        </div>

                        {/* 빠른 범위 빌더 */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-xs font-semibold text-gray-700">빠른 범위 선택 (시작→끝 순서로 클릭)</div>
                                <div className="text-[10px] text-gray-500">{draftStart ? `시작: ${draftStart}` : '시작을 선택하세요'}</div>
                            </div>
                            <div className="grid grid-cols-6 gap-1 max-h-[160px] overflow-auto pr-1">
                                {allSlots.map((slot) => (
                                    <button
                                        key={slot}
                                        onClick={() => onQuickSlotClick(slot)}
                                        className={`px-2 h-7 text-[10px] rounded-md border ${draftStart === slot ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                                            }`}
                                    >
                                        {slot}
                                    </button>
                                ))}
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
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// 날짜 모듈 (멀티)
// ─────────────────────────────────────────────────────────────
const DateModule = ({ data, onChange, onRemove, isEditing }) => {
    const [expanded, setExpanded] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const handle = (e) => ref.current && !ref.current.contains(e.target) && setExpanded(false);
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    const presets = ['공휴일', '명절', '설날', '추석', '연말연시', '성수기', '비수기', '봄', '여름', '가을', '겨울'];
    const dates = data.dates || [];

    const toggleDate = (date) => {
        const newDates = dates.includes(date) ? dates.filter((d) => d !== date) : [...dates, date];
        onChange({ dates: newDates });
    };

    const addCustomDate = (e) => {
        const date = e.target.value;
        if (date && !dates.includes(date)) onChange({ dates: [...dates, date] });
    };

    return (
        <div ref={ref} className="relative inline-block">
            <div
                onClick={() => isEditing && setExpanded(!expanded)}
                className={`inline-flex items-center gap-1.5 px-3 h-8 bg-purple-50 rounded-lg shadow-sm text-sm font-medium cursor-pointer hover:shadow-md transition-all ${isEditing ? '' : 'opacity-40'
                    }`}
            >
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                <span className="text-purple-900">{dates.length > 0 ? dates.join(', ') : '날짜'}</span>
                {isEditing && (
                    <>
                        <ChevronDown className={`w-3 h-3 text-purple-600 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-1 text-purple-400 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </>
                )}
            </div>

            {expanded && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-2xl shadow-2xl p-3 z-50 min-w-[260px]">
                    <div className="space-y-3">
                        <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">특정 날짜</div>
                            <input
                                type="date"
                                onChange={addCustomDate}
                                className="w-full px-2 h-8 text-xs bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                            />
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">프리셋 (다중 선택)</div>
                            <div className="flex flex-wrap gap-1.5">
                                {presets.map((preset) => (
                                    <button
                                        key={preset}
                                        onClick={() => toggleDate(preset)}
                                        className={`px-2.5 h-7 text-xs font-medium rounded-lg transition-all ${dates.includes(preset) ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        {preset}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {dates.length > 0 && (
                            <div>
                                <div className="text-xs font-semibold text-gray-700 mb-2">선택된 날짜</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {dates.map((date) => (
                                        <div key={date} className="inline-flex items-center gap-1 px-2.5 h-7 bg-purple-100 text-purple-900 text-xs font-medium rounded-lg">
                                            {date}
                                            <button onClick={() => toggleDate(date)} className="hover:text-red-600">
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
// 숫자 모듈
// ─────────────────────────────────────────────────────────────
const NumberModule = ({ data, onChange, onRemove, isEditing }) => {
    const [expanded, setExpanded] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const handle = (e) => ref.current && !ref.current.contains(e.target) && setExpanded(false);
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    const units = ['원', '개', '명', '시간', '분', '일', '회', '%'];

    return (
        <div ref={ref} className="relative inline-block">
            <div
                onClick={() => isEditing && setExpanded(!expanded)}
                className={`inline-flex items-center gap-1.5 px-3 h-8 bg-green-50 rounded-lg shadow-sm text-sm font-medium cursor-pointer hover:shadow-md transition-all ${isEditing ? '' : 'opacity-40'
                    }`}
            >
                <Hash className="w-3.5 h-3.5 text-green-600" />
                <span className="text-green-900">{data.value || '0'}{data.unit || ''}</span>
                {isEditing && (
                    <>
                        <ChevronDown className={`w-3 h-3 text-green-600 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-1 text-green-400 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </>
                )}
            </div>

            {expanded && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-2xl shadow-2xl p-3 z-50 min-w-[200px]">
                    <div className="space-y-3">
                        <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">숫자</div>
                            <input
                                type="number"
                                value={data.value || ''}
                                onChange={(e) => onChange({ ...data, value: e.target.value })}
                                className="w-full px-2 h-8 text-xs bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-400 focus:outline-none"
                            />
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-gray-700 mb-2">단위</div>
                            <div className="flex flex-wrap gap-1.5">
                                {units.map((unit) => (
                                    <button
                                        key={unit}
                                        onClick={() => onChange({ ...data, unit })}
                                        className={`px-2.5 h-7 text-xs font-medium rounded-lg transition-all ${data.unit === unit ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        {unit}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// 태그 모듈 (멀티)
// ─────────────────────────────────────────────────────────────
const TagModule = ({ data, onChange, onRemove, isEditing }) => {
    const [expanded, setExpanded] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const handle = (e) => ref.current && !ref.current.contains(e.target) && setExpanded(false);
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, []);

    const selected = data.tags || [];
    const toggle = (tag) => {
        const next = selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag];
        onChange({ tags: next });
    };

    return (
        <div ref={ref} className="relative inline-block">
            <div
                onClick={() => isEditing && setExpanded(!expanded)}
                className={`inline-flex items-center gap-1.5 px-3 h-8 bg-pink-50 rounded-lg shadow-sm text-sm font-medium cursor-pointer hover:shadow-md transition-all ${isEditing ? '' : 'opacity-40'
                    }`}
            >
                <span className="text-pink-900">{selected.length > 0 ? selected.join(', ') : '태그'}</span>
                {isEditing && (
                    <>
                        <ChevronDown className={`w-3 h-3 text-pink-600 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-1 text-pink-400 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </>
                )}
            </div>

            {expanded && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-2xl p-3 z-50 min-w-[220px]">
                    <div className="text-xs font-semibold text-gray-700 mb-2">태그 (다중 선택)</div>
                    <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                        {TAG_LIBRARY.map((tag) => (
                            <button
                                key={tag}
                                onClick={() => toggle(tag)}
                                className={`px-2.5 h-7 text-xs font-medium rounded-lg transition-all ${selected.includes(tag) ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


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
    const [isEditMode, setIsEditMode] = useState(false);
    const [editValue, setEditValue] = useState(data.text || '');
    const inputRef = useRef(null);

    useEffect(() => {
        if (isEditMode && inputRef.current) inputRef.current.focus();
    }, [isEditMode]);

    if (isEditMode && isEditing) {
        return (
            <div className="inline-flex items-center gap-1 bg-white rounded-lg shadow-sm px-2 h-8 border-2 border-blue-400">
                <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => {
                        onEdit(editValue);
                        setIsEditMode(false);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onEdit(editValue);
                            setIsEditMode(false);
                        }
                        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
                            // Cmd/Ctrl+I → 커서 위치에 삽입 분기
                            const caret = e.currentTarget.selectionStart || 0;
                            onSplitAtCaret(caret);
                        }
                    }}
                    className="bg-transparent text-sm font-medium text-gray-900 focus:outline-none w-36"
                />
                <button
                    title="커서 위치에 모듈 삽입 (⌘/Ctrl+I)"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        const caret = inputRef.current?.selectionStart || 0;
                        onSplitAtCaret(caret);
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
            onDoubleClick={() => isEditing && setIsEditMode(true)}
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
// 드래그 가능한 모듈 래퍼 + 사이 삽입 포인트
// ─────────────────────────────────────────────────────────────
const DraggableModule = ({ module, index, isEditing, onUpdate, onRemove, onDragStart, onDragOver, onDragEnd, onRequestSplitInsert }) => {
    const ModuleComponent = {
        [MODULE_TYPES.WEEKDAY]: WeekdayModule,
        [MODULE_TYPES.TIME]: TimeModule,
        [MODULE_TYPES.DATE]: DateModule,
        [MODULE_TYPES.NUMBER]: NumberModule,
        [MODULE_TYPES.ENDING]: EndingModule,
        [MODULE_TYPES.TAG]: TagModule,
        [MODULE_TYPES.SYMBOL]: TextChip,
        [MODULE_TYPES.TEXT]: TextChip,
    }[module.type];

    return (
        <div draggable={isEditing} onDragStart={() => onDragStart(index)} onDragOver={(e) => onDragOver(e, index)} onDragEnd={onDragEnd} className="inline-flex items-center gap-1">
            {isEditing && <GripVertical className="w-3 h-3 text-gray-400 cursor-move flex-shrink-0" />}
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
    ['불가능해요', '불가합니다', '안돼요', '안됩니다'],
    ['가능해요', '가능합니다', '돼요', '됩니다'],
    ['있어요', '있습니다', '없어요', '없습니다'],
    ['해주세요', '부탁드립니다', '해주시면 됩니다'],
];

const SYMBOLS = ['~', ',', '.', '/', '(', ')', '[', ']', '-', '·'];

// 범용 CS 분류용 태그 라이브러리
const TAG_LIBRARY = [
    '결제', '환불', '예약', '이용권', '좌석', '시설', '규정', '이벤트',
    '영업시간', '증빙', '주차', '와이파이', '프린터', '장애', '문의', '쿠폰', '멤버십'
];

// ✅ 프리셋을 "모듈"로도 제공 가능 (qMods, aMods)
const MAIN_CATEGORIES = {
    facility: {
        label: '시설/편의',
        keywords: ['와이파이', '프린터', '콘센트', '주차', '화장실', '정수기', '스낵바', '엘리베이터', '휠체어', '흡연구역'],
        presets: [
            { q: '와이파이 비밀번호가 뭔가요?', a: '와이파이 이름은 CONCENTABLE, 비밀번호는 안내판을 확인해주세요' },
            { q: '프린터 사용 가능한가요?', a: '매장 내 프린터 사용 가능하며, 페이지당 요금이 부과됩니다' },
            { q: '주차 가능해요?', a: '건물 지하 1층에 유료 주차 가능합니다. 제휴 여부는 매장에 문의해주세요' },
        ],
    },
    hours: {
        label: '운영/시간',
        keywords: ['영업시간', '무인', '출입', '퇴실', '브레이크타임', '공휴일', '휴무', '심야', '야간', '연중무휴'],
        presets: [
            { q: '영업시간이 어떻게 되나요?', a: '평일 09:00~22:00, 주말/공휴일 10:00~20:00 운영합니다' },
            { q: '무인시간에도 출입 가능한가요?', a: '무인시간에는 등록된 번호로 도어락 인증 후 출입 가능합니다' },
            { q: '브레이크타임 있나요?', a: '매일 14:00~15:00은 정리 시간으로 일부 서비스가 제한됩니다' },
        ],
    },
    seats: {
        label: '좌석/예약',
        keywords: ['자유석', '전용석', '스터디룸', '예약', '연장', '자리변경', '그룹석', '타이핑', '조용구역'],
        presets: [
            { q: '스터디룸 예약 어떻게 하나요?', a: '포털 예약 메뉴에서 날짜/시간 선택 후 결제하면 예약 완료됩니다' },
            { q: '자유석과 전용석 차이가 뭔가요?', a: '자유석은 선착순 이용, 전용석은 지정 좌석을 기간 동안 고정 사용합니다' },
            { q: '자리 변경 가능한가요?', a: '여석이 있을 경우 가능하며, 카운터 혹은 채널로 문의해주세요' },
        ],
    },
    passes: {
        label: '이용권',
        keywords: ['1회권', '시간권', '정기권', '기간연장', '일시정지', '잔여시간', '전환', '업그레이드'],
        presets: [
            { q: '정기권 기간 연장할 수 있나요?', a: '만료 7일 전부터 연장 가능하며, 포털 결제 또는 현장 결제가 가능합니다' },
            { q: '시간권 잔여시간 확인은?', a: '마이페이지 > 이용권에서 실시간으로 확인할 수 있습니다' },
        ],
    },
    payment: {
        label: '결제/영수증',
        keywords: ['카드', '계좌', '현금영수증', '세금계산서', '영수증', '간편결제', '부분결제', '결제오류'],
        presets: [
            { q: '현금영수증 발급되나요?', a: '결제 시 휴대폰 번호 입력으로 발급 가능하며, 마이페이지에서도 재발급됩니다' },
            { q: '세금계산서 가능해요?', a: '사업자등록증 제출 시 월말 일괄 발행 가능합니다' },
            { q: '결제 오류가 나요', a: '카드 한도/인증 문제일 수 있습니다. 다른 카드 또는 간편결제로 시도해주세요' },
        ],
    },
    refund: {
        label: '환불/취소',
        keywords: ['중도해지', '위약금', '부분환불', '환불기간', '취소수수료', '정책', '영업일'],
        presets: [
            { q: '환불 규정이 어떻게 되나요?', a: '결제 후 24시간 이내 전액 환불, 이후 사용일수·위약금 공제 후 환불됩니다' },
            { q: '예약 취소 수수료 있나요?', a: '이용 3일 전까지 무료, 이후 일정 비율의 수수료가 발생합니다' },
            { q: '환불은 언제 입금되나요?', a: '영업일 기준 3~5일 내 처리됩니다' },
        ],
    },
    policy: {
        label: '규정/이용안내',
        keywords: ['소음', '음식물', '통화', '촬영', '반려동물', '흡연', '자리맡기', '분실물', '퇴실', '안전'],
        presets: [
            { q: '음식물 반입 가능한가요?', a: '뜨거운 음식/강한 냄새는 제한되며, 뚜껑 있는 음료는 가능합니다' },
            { q: '통화 가능한가요?', a: '카페존에서만 가능하며, 조용존/스위트존은 통화·대화가 제한됩니다' },
            { q: '분실물은 어디서 찾나요?', a: '카운터 또는 채널로 문의 주시면 보관 여부를 확인해드립니다' },
        ],
    },
    tech: {
        label: '기술/장애',
        keywords: ['앱오류', '도어락', '인증', '네트워크', '프린터오류', '비밀번호', '로그인', '접속오류'],
        presets: [
            { q: '도어락이 안 열려요', a: '등록된 번호인지 확인 후 다시 시도해주세요. 계속 안되면 채널로 연락주세요' },
            { q: '와이파이가 끊겨요', a: '다른 SSID로 접속하거나 공유기 재연결을 시도해주세요' },
        ],
    },
    service: {
        label: '상담/문의',
        keywords: ['응대시간', '연락처', '카카오톡', '네이버', '인스타DM', '이메일', '현장', '지연'],
        presets: [
            { q: '상담 가능 시간은요?', a: '평일 10:00~18:00(점심 12:30~13:30) 응대합니다' },
            { q: '어디로 문의하면 되나요?', a: '채널톡/카카오/네이버 중 편한 채널로 남겨주세요. 순차 응대합니다' },
        ],
    },
    events: {
        label: '이벤트/프로모션',
        keywords: ['쿠폰', '프로모션', '친구추천', '멤버십', '적립', '가격할인'],
        presets: [
            { q: '쿠폰 사용 방법 알려주세요', a: '결제 화면에서 쿠폰 코드 입력 후 적용을 눌러주세요' },
            { q: '친구추천 있나요?', a: '추천인 코드 입력 시 양쪽 모두 혜택이 지급됩니다' },
        ],
    },
};


// ─────────────────────────────────────────────────────────────
// 모듈 → 텍스트 변환 (텍스트화 버튼에서 사용)
// ─────────────────────────────────────────────────────────────
const moduleToText = (module) => {
    switch (module.type) {
        case MODULE_TYPES.WEEKDAY:
            return module.data.days?.join(', ') || '';
        case MODULE_TYPES.TIME:
            return module.data.times?.join(', ') || '';
        case MODULE_TYPES.DATE:
            return module.data.dates?.join(', ') || '';
        case MODULE_TYPES.NUMBER:
            return `${module.data.value || '0'}${module.data.unit || ''}`;
        case MODULE_TYPES.ENDING:
            return module.data.selected || module.data.options?.[0] || '';
        case MODULE_TYPES.SYMBOL:
        case MODULE_TYPES.TEXT:
            return module.data.text || '';
        case MODULE_TYPES.TAG:
            return module.data.tags?.join(', ') || '';
        default:
            return '';
    }
};

const modulesToPlain = (mods) => mods.map(moduleToText).join(' ');

// ─────────────────────────────────────────────────────────────
// 인라인 삽입 포인트 버튼
// ─────────────────────────────────────────────────────────────
const InsertPoint = ({ onClick }) => (
    <button
        title="여기에 삽입"
        onClick={onClick}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white border border-dashed border-gray-300 text-gray-400 hover:text-blue-600 hover:border-blue-300"
    >
        <Plus className="w-3 h-3" />
    </button>
);

// ─────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────
export default function ModularFAQBuilderV2({ onComplete, onCancel }) {
    const [mainCategory, setMainCategory] = useState('facility'); // 대분류 (싱글)
    const [questionModules, setQuestionModules] = useState([]);
    const [answerModules, setAnswerModules] = useState([]);
    const [currentMode, setCurrentMode] = useState('question');
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [showPresetPanel, setShowPresetPanel] = useState(false);
    const [insertIndex, setInsertIndex] = useState(null); // 사이 삽입 인덱스

    const currentCategoryData = MAIN_CATEGORIES[mainCategory];

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
    const handleDragEnd = () => setDraggedIndex(null);

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
        onComplete?.({ question, answer, questionModules, answerModules, category: mainCategory });
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
            <div className="flex gap-2">
                {Object.entries(MAIN_CATEGORIES).map(([key, data]) => (
                    <button
                        key={key}
                        onClick={() => setMainCategory(key)}
                        className={`flex-1 h-11 text-sm font-semibold rounded-xl transition-all ${mainCategory === key ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:scale-95'
                            }`}
                    >
                        {data.label}
                    </button>
                ))}
            </div>

            {/* 미리보기: 질문 */}
            <div className="space-y-3">
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-900">질문</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={textify}
                                className="px-3 h-7 text-xs font-semibold rounded-full bg-white border border-gray-300 hover:bg-gray-50"
                            >
                                텍스트로 풀기
                            </button>
                            <button
                                onClick={() => setCurrentMode('question')}
                                className={`px-3 h-7 text-xs font-semibold rounded-full transition-all ${currentMode === 'question' ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:scale-95'
                                    }`}
                            >
                                {currentMode === 'question' ? '✏️ 편집중' : '편집'}
                            </button>
                        </div>
                    </div>

                    <div className="min-h-[96px] p-4 bg-gray-50 rounded-2xl flex flex-wrap gap-2 items-start shadow-inner">
                        {/* 맨 앞 삽입 포인트 */}
                        {currentMode === 'question' && <InsertPoint onClick={() => setInsertIndex(0)} />}
                        {questionModules.length > 0 ? (
                            questionModules.map((module, index) => (
                                <React.Fragment key={module.id}>
                                    <DraggableModule
                                        module={module}
                                        index={index}
                                        isEditing={currentMode === 'question'}
                                        onUpdate={updateModule}
                                        onRemove={removeModule}
                                        onDragStart={handleDragStart}
                                        onDragOver={handleDragOver}
                                        onDragEnd={handleDragEnd}
                                        onRequestSplitInsert={onRequestSplitInsert}
                                    />
                                    {/* 모듈 사이 삽입 포인트 */}
                                    {currentMode === 'question' && <InsertPoint onClick={() => setInsertIndex(index + 1)} />}
                                </React.Fragment>
                            ))
                        ) : (
                            <span className="text-gray-400 text-sm">모듈을 추가하세요</span>
                        )}
                    </div>
                </div>

                {/* 미리보기: 답변 */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-900">답변</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={textify}
                                className="px-3 h-7 text-xs font-semibold rounded-full bg-white border border-gray-300 hover:bg-gray-50"
                            >
                                텍스트로 풀기
                            </button>
                            <button
                                onClick={() => setCurrentMode('answer')}
                                className={`px-3 h-7 text-xs font-semibold rounded-full transition-all ${currentMode === 'answer' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:scale-95'
                                    }`}
                            >
                                {currentMode === 'answer' ? '✏️ 편집중' : '편집'}
                            </button>
                        </div>
                    </div>

                    <div className="min-h-[110px] p-4 bg-gray-50 rounded-2xl flex flex-wrap gap-2 items-start shadow-inner">
                        {currentMode === 'answer' && <InsertPoint onClick={() => setInsertIndex(0)} />}
                        {answerModules.length > 0 ? (
                            answerModules.map((module, index) => (
                                <React.Fragment key={module.id}>
                                    <DraggableModule
                                        module={module}
                                        index={index}
                                        isEditing={currentMode === 'answer'}
                                        onUpdate={updateModule}
                                        onRemove={removeModule}
                                        onDragStart={handleDragStart}
                                        onDragOver={handleDragOver}
                                        onDragEnd={handleDragEnd}
                                        onRequestSplitInsert={onRequestSplitInsert}
                                    />
                                    {currentMode === 'answer' && <InsertPoint onClick={() => setInsertIndex(index + 1)} />}
                                </React.Fragment>
                            ))
                        ) : (
                            <span className="text-gray-400 text-sm">답변도 조합하세요</span>
                        )}
                    </div>
                </div>
            </div>

            {/* 모듈 추가 툴바 (어디든 삽입 가능) */}
            <div>
                <div className="text-xs font-semibold text-gray-900 mb-2">모듈{insertIndex !== null && insertIndex !== undefined ? ` (삽입 위치: ${insertIndex})` : ''}</div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => addModule(MODULE_TYPES.TEXT, { text: '' })} className="px-3 h-9 text-xs font-semibold rounded-xl bg-white shadow-sm hover:shadow-md active:scale-95 transition-all">
                        📝 텍스트
                    </button>
                    <button onClick={() => addModule(MODULE_TYPES.TAG, { tags: [] })} className="px-3 h-9 text-xs font-semibold rounded-xl bg-white shadow-sm hover:shadow-md active:scale-95 transition-all">
                        🏷️ 태그
                    </button>
                    <button onClick={() => addModule(MODULE_TYPES.WEEKDAY, { days: [] })} className="px-3 h-9 text-xs font-semibold rounded-xl bg-white shadow-sm hover:shadow-md active:scale-95 transition-all">
                        📅 요일
                    </button>
                    <button onClick={() => addModule(MODULE_TYPES.TIME, { times: [] })} className="px-3 h-9 text-xs font-semibold rounded-xl bg-white shadow-sm hover:shadow-md active:scale-95 transition-all">
                        ⏰ 시간
                    </button>
                    <button onClick={() => addModule(MODULE_TYPES.DATE, { dates: [] })} className="px-3 h-9 text-xs font-semibold rounded-xl bg-white shadow-sm hover:shadow-md active:scale-95 transition-all">
                        🗓 날짜
                    </button>
                    <button onClick={() => addModule(MODULE_TYPES.NUMBER, { value: '', unit: '' })} className="px-3 h-9 text-xs font-semibold rounded-xl bg-white shadow-sm hover:shadow-md active:scale-95 transition-all">
                        #️⃣ 숫자
                    </button>
                    <button onClick={() => setShowPresetPanel(!showPresetPanel)} className={`px-3 h-9 text-xs font-semibold rounded-xl transition-all active:scale-95 ${showPresetPanel ? 'bg-gray-900 text-white shadow-lg' : 'bg-white shadow-sm hover:shadow-md'
                        }`}>
                        ✨ 프리셋
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

            {/* 키워드 */}
            <div>
                <div className="text-xs font-semibold text-gray-900 mb-2">키워드</div>
                <div className="flex flex-wrap gap-2">
                    {currentCategoryData.keywords.map((keyword) => (
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
                <p>• "텍스트로 풀기"는 모듈 → 문자열 단방향입니다. (문자열 → 모듈 복원은 하지 않음)</p>
            </div>
        </div>
    );
}
