// components/AIComposerModal.jsx
// AI 보정 기능 모달 - 프리셋 선택 + 직접 입력 + AI 보정 옵션

import { useState, useEffect } from 'react';
import { X, Sparkles, MessageSquare, Wand2 } from 'lucide-react';

export default function AIComposerModal({
    conversation,
    tenantId,
    planName = 'pro', // ✅ 기본값을 pro로 (테스트용)
    onClose,
    onResult, // 보정 결과를 부모에게 전달하는 콜백
}) {
    const [step, setStep] = useState('compose'); // 'compose' | 'processing' | 'result'
    const [selectedPresets, setSelectedPresets] = useState([]);
    const [directInput, setDirectInput] = useState('');
    const [enableAI, setEnableAI] = useState(true); // ✅ 기본값 true

    // Business 플랜 전용 옵션
    const [voice, setVoice] = useState('agent');
    const [contentType, setContentType] = useState('tone_correction');
    const [toneFlags, setToneFlags] = useState([]);

    const [processing, setProcessing] = useState(false);
    const [correctedText, setCorrectedText] = useState('');
    const [error, setError] = useState('');

    // 프리셋 메시지 목록 (테넌트별로 로드 가능)
    const [presets, setPresets] = useState([
        { id: 1, text: '문의 주셔서 감사합니다.', category: '인사' },
        { id: 2, text: '확인 후 안내드리겠습니다.', category: '확인' },
        { id: 3, text: '양해 부탁드립니다.', category: '요청' },
        { id: 4, text: '추가 문의사항이 있으시면 언제든 연락 주세요.', category: '마무리' },
    ]);

    useEffect(() => {
        // TODO: 테넌트별 프리셋 로드
        // fetchPresets(tenantId);
        console.log('[AIComposerModal] Opened with plan:', planName);
    }, [tenantId, planName]);

    const togglePreset = (preset) => {
        setSelectedPresets(prev => {
            const exists = prev.find(p => p.id === preset.id);
            if (exists) {
                return prev.filter(p => p.id !== preset.id);
            } else {
                return [...prev, preset];
            }
        });
    };

    const handleSubmit = async () => {
        setError('');

        // 우선순위: 프리셋 > 직접입력
        let finalContent = '';

        if (selectedPresets.length > 0) {
            // 프리셋을 문장 단위로 합치기
            const sentences = selectedPresets.map(p => p.text.trim()).filter(Boolean);
            finalContent = sentences.join('\n');
        } else if (directInput.trim()) {
            finalContent = directInput.trim();
        } else {
            setError('프리셋 메시지를 선택하거나 직접 입력해주세요.');
            return;
        }

        console.log('[AIComposerModal] Submit:', {
            finalContent: finalContent.substring(0, 50),
            enableAI,
            planName,
        });

        // Pro 플랜은 AI 사용 시 프리셋 필수
        if (planName === 'pro' && enableAI && selectedPresets.length === 0) {
            setError('Pro 플랜은 AI 보정 시 프리셋을 선택해야 합니다.');
            return;
        }

        // AI 보정을 사용하지 않으면 바로 결과 전달
        if (!enableAI) {
            console.log('[AIComposerModal] No AI, returning original');
            onResult?.(finalContent);
            onClose();
            return;
        }

        // AI 보정 요청
        setProcessing(true);
        setStep('processing');

        try {
            const payload = {
                tenantId,
                chatId: conversation.chatId,
                content: finalContent,
                enableAI: true,
                planName,
                // Business 플랜 옵션
                ...(planName === 'business' ? {
                    voice,
                    contentType,
                    toneFlags: toneFlags.join(','),
                } : {}),
            };

            console.log('[AIComposerModal] Requesting AI correction:', payload);

            const response = await fetch('/api/ai/tone-correction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'AI 보정 요청 실패');
            }

            const result = await response.json();
            console.log('[AIComposerModal] AI result:', result);

            setCorrectedText(result.correctedText || finalContent);
            setStep('result');
        } catch (err) {
            console.error('[AIComposerModal] Error:', err);
            setError(err.message || 'AI 보정 중 오류가 발생했습니다.');
            setStep('compose');
        } finally {
            setProcessing(false);
        }
    };

    const handleUseResult = () => {
        onResult?.(correctedText);
        onClose();
    };

    // ✅ planName 디버깅
    console.log('[AIComposerModal] Current plan:', planName, 'enableAI:', enableAI);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-gray-200">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">AI 답변 보정</h2>
                            <p className="text-xs text-gray-500">
                                {conversation.userName || '익명'} • {planName} 플랜
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 본문 */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {step === 'compose' && (
                        <>
                            {/* 에러 메시지 */}
                            {error && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900">
                                    ❌ {error}
                                </div>
                            )}

                            {/* 프리셋 선택 */}
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-gray-900 mb-3">
                                    💬 프리셋 메시지 (선택)
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {presets.map(preset => (
                                        <button
                                            key={preset.id}
                                            onClick={() => togglePreset(preset)}
                                            className={`text-left px-4 py-3 rounded-lg border-2 transition-all ${selectedPresets.find(p => p.id === preset.id)
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center ${selectedPresets.find(p => p.id === preset.id)
                                                    ? 'border-blue-500 bg-blue-500'
                                                    : 'border-gray-300'
                                                    }`}>
                                                    {selectedPresets.find(p => p.id === preset.id) && (
                                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <span className="text-xs text-gray-500 font-medium">{preset.category}</span>
                                                    <p className="text-sm text-gray-900 mt-0.5">{preset.text}</p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 직접 입력 */}
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-gray-900 mb-3">
                                    ✍️ 직접 입력
                                </label>
                                <textarea
                                    value={directInput}
                                    onChange={(e) => setDirectInput(e.target.value)}
                                    placeholder="답변 내용을 입력하세요..."
                                    className="w-full h-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    💡 프리셋과 직접 입력을 함께 사용할 수 있습니다. (프리셋 우선)
                                </p>
                            </div>

                            {/* ✅ AI 보정 옵션 - 항상 표시 */}
                            <div className="mb-6 p-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl">
                                <div className="flex items-center gap-2 mb-3">
                                    <input
                                        type="checkbox"
                                        id="enableAI"
                                        checked={enableAI}
                                        onChange={(e) => setEnableAI(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                    <label htmlFor="enableAI" className="text-sm font-semibold text-gray-900 cursor-pointer">
                                        🎨 AI 톤 보정 사용
                                    </label>
                                    {planName === 'trial' || planName === 'starter' ? (
                                        <span className="ml-auto text-xs text-orange-600 font-medium">Pro 이상 필요</span>
                                    ) : null}
                                </div>

                                {enableAI && planName === 'business' && (
                                    <div className="space-y-4 mt-4 pt-4 border-t border-purple-200">
                                        {/* 화자 선택 */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-2">화자</label>
                                            <select
                                                value={voice}
                                                onChange={(e) => setVoice(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                                            >
                                                <option value="agent">상담원</option>
                                                <option value="ai">AI</option>
                                            </select>
                                        </div>

                                        {/* 콘텐츠 타입 */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-2">콘텐츠 타입</label>
                                            <select
                                                value={contentType}
                                                onChange={(e) => setContentType(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                                            >
                                                <option value="tone_correction">톤 보정</option>
                                                <option value="full_rewrite">전체 재작성</option>
                                            </select>
                                        </div>

                                        {/* 톤 옵션 */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-2">톤 옵션</label>
                                            <div className="flex flex-wrap gap-2">
                                                {['friendly', 'professional', 'concise', 'detailed'].map(tone => (
                                                    <button
                                                        key={tone}
                                                        onClick={() => setToneFlags(prev =>
                                                            prev.includes(tone)
                                                                ? prev.filter(t => t !== tone)
                                                                : [...prev, tone]
                                                        )}
                                                        className={`px-3 py-1 text-xs rounded-full transition-colors ${toneFlags.includes(tone)
                                                            ? 'bg-blue-500 text-white'
                                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                            }`}
                                                    >
                                                        {tone}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {step === 'processing' && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="relative mb-6">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center animate-pulse">
                                    <Wand2 className="w-10 h-10 text-white" />
                                </div>
                                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 animate-ping opacity-20"></div>
                            </div>
                            <p className="text-xl font-semibold text-gray-900 mb-2">AI가 답변을 보정하고 있습니다</p>
                            <p className="text-sm text-gray-500">잠시만 기다려주세요...</p>
                        </div>
                    )}

                    {step === 'result' && (
                        <div>
                            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-5 h-5 text-green-600" />
                                    <span className="text-sm font-semibold text-green-900">✅ 보정 완료!</span>
                                </div>
                                <p className="text-xs text-green-700">
                                    아래 결과를 확인하고 입력창으로 가져가세요.
                                </p>
                            </div>

                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                                <label className="block text-xs font-medium text-gray-700 mb-2">보정된 답변</label>
                                <textarea
                                    value={correctedText}
                                    onChange={(e) => setCorrectedText(e.target.value)}
                                    className="w-full h-48 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    💡 수정이 필요하면 여기서 편집하거나, 입력창으로 가져간 후 수정할 수 있습니다.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 하단 버튼 */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
                    <div className="flex items-center justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                        >
                            취소
                        </button>

                        {step === 'compose' && (
                            <button
                                onClick={handleSubmit}
                                disabled={processing}
                                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-lg"
                            >
                                {enableAI ? (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        AI 보정 요청
                                    </>
                                ) : (
                                    <>
                                        <MessageSquare className="w-5 h-5" />
                                        입력창으로 가져가기
                                    </>
                                )}
                            </button>
                        )}

                        {step === 'result' && (
                            <button
                                onClick={handleUseResult}
                                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 font-medium shadow-lg"
                            >
                                <MessageSquare className="w-5 h-5" />
                                입력창으로 가져가기
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}