// hooks/useTemplates.ts
import useSWR from "swr";
const fetcher = (url: string) => fetch(url).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
});

export function useTemplates(tenant?: string) {
    const key = tenant ? `/api/templates?tenant=${encodeURIComponent(tenant)}` : null;
    const { data, error, isLoading, mutate } = useSWR(key, fetcher);
    return { data: data || null, isLoading, error, refresh: mutate };
}
