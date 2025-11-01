// components/CommaChips.tsx
"use client";
import * as React from "react";

type Props = {
    label: string;
    values: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
    maxItems?: number;
    maxTokenLength?: number;
    normalizeToken?: (s: string) => string;
    disabled?: boolean;
};

const SEP_REGEX = /[,\n，]+/;
const DEFAULT_NORMALIZE = (s: string) => s.trim().toLowerCase();

export default function CommaChips({
    label,
    values,
    onChange,
    placeholder = "콤마(,) 또는 엔터로 추가",
    maxItems,
    maxTokenLength = 40,
    normalizeToken = DEFAULT_NORMALIZE,
    disabled = false,
}: Props) {
    const [draft, setDraft] = React.useState("");

    const emit = React.useCallback((next: string[]) => onChange(next), [onChange]);

    const remove = React.useCallback(
        (name: string) => emit(values.filter((v) => v !== name)),
        [values, emit]
    );

    const tokenize = React.useCallback(
        (raw: string): string[] =>
            String(raw)
                .split(SEP_REGEX)
                .map((s) => s.trim())
                .filter(Boolean)
                .map((s) => (s.length > maxTokenLength ? s.slice(0, maxTokenLength) : s)),
        [maxTokenLength]
    );

    const add = React.useCallback(
        (raw: string) => {
            const tokens = tokenize(raw);
            if (!tokens.length) return;

            const existing = new Set(values.map((v) => normalizeToken(v)));
            const toAdd: string[] = [];
            for (const t of tokens) {
                const key = normalizeToken(t);
                if (!existing.has(key)) {
                    toAdd.push(t);
                    existing.add(key);
                }
            }
            if (!toAdd.length) {
                setDraft("");
                return;
            }
            let next = [...values, ...toAdd];
            if (typeof maxItems === "number" && maxItems > 0 && next.length > maxItems) {
                next = next.slice(0, maxItems);
            }
            emit(next);
            setDraft("");
        },
        [emit, normalizeToken, tokenize, values, maxItems]
    );

    const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
        const native: any = e.nativeEvent;
        if (native?.isComposing) return; // 한글 IME 조합 중엔 무시

        if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
            e.preventDefault();
            if (draft) add(draft);
            return;
        }
        if (e.key === "Backspace" && !draft && values.length > 0) {
            e.preventDefault();
            remove(values[values.length - 1]);
        }
    };

    const onPaste: React.ClipboardEventHandler<HTMLInputElement> = (e) => {
        const text = e.clipboardData.getData("text");
        if (SEP_REGEX.test(text)) {
            e.preventDefault();
            add(draft + text);
        }
    };

    const onBlur: React.FocusEventHandler<HTMLInputElement> = () => {
        if (draft.trim()) add(draft);
    };

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">{label}</label>

            <div className="flex flex-wrap gap-2">
                {values.map((v) => (
                    <span key={v} className="inline-flex items-center px-2 py-1 rounded-full border text-sm">
                        {v}
                        <button
                            type="button"
                            className="ml-2 -mr-1 inline-flex h-5 w-5 items-center justify-center rounded hover:bg-gray-100"
                            onClick={() => remove(v)}
                            aria-label={`${v} 제거`}
                            title="삭제"
                            disabled={disabled}
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>

            <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onBlur={onBlur}
                placeholder={placeholder}
                disabled={disabled || (typeof maxItems === "number" && values.length >= maxItems)}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
            />

            <div className="text-xs text-gray-500">
                엔터/탭/콤마(, · ，)로 추가 • 붙여넣기 지원 • 백스페이스로 마지막 항목 삭제
                {typeof maxItems === "number" && <> • 최대 {maxItems}개</>}
            </div>
        </div>
    );
}
