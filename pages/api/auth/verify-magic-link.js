// pages/api/auth/verify-magic-link.js
// ════════════════════════════════════════
// 매직링크 토큰 검증 (서버 사이드)
// ════════════════════════════════════════

import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ 
        success: false,
        error: 'Token required' 
      });
    }

    // ✅ JWT 검증 (서버에서만!)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ 타입 체크
    if (decoded.type !== 'magic_link') {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid token type' 
      });
    }

    // ✅ 성공 응답
    return res.status(200).json({
      success: true,
      email: decoded.email,
      tenantId: decoded.tenantId
    });

  } catch (error) {
    console.error('[Magic Link] Verification failed:', error);

    // JWT 에러 타입별 처리
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        error: 'expired',
        message: '링크가 만료되었습니다' 
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        error: 'invalid',
        message: '잘못된 링크입니다' 
      });
    }

    return res.status(500).json({ 
      success: false,
      error: 'server_error',
      message: '서버 오류가 발생했습니다' 
    });
  }
}