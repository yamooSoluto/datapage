// pages/auth/magic.js
// ════════════════════════════════════════
// 포탈 매직링크 검증 (보안 개선)
// ════════════════════════════════════════

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function MagicLogin() {
  const router = useRouter();
  const { token } = router.query;
  const [status, setStatus] = useState('verifying');  // verifying, success, expired, error

  useEffect(() => {
    if (!token) return;
    verifyMagicLink(token);
  }, [token]);

  // ✅ 수정: 서버에서 검증하도록 변경
  async function verifyMagicLink(token) {
    try {
      // ✅ API 호출 (서버에서 JWT 검증)
      const response = await fetch('/api/auth/verify-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      // ✅ 검증 실패 처리
      if (!data.success) {
        if (data.error === 'expired') {
          setStatus('expired');
        } else {
          setStatus('error');
        }
        return;
      }

      // ✅ 세션 저장
      localStorage.setItem('userEmail', data.email);
      localStorage.setItem('tenantId', data.tenantId);
      localStorage.setItem('magicLogin', 'true');
      localStorage.setItem('loginTime', new Date().toISOString());

      setStatus('success');

      // ✅ 포탈로 리다이렉트 (2초 후)
      setTimeout(() => {
        router.push('/');
      }, 2000);

    } catch (error) {
      console.error('[Magic Link] Verification failed:', error);
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500">
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-12 max-w-md w-full text-center border border-white/20">
        
        {status === 'verifying' && (
          <>
            <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-yellow-500 mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">로그인 중...</h2>
            <p className="text-gray-600">잠시만 기다려주세요</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-6xl mb-6 animate-bounce">✅</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">로그인 완료!</h2>
            <p className="text-gray-600">야무 포탈로 이동합니다...</p>
          </>
        )}

        {status === 'expired' && (
          <>
            <div className="text-6xl mb-6">⏰</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">링크가 만료되었습니다</h2>
            <p className="text-gray-600 mb-6">매직링크는 24시간 동안만 유효합니다</p>
            <button
              onClick={() => router.push('/')}
              className="px-8 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105"
            >
              포탈로 이동
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-6xl mb-6">❌</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">오류가 발생했습니다</h2>
            <p className="text-gray-600 mb-6">잘못된 링크이거나 이미 사용된 링크입니다</p>
            <button
              onClick={() => router.push('/')}
              className="px-8 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105"
            >
              포탈로 이동
            </button>
          </>
        )}
      </div>
    </div>
  );
}