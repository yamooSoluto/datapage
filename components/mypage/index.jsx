// pages/mypage/index.jsx (예시)
// 템플릿 관리 + 데이터 입력 통합

import React from "react";
import CriteriaSheetEditor from "@/components/mypage/CriteriaSheetEditor";
import TemplateManager from "@/components/mypage/TemplateManager";
import { Settings } from "lucide-react";

export default function MyPage() {
    const [activeTab, setActiveTab] = React.useState('mypage');
    const [showTemplateManager, setShowTemplateManager] = React.useState(false);
    const [templates, setTemplates] = React.useState(null);
    const [criteriaData, setCriteriaData] = React.useState(null);

    // 템플릿 불러오기
    React.useEffect(() => {
        // API에서 템플릿 불러오기
        // fetch('/api/templates').then(...)

        // 임시 기본값
        import('@/components/mypage/CriteriaSheetEditor').then(module => {
            // 여기서 SHEET_TEMPLATES를 가져올 수 있다면...
            // 아니면 별도 API로
        });
    }, []);

    // 템플릿 저장
    const handleSaveTemplates = async (newTemplates) => {
        try {
            await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTemplates)
            });

            setTemplates(newTemplates);
            setShowTemplateManager(false);
        } catch (err) {
            alert('템플릿 저장 실패: ' + err.message);
        }
    };

    // 데이터 저장
    const handleSaveData = async (data) => {
        try {
            await fetch('/api/criteria-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            setCriteriaData(data);
        } catch (err) {
            throw new Error('데이터 저장 실패');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* 탭 네비게이션 */}
            <div className="bg-white border-b">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex gap-4">
                        <button
                            onClick={() => setActiveTab('mypage')}
                            className={`px-4 py-3 font-medium border-b-2 transition-colors ${activeTab === 'mypage'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            마이페이지
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`px-4 py-3 font-medium border-b-2 transition-colors ${activeTab === 'settings'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            설정
                        </button>
                    </div>
                </div>
            </div>

            {/* 마이페이지 탭 */}
            {activeTab === 'mypage' && (
                <div className="relative">
                    {/* 템플릿 관리 버튼 (우측 상단 고정) */}
                    <button
                        onClick={() => setShowTemplateManager(true)}
                        className="fixed top-20 right-6 z-40 flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 rounded-xl shadow-lg hover:shadow-xl hover:border-blue-400 transition-all"
                        title="옵션 템플릿 관리"
                    >
                        <Settings className="w-4 h-4" />
                        <span className="text-sm font-medium">템플릿 관리</span>
                    </button>

                    {/* 데이터 편집기 */}
                    <CriteriaSheetEditor
                        tenantId="tenant_123"
                        initialData={criteriaData}
                        onSave={handleSaveData}
                    />

                    {/* 템플릿 관리 모달 */}
                    {showTemplateManager && templates && (
                        <TemplateManager
                            initialTemplates={templates}
                            onSave={handleSaveTemplates}
                            onClose={() => setShowTemplateManager(false)}
                        />
                    )}
                </div>
            )}

            {/* 설정 탭 */}
            {activeTab === 'settings' && (
                <div className="max-w-7xl mx-auto p-6">
                    <div className="bg-white rounded-2xl shadow-sm p-6">
                        <h2 className="text-xl font-bold mb-4">설정</h2>
                        <div className="space-y-4">
                            <button
                                onClick={() => setShowTemplateManager(true)}
                                className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2"
                            >
                                <Settings className="w-4 h-4" />
                                옵션 템플릿 관리
                            </button>
                            <p className="text-sm text-gray-500">
                                시트별 필드, 그룹, 옵션을 편집할 수 있습니다.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}