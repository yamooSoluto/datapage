// hooks/useTemplates.ts
import useSWR from 'swr';

interface Facet {
    key: string;
    label: string;
    type: 'multi' | 'checkbox' | 'text';
    options?: string[];
    default?: any;
}

interface Template {
    id: string;
    title: string;
    icon: string;
    facets: Facet[];
}

interface Templates {
    [key: string]: Template;
}

export function useTemplates(tenantId: string) {
    const { data, error, mutate } = useSWR(
        tenantId ? `/api/templates?tenant=${tenantId}` : null,
        (url) => fetch(url).then(r => r.json())
    );

    const saveTemplates = async (templates: Templates) => {
        if (!tenantId) return;

        const res = await fetch(`/api/templates?tenant=${tenantId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templates })
        });

        if (res.ok) {
            mutate(); // SWR 캐시 갱신
        }

        return res.ok;
    };

    return {
        templates: (data?.templates || {}) as Templates,
        loading: !error && !data,
        error,
        mutate,
        saveTemplates
    };
}