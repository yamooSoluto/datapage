// components/mypage/MyPageTabs.tsx
// 마이페이지 탭 시스템 - 설정, 데이터 관리, 라이브러리

import React from "react";
import { Settings, Database, Library, Map } from "lucide-react";
import SettingsPage from "./SettingsPage";
import CriteriaSheetEditor from "./CriteriaSheetEditor";
import LibraryManager from "./LibraryManager";
import MiniMapManager from "./MiniMapManager";
import type { CriteriaSheetData } from "@/lib/mapPalette";

interface MyPageTabsProps {
    tenantId: string;
    initialData?: CriteriaSheetData | null;
    initialLibrary?: any;
    initialSettings?: any;
    templates?: any;
    onSave?: (data: any) => void;
    onSaveLibrary?: (data: any) => void;
    onSaveSettings?: (settings: any) => void;
    defaultTab?: "settings" | "minimap" | "data" | "library"; // 기본 탭 설정
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
    defaultTab = "settings",
}: MyPageTabsProps) {
    const [activeTab, setActiveTab] = React.useState<"settings" | "minimap" | "data" | "library">(defaultTab);

    // defaultTab이 'library'면 헤더 없이 바로 라이브러리만 렌더링
    if (defaultTab === "library") {
        return (
            <div className="bg-gray-50">
                <LibraryManager
                    initialData={initialLibrary}
                    onSave={onSaveLibrary}
                />
            </div>
        );
    }

    // defaultTab이 'settings'면 설정만 렌더링
    if (defaultTab === "settings") {
        return (
            <div className="bg-gray-50">
                <SettingsPage
                    tenantId={tenantId}
                    initialSettings={initialSettings}
                    onSave={onSaveSettings}
                />
            </div>
        );
    }

    const tabs = [
        {
            key: "settings" as const,
            label: "설정",
            icon: Settings,
        },
        {
            key: "minimap" as const,
            label: "미니맵",
            icon: Map,
        },
        {
            key: "data" as const,
            label: "데이터",
            icon: Database,
        },
        {
            key: "library" as const,
            label: "라이브러리",
            icon: Library,
        },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Level 1: 전역 네비게이션 - 모바일 최적화 */}
            <div className="bg-white border-b sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-2 sm:px-6 py-2">
                    <nav className="flex bg-gray-50 rounded-xl p-0.5 sm:p-1 gap-0.5 sm:gap-1">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.key;

                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`
                                        flex-1 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all
                                        ${isActive
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                        }
                                    `}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>
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

                {activeTab === "minimap" && (
                    <MiniMapManager
                        tenantId={tenantId}
                        criteriaData={initialData}
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