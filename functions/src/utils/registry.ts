// utils/registry.ts
// Registry 유틸리티 함수들 (실전 최적화 버전)

import { ulid } from 'ulid';
import * as admin from 'firebase-admin';

/**
 * ULID 생성 (prefix 포함)
 */
export function generateULID(prefix: 'fct' | 'opt' | 'sht' | 'itm' = 'itm'): string {
    return `${prefix}_${ulid()}`;
}

/**
 * 문자열을 slug로 변환
 */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9가-힣]+/g, '_')
        .replace(/^_|_$/g, '')
        .replace(/_+/g, '_');
}

/**
 * 라벨 정규화 (검색/매칭용)
 * - 공백 제거
 * - 소문자 변환
 * - 특수문자 제거
 */
export function normalizeLabel(label: string): string {
    return label
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')  // 공백 완전 제거
        .replace(/[^\w가-힣]/g, '');  // 특수문자 제거
}

/**
 * ✅ flatFacetPairs 생성 (검색 최적화)
 */
export function toFlatFacetPairs(facetRefs: { [facetId: string]: string[] }): string[] {
    const pairs: string[] = [];

    for (const [facetId, optionIds] of Object.entries(facetRefs || {})) {
        for (const optionId of optionIds || []) {
            pairs.push(`${facetId}|${optionId}`);
        }
    }

    return pairs;
}

/**
 * flatFacetPairs 파싱
 */
export function parseFlatFacetPairs(pairs: string[]): { [facetId: string]: string[] } {
    const result: { [facetId: string]: string[] } = {};

    for (const pair of pairs) {
        const [facetId, optionId] = pair.split('|');
        if (facetId && optionId) {
            if (!result[facetId]) result[facetId] = [];
            result[facetId].push(optionId);
        }
    }

    return result;
}

/**
 * Facet 코드에서 기본 라벨 추론
 */
export function inferFacetLabel(code: string): string {
    const map: { [key: string]: string } = {
        location: '위치',
        cost: '비용',
        hours: '이용시간',
        existence: '존재',
        type: '유형',
        capacity: '정원',
        noise: '소음규정',
        eating: '취식규정',
        quantity: '수량',
        access: '이용방법',
        seat_type: '좌석유형',
        equipment: '장비'
    };
    return map[code] || code;
}

/**
 * 시트 코드에서 기본 정보 추론
 */
export function inferSheetInfo(code: string): { label: string; icon: string } {
    const map: { [key: string]: { label: string; icon: string } } = {
        facility: { label: '시설/비품', icon: '🏢' },
        space: { label: '공간', icon: '🚪' },
        room: { label: '룸/존', icon: '🚪' },
        seat: { label: '좌석', icon: '💺' },
        product: { label: '상품/서비스', icon: '🎫' },
        rules: { label: '규정', icon: '📋' },
        equipment: { label: '운동기구', icon: '🏋️' }
    };
    return map[code] || { label: code, icon: '📦' };
}

/**
 * 배열을 객체로 변환 (id를 key로)
 */
export function arrayToMap<T extends { id: string }>(arr: T[]): { [id: string]: T } {
    return arr.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
    }, {} as { [id: string]: T });
}

/**
 * 객체를 배열로 변환 (정렬 포함)
 */
export function mapToArray<T extends { order: number }>(
    map: { [id: string]: T }
): T[] {
    return Object.values(map).sort((a, b) => a.order - b.order);
}

/**
 * ✅ 서버 타임스탬프 (권장)
 */
export function serverTimestamp() {
    return admin.firestore.FieldValue.serverTimestamp();
}

/**
 * 현재 시간 (fallback)
 */
export function now(): number {
    return Date.now();
}

/**
 * 안전한 라벨 가져오기
 */
export function getLabel(
    labels: { [lang: string]: string } | undefined,
    lang: string = 'ko'
): string {
    if (!labels) return '';
    return labels[lang] || labels['ko'] || labels['en'] || '';
}

/**
 * ✅ 룩업 키 생성
 */
export function makeFacetLookupKey(code: string): string {
    return `facet_${slugify(code)}`;
}

export function makeOptionLookupKey(facetId: string, code: string): string {
    return `${facetId}_${slugify(code)}`;
}

export function makeOptionNormalizedKey(facetId: string, normalized: string): string {
    return `${facetId}_${normalized}`;
}

/**
 * 배치 처리 유틸
 */
export function chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * 디바운스
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

/**
 * 재시도 로직
 */
export async function retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
): Promise<T> {
    let lastError: Error;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            }
        }
    }

    throw lastError!;
}

