// components/LoginPWA.jsx
// ════════════════════════════════════════
// PWA용 로그인 컴포넌트 (OTP 방식)
// ════════════════════════════════════════

import { useState } from 'react';
import { Mail, Lock, Loader2 } from 'lucide-react';

export default function LoginPWA({ onLoginSuccess }) {
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 이메일 입력 후 OTP 발송
  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('이메일을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mode: 'otp' }), // mode=otp로 구분
      });

      const data = await res.json();

      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'OTP 발송에 실패했습니다.');
      }

      // 다음 단계로 진행
      setStep('code');
    } catch (err) {
      setError(err.message || 'OTP 발송에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // OTP 코드 검증 및 로그인
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setError('6자리 코드를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || '코드가 올바르지 않습니다.');
      }

      // ✅ 여기서 서버가 yamoo_session 쿠키를 이미 발급함
      //    → 세션 쿠키를 확인하여 테넌트 조회 및 로그인 세팅
      if (typeof onLoginSuccess === 'function') {
        // 세션 쿠키가 설정되었으므로 잠시 대기 후 세션 확인
        await new Promise(resolve => setTimeout(resolve, 100));
        await onLoginSuccess();
      } else {
        // 페이지 리로드하여 checkAuth가 세션 쿠키를 확인하도록 함
        window.location.href = '/';
      }
    } catch (err) {
      setError(err.message || '코드가 올바르지 않습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-amber-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* 로고 / 타이틀 */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="야무"
            className="w-20 h-20 object-contain mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">나만의 맞춤 AI비서</h1>
          <p className="text-gray-600">
            {step === 'email'
              ? '이메일로 로그인하세요'
              : '이메일로 전송된 코드를 입력하세요'}
          </p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 이메일 입력 단계 */}
        {step === 'email' && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:outline-none"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 rounded-xl hover:shadow-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>전송 중...</span>
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  <span>로그인 코드 받기</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* 코드 입력 단계 */}
        {step === 'code' && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                6자리 코드
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setCode(value);
                  }}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:outline-none text-center text-2xl tracking-widest font-mono"
                  disabled={isLoading}
                  required
                />
              </div>
              <p className="mt-2 text-xs text-gray-500 text-center">
                {email} 로 전송된 코드를 입력하세요
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setError('');
                }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium"
                disabled={isLoading}
              >
                이메일 변경
              </button>
              <button
                type="submit"
                disabled={isLoading || code.length !== 6}
                className="flex-1 py-3 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 rounded-xl hover:shadow-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>확인 중...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    <span>로그인</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
