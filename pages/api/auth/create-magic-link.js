// pages/api/auth/create-magic-link.js
// ════════════════════════════════════════
// Vercel API: 매직링크 생성
// ════════════════════════════════════════

import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ✅ N8N 인증 (환경변수가 설정된 경우만)
  if (process.env.N8N_API_SECRET) {
    const authHeader = req.headers.authorization;
    const expectedAuth = `Bearer ${process.env.N8N_API_SECRET}`;
    
    if (authHeader !== expectedAuth) {
      console.warn('[Magic Link] Unauthorized request:', { authHeader });
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } else {
    console.warn('[Magic Link] N8N_API_SECRET not set - skipping auth check');
  }

  try {
    const { email, tenantId } = req.body;

    if (!email || !tenantId) {
      return res.status(400).json({ error: 'Email and tenantId required' });
    }

    // ✅ JWT_SECRET 확인
    if (!process.env.JWT_SECRET) {
      console.error('[Magic Link] JWT_SECRET not set!');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // ✅ JWT 토큰 생성
    const token = jwt.sign(
      { 
        email, 
        tenantId,
        type: 'magic_link'
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }  // 24시간 유효
    );

    // ✅ BASE_URL 확인 및 폴백
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.yamoo.ai.kr';
    const magicLink = `${baseUrl}/auth/magic?token=${token}`;

    console.log('[Magic Link] Created:', { 
      email, 
      tenantId, 
      linkGenerated: true,
      baseUrl 
    });

    return res.status(200).json({
      success: true,
      token,
      magicLink,
    });

  } catch (error) {
    console.error('[Magic Link] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to create magic link',
      message: error.message 
    });
  }
}