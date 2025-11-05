// components/onboarding/OnboardingModal.jsx
// 📊 실제 CS 데이터 525개 분석 기반으로 개선됨
import React from "react";
import { X, ChevronLeft, Info, Sparkles } from "lucide-react";
import {
    INDUSTRY_OPTIONS,
    getPresetsForIndustry,
    getPresetStats,
    getIndustryTip,
    industryEmoji,
} from "./config";

// 칩
function Chip({ selected, children, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                "px-3 py-1.5 rounded-full border text-sm transition-colors",
                selected
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-800 border-gray-200 hover:border-gray-300",
            ].join(" ")}
        >
            {children}
        </button>
    );
}

// 프리셋 + 직접추가 (무제한)
function MultiSelectWithAdd({ label, options, value, onChange, placeholder }) {
    const [draft, setDraft] = React.useState("");

    const toggle = (name) => {
        const has = value.includes(name);
        onChange(has ? value.filter((v) => v !== name) : [...value, name]);
    };

    const addDraft = () => {
        const parts = String(draft)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        if (!parts.length) return;
        const merged = Array.from(new Set([...value, ...parts]));
        onChange(merged);
        setDraft("");
    };

    return (
        <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-900">{label}</div>

            {/* 프리셋(선택은 사용자 클릭) */}
            <div className="flex flex-wrap gap-2">
                {options.map((opt) => (
                    <Chip key={opt} selected={value.includes(opt)} onClick={() => toggle(opt)}>
                        {opt}
                    </Chip>
                ))}
            </div>

            {/* 직접 추가 */}
            <div className="flex gap-2 pt-1">
                <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addDraft()}
                    placeholder={placeholder || "콤마(,)로 여러 개 입력"}
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 outline-none text-sm"
                />
                <button
                    type="button"
                    onClick={addDraft}
                    className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:opacity-90"
                >
                    추가
                </button>
            </div>

            {/* 선택 결과 */}
            {!!value.length && (
                <div className="flex flex-wrap gap-2">
                    {value.map((v) => (
                        <span
                            key={v}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-800 text-xs border border-gray-200"
                        >
                            {v}
                            <button
                                className="ml-1 text-gray-400 hover:text-gray-600"
                                onClick={() => onChange(value.filter((x) => x !== v))}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function OnboardingModal({
    open,
    initial = {},           // { email, slackUserId, industry, facilities[], passes[], menu[], policies[], links[] }
    onClose,
    onComplete,             // (payload) => Promise<void> | void
}) {
    const [step, setStep] = React.useState(1);
    if (!open) return null;

    // 업종은 모달에서만 수정 가능 (기본값: study_cafe)
    const [industry, setIndustry] = React.useState(initial.industry || "study_cafe");
    const presets = React.useMemo(() => getPresetsForIndustry(industry), [industry]);

    // 초기 선택은 항상 빈 배열(자동 선택 없음)
    const [email, setEmail] = React.useState(initial.email || "");
    const [slackId, setSlackId] = React.useState(initial.slackUserId || "");
    const [facilities, setFacilities] = React.useState(
        Array.isArray(initial.facilities) ? initial.facilities : []
    );
    const [passes, setPasses] = React.useState(
        Array.isArray(initial.passes) ? initial.passes : []
    );
    const [menu, setMenu] = React.useState(
        Array.isArray(initial.menu) ? initial.menu : []
    );
    const [policies, setPolicies] = React.useState(
        Array.isArray(initial.policies) ? initial.policies : []
    );
    const [links, setLinks] = React.useState(
        Array.isArray(initial.links) ? initial.links : []
    );

    const finish = async () => {
        const payload = {
            contactEmail: email || "",
            slackUserId: slackId || "",
            industry, // 모달에서만 변경 허용
            dictionaries: {
                facilities: (facilities || []).map((name) => ({ name })),
                passes: (passes || []).map((name) => ({ name })),
                menu: (menu || []).map((name) => ({ name })),
                policies: (policies || []).map((name) => ({ name })),
                links: (links || []).map((name) => ({ name })),
            },
            updatedAt: Date.now(),
        };
        await Promise.resolve(onComplete?.(payload));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        {[1, 2].map((n) => (
                            <div
                                key={n}
                                className={`h-2 rounded-full transition-all ${n <= step ? "bg-gray-900" : "bg-gray-200"} ${n === step ? "w-8" : "w-2"}`}
                            />
                        ))}
                    </div>
                    <div className="text-sm font-semibold text-gray-500">{step} / 2</div>
                    <button className="p-2 rounded-xl hover:bg-gray-100" onClick={onClose} aria-label="close">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* 본문 */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {step === 1 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-gray-800">👋 처음 오셨군요!</h2>
                            <p className="text-gray-600 text-sm">
                                아래 정보는 언제든 <strong>마이페이지</strong>에서 수정할 수 있어요.
                            </p>
                            <ul className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-2 text-sm text-gray-700">
                                <li>• 슬랙 가입 후 <strong>본인 이메일</strong>을 입력하면 실시간 메시지 카드를 받을 수 있어요.</li>
                                <li>• <strong>시설/이용권/메뉴</strong>는 나중에 FAQ 모듈에서 자동 추천에 쓰입니다.</li>
                                <li>• 추가 채널(네이버·카카오) 연동 설명은 마이페이지에서 자세히 볼 수 있어요.</li>
                            </ul>
                            <button
                                onClick={() => setStep(2)}
                                className="w-full px-6 py-3 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 rounded-2xl font-bold hover:shadow-lg transition-shadow"
                            >
                                다음
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            {/* 업종 선택 섹션 (개선됨) */}
                            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center">
                                        <Sparkles className="w-4 h-4 text-yellow-600" />
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        <div>
                                            <div className="text-sm font-semibold text-gray-900 mb-1">
                                                업종 선택
                                            </div>
                                            <div className="text-xs text-gray-600">
                                                업종에 맞는 프리셋이 자동으로 제공돼요 (이 모달에서만 변경 가능)
                                            </div>
                                        </div>

                                        <select
                                            value={industry}
                                            onChange={(e) => setIndustry(e.target.value)}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm font-medium hover:border-gray-300 focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 outline-none transition-all"
                                        >
                                            {INDUSTRY_OPTIONS.map((opt) => (
                                                <option key={opt.code} value={opt.code}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>

                                        {/* 업종별 통계 및 팁 */}
                                        <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                                <Info className="w-3.5 h-3.5" />
                                                <span className="font-semibold">이 업종 프리셋 정보</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs">
                                                {(() => {
                                                    const stats = getPresetStats(industry);
                                                    return (
                                                        <>
                                                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md font-medium">
                                                                시설 {stats.facilities}개
                                                            </span>
                                                            <span className="px-2 py-1 bg-green-50 text-green-700 rounded-md font-medium">
                                                                이용권 {stats.passes}개
                                                            </span>
                                                            <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-md font-medium">
                                                                메뉴 {stats.menu}개
                                                            </span>
                                                            {stats.policies > 0 && (
                                                                <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-md font-medium">
                                                                    규정 {stats.policies}개
                                                                </span>
                                                            )}
                                                            {stats.links > 0 && (
                                                                <span className="px-2 py-1 bg-pink-50 text-pink-700 rounded-md font-medium">
                                                                    링크 {stats.links}개
                                                                </span>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                            <div className="text-xs text-gray-600 leading-relaxed">
                                                💡 {getIndustryTip(industry)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 연락 정보 */}
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-900 mb-1">이메일</label>
                                    <input
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="your@email.com"
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-900 mb-1">
                                        Slack 사용자 ID (선택)
                                    </label>
                                    <input
                                        value={slackId}
                                        onChange={(e) => setSlackId(e.target.value)}
                                        placeholder="U0XXXXXXX"
                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 outline-none"
                                    />
                                </div>
                            </div>

                            {/* 멀티셀렉(프리셋 + 직접추가) */}
                            <MultiSelectWithAdd
                                label="🏗️ 시설"
                                options={presets.facilities}
                                value={facilities}
                                onChange={setFacilities}
                                placeholder="프린터, 냉장고, 휴게존…"
                            />
                            <MultiSelectWithAdd
                                label="🎫 이용권"
                                options={presets.passes}
                                value={passes}
                                onChange={setPasses}
                                placeholder="자유석 1일권, 전용석 1개월…"
                            />
                            <MultiSelectWithAdd
                                label="🍽️ 메뉴"
                                options={presets.menu}
                                value={menu}
                                onChange={setMenu}
                                placeholder="아메리카노, 라떼…"
                            />

                            {/* 추가 모듈 (선택사항) */}
                            {presets.policies && presets.policies.length > 0 && (
                                <MultiSelectWithAdd
                                    label="📋 규정 (선택사항)"
                                    options={presets.policies}
                                    value={policies}
                                    onChange={setPolicies}
                                    placeholder="연령 제한, 환불 규정…"
                                />
                            )}

                            {presets.links && presets.links.length > 0 && (
                                <MultiSelectWithAdd
                                    label="🔗 링크 (선택사항)"
                                    options={presets.links}
                                    value={links}
                                    onChange={setLinks}
                                    placeholder="홈페이지, 예약 링크…"
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* 푸터 */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white">
                    {step === 2 ? (
                        <button
                            onClick={() => setStep(1)}
                            className="px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            이전
                        </button>
                    ) : (
                        <span />
                    )}

                    {step === 2 ? (
                        <button
                            onClick={finish}
                            className="px-5 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:opacity-90"
                        >
                            완료하고 시작하기 🚀
                        </button>
                    ) : (
                        <button
                            onClick={() => setStep(2)}
                            className="px-5 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:opacity-90"
                        >
                            다음
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}