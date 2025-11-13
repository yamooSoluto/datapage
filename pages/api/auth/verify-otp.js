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
  // JWT 토큰에는 특수문자가 포함될 수 있으므로 인코딩 필요
  const encodedValue = encodeURIComponent(value);
  let c = `${name}=${encodedValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
  if (secure) c += '; Secure';
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

    // Firestore에서 OTP 코드 조회 (인덱스 없이 동작하도록 단순화)
    const otpSnapshot = await db.collection('otp_codes')
      .where('email', '==', emailLower)
      .where('used', '==', false)
      .get();

    if (otpSnapshot.empty) {
      return res.status(401).json({ error: '유효한 코드를 찾을 수 없습니다.' });
    }

    // 가장 최근 코드 찾기 (클라이언트에서 정렬)
    const validCodes = otpSnapshot.docs
      .map(doc => ({ doc, data: doc.data() }))
      .filter(({ data }) => {
        const expiresAt = new Date(data.expiresAt);
        return new Date() <= expiresAt; // 만료되지 않은 것만
      })
      .sort((a, b) => {
        // createdAt 기준 내림차순 정렬
        const aTime = new Date(a.data.createdAt).getTime();
        const bTime = new Date(b.data.createdAt).getTime();
        return bTime - aTime;
      });

    if (validCodes.length === 0) {
      return res.status(401).json({ error: '코드가 만료되었습니다.' });
    }

    const { doc: otpDoc, data: otpData } = validCodes[0];

    // 코드 일치 확인 (만료 시간은 이미 필터링됨)
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

    const cookieHeader = cookieString('yamoo_session', session);
    res.setHeader('Set-Cookie', cookieHeader);
    
    console.log(`✅ [Verify OTP] ${emailLower} 로그인 성공`);
    console.log(`🍪 [Verify OTP] 쿠키 설정: ${cookieHeader.substring(0, 50)}...`);

    return res.status(200).json({
      success: true,
      email: emailLower,
    });
  } catch (error) {
    console.error('❌ [Verify OTP] Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}

