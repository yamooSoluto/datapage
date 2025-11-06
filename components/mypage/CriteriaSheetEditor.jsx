// components/mypage/CriteriaSheetEditor.jsx
// 풍부한 기본 옵션 + 계층형 옵션 구조 지원

import React from "react";
import { X, Type, Clock, Calendar, ChevronDown, ChevronRight } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// 1) 유틸 & 데이터
// ═══════════════════════════════════════════════════════════

const pack = (arr) => Array.isArray(arr) ? arr.join(" / ") : "";
const unpack = (str) => String(str || "").split(" / ").filter(Boolean);

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

// 계층형 옵션 구조
const SHEET_TEMPLATES = {
    facility: {
        id: "facility",
        title: "시설/비품",
        icon: "🏢",
        facets: [
            {
                key: "existence",
                label: "존재",
                type: "multi",
                options: ["있음", "없음"]
            },
            {
                key: "cost",
                label: "비용",
                type: "multi",
                options: [
                    "무료",
                    "회원 무료",
                    {
                        group: "유료",
                        items: [
                            "1회 500원",
                            "1회 1,000원",
                            "1회 2,000원",
                            "1회 3,000원",
                            "시간당 1,000원",
                            "시간당 2,000원"
                        ]
                    },
                    "별도 요금",
                    "비회원 유료"
                ]
            },
            {
                key: "location",
                label: "위치",
                type: "multi",
                options: [
                    { group: "층별", items: ["1층", "2층", "3층", "4층", "5층", "지하 1층"] },
                    { group: "구역", items: ["1층 로비", "2층 중앙", "입구 옆", "복도 끝", "계단 옆", "엘리베이터 옆"] },
                    { group: "공간", items: ["카페존", "포커스존", "휴게실", "라운지"] },
                    "각 층마다"
                ]
            },
            {
                key: "usage",
                label: "이용",
                type: "multi",
                options: [
                    "자유 이용",
                    "예약 필요",
                    "회원 전용",
                    "시간제 이용",
                    "제한 없음",
                    "특정 시간만 가능"
                ]
            },
            {
                key: "eating",
                label: "취식허용",
                type: "multi",
                options: [
                    "음료 포함",
                    "음료만",
                    "텀블러 및 뚜껑 있는 음료만",
                    { group: "간식", items: ["초콜릿 사탕류", "간단한 간식류", "냄새없는 음식류"] },
                    "배달 및 외부음식",
                    "모든 음식"
                ]
            },
            {
                key: "noise",
                label: "소음허용",
                type: "multi",
                options: [
                    "타이핑",
                    "계산기",
                    "이어폰 사용",
                    "영상 시청",
                    { group: "대화", items: ["속삭임", "일반 대화", "자유로운 대화"] },
                    "통화",
                    "화상회의"
                ]
            },
        ],
    },
    room: {
        id: "room",
        title: "룸/존",
        icon: "🚪",
        facets: [
            { key: "existence", label: "존재", type: "multi", options: ["있음", "없음"] },
            {
                key: "capacity",
                label: "정원",
                type: "multi",
                options: [
                    { group: "소규모", items: ["1인", "2인", "3인", "4인"] },
                    { group: "중규모", items: ["5인", "6인", "8인"] },
                    { group: "대규모", items: ["10인", "12인", "15인", "20인+"] }
                ]
            },
            {
                key: "cost",
                label: "비용",
                type: "multi",
                options: [
                    "무료",
                    {
                        group: "시간당",
                        items: [
                            "시간당 3,000원",
                            "시간당 5,000원",
                            "시간당 8,000원",
                            "시간당 10,000원",
                            "시간당 15,000원"
                        ]
                    },
                    {
                        group: "종일",
                        items: [
                            "종일 20,000원",
                            "종일 30,000원",
                            "종일 50,000원"
                        ]
                    },
                    "회원 유료",
                    "비회원 유료"
                ]
            },
            {
                key: "booking",
                label: "예약",
                type: "multi",
                options: [
                    "필요",
                    "선착순",
                    "외부예약불가",
                    { group: "예약 방법", items: ["앱 예약", "전화 예약", "현장 예약", "웹사이트 예약"] }
                ]
            },
            {
                key: "eating",
                label: "취식허용",
                type: "multi",
                options: ["음료만", "간식류", "식사류", "식사류 불가"]
            },
            {
                key: "noise",
                label: "소음허용",
                type: "multi",
                options: ["타이핑", "대화", "통화", "회의가능", "조용히"]
            },
        ]
    },
    product: {
        id: "product",
        title: "상품/서비스",
        icon: "🎫",
        facets: [
            {
                key: "types",
                label: "종류",
                type: "multi",
                options: [
                    { group: "이용권", items: ["정기권", "충전권", "1회권"] },
                    { group: "시간제", items: ["야간권", "주말권", "평일권"] },
                    { group: "구독", items: ["월 구독", "분기 구독", "연 구독"] },
                    { group: "좌석", items: ["자유석", "지정석", "1인실", "다인실"] }
                ]
            },
            {
                key: "price",
                label: "가격",
                type: "multi",
                options: [
                    "가격표 참조",
                    { group: "시간제", items: ["시간당 2,000원", "시간당 3,000원", "4시간 10,000원"] },
                    { group: "종일제", items: ["종일 10,000원", "종일 15,000원", "종일 20,000원"] },
                    { group: "월 정기", items: ["월 80,000원", "월 100,000원", "월 150,000원", "월 200,000원"] },
                    "할인",
                    "프로모션"
                ]
            },
            {
                key: "refund",
                label: "환불",
                type: "multi",
                options: [
                    "가능",
                    { group: "조건부", items: ["사용일수 제외", "위약금 10%", "위약금 20%", "3일 전까지 무료"] },
                    "불가",
                    "부분 환불"
                ]
            },
            {
                key: "duration",
                label: "유효기간",
                type: "multi",
                options: [
                    { group: "단기", items: ["1주일", "2주일"] },
                    { group: "월 단위", items: ["1개월", "2개월", "3개월", "6개월"] },
                    { group: "장기", items: ["1년", "2년"] },
                    "무제한"
                ]
            },
        ]
    },
    rules: {
        id: "rules",
        title: "규정",
        icon: "📋",
        facets: [
            {
                key: "age",
                label: "연령규정",
                type: "multi",
                options: [
                    "무관",
                    "만 14세 이상",
                    "만 19세 이상",
                    "고등학생 이상",
                    "대학생 이상",
                    "성인만",
                    "중고생 가능",
                    "초등생 불가",
                    "보호자 동반"
                ]
            },
            {
                key: "gender",
                label: "성별규정",
                type: "multi",
                options: ["무관", "여성전용구역 있음", "남녀 분리", "여성 전용"]
            },
            {
                key: "smoking",
                label: "흡연규정",
                type: "multi",
                options: [
                    "금연",
                    "흡연실 있음",
                    { group: "외부 흡연", items: ["층 외부 흡연구역", "건물 외부만 가능", "지정 구역만"] },
                    "전자담배 가능"
                ]
            },
            {
                key: "outdoor",
                label: "외출규정",
                type: "multi",
                options: [
                    "자유 재입장",
                    "당일 재입장 무료",
                    { group: "시간 제한", items: ["30분 이내 무료", "1시간 이내 무료", "2시간 이내 무료"] },
                    "외출 가능",
                    "외출 불가",
                    "외출 1회 제한",
                    "재입장 불가",
                    "재입장 시 추가 요금",
                    { group: "좌석", items: ["자리 보장", "자리 미보장"] },
                    "사물함 보관 필수"
                ]
            },
            {
                key: "lostFound",
                label: "분실물",
                type: "multi",
                options: [
                    "직접보관 없음",
                    "보관함 있음",
                    { group: "보관 기간", items: ["3일 보관", "7일 보관 후 폐기", "14일 보관", "1개월 보관"] },
                    "경찰서 이관"
                ]
            },
            {
                key: "hours",
                label: "운영시간",
                type: "multi",
                options: [
                    "24시간",
                    { group: "평일", items: ["평일 06:00~24:00", "평일 07:00~23:00", "평일 08:00~22:00", "평일 09:00~22:00"] },
                    { group: "주말", items: ["주말 08:00~22:00", "주말 09:00~21:00", "주말 10:00~20:00"] },
                    "평일만 운영",
                    "주말만 운영",
                    "공휴일 휴무",
                    "명절 휴무"
                ]
            },
            {
                key: "datePolicy",
                label: "특정일",
                type: "multi",
                options: [
                    { group: "요일", items: ["월", "화", "수", "목", "금", "토", "일"] },
                    "평일",
                    "주말",
                    "공휴일",
                    "명절",
                    { group: "특정 명절", items: ["설날", "추석", "크리스마스"] },
                    "연중무휴"
                ]
            },
        ]
    }
};

// ═══════════════════════════════════════════════════════════
// 2) 인라인 드롭다운 컴포넌트
// ═══════════════════════════════════════════════════════════

function InlineDropdown({
    cellRef,
    facet,
    value,
    onChange,
    onClose,
    customOptions,
    onDeleteCustomOption
}) {
    const [selected, setSelected] = React.useState(unpack(value));
    const [inputMode, setInputMode] = React.useState(null);
    const [expandedGroups, setExpandedGroups] = React.useState(new Set());

    // 텍스트 입력
    const [textInput, setTextInput] = React.useState("");

    // 시간 입력
    const [times, setTimes] = React.useState([]);
    const [startInput, setStartInput] = React.useState("09:00");
    const [endInput, setEndInput] = React.useState("");
    const [draftStart, setDraftStart] = React.useState(null);

    // 날짜 입력
    const [dates, setDates] = React.useState([]);
    const [customDate, setCustomDate] = React.useState("");

    const dropdownRef = React.useRef(null);

    // 옵션을 평탄화 (그룹 포함)
    const flatOptions = React.useMemo(() => {
        const flatten = (opts) => {
            const result = [];
            opts.forEach(opt => {
                if (typeof opt === 'string') {
                    result.push(opt);
                } else if (opt.group) {
                    result.push(...opt.items);
                }
            });
            return result;
        };

        const base = facet.options || [];
        const custom = customOptions || [];
        const baseFlat = flatten(base);

        // 커스텀 옵션 중 기본 옵션에 없는 것만
        const uniqueCustom = custom.filter(opt => !baseFlat.includes(opt));

        return [...new Set([...baseFlat, ...uniqueCustom])];
    }, [facet.options, customOptions]);

    // 위치 계산
    const [position, setPosition] = React.useState({ top: 0, left: 0 });

    React.useEffect(() => {
        if (!cellRef.current || !dropdownRef.current) return;

        const updatePosition = () => {
            const cellRect = cellRef.current.getBoundingClientRect();
            const dropdownHeight = 500;
            const dropdownWidth = 320;
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const padding = 8;

            let left = cellRect.right + padding;
            if (left + dropdownWidth > viewportWidth - padding) {
                left = cellRect.left - dropdownWidth - padding;
            }
            left = Math.max(padding, Math.min(left, viewportWidth - dropdownWidth - padding));

            let top = cellRect.top;
            const spaceBelow = viewportHeight - cellRect.bottom;
            const spaceAbove = cellRect.top;

            if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
                top = Math.max(padding, cellRect.top - dropdownHeight);
            } else {
                top = Math.min(cellRect.top, viewportHeight - dropdownHeight - padding);
                top = Math.max(padding, top);
            }

            setPosition({ top, left });
        };

        updatePosition();

        const handleScroll = () => updatePosition();
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);

        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [cellRef]);

    // 외부 클릭 감지
    React.useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
                cellRef.current && !cellRef.current.contains(e.target)) {
                onChange(pack(selected));
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selected, onChange, onClose, cellRef]);

    const toggleOption = (opt) => {
        setSelected(prev =>
            prev.includes(opt) ? prev.filter(v => v !== opt) : [...prev, opt]
        );
    };

    const toggleGroup = (groupName) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupName)) {
                next.delete(groupName);
            } else {
                next.add(groupName);
            }
            return next;
        });
    };

    // 텍스트 입력 추가
    const addTextInput = () => {
        const text = textInput.trim();
        if (!text) return;
        setSelected(prev => [...new Set([...prev, text])]);
        setTextInput("");
        setInputMode(null);
    };

    // 시간 관련
    const quickRanges = [
        "24시간", "오전", "오후", "심야",
        "09:00~18:00", "10:00~22:00", "00:00~06:00"
    ];

    const allSlots = React.useMemo(() => {
        const slots = [];
        for (let h = 0; h < 24; h++) {
            slots.push(`${pad2(h)}:00`);
            slots.push(`${pad2(h)}:30`);
        }
        return slots;
    }, []);

    const addTimeToken = (token) => {
        const norm = normalizeHM(token);
        if (norm && !times.includes(norm)) {
            setTimes([...times, norm]);
        } else if (!times.includes(token)) {
            setTimes([...times, token]);
        }
    };

    const onClickAddTime = () => {
        const s = normalizeHM(startInput);
        if (!s) return;
        const e = normalizeHM(endInput);
        const label = e ? `${s}~${e}` : s;
        if (!times.includes(label)) setTimes([...times, label]);
        setStartInput("09:00");
        setEndInput("");
    };

    const onQuickSlotClick = (slot) => {
        if (!draftStart) {
            setDraftStart(slot);
        } else {
            const s = draftStart;
            const e = slot;
            const label = `${s}~${e}`;
            if (!times.includes(label)) setTimes([...times, label]);
            setDraftStart(null);
        }
    };

    const removeTime = (t) => {
        setTimes(times.filter(x => x !== t));
    };

    const commitTimes = () => {
        if (times.length === 0) {
            setInputMode(null);
            return;
        }
        const combined = times.join(" / ");
        setSelected(prev => [...new Set([...prev, combined])]);
        setTimes([]);
        setInputMode(null);
    };

    // 날짜 관련
    const datePresets = [
        "월", "화", "수", "목", "금", "토", "일",
        "평일", "주말", "매일", "공휴일", "명절", "설날", "추석", "연중무휴"
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

    const commitDates = () => {
        if (dates.length === 0) {
            setInputMode(null);
            return;
        }
        const combined = dates.join(" / ");
        setSelected(prev => [...new Set([...prev, combined])]);
        setDates([]);
        setInputMode(null);
    };

    // 옵션 렌더링 (계층형 구조 지원)
    const renderOptions = () => {
        const options = facet.options || [];
        const customOpts = customOptions || [];
        const baseFlat = [];

        // 기본 옵션에서 평탄화된 목록 추출
        options.forEach(opt => {
            if (typeof opt === 'string') {
                baseFlat.push(opt);
            } else if (opt.group) {
                baseFlat.push(...opt.items);
            }
        });

        // 커스텀 옵션 중 기본 옵션에 없는 것만
        const uniqueCustom = customOpts.filter(opt => !baseFlat.includes(opt));

        return (
            <>
                {/* 기본 옵션 (계층형) */}
                {options.map((opt, idx) => {
                    if (typeof opt === 'string') {
                        // 단순 옵션
                        return (
                            <div key={idx} className="relative group">
                                <button
                                    onClick={() => toggleOption(opt)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${selected.includes(opt)
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {opt}
                                </button>
                                {onDeleteCustomOption && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`"${opt}" 옵션을 삭제하시겠습니까?\n(기본 옵션도 삭제 가능합니다)`)) {
                                                onDeleteCustomOption(opt);
                                                setSelected(prev => prev.filter(v => v !== opt));
                                            }
                                        }}
                                        className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px]"
                                        title="기본 옵션 삭제"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        );
                    } else if (opt.group) {
                        // 그룹 옵션 - 삭제되지 않은 아이템만
                        const remainingItems = opt.items.filter(item => {
                            // 커스텀 옵션에서 명시적으로 삭제 표시된 것 제외
                            // (커스텀 옵션에 없거나, 있어도 원래 기본 옵션이었던 것만)
                            const isInCustom = customOpts.includes(item);
                            const isInBase = opt.items.includes(item);
                            // 기본 옵션이면서 커스텀에 없으면 살아있음
                            return isInBase && !isInCustom;
                        });

                        if (remainingItems.length === 0) return null; // 빈 그룹은 표시 안 함

                        const isExpanded = expandedGroups.has(opt.group);
                        return (
                            <div key={idx} className="w-full">
                                <div className="relative group">
                                    <button
                                        onClick={() => toggleGroup(opt.group)}
                                        className="w-full flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-200 text-gray-800 hover:bg-gray-300 transition-all"
                                    >
                                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                        {opt.group} ({remainingItems.length})
                                    </button>
                                    {onDeleteCustomOption && remainingItems.length > 0 && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm(`"${opt.group}" 그룹 전체를 삭제하시겠습니까?\n(${remainingItems.length}개 옵션)`)) {
                                                    console.log('그룹 삭제:', remainingItems);
                                                    // 그룹의 모든 아이템을 커스텀 삭제 목록에 추가
                                                    remainingItems.forEach(item => {
                                                        onDeleteCustomOption(item);
                                                    });
                                                    setSelected(prev => prev.filter(v => !remainingItems.includes(v)));
                                                }
                                            }}
                                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] z-10"
                                            title="그룹 전체 삭제"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                                {isExpanded && (
                                    <div className="mt-1.5 ml-3 flex flex-wrap gap-1.5 border-l-2 border-gray-200 pl-2">
                                        {remainingItems.map(item => (
                                            <div key={item} className="relative group">
                                                <button
                                                    onClick={() => toggleOption(item)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${selected.includes(item)
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {item}
                                                </button>
                                                {onDeleteCustomOption && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (confirm(`"${item}" 옵션을 삭제하시겠습니까?`)) {
                                                                onDeleteCustomOption(item);
                                                                setSelected(prev => prev.filter(v => v !== item));
                                                            }
                                                        }}
                                                        className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px]"
                                                        title="그룹 옵션 삭제"
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    }
                })}

                {/* 커스텀 옵션 - 기본 옵션에 없는 것만 */}
                {uniqueCustom.length > 0 && (
                    <>
                        <div className="w-full border-t border-gray-300 my-2"></div>
                        <div className="w-full text-[10px] font-semibold text-gray-500 mb-1">커스텀 ({uniqueCustom.length})</div>
                        {uniqueCustom.map(opt => (
                            <div key={opt} className="relative group">
                                <button
                                    onClick={() => toggleOption(opt)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${selected.includes(opt)
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {opt}
                                </button>
                                {onDeleteCustomOption && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`"${opt}" 커스텀 옵션을 삭제하시겠습니까?`)) {
                                                onDeleteCustomOption(opt);
                                                setSelected(prev => prev.filter(v => v !== opt));
                                            }
                                        }}
                                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px]"
                                        title="커스텀 옵션 삭제"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}
                    </>
                )}
            </>
        );
    };

    return (
        <div
            ref={dropdownRef}
            className="fixed bg-white rounded-xl shadow-2xl border-2 border-gray-200 w-80 flex flex-col z-50 overflow-hidden"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                maxHeight: 'min(600px, calc(100vh - 80px))',
            }}
        >
            {/* 헤더 */}
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between flex-shrink-0">
                <div className="font-semibold text-sm">{facet.label}</div>
                <button
                    onClick={() => { onChange(pack(selected)); onClose(); }}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                >
                    완료
                </button>
            </div>

            {/* 바디 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

                {/* 기본 모드 */}
                {!inputMode && (
                    <>
                        {/* 입력 타입 버튼 */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setInputMode('text')}
                                className="flex-1 h-8 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium bg-slate-600 text-white hover:bg-slate-700 transition-all"
                            >
                                <Type className="w-3.5 h-3.5" />
                                텍스트
                            </button>
                            <button
                                onClick={() => setInputMode('time')}
                                className="w-9 h-8 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all"
                                title="시간"
                            >
                                <Clock className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setInputMode('date')}
                                className="w-9 h-8 rounded-lg flex items-center justify-center bg-purple-100 text-purple-600 hover:bg-purple-200 transition-all"
                                title="날짜"
                            >
                                <Calendar className="w-4 h-4" />
                            </button>
                        </div>

                        {/* 선택된 값들 */}
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
                                            <span>{val}</span>
                                            <X className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 옵션들 (계층형) */}
                        <div className="space-y-2 pt-2 border-t">
                            <div className="text-xs font-semibold text-gray-500">옵션</div>
                            <div className="flex flex-wrap gap-1.5">
                                {renderOptions()}
                            </div>
                        </div>
                    </>
                )}

                {/* 텍스트 입력 모드 */}
                {inputMode === 'text' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium text-sm">직접 입력</h3>
                            <button onClick={() => setInputMode(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <textarea
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            placeholder="내용을 입력하세요"
                            className="w-full px-3 py-2 rounded-lg border text-sm min-h-[80px]"
                            autoFocus
                        />

                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setInputMode(null)}
                                className="h-9 px-4 rounded-lg border bg-white hover:bg-gray-50 text-sm"
                            >
                                취소
                            </button>
                            <button
                                onClick={addTextInput}
                                className="h-9 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                )}

                {/* 시간 입력 모드 - 기존과 동일 */}
                {inputMode === 'time' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium text-sm">시간 선택</h3>
                            <button onClick={() => setInputMode(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* 직접 입력 */}
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
                                <button
                                    onClick={onClickAddTime}
                                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 whitespace-nowrap"
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
                                        className="px-2.5 h-7 text-xs rounded-md bg-gray-100 border hover:bg-gray-200"
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
                                <div className="text-xs font-semibold text-gray-700">시작/종료 시간 선택</div>
                                <div className="text-[10px] text-gray-500">{draftStart ? `시작: ${draftStart}` : '시작을 선택하세요'}</div>
                            </div>
                            <div className="grid grid-cols-6 gap-1 max-h-[100px] overflow-auto pr-1 border rounded-lg p-1">
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
                                onClick={() => setInputMode(null)}
                                className="h-9 px-4 rounded-lg border bg-white hover:bg-gray-50 text-sm"
                            >
                                취소
                            </button>
                            <button
                                onClick={commitTimes}
                                className="h-9 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
                            >
                                완료
                            </button>
                        </div>
                    </div>
                )}

                {/* 날짜 입력 모드 - 기존과 동일 */}
                {inputMode === 'date' && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-medium text-sm">날짜 선택</h3>
                            <button onClick={() => setInputMode(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-4 h-4" />
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
                                    className="flex-1 px-2 py-1.5 text-xs bg-gray-50 rounded-lg border"
                                />
                                <button
                                    onClick={confirmAddDate}
                                    className="px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 whitespace-nowrap"
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
                                        className={`px-2.5 h-7 text-xs font-medium rounded-lg ${dates.includes(p) ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
                                onClick={() => setInputMode(null)}
                                className="h-9 px-4 rounded-lg border bg-white hover:bg-gray-50 text-sm"
                            >
                                취소
                            </button>
                            <button
                                onClick={commitDates}
                                className="h-9 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
                            >
                                완료
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// 3) Cell 컴포넌트
// ═══════════════════════════════════════════════════════════

function CellEditor({ row, facet, sheetId, openDropdown, setOpenDropdown, updateCell, addCustomOption, deleteCustomOption, customOptions }) {
    const cellRef = React.useRef(null);
    const value = row.facets[facet.key] || "";
    const values = unpack(value);
    const displayText = values.length === 0 ? "선택"
        : values.length === 1 ? values[0]
            : values.length === 2 ? values.join(", ")
                : `${values[0]} 외 ${values.length - 1}개`;

    const isOpen = openDropdown?.rowId === row.id && openDropdown?.facetKey === facet.key;

    const customKey = `${sheetId}_${facet.key}`;

    return (
        <td className="px-4 py-3 relative">
            <button
                ref={cellRef}
                onClick={() => setOpenDropdown({ rowId: row.id, facetKey: facet.key, cellRef })}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center justify-between ${values.length > 0
                    ? 'border-gray-300 bg-blue-50 text-blue-900 hover:border-blue-400'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
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
                    onChange={(newValue) => {
                        updateCell(row.id, facet.key, newValue);
                        const unpackedNew = unpack(newValue);
                        const unpackedOld = unpack(value);
                        const newOptions = unpackedNew.filter(v => !unpackedOld.includes(v));
                        newOptions.forEach(opt => addCustomOption(customKey, opt));
                    }}
                    onClose={() => setOpenDropdown(null)}
                    customOptions={customOptions[customKey] || []}
                    onDeleteCustomOption={(opt) => deleteCustomOption(customKey, opt)}
                />
            )}
        </td>
    );
}

// ═══════════════════════════════════════════════════════════
// 4) 메인 컴포넌트
// ═══════════════════════════════════════════════════════════

export default function CriteriaSheetEditor({ tenantId, initialData, onSave }) {
    const [data, setData] = React.useState(() => {
        const defaultData = {
            sheets: ["facility", "room", "product", "rules"],
            activeSheet: "facility",
            items: { facility: [], room: [], product: [], rules: [] },
            customOptions: {}
        };
        if (!initialData) return defaultData;
        if (initialData.sheets && Array.isArray(initialData.sheets)) {
            return { ...defaultData, ...initialData, items: { ...defaultData.items, ...(initialData.items || {}) } };
        }
        return {
            ...defaultData, items: {
                facility: initialData.items?.facility || [],
                room: initialData.items?.room || [],
                product: initialData.items?.product || [],
                rules: initialData.items?.rules || []
            }
        };
    });

    const activeTemplate = SHEET_TEMPLATES[data.activeSheet];
    const activeItems = data.items[data.activeSheet] || [];

    const [openDropdown, setOpenDropdown] = React.useState(null);

    const switchSheet = (sheetId) => setData({ ...data, activeSheet: sheetId });

    const addRow = () => {
        const newRow = { id: `row_${Date.now()}`, name: "", facets: {}, createdAt: Date.now() };
        setData({
            ...data,
            items: { ...data.items, [data.activeSheet]: [...activeItems, newRow] }
        });
    };

    const removeRow = (rowId) => {
        setData({
            ...data,
            items: { ...data.items, [data.activeSheet]: activeItems.filter(r => r.id !== rowId) }
        });
    };

    const updateRowName = (rowId, name) => {
        setData({
            ...data,
            items: {
                ...data.items,
                [data.activeSheet]: activeItems.map(r => r.id === rowId ? { ...r, name } : r)
            }
        });
    };

    const updateCell = (rowId, facetKey, value) => {
        setData({
            ...data,
            items: {
                ...data.items,
                [data.activeSheet]: activeItems.map(r =>
                    r.id === rowId ? { ...r, facets: { ...r.facets, [facetKey]: value } } : r
                )
            }
        });
    };

    const addCustomOption = (customKey, option) => {
        if (!option.trim()) return;
        setData(prev => ({
            ...prev,
            customOptions: {
                ...prev.customOptions,
                [customKey]: [...new Set([...(prev.customOptions[customKey] || []), option.trim()])]
            }
        }));
    };

    const deleteCustomOption = (customKey, option) => {
        setData(prev => ({
            ...prev,
            customOptions: {
                ...prev.customOptions,
                [customKey]: (prev.customOptions[customKey] || []).filter(opt => opt !== option)
            }
        }));
    };

    const handleSave = async () => {
        try {
            await onSave?.(data);
            alert("✅ 저장 완료!");
        } catch (err) {
            alert("❌ 저장 실패: " + err.message);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* 헤더 */}
                <div className="bg-white rounded-2xl shadow-sm p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">데이터 관리</h1>
                            <p className="text-sm text-gray-500 mt-1">셀을 클릭하면 옆에 옵션이 나타납니다</p>
                        </div>
                        <button
                            onClick={handleSave}
                            className="h-11 px-6 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            💾 저장
                        </button>
                    </div>
                </div>

                {/* 시트 탭 */}
                <div className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {data.sheets.map(sheetId => {
                            const template = SHEET_TEMPLATES[sheetId];
                            const isActive = data.activeSheet === sheetId;
                            const itemCount = data.items[sheetId]?.length || 0;

                            return (
                                <button
                                    key={sheetId}
                                    onClick={() => switchSheet(sheetId)}
                                    className={`flex-shrink-0 px-4 py-2.5 rounded-xl font-medium transition-all ${isActive ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                >
                                    <span className="mr-2">{template.icon}</span>
                                    {template.title}
                                    {itemCount > 0 && (
                                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-gray-200"
                                            }`}>
                                            {itemCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 테이블 */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px]">
                            <thead className="bg-gray-50 border-b sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-[250px]">이름</th>
                                    {activeTemplate.facets.map(facet => (
                                        <th key={facet.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                                            {facet.label}
                                        </th>
                                    ))}
                                    <th className="w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {activeItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={activeTemplate.facets.length + 2} className="px-4 py-12 text-center text-gray-400">
                                            <p className="text-lg mb-2">📝 데이터가 없습니다</p>
                                            <p className="text-sm">아래 버튼을 눌러 항목을 추가하세요</p>
                                        </td>
                                    </tr>
                                ) : (
                                    activeItems.map((row) => (
                                        <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <input
                                                    type="text"
                                                    value={row.name}
                                                    onChange={(e) => updateRowName(row.id, e.target.value)}
                                                    placeholder="항목명"
                                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </td>

                                            {activeTemplate.facets.map(facet => (
                                                <CellEditor
                                                    key={facet.key}
                                                    row={row}
                                                    facet={facet}
                                                    sheetId={data.activeSheet}
                                                    openDropdown={openDropdown}
                                                    setOpenDropdown={setOpenDropdown}
                                                    updateCell={updateCell}
                                                    addCustomOption={addCustomOption}
                                                    deleteCustomOption={deleteCustomOption}
                                                    customOptions={data.customOptions}
                                                />
                                            ))}

                                            <td className="px-2 text-right">
                                                <button
                                                    onClick={() => removeRow(row.id)}
                                                    className="w-9 h-9 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                                                    title="삭제"
                                                >
                                                    <X className="w-4 h-4 mx-auto" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* 행 추가 */}
                    <div className="border-t p-4">
                        <button
                            onClick={addRow}
                            className="w-full md:w-auto px-6 py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                            ➕ 행 추가
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}