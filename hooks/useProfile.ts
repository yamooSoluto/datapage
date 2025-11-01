import useSWR from 'swr';
export function useProfile(tenantId: string) {
    const { data, error, mutate } = useSWR(
        tenantId ? `/api/profile?tenantId=${tenantId}` : null,
        (url) => fetch(url).then(r => r.json())
    );
    return { profile: data?.data, loading: !error && !data, error, mutate };
}
