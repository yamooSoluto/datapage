// components/GlobalModeToggle.jsx
// 전역 모드 토글 - 차분하고 미니멀한 디자인

import { Sparkles } from 'lucide-react';

export const GlobalModeToggle = ({ currentMode, onModeChange, isUpdating = false }) => {
    const isAutoMode = currentMode === 'AUTO';

    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center
                    ${isAutoMode ? 'bg-green-50' : 'bg-gray-100'}
                `}>
                    <Sparkles className={`w-4 h-4 ${isAutoMode ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <div>
                    <div className="text-sm font-medium text-gray-900">
                        자동 응답 모드
                    </div>
                    <div className="text-xs text-gray-500">
                        회원 문의에 AI가 바로 답변을 전송해요
                    </div>
                </div>
            </div>

            <button
                onClick={() => onModeChange(isAutoMode ? 'CONFIRM' : 'AUTO')}
                disabled={isUpdating}
                className={`
                    relative w-11 h-6 rounded-full transition-colors duration-200
                    ${isAutoMode ? 'bg-green-500' : 'bg-gray-300'}
                    ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                <div
                    className={`
                        absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200
                        ${isAutoMode ? 'translate-x-[22px]' : 'translate-x-0.5'}
                    `}
                />
            </button>
        </div>
    );
};