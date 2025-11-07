// functions/index.ts
// Cloud Functions - 자동 파생필드 관리 및 정리 작업

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { Item } from './types/registry';
import { toFlatFacetPairs, normalizeLabel } from './utils/registry';

admin.initializeApp();
const db = admin.firestore();

// ═══════════════════════════════════════════════════════════
// ✅ Item 변경 시 자동 파생필드 재계산
// ═══════════════════════════════════════════════════════════

export const onItemWrite = functions.firestore
    .document('tenants/{tenantId}/items/{itemId}')
    .onWrite(async (change, context) => {
        const after = change.after.exists ? change.after.data() as Item : null;

        if (!after) {
            console.log('Item deleted, skipping');
            return;
        }

        const { tenantId, itemId } = context.params;

        // facetRefs로부터 flatFacetPairs 재계산
        const facetRefs = after.facetRefs || {};
        const newFlatPairs = toFlatFacetPairs(facetRefs);

        // name으로부터 normalized 재계산
        const newNormalized = normalizeLabel(after.name || '');

        // 변경 필요 여부 확인
        const currentFlatPairs = after.flatFacetPairs || [];
        const currentNormalized = after.normalized || '';

        const flatPairsChanged = JSON.stringify(currentFlatPairs.sort()) !== JSON.stringify(newFlatPairs.sort());
        const normalizedChanged = currentNormalized !== newNormalized;

        if (flatPairsChanged || normalizedChanged) {
            console.log(`♻️  Updating derived fields for item: ${itemId}`);

            const updates: any = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            if (flatPairsChanged) {
                updates.flatFacetPairs = newFlatPairs;
            }

            if (normalizedChanged) {
                updates.normalized = newNormalized;
            }

            await change.after.ref.update(updates);

            console.log(`✅ Updated derived fields for ${itemId}`);
        }
    });

// ═══════════════════════════════════════════════════════════
// ✅ Facet 삭제 시 Items 정리 (백그라운드)
// ═══════════════════════════════════════════════════════════

export const onFacetArchive = functions.firestore
    .document('tenants/{tenantId}/registry/{documentId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();

        const { tenantId, documentId } = context.params;

        // documentId가 facets/로 시작하지 않으면 무시
        if (!documentId.startsWith('facets/')) {
            return;
        }

        // facetId 추출 (facets/ 제거)
        const facetId = documentId.replace('facets/', '');

        // status가 'archived'로 변경된 경우
        if (before.status !== 'archived' && after.status === 'archived') {

            console.log(`🗑️ Facet archived: ${facetId}, cleaning up items...`);

            // 해당 facet을 참조하는 모든 items 찾기
            const itemsRef = db.collection('tenants').doc(tenantId).collection('items');

            // flatFacetPairs에서 facetId로 시작하는 것들 찾기
            const snapshot = await itemsRef.get();

            const batch = db.batch();
            let count = 0;

            for (const doc of snapshot.docs) {
                const item = doc.data() as Item;

                // facetRefs에서 제거
                if (item.facetRefs && item.facetRefs[facetId]) {
                    const newFacetRefs = { ...item.facetRefs };
                    delete newFacetRefs[facetId];

                    // flatFacetPairs 재생성
                    const newFlatPairs = toFlatFacetPairs(newFacetRefs);

                    batch.update(doc.ref, {
                        facetRefs: newFacetRefs,
                        flatFacetPairs: newFlatPairs,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    count++;

                    // 배치 500개 제한
                    if (count >= 500) {
                        await batch.commit();
                        console.log(`✅ Cleaned ${count} items (batch)`);
                        count = 0;
                    }
                }
            }

            if (count > 0) {
                await batch.commit();
                console.log(`✅ Cleaned ${count} items (final)`);
            }

            console.log(`✅ Facet cleanup complete: ${facetId}`);
        }
    });

// ═══════════════════════════════════════════════════════════
// ✅ Option 삭제 시 Items 정리
// ═══════════════════════════════════════════════════════════

export const onOptionArchive = functions.firestore
    .document('tenants/{tenantId}/registry/{documentId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();

        const { tenantId, documentId } = context.params;

        // documentId가 options/로 시작하지 않으면 무시
        if (!documentId.startsWith('options/')) {
            return;
        }

        // optionId 추출 (options/ 제거)
        const optionId = documentId.replace('options/', '');

        if (before.status !== 'archived' && after.status === 'archived') {
            const facetId = after.facetId;

            console.log(`🗑️ Option archived: ${optionId}, cleaning up items...`);

            const itemsRef = db.collection('tenants').doc(tenantId).collection('items');
            const pair = `${facetId}|${optionId}`;

            // array-contains로 해당 pair를 가진 items 찾기
            const snapshot = await itemsRef
                .where('flatFacetPairs', 'array-contains', pair)
                .get();

            const batch = db.batch();
            let count = 0;

            for (const doc of snapshot.docs) {
                const item = doc.data() as Item;

                // facetRefs에서 해당 optionId 제거
                const newFacetRefs = { ...item.facetRefs };

                if (newFacetRefs[facetId]) {
                    newFacetRefs[facetId] = newFacetRefs[facetId].filter(id => id !== optionId);

                    // 빈 배열이면 facet 자체 제거
                    if (newFacetRefs[facetId].length === 0) {
                        delete newFacetRefs[facetId];
                    }
                }

                // flatFacetPairs 재생성
                const newFlatPairs = toFlatFacetPairs(newFacetRefs);

                batch.update(doc.ref, {
                    facetRefs: newFacetRefs,
                    flatFacetPairs: newFlatPairs,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                count++;

                if (count >= 500) {
                    await batch.commit();
                    console.log(`✅ Cleaned ${count} items (batch)`);
                    count = 0;
                }
            }

            if (count > 0) {
                await batch.commit();
                console.log(`✅ Cleaned ${count} items (final)`);
            }

            console.log(`✅ Option cleanup complete: ${optionId}`);
        }
    });

// ═══════════════════════════════════════════════════════════
// 🔧 유틸리티 Functions
// ═══════════════════════════════════════════════════════════

/**
 * ✅ 모든 Items의 파생필드 재생성 (수동 트리거)
 */
export const rebuildDerivedFields = functions.https.onCall(async (data, context) => {
    // 인증 확인
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const tenantId = data.tenantId;

    if (!tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId is required');
    }

    console.log(`🔧 Rebuilding derived fields for tenant: ${tenantId}`);

    const itemsRef = db.collection('tenants').doc(tenantId).collection('items');
    const snapshot = await itemsRef.get();

    let count = 0;
    let batchCount = 0;
    let batch = db.batch();

    for (const doc of snapshot.docs) {
        const item = doc.data() as Item;

        // flatFacetPairs 재생성
        const newFlatPairs = toFlatFacetPairs(item.facetRefs || {});

        // normalized 재생성
        const newNormalized = normalizeLabel(item.name || '');

        batch.update(doc.ref, {
            flatFacetPairs: newFlatPairs,
            normalized: newNormalized,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        count++;
        batchCount++;

        // 배치 500개마다 커밋
        if (batchCount >= 500) {
            await batch.commit();
            console.log(`✅ Rebuilt ${count} items so far...`);
            batchCount = 0;
            batch = db.batch();
        }
    }

    // 남은 배치 커밋
    if (batchCount > 0) {
        await batch.commit();
    }

    console.log(`✅ Rebuilt derived fields for ${count} items`);

    return { success: true, count };
});

/**
 * ✅ 스키마 버전 확인
 */
export const checkSchemaVersion = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const tenantId = data.tenantId;

    const metaDoc = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('meta')
        .doc('schema')
        .get();

    if (!metaDoc.exists) {
        return { version: 0, migrations: [] };
    }

    return metaDoc.data();
});

/**
 * ✅ 통계 생성 (Scheduled)
 */
export const generateStats = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
        console.log('📊 Generating statistics...');

        // 모든 테넌트의 통계 생성
        const tenantsSnap = await db.collection('tenants').get();

        for (const tenantDoc of tenantsSnap.docs) {
            const tenantId = tenantDoc.id;

            // Items 개수
            const itemsSnap = await db
                .collection('tenants')
                .doc(tenantId)
                .collection('items')
                .count()
                .get();

            const itemCount = itemsSnap.data().count;

            // Facets 개수
            const facetsSnap = await db
                .collection('tenants')
                .doc(tenantId)
                .collection('registry')
                .where('status', '==', 'active')
                .get();

            const facetCount = facetsSnap.docs.filter(doc => doc.id.startsWith('facets/')).length;

            // 통계 저장
            await db
                .collection('tenants')
                .doc(tenantId)
                .collection('meta')
                .doc('stats')
                .set({
                    itemCount,
                    facetCount,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

            console.log(`✅ Generated stats for tenant: ${tenantId}`);
        }

        console.log('✅ Statistics generation complete');
    });