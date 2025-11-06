// pages/mypage/data.jsx
import CriteriaSheetEditor from '@/components/mypage/CriteriaSheetEditor';

export default function MyPageDataEditor() {
    const handleSave = async (data) => {
        // Firestore 저장
        await fetch('/api/tenant/criteria', {
            method: 'POST',
            body: JSON.stringify({
                tenantId: 'tenant_123',
                data: data
            })
        });
    };

    return (
        <CriteriaSheetEditor
            tenantId="tenant_123"
            onSave={handleSave}
        />
    );
}