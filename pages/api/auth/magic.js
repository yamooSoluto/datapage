// 포탈 매직링크 검증
//pages/auth/magic.js


import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import jwt from 'jsonwebtoken';

export default function MagicLogin() {
  const router = useRouter();
  const { token } = router.query;
  const [status, setStatus] = useState('verifying');  // verifying, success, error

  useEffect(() => {
    if (!token) return;

    verifyMagicLink(token);
  }, [token]);

  async function verifyMagicLink(token) {
    try {
      // ✅ JWT 검증
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // ✅ 만료 체크
      if (decoded.exp * 1000 < Date.now()) {
        setStatus('expired');
        return;
      }

      // ✅ 세션 저장
      localStorage.setItem('userEmail', decoded.email);
      localStorage.setItem('tenantId', decoded.tenantId);
      localStorage.setItem('magicLogin', 'true');

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600">
      <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-md w-full text-center">
        {status === 'verifying' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">로그인 중...</h2>
            <p className="text-gray-600">잠시만 기다려주세요</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-6xl mb-6">✅</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">로그인 완료!</h2>
            <p className="text-gray-600">포탈로 이동합니다...</p>
          </>
        )}

        {status === 'expired' && (
          <>
            <div className="text-6xl mb-6">⏰</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">링크가 만료되었습니다</h2>
            <p className="text-gray-600 mb-6">포탈에서 새 링크를 요청해주세요</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700"
            >
              포탈로 이동
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-6xl mb-6">❌</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">오류가 발생했습니다</h2>
            <p className="text-gray-600 mb-6">잘못된 링크이거나 만료되었습니다</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700"
            >
              포탈로 이동
            </button>
          </>
        )}
      </div>
    </div>
  );
}