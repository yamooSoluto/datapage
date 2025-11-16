// components/GlobalModeToggle.jsx
export function GlobalModeToggle({ mode, onToggle, disabled }) {
    const isConfirm = mode === 'CONFIRM';

    return (
        <div className="inline-flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 bg-gray-50 rounded-lg border border-gray-200 md:border-0 md:bg-transparent">
            <div className="flex flex-col">
                <span className="text-xs md:text-sm font-medium text-gray-900">
                    {isConfirm ? '🟡 컨펌 모드' : '🟢 자동 모드'}
                </span>
                <span className="text-[10px] md:text-xs text-gray-600 md:text-gray-500">
                    {isConfirm ? '답변 승인 후 전송' : 'AI가 즉시 전송'}
                </span>
            </div>

            <button
                type="button"
                onClick={onToggle}
                disabled={disabled}
                className={`relative inline-flex h-5 w-9 md:h-6 md:w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isConfirm ? 'bg-yellow-500' : 'bg-green-500'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <span
                    className={`inline-block h-3.5 w-3.5 md:h-4 md:w-4 transform rounded-full bg-white transition-transform shadow-sm ${isConfirm ? 'translate-x-5 md:translate-x-6' : 'translate-x-0.5 md:translate-x-1'
                        }`}
                />
            </button>
        </div>
    );
}