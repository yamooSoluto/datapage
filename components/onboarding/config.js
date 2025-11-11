// components/onboarding/config.js
// CriteriaSheetEditor와 연동되는 온보딩 설정

export const INDUSTRY_OPTIONS = [
    { code: "study_cafe", label: "스터디카페 / 독서실", value: "study_cafe" },
    { code: "self_store", label: "무인매장 / 셀프운영 매장", value: "self_store" },
    { code: "cafe_restaurant", label: "카페 / 음식점", value: "cafe_restaurant" },
    { code: "fitness", label: "피트니스 / 운동공간", value: "fitness" },
    { code: "beauty", label: "뷰티 / 미용", value: "beauty" },
    { code: "education", label: "교육 / 학원", value: "education" },
    { code: "rental_space", label: "공간대여 / 숙박", value: "rental_space" },
    { code: "retail_business", label: "소매 / 유통 / 판매업", value: "retail_business" },
    { code: "other", label: "기타", value: "other" },
];

// ────────────────────────────────────────────────────────────
// CriteriaSheet 시트별 프리셋 (PRESET_ITEMS와 동일 구조)
// required: true → 체크 안 해도 "없음"으로 표시
// required: false → 체크 안 하면 시트에 아예 안 나타남
// ────────────────────────────────────────────────────────────

const SHEET_PRESETS = {
    // 공간 (space)
    space: {
        default: [
            { name: "현관", icon: "🚪", required: false },
            { name: "로비", icon: "🏛️", required: false },
            { name: "복도", icon: "🚶", required: false },
            { name: "휴게존", icon: "🛋️", required: false },
        ],
        study_cafe: [
            { name: "현관", icon: "🚪", required: false },
            { name: "로비", icon: "🏛️", required: false },
            { name: "복도", icon: "🚶", required: false },
            { name: "스터디룸", icon: "📚", required: false },
            { name: "스터디존", icon: "✏️", required: false },
            { name: "포커스존", icon: "🎯", required: false },
            { name: "카페존", icon: "☕", required: false },
            { name: "푸드존", icon: "🍽️", required: false },
            { name: "식사공간", icon: "🥘", required: false },
            { name: "휴게존", icon: "🛋️", required: false },
            { name: "빈백존", icon: "🪑", required: false },
            { name: "강의실", icon: "👨‍🏫", required: false },
            { name: "회의실", icon: "💼", required: false },
            { name: "매장 내 화장실", icon: "🚻", required: false },
            { name: "상가 공동 화장실", icon: "🚽", required: false },
        ],
        cafe_restaurant: [
            { name: "현관", icon: "🚪", required: false },
            { name: "홀", icon: "🏛️", required: false },
            { name: "테라스", icon: "🌿", required: false },
            { name: "바 좌석", icon: "🍷", required: false },
            { name: "룸", icon: "🚪", required: false },
            { name: "화장실", icon: "🚻", required: false },
            { name: "주방", icon: "👨‍🍳", required: false },
        ],
        fitness: [
            { name: "프리웨이트존", icon: "🏋️", required: false },
            { name: "유산소존", icon: "🏃", required: false },
            { name: "머신존", icon: "⚙️", required: false },
            { name: "스트레칭존", icon: "🧘", required: false },
            { name: "그룹운동실", icon: "👥", required: false },
            { name: "탈의실", icon: "👕", required: false },
            { name: "샤워실", icon: "🚿", required: false },
            { name: "휴게실", icon: "☕", required: false },
        ],
    },

    // 시설 (facility)
    facility: {
        default: [
            { name: "냉난방기", icon: "❄️🔥", required: true },
            { name: "공기청정기", icon: "💨", required: true },
            { name: "와이파이", icon: "📶", required: true },
            { name: "콘센트", icon: "🔌", required: true },
        ],
        study_cafe: [
            { name: "냉난방기", icon: "❄️🔥", required: true },
            { name: "보일러", icon: "🔥", required: false },
            { name: "공기청정기", icon: "💨", required: true },
            { name: "커피머신", icon: "☕", required: false },
            { name: "일반정수기", icon: "💧", required: false },
            { name: "얼음정수기", icon: "🧊", required: false },
            { name: "제빙기", icon: "🧊", required: false },
            { name: "전자레인지", icon: "🔆", required: false },
            { name: "싱크대", icon: "🚰", required: false },
            { name: "라면조리기", icon: "🍜", required: false },
            { name: "프린터", icon: "🖨️", required: false },
            { name: "스캐너", icon: "📠", required: false },
            { name: "복사기", icon: "📋", required: false },
            { name: "락커", icon: "🔐", required: false },
            { name: "사물함", icon: "🗄️", required: false },
            { name: "냉장고", icon: "🧊", required: false },
            { name: "와이파이", icon: "📶", required: true },
            { name: "콘센트", icon: "🔌", required: true },
            { name: "USB충전기", icon: "🔋", required: false },
            { name: "모니터", icon: "🖥️", required: false },
            { name: "화이트보드", icon: "📝", required: false },
            { name: "빔프로젝터", icon: "📽️", required: false },
        ],
        cafe_restaurant: [
            { name: "냉난방기", icon: "❄️🔥", required: true },
            { name: "공기청정기", icon: "💨", required: true },
            { name: "커피머신", icon: "☕", required: false },
            { name: "에스프레소머신", icon: "☕", required: false },
            { name: "그라인더", icon: "⚙️", required: false },
            { name: "싱크대", icon: "🚰", required: false },
            { name: "식기세척기", icon: "🍽️", required: false },
            { name: "냉장고", icon: "🧊", required: false },
            { name: "제빙기", icon: "🧊", required: false },
            { name: "와이파이", icon: "📶", required: true },
            { name: "콘센트", icon: "🔌", required: true },
        ],
        fitness: [
            { name: "냉난방기", icon: "❄️🔥", required: true },
            { name: "공기청정기", icon: "💨", required: true },
            { name: "러닝머신", icon: "🏃", required: false },
            { name: "사이클", icon: "🚴", required: false },
            { name: "웨이트기구", icon: "🏋️", required: false },
            { name: "락커", icon: "🔐", required: false },
            { name: "샤워시설", icon: "🚿", required: false },
            { name: "음수대", icon: "💧", required: false },
            { name: "와이파이", icon: "📶", required: true },
        ],
    },

    // 좌석 (seat)
    seat: {
        default: [
            { name: "일반석", icon: "🪑", required: false },
        ],
        study_cafe: [
            { name: "1인실", icon: "🧑‍💻", required: false },
            { name: "2인실", icon: "👥", required: false },
            { name: "단체실", icon: "👨‍👩‍👧‍👦", required: false },
            { name: "스터디룸", icon: "📚", required: false },
            { name: "칸막이", icon: "🧱", required: false },
            { name: "폐쇄형", icon: "🔒", required: false },
            { name: "반폐쇄형", icon: "🔓", required: false },
            { name: "오픈데스크", icon: "🪑", required: false },
        ],
        cafe_restaurant: [
            { name: "테이블석", icon: "🪑", required: false },
            { name: "바 좌석", icon: "🍷", required: false },
            { name: "소파석", icon: "🛋️", required: false },
            { name: "단체석", icon: "👥", required: false },
            { name: "테라스석", icon: "🌿", required: false },
        ],
        fitness: [
            { name: "일반 회원석", icon: "🪑", required: false },
            { name: "VIP 라커", icon: "👑", required: false },
        ],
    },
};

// ────────────────────────────────────────────────────────────
// 업종별 프리셋 가져오기 (시트별로 분리)
// ────────────────────────────────────────────────────────────
export function getSheetPresetsForIndustry(industryCode = "other") {
    const pick = (sheetId) => {
        const base = SHEET_PRESETS[sheetId]?.default || [];
        const more = SHEET_PRESETS[sheetId]?.[industryCode] || [];
        // 중복 제거 (name 기준)
        const merged = [...base, ...more];
        const unique = [];
        const seen = new Set();
        for (const item of merged) {
            if (!seen.has(item.name)) {
                seen.add(item.name);
                unique.push(item);
            }
        }
        return unique;
    };

    return {
        space: pick("space"),
        facility: pick("facility"),
        seat: pick("seat"),
    };
}

// ────────────────────────────────────────────────────────────
// 온보딩 완료 시 CriteriaSheet 초기 데이터 생성
// ────────────────────────────────────────────────────────────
export function generateInitialSheetData(industryCode, selectedItems) {
    // selectedItems = { space: ["현관", "로비", ...], facility: [...], seat: [...] }

    const presets = getSheetPresetsForIndustry(industryCode);
    const pack = (value) => {
        if (Array.isArray(value)) {
            return value.filter(Boolean).join(" / ");
        }
        return value ? String(value) : "";
    };

    const result = {
        schemaVersion: 3,
        sheets: ["space", "facility", "seat"],
        activeSheet: "facility",
        items: {},
        customOptions: {},
        visibleFacets: {},
        facets: {
            space: [
                { key: "existence", label: "보유", type: "checkbox" }
            ],
            facility: [
                { key: "existence", label: "보유", type: "checkbox" }
            ],
            seat: [
                { key: "existence", label: "보유", type: "checkbox" }
            ]
        }
    };

    // 각 시트별로 아이템 생성
    ["space", "facility", "seat"].forEach((sheetId) => {
        const sheetPresets = presets[sheetId] || [];
        const selected = selectedItems[sheetId] || [];
        const items = [];
        const now = Date.now();

        // 1. 선택된 항목들 → "true" (있음)으로 추가
        selected.forEach((itemName, index) => {
            const preset = sheetPresets.find((p) => p.name === itemName);
            const isRequired = preset?.required || false;

            items.push({
                id: `${sheetId}_${now}_${index}`,
                type: sheetId,
                name: itemName,
                icon: preset?.icon || "🧩",
                facets: { existence: "true" },  // ✅ checkbox는 "true"/"false" 사용
                order: index + 1,
                createdAt: now,
                isRequired: isRequired,  // ✅ 선택된 항목도 required 표시
            });
        });

        // 2. required인데 선택 안 된 항목들 → "false" (없음)으로 추가
        const selectedNames = new Set(selected);
        sheetPresets
            .filter((p) => p.required && !selectedNames.has(p.name))
            .forEach((preset, index) => {
                items.push({
                    id: `${sheetId}_${now}_req_${index}`,
                    type: sheetId,
                    name: preset.name,
                    icon: preset.icon || "🧩",
                    facets: { existence: "false" },  // ✅ checkbox는 "false" 사용
                    order: 1000 + index, // 맨 뒤로
                    createdAt: now,
                    isRequired: true,  // ✅ required 표시
                });
            });

        result.items[sheetId] = items;
    });

    return result;
}

// (선택) 업종 코드 → 라벨 변환
export const industryLabel = (code) =>
    INDUSTRY_OPTIONS.find((i) => i.code === code)?.label || "기타";