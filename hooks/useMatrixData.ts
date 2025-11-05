// hooks/useMatrixData.ts
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebaseClient';
import {
    collection,
    query,
    where,
    onSnapshot,
    writeBatch,
    doc,
    serverTimestamp,
    orderBy,
    setDoc,      // ✅ 추가
    deleteDoc    // ✅ 추가
} from 'firebase/firestore';

interface ItemMeta {
    id: string;
    type: 'space' | 'facility' | 'seat';
    name: string;
    order: number;
    isDefault?: boolean;
    isExample?: boolean;
}

interface MatrixItem {
    _meta: ItemMeta;
    [key: string]: any; // 동적 필드들
}

interface MatrixData {
    [itemId: string]: MatrixItem;
}

export function useMatrixData(tenantId: string, sheetType: 'space' | 'facility' | 'seat') {
    const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!tenantId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const q = query(
                collection(db, `tenants/${tenantId}/items`),
                where('type', '==', sheetType),
                orderBy('order', 'asc')
            );

            const unsubscribe = onSnapshot(
                q,
                (snapshot) => {
                    const items: MatrixData = {};

                    snapshot.docs.forEach(docSnap => {
                        const data = docSnap.data();

                        // Firebase 관계형 데이터 → 매트릭스 형태로 변환
                        items[docSnap.id] = {
                            _meta: {
                                id: docSnap.id,
                                type: data.type,
                                name: data.name,
                                order: data.order || 0,
                                isDefault: data.isDefault || false,
                                isExample: data.isExample || false,
                            },
                            // data 필드의 내용을 펼침 (위치, 비용, 소음 등)
                            ...(data.data || {})
                        };
                    });

                    setMatrixData(items);
                    setLoading(false);
                },
                (err) => {
                    console.error('[useMatrixData] Error:', err);
                    setError(err as Error);
                    setLoading(false);
                }
            );

            return unsubscribe;
        } catch (err) {
            console.error('[useMatrixData] Setup error:', err);
            setError(err as Error);
            setLoading(false);
        }
    }, [tenantId, sheetType]);

    /**
     * 매트릭스 데이터 저장 → Firebase 관계형으로 변환
     */
    const saveMatrixData = async (updatedMatrix: MatrixData) => {
        if (!tenantId) throw new Error('tenantId is required');

        const batch = writeBatch(db);

        Object.entries(updatedMatrix).forEach(([itemId, itemData]) => {
            const { _meta, ...dataFields } = itemData;
            const itemRef = doc(db, `tenants/${tenantId}/items`, itemId);

            // 매트릭스 형태 → Firebase 관계형으로 변환
            batch.update(itemRef, {
                data: dataFields, // 모든 필드를 data 객체에 저장
                updatedAt: serverTimestamp()
            });
        });

        await batch.commit();
    };

    /**
     * 아이템 추가
     */
    const addItem = async (name: string, order?: number) => {
        if (!tenantId) throw new Error('tenantId is required');

        const itemRef = doc(collection(db, `tenants/${tenantId}/items`));

        const newItem = {
            type: sheetType,
            name,
            order: order ?? Object.keys(matrixData || {}).length,
            isDefault: false,
            isExample: false,
            data: {
                existence: sheetType === 'facility' ? false : undefined
            },
            createdAt: serverTimestamp()
        };

        // ✅ .set() → setDoc()
        await setDoc(itemRef, newItem);
        return itemRef.id;
    };

    /**
     * 아이템 삭제
     */
    const deleteItem = async (itemId: string) => {
        if (!tenantId) throw new Error('tenantId is required');

        const itemRef = doc(db, `tenants/${tenantId}/items`, itemId);

        // ✅ .delete() → deleteDoc()
        await deleteDoc(itemRef);
    };

    /**
     * 아이템 순서 변경
     */
    const reorderItems = async (itemIds: string[]) => {
        if (!tenantId) throw new Error('tenantId is required');

        const batch = writeBatch(db);

        itemIds.forEach((itemId, index) => {
            const itemRef = doc(db, `tenants/${tenantId}/items`, itemId);
            batch.update(itemRef, { order: index });
        });

        await batch.commit();
    };

    return {
        matrixData,
        loading,
        error,
        saveMatrixData,
        addItem,
        deleteItem,
        reorderItems
    };
}