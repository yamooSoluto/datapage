// components/onboarding/FirstSetupGuide.tsx
// 온보딩 완료 후 데이터 세팅 가이드

import React from 'react';
import { Database, CheckCircle, ArrowRight, X } from 'lucide-react';

interface FirstSetupGuideProps {
    open: boolean;
    onClose: () => void;
    onStartDataSetup: () => void;
    onSkip: () => void;
}

export default function FirstSetupGuide({
    open,
    onClose,
    onStartDataSetup,
    onSkip
}: FirstSetupGuideProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* 헤더 */}
                <div className="relative p-6 bg-gradient-to-br from-yellow-50 to-amber-50">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex flex-col items-center text-center">
                        <img
                            src="/logo.png"
                            alt="야무"
                            className="w-16 h-16 object-contain mb-4"
                        />
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                            환영합니다! 🎉
                        </h2>
                        <p className="text-sm text-gray-600">
                            기본 정보 설정이 완료되었습니다
                        </p>
                    </div>
                </div>

                {/* 본문 */}
                <div className="p-6">
                    <div className="space-y-4 mb-6">
                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm flex-shrink-0 mt-0.5">
                                <Database className="w-4 h-4 text-gray-900" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                                    데이터를 추가하세요
                                </h3>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    시설, 상품, 좌석 등 고객 문의에 필요한 데이터를 추가하면 더 정확한 답변을 제공할 수 있어요
                                </p>
                            </div>
                        </div>

                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-xs text-blue-900 leading-relaxed">
                                <span className="font-semibold">💡 Tip:</span> 나중에 언제든지 <strong>데이터 관리</strong> 탭에서 수정할 수 있어요
                            </p>
                        </div>
                    </div>

                    {/* 버튼 */}
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={onStartDataSetup}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-sm"
                        >
                            데이터 추가하기
                            <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onSkip}
                            className="w-full px-4 py-3 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-all text-sm"
                        >
                            나중에 할게요
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}