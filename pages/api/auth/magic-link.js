// pages/api/auth/magic-link.js
// ════════════════════════════════════════
// 매직링크 검증 → HttpOnly 세션 쿠키(yamoo_session) 세팅
// (레거시: email 없음 & tenantId만 있을 때 Sheets fallback 지원)
// ════════════════════════════════════════

import jwt from 'jsonwebtoken';
import { google } from 'googleapis';

// 공통: 쿠키 문자열 생성기
function cookieString(
  name,
  value,
  { maxAge = 60 * 60 * 24, secure = process.env.NODE_ENV === 'production' } = {}
) {
  // SameSite=Lax 로 외부 리다이렉트 시도 최소화, 프로덕션에선 Secure
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
    // 기대 payload: { email?: string, role?: 'user'|'admin', ... }
    let userEmail = decoded?.email ? String(decoded.email).toLowerCase() : null;

    // 2) 레거시 토큰 지원: email이 없고 tenantId만 있는 경우
    if (!userEmail && decoded?.tenantId) {
      const hasSheetsEnv =
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
        process.env.GOOGLE_PRIVATE_KEY &&
        process.env.GOOGLE_SHEET_ID;

      if (hasSheetsEnv) {
        const auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          },
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: 'Tenants!A2:K1000',
        });

        const rows = response.data.values || [];
        const tenant = rows.find((row) => row[0] === decoded.tenantId); // A열: tenantId
        if (!tenant) {
          return res.status(404).json({ error: '테넌트를 찾을 수 없습니다.', expired: false });
        }
        userEmail = String(tenant[3] || '').toLowerCase(); // D열: Email
        if (!userEmail) {
          return res.status(400).json({ error: '레거시 토큰: 이메일을 찾을 수 없습니다.', expired: false });
        }
      } else {
        // 앞으로 시트 사용 중단 시 여기로 떨어짐
        return res.status(400).json({
          error: '레거시 토큰(tenantId)입니다. 새 로그인 링크를 요청하세요.',
          expired: false,
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
        role: decoded.role || 'user',        // 매직링크 기본은 user
        source: 'magic-link-verified',       // 감사/추적용
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
