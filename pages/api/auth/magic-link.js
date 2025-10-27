// pages/api/auth/magic-link.js
// ════════════════════════════════════════
// 매직링크 토큰 검증 (이메일만 반환)
// 프론트엔드에서 해당 이메일로 테넌트 목록 조회
// ════════════════════════════════════════

import jwt from 'jsonwebtoken';
import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: '토큰이 필요합니다.' });
  }

  try {
    // ✅ 1. JWT 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    console.log('✅ [Magic Link] 토큰 검증 성공:', decoded.tenantId || decoded.email);

    // ✅ 2. 토큰에서 이메일 추출
    let userEmail = decoded.email;

    // 토큰에 tenantId가 있지만 email이 없는 경우 (레거시 토큰)
    if (!userEmail && decoded.tenantId) {
      // Google Sheets에서 tenantId로 이메일 찾기
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'Tenants!A2:K1000',
      });

      const rows = response.data.values || [];
      const tenant = rows.find(row => row[0] === decoded.tenantId);

      if (tenant) {
        userEmail = tenant[3]; // D: Email
      } else {
        console.warn('❌ [Magic Link] 테넌트를 찾을 수 없음:', decoded.tenantId);
        return res.status(404).json({ 
          error: '테넌트를 찾을 수 없습니다.',
          expired: false
        });
      }
    }

    if (!userEmail) {
      return res.status(400).json({
        error: '유효하지 않은 토큰입니다.',
        expired: false
      });
    }

    // ✅ 3. 이메일만 반환 (프론트엔드에서 테넌트 목록 조회)
    console.log(`✅ [Magic Link] 이메일 확인: ${userEmail}`);

    return res.status(200).json({
      success: true,
      email: userEmail
    });

  } catch (error) {
    console.error('❌ [Magic Link] 오류:', error);

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
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}