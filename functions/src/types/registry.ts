// types/registry.ts
// Registry 타입 정의 (실전 최적화 버전)

import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export type Language = 'ko' | 'en' | 'ja';

export interface Labels {
    ko: string;
    en?: string;
    ja?: string;
}

export interface Facet {
    id: string;              // fct_위치_xxx
    code: string;            // location (유니크)
    labels: Labels;
    normalized: string;      // 검색용 정규화 (소문자)
    type: 'single' | 'multi' | 'text' | 'time' | 'date';
    indexed: boolean;
    order: number;
    status: 'active' | 'hidden' | 'archived';
    createdAt: Timestamp | FieldValue;
    updatedAt: Timestamp | FieldValue;
    clientId?: string;       // 중복 방지용 (idempotent)
}

export interface Option {
    id: string;              // opt_1층_yyy
    facetId: string;         // fct_위치_xxx
    code: string;            // floor_1
    labels: Labels;
    normalized: string;      // 검색용 정규화
    synonyms: string[];      // ["로비", "1층 로비"]
    order: number;
    status: 'active' | 'hidden' | 'archived';
    createdAt: Timestamp | FieldValue;
    updatedAt: Timestamp | FieldValue;
    clientId?: string;
}

export interface Sheet {
    id: string;              // sht_시설_zzz
    code: string;            // facility
    labels: Labels;
    icon: string;            // 🏢
    facetIds: string[];      // [fct_위치_xxx, fct_비용_aaa]
    facetAliases?: {         // 시트별 표시명 커스터마이즈
        [facetId: string]: string;
    };
    order: number;
    manualOrder?: number;    // 드래그 재정렬용
    status: 'active' | 'hidden' | 'archived';
    createdAt: Timestamp | FieldValue;
    updatedAt: Timestamp | FieldValue;
}

export interface Item {
    id: string;              // itm_에어컨_111
    sheetId: string;         // sht_시설_zzz
    name: string;            // 에어컨
    normalized: string;      // 검색용 정규화

    // ✅ ID 참조 (메인)
    facetRefs: {
        [facetId: string]: string[];  // [optionId, ...]
    };

    // ✅ 파생 필드 (검색 최적화)
    flatFacetPairs: string[];  // ["fct_xxx|opt_yyy", "fct_zzz|opt_aaa"]

    order: number;
    manualOrder?: number;
    required?: boolean;

    // 메타데이터
    createdAt: Timestamp | FieldValue;
    updatedAt: Timestamp | FieldValue;
    createdBy?: string;      // userId
    updatedBy?: string;
    clientId?: string;
}

export interface Registry {
    facets: { [id: string]: Facet };
    options: { [id: string]: Option };
    sheets: { [id: string]: Sheet };
}

// ✅ 룩업 문서 (O(1) 조회)
export interface FacetLookup {
    code: string;            // location
    facetId: string;         // fct_위치_xxx
    createdAt: Timestamp | FieldValue;
}

export interface OptionLookup {
    facetId: string;         // fct_위치_xxx
    code: string;            // floor_1
    normalized: string;      // 검색용
    optionId: string;        // opt_1층_yyy
    createdAt: Timestamp | FieldValue;
}

// 인덱스 (서브컬렉션 방식)
export interface IndexItem {
    itemId: string;
    itemName: string;
    createdAt: Timestamp | FieldValue;
}

// 스키마 버전
export interface SchemaVersion {
    version: number;         // 1
    appliedAt: Timestamp | FieldValue;
    migrations: string[];    // ['v1_initial', 'v2_add_normalized']
}

// 마이그레이션 기록
export interface Migration {
    id: string;              // v2_add_normalized
    version: number;         // 2
    description: string;
    appliedAt: Timestamp | FieldValue;
    success: boolean;
    error?: string;
}