// pages/api/auth/magic-link.js
// ════════════════════════════════════════
// 매직링크 검증 → HttpOnly 세션 쿠키(yamoo_session) 세팅 (Firestore)
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

// 공통: 쿠키 문자열 생성기
function cookieString(
  name,
  value,
  { maxAge = 60 * 60 * 24, secure = process.env.NODE_ENV === 'production' } = {}
) {
  let c = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
  if (secure) c += '; Secure';
  return c;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, redirect } = req.query;
  if (!token) {
    return res.status(400).json({ error: '토큰이 필요합니다.' });
  }

  try {
    // 1) 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let userEmail = decoded?.email ? String(decoded.email).toLowerCase() : null;

    // 2) 레거시 토큰 지원: email이 없고 tenantId만 있는 경우
    if (!userEmail && decoded?.tenantId) {
      try {
        const tenantDoc = await db.collection('tenants').doc(decoded.tenantId).get();

        if (!tenantDoc.exists) {
          return res.status(404).json({
            error: '테넌트를 찾을 수 없습니다.',
            expired: false
          });
        }

        const tenant = tenantDoc.data();
        userEmail = String(tenant.email || '').toLowerCase();

        if (!userEmail) {
          return res.status(400).json({
            error: '레거시 토큰: 이메일을 찾을 수 없습니다.',
            expired: false
          });
        }
      } catch (firestoreError) {
        console.error('❌ [Magic Link] Firestore 조회 실패:', firestoreError);
        return res.status(500).json({
          error: '테넌트 정보 조회에 실패했습니다.',
          expired: false
        });
      }
    }

    if (!userEmail) {
      return res.status(400).json({ error: '유효하지 않은 토큰입니다.', expired: false });
    }

    // 3) 세션 쿠키 발급 (24h)
    const now = Math.floor(Date.now() / 1000);
    const session = jwt.sign(
      {
        email: userEmail,
        role: decoded.role || 'user',
        source: 'magic-link-verified',
        iat: now,
        exp: now + 60 * 60 * 24,
      },
      process.env.JWT_SECRET
    );

    res.setHeader('Set-Cookie', cookieString('yamoo_session', session));

    // 4) 선택적 리다이렉트: 같은 도메인 내 path만 허용 (open-redirect 방지)
    if (redirect && typeof redirect === 'string' && redirect.startsWith('/')) {
      res.writeHead(302, { Location: redirect });
      return res.end();
    }

    // 5) JSON 응답 (프론트에서 테넌트 목록 조회 등 이어가기)
    return res.status(200).json({
      success: true,
      email: userEmail,
      role: decoded.role || 'user',
    });
  } catch (error) {
    console.error('❌ [Magic Link] 오류:', error?.name || error?.message || error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '로그인 링크가 만료되었습니다.', expired: true });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '유효하지 않은 로그인 링크입니다.', expired: false });
    }

    return res.status(500).json({
      error: '서버 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}