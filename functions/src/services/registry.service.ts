// services/registry.service.ts
// Registry CRUD + 룩업 관리 (실전 최적화 버전)

import * as admin from 'firebase-admin';
import { Facet, Option, Sheet, FacetLookup, OptionLookup } from '../types/registry';
import {
    generateULID,
    slugify,
    normalizeLabel,
    serverTimestamp,
    makeFacetLookupKey,
    makeOptionLookupKey,
    makeOptionNormalizedKey
} from '../utils/registry';

const db = admin.firestore();

// ═══════════════════════════════════════════════════════════
// Facet CRUD
// ═══════════════════════════════════════════════════════════

/**
 * ✅ Facet 생성 (룩업 문서 포함)
 */
export async function createFacet(
    tenantId: string,
    data: {
        code: string;
        labels: { ko: string; en?: string };
        type?: 'single' | 'multi' | 'text' | 'time' | 'date';
        indexed?: boolean;
        clientId?: string;
    }
): Promise<Facet> {
    const registryRef = db.collection('tenants').doc(tenantId).collection('registry');

    // 1. 중복 확인 (룩업 사용)
    const lookupKey = makeFacetLookupKey(data.code);
    const lookupDoc = await registryRef.doc(`lookups/facetsByCode/${lookupKey}`).get();

    if (lookupDoc.exists) {
        const existing = lookupDoc.data() as FacetLookup;
        throw new Error(`Facet already exists: ${data.code} (${existing.facetId})`);
    }

    // 2. Facet 생성
    const facetId = data.clientId || generateULID('fct');

    const facet: Facet = {
        id: facetId,
        code: data.code,
        labels: data.labels,
        normalized: normalizeLabel(data.labels.ko),
        type: data.type || 'multi',
        indexed: data.indexed !== false,
        order: Date.now(),
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        clientId: data.clientId
    };

    // 3. ✅ 배치로 Facet + 룩업 동시 생성
    const batch = db.batch();

    batch.set(registryRef.doc(`facets/${facetId}`), facet);

    batch.set(registryRef.doc(`lookups/facetsByCode/${lookupKey}`), {
        code: data.code,
        facetId: facetId,
        createdAt: serverTimestamp()
    } as FacetLookup);

    await batch.commit();

    console.log(`✅ Created facet: ${data.code} (${facetId})`);

    return facet;
}

/**
 * ✅ Facet 찾기 (룩업 O(1))
 */
export async function findFacetByCode(
    tenantId: string,
    code: string
): Promise<Facet | null> {
    const registryRef = db.collection('tenants').doc(tenantId).collection('registry');

    const lookupKey = makeFacetLookupKey(code);
    const lookupDoc = await registryRef.doc(`lookups/facetsByCode/${lookupKey}`).get();

    if (!lookupDoc.exists) return null;

    const lookup = lookupDoc.data() as FacetLookup;
    const facetDoc = await registryRef.doc(`facets/${lookup.facetId}`).get();

    if (!facetDoc.exists) return null;

    return facetDoc.data() as Facet;
}

/**
 * Facet 업데이트
 */
export async function updateFacet(
    tenantId: string,
    facetId: string,
    updates: Partial<Facet>
): Promise<void> {
    const registryRef = db.collection('tenants').doc(tenantId).collection('registry');

    await registryRef.doc(`facets/${facetId}`).update({
        ...updates,
        updatedAt: serverTimestamp()
    });

    console.log(`✅ Updated facet: ${facetId}`);
}

/**
 * ✅ Facet 소프트 삭제 (archived)
 */
export async function archiveFacet(
    tenantId: string,
    facetId: string
): Promise<void> {
    await updateFacet(tenantId, facetId, { status: 'archived' });
    console.log(`🗑️ Archived facet: ${facetId}`);
}

// ═══════════════════════════════════════════════════════════
// Option CRUD
// ═══════════════════════════════════════════════════════════

/**
 * ✅ Option 생성 (룩업 문서 포함)
 */
export async function createOption(
    tenantId: string,
    data: {
        facetId: string;
        code: string;
        labels: { ko: string; en?: string };
        synonyms?: string[];
        clientId?: string;
    }
): Promise<Option> {
    const registryRef = db.collection('tenants').doc(tenantId).collection('registry');

    // 1. 중복 확인 (룩업 사용)
    const lookupKey = makeOptionLookupKey(data.facetId, data.code);
    const lookupDoc = await registryRef.doc(`lookups/optionsByCode/${lookupKey}`).get();

    if (lookupDoc.exists) {
        const existing = lookupDoc.data() as OptionLookup;
        throw new Error(`Option already exists: ${data.code} (${existing.optionId})`);
    }

    // 2. Option 생성
    const optionId = data.clientId || generateULID('opt');
    const normalized = normalizeLabel(data.labels.ko);

    const option: Option = {
        id: optionId,
        facetId: data.facetId,
        code: data.code,
        labels: data.labels,
        normalized: normalized,
        synonyms: data.synonyms || [],
        order: Date.now(),
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        clientId: data.clientId
    };

    // 3. ✅ 배치로 Option + 룩업 동시 생성
    const batch = db.batch();

    batch.set(registryRef.doc(`options/${optionId}`), option);

    // 룩업 1: code 기반
    batch.set(registryRef.doc(`lookups/optionsByCode/${lookupKey}`), {
        facetId: data.facetId,
        code: data.code,
        normalized: normalized,
        optionId: optionId,
        createdAt: serverTimestamp()
    } as OptionLookup);

    // 룩업 2: normalized 기반 (검색용)
    const normalizedKey = makeOptionNormalizedKey(data.facetId, normalized);
    batch.set(registryRef.doc(`lookups/optionsByNormalized/${normalizedKey}`), {
        facetId: data.facetId,
        code: data.code,
        normalized: normalized,
        optionId: optionId,
        createdAt: serverTimestamp()
    } as OptionLookup);

    await batch.commit();

    console.log(`✅ Created option: ${data.labels.ko} (${optionId})`);

    return option;
}

/**
 * ✅ Option 찾기 (룩업 O(1))
 */
export async function findOptionByLabel(
    tenantId: string,
    facetId: string,
    label: string
): Promise<Option | null> {
    const registryRef = db.collection('tenants').doc(tenantId).collection('registry');

    const normalized = normalizeLabel(label);
    const lookupKey = makeOptionNormalizedKey(facetId, normalized);
    const lookupDoc = await registryRef.doc(`lookups/optionsByNormalized/${lookupKey}`).get();

    if (!lookupDoc.exists) return null;

    const lookup = lookupDoc.data() as OptionLookup;
    const optionDoc = await registryRef.doc(`options/${lookup.optionId}`).get();

    if (!optionDoc.exists) return null;

    return optionDoc.data() as Option;
}

/**
 * ✅ Option 찾기 또는 생성 (idempotent)
 */
export async function findOrCreateOption(
    tenantId: string,
    facetId: string,
    label: string,
    code?: string
): Promise<Option> {
    // 먼저 찾기 시도
    const existing = await findOptionByLabel(tenantId, facetId, label);
    if (existing) {
        return existing;
    }

    // 없으면 생성
    const optionCode = code || slugify(label);
    return await createOption(tenantId, {
        facetId,
        code: optionCode,
        labels: { ko: label }
    });
}

/**
 * Option 업데이트
 */
export async function updateOption(
    tenantId: string,
    optionId: string,
    updates: Partial<Option>
): Promise<void> {
    const registryRef = db.collection('tenants').doc(tenantId).collection('registry');

    await registryRef.doc(`options/${optionId}`).update({
        ...updates,
        updatedAt: serverTimestamp()
    });

    console.log(`✅ Updated option: ${optionId}`);
}

/**
 * ✅ Option 소프트 삭제
 */
export async function archiveOption(
    tenantId: string,
    optionId: string
): Promise<void> {
    await updateOption(tenantId, optionId, { status: 'archived' });
    console.log(`🗑️ Archived option: ${optionId}`);
}

// ═══════════════════════════════════════════════════════════
// Sheet CRUD
// ═══════════════════════════════════════════════════════════

/**
 * Sheet 생성
 */
export async function createSheet(
    tenantId: string,
    data: {
        code: string;
        labels: { ko: string; en?: string };
        icon?: string;
        facetIds?: string[];
    }
): Promise<Sheet> {
    const registryRef = db.collection('tenants').doc(tenantId).collection('registry');

    const sheetId = generateULID('sht');

    const sheet: Sheet = {
        id: sheetId,
        code: data.code,
        labels: data.labels,
        icon: data.icon || '📦',
        facetIds: data.facetIds || [],
        order: Date.now(),
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    await registryRef.doc(`sheets/${sheetId}`).set(sheet);

    console.log(`✅ Created sheet: ${data.code} (${sheetId})`);

    return sheet;
}

/**
 * ✅ Sheet Facets 업데이트 (트랜잭션)
 */
export async function updateSheetFacets(
    tenantId: string,
    sheetId: string,
    facetId: string,
    add: boolean
): Promise<string[]> {
    const registryRef = db.collection('tenants').doc(tenantId).collection('registry');
    const sheetRef = registryRef.doc(`sheets/${sheetId}`);

    // ✅ 트랜잭션으로 안전하게 수정
    const newFacetIds = await db.runTransaction(async (transaction) => {
        const sheetDoc = await transaction.get(sheetRef);

        if (!sheetDoc.exists) {
            throw new Error(`Sheet not found: ${sheetId}`);
        }

        const sheet = sheetDoc.data() as Sheet;
        const currentFacetIds = sheet.facetIds || [];

        let updated: string[];

        if (add) {
            // 추가
            updated = [...new Set([...currentFacetIds, facetId])];
        } else {
            // 제거
            updated = currentFacetIds.filter(id => id !== facetId);

            // ✅ facetAliases도 함께 제거
            const aliases = { ...sheet.facetAliases };
            delete aliases[facetId];

            transaction.update(sheetRef, {
                facetIds: updated,
                facetAliases: aliases,
                updatedAt: serverTimestamp()
            });

            return updated;
        }

        transaction.update(sheetRef, {
            facetIds: updated,
            updatedAt: serverTimestamp()
        });

        return updated;
    });

    console.log(`✅ Updated sheet facets: ${sheetId}`);

    return newFacetIds;
}

/**
 * Sheet 목록 가져오기
 */
export async function getSheets(tenantId: string): Promise<Sheet[]> {
    const registryRef = db.collection('tenants').doc(tenantId).collection('registry');

    const snapshot = await registryRef
        .where('status', '==', 'active')
        .orderBy('order', 'asc')
        .get();

    return snapshot.docs
        .filter(doc => doc.id.startsWith('sheets/'))
        .map(doc => doc.data() as Sheet);
}

/**
 * Facet 목록 가져오기
 */
export async function getFacets(tenantId: string): Promise<Facet[]> {
    const registryRef = db.collection('tenants').doc(tenantId).collection('registry');

    const snapshot = await registryRef
        .where('status', '==', 'active')
        .orderBy('order', 'asc')
        .get();

    return snapshot.docs
        .filter(doc => doc.id.startsWith('facets/'))
        .map(doc => doc.data() as Facet);
}

/**
 * Option 목록 가져오기 (특정 Facet)
 */
export async function getOptions(
    tenantId: string,
    facetId: string
): Promise<Option[]> {
    const registryRef = db.collection('tenants').doc(tenantId).collection('registry');

    const snapshot = await registryRef
        .where('facetId', '==', facetId)
        .where('status', '==', 'active')
        .orderBy('order', 'asc')
        .get();

    return snapshot.docs
        .filter(doc => doc.id.startsWith('options/'))
        .map(doc => doc.data() as Option);
}