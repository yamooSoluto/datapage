// presets/industryPresets.js
// 업종별 초기 프리셋 (자주 수정/추가 가능)

export const SCHEMA_VERSION = 1;
export const DEFAULT_INDUSTRY = "studycafe";

// 업종별 시트 구성
export const INDUSTRY_PRESETS = {
    studycafe: {
        id: "studycafe",
        name: "스터디카페",
        icon: "📚",
        sheets: ["facility", "room", "product", "rules"],

        // 필수 항목 (없으면 자동 생성, "없음"도 저장)
        required: {
            facility: ["화장실", "정수기", "락커", "프린터"],
            room: [],
            product: [],
            rules: []
        },

        // 시트별 기본 facets
        facets: {
            facility: [
                {
                    key: "existence",
                    label: "존재",
                    type: "single",
                    options: ["있음", "없음"],
                    required: true,
                    indexed: true
                },
                {
                    key: "location",
                    label: "위치",
                    type: "multi",
                    options: ["로비", "1층", "2층", "3층", "복도", "카페존", "포커스존"],
                    indexed: true
                },
                {
                    key: "cost",
                    label: "비용",
                    type: "multi",
                    options: ["무료", "회원 무료", "유료", "별도 요금"],
                    indexed: true
                },
                {
                    key: "hours",
                    label: "이용시간",
                    type: "multi",
                    options: ["24시간", "영업시간 동안", "제한 있음"],
                    indexed: true
                },
                {
                    key: "usage",
                    label: "이용방법",
                    type: "multi",
                    options: ["자유 이용", "예약 필요", "회원 전용"],
                    indexed: true
                }
            ],
            room: [
                {
                    key: "type",
                    label: "유형",
                    type: "multi",
                    options: ["1인실", "2인실", "4인실", "단체실", "오픈 데스크"],
                    indexed: true
                },
                {
                    key: "capacity",
                    label: "정원",
                    type: "multi",
                    options: ["1인", "2인", "3인", "4인", "5인+"],
                    indexed: true
                },
                {
                    key: "noise",
                    label: "소음규정",
                    type: "multi",
                    options: ["조용", "보통", "통화 가능", "자유"],
                    indexed: true
                },
                {
                    key: "eating",
                    label: "취식규정",
                    type: "multi",
                    options: ["음료만", "간식류", "식사 불가", "자유"],
                    indexed: true
                },
                {
                    key: "existence",
                    label: "존재",
                    type: "single",
                    options: ["있음", "없음"],
                    indexed: true
                }
            ],
            product: [
                {
                    key: "type",
                    label: "종류",
                    type: "multi",
                    options: ["정기권", "시간권", "1회권", "자유석", "지정석"],
                    indexed: true
                },
                {
                    key: "duration",
                    label: "기간",
                    type: "multi",
                    options: ["1일", "1주", "1개월", "3개월", "6개월", "1년"],
                    indexed: true
                },
                {
                    key: "price",
                    label: "가격",
                    type: "text",
                    options: []
                },
                {
                    key: "refund",
                    label: "환불",
                    type: "multi",
                    options: ["가능", "불가", "조건부"],
                    indexed: true
                }
            ],
            rules: [
                {
                    key: "category",
                    label: "규정 유형",
                    type: "multi",
                    options: ["연령", "소음", "취식", "흡연", "외출", "운영시간"],
                    indexed: true
                },
                {
                    key: "level",
                    label: "수준",
                    type: "multi",
                    options: ["엄격", "보통", "자유", "무관"],
                    indexed: true
                },
                {
                    key: "details",
                    label: "세부사항",
                    type: "text",
                    options: []
                }
            ]
        }
    },

    gym: {
        id: "gym",
        name: "헬스장",
        icon: "💪",
        sheets: ["facility", "room", "product", "rules"],

        required: {
            facility: ["샤워실", "락커", "정수기", "화장실", "주차장"],
            room: ["웨이트존", "유산소존"],
            product: [],
            rules: []
        },

        facets: {
            facility: [
                {
                    key: "existence",
                    label: "존재",
                    type: "single",
                    options: ["있음", "없음"],
                    required: true,
                    indexed: true
                },
                {
                    key: "location",
                    label: "위치",
                    type: "multi",
                    options: ["남자", "여자", "공용", "1층", "2층", "지하"],
                    indexed: true
                },
                {
                    key: "cost",
                    label: "비용",
                    type: "multi",
                    options: ["무료", "회원 무료", "별도 요금"],
                    indexed: true
                },
                {
                    key: "hours",
                    label: "이용시간",
                    type: "multi",
                    options: ["24시간", "영업시간 동안", "제한 있음"],
                    indexed: true
                }
            ],
            room: [
                {
                    key: "type",
                    label: "운동 종류",
                    type: "multi",
                    options: ["웨이트", "유산소", "GX", "PT", "요가", "필라테스", "크로스핏"],
                    indexed: true
                },
                {
                    key: "equipment",
                    label: "주요 기구",
                    type: "multi",
                    options: ["러닝머신", "사이클", "바벨", "덤벨", "케이블", "스미스머신"],
                    indexed: true
                },
                {
                    key: "area",
                    label: "규모",
                    type: "multi",
                    options: ["소규모", "중규모", "대규모"],
                    indexed: true
                },
                {
                    key: "existence",
                    label: "존재",
                    type: "single",
                    options: ["있음", "없음"],
                    indexed: true
                }
            ],
            product: [
                {
                    key: "type",
                    label: "종류",
                    type: "multi",
                    options: ["정기 회원권", "PT 회원권", "GX 회원권", "일일권"],
                    indexed: true
                },
                {
                    key: "duration",
                    label: "기간",
                    type: "multi",
                    options: ["1개월", "3개월", "6개월", "1년"],
                    indexed: true
                },
                {
                    key: "sessions",
                    label: "PT 횟수",
                    type: "multi",
                    options: ["10회", "20회", "30회", "50회"],
                    indexed: true
                },
                {
                    key: "price",
                    label: "가격",
                    type: "text",
                    options: []
                }
            ],
            rules: [
                {
                    key: "category",
                    label: "규정 유형",
                    type: "multi",
                    options: ["연령", "성별", "복장", "운영시간", "이용수칙"],
                    indexed: true
                },
                {
                    key: "level",
                    label: "수준",
                    type: "multi",
                    options: ["엄격", "보통", "자유"],
                    indexed: true
                },
                {
                    key: "details",
                    label: "세부사항",
                    type: "text",
                    options: []
                }
            ]
        }
    },

    coworking: {
        id: "coworking",
        name: "코워킹스페이스",
        icon: "💼",
        sheets: ["facility", "room", "product", "rules"],

        required: {
            facility: ["프린터", "회의실", "라운지", "화장실", "팬트리"],
            room: ["데스크존", "전화부스"],
            product: [],
            rules: []
        },

        facets: {
            facility: [
                {
                    key: "existence",
                    label: "존재",
                    type: "single",
                    options: ["있음", "없음"],
                    required: true,
                    indexed: true
                },
                {
                    key: "location",
                    label: "위치",
                    type: "multi",
                    options: ["로비", "1층", "2층", "라운지", "각 층마다"],
                    indexed: true
                },
                {
                    key: "cost",
                    label: "비용",
                    type: "multi",
                    options: ["무료", "회원 무료", "유료"],
                    indexed: true
                },
                {
                    key: "booking",
                    label: "예약",
                    type: "multi",
                    options: ["불필요", "앱 예약", "현장 예약", "사전 예약 필수"],
                    indexed: true
                }
            ],
            room: [
                {
                    key: "type",
                    label: "유형",
                    type: "multi",
                    options: ["오픈 데스크", "전용 데스크", "1인실", "회의실", "라운지"],
                    indexed: true
                },
                {
                    key: "capacity",
                    label: "수용인원",
                    type: "multi",
                    options: ["1인", "2~4인", "5~8인", "10인+"],
                    indexed: true
                },
                {
                    key: "privacy",
                    label: "프라이버시",
                    type: "multi",
                    options: ["오픈", "세미 오픈", "독립"],
                    indexed: true
                },
                {
                    key: "equipment",
                    label: "장비",
                    type: "multi",
                    options: ["모니터", "화이트보드", "빔프로젝터", "화상회의 시스템"],
                    indexed: true
                },
                {
                    key: "existence",
                    label: "존재",
                    type: "single",
                    options: ["있음", "없음"],
                    indexed: true
                }
            ],
            product: [
                {
                    key: "type",
                    label: "종류",
                    type: "multi",
                    options: ["시간제", "일일권", "월 정기", "연 정기"],
                    indexed: true
                },
                {
                    key: "seat",
                    label: "좌석",
                    type: "multi",
                    options: ["자유석", "지정석", "1인실", "팀룸"],
                    indexed: true
                },
                {
                    key: "duration",
                    label: "기간",
                    type: "multi",
                    options: ["1일", "1주", "1개월", "3개월", "6개월", "1년"],
                    indexed: true
                },
                {
                    key: "price",
                    label: "가격",
                    type: "text",
                    options: []
                }
            ],
            rules: [
                {
                    key: "category",
                    label: "규정 유형",
                    type: "multi",
                    options: ["사업자", "운영시간", "게스트", "소음", "취식"],
                    indexed: true
                },
                {
                    key: "level",
                    label: "수준",
                    type: "multi",
                    options: ["엄격", "보통", "자유"],
                    indexed: true
                },
                {
                    key: "details",
                    label: "세부사항",
                    type: "text",
                    options: []
                }
            ]
        }
    },

    cafe: {
        id: "cafe",
        name: "카페",
        icon: "☕",
        sheets: ["facility", "room", "product", "rules"],

        required: {
            facility: ["화장실", "와이파이", "콘센트", "주차장"],
            room: [],
            product: [],
            rules: []
        },

        facets: {
            facility: [
                {
                    key: "existence",
                    label: "존재",
                    type: "single",
                    options: ["있음", "없음"],
                    required: true,
                    indexed: true
                },
                {
                    key: "location",
                    label: "위치",
                    type: "multi",
                    options: ["1층", "2층", "야외", "루프탑"],
                    indexed: true
                },
                {
                    key: "availability",
                    label: "이용방법",
                    type: "multi",
                    options: ["자유 이용", "비밀번호 있음", "구매 시 제공"],
                    indexed: true
                }
            ],
            room: [
                {
                    key: "type",
                    label: "공간",
                    type: "multi",
                    options: ["홀", "테라스", "루프탑", "독립실", "단체석"],
                    indexed: true
                },
                {
                    key: "capacity",
                    label: "좌석수",
                    type: "multi",
                    options: ["1~2인", "3~4인", "5~8인", "10인+"],
                    indexed: true
                },
                {
                    key: "atmosphere",
                    label: "분위기",
                    type: "multi",
                    options: ["조용", "활기찬", "아늑한", "개방적"],
                    indexed: true
                },
                {
                    key: "existence",
                    label: "존재",
                    type: "single",
                    options: ["있음", "없음"],
                    indexed: true
                }
            ],
            product: [
                {
                    key: "category",
                    label: "카테고리",
                    type: "multi",
                    options: ["커피", "음료", "디저트", "브런치", "베이커리"],
                    indexed: true
                },
                {
                    key: "price",
                    label: "가격대",
                    type: "multi",
                    options: ["~5,000원", "5,000~10,000원", "10,000원~"],
                    indexed: true
                }
            ],
            rules: [
                {
                    key: "category",
                    label: "규정 유형",
                    type: "multi",
                    options: ["노트북", "공부", "운영시간", "예약"],
                    indexed: true
                },
                {
                    key: "level",
                    label: "수준",
                    type: "multi",
                    options: ["자유", "시간 제한", "불가"],
                    indexed: true
                },
                {
                    key: "details",
                    label: "세부사항",
                    type: "text",
                    options: []
                }
            ]
        }
    }
};

// 업종 리스트 (선택 UI용)
export const INDUSTRY_LIST = [
    { id: "studycafe", name: "스터디카페", icon: "📚" },
    { id: "gym", name: "헬스장", icon: "💪" },
    { id: "coworking", name: "코워킹스페이스", icon: "💼" },
    { id: "cafe", name: "카페", icon: "☕" }
];

// 시트별 아이콘
export const SHEET_ICONS = {
    facility: "🏢",
    room: "🚪",
    product: "🎫",
    rules: "📋",
    default: "📦"
};

/**
 * 업종 프리셋 가져오기
 */
export function getIndustryPreset(industryId) {
    return INDUSTRY_PRESETS[industryId] || INDUSTRY_PRESETS[DEFAULT_INDUSTRY];
}

/**
 * 필수 항목 초기화 (온보딩용)
 */
export function initializeRequiredItems(industryId) {
    const preset = getIndustryPreset(industryId);
    const items = {};

    preset.sheets.forEach(sheetId => {
        const requiredNames = preset.required[sheetId] || [];

        items[sheetId] = requiredNames.map(name => ({
            id: `${sheetId}_${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name,
            sheetType: sheetId,
            required: true,
            facets: {
                existence: ["없음"]  // 배열로 저장!
            },
            createdAt: Date.now(),
            updatedAt: Date.now()
        }));
    });

    return items;
}

/**
 * 템플릿 초기화 (온보딩용)
 */
export function initializeTemplates(industryId) {
    const preset = getIndustryPreset(industryId);
    const templates = {};

    preset.sheets.forEach(sheetId => {
        templates[sheetId] = {
            id: sheetId,
            title: getSheetTitle(sheetId),
            icon: SHEET_ICONS[sheetId] || SHEET_ICONS.default,
            facets: preset.facets[sheetId] || []
        };
    });

    return templates;
}

/**
 * 시트 제목
 */
function getSheetTitle(sheetId) {
    const titles = {
        facility: "시설/비품",
        room: "룸/존",
        product: "상품/서비스",
        rules: "규정"
    };
    return titles[sheetId] || sheetId;
}