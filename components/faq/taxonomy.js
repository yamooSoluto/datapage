// components/faq/taxonomy.js

// ========================================
// 1. 최상위 카테고리 (변경 없음)
// ========================================
export const TOP_CATS = {
  store: { key: "store", label: "기본정보" },
  facility: { key: "facility", label: "시설/비품" },
  product: { key: "product", label: "서비스/상품" },
  payment: { key: "payment", label: "결제/환불" },
  rule: { key: "rule", label: "이용/규정" },
  tech: { key: "tech", label: "기술/장애" },
  request: { key: "request", label: "요청/건의" },
  event: { key: "event", label: "이벤트/프로모션" },
  etc: { key: "etc", label: "기타" },
};

// ========================================
// 2. CRITERIA 정의 (독립적인 데이터 구조)
// ========================================

/**
 * CRITERIA 구조 설명:
 * - key: 고유 식별자 (변수명으로 사용)
 * - label: UI에 표시될 한글명
 * - criteria: 선택 가능한 옵션들 (클라이언트가 입력할 실제 데이터)
 * - category: 어떤 TOP_CATS에 속하는지
 * - industries: 어떤 업종에 적용되는지 (optional, 없으면 전체 적용)
 */

export const CRITERIA_REGISTRY = {
  // 🏢 기본정보 관련
  operatingHours: {
    key: "operatingHours",
    label: "운영시간",
    category: "store",
    industries: ["all"], // 모든 업종
    criteria: [
      "24시간 운영",
      "평일만 운영",
      "주말만 운영",
      "평일 06:00~24:00",
      "주말 08:00~22:00",
      "공휴일 휴무",
      "명절 휴무",
      "무인 운영",
    ],
  },

  location: {
    key: "location",
    label: "위치",
    category: "store",
    industries: ["all"],
    criteria: [
      "1층",
      "2층",
      "3층",
      "지하 1층",
      "입구 옆",
      "로비 중앙",
      "복도 끝",
      "계단 옆",
      "엘리베이터 옆",
    ],
  },

  parking: {
    key: "parking",
    label: "주차",
    category: "store",
    industries: ["all"],
    criteria: [
      "주차 가능",
      "주차 불가",
      "유료 주차",
      "무료 주차 (2시간)",
      "무료 주차 (종일)",
      "발레파킹",
      "건물 주차장 이용",
      "노상 주차",
    ],
  },

  // 🔧 시설/비품 관련
  facilityAvailability: {
    key: "facilityAvailability",
    label: "이용가능여부",
    category: "facility",
    industries: ["all"],
    criteria: [
      "자유 이용",
      "예약 필요",
      "회원 전용",
      "시간제 이용",
      "유료 이용",
      "무료 이용",
      "제한 없음",
      "특정 시간만 가능",
    ],
  },

  facilityLocation: {
    key: "facilityLocation",
    label: "시설위치",
    category: "facility",
    industries: ["all"],
    criteria: [
      "1층 로비",
      "2층 중앙",
      "각 층마다",
      "입구 옆",
      "휴게실 내",
      "카페존",
      "복도",
    ],
  },

  facilityCost: {
    key: "facilityCost",
    label: "비용",
    category: "facility",
    industries: ["all"],
    criteria: [
      "무료",
      "1회 500원",
      "1회 1,000원",
      "별도 요금",
      "회원 무료",
      "비회원 유료",
    ],
  },

  // 🛍️ 서비스/상품 관련
  productTypes: {
    key: "productTypes",
    label: "상품종류",
    category: "product",
    industries: ["all"],
    criteria: [
      "시간제",
      "종일제",
      "정기제",
      "자유석",
      "지정석",
      "1인실",
      "다인실",
      "오픈형",
      "룸형",
    ],
  },

  productPricing: {
    key: "productPricing",
    label: "상품가격",
    category: "product",
    industries: ["all"],
    criteria: [
      "시간당 2,000원",
      "종일 10,000원",
      "월 100,000원",
      "주 30,000원",
      "회원가 할인",
      "비회원가",
    ],
  },

  productDuration: {
    key: "productDuration",
    label: "이용시간",
    category: "product",
    industries: ["all"],
    criteria: [
      "1시간 단위",
      "2시간 단위",
      "4시간 단위",
      "종일",
      "최대 12시간",
      "무제한",
    ],
  },

  // 💳 결제/환불 관련
  paymentMethods: {
    key: "paymentMethods",
    label: "결제수단",
    category: "payment",
    industries: ["all"],
    criteria: [
      "카드 결제",
      "계좌이체",
      "카카오페이",
      "네이버페이",
      "토스",
      "현금",
      "간편결제",
      "무통장입금",
    ],
  },

  refundPolicy: {
    key: "refundPolicy",
    label: "환불규정",
    category: "payment",
    industries: ["all"],
    criteria: [
      "전액 환불 (24시간 이내)",
      "부분 환불 (사용일수 제외)",
      "환불 불가",
      "위약금 10%",
      "위약금 20%",
      "취소 수수료 없음",
      "이용 3일 전까지 무료",
    ],
  },

  receiptType: {
    key: "receiptType",
    label: "증빙발급",
    category: "payment",
    industries: ["all"],
    criteria: [
      "현금영수증",
      "세금계산서",
      "간이영수증",
      "이메일 발송",
      "문자 발송",
      "마이페이지 확인",
    ],
  },

  // 📋 이용/규정 관련
  usagePolicy: {
    key: "usagePolicy",
    label: "이용규정",
    category: "rule",
    industries: ["studycafe", "coworking", "gym", "cafe"],
    criteria: [
      "회원 전용",
      "비회원 가능",
      "예약 필수",
      "당일 예약 가능",
      "현장 등록 가능",
      "만 14세 이상",
      "만 19세 이상",
      "고등학생 이상",
      "대학생 이상",
      "시간 제한 없음",
      "최대 12시간",
      "1인 1좌석",
      "동반 입장 가능",
    ],
  },

  outingPolicy: {
    key: "outingPolicy",
    label: "외출규정",
    category: "rule",
    industries: ["studycafe", "coworking", "gym"],
    criteria: [
      "자유 재입장",
      "당일 재입장 무료",
      "30분 이내 무료",
      "1시간 이내 무료",
      "재입장 불가",
      "재입장 시 추가 요금",
      "자리 보장",
      "자리 미보장",
      "사물함 보관 필수",
    ],
  },

  eatingPolicy: {
    key: "eatingPolicy",
    label: "취식규정",
    category: "rule",
    industries: ["studycafe", "coworking", "library"],
    criteria: [
      "음료 포함",
      "음료만",
      "텀블러 및 뚜껑 있는 음료만",
      "초콜릿 사탕류",
      "간단한 간식류",
      "냄새없는 음식류",
      "배달 및 외부음식",
      "모든 음식",
    ],
  },

  noisePolicy: {
    key: "noisePolicy",
    label: "소음규정",
    category: "rule",
    industries: ["studycafe", "coworking", "library"],
    criteria: [
      "타이핑",
      "계산기",
      "이어폰 사용",
      "영상 시청",
      "대화",
      "통화",
      "화상회의",
      "자유로운",
      "시끄러운",
      "심한 소음",
    ],
  },

  smokingPolicy: {
    key: "smokingPolicy",
    label: "흡연규정",
    category: "rule",
    industries: ["all"],
    criteria: [
      "전면 금연",
      "지정 구역만 가능",
      "건물 외부만 가능",
      "전자담배 가능",
      "전자담배 불가",
      "적발 시 퇴실",
      "적발 시 벌금",
    ],
  },

  genderPolicy: {
    key: "genderPolicy",
    label: "성별규정",
    category: "rule",
    industries: ["studycafe", "gym", "sauna"],
    criteria: [
      "성별 무관",
      "남녀 혼성",
      "여성 전용",
      "남성 전용",
      "층별 구분",
      "구역별 구분",
      "시간대별 구분",
    ],
  },

  cleaningPolicy: {
    key: "cleaningPolicy",
    label: "청소규정",
    category: "rule",
    industries: ["all"],
    criteria: [
      "퇴실 시 정리",
      "퇴실 시 정리 불필요",
      "분리수거 필수",
      "공용 공간 정리",
      "정기 청소 제공",
      "셀프 청소",
    ],
  },

  itemManagement: {
    key: "itemManagement",
    label: "물품관리",
    category: "rule",
    industries: ["studycafe", "coworking", "gym"],
    criteria: [
      "사물함 무료",
      "사물함 유료",
      "1일 단위",
      "월 단위",
      "장기 보관 가능",
      "분실물 보관 1주일",
      "분실물 보관 1개월",
      "CCTV 조회 가능",
      "귀중품 책임 없음",
      "당일 수거",
      "익일 폐기",
      "7일 후 폐기",
      "분리수거 필수",
    ],
  },

  // 🔧 기술/장애 관련
  troubleshooting: {
    key: "troubleshooting",
    label: "해결방법",
    category: "tech",
    industries: ["all"],
    criteria: [
      "재시작",
      "재연결",
      "재설치",
      "업데이트",
      "비밀번호 재설정",
      "다른 기기 사용",
      "카운터 문의",
      "채널 문의",
      "긴급 연락",
    ],
  },

  techResponse: {
    key: "techResponse",
    label: "응대방식",
    category: "tech",
    industries: ["all"],
    criteria: [
      "즉시 확인",
      "순차 응대",
      "영업시간 내 처리",
      "24시간 이내 처리",
      "현장 방문 필요",
      "원격 지원",
    ],
  },

  // 📞 요청/건의 관련
  contactMethod: {
    key: "contactMethod",
    label: "문의방법",
    category: "request",
    industries: ["all"],
    criteria: [
      "채널톡",
      "카카오톡",
      "네이버 톡톡",
      "전화",
      "이메일",
      "현장 방문",
      "앱 내 문의",
    ],
  },

  responseTime: {
    key: "responseTime",
    label: "응대시간",
    category: "request",
    industries: ["all"],
    criteria: [
      "평일 10:00~18:00",
      "주말 포함 운영",
      "24시간 응대",
      "점심시간 제외",
      "영업시간 내",
      "순차 응대",
    ],
  },

  // 🎉 이벤트/프로모션 관련
  eventType: {
    key: "eventType",
    label: "이벤트종류",
    category: "event",
    industries: ["all"],
    criteria: [
      "신규가입 혜택",
      "첫 구매 할인",
      "재구매 할인",
      "친구 추천",
      "리뷰 작성",
      "출석 체크",
      "생일 쿠폰",
      "시즌 할인",
    ],
  },

  eventBenefit: {
    key: "eventBenefit",
    label: "혜택내용",
    category: "event",
    industries: ["all"],
    criteria: [
      "10% 할인",
      "20% 할인",
      "1만원 쿠폰",
      "무료 이용권",
      "2주 무료 체험",
      "포인트 적립",
      "사은품 증정",
    ],
  },
};


// ========================================
// 3. 헬퍼 함수들
// ========================================

/**
 * 카테고리별로 CRITERIA 가져오기
 */
export function getCriteriaByCategory(categoryKey) {
  return Object.values(CRITERIA_REGISTRY).filter(
    criteria => criteria.category === categoryKey
  );
}

/**
 * 업종별로 적용 가능한 CRITERIA 가져오기
 */
export function getCriteriaByIndustry(industryKey) {
  return Object.values(CRITERIA_REGISTRY).filter(
    criteria => criteria.industries.includes("all") || criteria.industries.includes(industryKey)
  );
}

/**
 * 카테고리 + 업종으로 CRITERIA 필터링
 */
export function getFilteredCriteria(categoryKey, industryKey = "all") {
  return Object.values(CRITERIA_REGISTRY).filter(criteria => {
    const matchCategory = criteria.category === categoryKey;
    const matchIndustry = criteria.industries.includes("all") ||
      criteria.industries.includes(industryKey);
    return matchCategory && matchIndustry;
  });
}

/**
 * 새로운 CRITERIA 동적 추가
 */
export function addCriteria(newCriteria) {
  if (!newCriteria.key || CRITERIA_REGISTRY[newCriteria.key]) {
    console.error("Invalid or duplicate criteria key");
    return false;
  }

  CRITERIA_REGISTRY[newCriteria.key] = {
    industries: ["all"], // 기본값
    ...newCriteria
  };

  return true;
}

/**
 * 기존 CRITERIA 업데이트
 */
export function updateCriteria(criteriaKey, updates) {
  if (!CRITERIA_REGISTRY[criteriaKey]) {
    console.error("Criteria not found");
    return false;
  }

  CRITERIA_REGISTRY[criteriaKey] = {
    ...CRITERIA_REGISTRY[criteriaKey],
    ...updates
  };

  return true;
}

// ========================================
// 4. 프리셋 템플릿 자동 생성
// ========================================

/**
 * CRITERIA 기반으로 QA 프리셋 자동 생성
 */
export function generateQAPresets(categoryKey, industryKey = "all") {
  const criteria = getFilteredCriteria(categoryKey, industryKey);

  return criteria.map(criterion => ({
    // 질문 프리셋
    question: {
      id: `q-${criterion.key}`,
      label: `{모듈} ${criterion.label}`,
      criteriaKey: criterion.key,
      template: (modName) => `${modName} ${criterion.label}`,
    },

    // 답변 프리셋
    answer: {
      id: `a-${criterion.key}`,
      label: `{${criterion.label}}`,
      criteriaKey: criterion.key,
      template: (selectedValue) => `${selectedValue}`,
      options: criterion.criteria,
    }
  }));
}

/**
 * 카테고리별 키워드 생성
 */
export function generateKeywords(categoryKey) {
  const criteria = getCriteriaByCategory(categoryKey);
  const keywords = new Set();

  // 카테고리 기본 키워드
  const baseKeywords = {
    store: ["영업시간", "위치", "주소", "주차", "연락처", "찾아가는길"],
    facility: ["시설", "비품", "위치", "이용", "사용", "비용"],
    product: ["상품", "서비스", "종류", "가격", "요금", "이용시간"],
    payment: ["결제", "환불", "영수증", "카드", "현금", "계좌이체"],
    rule: ["규정", "규칙", "허용", "금지", "가능", "불가"],
    tech: ["오류", "고장", "문제", "해결", "수리", "장애"],
    request: ["요청", "문의", "건의", "도움", "상담"],
    event: ["이벤트", "프로모션", "할인", "혜택", "쿠폰"],
  };

  // 기본 키워드 추가
  if (baseKeywords[categoryKey]) {
    baseKeywords[categoryKey].forEach(kw => keywords.add(kw));
  }

  // CRITERIA label만 추가 (options는 드롭다운에 있으니 제외)
  criteria.forEach(criterion => {
    keywords.add(criterion.label);
  });

  return Array.from(keywords);
}

// ========================================
// 5. 어미 컨텍스트 (기존 유지)
// ========================================

export const ENDING_CONTEXTS = {
  question: {
    whatIs: {
      label: "기본 정보",
      endings: ["뭐에요?", "알려주세요", "설명해주세요"],
    },
    whereIs: {
      label: "위치/장소",
      endings: ["어디에요?", "어디에 있나요", "어디서 하나요?", "어디로 가나요", "몇 층이에요?"],
    },
    whenIs: {
      label: "시간/기간",
      endings: ["언제에요?", "몇 시에요?", "몇 시부터에요?", "몇 시까지에요?", "언제까지에요?", "기간이 어떻게 되나요?"],
    },
    howTo: {
      label: "방법/절차",
      endings: ["이용방법", "어떻게 하나요?", "방법 알려주세요", "절차가 어떻게 되나요?"],
    },
    exists: {
      label: "존재/가능 여부",
      endings: ["있나요?", "되나요?", "가능한가요?", "해도되나요?", "써도되나요?"],
    },
    howMuch: {
      label: "가격/요금",
      endings: ["요금", "얼마에요?", "무료인가요?", "유료인가요?"],
    },
    discount: {
      label: "가격/할인",
      endings: ["할인 하나요?", "할인 되나요?", "할인 된건가요?", "할인 중인가요?"],
    },
    promotion: {
      label: "이벤트/혜택",
      endings: ["혜택 있나요?", "진행중인 이벤트가 있나요", "이벤트 참여방법"],
    },
    notWorking: {
      label: "문제/오류",
      endings: ["안돼요", "고장났어요", "작동 안 해요", "문제 있어요", "오류가 나요"],
    },
    request: {
      label: "요청/부탁",
      endings: ["해주세요", "부탁드려요", "도와주세요"],
    },
  },
  answer: {
    statement: {
      label: "사실 전달",
      endings: ["입니다", "안내드립니다", "확인해주세요", "참고하세요"],
    },
    instruction: {
      label: "행동 지시",
      endings: ["해주세요", "이용해주세요", "따라주세요", "문의해주세요"],
    },
    availability: {
      label: "가능 여부",
      endings: ["가능합니다", "입니다", "이용하실 수 있습니다", "불가합니다", "어렵습니다"],
    },
    options: {
      label: "선택지 제시",
      endings: ["있습니다", "선택 가능합니다", "준비되어 있습니다", "제공됩니다"],
    },
    apology: {
      label: "사과/조치",
      endings: ["죄송합니다", "확인하겠습니다", "조치하겠습니다", "개선하겠습니다"],
    },
    acknowledge: {
      label: "접수/처리",
      endings: ["접수했습니다", "전달하겠습니다", "검토하겠습니다", "처리하겠습니다"],
    },
  },
};

// ========================================
// 6. ModularFAQBuilder 호환성 함수들
// ========================================

/**
 * getKeywords - ModularFAQBuilder 호환용
 */
export function getKeywords(topKey) {
  return generateKeywords(topKey);
}

/**
 * getQASetOptions - ModularFAQBuilder 호환용
 * CRITERIA 기반으로 QA Set 생성
 */
export function getQASetOptions(topKey) {
  const T = (text) => ({ type: "TEXT", data: { text } });

  // CRITERIA 모듈 생성
  const C = (criteriaKey) => {
    const criterion = CRITERIA_REGISTRY[criteriaKey];
    if (!criterion) return T(`{${criteriaKey}}`);

    return {
      type: "CRITERIA",
      data: {
        selected: [criterion.criteria[0]], // 배열로 시작 (첫 번째 항목 선택)
        options: criterion.criteria,
        label: criterion.label,
        criteriaKey: criteriaKey,
        multi: true // 멀티셀렉 활성화
      }
    };
  };

  const E = (context, selected) => {
    const endings = ENDING_CONTEXTS.question?.[context]?.endings || [];
    return {
      type: "ENDING",
      data: {
        selected: selected ?? (endings[0] ?? ""),
        options: endings,
        context
      }
    };
  };

  const EA = (context, selected) => {
    const endings = ENDING_CONTEXTS.answer?.[context]?.endings || [];
    return {
      type: "ENDING",
      data: {
        selected: selected ?? (endings[0] ?? ""),
        options: endings,
        context
      }
    };
  };

  // 카테고리별 CRITERIA 가져오기
  const criteria = getCriteriaByCategory(topKey);

  // 기본 QA Sets (CRITERIA 기반)
  const criteriaBasedSets = criteria.map(criterion => ({
    id: `qa-${criterion.key}`,
    label: `{모듈} ${criterion.label}`,
    build: ({ modName }) => {
      // 질문 생성
      const question = [T(modName || "모듈"), T(criterion.label)];

      // CRITERIA 타입별로 적절한 질문/답변 어미 선택
      let questionEnding, answerEnding;

      // 시간 관련
      if (criterion.label.includes("시간") || criterion.label.includes("기간")) {
        question.push(E("whenIs", "언제에요?"));
        answerEnding = EA("statement", "입니다");
      }
      // 위치 관련
      else if (criterion.label.includes("위치") || criterion.label.includes("장소")) {
        question.push(E("whereIs", "어디에요?"));
        answerEnding = EA("statement", "입니다");
      }
      // 가격/비용 관련
      else if (criterion.label.includes("가격") || criterion.label.includes("비용") || criterion.label.includes("요금")) {
        question.push(E("howMuch", "얼마에요?"));
        answerEnding = EA("statement", "입니다");
      }
      // 방법/절차 관련
      else if (criterion.label.includes("방법") || criterion.label.includes("절차")) {
        question.push(E("howTo", "어떻게 하나요?"));
        answerEnding = EA("instruction", "해주세요");
      }
      // 규정/정책 관련 (허용/금지)
      else if (criterion.label.includes("규정") || criterion.label.includes("정책") || criterion.label.includes("규칙")) {
        question.push(E("whatIs", "어떻게 되나요?"));
        answerEnding = EA("availability", "가능합니다");
      }
      // 종류/타입 관련
      else if (criterion.label.includes("종류") || criterion.label.includes("타입")) {
        question.push(E("whatIs", "뭐에요?"));
        answerEnding = EA("options", "있습니다");
      }
      // 수단/방법 관련 (결제수단 등)
      else if (criterion.label.includes("수단") || criterion.label.includes("방식")) {
        question.push(E("whatIs", "뭐에요?"));
        answerEnding = EA("availability", "가능합니다");
      }
      // 기본 (정보 안내)
      else {
        question.push(E("whatIs", "뭐에요?"));
        answerEnding = EA("statement", "입니다");
      }

      // 답변 생성
      const answer = [C(criterion.key), answerEnding];

      return { question, answer };
    }
  }));

  // 카테고리별 추가 일반 QA Sets
  const commonSets = {
    store: [
      {
        id: "qa-store-general",
        label: "{모듈} 안내",
        build: ({ modName }) => ({
          question: [T(modName), E("whatIs", "알려주세요")],
          answer: [T(modName), T("은(는)"), EA("statement", "안내드립니다")]
        })
      }
    ],
    facility: [
      {
        id: "qa-facility-broken",
        label: "{모듈} 고장",
        build: ({ modName }) => ({
          question: [T(modName), E("notWorking", "고장났어요")],
          answer: [T("불편을 드려"), EA("apology", "죄송합니다"), T("상태"), EA("acknowledge", "확인하겠습니다")]
        })
      }
    ],
    product: [
      {
        id: "qa-product-recommend",
        label: "{모듈} 추천",
        build: ({ modName }) => ({
          question: [T(modName), T("추천"), E("request", "해주세요")],
          answer: [T(modName), T("추천"), EA("instruction", "안내드립니다")]
        })
      }
    ],
    payment: [
      {
        id: "qa-payment-cancel",
        label: "취소/환불",
        build: () => ({
          question: [T("취소"), E("howTo", "어떻게 하나요?")],
          answer: [T("취소는"), EA("instruction", "문의해주세요")]
        })
      }
    ],
    rule: [
      {
        id: "qa-rule-allow",
        label: "{모듈} 허용 여부",
        build: ({ modName }) => ({
          question: [T(modName), E("exists", "해도되나요?")],
          answer: [T("허용 여부는"), EA("statement", "확인해주세요")]
        })
      }
    ],
    tech: [
      {
        id: "qa-tech-help",
        label: "{모듈} 문제",
        build: ({ modName }) => ({
          question: [T(modName), E("notWorking", "안돼요")],
          answer: [EA("apology", "죄송합니다"), EA("acknowledge", "확인하겠습니다")]
        })
      }
    ],
    request: [
      {
        id: "qa-request-how",
        label: "문의 방법",
        build: () => ({
          question: [T("문의"), E("howTo", "어떻게 하나요?")],
          answer: [T("문의는"), EA("instruction", "해주세요")]
        })
      }
    ],
    event: [
      {
        id: "qa-event-benefit",
        label: "이벤트 혜택",
        build: () => ({
          question: [T("이벤트"), T("혜택"), E("promotion", "있나요?")],
          answer: [T("현재 이벤트"), EA("options", "있습니다")]
        })
      }
    ]
  };

  // CRITERIA 기반 + 추가 일반 Sets 합치기
  const additionalSets = commonSets[topKey] || [];
  return [...criteriaBasedSets, ...additionalSets];
}

/**
 * getPresetOptions - ModularFAQBuilder 호환용
 */
export function getPresetOptions(topKey, mode = "question") {
  const criteria = getCriteriaByCategory(topKey);

  // mode에 따라 질문 또는 답변 프리셋 생성
  return criteria.map(criterion => {
    if (mode === "question") {
      return {
        id: `q-${criterion.key}`,
        label: `{모듈} ${criterion.label}`,
        build: ({ modName }) => [
          { type: "TEXT", data: { text: modName || "모듈" } },
          { type: "TEXT", data: { text: criterion.label } },
          {
            type: "ENDING",
            data: {
              selected: "뭐에요?",
              options: ENDING_CONTEXTS.question.whatIs.endings,
              context: "whatIs"
            }
          }
        ]
      };
    } else {
      return {
        id: `a-${criterion.key}`,
        label: `{${criterion.label}}`,
        build: () => [
          { type: "TEXT", data: { text: `{${criterion.label}}` } },
          {
            type: "ENDING",
            data: {
              selected: "입니다",
              options: ENDING_CONTEXTS.answer.statement.endings,
              context: "statement"
            }
          }
        ]
      };
    }
  });
}

/**
 * getPlaceholderCycle - ModularFAQBuilder 호환용
 */
export function getPlaceholderCycle(topKey, mode = "question") {
  const category = TOP_CATS[topKey];
  if (!category) return ["카테고리를 선택하세요"];

  const presets = getPresetOptions(topKey, mode);
  const labels = presets.slice(0, 3).map(p => p.label.replace("{모듈}", "모듈"));

  return [category.label, ...labels, "카테고리를 선택하세요"];
}

// ──────────────────────────────────────────
// A) 매트릭스(그리드) 열 정의: 시설 전용 예시
// ──────────────────────────────────────────
export const MATRIX_FACETS_FACILITY = [
  // 존재 여부: 있으면 기록, 없으면 스킵
  {
    key: "presence",
    label: "존재",
    mode: "radio",
    options: ["없음", "있음"],
  },
  // 비용: 무료/유료 → facilityCost 로 기록
  {
    key: "cost",
    label: "비용",
    mode: "radio",
    options: ["무료", "유료"],
    mapsTo: { criteriaKey: "facilityCost" }, // CRITERIA_REGISTRY.facilityCost
  },
  // 위치: 샘플 (필요 옵션은 CRITERIA_REGISTRY.facilityLocation 에 이미 존재)
  {
    key: "location",
    label: "위치",
    mode: "select",
    optionsFromCriteriaKey: "facilityLocation",
    mapsTo: { criteriaKey: "facilityLocation" },
  },
  // 이용: 자유/예약/회원 등 → facilityAvailability
  {
    key: "availability",
    label: "이용",
    mode: "radio",
    optionsFromCriteriaKey: "facilityAvailability",
    mapsTo: { criteriaKey: "facilityAvailability" },
  },
  // 취식: 다중 토글 → eatingPolicy (rule)
  {
    key: "eating",
    label: "취식허용",
    mode: "multi",
    options: ["음료", "간식", "식사"], // 간단 키워드 → 아래 normalize에서 CRITERIA 로 치환
    mapsTo: { criteriaKey: "eatingPolicy" },
  },
  // 소음: 다중 토글 → noisePolicy (rule)
  {
    key: "noise",
    label: "소음허용",
    mode: "multi",
    options: ["타이핑", "대화/통화"],
    mapsTo: { criteriaKey: "noisePolicy" },
  },
];

// ──────────────────────────────────────────
// B) 옵션 정규화: 매트릭스 값 → CRITERIA 옵션 문자열
// ──────────────────────────────────────────
function normalizeToCriteriaOption(criteriaKey, valueOrArray) {
  const pick = (v) => {
    const s = String(v || "").trim();
    if (!s) return null;

    // 1) 직접 일치 (CRITERIA_REGISTRY에 있는 옵션이면 그대로)
    const opts = (CRITERIA_REGISTRY[criteriaKey]?.criteria || []);
    if (opts.includes(s)) return s;

    // 2) 간단 치환 (필요시 확장)
    const mapTable = {
      facilityCost: { "무료": "무료", "유료": "별도 요금" },
      eatingPolicy: {
        "음료": "음료 포함", // 기본은 "포함"으로 수용
        "간식": "간단한 간식류",
        "식사": "모든 음식", // or "냄새없는 음식류"로 바꿔도 됨
      },
      noisePolicy: {
        "타이핑": "타이핑",
        "대화/통화": "대화", // "통화"는 별도 항목도 있으니 필요시 추가
      },
    };
    const t = mapTable[criteriaKey]?.[s];
    if (t && opts.includes(t)) return t;

    // 3) 못 찾으면 null
    return null;
  };

  if (Array.isArray(valueOrArray)) {
    const out = [];
    for (const v of valueOrArray) {
      const n = pick(v);
      if (n && !out.includes(n)) out.push(n);
    }
    return out;
  }
  return pick(valueOrArray);
}

// ──────────────────────────────────────────
// C) 행(시설 항목) 하나에 매트릭스 선택 적용 → items[].data 갱신
// ──────────────────────────────────────────
export function applyMatrixSelectionsToItem(item, selections) {
  // selections 예: { presence:'있음', cost:'무료', location:'2층 중앙', eating:['음료','간식'], ... }
  const data = { ...(item.data || {}) };

  // 1) 존재 체크: '없음'이면 비우고 종료
  if (selections.presence === "없음") {
    return { ...item, data: {} };
  }

  // 2) 각 facet별로 criteriaKey가 있으면 정규화 후 기록
  for (const facet of MATRIX_FACETS_FACILITY) {
    const val = selections[facet.key];
    if (!val || !facet.mapsTo) continue;

    const { criteriaKey } = facet.mapsTo;
    const normalized = normalizeToCriteriaOption(criteriaKey, val);
    if (!normalized || (Array.isArray(normalized) && normalized.length === 0)) continue;

    if (Array.isArray(normalized)) {
      // 멀티는 문자열을 다 합쳐 " / "로 저장(너 UI는 배열로 들고 있어도 무방)
      data[criteriaKey] = normalized.join(" / ");
    } else {
      data[criteriaKey] = normalized;
    }
  }

  // 3) 위치/이용 라디오/셀렉트 그대로 기록 (이미 위에서 처리)
  return { ...item, data };
}

// ──────────────────────────────────────────
// D) 테넌트 데이터 → FAQ 대량 생성 유틸
// (items[].data 에 기록된 CRITERIA 값을 이용)
// ──────────────────────────────────────────
export function compileFAQsFromTenantData(tenantData = {}) {
  const items = tenantData.items?.facility || [];
  const faqs = [];

  for (const it of items) {
    const name = (it.name || "").trim();
    if (!name || !it.data) continue;

    // 비용
    if (it.data.facilityCost) {
      faqs.push({
        question: `${name} 비용`,
        answer: `${it.data.facilityCost}`,
        meta: { category: "facility", criteriaKey: "facilityCost" }
      });
    }

    // 위치
    if (it.data.facilityLocation) {
      faqs.push({
        question: `${name} 위치`,
        answer: `${it.data.facilityLocation}`,
        meta: { category: "facility", criteriaKey: "facilityLocation" }
      });
    }

    // 이용
    if (it.data.facilityAvailability) {
      faqs.push({
        question: `${name} 이용`,
        answer: `${it.data.facilityAvailability}`,
        meta: { category: "facility", criteriaKey: "facilityAvailability" }
      });
    }

    // 취식/소음 (있으면 규정형으로도 한 줄 생성)
    if (it.data.eatingPolicy) {
      faqs.push({
        question: `${name} 취식규정`,
        answer: `${it.data.eatingPolicy}`,
        meta: { category: "rule", criteriaKey: "eatingPolicy" }
      });
    }
    if (it.data.noisePolicy) {
      faqs.push({
        question: `${name} 소음규정`,
        answer: `${it.data.noisePolicy}`,
        meta: { category: "rule", criteriaKey: "noisePolicy" }
      });
    }
  }

  return faqs;
}

// ──────────────────────────────────────────
// 1) 공통: CRITERIA 옵션 가져오기 (override 우선)
// ──────────────────────────────────────────
export function getCriteriaOptions(criteriaKey, overrides) {
  if (overrides?.[criteriaKey]?.length) return overrides[criteriaKey];
  const arr = (CRITERIA_REGISTRY?.[criteriaKey]?.criteria || []).filter(Boolean);
  return arr;
}

// ──────────────────────────────────────────
/** 2) Facets 템플릿들 (시트 종류별 컬럼 세트) */
// ──────────────────────────────────────────
export const FACETS_TEMPLATES = {
  facility: [
    { key: "presence", label: "존재", mode: "radio", options: ["없음", "있음"] },
    { key: "cost", label: "비용", mode: "radio", mapsTo: { criteriaKey: "facilityCost" } },
    { key: "location", label: "위치", mode: "select", mapsTo: { criteriaKey: "facilityLocation" } },
    { key: "availability", label: "이용", mode: "radio", mapsTo: { criteriaKey: "facilityAvailability" } },
    { key: "eating", label: "취식허용", mode: "multi", mapsTo: { criteriaKey: "eatingPolicy" }, options: ["음료", "간식", "식사"] },
    { key: "noise", label: "소음허용", mode: "multi", mapsTo: { criteriaKey: "noisePolicy" }, options: ["타이핑", "대화/통화"] },
  ],
  room: [
    { key: "presence", label: "존재", mode: "radio", options: ["없음", "있음"] },
    { key: "capacity", label: "정원", mode: "select", mapsTo: { criteriaKey: "roomCapacity" } },
    { key: "location", label: "위치", mode: "select", mapsTo: { criteriaKey: "facilityLocation" } },
    { key: "reservation", label: "예약방식", mode: "radio", mapsTo: { criteriaKey: "reservationPolicy" } },
    { key: "eating", label: "취식허용", mode: "multi", mapsTo: { criteriaKey: "eatingPolicy" }, options: ["음료", "간식", "식사"] },
  ],
  product: [
    { key: "presence", label: "판매", mode: "radio", options: ["미판매", "판매"] },
    { key: "price", label: "가격", mode: "select", mapsTo: { criteriaKey: "productPrice" } },
    { key: "options", label: "옵션", mode: "multi", mapsTo: { criteriaKey: "productOptions" } },
  ],
  rule: [
    { key: "topic", label: "규정 주제", mode: "select", mapsTo: { criteriaKey: "ruleTopic" } },
    { key: "allow", label: "허용", mode: "multi", mapsTo: { criteriaKey: "ruleAllow" } },
    { key: "deny", label: "금지", mode: "multi", mapsTo: { criteriaKey: "ruleDeny" } },
  ],
};

// ──────────────────────────────────────────
// 3) 온보딩 → 시트 프리필
//   - onboardingSeeds = { facility: ["프린터","복사기"], room: ["스터디룸"], ... }
// ──────────────────────────────────────────
export function seedRowsFromOnboarding(onboardingSeeds = {}, templateKey = "facility") {
  const names = onboardingSeeds[templateKey] || [];
  return names.map((name, i) => ({ id: i + 1, name, data: {} }));
}



// ========================================
// 7. 사용 예시
// ========================================

/*
// 스터디카페용 CRITERIA만 가져오기
const studycafeCriteria = getCriteriaByIndustry("studycafe");

// rule 카테고리의 프리셋 자동 생성
const rulePresets = generateQAPresets("rule", "studycafe");

// 새로운 CRITERIA 추가 (예: 애완동물 규정)
addCriteria({
  key: "petPolicy",
  label: "반려동물규정",
  category: "rule",
  industries: ["cafe", "restaurant"],
  criteria: [
    "반려동물 동반 가능",
    "소형견만 가능",
    "테라스만 가능",
    "반려동물 불가",
  ]
});

// 기존 CRITERIA 수정
updateCriteria("eatingPolicy", {
  criteria: [...CRITERIA_REGISTRY.eatingPolicy.criteria, "케이크류"]
});
*/