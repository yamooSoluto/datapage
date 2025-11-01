import React, { useState } from 'react';

export default function CommaChips({
    label,
    values = [],
    onChange,
    placeholder = '콤마(,)로 여러 개 입력',
}) {
    const [draft, setDraft] = useState('');

    const add = (raw) => {
        const parts = String(raw)
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
        if (!parts.length) return;
        const merged = Array.from(new Set([...(values || []), ...parts]));
        onChange(merged);
        setDraft('');
    };

    const remove = (name) => onChange((values || []).filter(v => v !== name));

    return (
        <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-900">{label}</label>
            <div className="flex gap-2">
                <input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && add(draft)}
                    placeholder={placeholder}
                    className="flex-1 px-3 py-2 bg-white border rounded-lg"
                />
                <button
                    onClick={() => add(draft)}
                    className="px-4 py-2 bg-yellow-400 rounded-lg font-bold"
                >
                    추가
                </button>
            </div>

            <div className="flex flex-wrap gap-2">
                {(values || []).map((name) => (
                    <span
                        key={name}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg text-sm"
                    >
                        {name}
                        <button
                            onClick={() => remove(name)}
                            className="text-gray-500 hover:text-red-600"
                            type="button"
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>
        </div>
    );
}
