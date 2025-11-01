import TenantPortal from './index';

export default function DevPreview() {
    return (
        <TenantPortal
            devPreviewMode={true}
            mockTenant={{
                id: 't_preview',
                brandName: 'Preview Brand',
                plan: 'pro',
                email: 'preview@yamoo.ai'
            }}
        />
    );
}
