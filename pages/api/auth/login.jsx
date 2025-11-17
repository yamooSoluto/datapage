// pages/login.jsx (또는 해당 로그인 페이지)
// OTP 확인 후 Firebase 로그인 추가

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { loginWithCustomToken } from '@/lib/firebase-auth';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState('email'); // 'email' | 'otp'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // ✅ Step 1: 이메일 제출 (OTP 발송)
    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) {
                throw new Error('OTP 발송 실패');
            }

            setStep('otp');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ✅ Step 2: OTP 확인 + Firebase 로그인
    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1️⃣ OTP 검증 API 호출
            const response = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp }),
            });

            if (!response.ok) {
                throw new Error('OTP 확인 실패');
            }

            const data = await response.json();
            console.log('[Login] OTP verified:', data);

            // 2️⃣ 세션 확인 (Custom Token 받기)
            const sessionResponse = await fetch('/api/auth/verify-session');

            if (!sessionResponse.ok) {
                throw new Error('세션 확인 실패');
            }

            const sessionData = await sessionResponse.json();
            console.log('[Login] Session verified:', sessionData);

            // 3️⃣ ✅ Firebase Custom Token으로 로그인
            if (sessionData.firebase?.customToken) {
                console.log('[Login] Logging in to Firebase...');

                await loginWithCustomToken(sessionData.firebase.customToken);

                console.log('[Login] ✅ Firebase login success');
            } else {
                console.warn('[Login] ⚠️ No Firebase token received');
            }

            // 4️⃣ 대시보드로 이동
            router.push('/dashboard');
        } catch (err) {
            console.error('[Login] Error:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
                <div>
                    <h2 className="text-center text-3xl font-bold text-gray-900">
                        로그인
                    </h2>
                </div>

                {step === 'email' ? (
                    <form onSubmit={handleEmailSubmit} className="mt-8 space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                이메일
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                                placeholder="your@email.com"
                            />
                        </div>

                        {error && (
                            <div className="text-red-600 text-sm">{error}</div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? '전송 중...' : 'OTP 발송'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleOtpSubmit} className="mt-8 space-y-6">
                        <div>
                            <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                                인증 코드
                            </label>
                            <input
                                id="otp"
                                type="text"
                                required
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-center text-2xl tracking-widest"
                                placeholder="000000"
                                maxLength={6}
                                autoFocus
                            />
                            <p className="mt-2 text-sm text-gray-500">
                                {email}로 전송된 코드를 입력하세요
                            </p>
                        </div>

                        {error && (
                            <div className="text-red-600 text-sm">{error}</div>
                        )}

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setStep('email')}
                                className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                            >
                                이전
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? '확인 중...' : '로그인'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}