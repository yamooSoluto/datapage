
// pages/api/auth/create-magic-link.js
// ════════════════════════════════════════
// Vercel API: 매직링크 생성
// ════════════════════════════════════════

import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ✅ 1. N8N 인증 (선택사항)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.N8N_API_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { email, tenantId } = req.body;

    if (!email || !tenantId) {
      return res.status(400).json({ error: 'Email and tenantId required' });
    }

    // ✅ 2. JWT 토큰 생성
    const token = jwt.sign(
      { 
        email, 
        tenantId,
        type: 'magic_link'
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }  // 24시간 유효
    );

    // ✅ 3. 매직링크 생성
    const magicLink = `${process.env.NEXT_PUBLIC_BASE_URL}/auth/magic?token=${token}`;

    return res.status(200).json({
      success: true,
      token,
      magicLink,
    });

  } catch (error) {
    console.error('[Magic Link] Error:', error);
    return res.status(500).json({ error: 'Failed to create magic link' });
  }
}