// components/MultiSelectChips.jsx
import React from "react";
import { Plus, X } from "lucide-react";

/**
 * props:
 * - label: string
 * - options: string[]           // 추천 옵션들
 * - value: string[]             // 선택된 값
 * - onChange: (next: string[]) => void
 * - placeholder?: string
 * - maxSelected?: number | null // null이면 무제한
 * - allowCustom?: boolean       // 직접 추가 허용
 */
export default function MultiSelectChips({
    label,
    options,
    value,
    onChange,
    placeholder = "직접 추가…",
    maxSelected = null,
    allowCustom = true,
}) {
    const [adding, setAdding] = React.useState(false);
    const [draft, setDraft] = React.useState("");

    const selected = Array.isArray(value) ? value : [];
    const canAddMore = maxSelected == null || selected.length < maxSelected;

    const norm = (s) => String(s || "").trim().replace(/\s+/g, " ");
    const exists = (s) =>
        selected.some((v) => v.toLowerCase() === String(s).toLowerCase());

    const toggle = (name) => {
        const n = norm(name);
        if (!n) return;
        if (exists(n)) {
            onChange(selected.filter((v) => v.toLowerCase() !== n.toLowerCase()));
        } else {
            if (!canAddMore) return;
            onChange([...selected, n]);
        }
    };

    const addDraft = () => {
        const n = norm(draft);
        if (!n) return;
        if (exists(n)) {
            setDraft("");
            setAdding(false);
            return;
        }
        if (!canAddMore) return;
        onChange([...selected, n]);
        setDraft("");
        setAdding(false);
    };

    const remove = (name) => {
        onChange(selected.filter((v) => v !== name));
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-900">{label}</label>
                {typeof maxSelected === "number" && (
                    <span className="text-[11px] text-gray-500">
                        {selected.length}/{maxSelected}
                    </span>
                )}
            </div>

            {/* 옵션 칩들 */}
            <div className="flex flex-wrap gap-2" role="listbox" aria-label={label}>
                {(options || []).map((opt) => {
                    const on = exists(opt);
                    return (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => toggle(opt)}
                            className={[
                                "inline-flex items-center px-3 py-1.5 rounded-full border text-sm transition-all",
                                "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-yellow-300",
                                on
                                    ? "bg-gray-900 text-white border-gray-900"
                                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50",
                                !on && !canAddMore ? "opacity-50 cursor-not-allowed" : "",
                            ].join(" ")}
                            aria-pressed={on}
                            role="option"
                        >
                            {opt}
                        </button>
                    );
                })}

                {/* 직접 추가 */}
                {allowCustom && (
                    <>
                        {adding ? (
                            <div className="inline-flex items-center px-2 py-1.5 rounded-full border border-gray-300 bg-white">
                                <input
                                    autoFocus
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") addDraft();
                                        if (e.key === "Escape") {
                                            setDraft("");
                                            setAdding(false);
                                        }
                                    }}
                                    placeholder={placeholder}
                                    className="w-28 outline-none text-sm text-gray-800 placeholder:text-gray-400 bg-transparent"
                                />
                                <button
                                    type="button"
                                    onClick={() => setAdding(false)}
                                    className="ml-1 p-1 rounded hover:bg-gray-100 text-gray-500"
                                    aria-label="취소"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={addDraft}
                                    disabled={!draft.trim() || !canAddMore}
                                    className="ml-1 px-2 py-1 text-xs font-semibold rounded bg-gray-900 text-white disabled:opacity-40"
                                >
                                    추가
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => canAddMore && setAdding(true)}
                                className={[
                                    "inline-flex items-center px-3 py-1.5 rounded-full border text-sm transition",
                                    "border-dashed border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400",
                                    !canAddMore ? "opacity-50 cursor-not-allowed" : "",
                                ].join(" ")}
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                직접 추가
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* 선택값 미리보기/삭제 */}
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                    {selected.map((v) => (
                        <span
                            key={v}
                            className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-800 text-xs border border-gray-200"
                        >
                            {v}
                            <button
                                type="button"
                                onClick={() => remove(v)}
                                className="ml-1.5 p-0.5 rounded hover:bg-gray-200"
                                aria-label={`${v} 제거`}
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
