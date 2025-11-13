// components/AIResultModal.jsx
// AI 보정 결과를 모달로 표시 (마지막 메시지 + 보정본 편집)

import { useState } from 'react';
import { X, Sparkles, MessageSquare, ArrowRight, User, Bot } from 'lucide-react';

export default function AIResultModal({
    originalText,      // 원본 텍스트
    correctedText,     // AI 보정된 텍스트
    lastUserMessage,   // 고객의 마지막 메시지
    recentMessages,    // 최근 대화 (선택사항)
    onSend,           // 전송 콜백
    onClose,          // 닫기 콜백
}) {
    const [editedText, setEditedText] = useState(correctedText);

    const handleSend = () => {
        if (!editedText.trim()) return;
        onSend(editedText);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">AI 답변 보정 완료</h2>
                            <p className="text-xs text-gray-500">고객 메시지를 확인하고 답변을 수정하세요</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 본문 */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

                    {/* 💬 고객의 마지막 메시지 (강조!) */}
                    {lastUserMessage && (
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                    <User className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-blue-900 mb-1">고객의 마지막 메시지</p>
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                        {lastUserMessage}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 최근 대화 컨텍스트 (접을 수 있는 섹션) */}
                    {recentMessages && recentMessages.length > 0 && (
                        <details className="group">
                            <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-gray-900 flex items-center gap-2">
                                <span>💬 최근 대화 보기</span>
                                <span className="text-xs text-gray-500">({recentMessages.length}개)</span>
                            </summary>
                            <div className="mt-3 space-y-2 pl-2 border-l-2 border-gray-200">
                                {recentMessages.slice(-5).map((msg, idx) => (
                                    <div key={idx} className="flex items-start gap-2">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${msg.sender === 'user' ? 'bg-blue-100' : 'bg-gray-100'
                                            }`}>
                                            {msg.sender === 'user' ? (
                                                <User className="w-3 h-3 text-blue-600" />
                                            ) : (
                                                <Bot className="w-3 h-3 text-gray-600" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs text-gray-500 mb-0.5">
                                                {msg.sender === 'user' ? '고객' : 'AI'}
                                            </p>
                                            <p className="text-sm text-gray-700">{msg.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}

                    {/* 원본 vs 보정본 비교 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* 원본 */}
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                            <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <span>📝</span>
                                <span>작성한 원본</span>
                            </p>
                            <div className="bg-white rounded-lg p-3 border border-gray-200 min-h-[100px]">
                                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                    {originalText}
                                </p>
                            </div>
                        </div>

                        {/* 화살표 (데스크탑에서만) */}
                        <div className="hidden lg:flex absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                            <div className="bg-white rounded-full p-2 shadow-lg border border-gray-200">
                                <ArrowRight className="w-5 h-5 text-blue-500" />
                            </div>
                        </div>

                        {/* AI 보정본 (편집 가능) */}
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-4">
                            <p className="text-xs font-semibold text-green-900 mb-2 flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                <span>AI 보정 결과 (수정 가능)</span>
                            </p>
                            <textarea
                                value={editedText}
                                onChange={(e) => setEditedText(e.target.value)}
                                className="w-full h-40 px-3 py-2 bg-white border-2 border-green-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                placeholder="AI가 보정한 답변을 확인하고 필요시 수정하세요..."
                            />
                            <p className="text-xs text-green-700 mt-2">
                                💡 고객 메시지를 참고하여 자유롭게 수정할 수 있습니다
                            </p>
                        </div>
                    </div>

                    {/* 안내 메시지 */}
                    <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-blue-900">
                            <p className="font-semibold mb-1">💬 답변 작성 팁</p>
                            <ul className="space-y-1 pl-4 list-disc">
                                <li>고객의 마지막 메시지를 참고하여 맥락에 맞게 수정하세요</li>
                                <li>AI 보정은 참고용이며, 필요시 자유롭게 수정 가능합니다</li>
                                <li>수정 완료 후 "전송하기" 버튼을 눌러주세요</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* 하단 버튼 */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                            <span className="font-medium">{editedText.length}</span>자
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={!editedText.trim()}
                                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-lg"
                            >
                                <MessageSquare className="w-5 h-5" />
                                전송하기
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}