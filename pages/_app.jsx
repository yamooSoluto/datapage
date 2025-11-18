// pages/_app.jsx
// Firebase Auth 자동 초기화 추가

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase-client';
import { signInWithCustomToken } from 'firebase/auth';

function MyApp({ Component, pageProps }) {
    const [authInitialized, setAuthInitialized] = useState(false);
    const [authError, setAuthError] = useState(null);

    useEffect(() => {
        const initializeFirebaseAuth = async () => {
            try {
                // ✅ 1. 이미 Firebase에 로그인되어 있으면 스킵
                if (auth.currentUser) {
                    console.log('✅ [Auth Init] Already logged in:', auth.currentUser.email);

                    // Claims 확인
                    const idToken = await auth.currentUser.getIdTokenResult(true);
                    console.log('✅ [Auth Init] Claims:', {
                        email: idToken.claims.email,
                        role: idToken.claims.role,
                        allowedTenants: idToken.claims.allowedTenants,
                    });

                    setAuthInitialized(true);
                    return;
                }

                console.log('🔐 [Auth Init] No Firebase user, checking session...');

                // ✅ 2. 세션 쿠키 확인 및 Custom Token 받기
                const res = await fetch('/api/auth/verify-session', {
                    credentials: 'include',
                });

                // 세션이 없으면 (로그인 안 한 상태) 정상 처리
                if (res.status === 401) {
                    console.log('ℹ️ [Auth Init] No session found (not logged in)');
                    setAuthInitialized(true);
                    return;
                }

                if (!res.ok) {
                    throw new Error(`Session verification failed: ${res.status}`);
                }

                const data = await res.json();

                // ✅ 3. Custom Token으로 Firebase Auth 로그인
                if (data.firebase?.customToken) {
                    console.log('🔐 [Auth Init] Logging in to Firebase with custom token...');

                    const userCredential = await signInWithCustomToken(auth, data.firebase.customToken);

                    console.log('✅ [Auth Init] Firebase login success:', userCredential.user.email);

                    // ✅ 4. Custom Claims 확인
                    const idToken = await userCredential.user.getIdTokenResult(true);
                    console.log('✅ [Auth Init] Custom Claims:', {
                        email: idToken.claims.email,
                        role: idToken.claims.role,
                        allowedTenants: idToken.claims.allowedTenants,
                        isAdmin: idToken.claims.isAdmin,
                    });

                    // Firestore 권한 확인
                    if (!idToken.claims.allowedTenants || idToken.claims.allowedTenants.length === 0) {
                        console.warn('⚠️ [Auth Init] No allowed tenants in claims');
                    }
                } else {
                    console.warn('⚠️ [Auth Init] No custom token in session response');
                }

                setAuthInitialized(true);
            } catch (error) {
                console.error('❌ [Auth Init] Firebase auth initialization failed:', error);
                setAuthError(error.message);
                setAuthInitialized(true); // 에러가 나도 앱은 렌더링
            }
        };

        initializeFirebaseAuth();
    }, []);

    // ✅ 인증 초기화 중에는 로딩 표시 (선택 사항)
    if (!authInitialized) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)',
            }}>
                <div style={{ textAlign: 'center', color: 'white' }}>
                    <div style={{
                        border: '4px solid rgba(255,255,255,0.3)',
                        borderTop: '4px solid white',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        margin: '0 auto',
                    }} />
                    <p style={{ marginTop: '20px', fontSize: '18px', fontWeight: '600' }}>
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

    // ✅ 에러가 있어도 앱은 렌더링 (로그인 페이지로 갈 수 있도록)
    return <Component {...pageProps} authError={authError} />;
}

export default MyApp;