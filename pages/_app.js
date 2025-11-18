// pages/_app.js
import '../styles/globals.css';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { auth, loginWithCustomToken } from '../lib/firebase-auth';

function MyApp({ Component, pageProps }) {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // ✅ 1. 이미 Firebase에 로그인되어 있으면 스킵
        if (auth.currentUser) {
          console.log('✅ [Auth] Already logged in:', auth.currentUser.email);

          const idToken = await auth.currentUser.getIdTokenResult(true);
          console.log('✅ [Auth] allowedTenants:', idToken.claims.allowedTenants);

          setAuthReady(true);
          return;
        }

        console.log('🔐 [Auth] Checking session...');

        // ✅ 2. 세션 확인 및 Custom Token 받기
        const res = await fetch('/api/auth/verify-session', {
          credentials: 'include',
        });

        // 로그인 안 한 상태면 정상 처리
        if (res.status === 401) {
          console.log('ℹ️ [Auth] No session (not logged in)');
          setAuthReady(true);
          return;
        }

        if (!res.ok) {
          console.warn('⚠️ [Auth] Session check failed:', res.status);
          setAuthReady(true);
          return;
        }

        const data = await res.json();

        // ✅ 3. Custom Token으로 Firebase 로그인
        if (data.firebase?.customToken) {
          console.log('🔐 [Auth] Logging in to Firebase...');

          const { user, claims } = await loginWithCustomToken(data.firebase.customToken);

          console.log('✅ [Auth] Firebase login success:', user.email);
          console.log('✅ [Auth] allowedTenants:', claims.allowedTenants);

          if (!claims.allowedTenants || claims.allowedTenants.length === 0) {
            console.warn('⚠️ [Auth] No allowed tenants in claims!');
          }
        } else {
          console.warn('⚠️ [Auth] No custom token in response');
        }

        setAuthReady(true);
      } catch (error) {
        console.error('❌ [Auth] Initialization failed:', error);
        setAuthReady(true); // 에러가 나도 앱은 렌더링
      }
    };

    initAuth();
  }, []);

  // ✅ 인증 초기화 중 로딩 (선택 사항 - 제거해도 됨)
  if (!authReady) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)',
        }}
      >
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div
            style={{
              border: '4px solid rgba(255,255,255,0.3)',
              borderTop: '4px solid white',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              margin: '0 auto',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p style={{ marginTop: '20px', fontSize: '16px', fontWeight: '600' }}>
            초기화 중...
          </p>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <Component {...pageProps} />
      <Toaster position="top-right" />
    </>
  );
}

export default MyApp;