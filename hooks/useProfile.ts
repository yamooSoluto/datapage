// hooks/useprogile.ts

import useSWR from 'swr';
export function useProfile(tenant: string) {
    const { data, error, mutate } = useSWR(
        tenant ? `/api/profile?tenant=${tenant}` : null,
        (url) => fetch(url).then(r => r.json())
    );
    // API가 바로 프로필 객체를 반환하므로 data를 그대로 profile로 노출
    return { profile: data, loading: !error && !data, error, mutate };
}