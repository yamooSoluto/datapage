// services/items.service.ts
// Items CRUD + flatFacetPairs 관리 (실전 최적화 버전)

import * as admin from 'firebase-admin';
import { Item } from '../types/registry';
import {
    generateULID,
    normalizeLabel,
    serverTimestamp,
    toFlatFacetPairs,
    chunk
} from '../utils/registry';

const db = admin.firestore();

// ═══════════════════════════════════════════════════════════
// Item CRUD
// ═══════════════════════════════════════════════════════════

/**
 * ✅ Item 생성 (flatFacetPairs 자동 생성)
 */
export async function createItem(
    tenantId: string,
    data: {
        sheetId: string;
        name: string;
        facetRefs?: { [facetId: string]: string[] };
        required?: boolean;
        clientId?: string;
        createdBy?: string;
    }
): Promise<Item> {
    const itemsRef = db.collection('tenants').doc(tenantId).collection('items');

    const itemId = data.clientId || generateULID('itm');

    // ✅ flatFacetPairs 자동 생성
    const flatFacetPairs = toFlatFacetPairs(data.facetRefs || {});

    const item: Item = {
        id: itemId,
        sheetId: data.sheetId,
        name: data.name,
        normalized: normalizeLabel(data.name),
        facetRefs: data.facetRefs || {},
        flatFacetPairs: flatFacetPairs,
        order: Date.now(),
        required: data.required || false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: data.createdBy,
        clientId: data.clientId
    };

    await itemsRef.doc(itemId).set(item);

    console.log(`✅ Created item: ${data.name} (${itemId})`);

    return item;
}

/**
 * ✅ Item 업데이트 (flatFacetPairs 자동 재생성)
 */
export async function updateItem(
    tenantId: string,
    itemId: string,
    updates: Partial<Item>,
    updatedBy?: string
): Promise<void> {
    const itemsRef = db.collection('tenants').doc(tenantId).collection('items');

    // facetRefs가 변경되면 flatFacetPairs도 재생성
    if (updates.facetRefs) {
        updates.flatFacetPairs = toFlatFacetPairs(updates.facetRefs);
    }

    // name이 변경되면 normalized도 재생성
    if (updates.name) {
        updates.normalized = normalizeLabel(updates.name);
    }

    await itemsRef.doc(itemId).update({
        ...updates,
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy
    });

    console.log(`✅ Updated item: ${itemId}`);
}

/**
 * Item 삭제
 */
export async function deleteItem(
    tenantId: string,
    itemId: string
): Promise<void> {
    const itemsRef = db.collection('tenants').doc(tenantId).collection('items');

    await itemsRef.doc(itemId).delete();

    console.log(`🗑️ Deleted item: ${itemId}`);
}

/**
 * Item 가져오기
 */
export async function getItem(
    tenantId: string,
    itemId: string
): Promise<Item | null> {
    const itemsRef = db.collection('tenants').doc(tenantId).collection('items');

    const doc = await itemsRef.doc(itemId).get();

    if (!doc.exists) return null;

    return doc.data() as Item;
}

/**
 * Items 목록 가져오기 (특정 Sheet)
 */
export async function getItemsBySheet(
    tenantId: string,
    sheetId: string,
    options?: {
        orderBy?: 'order' | 'name' | 'createdAt';
        limit?: number;
    }
): Promise<Item[]> {
    const itemsRef = db.collection('tenants').doc(tenantId).collection('items');

    let query = itemsRef.where('sheetId', '==', sheetId);

    if (options?.orderBy) {
        query = query.orderBy(options.orderBy, 'asc');
    } else {
        query = query.orderBy('order', 'asc');
    }

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const snapshot = await query.get();

    return snapshot.docs.map(doc => doc.data() as Item);
}

/**
 * ✅ Items 검색 (flatFacetPairs 활용)
 */
export async function searchItems(
    tenantId: string,
    sheetId: string,
    filters: {
        facetId: string;
        optionId: string;
    }[]
): Promise<Item[]> {
    if (filters.length === 0) {
        return getItemsBySheet(tenantId, sheetId);
    }

    const itemsRef = db.collection('tenants').doc(tenantId).collection('items');

    // ✅ array-contains로 검색
    // 주의: Firestore는 array-contains를 하나만 지원하므로,
    // 첫 번째 필터만 사용하고 나머지는 클라이언트에서 필터링
    const firstFilter = filters[0];
    const pair = `${firstFilter.facetId}|${firstFilter.optionId}`;

    let query = itemsRef
        .where('sheetId', '==', sheetId)
        .where('flatFacetPairs', 'array-contains', pair);

    const snapshot = await query.get();
    const items = snapshot.docs.map(doc => doc.data() as Item);

    // 나머지 필터는 클라이언트에서 처리
    if (filters.length > 1) {
        return items.filter(item => {
            return filters.every(filter => {
                const pair = `${filter.facetId}|${filter.optionId}`;
                return item.flatFacetPairs.includes(pair);
            });
        });
    }

    return items;
}

/**
 * Items 이름 검색
 */
export async function searchItemsByName(
    tenantId: string,
    sheetId: string,
    searchTerm: string
): Promise<Item[]> {
    const itemsRef = db.collection('tenants').doc(tenantId).collection('items');

    const normalized = normalizeLabel(searchTerm);

    // Firestore에서 부분 문자열 검색은 제한적이므로,
    // normalized 필드로 prefix 검색
    const snapshot = await itemsRef
        .where('sheetId', '==', sheetId)
        .where('normalized', '>=', normalized)
        .where('normalized', '<=', normalized + '\uf8ff')
        .get();

    return snapshot.docs.map(doc => doc.data() as Item);
}

// ═══════════════════════════════════════════════════════════
// ✅ 대량 작업 (Bulk Operations)
// ═══════════════════════════════════════════════════════════

/**
 * ✅ Items 대량 생성 (배치 500개 제한)
 */
export async function bulkCreateItems(
    tenantId: string,
    items: Array<{
        sheetId: string;
        name: string;
        facetRefs?: { [facetId: string]: string[] };
        required?: boolean;
    }>,
    createdBy?: string
): Promise<string[]> {
    const itemsRef = db.collection('tenants').doc(tenantId).collection('items');

    const itemIds: string[] = [];

    // 500개씩 청크로 나눠서 처리
    const chunks = chunk(items, 500);

    for (const chunkItems of chunks) {
        const batch = db.batch();

        for (const itemData of chunkItems) {
            const itemId = generateULID('itm');
            itemIds.push(itemId);

            const flatFacetPairs = toFlatFacetPairs(itemData.facetRefs || {});

            const item: Item = {
                id: itemId,
                sheetId: itemData.sheetId,
                name: itemData.name,
                normalized: normalizeLabel(itemData.name),
                facetRefs: itemData.facetRefs || {},
                flatFacetPairs: flatFacetPairs,
                order: Date.now(),
                required: itemData.required || false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: createdBy
            };

            batch.set(itemsRef.doc(itemId), item);
        }

        await batch.commit();

        console.log(`✅ Created ${chunkItems.length} items (batch)`);
    }

    console.log(`✅ Bulk created ${itemIds.length} items`);

    return itemIds;
}

/**
 * ✅ Items 대량 업데이트
 */
export async function bulkUpdateItems(
    tenantId: string,
    updates: Array<{
        itemId: string;
        data: Partial<Item>;
    }>,
    updatedBy?: string
): Promise<void> {
    const itemsRef = db.collection('tenants').doc(tenantId).collection('items');

    const chunks = chunk(updates, 500);

    for (const chunkUpdates of chunks) {
        const batch = db.batch();

        for (const update of chunkUpdates) {
            const data = { ...update.data };

            // facetRefs 변경 시 flatFacetPairs 재생성
            if (data.facetRefs) {
                data.flatFacetPairs = toFlatFacetPairs(data.facetRefs);
            }

            // name 변경 시 normalized 재생성
            if (data.name) {
                data.normalized = normalizeLabel(data.name);
            }

            batch.update(itemsRef.doc(update.itemId), {
                ...data,
                updatedAt: serverTimestamp(),
                updatedBy: updatedBy
            });
        }

        await batch.commit();

        console.log(`✅ Updated ${chunkUpdates.length} items (batch)`);
    }

    console.log(`✅ Bulk updated ${updates.length} items`);
}

/**
 * ✅ Items 대량 삭제
 */
export async function bulkDeleteItems(
    tenantId: string,
    itemIds: string[]
): Promise<void> {
    const itemsRef = db.collection('tenants').doc(tenantId).collection('items');

    const chunks = chunk(itemIds, 500);

    for (const chunkIds of chunks) {
        const batch = db.batch();

        for (const itemId of chunkIds) {
            batch.delete(itemsRef.doc(itemId));
        }

        await batch.commit();

        console.log(`✅ Deleted ${chunkIds.length} items (batch)`);
    }

    console.log(`✅ Bulk deleted ${itemIds.length} items`);
}

/**
 * ✅ 특정 Facet 제거 (전체 Items에서)
 */
export async function removeFacetFromAllItems(
    tenantId: string,
    facetId: string
): Promise<number> {
    const itemsRef = db.collection('tenants').doc(tenantId).collection('items');

    // flatFacetPairs에 해당 facetId가 포함된 items 찾기
    const snapshot = await itemsRef
        .where('flatFacetPairs', 'array-contains-any', [
            // Firestore 제한으로 실제로는 모든 items를 가져와서 필터링 필요
        ])
        .get();

    let count = 0;
    const chunks = chunk(snapshot.docs, 500);

    for (const chunkDocs of chunks) {
        const batch = db.batch();

        for (const doc of chunkDocs) {
            const item = doc.data() as Item;

            // facetRefs에서 제거
            const newFacetRefs = { ...item.facetRefs };
            delete newFacetRefs[facetId];

            // flatFacetPairs 재생성
            const newFlatFacetPairs = toFlatFacetPairs(newFacetRefs);

            batch.update(doc.ref, {
                facetRefs: newFacetRefs,
                flatFacetPairs: newFlatFacetPairs,
                updatedAt: serverTimestamp()
            });

            count++;
        }

        await batch.commit();
    }

    console.log(`✅ Removed facet ${facetId} from ${count} items`);

    return count;
}