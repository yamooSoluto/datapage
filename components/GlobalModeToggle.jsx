// components/GlobalModeToggle.jsx
export function GlobalModeToggle({ mode, onToggle, disabled }) {
    const isConfirm = mode === 'CONFIRM';

    return (
        <div className="inline-flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg border">
            <div className="flex flex-col">
                <span className="text-sm font-medium">
                    {isConfirm ? '🟡 컨펌 모드' : '🟢 자동 모드'}
                </span>
                <span className="text-xs text-gray-500">
                    {isConfirm ? '답변 승인 후 전송' : 'AI가 즉시 전송'}
                </span>
            </div>

            <button
                type="button"
                onClick={onToggle}
                disabled={disabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isConfirm ? 'bg-yellow-500' : 'bg-green-500'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isConfirm ? 'translate-x-6' : 'translate-x-1'
                        }`}
                />
            </button>
        </div>
    );
}