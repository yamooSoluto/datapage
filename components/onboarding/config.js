// components/onboarding/config.js
export const INDUSTRY_OPTIONS = [
    { code: "study_cafe", label: "스터디카페 / 독서실" },
    { code: "self_store", label: "무인매장 / 셀프운영 매장" },
    { code: "cafe_restaurant", label: "카페 / 음식점" },
    { code: "fitness", label: "피트니스 / 운동공간" },
    { code: "beauty", label: "뷰티 / 미용" },
    { code: "education", label: "교육 / 학원" },
    { code: "rental_space", label: "공간대여 / 숙박" },
    { code: "retail_business", label: "소매 / 유통 / 판매업" },
    { code: "other", label: "기타" },
];

// 업종별 프리셋 (필요하면 자유롭게 추가/수정)
const PRESETS = {
    facilities: {
        default: ["프린터", "스캐너", "사물함", "휴게존", "정수기", "CCTV"],
        study_cafe: ["흡음룸", "콘센트", "토킹존", "간식바"],
        beauty: ["파우더룸", "드라이기", "수건", "거울존"],
        cafe_restaurant: ["커피머신", "음수대", "키친", "셀프바"],
    },
    passes: {
        default: ["자유석 1일권", "자유석 1주권", "전용석 1개월", "야간권", "주말권"],
        study_cafe: ["모닝권", "올나잇권"],
        beauty: ["1회권", "정기권 4주", "이벤트권"],
    },
    menu: {
        default: ["아메리카노", "라떼", "티", "스낵"],
        cafe_restaurant: ["콜드브루", "디카페인", "디저트"],
    },
};

// default + 업종 프리셋을 합쳐서 중복 제거
export function getPresetsForIndustry(industryCode = "other") {
    const pick = (cat) => {
        const base = PRESETS[cat]?.default || [];
        const more = PRESETS[cat]?.[industryCode] || [];
        return Array.from(new Set([...base, ...more]));
    };
    return {
        facilities: pick("facilities"),
        passes: pick("passes"),
        menu: pick("menu"),
    };
}

// (선택) 업종 코드 → 라벨 변환
export const industryLabel = (code) =>
    INDUSTRY_OPTIONS.find((i) => i.code === code)?.label || "기타";
