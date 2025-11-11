// pages/api/auth/create-magic-link.js
// ════════════════════════════════════════
// Vercel API: 매직링크 생성
// 정상 작동했던 버전 + 선택적 Firebase 지원
// ════════════════════════════════════════

import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ✅ N8N 인증 (환경변수가 설정된 경우만) - 기존과 동일
  if (process.env.N8N_API_SECRET) {
    const authHeader = req.headers.authorization;
    const expectedAuth = `Bearer ${process.env.N8N_API_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.warn('[Magic Link] Unauthorized request:', {
        received: authHeader ? 'Present' : 'Missing',
        expected: 'Bearer ***'
      });
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

    // ✅ JWT_SECRET 확인 - 기존과 동일
    if (!process.env.JWT_SECRET) {
      console.error('[Magic Link] JWT_SECRET not set!');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // ✅ JWT 토큰 생성 - 기존과 동일
    const token = jwt.sign(
      {
        email,
        tenantId,
        type: 'magic_link'
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }  // 24시간 유효
    );

    // ✅ BASE_URL 확인 및 폴백 - 기존과 동일
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.yamoo.ai.kr';
    const magicLink = `${baseUrl}/auth/magic?token=${token}`;

    console.log('[Magic Link] Created:', {
      email,
      tenantId,
      linkGenerated: true,
      baseUrl
    });

    // ✅ 선택적: Firebase에 로그 저장 (실패해도 무시)
    if (process.env.ENABLE_FIREBASE_LOGGING === 'true') {
      try {
        const { db } = require('@/lib/firebase');
        await db.collection('magic_link_logs').add({
          email,
          tenantId,
          createdAt: new Date().toISOString(),
          createdBy: 'n8n',
          ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
        });
        console.log('[Magic Link] Logged to Firebase');
      } catch (logError) {
        console.warn('[Magic Link] Firebase logging failed:', logError.message);
        // 로깅 실패는 무시하고 계속
      }
    }

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