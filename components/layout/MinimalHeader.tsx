// components/layout/MinimalHeader.tsx
// 야무 브랜드 감성 + 미니멀 디자인

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Database, Settings, LogOut, Menu, X, BookOpen, BarChart3, ChevronDown } from 'lucide-react';

interface Tenant {
    id: string;
    brandName?: string;
    name?: string;
    plan?: string;
}

interface MinimalHeaderProps {
    currentTab: string;
    onTabChange: (tab: string) => void;
    brandName?: string;
    plan?: string;
    onLogout: () => void;
    availableTenants?: Tenant[];
    onTenantChange?: (tenant: Tenant) => void;
}

export default function MinimalHeader({
    currentTab,
    onTabChange,
    brandName = "야무",
    plan = "trial",
    onLogout,
    availableTenants = [],
    onTenantChange
}: MinimalHeaderProps) {
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [showTenantDropdown, setShowTenantDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const dropdownStateRef = useRef(false);

    // 드롭다운 상태를 ref에 동기화
    useEffect(() => {
        dropdownStateRef.current = showTenantDropdown;
    }, [showTenantDropdown]);

    // 드롭다운 외부 클릭 시 닫기
    useEffect(() => {
        if (!showTenantDropdown) return;

        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            // ref를 통해 최신 상태 확인
            if (!dropdownStateRef.current) return;

            const target = event.target as Node;
            if (dropdownRef.current && !dropdownRef.current.contains(target)) {
                setShowTenantDropdown(false);
            }
        };

        // 다음 이벤트 루프에서 리스너 등록하여 드롭다운 버튼의 onClick이 먼저 실행되도록 함
        // click 이벤트는 mousedown/mouseup 후에 발생하므로 드롭다운 버튼 클릭을 방해하지 않음
        const timeoutId = setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [showTenantDropdown]);

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
            <header
                className="hidden md:block fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-pink-100/85 via-yellow-100/85 to-sky-100/85 backdrop-blur-xl border-b border-white/50"
                style={{ touchAction: 'none' }}
            >
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex items-center justify-between h-12">
                        {/* 로고 & 브랜드 */}
                        <div className="flex items-center gap-3">
                            <img
                                src="/logo.png"
                                alt="야무"
                                className="w-7 h-7 object-contain"
                            />
                            <div className="flex items-center gap-2 relative">
                                {availableTenants.length > 1 ? (
                                    <div className="relative" ref={dropdownRef}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowTenantDropdown(!showTenantDropdown);
                                            }}
                                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/60 transition-colors"
                                        >
                                            <span className="text-sm font-bold text-gray-900">{brandName}</span>
                                            <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showTenantDropdown ? 'rotate-180' : ''}`} />
                                        </button>
                                        {showTenantDropdown && (
                                            <div
                                                className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px] z-[9999]"
                                                onClick={(e) => {
                                                    // 드롭다운 메뉴 내부 클릭은 외부 클릭 핸들러로 전파되지 않도록 함
                                                    e.stopPropagation();
                                                }}
                                            >
                                                {availableTenants.map((tenant) => (
                                                    <button
                                                        key={tenant.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            console.log('🔍 테넌트 선택:', tenant.brandName || tenant.name);
                                                            if (onTenantChange) {
                                                                console.log('✅ onTenantChange 호출');
                                                                onTenantChange(tenant);
                                                            } else {
                                                                console.warn('⚠️ onTenantChange가 없습니다');
                                                            }
                                                            setShowTenantDropdown(false);
                                                        }}
                                                        onTouchEnd={(e) => {
                                                            e.stopPropagation();
                                                            e.preventDefault();
                                                            console.log('🔍 테넌트 선택 (터치):', tenant.brandName || tenant.name);
                                                            if (onTenantChange) {
                                                                console.log('✅ onTenantChange 호출 (터치)');
                                                                onTenantChange(tenant);
                                                            }
                                                            setShowTenantDropdown(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 active:bg-gray-100 transition-colors ${(tenant.brandName || tenant.name) === brandName
                                                            ? 'bg-yellow-50 text-gray-900 font-medium'
                                                            : 'text-gray-700'
                                                            }`}
                                                    >
                                                        {tenant.brandName || tenant.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-sm font-bold text-gray-900">{brandName}</span>
                                )}
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
            <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-pink-100/85 via-yellow-100/85 to-sky-100/85 backdrop-blur-xl border-b border-white/50">
                <div className="px-4">
                    <div className="flex items-center justify-between h-12">
                        {/* 로고 & 브랜드 */}
                        <div className="flex items-center gap-2 relative">
                            <img
                                src="/logo.png"
                                alt="야무"
                                className="w-7 h-7 object-contain"
                            />
                            {availableTenants.length > 1 ? (
                                <div className="relative" ref={dropdownRef}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowTenantDropdown(!showTenantDropdown);
                                        }}
                                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/60 transition-colors"
                                    >
                                        <span className="text-sm font-bold text-gray-900">{brandName}</span>
                                        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showTenantDropdown ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showTenantDropdown && (
                                        <div
                                            className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px] z-[9999]"
                                            onClick={(e) => {
                                                // 드롭다운 메뉴 내부 클릭은 외부 클릭 핸들러로 전파되지 않도록 함
                                                e.stopPropagation();
                                            }}
                                        >
                                            {availableTenants.map((tenant) => (
                                                <button
                                                    key={tenant.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        console.log('🔍 테넌트 선택 (모바일):', tenant.brandName || tenant.name);
                                                        if (onTenantChange) {
                                                            console.log('✅ onTenantChange 호출 (모바일)');
                                                            onTenantChange(tenant);
                                                        } else {
                                                            console.warn('⚠️ onTenantChange가 없습니다 (모바일)');
                                                        }
                                                        setShowTenantDropdown(false);
                                                    }}
                                                    onTouchEnd={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        console.log('🔍 테넌트 선택 (모바일 터치):', tenant.brandName || tenant.name);
                                                        if (onTenantChange) {
                                                            console.log('✅ onTenantChange 호출 (모바일 터치)');
                                                            onTenantChange(tenant);
                                                        }
                                                        setShowTenantDropdown(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 active:bg-gray-100 transition-colors ${(tenant.brandName || tenant.name) === brandName
                                                        ? 'bg-yellow-50 text-gray-900 font-medium'
                                                        : 'text-gray-700'
                                                        }`}
                                                >
                                                    {tenant.brandName || tenant.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <span className="text-sm font-bold text-gray-900">{brandName}</span>
                            )}
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
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-pink-100/90 via-yellow-100/90 to-sky-100/90 backdrop-blur-xl border-t border-white/50 safe-area-pb">
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