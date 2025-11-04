import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function CommaChips({
    label,
    values = [],
    onChange,
    placeholder = '입력 후 Enter',
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

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            add(draft);
        } else if (e.key === 'Backspace' && !draft && values.length > 0) {
            // 입력값 없을 때 백스페이스 = 마지막 칩 삭제
            onChange(values.slice(0, -1));
        }
    };

    return (
        <div className="space-y-3">
            {/* 칩 디스플레이 영역 */}
            {values.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {values.map((value, index) => (
                        <div
                            key={index}
                            className="group inline-flex items-center gap-1.5 px-3 py-1.5 
                                     bg-gray-100 hover:bg-gray-200 rounded-full
                                     transition-all duration-200"
                        >
                            <span className="text-sm font-medium text-gray-700">
                                {value}
                            </span>
                            <button
                                onClick={() => remove(value)}
                                className="p-0.5 hover:bg-gray-300 rounded-full transition-colors"
                                aria-label="삭제"
                                type="button"
                            >
                                <X className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* 입력 필드 */}
            <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent
                         text-gray-900 placeholder-gray-400 transition-all"
            />

            {/* 힌트 텍스트 */}
            <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">
                    쉼표로 구분하거나 Enter를 눌러 추가
                </p>
                {draft && (
                    <button
                        onClick={() => add(draft)}
                        className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-full
                                 hover:bg-gray-800 transition-all font-medium"
                        type="button"
                    >
                        추가
                    </button>
                )}
            </div>
        </div>
    );
}