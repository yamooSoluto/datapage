// hooks/useMatrixData.ts
import useSWR from "swr";

export type MatrixItem = {
    id: string;
    type: "spaces" | "facilities" | "seats" | string;
    name: string;
    isRequired?: boolean;
    data?: Record<string, any>; // { existence?: boolean, location?, regulations? ... }
    [k: string]: any;
};

export type MatrixLink = {
    id: string;
    type: "space_facility" | "space_policy" | string;
    fromId: string;
    toId: string;
    attributes?: Record<string, any>;
    [k: string]: any;
};

const fetcher = (url: string) => fetch(url).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
});

export function useMatrixData(tenant?: string) {
    const key = tenant ? `/api/matrix?tenant=${encodeURIComponent(tenant)}` : null;
    const { data, error, isLoading, mutate } = useSWR(key, fetcher);

    const items: MatrixItem[] = data?.items || [];
    const links: MatrixLink[] = data?.links || [];

    // === actions (API 호출 후 mutate) ===
    const addItem = async (tenantId: string, payload: Partial<MatrixItem>) => {
        await fetch(`/api/items?tenant=${encodeURIComponent(tenantId)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        await mutate();
    };

    const updateItem = async (tenantId: string, id: string, patch: Partial<MatrixItem>) => {
        await fetch(`/api/items?tenant=${encodeURIComponent(tenantId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, patch }),
        });
        await mutate();
    };

    const deleteItem = async (tenantId: string, id: string) => {
        await fetch(`/api/items?tenant=${encodeURIComponent(tenantId)}&id=${encodeURIComponent(id)}`, {
            method: "DELETE",
        });
        await mutate();
    };

    const toggleExistence = async (tenantId: string, id: string, existence: boolean) => {
        await updateItem(tenantId, id, { "data": { existence } });
    };

    const addLink = async (tenantId: string, payload: Partial<MatrixLink>) => {
        await fetch(`/api/links?tenant=${encodeURIComponent(tenantId)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        await mutate();
    };

    const updateLink = async (tenantId: string, id: string, patch: Partial<MatrixLink>) => {
        await fetch(`/api/links?tenant=${encodeURIComponent(tenantId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, patch }),
        });
        await mutate();
    };

    const deleteLink = async (tenantId: string, id: string) => {
        await fetch(`/api/links?tenant=${encodeURIComponent(tenantId)}&id=${encodeURIComponent(id)}`, {
            method: "DELETE",
        });
        await mutate();
    };

    return {
        items, links, isLoading, error,
        refresh: mutate,
        addItem, updateItem, deleteItem, toggleExistence,
        addLink, updateLink, deleteLink,
    };
}
