// components/AIComposerModal.jsx
// 초콤팩트 AI 보정 모달 - 가로 버튼 + 챗봇 모드 토글

import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Send, Wand2, CheckCircle, Clock, Edit, Database, Palette, User, Bot } from 'lucide-react';
import LibraryMacroDropdown from './LibraryMacroDropdown'; // ✅ 라이브러리 매크로 추가

export default function AIComposerModal({
    conversation,
    tenantId,
    planName = 'pro',
    onClose,
    onSend,
    initialText = '',
    libraryData = null, // ✅ 라이브러리 데이터 추가
}) {
    const [step, setStep] = useState('compose');

    // ✅ initialText가 있으면 custom, 없으면 completed
    const [responseType, setResponseType] = useState(
        initialText && initialText.trim() ? 'custom' : 'completed'
    );
    const [customInput, setCustomInput] = useState(initialText || '');

    // ✅ 챗봇 모드 토글 (기본: 상담원)
    const [isBotMode, setIsBotMode] = useState(false);

    // ✅ initialText 변경 시 자동 설정 (강화)
    useEffect(() => {
        if (initialText && initialText.trim()) {
            console.log('[AIComposerModal] initialText detected:', initialText);
            setCustomInput(initialText);
            setResponseType('custom');
        }
    }, [initialText]);

    // Business 플랜 옵션
    const [voice, setVoice] = useState('agent');
    const [contentType, setContentType] = useState('tone_correction');
    const [toneFlags, setToneFlags] = useState([]);

    const [processing, setProcessing] = useState(false);
    const [sending, setSending] = useState(false);
    const [correctedText, setCorrectedText] = useState('');
    const [error, setError] = useState('');

    // ✅ 라이브러리 매크로 상태
    const [showLibraryDropdown, setShowLibraryDropdown] = useState(false);
    const [macroSearchQuery, setMacroSearchQuery] = useState('');
    const [macroTriggerPosition, setMacroTriggerPosition] = useState(null);
    const [cursorPosition, setCursorPosition] = useState(0);
    const textareaRef = useRef(null);

    // ✅ 템플릿
    const templates = {
        completed: '처리가 완료되었습니다. 확인 부탁드립니다.',
        waiting: '확인 후 안내드리겠습니다. 잠시만 기다려주세요.',
    };

    const handleSubmit = async () => {
        setError('');

        let finalContent = '';

        // ✅ 선택된 응답 타입에 따라 내용 설정
        if (responseType === 'completed') {
            finalContent = templates.completed;
        } else if (responseType === 'waiting') {
            finalContent = templates.waiting;
        } else if (responseType === 'custom') {
            finalContent = customInput.trim();
            if (!finalContent) {
                setError('메시지를 입력해주세요.');
                return;
            }
        }

        // ✅ AI 보정 요청
        setProcessing(true);
        setStep('processing');

        try {
            // ✅ GCP 함수가 기대하는 형식에 맞춘 payload
            const payload = {
                tenantId,
                conversationId: conversation.chatId,
                userMessage: '', // ✅ 필수 필드 (API에서 자동으로 채워짐)
                agentInstruction: finalContent, // ✅ content → agentInstruction
                mode: contentType === 'policy_based' ? 'mediated' : 'tone_correction', // ✅ mode 추가
                source: 'web_portal',
                planName: planName || 'trial',
                voice: isBotMode ? 'bot' : 'agent', // ✅ 챗봇 모드 반영
                contentType: contentType || 'tone_correction',
                toneFlags: toneFlags.length > 0 ? toneFlags.join(',') : '', // ✅ 문자열로 변환
                csTone: null, // ✅ API에서 자동으로 채워짐
                previousMessages: [], // ✅ API에서 자동으로 채워짐
                executionMode: 'production', // ✅ 필수 필드
            };

            // ✅ Pro 플랜일 때는 기본값 설정
            if (planName === 'pro') {
                payload.voice = 'agent';
                payload.contentType = 'tone_correction';
                payload.toneFlags = '';
            }

            const response = await fetch('/api/ai/tone-correction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'AI 보정 요청 실패');
            }

            // ✅ 폴링으로 결과 대기
            const pollResult = async (conversationId, maxAttempts = 30) => {
                for (let i = 0; i < maxAttempts; i++) {
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    const pollResponse = await fetch(
                        `/api/ai/tone-correction/result?conversationId=${conversationId}&tenantId=${tenantId}`
                    );
                    const pollData = await pollResponse.json();

                    if (pollData.status === 'completed') {
                        return pollData.correctedText;
                    }

                    if (pollData.status === 'failed') {
                        throw new Error(pollData.error || 'AI 보정 실패');
                    }
                }

                throw new Error('AI 보정 시간 초과');
            };

            const result = await pollResult(conversation.chatId);
            setCorrectedText(result);
            setStep('result');

        } catch (err) {
            console.error('[AIComposerModal] Error:', err);
            setError(err.message);
            setStep('compose');
        } finally {
            setProcessing(false);
        }
    };

    const handleSendCorrected = async () => {
        if (!correctedText.trim()) return;

        setSending(true);
        try {
            await onSend?.(correctedText);
            onClose();
        } catch (err) {
            console.error('[AIComposerModal] Send error:', err);
            setError('전송에 실패했습니다.');
        } finally {
            setSending(false);
        }
    };

    const handleEdit = () => {
        setCustomInput(correctedText);
        setResponseType('custom');
        setStep('compose');
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
                style={{
                    maxHeight: step === 'compose' && responseType === 'custom' && toneFlags.includes('detail_adjust')
                        ? '85vh'
                        : step === 'compose' && responseType === 'custom'
                            ? '580px'
                            : '420px',
                    transition: 'max-height 0.3s ease-in-out'
                }}
            >
                {/* 헤더 */}
                <div className="px-5 py-4 border-b-[0.5px] border-gray-300 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">AI 답변 보정</h3>
                            <p className="text-xs text-gray-500">
                                {step === 'compose' && '응답을 선택하세요'}
                                {step === 'processing' && '보정 중...'}
                                {step === 'result' && '보정 완료'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-600" />
                    </button>
                </div>

                {/* 컨텐츠 */}
                <div className="flex-1 overflow-y-auto p-5">
                    {step === 'compose' && (
                        <div className="space-y-3">
                            {/* 야무지니 토글 - 우측 상단 */}
                            <div className="flex items-center justify-end gap-2">
                                <div className="text-xs text-gray-500">
                                    {isBotMode ? '야무지니가 답변해요' : '상담원이 답변해요'}
                                </div>
                                <button
                                    onClick={() => setIsBotMode(!isBotMode)}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${isBotMode ? 'bg-blue-600' : 'bg-gray-300'
                                        }`}
                                >
                                    <div
                                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform flex items-center justify-center ${isBotMode ? 'translate-x-5' : 'translate-x-0.5'
                                            }`}
                                    >
                                        {isBotMode ? (
                                            <Bot className="w-3 h-3 text-blue-600" />
                                        ) : (
                                            <User className="w-3 h-3 text-gray-600" />
                                        )}
                                    </div>
                                </button>
                            </div>

                            {/* Pill 버튼 */}
                            <div className="flex justify-center gap-2">
                                <button
                                    onClick={() => setResponseType('completed')}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-all text-sm font-medium ${responseType === 'completed'
                                        ? 'bg-green-500 text-white shadow-sm'
                                        : 'bg-white text-gray-600 hover:bg-gray-50 border-[0.5px] border-gray-300'
                                        }`}
                                >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    완료
                                </button>

                                <button
                                    onClick={() => setResponseType('waiting')}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-all text-sm font-medium ${responseType === 'waiting'
                                        ? 'bg-orange-500 text-white shadow-sm'
                                        : 'bg-white text-gray-600 hover:bg-gray-50 border-[0.5px] border-gray-300'
                                        }`}
                                >
                                    <Clock className="w-3.5 h-3.5" />
                                    대기
                                </button>

                                <button
                                    onClick={() => setResponseType('custom')}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-all text-sm font-medium ${responseType === 'custom'
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'bg-white text-gray-600 hover:bg-gray-50 border-[0.5px] border-gray-300'
                                        }`}
                                >
                                    <Edit className="w-3.5 h-3.5" />
                                    직접
                                </button>
                            </div>

                            {/* 선택된 템플릿 미리보기 */}
                            {(responseType === 'completed' || responseType === 'waiting') && (
                                <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-600 text-center">
                                    "{templates[responseType]}"
                                </div>
                            )}

                            {/* 직접 입력 시 textarea + 옵션들 */}
                            {responseType === 'custom' && (
                                <div className="space-y-3" style={{
                                    animation: 'slideDown 0.3s ease-out'
                                }}>
                                    <div className="relative">
                                        <textarea
                                            ref={textareaRef}
                                            value={customInput}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                const cursorPos = e.target.selectionStart;
                                                setCustomInput(value);
                                                setCursorPosition(cursorPos);

                                                // # 트리거 감지
                                                const textBeforeCursor = value.substring(0, cursorPos);
                                                const lastHashIndex = textBeforeCursor.lastIndexOf('#');

                                                if (lastHashIndex !== -1) {
                                                    const textAfterHash = textBeforeCursor.substring(lastHashIndex + 1);

                                                    // # 이후에 공백이 없고, 라이브러리 데이터가 있으면 드롭다운 표시
                                                    if (!textAfterHash.includes(' ') && libraryData) {
                                                        setMacroSearchQuery(textAfterHash);

                                                        // ✅ 위치 계산을 먼저 완료한 후 드롭다운 표시 (깜빡임 방지)
                                                        if (textareaRef.current) {
                                                            // 먼저 드롭다운 숨김 (깜빡임 방지)
                                                            setShowLibraryDropdown(false);

                                                            // 위치 계산
                                                            const rect = textareaRef.current.getBoundingClientRect();
                                                            const inputBottom = window.innerHeight - rect.top;

                                                            // 위치를 먼저 설정
                                                            setMacroTriggerPosition({
                                                                bottom: inputBottom + 8,
                                                                left: rect.left,
                                                            });

                                                            // 위치 설정이 완료된 후 다음 프레임에서 드롭다운 표시
                                                            requestAnimationFrame(() => {
                                                                requestAnimationFrame(() => {
                                                                    setShowLibraryDropdown(true);
                                                                });
                                                            });
                                                        } else {
                                                            setShowLibraryDropdown(false);
                                                            setMacroTriggerPosition(null);
                                                        }
                                                    } else {
                                                        setShowLibraryDropdown(false);
                                                        setMacroTriggerPosition(null);
                                                    }
                                                } else {
                                                    setShowLibraryDropdown(false);
                                                    setMacroTriggerPosition(null);
                                                }
                                            }}
                                            placeholder="답변을 직접 입력하세요... (# 입력하면 라이브러리 사용 가능)"
                                            rows={6}
                                            autoFocus
                                            className="w-full px-4 py-3 border-[0.5px] border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none resize-none text-sm text-gray-900 placeholder-gray-400"
                                        />

                                        {/* ✅ 라이브러리 드롭다운 */}
                                        {showLibraryDropdown && libraryData && macroTriggerPosition && (
                                            <LibraryMacroDropdown
                                                libraryData={libraryData}
                                                searchQuery={macroSearchQuery}
                                                onSelect={(value) => {
                                                    if (!textareaRef.current) return;

                                                    const textBeforeCursor = customInput.substring(0, cursorPosition);
                                                    const textAfterCursor = customInput.substring(cursorPosition);
                                                    const lastHashIndex = textBeforeCursor.lastIndexOf('#');

                                                    if (lastHashIndex !== -1) {
                                                        const newText =
                                                            customInput.substring(0, lastHashIndex) +
                                                            value +
                                                            ' ' +
                                                            textAfterCursor;

                                                        setCustomInput(newText);

                                                        const newCursorPos = lastHashIndex + value.length + 1;
                                                        setTimeout(() => {
                                                            textareaRef.current.focus();
                                                            textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                                                        }, 0);
                                                    }

                                                    setShowLibraryDropdown(false);
                                                    setMacroSearchQuery('');
                                                    setMacroTriggerPosition(null);
                                                }}
                                                position={macroTriggerPosition}
                                                onClose={() => {
                                                    setShowLibraryDropdown(false);
                                                    setMacroTriggerPosition(null);
                                                }}
                                            />
                                        )}
                                    </div>

                                    {/* 세그먼트 컨트롤 - 단순 보정 / 규정 데이터 참고 */}
                                    <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                                        <button
                                            onClick={() => setContentType('tone_correction')}
                                            className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${contentType === 'tone_correction'
                                                ? 'bg-white text-gray-900 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                        >
                                            단순 말투 보정
                                        </button>
                                        <button
                                            onClick={() => setContentType('policy_based')}
                                            className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${contentType === 'policy_based'
                                                ? 'bg-white text-gray-900 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                        >
                                            규정·데이터 참고
                                        </button>
                                    </div>

                                    {/* 디테일 조정 토글 */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-900">디테일 조정</span>
                                        <button
                                            onClick={() => {
                                                if (toneFlags.includes('detail_adjust')) {
                                                    setToneFlags([]);
                                                } else {
                                                    setToneFlags(['detail_adjust', 'auto_contextual']);
                                                }
                                            }}
                                            className={`relative w-11 h-6 rounded-full transition-colors ${toneFlags.includes('detail_adjust') ? 'bg-blue-600' : 'bg-gray-300'
                                                }`}
                                        >
                                            <div
                                                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${toneFlags.includes('detail_adjust') ? 'translate-x-5' : 'translate-x-0.5'
                                                    }`}
                                            />
                                        </button>
                                    </div>

                                    {/* 슬라이더들 - 토글 시 표시 */}
                                    {toneFlags.includes('detail_adjust') && (
                                        <div className="space-y-4 pt-2" style={{
                                            animation: 'slideDown 0.3s ease-out'
                                        }}>
                                            {/* 길이감 슬라이더 */}
                                            <div>
                                                <div className="text-xs font-semibold text-gray-700 mb-3">길이감</div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="2"
                                                    step="1"
                                                    value={
                                                        toneFlags.includes('concise_core') ? 0 :
                                                            toneFlags.includes('expanded_text') ? 2 : 1
                                                    }
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value);
                                                        setToneFlags(prev => {
                                                            let updated = prev.filter(f =>
                                                                f !== 'concise_core' && f !== 'expanded_text' && f !== 'auto_contextual'
                                                            );
                                                            if (val === 0) updated.push('concise_core');
                                                            else if (val === 2) updated.push('expanded_text');
                                                            else updated.push('auto_contextual');

                                                            if (!updated.includes('detail_adjust')) {
                                                                updated.push('detail_adjust');
                                                            }
                                                            return updated;
                                                        });
                                                    }}
                                                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                />
                                                <div className="flex justify-between items-center mt-2">
                                                    <span className="text-[11px] text-gray-400">간결</span>
                                                    <span className="text-[11px] text-gray-400">보통</span>
                                                    <span className="text-[11px] text-gray-400">풍부</span>
                                                </div>
                                            </div>

                                            {/* 어투 슬라이더 */}
                                            <div>
                                                <div className="text-xs font-semibold text-gray-700 mb-3">어투</div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="2"
                                                    step="1"
                                                    value={
                                                        toneFlags.includes('firm') ? 0 :
                                                            toneFlags.includes('auto_contextual') ? 1 : 2
                                                    }
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value);
                                                        setToneFlags(prev => {
                                                            // 어투 관련 플래그만 제거 (특수옵션 플래그는 유지)
                                                            let updated = prev.filter(f =>
                                                                f !== 'firm' &&
                                                                f !== 'auto_contextual' &&
                                                                f !== 'friendly'
                                                            );

                                                            if (val === 0) {
                                                                updated.push('firm');
                                                            } else if (val === 1) {
                                                                updated.push('auto_contextual');
                                                            } else {
                                                                updated.push('friendly');
                                                            }

                                                            if (!updated.includes('detail_adjust')) {
                                                                updated.push('detail_adjust');
                                                            }
                                                            return updated;
                                                        });
                                                    }}
                                                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                />
                                                <div className="flex justify-between items-center mt-2">
                                                    <span className="text-[11px] text-gray-400">공식적</span>
                                                    <span className="text-[11px] text-gray-400">균형</span>
                                                    <span className="text-[11px] text-gray-400">친근함</span>
                                                </div>
                                            </div>

                                            {/* 특수 옵션 드롭다운 */}
                                            <div>
                                                <label className="text-xs font-semibold text-gray-700 mb-2 block">특수 옵션</label>
                                                <select
                                                    value={
                                                        toneFlags.includes('with_emojis') ? 'with_emojis' :
                                                            toneFlags.includes('no_emojis') ? 'no_emojis' :
                                                                toneFlags.includes('empathetic') ? 'empathetic' :
                                                                    toneFlags.includes('playful_humor') ? 'playful_humor' :
                                                                        toneFlags.includes('translate') ? 'translate' :
                                                                            'none'
                                                    }
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setToneFlags(prev => {
                                                            // 특수 옵션 관련 플래그만 제거 (어투 슬라이더 플래그는 유지)
                                                            let updated = prev.filter(f =>
                                                                f !== 'with_emojis' &&
                                                                f !== 'no_emojis' &&
                                                                f !== 'empathetic' &&
                                                                f !== 'playful_humor' &&
                                                                f !== 'translate'
                                                            );

                                                            if (val !== 'none') {
                                                                updated.push(val);
                                                            }

                                                            // detail_adjust는 항상 유지
                                                            if (!updated.includes('detail_adjust')) {
                                                                updated.push('detail_adjust');
                                                            }
                                                            return updated;
                                                        });
                                                    }}
                                                    className="w-full px-3 py-2.5 bg-white border-[0.5px] border-gray-300 rounded-lg text-sm text-gray-700 focus:border-blue-500 focus:outline-none hover:border-gray-400 transition-colors cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23666%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3e%3cpolyline points=%276 9 12 15 18 9%27%3e%3c/polyline%3e%3c/svg%3e')] bg-[length:16px] bg-[right_0.5rem_center] bg-no-repeat pr-8"
                                                >
                                                    <option value="none">선택 안함 (기본)</option>
                                                    <option value="with_emojis">😊 이모티콘 활용</option>
                                                    <option value="no_emojis">🫥 이모티콘 없이</option>
                                                    <option value="empathetic">🥹 공감 잔뜩</option>
                                                    <option value="playful_humor">🤡 유쾌한 유머 한 스푼</option>
                                                    <option value="translate">🌐 외국어로 문의가 왔을 때</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Business 플랜 옵션 - 접기 */}
                            {planName === 'business' && (
                                <details className="group">
                                    <summary className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 cursor-pointer list-none flex items-center justify-between hover:bg-indigo-100 transition-colors">
                                        <span className="text-sm font-semibold text-gray-700">💼 비즈니스 옵션</span>
                                        <span className="text-gray-400 group-open:rotate-180 transition-transform text-xs">▼</span>
                                    </summary>
                                    <div className="mt-3 p-3 bg-gray-50 rounded-xl space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <select
                                                value={contentType}
                                                onChange={(e) => setContentType(e.target.value)}
                                                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            >
                                                <option value="tone_correction">톤 보정</option>
                                                <option value="professional">전문적</option>
                                                <option value="casual">캐주얼</option>
                                            </select>

                                            <div className="flex flex-wrap gap-1">
                                                {['친절', '공감'].map(flag => (
                                                    <button
                                                        key={flag}
                                                        onClick={() => {
                                                            setToneFlags(prev =>
                                                                prev.includes(flag)
                                                                    ? prev.filter(f => f !== flag)
                                                                    : [...prev, flag]
                                                            );
                                                        }}
                                                        className={`px-2 py-1 rounded-full text-xs font-medium transition-all ${toneFlags.includes(flag)
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-white text-gray-700 border border-gray-200'
                                                            }`}
                                                    >
                                                        {flag}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </details>
                            )}

                            {error && (
                                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 animate-pulse flex items-center justify-center mb-4">
                                <Wand2 className="w-8 h-8 text-white animate-bounce" />
                            </div>
                            <p className="text-sm font-semibold text-gray-900 mb-1">AI 보정 중</p>
                            <p className="text-xs text-gray-500">잠시만 기다려주세요...</p>
                        </div>
                    )}

                    {step === 'result' && (
                        <div className="space-y-3">
                            <div className="p-4 bg-white rounded-xl border-[0.5px] border-gray-300">
                                <div className="flex items-center gap-2 mb-3">
                                    <Sparkles className="w-4 h-4 text-purple-600" />
                                    <h4 className="text-sm font-semibold text-gray-900">AI 보정 완료</h4>
                                    {isBotMode && (
                                        <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                                            🤖
                                        </span>
                                    )}
                                </div>
                                <div className="bg-white rounded-xl p-3 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                    {correctedText}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleEdit}
                                    className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                                >
                                    수정
                                </button>
                                <button
                                    onClick={handleSendCorrected}
                                    disabled={sending}
                                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Send className="w-4 h-4" />
                                    {sending ? '전송 중...' : '전송'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 푸터 */}
                {step === 'compose' && (
                    <div className="px-5 py-3 border-t-[0.5px] border-gray-300 bg-white">
                        <button
                            onClick={handleSubmit}
                            disabled={processing}
                            className="w-full px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                        >
                            <Sparkles className="w-4 h-4" />
                            {processing ? 'AI 보정 중...' : 'AI 보정 받기'}
                        </button>
                    </div>
                )}
            </div>

            <style jsx>{`
                @keyframes slide-in-from-top {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .animate-in {
                    animation: slide-in-from-top 0.2s ease-out;
                }
            `}</style>
            <style jsx>{`
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
}