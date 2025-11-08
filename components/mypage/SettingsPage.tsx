// components/mypage/SettingsPage.tsx
// 테넌트 설정 메인 페이지

import React from "react";
import { Building2, Mail, Phone, User, CreditCard, Link as LinkIcon, MessageSquare, Save, Edit3, Check, X, Globe } from "lucide-react";

interface TenantSettings {
    tenantId: string;
    brandName: string;
    email: string | null;
    plan: string;
    status: string;
    widgetUrl: string;
    naverInboundUrl: string;
    naverAuthorization?: string;  // 네이버 톡톡 Authorization 키
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
    const [isEditMode, setIsEditMode] = React.useState(false);
    const [settings, setSettings] = React.useState<TenantSettings>(
        initialSettings || {
            tenantId: tenantId,
            brandName: "",
            email: null,
            plan: "trial",
            status: "active",
            widgetUrl: "",
            naverInboundUrl: "",
            naverAuthorization: "",  // 네이버 Authorization 초기값
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
    const [draftSettings, setDraftSettings] = React.useState<TenantSettings | null>(null);

    const handleEdit = () => {
        setDraftSettings({ ...settings });
        setIsEditMode(true);
    };

    const handleSave = async () => {
        if (!draftSettings) return;

        try {
            await onSave?.(draftSettings);
            setSettings(draftSettings);
            setIsEditMode(false);
            setDraftSettings(null);
            alert("✅ 설정이 저장되었습니다.");
        } catch (error) {
            console.error("설정 저장 실패:", error);
            alert("❌ 설정 저장에 실패했습니다.");
        }
    };

    const handleCancel = () => {
        setDraftSettings(null);
        setIsEditMode(false);
    };

    const currentSettings = isEditMode ? draftSettings : settings;

    const updateField = (field: string, value: any) => {
        if (!isEditMode || !draftSettings) return;

        if (field.includes('.')) {
            // nested field (e.g., "slack.defaultChannelId")
            const [parent, child] = field.split('.');
            setDraftSettings((prev) => prev ? {
                ...prev,
                [parent]: {
                    ...(prev[parent as keyof TenantSettings] as any),
                    [child]: value
                }
            } : null);
        } else {
            setDraftSettings((prev) => prev ? { ...prev, [field]: value } : null);
        }
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

    return (
        <div className="min-h-screen bg-gray-50">
            {/* 헤더 */}
            <div className="bg-white border-b sticky top-0 z-20 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">설정</h1>
                            <p className="text-sm text-gray-500 mt-1">
                                상호, 연락처, 채널 연동 등 기본 설정을 관리합니다
                            </p>
                        </div>
                        {!isEditMode ? (
                            <button
                                onClick={handleEdit}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
                            >
                                <Edit3 className="w-4 h-4" />
                                수정
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCancel}
                                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                    취소
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
                                >
                                    <Check className="w-4 h-4" />
                                    저장
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
                {/* 기본 정보 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                        <h2 className="text-sm font-semibold text-gray-900">기본 정보</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        {/* 상호 (brandName) */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                <Building2 className="w-4 h-4" />
                                상호
                            </label>
                            {isEditMode ? (
                                <input
                                    type="text"
                                    value={currentSettings?.brandName || ""}
                                    onChange={(e) => updateField("brandName", e.target.value)}
                                    placeholder="회사명을 입력하세요"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                                />
                            ) : (
                                <p className="text-gray-900 px-3 py-2 bg-gray-50 rounded-lg">
                                    {settings.brandName || "-"}
                                </p>
                            )}
                        </div>

                        {/* 이메일 */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                <Mail className="w-4 h-4" />
                                이메일
                            </label>
                            {isEditMode ? (
                                <input
                                    type="email"
                                    value={currentSettings?.email || ""}
                                    onChange={(e) => updateField("email", e.target.value)}
                                    placeholder="example@company.com"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                                />
                            ) : (
                                <p className="text-gray-900 px-3 py-2 bg-gray-50 rounded-lg">
                                    {settings.email || "-"}
                                </p>
                            )}
                        </div>

                        {/* Tenant ID (읽기 전용) */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                <User className="w-4 h-4" />
                                Tenant ID
                            </label>
                            <p className="text-gray-600 px-3 py-2 bg-gray-50 rounded-lg font-mono text-sm">
                                {settings.tenantId}
                            </p>
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
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                <MessageSquare className="w-4 h-4" />
                                Slack 채널 ID
                            </label>
                            {isEditMode ? (
                                <input
                                    type="text"
                                    value={currentSettings?.slack?.defaultChannelId || ""}
                                    onChange={(e) => updateField("slack.defaultChannelId", e.target.value)}
                                    placeholder="C01234ABCDE"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                                />
                            ) : (
                                <p className="text-gray-900 px-3 py-2 bg-gray-50 rounded-lg">
                                    {settings.slack?.defaultChannelId || "-"}
                                </p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                                메신저 카드를 받을 Slack 채널 ID를 입력하세요
                            </p>
                        </div>

                        {/* 구분선 */}
                        <div className="border-t border-gray-200 pt-6">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">채팅 위젯</h3>

                            {/* 채팅 위젯 URL */}
                            <div className="mb-4">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                    <Globe className="w-4 h-4" />
                                    채팅 위젯 URL
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={settings.widgetUrl || `https://chat.yamoo.ai.kr/chat/${tenantId}`}
                                        readOnly
                                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-sm font-mono"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(settings.widgetUrl || `https://chat.yamoo.ai.kr/chat/${tenantId}`);
                                            alert("✅ 복사되었습니다!");
                                        }}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                                    >
                                        복사
                                    </button>
                                    <a
                                        href={settings.widgetUrl || `https://chat.yamoo.ai.kr/chat/${tenantId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                                    >
                                        테스트
                                    </a>
                                </div>
                                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-xs text-blue-800">
                                        💡 <strong>테스트:</strong> 위 링크를 클릭하여 채팅 위젯을 바로 테스트할 수 있습니다.<br />
                                        📊 <strong>운영:</strong> 웹사이트에 이 URL을 임베드하면, 등록한 데이터를 바탕으로 자동 답변이 제공됩니다.
                                    </p>
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
                            <div className="mb-4">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                    <LinkIcon className="w-4 h-4" />
                                    이벤트 받을 URL
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={settings.naverInboundUrl || `https://chat.yamoo.ai.kr/${tenantId}/naver/inbound`}
                                        readOnly
                                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-sm font-mono"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(settings.naverInboundUrl || `https://chat.yamoo.ai.kr/${tenantId}/naver/inbound`);
                                            alert("✅ 복사되었습니다!");
                                        }}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                                    >
                                        복사
                                    </button>
                                </div>
                            </div>

                            {/* Authorization 키 */}
                            <div className="mb-4">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                    <LinkIcon className="w-4 h-4" />
                                    Authorization 키
                                </label>
                                {isEditMode ? (
                                    <input
                                        type="text"
                                        value={currentSettings?.naverAuthorization || ""}
                                        onChange={(e) => updateField("naverAuthorization", e.target.value)}
                                        placeholder="/M9pqNnnQhyRmbS2ICCx"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent font-mono text-sm"
                                    />
                                ) : (
                                    <p className="text-gray-900 px-3 py-2 bg-gray-50 rounded-lg font-mono text-sm">
                                        {settings.naverAuthorization || "-"}
                                    </p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                    네이버 톡톡 파트너센터에서 발급받은 Authorization 값을 입력하세요
                                </p>
                            </div>

                            {/* 연동 방법 안내 */}
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-sm font-semibold text-amber-900 mb-2">
                                    📋 네이버 톡톡 파트너센터 연동 방법
                                </p>
                                <ol className="text-xs text-amber-800 space-y-1 list-decimal list-inside">
                                    <li>
                                        <a
                                            href="https://partner.talk.naver.com"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline hover:text-amber-900"
                                        >
                                            네이버 톡톡 파트너센터
                                        </a> 접속 → <strong>시작하기</strong>
                                    </li>
                                    <li><strong>계정 관리</strong> 클릭</li>
                                    <li>왼쪽 메뉴 → <strong>연동 관리</strong> → <strong>챗봇 API 설정</strong></li>
                                    <li><strong>이벤트 받을 URL</strong> 칸에 위 URL 붙여넣기</li>
                                    <li><strong>보내기 API</strong> 칸의 <strong>Authorization</strong> 값을 복사하여 위 입력란에 붙여넣기</li>
                                    <li>저장 버튼 클릭</li>
                                </ol>
                                <p className="text-xs text-amber-700 mt-3">
                                    ⚠️ <strong>주의:</strong> 네이버 톡톡 파트너센터 계정이 없으면 사용할 수 없습니다.
                                </p>
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

                {isEditMode && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p className="text-sm text-amber-800">
                            ⚠️ 수정 중입니다. 변경사항을 저장하려면 우측 상단의 <strong>저장</strong> 버튼을 클릭하세요.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}