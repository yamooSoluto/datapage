// lib/firebase-auth.js
// 웹 Firebase Auth (Custom Token 기반)

import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { app } from './firebaseClient'; // 클라이언트 Firebase 앱

const auth = getAuth(app);

// 단순 로그인 헬퍼
export async function loginWithCustomToken(customToken) {
    try {
        const userCredential = await signInWithCustomToken(auth, customToken);
        console.log('[auth] Logged in:', userCredential.user.uid);

        // 커스텀 클레임 확인
        const idTokenResult = await userCredential.user.getIdTokenResult(true);
        console.log('[auth] claims:', idTokenResult.claims);

        return {
            user: userCredential.user,
            claims: idTokenResult.claims,
        };
    } catch (error) {
        console.error('[auth] Login failed:', error);
        throw error;
    }
}

// 현재 로그인한 유저의 Custom Claims 바로 보기
export async function getCurrentClaims() {
    const user = auth.currentUser;
    if (!user) return null;
    const idTokenResult = await user.getIdTokenResult(true);
    return idTokenResult.claims;
}

export { auth };
