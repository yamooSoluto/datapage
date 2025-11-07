// types/cs.ts (Next.js 서버 전용 or 공용)
export type TenantProfile = {
    brandName?: string;
    slackUserId?: string;                 // 담당자 DM/멘션용
    links?: { homepage?: string; kakaotalk?: string; naver?: string; insta?: string };
    policies?: { food?: string; noise?: string; phone?: string; refund?: string };
    dictionaries: {
        facilities: Array<{ name: string; synonyms?: string[]; howTo?: string[]; notes?: string }>;
        passes: Array<{ name: string; synonyms?: string[]; rules?: string[] }>;
        menu: Array<{ name: string; price?: number; options?: string[] }>;
    };
    updatedAt: number; // Date.now()
};

export type FAQDoc = {
    questions: string[];      // 최소 1개
    answer: string;
    staffHandoff?: '필요없음' | '조건부 전달' | '전달 필요';
    guide?: string;           // 주의/예외/전달조건
    keyData?: string;         // 링크/규정/모듈번들(임시 [BUNDLE] 포함)
    tags?: string[];
    isActive: boolean;        // 비활성 체크 → 검색 제외
    createdAt: number;
    updatedAt: number;
};

export type VectorTask = {
    action: 'upsert' | 'delete';
    faqId: string;
    payload?: { tenantId: string; questions: string[]; answer: string; tags?: string[] };
    createdAt: number;
    status: 'queued' | 'done' | 'error';
    error?: string;
};
