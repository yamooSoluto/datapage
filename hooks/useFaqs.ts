// hooks/useFaq.ts

import useSWR from 'swr';
export function useFaqs(tenantId: string) {
    const { data, error, mutate } = useSWR(
        tenantId ? `/api/faqs?tenantId=${tenantId}` : null,
        (url) => fetch(url).then(r => r.json())
    );
    return { items: data?.items || [], loading: !error && !data, error, mutate };
}
