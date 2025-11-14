// components/mypage/SettingsPage.tsx
// 테넌트 설정 메인 페이지

import React from "react";
import { Building2, Mail, Phone, User, CreditCard, Link as LinkIcon, MessageSquare, Globe, MapPin, Briefcase } from "lucide-react";
import { INDUSTRY_OPTIONS } from "../onboarding/config";

interface TenantSettings {
    tenantId: string;
    brandName: string;
    email: string | null;
    industry?: string;  // ✅ 업종 추가
    address?: string;   // ✅ 주소 추가
    plan: string;
    status: string;
    widgetUrl: string;
    naverInboundUrl: string;
    naverAuthorization?: string;
    slack?: {
        allowedUserIds?: string[];
        defaultChannelId?: string | null;
        teamId?: string | null;
    };
    subscription?: {
        plan: string;
        status: string;
        startedAt: string;
        renewsAt?: string | null;
    };
}

interface SettingsPageProps {
    tenantId: string;
    initialSettings?: TenantSettings;
    onSave?: (settings: TenantSettings) => void;
}

export default function SettingsPage({ tenantId, initialSettings, onSave }: SettingsPageProps) {
    const [settings, setSettings] = React.useState<TenantSettings>(
        initialSettings || {
            tenantId: tenantId,
            brandName: "",
            email: null,
            industry: "other",
            address: "",
            plan: "trial",
            status: "active",
            widgetUrl: "",
            naverInboundUrl: "",
            naverAuthorization: "",
            slack: {
                allowedUserIds: [],
                defaultChannelId: null,
                teamId: null,
            },
            subscription: {
                plan: "trial",
                status: "trialing",
                startedAt: new Date().toISOString().split('T')[0],
                renewsAt: null,
            },
        }
    );

    const [isSaving, setIsSaving] = React.useState(false);
    const saveTimer = React.useRef<NodeJS.Timeout | null>(null);

    // ✅ 페이지 마운트 시 스크롤 복원 (다른 페이지에서 overflow: hidden이 설정된 경우 대비)
    React.useEffect(() => {
        // 스크롤 복원
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';

        // 명시적으로 auto로 설정
        if (!document.body.style.overflow) {
            document.body.style.overflow = 'auto';
        }
        if (!document.documentElement.style.overflow) {
            document.documentElement.style.overflow = 'auto';
        }
    }, []);

    const handleSave = async (updatedSettings: TenantSettings) => {
        if (saveTimer.current) {
            clearTimeout(saveTimer.current);
        }

        setIsSaving(true);

        saveTimer.current = setTimeout(async () => {
            try {
                await onSave?.(updatedSettings);
                setIsSaving(false);
            } catch (error) {
                console.error("설정 저장 실패:", error);
                setIsSaving(false);
            }
        }, 500); // 500ms 디바운스
    };

    const updateField = (field: string, value: any) => {
        const updatedSettings = { ...settings };

        if (field.includes('.')) {
            // nested field (e.g., "slack.defaultChannelId")
            const [parent, child] = field.split('.');
            updatedSettings[parent as keyof TenantSettings] = {
                ...(updatedSettings[parent as keyof TenantSettings] as any),
                [child]: value
            } as any;
        } else {
            (updatedSettings as any)[field] = value;
        }

        setSettings(updatedSettings);
        handleSave(updatedSettings);
    };

    // 구독 플랜 한글 변환
    const getPlanLabel = (plan: string) => {
        switch (plan) {
            case 'trial': return '무료 체험';
            case 'basic': return '베이직';
            case 'pro': return '프로';
            case 'enterprise': return '엔터프라이즈';
            default: return plan;
        }
    };

    // 구독 상태 한글 변환
    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'trialing': return '체험 중';
            case 'active': return '활성';
            case 'past_due': return '결제 지연';
            case 'canceled': return '취소됨';
            default: return status;
        }
    };

    // ✅ 업종 라벨 가져오기
    const getIndustryLabel = (code?: string) => {
        return INDUSTRY_OPTIONS.find(opt => opt.code === code)?.label || "기타";
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* 설명 헤더 - 통일된 디자인 */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600">
                            상호, 연락처, 채널 연동 등 기본 설정을 관리합니다
                        </p>
                        {isSaving && (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                저장 중...
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
                {/* ✅ 기본 정보 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                        <h2 className="text-sm font-semibold text-gray-900">기본 정보</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        {/* 이메일 */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                <Mail className="w-4 h-4" />
                                이메일
                            </label>
                            <input
                                type="email"
                                value={settings.email || ""}
                                onChange={(e) => updateField("email", e.target.value)}
                                placeholder="example@company.com"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                            />
                        </div>

                        {/* 상호 (brandName) */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                <Building2 className="w-4 h-4" />
                                상호명
                            </label>
                            <input
                                type="text"
                                value={settings.brandName || ""}
                                onChange={(e) => updateField("brandName", e.target.value)}
                                placeholder="브랜드/매장명을 입력하세요"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                            />
                        </div>

                        {/* ✅ 업종 (읽기 전용) */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                <Briefcase className="w-4 h-4" />
                                업종
                            </label>
                            <p className="text-gray-900 px-3 py-2 bg-gray-50 rounded-lg">
                                {getIndustryLabel(settings.industry)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                업종은 온보딩 시에만 설정할 수 있습니다
                            </p>
                        </div>

                        {/* ✅ 매장 주소 */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                <MapPin className="w-4 h-4" />
                                매장 주소
                            </label>
                            <input
                                type="text"
                                value={settings.address || ""}
                                onChange={(e) => updateField("address", e.target.value)}
                                placeholder="서울시 강남구..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* 채널 연동 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                        <h2 className="text-sm font-semibold text-gray-900">채널 연동</h2>
                    </div>
                    <div className="p-6 space-y-6">
                        {/* Slack Channel ID */}
                        <div>
                            <label className="block mb-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <MessageSquare className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm font-semibold text-gray-900">Slack 채널 ID</span>
                                </div>
                                <p className="text-xs text-gray-500 ml-6">메신저 카드를 받을 Slack 채널 ID</p>
                            </label>
                            <input
                                type="text"
                                value={settings.slack?.defaultChannelId || ""}
                                onChange={(e) => updateField("slack.defaultChannelId", e.target.value)}
                                placeholder="C01234ABCDE"
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900"
                            />
                        </div>

                        {/* 구분선 */}
                        <div className="border-t border-gray-200 pt-6">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">채팅 위젯</h3>

                            {/* 채팅 위젯 URL */}
                            <div className="mb-6">
                                <label className="block mb-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Globe className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm font-semibold text-gray-900">채팅 위젯 URL</span>
                                    </div>
                                    <p className="text-xs text-gray-500 ml-6">웹사이트에 임베드할 채팅 위젯 주소</p>
                                </label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        value={settings.widgetUrl || `https://chat.yamoo.ai.kr/chat/${tenantId}`}
                                        readOnly
                                        className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm font-mono"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(settings.widgetUrl || `https://chat.yamoo.ai.kr/chat/${tenantId}`);
                                                alert("✅ 복사되었습니다!");
                                            }}
                                            className="flex-1 sm:flex-none px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm whitespace-nowrap"
                                        >
                                            복사
                                        </button>
                                        <a
                                            href={settings.widgetUrl || `https://chat.yamoo.ai.kr/chat/${tenantId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm whitespace-nowrap text-center"
                                        >
                                            테스트
                                        </a>
                                    </div>
                                </div>

                                {/* 안내 카드 - 모던 스타일 */}
                                <div className="mt-3 rounded-xl border border-gray-200 bg-gradient-to-br from-slate-50 to-gray-50 overflow-hidden">
                                    <div className="p-4 space-y-2.5">
                                        <div className="flex gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">
                                                💡
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-900 mb-0.5">테스트</p>
                                                <p className="text-xs text-gray-600">위 링크를 클릭하여 채팅 위젯을 바로 테스트할 수 있습니다</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm">
                                                📊
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-900 mb-0.5">운영</p>
                                                <p className="text-xs text-gray-600">웹사이트에 이 URL을 임베드하면 등록한 데이터를 바탕으로 자동 답변이 제공됩니다</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 네이버 톡톡 섹션 */}
                        <div className="border-t border-gray-200 pt-6">
                            <div className="flex items-center gap-2 mb-4">
                                <h3 className="text-sm font-semibold text-gray-900">네이버 톡톡 연동</h3>
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                    파트너센터 필요
                                </span>
                            </div>

                            {/* 네이버 톡톡 URL */}
                            <div className="mb-6">
                                <label className="block mb-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <LinkIcon className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm font-semibold text-gray-900">이벤트 받을 URL</span>
                                    </div>
                                    <p className="text-xs text-gray-500 ml-6">네이버 톡톡에서 메시지를 받을 웹훅 주소</p>
                                </label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        value={settings.naverInboundUrl || `https://chat.yamoo.ai.kr/${tenantId}/naver/inbound`}
                                        readOnly
                                        className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm font-mono"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(settings.naverInboundUrl || `https://chat.yamoo.ai.kr/${tenantId}/naver/inbound`);
                                            alert("✅ 복사되었습니다!");
                                        }}
                                        className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm whitespace-nowrap"
                                    >
                                        복사
                                    </button>
                                </div>
                            </div>

                            {/* Authorization 키 */}
                            <div className="mb-6">
                                <label className="block mb-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <LinkIcon className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm font-semibold text-gray-900">Authorization 키</span>
                                    </div>
                                    <p className="text-xs text-gray-500 ml-6">네이버 톡톡 파트너센터에서 발급받은 인증 키</p>
                                </label>
                                <input
                                    type="text"
                                    value={settings.naverAuthorization || ""}
                                    onChange={(e) => updateField("naverAuthorization", e.target.value)}
                                    placeholder="/M9pqNnnQhyRmbS2ICCx"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent font-mono text-sm"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    네이버 톡톡 파트너센터에서 발급받은 Authorization 값을 입력하세요
                                </p>
                            </div>

                            {/* 연동 방법 안내 - 모던 스타일 */}
                            <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-slate-50 to-gray-50">
                                {/* 헤더 */}
                                <div className="px-5 py-4 rounded-xl border-b border-gray-100 bg-white/50 backdrop-blur-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                            <span className="text-base">📋</span>
                                        </div>
                                        <h4 className="text-sm font-semibold text-gray-900">네이버 톡톡 파트너센터 연동 방법</h4>
                                    </div>
                                </div>

                                {/* 단계별 가이드 */}
                                <div className="p-5 space-y-3">
                                    {[
                                        {
                                            step: 1,
                                            text: (
                                                <>
                                                    <a
                                                        href="https://partner.talk.naver.com"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:text-blue-700 font-medium underline"
                                                    >
                                                        네이버 톡톡 파트너센터
                                                    </a>
                                                    {" "}접속 → 시작하기
                                                </>
                                            )
                                        },
                                        { step: 2, text: "계정 관리 클릭" },
                                        { step: 3, text: "왼쪽 메뉴 → 연동 관리 → 챗봇 API 설정" },
                                        { step: 4, text: "이벤트 받을 URL 칸에 위 URL 붙여넣기" },
                                        { step: 5, text: "보내기 API 칸의 Authorization 값을 복사하여 위 입력란에 붙여넣기" },
                                        { step: 6, text: "저장 버튼 클릭" }
                                    ].map((item) => (
                                        <div key={item.step} className="flex gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
                                                {item.step}
                                            </div>
                                            <p className="text-sm text-gray-700 leading-6">
                                                {item.text}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {/* 주의사항 */}
                                <div className="mx-5 mb-5 p-3 rounded-lg bg-amber-50 border border-amber-200">
                                    <div className="flex gap-2">
                                        <span className="text-amber-600 text-sm">⚠️</span>
                                        <p className="text-xs text-amber-800">
                                            <strong>주의:</strong> 네이버 톡톡 파트너센터 계정이 없으면 사용할 수 없습니다.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 구독 정보 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                        <h2 className="text-sm font-semibold text-gray-900">구독 정보</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                <CreditCard className="w-4 h-4" />
                                현재 플랜
                            </label>
                            <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div>
                                    <p className="text-sm font-semibold text-blue-900">
                                        {getPlanLabel(settings.subscription?.plan || settings.plan)}
                                    </p>
                                    <p className="text-xs text-blue-700 mt-1">
                                        상태: {getStatusLabel(settings.subscription?.status || settings.status)}
                                        {settings.subscription?.startedAt && ` · 시작일: ${settings.subscription.startedAt}`}
                                    </p>
                                </div>
                                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                                    업그레이드
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}