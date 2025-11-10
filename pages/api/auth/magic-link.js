// pages/api/auth/magic-link.js
// ════════════════════════════════════════
// 매직링크 검증 → HttpOnly 세션 쿠키(yamoo_session) 세팅
// ✅ Firestore 버전 (레거시 Sheets fallback 제거)
// ════════════════════════════════════════

import jwt from 'jsonwebtoken';

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
    const userEmail = decoded?.email ? String(decoded.email).toLowerCase() : null;

    // ✅ email 필드가 없는 레거시 토큰은 거부
    if (!userEmail) {
      return res.status(400).json({
        error: '레거시 토큰입니다. 새 로그인 링크를 요청하세요.',
        expired: false
      });
    }

    // 2) 세션 쿠키 발급 (24h)
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

    // 3) 선택적 리다이렉트: 같은 도메인 내 path만 허용 (open-redirect 방지)
    if (redirect && typeof redirect === 'string' && redirect.startsWith('/')) {
      res.writeHead(302, { Location: redirect });
      return res.end();
    }

    // 4) JSON 응답
    return res.status(200).json({
      success: true,
      email: userEmail,
      role: decoded.role || 'user',
    });

  } catch (error) {
    console.error('❌ [Magic Link] 오류:', error?.name || error?.message || error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: '로그인 링크가 만료되었습니다.',
        expired: true
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: '유효하지 않은 로그인 링크입니다.',
        expired: false
      });
    }

    return res.status(500).json({
      error: '서버 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}