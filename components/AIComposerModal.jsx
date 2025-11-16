// components/AIComposerModal.jsx
// AI 보정 모달 - 고객 메시지 + 보정 + 전송 (완결형)

import { useState, useEffect } from 'react';
import { X, Sparkles, Send, Wand2, User } from 'lucide-react';

export default function AIComposerModal({
    conversation,
    tenantId,
    planName = 'pro',
    onClose,
    onSend, // 전송 콜백
    initialText = '', // ✅ 컨펌 초안 수정용 초기 텍스트
}) {
    const [step, setStep] = useState('compose'); // 'compose' | 'processing' | 'result'
    const [selectedPresets, setSelectedPresets] = useState([]);
    const [directInput, setDirectInput] = useState('');
    const [enableAI, setEnableAI] = useState(true);

    // ✅ initialText가 변경되면 directInput에 설정
    useEffect(() => {
        if (initialText) {
            setDirectInput(initialText);
        }
    }, [initialText]);

    // Business 플랜 옵션
    const [voice, setVoice] = useState('agent');
    const [contentType, setContentType] = useState('tone_correction');
    const [toneFlags, setToneFlags] = useState([]);

    const [processing, setProcessing] = useState(false);
    const [sending, setSending] = useState(false);
    const [correctedText, setCorrectedText] = useState('');
    const [originalText, setOriginalText] = useState(''); // ✅ 원본 텍스트
    const [customerMessage, setCustomerMessage] = useState(''); // ✅ 고객 메시지
    const [recentMessages, setRecentMessages] = useState([]); // ✅ 최근 메시지들
    const [error, setError] = useState('');


    const [presets] = useState([
        { id: 1, text: '문의 주셔서 감사합니다.', category: '인사' },
        { id: 2, text: '확인 후 안내드리겠습니다.', category: '확인' },
        { id: 3, text: '양해 부탁드립니다.', category: '요청' },
        { id: 4, text: '추가 문의사항이 있으시면 언제든 연락 주세요.', category: '마무리' },
    ]);

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

        let finalContent = '';

        if (selectedPresets.length > 0) {
            const sentences = selectedPresets.map(p => p.text.trim()).filter(Boolean);
            finalContent = sentences.join('\n');
        } else if (directInput.trim()) {
            finalContent = directInput.trim();
        } else {
            setError('프리셋 메시지를 선택하거나 직접 입력해주세요.');
            return;
        }

        if (!enableAI) {
            setCorrectedText(finalContent);
            setStep('result');
            return;
        }

        // ✅ AI 보정 요청 (비동기 방식 - conversationId로 폴링)
        setProcessing(true);
        setStep('processing');

        try {
            const payload = {
                tenantId,
                conversationId: conversation.chatId,
                content: finalContent,
                enableAI: true,
                planName,
                source: 'web_portal',
                ...(planName === 'business' ? {
                    voice,
                    contentType,
                    toneFlags: toneFlags.join(','),
                } : {}),
            };

            // ✅ 1. n8n에 비동기 요청 전송
            const response = await fetch('/api/ai/tone-correction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'AI 보정 요청 실패');
            }

            await response.json();

            // ✅ 2. conversationId로 폴링 시작
            const conversationId = conversation?.chatId || conversation?.id;

            if (!conversationId) {
                throw new Error('대화 ID를 찾을 수 없습니다.');
            }

            const maxAttempts = 60; // ✅ 최대 60초 대기 (n8n 처리 시간 고려)
            let attempts = 0;

            const pollResult = async () => {
                while (attempts < maxAttempts) {
                    attempts++;

                    try {
                        // ✅ conversationId로 폴링
                        const pollResponse = await fetch(
                            `/api/ai/tone-poll?conversationId=${encodeURIComponent(conversationId)}`,
                            { method: 'GET' }
                        );

                        if (!pollResponse.ok) {
                            throw new Error('폴링 실패');
                        }

                        const pollData = await pollResponse.json();

                        if (pollData.ready) {
                            // ✅ 결과 받음 - 다양한 필드명 지원
                            const extractedCorrectedText = pollData.correctedText ||
                                pollData.text ||
                                pollData.output ||
                                pollData.response ||
                                finalContent; // fallback

                            if (!extractedCorrectedText || !extractedCorrectedText.trim()) {
                                throw new Error('보정된 텍스트를 받지 못했습니다.');
                            }

                            // ✅ state 업데이트
                            setCorrectedText(extractedCorrectedText);
                            setOriginalText(finalContent);
                            setCustomerMessage(pollData.customerMessage || conversation.lastMessage || '');

                            // ✅ recentMessages가 배열인지 확인 후 저장
                            const safeRecentMessages = Array.isArray(pollData.recentMessages)
                                ? pollData.recentMessages
                                : (Array.isArray(pollData.recent_messages)
                                    ? pollData.recent_messages
                                    : []);
                            setRecentMessages(safeRecentMessages);

                            // ✅ step 변경 전에 잠시 대기하여 state가 확실히 업데이트되도록 함
                            await new Promise(resolve => setTimeout(resolve, 100));

                            setStep('result');
                            setProcessing(false);
                            return;
                        }

                        // 1초 대기 후 재시도
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (pollErr) {
                        // 폴링 에러는 계속 재시도
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }

                // 타임아웃
                throw new Error(`AI 보정 시간이 초과되었습니다 (${maxAttempts}초). 결과가 나오면 자동으로 표시됩니다.`);
            };

            await pollResult();

        } catch (err) {
            console.error('[AIComposerModal] Error:', err);
            setError(err.message || 'AI 보정 중 오류가 발생했습니다.');
            setStep('compose');
            setProcessing(false);
        }
    };

    // ✅ 전송 핸들러
    const handleSend = () => {
        const trimmedText = correctedText?.trim() || '';

        console.log('[AIComposerModal] handleSend called:', {
            correctedText,
            correctedTextType: typeof correctedText,
            correctedTextLength: correctedText?.length,
            trimmedText,
            trimmedTextLength: trimmedText.length,
            isEmpty: !correctedText,
            isEmptyAfterTrim: !trimmedText,
            step,
            conversation: {
                chatId: conversation?.chatId,
                id: conversation?.id,
                tenant: conversation?.tenant,
                tenantId: conversation?.tenantId,
            },
        });

        // 내용이 진짜 비어있으면 막기
        if (!trimmedText) {
            console.warn('[AIComposerModal] Empty correctedText, blocking send.', {
                correctedText,
                trimmedText,
                step,
            });
            setError('전송할 내용이 없습니다.');
            return;
        }

        // 버튼 중복 클릭 방지 정도만
        setSending(true);
        setError('');

        try {
            console.log('[AIComposerModal] Fire-and-forget onSend:', {
                text: trimmedText,
                textLength: trimmedText.length,
            });

            // ✅ 1) onSend 호출 (비동기지만 "기다리지 않음")
            const maybePromise = onSend?.(trimmedText);

            if (maybePromise && typeof maybePromise.then === 'function') {
                maybePromise.catch((err) => {
                    console.error('[AIComposerModal] Send error (async):', err);
                    // 여기에서 나중에 토스트나 전역 에러 핸들러 붙일 수 있음
                });
            }
        } catch (err) {
            // onSend 자체가 동기 에러를 던지는 경우만 여기서 잡힘
            console.error('[AIComposerModal] Immediate send error:', err);
        } finally {
            // ✅ 2) UI는 바로 정리: 모달 닫기 + 상태 리셋
            onClose();
            // 모달이 이미 언마운트될 거라 사실 의미는 거의 없지만 안전용
            setTimeout(() => setSending(false), 50);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 pt-16 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pt-16 md:pb-20">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[70vh] flex flex-col border border-gray-200">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">AI 답변 보정</h2>
                            <p className="text-xs text-gray-700">
                                {conversation.userName || '익명'} • {planName} 플랜
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={processing || sending}
                        className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 본문 */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {step === 'compose' && (
                        <>
                            {error && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900">
                                    ❌ {error}
                                </div>
                            )}

                            {/* 프리셋 선택 */}
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-gray-900 mb-3">
                                    💬 프리셋 메시지
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
                                                    <span className="text-xs text-gray-700 font-medium">{preset.category}</span>
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
                                    style={{ fontSize: '16px' }} // 모바일 화면 확대 방지
                                    className="w-full h-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                            </div>

                            {/* AI 보정 옵션 */}
                            <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="enableAI"
                                        checked={enableAI}
                                        onChange={(e) => setEnableAI(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <label htmlFor="enableAI" className="text-sm font-semibold text-gray-900 cursor-pointer">
                                        🎨 AI 톤 보정 사용
                                    </label>
                                </div>
                            </div>
                        </>
                    )}

                    {step === 'processing' && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="relative mb-6">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center animate-pulse">
                                    <Wand2 className="w-10 h-10 text-white" />
                                </div>
                                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 animate-ping opacity-20"></div>
                            </div>
                            <p className="text-xl font-semibold text-gray-900 mb-2">AI가 답변을 보정하고 있습니다</p>
                            <p className="text-sm text-gray-700">잠시만 기다려주세요...</p>
                        </div>
                    )}

                    {step === 'result' && (
                        <div className="space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900">
                                    ❌ {error}
                                </div>
                            )}

                            {/* 성공 메시지 */}
                            <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-green-600" />
                                    <span className="text-sm font-semibold text-green-900">✅ AI 보정 완료!</span>
                                </div>
                                <p className="text-xs text-green-900 mt-1">
                                    고객 메시지를 확인하고 답변을 수정한 후 전송하세요.
                                </p>
                            </div>

                            {/* ✅ 고객 메시지 표시 */}
                            {customerMessage && (
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                    <div className="flex items-center gap-2 mb-2">
                                        <User className="w-4 h-4 text-blue-600" />
                                        <span className="text-xs font-semibold text-blue-900">고객의 마지막 메시지</span>
                                    </div>
                                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{customerMessage}</p>
                                </div>
                            )}

                            {/* ✅ 최근 대화 컨텍스트 (접을 수 있는 섹션) */}
                            {Array.isArray(recentMessages) && recentMessages.length > 0 && (
                                <details className="group">
                                    <summary className="cursor-pointer text-sm font-semibold text-gray-900 hover:text-gray-950 flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <span>💬 최근 대화 보기</span>
                                        <span className="text-xs text-gray-800">({recentMessages.length}개)</span>
                                    </summary>
                                    <div className="mt-3 space-y-2 pl-2 border-l-2 border-gray-200">
                                        {recentMessages.slice(-5).map((msg, idx) => (
                                            <div key={idx} className="flex items-start gap-2">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${msg.sender === 'user' ? 'bg-blue-100' : 'bg-gray-100'
                                                    }`}>
                                                    {msg.sender === 'user' ? (
                                                        <User className="w-3 h-3 text-blue-600" />
                                                    ) : (
                                                        <Sparkles className="w-3 h-3 text-gray-600" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs text-gray-800 mb-0.5 font-medium">
                                                        {msg.sender === 'user' ? '고객' : 'AI'}
                                                    </p>
                                                    <p className="text-sm text-gray-900">{msg.text || ''}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            )}

                            {/* ✅ 보정된 답변 (편집 가능) */}
                            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                                <label className="block text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-purple-500" />
                                    AI 보정된 답변 (편집 가능)
                                </label>
                                <textarea
                                    value={correctedText}
                                    onChange={(e) => setCorrectedText(e.target.value)}
                                    style={{ fontSize: '16px' }} // 모바일 화면 확대 방지
                                    className="w-full h-48 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 font-medium resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="보정된 답변을 확인하고 필요시 수정하세요..."
                                />
                                <p className="text-xs text-gray-800 mt-2 font-medium">
                                    💡 고객 메시지를 참고하여 답변을 수정할 수 있습니다.
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
                            disabled={processing || sending}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium disabled:opacity-50"
                        >
                            취소
                        </button>

                        {step === 'compose' && (
                            <button
                                onClick={handleSubmit}
                                disabled={processing}
                                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-lg"
                            >
                                <Sparkles className="w-5 h-5" />
                                {enableAI ? 'AI 보정 요청' : '다음'}
                            </button>
                        )}

                        {step === 'result' && (
                            <button
                                onClick={handleSend}
                                disabled={sending}
                                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 font-medium shadow-lg disabled:opacity-50"
                            >
                                {/* ❌ 스피너 & '전송 중...' 제거 */}
                                <Send className="w-5 h-5" />
                                전송하기
                            </button>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}