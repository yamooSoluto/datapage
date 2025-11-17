// lib/firebase-client.js
// ════════════════════════════════════════
// Firebase Client SDK (클라이언트 전용)
// ⚠️ 브라우저(컴포넌트)에서만 사용!
// ════════════════════════════════════════

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (클라이언트 전용)
const app = getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0];

export const db = getFirestore(app);
export const auth = getAuth(app);
export { app };