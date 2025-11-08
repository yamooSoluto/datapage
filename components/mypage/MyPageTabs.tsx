// components/mypage/MyPageTabs.tsx
// 마이페이지 탭 시스템 - 설정, 데이터 관리, 라이브러리

import React from "react";
import { Settings, Database, Library } from "lucide-react";
import SettingsPage from "./SettingsPage";
import CriteriaSheetEditor from "./CriteriaSheetEditor";
import LibraryManager from "./LibraryManager";

interface MyPageTabsProps {
    tenantId: string;
    initialData?: any;
    initialLibrary?: any;
    initialSettings?: any;
    templates?: any;
    onSave?: (data: any) => void;
    onSaveLibrary?: (data: any) => void;
    onSaveSettings?: (settings: any) => void;
}

export default function MyPageTabs({
    tenantId,
    initialData,
    initialLibrary,
    initialSettings,
    templates,
    onSave,
    onSaveLibrary,
    onSaveSettings,
}: MyPageTabsProps) {
    const [activeTab, setActiveTab] = React.useState<"settings" | "data" | "library">("settings");

    const tabs = [
        {
            key: "settings" as const,
            label: "설정",
            icon: Settings,
            description: "상호, 연락처, 채널 연동",
        },
        {
            key: "data" as const,
            label: "데이터 관리",
            icon: Database,
            description: "항목, 시트, 기준 관리",
        },
        {
            key: "library" as const,
            label: "라이브러리",
            icon: Library,
            description: "링크, 비밀번호, 규정 관리",
        },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* 최상위 탭 네비게이션 */}
            <div className="bg-white border-b sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.key;

                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex items-center gap-3 px-6 py-4 border-b-2 transition-all whitespace-nowrap ${isActive
                                        ? "border-gray-900 text-gray-900"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                        }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <div className="text-left hidden sm:block">
                                        <div className="font-semibold">{tab.label}</div>
                                        <div className="text-xs text-gray-500">{tab.description}</div>
                                    </div>
                                    <div className="text-left sm:hidden">
                                        <div className="font-semibold text-sm">{tab.label}</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 탭 컨텐츠 */}
            <div className="relative">
                {activeTab === "settings" && (
                    <SettingsPage
                        tenantId={tenantId}
                        initialSettings={initialSettings}
                        onSave={onSaveSettings}
                    />
                )}

                {activeTab === "data" && (
                    <CriteriaSheetEditor
                        tenantId={tenantId}
                        initialData={initialData}
                        templates={templates}
                        onSave={onSave}
                        library={initialLibrary}
                    />
                )}

                {activeTab === "library" && (
                    <LibraryManager
                        initialData={initialLibrary}
                        onSave={onSaveLibrary}
                    />
                )}
            </div>

            <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}