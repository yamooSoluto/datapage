// lib/firebase-auth.js
// ════════════════════════════════════════
// Firebase Auth 헬퍼 (클라이언트 전용)
// ⚠️ 브라우저에서만 사용!
// ════════════════════════════════════════

import { signInWithCustomToken } from 'firebase/auth';
import { auth } from './firebase-client';

// Custom Token 로그인
export async function loginWithCustomToken(customToken) {
    try {
        const userCredential = await signInWithCustomToken(auth, customToken);
        console.log('[firebase-auth] Logged in:', userCredential.user.uid);

        // Custom Claims 확인
        const idTokenResult = await userCredential.user.getIdTokenResult(true);
        console.log('[firebase-auth] Claims:', idTokenResult.claims);

        return {
            user: userCredential.user,
            claims: idTokenResult.claims,
        };
    } catch (error) {
        console.error('[firebase-auth] Login failed:', error);
        throw error;
    }
}

// 현재 사용자의 Custom Claims 조회
export async function getCurrentClaims() {
    if (!auth.currentUser) {
        return null;
    }

    const idTokenResult = await auth.currentUser.getIdTokenResult(true);
    return idTokenResult.claims;
}

// Auth 인스턴스 export
export { auth };