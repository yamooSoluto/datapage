// pages/api/auth/verify-otp.js
// ════════════════════════════════════════
// OTP 코드 검증 및 세션 쿠키 발급
// ════════════════════════════════════════

import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';

// Firebase Admin 초기화
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  let formattedKey = privateKey;
  if (privateKey) {
    if (privateKey.includes('\n')) {
      formattedKey = privateKey;
    } else if (privateKey.includes('\\n')) {
      formattedKey = privateKey.replace(/\\n/g, '\n');
    }
    formattedKey = formattedKey.replace(/^["']|["']$/g, '');
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedKey,
      }),
    });
    console.log('✅ Firebase Admin initialized');
  } catch (initError) {
    console.error('❌ Firebase Admin initialization failed:', initError.message);
    throw initError;
  }
}

const db = admin.firestore();

function cookieString(
  name,
  value,
  { maxAge = 60 * 60 * 24, secure = process.env.NODE_ENV === 'production' } = {}
) {
  const c = `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  return c;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, code } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({ error: '이메일과 코드가 필요합니다.' });
  }

  try {
    const emailLower = email.toLowerCase();
    const codeStr = String(code).trim();

    // Firestore에서 OTP 코드 조회
    const otpSnapshot = await db.collection('otp_codes')
      .where('email', '==', emailLower)
      .where('used', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (otpSnapshot.empty) {
      return res.status(401).json({ error: '유효한 코드를 찾을 수 없습니다.' });
    }

    const otpDoc = otpSnapshot.docs[0];
    const otpData = otpDoc.data();

    // 만료 시간 확인
    const expiresAt = new Date(otpData.expiresAt);
    if (new Date() > expiresAt) {
      // 만료된 코드는 used로 표시
      await otpDoc.ref.update({ used: true });
      return res.status(401).json({ error: '코드가 만료되었습니다.' });
    }

    // 코드 일치 확인
    if (otpData.code !== codeStr) {
      return res.status(401).json({ error: '코드가 올바르지 않습니다.' });
    }

    // 코드 사용 처리
    await otpDoc.ref.update({ used: true });

    // 세션 쿠키 발급 (24시간)
    const now = Math.floor(Date.now() / 1000);
    const session = jwt.sign(
      {
        email: emailLower,
        role: 'user',
        source: 'otp-verified',
        iat: now,
        exp: now + 60 * 60 * 24,
      },
      process.env.JWT_SECRET
    );

    res.setHeader('Set-Cookie', cookieString('yamoo_session', session));

    console.log(`✅ [Verify OTP] ${emailLower} 로그인 성공`);

    return res.status(200).json({
      success: true,
      email: emailLower,
    });
  } catch (error) {
    console.error('❌ [Verify OTP] Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}

