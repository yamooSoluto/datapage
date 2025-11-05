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

// 🆕 모든 업종 공통 필수 아이템 (삭제 불가)
export const COMMON_REQUIRED = {
    facilities: [
        { name: "화장실", existence: true, required: true },
        { name: "냉난방기", existence: false, required: true },
    ]
};

// 🆕 모든 업종 공통 선택 아이템 (삭제 가능)
export const COMMON_OPTIONAL = {
    facilities: [
        { name: "정수기", existence: false, required: false },
        { name: "공기청정기", existence: false, required: false },
        { name: "CCTV", existence: false, required: false },
    ]
};

// 🆕 업종별 기본 아이템 (온보딩 완료 시 자동 생성)
export const INDUSTRY_DEFAULTS = {
    study_cafe: {
        // 공간 - 실제 스터디카페 공간 명칭
        spaces: [
            // 필수 (삭제 불가)
            { name: "현관", existence: true, required: true },
            { name: "로비", existence: true, required: true },
            { name: "복도", existence: true, required: true },
            // 선택 (삭제 가능)
            { name: "스터디룸", existence: false, required: false },
            { name: "스터디존", existence: false, required: false },
            { name: "포커스존", existence: false, required: false },
            { name: "카페존", existence: false, required: false },
            { name: "푸드존", existence: false, required: false },
            { name: "식사공간", existence: false, required: false },
            { name: "휴게존", existence: false, required: false },
            { name: "빈백존", existence: false, required: false },
            { name: "강의실", existence: false, required: false },
            { name: "회의실", existence: false, required: false },
            { name: "매장 내 화장실", existence: false, required: false },
            { name: "상가 공동 화장실", existence: false, required: false },
        ],

        // 시설 - 실제 스터디카페 시설
        facilities: [
            // 필수
            { name: "냉난방기", existence: true, required: true },
            // 선택
            { name: "보일러", existence: false, required: false },
            { name: "공기청정기", existence: false, required: false },
            { name: "커피머신", existence: false, required: false },
            { name: "일반정수기", existence: false, required: false },
            { name: "얼음정수기", existence: false, required: false },
            { name: "제빙기", existence: false, required: false },
            { name: "전자레인지", existence: false, required: false },
            { name: "싱크대", existence: false, required: false },
            { name: "라면조리기", existence: false, required: false },
        ],

        // 좌석 - 실제 스터디카페 좌석 타입
        seats: [
            // 필수
            { name: "일반좌석", existence: true, required: true },
            // 선택
            { name: "1인실", existence: false, required: false },
            { name: "2인실", existence: false, required: false },
            { name: "단체실", existence: false, required: false },
            { name: "스터디룸", existence: false, required: false },
            { name: "칸막이", existence: false, required: false },
            { name: "폐쇄형", existence: false, required: false },
            { name: "반폐쇄형", existence: false, required: false },
            { name: "오픈데스크", existence: false, required: false },
        ],

        // 🆕 이용권 - 스터디카페 이용권 타입
        passes: [
            // 필수 (최소한의 이용권은 있어야 함)
            { name: "시간권", existence: false, required: true },
            { name: "종일권", existence: false, required: true },
            // 선택
            { name: "1회권", existence: false, required: false },
            { name: "충전권", existence: false, required: false },
            { name: "기간권", existence: false, required: false },
            { name: "자유권", existence: false, required: false },
            { name: "전용석", existence: false, required: false },
            { name: "당일권", existence: false, required: false },
            { name: "야간권", existence: false, required: false },
            { name: "주말권", existence: false, required: false },
            { name: "정기권", existence: false, required: false },
            { name: "회원권", existence: false, required: false },
            { name: "비회원권", existence: false, required: false },
            { name: "멤버십 이용권", existence: false, required: false },
            { name: "VIP권", existence: false, required: false },
            { name: "프리미엄권", existence: false, required: false },
            { name: "연간권", existence: false, required: false },
        ],

        // 🆕 기능 - 스터디카페 제공 기능
        features: [
            // 필수
            { name: "퇴실", existence: true, required: true },
            { name: "연장", existence: true, required: true },
            // 선택
            { name: "자리이동", existence: false, required: false },
            { name: "일시정지", existence: false, required: false },
            { name: "중복구매", existence: false, required: false },
            { name: "시간복구", existence: false, required: false },
        ],

        // 🆕 이용규정 - 스터디카페 규정
        policies: [
            // 필수
            { name: "연령규정", existence: false, required: true },
            { name: "소음규정", existence: true, required: true },
            { name: "취식규정", existence: true, required: true },
            // 선택
            { name: "외출규정", existence: false, required: false },
            { name: "청소규정", existence: false, required: false },
            { name: "환기규정", existence: false, required: false },
            { name: "냉난방규정", existence: false, required: false },
            { name: "흡연규정", existence: false, required: false },
            { name: "성별규정", existence: false, required: false },
            { name: "분실물규정", existence: false, required: false },
            { name: "보관규정", existence: false, required: false },
            { name: "폐기규정", existence: false, required: false },
        ],
    },

    cafe_restaurant: {
        spaces: [
            { name: "홀", existence: true, required: true },
            { name: "주방", existence: true, required: true },
            { name: "바", existence: false, required: false },
            { name: "테라스", existence: false, required: false },
            { name: "프라이빗룸", existence: false, required: false },
        ],
        facilities: [
            { name: "커피머신", existence: true, required: true },
            { name: "싱크대", existence: true, required: true },
            { name: "그라인더", existence: false, required: false },
            { name: "에스프레소머신", existence: false, required: false },
            { name: "식기세척기", existence: false, required: false },
        ],
        seats: [
            { name: "2인테이블", existence: true, required: true },
            { name: "4인테이블", existence: false, required: false },
            { name: "바테이블", existence: false, required: false },
            { name: "소파석", existence: false, required: false },
        ],
        passes: [], // 카페는 이용권 개념 없음
        features: [],
        policies: [
            { name: "취식규정", existence: true, required: true },
            { name: "소음규정", existence: false, required: false },
        ],
    },

    // 다른 업종도 동일한 구조로...
};

// 🆕 업종별 예시 데이터 (useExampleData=true일 때)
export const EXAMPLE_DATA = {
    study_cafe: {
        spaces: {
            "로비": {
                existence: true,
                location: ["1층"],
                noise: ["보통"],
                access: ["자유 이용"],
                hours: ["24시간"]
            },
            "스터디존": {
                existence: true,
                location: ["2층"],
                noise: ["조용"],
                access: ["자유 이용"],
                hours: ["24시간"]
            },
            "포커스존": {
                existence: true,
                location: ["2층"],
                noise: ["매우 조용"],
                access: ["자유 이용"],
                features: ["통화금지", "대화금지"]
            }
        },
        facilities: {
            "커피머신": {
                existence: true,
                location: ["로비"],
                cost: ["무료"],
                hours: ["24시간"],
                quantity: ["1개"]
            },
            "일반정수기": {
                existence: true,
                location: ["로비", "2층"],
                cost: ["무료"],
                hours: ["24시간"],
                quantity: ["층별 1개"]
            },
            "전자레인지": {
                existence: true,
                location: ["푸드존"],
                cost: ["무료"],
                hours: ["24시간"],
                quantity: ["2개"]
            }
        },
        seats: {
            "오픈데스크": {
                existence: true,
                capacity: ["1인"],
                type: ["오픈"],
                features: ["콘센트", "스탠드"],
                quantity: ["50석"]
            },
            "칸막이": {
                existence: true,
                capacity: ["1인"],
                type: ["칸막이"],
                features: ["콘센트", "스탠드", "조용"],
                quantity: ["30석"]
            },
            "1인실": {
                existence: true,
                capacity: ["1인"],
                type: ["폐쇄형"],
                features: ["콘센트", "스탠드", "매우 조용", "프라이빗"],
                quantity: ["10실"]
            }
        },
        passes: {
            "시간권": {
                existence: true,
                price: ["2시간 3,000원", "4시간 5,000원", "6시간 7,000원"],
                features: ["자유석", "연장 가능"],
                restrictions: ["당일만 사용"]
            },
            "종일권": {
                existence: true,
                price: ["평일 10,000원", "주말 12,000원"],
                features: ["자유석", "출입 자유"],
                restrictions: ["당일만 사용"]
            },
            "정기권": {
                existence: true,
                price: ["4주 150,000원", "8주 280,000원"],
                features: ["자유석", "매일 사용"],
                restrictions: ["기간 내 자유"]
            }
        },
        features: {
            "퇴실": {
                existence: true,
                description: ["키오스크에서 직접 퇴실", "자동 정산"],
                hours: ["24시간"]
            },
            "연장": {
                existence: true,
                description: ["시간권 연장 가능", "1시간 단위"],
                cost: ["1시간 1,500원"]
            },
            "자리이동": {
                existence: true,
                description: ["당일 1회 무료", "2회부터 1,000원"],
                restrictions: ["동일 존 내에서만"]
            }
        },
        policies: {
            "연령규정": {
                existence: true,
                rule: ["중학생 이상 이용 가능"],
                exception: ["초등학생은 보호자 동반 시 가능"]
            },
            "소음규정": {
                existence: true,
                rule: ["조용한 대화 가능", "포커스존 통화 금지"],
                penalty: ["3회 경고 시 퇴실"]
            },
            "취식규정": {
                existence: true,
                rule: ["뚜껑있는 음료 가능", "간단한 간식 가능"],
                allowed: ["빵", "과자", "초콜릿"],
                prohibited: ["냄새나는 음식", "배달음식"],
                location: ["푸드존에서만 식사 가능"]
            },
            "외출규정": {
                existence: true,
                rule: ["일시정지 후 외출 가능"],
                duration: ["최대 1시간"],
                penalty: ["무단 외출 시 자동 퇴실"]
            }
        }
    }
};

// 업종별 기본 아이템 + 공통 아이템 합치기
export function getDefaultItemsForIndustry(industryCode = "other") {
    const industryDefaults = INDUSTRY_DEFAULTS[industryCode] || {};

    return {
        spaces: industryDefaults.spaces || [],
        facilities: [
            ...COMMON_REQUIRED.facilities,
            ...COMMON_OPTIONAL.facilities,
            ...(industryDefaults.facilities || [])
        ],
        seats: industryDefaults.seats || [],
        passes: industryDefaults.passes || [],
        features: industryDefaults.features || [],
        policies: industryDefaults.policies || [],
    };
}

// 업종별 예시 데이터 가져오기
export function getExampleDataForIndustry(industryCode = "other") {
    return EXAMPLE_DATA[industryCode] || {};
}

// 업종 코드 → 라벨 변환
export const industryLabel = (code) =>
    INDUSTRY_OPTIONS.find((i) => i.code === code)?.label || "기타";

// 🆕 필수 아이템만 필터링
export function getRequiredItems(items) {
    return items.filter(item => item.required);
}

// 🆕 선택 아이템만 필터링
export function getOptionalItems(items) {
    return items.filter(item => !item.required);
}