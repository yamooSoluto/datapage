import React, { useState, useRef, useEffect } from 'react';
import { Clock, Calendar, Sparkles, Zap, X, GripVertical, Check, ChevronDown, Hash, Plus, Scissors, ChevronUp, Settings, ArrowUpDown } from 'lucide-react';

// ✅ 모듈 타입 (그대로 유지)
const MODULE_TYPES = {
    WEEKDAY: 'WEEKDAY',
    TIME: 'TIME',
    DATE: 'DATE',
    NUMBER: 'NUMBER',
    ENDING: 'ENDING',
    SYMBOL: 'SYMBOL',
    TEXT: 'TEXT',
    TAG: 'TAG',
};

// ─────────────────────────────────────────────────────────────
// 공통 유틸 (그대로)
// ─────────────────────────────────────────────────────────────
function pad2(n) {
    return String(n).padStart(2, '0');
}

function normalizeHM(token) {
    if (!token) return null;
    let t = String(token).trim();
    let meridian = null;
    if (t.includes('오전')) meridian = 'AM';
    if (t.includes('오후')) meridian = 'PM';
    t = t.replace(/오전|오후|\s/g, '');
    t = t.replace(/시/g, ':').replace(/분/g, '');

    if (/^\d{1,4}$/.test(t)) {
        if (t.length <= 2) {
            let h = Number(t);
            if (meridian === 'PM' && h < 12) h += 12;
            if (meridian === 'AM' && h === 12) h = 0;
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

    const m = t.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
    if (m) {
        let h = Number(m[1]);
        let mm = Number(m[2] || 0);
        if (meridian === 'PM' && h < 12) h += 12;
        if (meridian === 'AM' && h === 12) h = 0;
        return `${pad2(h)}:${pad2(mm)}`;
    }

    return null;
}

function normalizeRange(raw) {
    if (!raw) return null;
    const s = String(raw).replace(/\s/g, '');
    const sep = s.includes('~') ? '~' : s.includes('-') ? '-' : null;
    if (!sep) return normalizeHM(s);
    const [a, b] = s.split(sep);
    const A = normalizeHM(a);
    const B = normalizeHM(b);
    if (!A || !B) return null;
    return `${A}~${B}`;
}

// ─────────────────────────────────────────────────────────────
// TagsInput: 콤마/Enter로 토큰 추가
// ─────────────────────────────────────────────────────────────
const TagsInput = ({ value = [], onChange }) => {
    const [draft, setDraft] = useState('');

    const commit = () => {
        const tokens = draft
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
        if (!tokens.length) return;
        const next = Array.from(new Set([...(value || []), ...tokens]));
        onChange(next);
        setDraft('');
    };

    return (
        <div className="rounded-xl border border-gray-200 p-2 bg-white">
            <div className="flex flex-wrap gap-1 mb-2">
                {(value || []).map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 h-6 bg-gray-100 text-gray-700 text-xs rounded-lg">
                        {t}
                        <button
                            onClick={() => onChange((value || []).filter((x) => x !== t))}
                            className="text-gray-400 hover:text-red-500"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
            </div>
            <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        commit();
                    }
                    if (e.key === 'Backspace' && !draft && (value || []).length) {
                        onChange((value || []).slice(0, -1));
                    }
                }}
                placeholder="태그 입력 후 Enter"
                className="w-full px-2 h-8 text-sm bg-gray-50 rounded-lg border border-gray-200 focus:outline-none"
            />
        </div>
    );
};

const ENDING_GROUPS = [
    ['입니다', '이에요', '에요'],
    ['불가능해요', '불가합니다', '안돼요', '안됩니다'],
    ['가능해요', '가능합니다', '돼요', '됩니다'],
    ['있어요', '있습니다', '없어요', '없습니다'],
    ['해주세요', '부탁드립니다', '해주시면 됩니다'],
];

const SYMBOLS = ['~', ',', '.', '/', '(', ')', '[', ']', '-', '·'];

const TAG_LIBRARY = [
    '결제', '환불', '예약', '이용권', '좌석', '시설', '규정', '이벤트',
    '영업시간', '증빙', '주차', '와이파이', '프린터', '장애', '문의', '쿠폰', '멤버십'
];

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
        ],
    },
    seats: {
        label: '좌석/예약',
        keywords: ['자유석', '전용석', '스터디룸', '예약', '연장', '자리변경', '그룹석', '타이핑', '조용구역'],
        presets: [
            { q: '스터디룸 예약 어떻게 하나요?', a: '포털 예약 메뉴에서 날짜/시간 선택 후 결제하면 예약 완료됩니다' },
            { q: '자유석과 전용석 차이가 뭔가요?', a: '자유석은 선착순 이용, 전용석은 지정 좌석을 기간 동안 고정 사용합니다' },
        ],
    },
    passes: {
        label: '이용권',
        keywords: ['1회권', '시간권', '정기권', '기간연장', '일시정지', '잔여시간', '전환', '업그레이드'],
        presets: [
            { q: '정기권 기간 연장할 수 있나요?', a: '만료 7일 전부터 연장 가능하며, 포털 결제 또는 현장 결제가 가능합니다' },
        ],
    },
    payment: {
        label: '결제/영수증',
        keywords: ['카드', '계좌', '현금영수증', '세금계산서', '영수증', '간편결제', '부분결제', '결제오류'],
        presets: [
            { q: '현금영수증 발급되나요?', a: '결제 시 휴대폰 번호 입력으로 발급 가능하며, 마이페이지에서도 재발급됩니다' },
        ],
    },
    refund: {
        label: '환불/취소',
        keywords: ['중도해지', '위약금', '부분환불', '환불기간', '취소수수료', '정책', '영업일'],
        presets: [
            { q: '환불 규정이 어떻게 되나요?', a: '결제 후 24시간 이내 전액 환불, 이후 사용일수·위약금 공제 후 환불됩니다' },
        ],
    },
    policy: {
        label: '규정/이용안내',
        keywords: ['소음', '음식물', '통화', '촬영', '반려동물', '흡연', '자리맡기', '분실물', '퇴실', '안전'],
        presets: [
            { q: '음식물 반입 가능한가요?', a: '뜨거운 음식/강한 냄새는 제한되며, 뚜껑 있는 음료는 가능합니다' },
        ],
    },
    tech: {
        label: '기술/장애',
        keywords: ['앱오류', '도어락', '인증', '네트워크', '프린터오류', '비밀번호', '로그인', '접속오류'],
        presets: [
            { q: '도어락이 안 열려요', a: '등록된 번호인지 확인 후 다시 시도해주세요. 계속 안되면 채널로 연락주세요' },
        ],
    },
    service: {
        label: '상담/문의',
        keywords: ['응대시간', '연락처', '카카오톡', '네이버', '인스타DM', '이메일', '현장', '지연'],
        presets: [
            { q: '상담 가능 시간은요?', a: '평일 10:00~18:00(점심 12:30~13:30) 응대합니다' },
        ],
    },
    events: {
        label: '이벤트/프로모션',
        keywords: ['쿠폰', '프로모션', '친구추천', '멤버십', '적립', '가격할인'],
        presets: [
            { q: '쿠폰 사용 방법 알려주세요', a: '결제 화면에서 쿠폰 코드 입력 후 적용을 눌러주세요' },
        ],
    },
};

// ─────────────────────────────────────────────────────────────
// 🎯 슬라이드 모달
// ─────────────────────────────────────────────────────────────
const SlideModal = ({ isOpen, onClose, title, children, size = 'normal' }) => {
    if (!isOpen) return null;

    const heights = {
        small: 'max-h-[50vh]',
        normal: 'max-h-[75vh]',
        large: 'max-h-[90vh]'
    };

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl ${heights[size]} overflow-hidden flex flex-col animate-slide-up`}>
                <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                    <h3 className="font-bold text-base">{title}</h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 active:scale-95">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-auto p-4 pb-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// 🎯 TIME 모듈 (완전 기능)
// ─────────────────────────────────────────────────────────────
const TimeModule = ({ data, onChange, onRemove, isEditing }) => {
    const [showModal, setShowModal] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [draftStart, setDraftStart] = useState(null);
    const times = data.times || [];

    const addToken = (raw) => {
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
        <>
            <div
                onClick={() => isEditing && setShowModal(true)}
                className="inline-flex items-center gap-1 px-2.5 h-7 bg-blue-50 rounded-lg text-xs font-medium active:scale-95"
            >
                <Clock className="w-3 h-3 text-blue-600" />
                <span className="text-blue-900">{times.length > 0 ? times.slice(0, 2).join(', ') + (times.length > 2 ? '...' : '') : '시간'}</span>
                {isEditing && (
                    <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-0.5">
                        <X className="w-3 h-3 text-blue-400" />
                    </button>
                )}
            </div>

            <SlideModal isOpen={showModal} onClose={() => setShowModal(false)} title="시간 설정" size="large">
                <div className="space-y-4">
                    {/* 자유 입력 */}
                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-2 block">시간 입력</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addTimeFromInput()}
                                placeholder="09:00, 13:30, 09~18"
                                className="flex-1 px-3 h-10 text-sm bg-gray-50 rounded-xl border border-gray-200"
                            />
                            <button onClick={addTimeFromInput} className="px-4 h-10 bg-blue-500 text-white text-sm font-semibold rounded-xl active:scale-95">
                                추가
                            </button>
                        </div>
                    </div>

                    {/* 빠른 범위 빌더 */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-gray-700">빠른 범위 선택</label>
                            <span className="text-[10px] text-gray-500">{draftStart ? `시작: ${draftStart}` : '시작을 선택하세요'}</span>
                        </div>
                        <div className="grid grid-cols-6 gap-1.5 max-h-[200px] overflow-auto">
                            {allSlots.map((slot) => (
                                <button
                                    key={slot}
                                    onClick={() => onQuickSlotClick(slot)}
                                    className={`h-9 text-xs rounded-lg border font-medium ${draftStart === slot
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
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
                            <label className="text-xs font-semibold text-gray-700 mb-2 block">선택된 시간</label>
                            <div className="flex flex-wrap gap-1.5">
                                {times.map((t) => (
                                    <div key={t} className="inline-flex items-center gap-1 px-2.5 h-8 bg-blue-100 text-blue-900 text-xs font-medium rounded-lg">
                                        {t}
                                        <button onClick={() => removeTime(t)} className="hover:text-red-600">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </SlideModal>
        </>
    );
};

// ─────────────────────────────────────────────────────────────
// 🎯 DATE 모듈 (커스텀 날짜 포함)
// ─────────────────────────────────────────────────────────────
const DateModule = ({ data, onChange, onRemove, isEditing }) => {
    const [showModal, setShowModal] = useState(false);
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
        <>
            <div
                onClick={() => isEditing && setShowModal(true)}
                className="inline-flex items-center gap-1 px-2.5 h-7 bg-purple-50 rounded-lg text-xs font-medium active:scale-95"
            >
                <Calendar className="w-3 h-3 text-purple-600" />
                <span className="text-purple-900">{dates.length > 0 ? dates.slice(0, 2).join(', ') + (dates.length > 2 ? '...' : '') : '날짜'}</span>
                {isEditing && (
                    <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-0.5">
                        <X className="w-3 h-3 text-purple-400" />
                    </button>
                )}
            </div>

            <SlideModal isOpen={showModal} onClose={() => setShowModal(false)} title="날짜 설정">
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-2 block">특정 날짜</label>
                        <input
                            type="date"
                            onChange={addCustomDate}
                            className="w-full px-3 h-10 text-sm bg-gray-50 rounded-xl border border-gray-200"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-2 block">프리셋</label>
                        <div className="flex flex-wrap gap-1.5">
                            {presets.map((preset) => (
                                <button
                                    key={preset}
                                    onClick={() => toggleDate(preset)}
                                    className={`px-3 h-8 text-xs font-medium rounded-lg ${dates.includes(preset) ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700'
                                        }`}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                    </div>

                    {dates.length > 0 && (
                        <div>
                            <label className="text-xs font-semibold text-gray-700 mb-2 block">선택된 날짜</label>
                            <div className="flex flex-wrap gap-1.5">
                                {dates.map((date) => (
                                    <div key={date} className="inline-flex items-center gap-1 px-2.5 h-8 bg-purple-100 text-purple-900 text-xs font-medium rounded-lg">
                                        {date}
                                        <button onClick={() => toggleDate(date)} className="hover:text-red-600">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </SlideModal>
        </>
    );
};

// ─────────────────────────────────────────────────────────────
// 🎯 나머지 간단한 모듈들
// ─────────────────────────────────────────────────────────────
const WeekdayModule = ({ data, onChange, onRemove, isEditing }) => {
    const [showModal, setShowModal] = useState(false);
    const weekdays = ['월', '화', '수', '목', '금', '토', '일', '평일', '주말', '매일'];
    const selected = data.days || [];

    const toggleDay = (day) => {
        const newDays = selected.includes(day) ? selected.filter((d) => d !== day) : [...selected, day];
        onChange({ days: newDays });
    };

    return (
        <>
            <div
                onClick={() => isEditing && setShowModal(true)}
                className="inline-flex items-center gap-1 px-2.5 h-7 bg-indigo-50 rounded-lg text-xs font-medium active:scale-95"
            >
                <Calendar className="w-3 h-3 text-indigo-600" />
                <span className="text-indigo-900">{selected.length > 0 ? selected.join(', ') : '요일'}</span>
                {isEditing && (
                    <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-0.5">
                        <X className="w-3 h-3 text-indigo-400" />
                    </button>
                )}
            </div>

            <SlideModal isOpen={showModal} onClose={() => setShowModal(false)} title="요일 선택" size="small">
                <div className="flex flex-wrap gap-2">
                    {weekdays.map((day) => (
                        <button
                            key={day}
                            onClick={() => toggleDay(day)}
                            className={`px-4 h-10 text-sm font-medium rounded-xl ${selected.includes(day) ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-700'
                                }`}
                        >
                            {day}
                        </button>
                    ))}
                </div>
            </SlideModal>
        </>
    );
};

const NumberModule = ({ data, onChange, onRemove, isEditing }) => {
    const [showModal, setShowModal] = useState(false);
    const units = ['원', '개', '명', '시간', '분', '일', '회', '%'];

    return (
        <>
            <div
                onClick={() => isEditing && setShowModal(true)}
                className="inline-flex items-center gap-1 px-2.5 h-7 bg-green-50 rounded-lg text-xs font-medium active:scale-95"
            >
                <Hash className="w-3 h-3 text-green-600" />
                <span className="text-green-900">{data.value || '0'}{data.unit || ''}</span>
                {isEditing && (
                    <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-0.5">
                        <X className="w-3 h-3 text-green-400" />
                    </button>
                )}
            </div>

            <SlideModal isOpen={showModal} onClose={() => setShowModal(false)} title="숫자 설정" size="small">
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-2 block">숫자</label>
                        <input
                            type="number"
                            value={data.value || ''}
                            onChange={(e) => onChange({ ...data, value: e.target.value })}
                            className="w-full px-3 h-10 text-sm bg-gray-50 rounded-xl border border-gray-200"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-2 block">단위</label>
                        <div className="flex flex-wrap gap-2">
                            {units.map((unit) => (
                                <button
                                    key={unit}
                                    onClick={() => onChange({ ...data, unit })}
                                    className={`px-4 h-9 text-sm font-medium rounded-lg ${data.unit === unit ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'
                                        }`}
                                >
                                    {unit}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </SlideModal>
        </>
    );
};

const TagModule = ({ data, onChange, onRemove, isEditing }) => {
    const [showModal, setShowModal] = useState(false);
    const selected = data.tags || [];

    const toggle = (tag) => {
        const next = selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag];
        onChange({ tags: next });
    };

    return (
        <>
            <div
                onClick={() => isEditing && setShowModal(true)}
                className="inline-flex items-center gap-1 px-2.5 h-7 bg-pink-50 rounded-lg text-xs font-medium active:scale-95"
            >
                <span className="text-pink-900">{selected.length > 0 ? selected.slice(0, 2).join(', ') + (selected.length > 2 ? '...' : '') : '태그'}</span>
                {isEditing && (
                    <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-0.5">
                        <X className="w-3 h-3 text-pink-400" />
                    </button>
                )}
            </div>

            <SlideModal isOpen={showModal} onClose={() => setShowModal(false)} title="태그 선택">
                <div className="flex flex-wrap gap-2">
                    {TAG_LIBRARY.map((tag) => (
                        <button
                            key={tag}
                            onClick={() => toggle(tag)}
                            className={`px-3 h-9 text-sm font-medium rounded-lg ${selected.includes(tag) ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700'
                                }`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </SlideModal>
        </>
    );
};

const EndingModule = ({ data, onChange, onRemove, isEditing }) => {
    const [showModal, setShowModal] = useState(false);
    const selected = data.selected || data.options?.[0] || '';

    return (
        <>
            <div
                onClick={() => isEditing && setShowModal(true)}
                className="inline-flex items-center gap-1 px-2.5 h-7 bg-amber-50 rounded-lg text-xs font-medium active:scale-95"
            >
                <span className="text-amber-900">{selected}</span>
                {isEditing && (
                    <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="ml-0.5">
                        <X className="w-3 h-3 text-amber-400" />
                    </button>
                )}
            </div>

            <SlideModal isOpen={showModal} onClose={() => setShowModal(false)} title="어미 선택" size="small">
                <div className="space-y-1">
                    {data.options.map((option) => (
                        <button
                            key={option}
                            onClick={() => {
                                onChange({ ...data, selected: option });
                                setShowModal(false);
                            }}
                            className={`w-full text-left px-4 h-11 text-sm rounded-xl ${selected === option ? 'bg-amber-100 font-semibold' : 'hover:bg-gray-50'
                                }`}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            </SlideModal>
        </>
    );
};

const TextChip = ({ data, onRemove, isEditing, onEdit, onSplitAtCaret }) => {
    const [isEditMode, setIsEditMode] = useState(false);
    const [editValue, setEditValue] = useState(data.text || '');
    const inputRef = useRef(null);

    useEffect(() => {
        if (isEditMode && inputRef.current) inputRef.current.focus();
    }, [isEditMode]);

    if (isEditMode && isEditing) {
        return (
            <div className="inline-flex items-center gap-1 bg-white rounded-lg px-2 h-7 border-2 border-blue-400">
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
                            const caret = e.currentTarget.selectionStart || 0;
                            onSplitAtCaret(caret);
                        }
                    }}
                    className="bg-transparent text-xs w-32 focus:outline-none"
                />
                <button
                    title="커서 위치에 삽입 (⌘+I)"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        const caret = inputRef.current?.selectionStart || 0;
                        onSplitAtCaret(caret);
                    }}
                    className="text-blue-500 p-0.5"
                >
                    <Scissors className="w-3 h-3" />
                </button>
            </div>
        );
    }

    return (
        <div
            onDoubleClick={() => isEditing && setIsEditMode(true)}
            className="inline-flex items-center gap-1 px-2.5 h-7 bg-white rounded-lg text-xs font-medium active:scale-95"
        >
            <span className="text-gray-900">{data.text}</span>
            {isEditing && (
                <button onClick={onRemove} className="ml-0.5">
                    <X className="w-3 h-3 text-gray-400" />
                </button>
            )}
        </div>
    );
};

const DraggableModule = ({ module, index, isEditing, onUpdate, onRemove, onRequestSplitInsert, draggedIndex, onDragStart, onDragOver, onDragEnd }) => {
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
        <div
            draggable={isEditing}
            onDragStart={() => onDragStart(index)}
            onDragOver={(e) => onDragOver(e, index)}
            onDragEnd={onDragEnd}
            className={`inline-flex items-center gap-1 ${draggedIndex === index ? 'opacity-50' : ''}`}
        >
            {isEditing && <GripVertical className="w-3.5 h-3.5 text-gray-400 cursor-move flex-shrink-0" />}
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

const moduleToText = (module) => {
    switch (module.type) {
        case MODULE_TYPES.WEEKDAY: return module.data.days?.join(', ') || '';
        case MODULE_TYPES.TIME: return module.data.times?.join(', ') || '';
        case MODULE_TYPES.DATE: return module.data.dates?.join(', ') || '';
        case MODULE_TYPES.NUMBER: return `${module.data.value || '0'}${module.data.unit || ''}`;
        case MODULE_TYPES.ENDING: return module.data.selected || module.data.options?.[0] || '';
        case MODULE_TYPES.SYMBOL:
        case MODULE_TYPES.TEXT: return module.data.text || '';
        case MODULE_TYPES.TAG: return module.data.tags?.join(', ') || '';
        default: return '';
    }
};

const modulesToPlain = (mods) => mods.map(moduleToText).join(' ');

const InsertPoint = ({ onClick }) => (
    <button
        onClick={onClick}
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border border-dashed border-gray-300 text-gray-400 hover:text-blue-600 hover:border-blue-300 active:scale-95"
    >
        <Plus className="w-3 h-3" />
    </button>
);

// ─────────────────────────────────────────────────────────────
// 🎯 플로팅 툴바
// ─────────────────────────────────────────────────────────────
const FloatingToolbar = ({ onAddModule, onShowPresets, onShowMeta, onShowReorder }) => {
    const [expanded, setExpanded] = useState(false);

    const quickModules = [
        { type: MODULE_TYPES.TEXT, icon: '📝', label: '텍스트' },
        { type: MODULE_TYPES.TIME, icon: '⏰', label: '시간' },
        { type: MODULE_TYPES.WEEKDAY, icon: '📅', label: '요일' },
        { type: MODULE_TYPES.NUMBER, icon: '#️⃣', label: '숫자' },
    ];

    const moreModules = [
        { type: MODULE_TYPES.DATE, icon: '🗓', label: '날짜' },
        { type: MODULE_TYPES.TAG, icon: '🏷️', label: '태그' },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-50">
            {expanded && (
                <div className="p-3 border-t border-gray-100 bg-gray-50">
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        {moreModules.map((mod) => (
                            <button
                                key={mod.type}
                                onClick={() => {
                                    onAddModule(mod.type);
                                    setExpanded(false);
                                }}
                                className="flex flex-col items-center justify-center h-16 bg-white rounded-xl shadow-sm active:scale-95"
                            >
                                <span className="text-xl mb-1">{mod.icon}</span>
                                <span className="text-[10px] text-gray-600">{mod.label}</span>
                            </button>
                        ))}
                        <button
                            onClick={() => {
                                onShowPresets();
                                setExpanded(false);
                            }}
                            className="flex flex-col items-center justify-center h-16 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-sm active:scale-95"
                        >
                            <Sparkles className="w-5 h-5 text-purple-600 mb-1" />
                            <span className="text-[10px] text-purple-600 font-semibold">프리셋</span>
                        </button>
                        <button
                            onClick={() => {
                                onShowReorder();
                                setExpanded(false);
                            }}
                            className="flex flex-col items-center justify-center h-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm active:scale-95"
                        >
                            <ArrowUpDown className="w-5 h-5 text-blue-600 mb-1" />
                            <span className="text-[10px] text-blue-600 font-semibold">순서변경</span>
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        {SYMBOLS.map((symbol) => (
                            <button
                                key={symbol}
                                onClick={() => {
                                    onAddModule(MODULE_TYPES.SYMBOL, { text: symbol });
                                }}
                                className="w-9 h-9 bg-white rounded-lg text-sm font-bold text-gray-700 active:bg-gray-100"
                            >
                                {symbol}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="p-2 flex items-center gap-2">
                {quickModules.map((mod) => (
                    <button
                        key={mod.type}
                        onClick={() => onAddModule(mod.type)}
                        className="flex-1 flex flex-col items-center justify-center h-12 bg-gray-50 rounded-xl active:scale-95"
                    >
                        <span className="text-base">{mod.icon}</span>
                        <span className="text-[9px] text-gray-600 mt-0.5">{mod.label}</span>
                    </button>
                ))}

                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex-1 flex flex-col items-center justify-center h-12 bg-blue-50 rounded-xl active:scale-95"
                >
                    {expanded ? <ChevronDown className="w-5 h-5 text-blue-600" /> : <ChevronUp className="w-5 h-5 text-blue-600" />}
                    <span className="text-[9px] text-blue-600 font-semibold mt-0.5">더보기</span>
                </button>

                <button
                    onClick={onShowMeta}
                    className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-xl active:scale-95"
                >
                    <Settings className="w-5 h-5 text-gray-600" />
                </button>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────
// 🎯 메인 컴포넌트
// ─────────────────────────────────────────────────────────────
export default function ModularFAQBuilderV2({ onComplete, onCancel }) {
    const [mainCategory, setMainCategory] = useState('facility');
    const [questionModules, setQuestionModules] = useState([]);
    const [answerModules, setAnswerModules] = useState([]);
    const [currentMode, setCurrentMode] = useState('question');
    const [showPresetModal, setShowPresetModal] = useState(false);
    const [showMetaModal, setShowMetaModal] = useState(false);
    const [showReorderModal, setShowReorderModal] = useState(false);
    const [insertIndex, setInsertIndex] = useState(null);
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [keydataPresets, setKeydataPresets] = useState([]);

    const [meta, setMeta] = useState({
        staffHandoff: '필요없음',
        guide: '',
        keyData: '',
        tags: [],
    });

    // KeyData 프리셋 로딩
    useEffect(() => {
        const u = new URLSearchParams(window.location.search);
        const tenant = u.get('tenant');
        if (!tenant) return;
        (async () => {
            try {
                const r = await fetch(`/api/keydata?tenant=${tenant}`);
                if (!r.ok) return;
                const list = await r.json();
                setKeydataPresets(Array.isArray(list) ? list : []);
            } catch (_) { }
        })();
    }, []);

    const currentCategoryData = MAIN_CATEGORIES[mainCategory];
    const getMods = () => (currentMode === 'question' ? questionModules : answerModules);
    const setMods = (mods) => (currentMode === 'question' ? setQuestionModules(mods) : setAnswerModules(mods));

    const addModule = (type, data = {}) => {
        const defaults = {
            [MODULE_TYPES.WEEKDAY]: { days: [] },
            [MODULE_TYPES.TIME]: { times: [] },
            [MODULE_TYPES.DATE]: { dates: [] },
            [MODULE_TYPES.NUMBER]: { value: '', unit: '' },
            [MODULE_TYPES.TAG]: { tags: [] },
            [MODULE_TYPES.TEXT]: { text: '' },
            [MODULE_TYPES.SYMBOL]: { text: data.text || '' },
        };

        const module = {
            id: Date.now() + Math.random(),
            type,
            data: { ...defaults[type], ...data }
        };

        const mods = getMods();
        let next = [];
        if (insertIndex === null || insertIndex === undefined) {
            next = [...mods, module];
        } else {
            next = [...mods.slice(0, insertIndex), module, ...mods.slice(insertIndex)];
            setInsertIndex(insertIndex + 1);
        }
        setMods(next);
    };

    const updateModule = (index, newData) => {
        const mods = [...getMods()];
        mods[index] = { ...mods[index], data: newData };
        setMods(mods);
    };

    const removeModule = (index) => {
        setMods(getMods().filter((_, i) => i !== index));
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
        const mods = [...getMods()];
        const node = mods[index];
        const text = String(node?.data?.text || '');
        const left = text.slice(0, caret);
        const right = text.slice(caret);
        const leftNode = { ...node, id: Date.now() + Math.random(), data: { text: left } };
        const rightNode = { ...node, id: Date.now() + Math.random(), data: { text: right } };
        const next = [...mods.slice(0, index), leftNode, rightNode, ...mods.slice(index + 1)];
        setMods(next);
        setInsertIndex(index + 1);
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
            category: mainCategory,
            staffHandoff: meta.staffHandoff,
            guide: meta.guide,
            keyData: meta.tags?.length
                ? `${meta.keyData ? meta.keyData + '\n' : ''}tags: ${meta.tags.join(', ')}`
                : meta.keyData,
            tags: meta.tags,
        });
    };

    const applyPreset = (preset) => {
        if (preset.qMods || preset.aMods) {
            if (preset.qMods) setQuestionModules([...questionModules, ...preset.qMods.map((m) => ({ id: Date.now() + Math.random(), ...m }))]);
            if (preset.aMods) setAnswerModules([...answerModules, ...preset.aMods.map((m) => ({ id: Date.now() + Math.random(), ...m }))]);
        } else {
            setQuestionModules([...questionModules, { id: Date.now(), type: MODULE_TYPES.TEXT, data: { text: preset.q } }]);
            setAnswerModules([...answerModules, { id: Date.now() + 1, type: MODULE_TYPES.TEXT, data: { text: preset.a } }]);
        }
        setShowPresetModal(false);
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
            {/* 헤더 */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
                <button onClick={onCancel} className="text-sm text-gray-600">취소</button>
                <h1 className="font-bold text-base">FAQ 작성</h1>
                <button onClick={handleComplete} className="text-sm text-blue-600 font-semibold">완료</button>
            </div>

            {/* 스크롤 영역 */}
            <div className="flex-1 overflow-auto pb-24">
                {/* 카테고리 */}
                <div className="bg-white p-3 border-b border-gray-100 sticky top-0 z-30">
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                        {Object.entries(MAIN_CATEGORIES).map(([key, data]) => (
                            <button
                                key={key}
                                onClick={() => setMainCategory(key)}
                                className={`flex-shrink-0 px-3 h-8 text-xs font-semibold rounded-full whitespace-nowrap ${mainCategory === key ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-100 text-gray-700'
                                    }`}
                            >
                                {data.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 탭 */}
                <div className="bg-white border-b border-gray-100 px-4 py-2 flex gap-2 sticky top-[52px] z-30">
                    <button
                        onClick={() => setCurrentMode('question')}
                        className={`flex-1 h-9 rounded-xl text-sm font-semibold ${currentMode === 'question' ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-100 text-gray-700'
                            }`}
                    >
                        질문 {questionModules.length > 0 && `(${questionModules.length})`}
                    </button>
                    <button
                        onClick={() => setCurrentMode('answer')}
                        className={`flex-1 h-9 rounded-xl text-sm font-semibold ${currentMode === 'answer' ? 'bg-green-500 text-white shadow-md' : 'bg-gray-100 text-gray-700'
                            }`}
                    >
                        답변 {answerModules.length > 0 && `(${answerModules.length})`}
                    </button>
                    <button
                        onClick={textify}
                        className="px-3 h-9 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 whitespace-nowrap"
                    >
                        텍스트로
                    </button>
                </div>

                {/* 작성 영역 */}
                <div className="p-4">
                    <div className="bg-white rounded-2xl p-4 shadow-sm min-h-[200px]">
                        <div className="flex flex-wrap gap-2">
                            <InsertPoint onClick={() => setInsertIndex(0)} />
                            {getMods().length > 0 ? (
                                getMods().map((module, index) => (
                                    <React.Fragment key={module.id}>
                                        <DraggableModule
                                            module={module}
                                            index={index}
                                            isEditing={true}
                                            onUpdate={updateModule}
                                            onRemove={removeModule}
                                            onRequestSplitInsert={onRequestSplitInsert}
                                            draggedIndex={draggedIndex}
                                            onDragStart={handleDragStart}
                                            onDragOver={handleDragOver}
                                            onDragEnd={handleDragEnd}
                                        />
                                        <InsertPoint onClick={() => setInsertIndex(index + 1)} />
                                    </React.Fragment>
                                ))
                            ) : (
                                <div className="w-full text-center py-12">
                                    <p className="text-gray-400 text-sm mb-2">
                                        {currentMode === 'question' ? '질문을 만들어보세요' : '답변을 만들어보세요'}
                                    </p>
                                    <p className="text-gray-400 text-xs">아래 버튼을 눌러 모듈을 추가하세요</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 키워드 */}
                    <div className="mt-4">
                        <div className="text-xs font-semibold text-gray-600 mb-2 px-1">키워드 빠른 추가</div>
                        <div className="flex flex-wrap gap-1.5">
                            {currentCategoryData.keywords.slice(0, 12).map((keyword) => (
                                <button
                                    key={keyword}
                                    onClick={() => addModule(MODULE_TYPES.TEXT, { text: keyword })}
                                    className="px-3 h-7 bg-white rounded-full text-xs text-gray-700 shadow-sm active:scale-95"
                                >
                                    {keyword}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 어미 */}
                    <div className="mt-4">
                        <div className="text-xs font-semibold text-gray-600 mb-2 px-1">어미</div>
                        <div className="flex flex-wrap gap-1.5">
                            {ENDING_GROUPS.map((group, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => addModule(MODULE_TYPES.ENDING, { options: group, selected: group[0] })}
                                    className="px-3 h-7 bg-white rounded-full text-xs text-gray-700 shadow-sm active:scale-95"
                                >
                                    {group[0]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 플로팅 툴바 */}
            <FloatingToolbar
                onAddModule={addModule}
                onShowPresets={() => setShowPresetModal(true)}
                onShowMeta={() => setShowMetaModal(true)}
                onShowReorder={() => setShowReorderModal(true)}
            />

            {/* 프리셋 모달 */}
            <SlideModal isOpen={showPresetModal} onClose={() => setShowPresetModal(false)} title="프리셋">
                <div className="space-y-2">
                    {currentCategoryData.presets.map((preset, idx) => (
                        <button
                            key={idx}
                            onClick={() => applyPreset(preset)}
                            className="w-full text-left bg-gray-50 rounded-xl p-3 active:bg-gray-100"
                        >
                            <div className="font-semibold text-sm text-gray-900 mb-1">{preset.q}</div>
                            <div className="text-xs text-gray-600">{preset.a}</div>
                        </button>
                    ))}
                </div>
            </SlideModal>

            {/* 메타 모달 */}
            <SlideModal isOpen={showMetaModal} onClose={() => setShowMetaModal(false)} title="추가 설정">
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-2 block">담당자 전달</label>
                        <div className="flex gap-2">
                            {['필요없음', '필요'].map((op) => (
                                <button
                                    key={op}
                                    onClick={() => setMeta((m) => ({ ...m, staffHandoff: op }))}
                                    className={`flex-1 h-10 rounded-xl text-sm font-semibold ${meta.staffHandoff === op ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                                        }`}
                                >
                                    {op}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-2 block">가이드</label>
                        <textarea
                            value={meta.guide}
                            onChange={(e) => setMeta((m) => ({ ...m, guide: e.target.value }))}
                            placeholder="답변시 참고사항"
                            className="w-full min-h-[80px] px-3 py-2 text-sm bg-gray-50 rounded-xl border border-gray-200 resize-none"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-2 block">키데이터</label>
                        {keydataPresets.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {keydataPresets.slice(0, 20).map((p) => (
                                    <button
                                        key={`${p.key}:${p.value}`}
                                        onClick={() =>
                                            setMeta((m) => ({
                                                ...m,
                                                keyData: (m.keyData ? m.keyData + '\n' : '') + `${p.key}: ${p.value}`,
                                            }))
                                        }
                                        className="px-2.5 h-7 text-xs rounded-lg bg-gray-100 active:bg-gray-200"
                                    >
                                        {p.key}
                                    </button>
                                ))}
                            </div>
                        )}
                        <textarea
                            value={meta.keyData}
                            onChange={(e) => setMeta((m) => ({ ...m, keyData: e.target.value }))}
                            placeholder="영업비밀이나 내부 기준"
                            className="w-full min-h-[80px] px-3 py-2 text-sm bg-gray-50 rounded-xl border border-gray-200 resize-none"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-2 block">태그</label>
                        <TagsInput
                            value={meta.tags}
                            onChange={(tags) => setMeta((m) => ({ ...m, tags }))}
                        />
                    </div>
                </div>
            </SlideModal>

            {/* 순서변경 모달 */}
            <SlideModal isOpen={showReorderModal} onClose={() => setShowReorderModal(false)} title="순서 변경">
                <div className="space-y-2">
                    {getMods().map((module, index) => (
                        <div
                            key={module.id}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl active:bg-gray-100"
                        >
                            <GripVertical className="w-5 h-5 text-gray-400" />
                            <span className="text-sm">{moduleToText(module)}</span>
                        </div>
                    ))}
                </div>
            </SlideModal>

            <style jsx>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.3s ease-out;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .safe-area-bottom {
                    padding-bottom: env(safe-area-inset-bottom);
                }
            `}</style>
        </div>
    );
}