// pages/mypage.tsx
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import CriteriaSheetEditor from '@/components/mypage/CriteriaSheetEditor';
import TemplateManager from '@/components/mypage/TemplateManager';
import { useTemplates } from '@/hooks/useTemplates';
import { useMatrixData } from '@/hooks/useMatrixData';
import { Settings } from 'lucide-react';

export default function MyPage() {
    const router = useRouter();
    const tenant = router.query.tenant as string;

    const [showTemplateManager, setShowTemplateManager] = useState(false);
    const { templates, saveTemplates, mutate } = useTemplates(tenant);

    const handleSaveTemplates = async (newTemplates: any) => {
        const success = await saveTemplates(newTemplates);
        if (success) {
            mutate();
            setShowTemplateManager(false);
            alert('템플릿 저장 완료!');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* 헤더 */}
            <div className="bg-white border-b sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">
                        마이페이지
                    </h1>

                    {/* 템플릿 관리 버튼 */}
                    <button
                        onClick={() => setShowTemplateManager(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 rounded-xl hover:border-yellow-400 transition-all"
                    >
                        <Settings className="w-4 h-4" />
                        <span className="font-medium">템플릿 관리</span>
                    </button>
                </div>
            </div>

            {/* 메인 컨텐츠 */}
            <div className="max-w-7xl mx-auto p-6">
                <CriteriaSheetEditor
                    tenantId={tenant}
                />
            </div>

            {/* 템플릿 관리 모달 */}
            {showTemplateManager && templates && (
                <TemplateManager
                    initialTemplates={templates}
                    onSave={handleSaveTemplates}
                    onClose={() => setShowTemplateManager(false)}
                />
            )}
        </div>
    );
}