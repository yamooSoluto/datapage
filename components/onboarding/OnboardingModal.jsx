// components/onboarding/OnboardingModal.jsx
import React from "react";
import { X, ChevronLeft } from "lucide-react";
import { INDUSTRY_OPTIONS, getSheetPresetsForIndustry, generateInitialSheetData } from "./config";

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
    initial = {},           // { email, slackUserId, industry }
    onClose,
    onComplete,             // (payload) => Promise<void> | void
    tenantId,
}) {
    const [step, setStep] = React.useState(1);
    if (!open) return null;

    // 업종은 모달에서만 수정 가능 (기본값: study_cafe)
    const [industry, setIndustry] = React.useState(initial.industry || "study_cafe");
    const presets = React.useMemo(() => getSheetPresetsForIndustry(industry), [industry]);

    // 초기 선택은 항상 빈 배열(자동 선택 없음)
    const [email, setEmail] = React.useState(initial.email || "");
    const [slackId, setSlackId] = React.useState(initial.slackUserId || "");

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
                    }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err?.message || "failed_to_initialize");
                }
            }

            const payload = {
                contactEmail: email || "",
                slackUserId: slackId || "",
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
                                <li>• <strong>공간/시설/좌석</strong>은 FAQ 모듈과 안내 기준 관리에 사용돼요.</li>
                                <li>• 추가 채널(네이버·카카오) 연동 설명은 마이페이지에서 자세히 볼 수 있어요.</li>
                            </ul>
                            <button
                                onClick={() => setStep(2)}
                                className="w-full px-6 py-3 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 rounded-2xl font-bold"
                            >
                                다음
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            {/* 업종 드롭다운 (모달에서만 노출) */}
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-600">
                                    업종 프리셋은 <b>이 모달에서만</b> 변경됩니다.
                                </div>
                                <label className="flex items-center gap-2 text-sm">
                                    <span className="text-gray-700">업종</span>
                                    <select
                                        value={industry}
                                        onChange={(e) => setIndustry(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                                    >
                                        {INDUSTRY_OPTIONS.map((opt) => (
                                            <option key={opt.code} value={opt.code}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
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
                    )}
                </div>

                {/* 풋터 */}
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
                            disabled={submitting}
                            className={`px-5 py-2 rounded-xl text-sm font-semibold ${submitting ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-gray-900 text-white hover:opacity-90"}`}
                        >
                            {submitting ? "설정 중..." : "완료하고 시작하기 🚀"}
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
