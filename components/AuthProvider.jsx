// components/AuthProvider.jsx
// Firebase Auth 자동 로그인 + 재인증 처리

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { loginWithCustomToken, auth } from '@/lib/firebase-auth';

export default function AuthProvider({ children }) {
    const router = useRouter();
    const [authReady, setAuthReady] = useState(false);
    const [user, setUser] = useState(null);

    useEffect(() => {
        // ✅ Firebase Auth 초기화
        const initAuth = async () => {
            try {
                // 1️⃣ 이미 Firebase에 로그인되어 있는지 확인
                const currentUser = auth.currentUser;

                if (currentUser) {
                    console.log('[Auth] Already logged in:', currentUser.uid);
                    setUser(currentUser);
                    setAuthReady(true);
                    return;
                }

                // 2️⃣ 세션 쿠키 확인 + Firebase 로그인
                console.log('[Auth] Checking session...');

                const response = await fetch('/api/auth/verify-session');

                if (!response.ok) {
                    console.log('[Auth] No valid session');
                    setAuthReady(true);
                    return;
                }

                const data = await response.json();
                console.log('[Auth] Session verified:', data.email);

                // 3️⃣ Firebase Custom Token으로 로그인
                if (data.firebase?.customToken) {
                    console.log('[Auth] Logging in to Firebase...');

                    const result = await loginWithCustomToken(data.firebase.customToken);

                    console.log('[Auth] ✅ Firebase login success');
                    console.log('[Auth] Claims:', result.claims);

                    setUser(result.user);
                } else {
                    console.warn('[Auth] ⚠️ No Firebase token received');
                }

                setAuthReady(true);
            } catch (error) {
                console.error('[Auth] Init failed:', error);
                setAuthReady(true);

                // 세션 만료 시 로그인 페이지로
                if (error.message?.includes('세션') || error.message?.includes('401')) {
                    router.push('/login');
                }
            }
        };

        initAuth();

        // ✅ Firebase Auth 상태 변화 감지
        const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
            console.log('[Auth] State changed:', firebaseUser?.uid || 'signed out');
            setUser(firebaseUser);

            // 로그아웃 시 로그인 페이지로
            if (!firebaseUser && authReady) {
                const publicRoutes = ['/login', '/signup'];
                if (!publicRoutes.includes(router.pathname)) {
                    router.push('/login');
                }
            }
        });

        return () => unsubscribe();
    }, []);

    // ✅ 로딩 화면
    if (!authReady) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">인증 확인 중...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}