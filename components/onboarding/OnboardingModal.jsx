// components/onboarding/OnboardingModal.jsx
import React from "react";
import { X, ChevronLeft } from "lucide-react";
import { INDUSTRY_OPTIONS, getSheetPresetsForIndustry, generateInitialSheetData } from "./config";

// 칩 - 야무 스타일
function Chip({ selected, children, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                "px-3 py-1.5 rounded-full border text-sm font-medium transition-all",
                selected
                    ? "bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 border-yellow-400 shadow-sm"
                    : "bg-white/80 backdrop-blur-sm text-gray-700 border-gray-200/50 hover:border-yellow-300 hover:bg-yellow-50/30",
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
                    <Chip key={opt.name} selected={value.includes(opt.name)} onClick={() => toggle(opt.name)}>
                        <span className="mr-1">{opt.icon}</span>
                        {opt.name}
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
                    className="flex-1 px-3 py-2 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-lg focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 outline-none text-sm transition-all"
                />
                <button
                    type="button"
                    onClick={addDraft}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 text-sm font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-yellow-50 to-amber-50 text-gray-800 text-xs border border-yellow-200/50"
                        >
                            {v}
                            <button
                                className="ml-1 text-gray-600 hover:text-gray-800 transition-colors"
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
    initial = {},           // { email, brandName, industry, address, tenantId }
    onClose,
    onComplete,             // (payload) => Promise<void> | void
    tenantId,
}) {
    const [step, setStep] = React.useState(1);
    if (!open) return null;

    // ✅ Firestore에서 받아온 초기값 (편집 가능)
    const [email, setEmail] = React.useState(initial.email || "");
    const [brandName, setBrandName] = React.useState(initial.brandName || "");
    const [address, setAddress] = React.useState(initial.address || "");

    // 업종은 모달에서만 수정 가능 (기본값: study_cafe)
    const [industry, setIndustry] = React.useState(initial.industry || "study_cafe");
    const presets = React.useMemo(() => getSheetPresetsForIndustry(industry), [industry]);

    // 시트별 선택된 항목들
    const [spaceItems, setSpaceItems] = React.useState([]);
    const [facilityItems, setFacilityItems] = React.useState([]);
    const [seatItems, setSeatItems] = React.useState([]);

    const [submitting, setSubmitting] = React.useState(false);

    const finish = async () => {
        if (submitting) return;
        setSubmitting(true);

        // CriteriaSheet 초기 데이터 생성
        const selections = {
            space: spaceItems,
            facility: facilityItems,
            seat: seatItems,
        };
        const sheetData = generateInitialSheetData(industry, selections);

        try {
            if (tenantId) {
                const res = await fetch("/api/onboarding/initialize", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tenantId,
                        industry,
                        selections,
                        sheetData,
                        // ✅ 온보딩에서 편집된 기본 정보
                        brandName,
                        email,
                        address,
                    }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.message || "failed_to_initialize");
                }
            }

            const payload = {
                // ✅ 온보딩에서 편집된 기본 정보
                brandName,
                email,
                address,
                industry,
                selections,
                // CriteriaSheet 데이터
                criteriaSheet: sheetData,
                // 기존 구조 유지 (필요시)
                dictionaries: {
                    facilities: facilityItems.map((name) => ({ name })),
                    passes: [],
                    menu: [],
                    space: spaceItems.map((name) => ({ name })),
                    seat: seatItems.map((name) => ({ name })),
                },
                updatedAt: Date.now(),
            };

            await Promise.resolve(onComplete?.(payload));
        } catch (err) {
            console.error("[OnboardingModal] finish error", err);
            alert("초기 데이터 생성 중 오류가 발생했습니다.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-white/50">
                {/* 헤더 - 솜사탕 그라데이션 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/50 bg-gradient-to-r from-pink-50/50 via-yellow-50/50 to-sky-50/50">
                    <div className="flex items-center gap-2">
                        {[1, 2].map((n) => (
                            <div
                                key={n}
                                className={`h-2 rounded-full transition-all ${n <= step
                                    ? "bg-gradient-to-r from-yellow-400 to-amber-400"
                                    : "bg-gray-200"
                                    } ${n === step ? "w-8" : "w-2"}`}
                            />
                        ))}
                    </div>
                    <div className="text-sm font-semibold text-gray-700">{step} / 2</div>
                    <button className="p-2 rounded-xl hover:bg-gray-100" onClick={onClose} aria-label="close">
                        <X className="w-5 h-5 text-gray-700" />
                    </button>
                </div>

                {/* 본문 */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {step === 1 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-gray-800">👋 처음 오셨군요!</h2>
                            <p className="text-gray-800 text-sm">
                                아래 정보는 언제든 <strong>마이페이지</strong>에서 수정할 수 있어요.
                            </p>
                            <ul className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-2 text-sm text-gray-900">
                                <li>• <strong>공간/시설/좌석</strong>은 FAQ 모듈과 안내 기준 관리에 사용돼요.</li>
                                <li>• 추가 채널(네이버·카카오) 연동 설명은 마이페이지에서 자세히 볼 수 있어요.</li>
                                <li>• 기본 정보는 다음 단계에서 확인하고 수정할 수 있어요.</li>
                            </ul>
                            <button
                                onClick={() => setStep(2)}
                                className="w-full px-6 py-3 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 rounded-2xl font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                            >
                                다음
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            {/* ✅ 기본 정보 섹션 - 솜사탕 그라데이션 */}
                            <div className="bg-gradient-to-br from-pink-50/50 via-yellow-50/50 to-sky-50/50 backdrop-blur-sm border border-white/50 rounded-xl p-4">
                                <h3 className="text-sm font-bold text-gray-900 mb-3">📋 기본 정보</h3>
                                <div className="space-y-3">
                                    {/* 이메일 */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-900 mb-1">
                                            이메일 <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="your@email.com"
                                            className="w-full px-3 py-2 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-lg focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 outline-none text-sm transition-all"
                                        />
                                    </div>

                                    {/* 상호명 */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-900 mb-1">
                                            상호명 <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            value={brandName}
                                            onChange={(e) => setBrandName(e.target.value)}
                                            placeholder="브랜드/매장명"
                                            className="w-full px-3 py-2 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-lg focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 outline-none text-sm transition-all"
                                        />
                                    </div>

                                    {/* 업종 */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-900 mb-1">
                                            업종 <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={industry}
                                            onChange={(e) => setIndustry(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200/50 rounded-lg bg-white/80 backdrop-blur-sm text-sm focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 outline-none transition-all"
                                        >
                                            {INDUSTRY_OPTIONS.map((opt) => (
                                                <option key={opt.code} value={opt.code}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="mt-1 text-xs text-gray-700">
                                            업종에 따라 아래 추천 항목이 달라집니다
                                        </p>
                                    </div>

                                    {/* 매장 주소 */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-900 mb-1">
                                            매장 주소 (선택)
                                        </label>
                                        <input
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            placeholder="서울시 강남구..."
                                            className="w-full px-3 py-2 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-lg focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 outline-none text-sm transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ✅ 멀티셀렉 섹션 */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-gray-900">🏢 매장 구성 요소</h3>
                                    <span className="text-xs text-gray-700">선택 사항입니다</span>
                                </div>

                                {/* 멀티셀렉(프리셋 + 직접추가) */}
                                <MultiSelectWithAdd
                                    label="🏠 공간"
                                    options={presets.space}
                                    value={spaceItems}
                                    onChange={setSpaceItems}
                                    placeholder="현관, 로비, 복도…"
                                />
                                <MultiSelectWithAdd
                                    label="⚙️ 시설"
                                    options={presets.facility}
                                    value={facilityItems}
                                    onChange={setFacilityItems}
                                    placeholder="프린터, 냉장고, 휴게존…"
                                />
                                <MultiSelectWithAdd
                                    label="💺 좌석"
                                    options={presets.seat}
                                    value={seatItems}
                                    onChange={setSeatItems}
                                    placeholder="1인실, 칸막이석…"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* 풋터 - 솜사탕 그라데이션 */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/50 bg-gradient-to-r from-pink-50/30 via-yellow-50/30 to-sky-50/30 backdrop-blur-sm">
                    {step === 2 ? (
                        <button
                            onClick={() => setStep(1)}
                            className="px-3 py-2 rounded-lg text-sm text-gray-800 hover:bg-white/60 flex items-center gap-2 transition-colors"
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
                            disabled={submitting || !email || !brandName}
                            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${submitting || !email || !brandName
                                ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                                : "bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                }`}
                        >
                            {submitting ? "설정 중..." : "완료하고 시작하기 🚀"}
                        </button>
                    ) : (
                        <button
                            onClick={() => setStep(2)}
                            className="px-5 py-2 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 text-sm font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                        >
                            다음
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}