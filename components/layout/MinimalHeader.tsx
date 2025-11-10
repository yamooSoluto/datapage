// components/layout/MinimalHeader.tsx
// 야무 브랜드 감성 + 미니멀 디자인

import React, { useState } from 'react';
import { MessageSquare, Database, Settings, LogOut, Menu, X, BookOpen, BarChart3 } from 'lucide-react';

interface MinimalHeaderProps {
    currentTab: string;
    onTabChange: (tab: string) => void;
    brandName?: string;
    plan?: string;
    onLogout: () => void;
}

export default function MinimalHeader({
    currentTab,
    onTabChange,
    brandName = "야무",
    plan = "trial",
    onLogout
}: MinimalHeaderProps) {
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    const tabs = [
        { key: 'conversations', label: '대화', icon: MessageSquare },
        { key: 'faq', label: 'FAQ', icon: BookOpen },
        { key: 'stats', label: '통계', icon: BarChart3 },
        { key: 'data', label: '데이터', icon: Database },
    ];

    const planBadge = {
        trial: 'bg-gradient-to-r from-green-50/80 to-emerald-50/80 text-green-700 border-green-200/50',
        starter: 'bg-gradient-to-r from-blue-50/80 to-cyan-50/80 text-blue-700 border-blue-200/50',
        pro: 'bg-gradient-to-r from-purple-50/80 to-pink-50/80 text-purple-700 border-purple-200/50',
        business: 'bg-gradient-to-r from-indigo-50/80 to-purple-50/80 text-indigo-700 border-indigo-200/50',
        enterprise: 'bg-gradient-to-r from-pink-50/80 to-rose-50/80 text-pink-700 border-pink-200/50',
    };

    return (
        <>
            {/* 데스크톱 헤더 - 솜사탕 그라데이션 배경 */}
            <header className="hidden md:block sticky top-0 z-50 bg-gradient-to-r from-pink-50/70 via-yellow-50/70 to-sky-50/70 backdrop-blur-xl border-b border-white/50">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex items-center justify-between h-12">
                        {/* 로고 & 브랜드 */}
                        <div className="flex items-center gap-3">
                            <img
                                src="/logo.png"
                                alt="야무"
                                className="w-7 h-7 object-contain"
                            />
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-900">{brandName}</span>
                                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border backdrop-blur-sm ${planBadge[plan as keyof typeof planBadge] || planBadge.trial}`}>
                                    {plan === 'trial' ? 'Trial' : plan.charAt(0).toUpperCase() + plan.slice(1)}
                                </span>
                            </div>
                        </div>

                        {/* 탭 네비게이션 - 슬림한 스타일 */}
                        <nav className="flex items-center gap-1">
                            {tabs.map(tab => {
                                const Icon = tab.icon;
                                const isActive = currentTab === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => onTabChange(tab.key)}
                                        className={`
                                            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                                            ${isActive
                                                ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 shadow-sm'
                                                : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
                                            }
                                        `}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </nav>

                        {/* 우측 액션 - 슬림한 아이콘 */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => onTabChange('settings')}
                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-white/60 rounded-full transition-colors"
                                title="설정"
                            >
                                <Settings className="w-4 h-4" />
                            </button>
                            <button
                                onClick={onLogout}
                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-white/60 rounded-full transition-colors"
                                title="로그아웃"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* 모바일 헤더 */}
            <header className="md:hidden sticky top-0 z-50 bg-gradient-to-r from-pink-50/70 via-yellow-50/70 to-sky-50/70 backdrop-blur-xl border-b border-white/50">
                <div className="px-4">
                    <div className="flex items-center justify-between h-12">
                        {/* 로고 & 브랜드 */}
                        <div className="flex items-center gap-2">
                            <img
                                src="/logo.png"
                                alt="야무"
                                className="w-7 h-7 object-contain"
                            />
                            <span className="text-sm font-bold text-gray-900">{brandName}</span>
                        </div>

                        {/* 햄버거 메뉴 */}
                        <button
                            onClick={() => setShowMobileMenu(!showMobileMenu)}
                            className="p-1.5 text-gray-600 hover:bg-white/60 rounded-full transition-colors"
                        >
                            {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* 모바일 메뉴 */}
                    {showMobileMenu && (
                        <div className="py-3 border-t border-white/50 space-y-1">
                            {tabs.map(tab => {
                                const Icon = tab.icon;
                                const isActive = currentTab === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => {
                                            onTabChange(tab.key);
                                            setShowMobileMenu(false);
                                        }}
                                        className={`
                                            w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all
                                            ${isActive
                                                ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 shadow-sm'
                                                : 'text-gray-700 hover:bg-white/60'
                                            }
                                        `}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {tab.label}
                                    </button>
                                );
                            })}

                            <div className="pt-2 mt-2 border-t border-white/50 space-y-1">
                                <button
                                    onClick={() => {
                                        onTabChange('settings');
                                        setShowMobileMenu(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-white/60 transition-all"
                                >
                                    <Settings className="w-4 h-4" />
                                    설정
                                </button>
                                <button
                                    onClick={() => {
                                        onLogout();
                                        setShowMobileMenu(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50/60 transition-all"
                                >
                                    <LogOut className="w-4 h-4" />
                                    로그아웃
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* 모바일 하단 탭 - 솜사탕 그라데이션 */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-pink-50/80 via-yellow-50/80 to-sky-50/80 backdrop-blur-xl border-t border-white/50 safe-area-pb">
                <div className="flex items-center justify-around px-2 py-1.5">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = currentTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => onTabChange(tab.key)}
                                className={`
                                    flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all
                                    ${isActive
                                        ? 'text-gray-900'
                                        : 'text-gray-500'
                                    }
                                `}
                            >
                                <Icon className={`w-4 h-4 ${isActive ? 'scale-110' : ''}`} />
                                <span className="text-[10px] font-medium">{tab.label}</span>
                                {isActive && (
                                    <div className="w-1 h-1 rounded-full bg-gradient-to-r from-yellow-400 to-amber-400 mt-0.5" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </nav>

            <style jsx>{`
                .safe-area-pb {
                    padding-bottom: env(safe-area-inset-bottom);
                }
            `}</style>
        </>
    );
}