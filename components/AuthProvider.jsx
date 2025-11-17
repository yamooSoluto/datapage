// components/AuthProvider.jsx
// Firebase Auth 자동 로그인 컴포넌트

import { useEffect, useState } from 'react';
import { loginWithCustomToken, auth } from '@/lib/firebase-auth';

export default function AuthProvider({ children }) {
    const [authReady, setAuthReady] = useState(false);
    const [user, setUser] = useState(null);

    useEffect(() => {
        // ✅ 세션 확인 + Firebase 로그인
        const initAuth = async () => {
            try {
                // 1. 세션 검증 API 호출
                const response = await fetch('/api/auth/verify-session');

                if (!response.ok) {
                    console.log('[Auth] No valid session');
                    setAuthReady(true);
                    return;
                }

                const data = await response.json();
                console.log('[Auth] Session verified:', data.email);

                // 2. Firebase Custom Token으로 로그인
                if (data.firebase?.customToken) {
                    const result = await loginWithCustomToken(data.firebase.customToken);

                    console.log('[Auth] Firebase login success');
                    console.log('[Auth] Claims:', result.claims);

                    setUser(result.user);
                }

                setAuthReady(true);
            } catch (error) {
                console.error('[Auth] Init failed:', error);
                setAuthReady(true);
            }
        };

        initAuth();

        // ✅ Firebase Auth 상태 변화 감지
        const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
            console.log('[Auth] State changed:', firebaseUser?.uid);
            setUser(firebaseUser);
        });

        return () => unsubscribe();
    }, []);

    if (!authReady) {
        return <div>로딩 중...</div>;
    }

    return <>{children}</>;
}