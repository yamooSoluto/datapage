// pages/api/auth/request-magic-link.js
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: '올바른 이메일 주소를 입력해주세요.' });
  }

  try {
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
      range: 'Tenants!A2:K1000', // ✅ K열까지
    });

    const rows = response.data.values || [];
    const tenant = rows.find(row => row[3]?.toLowerCase() === email.toLowerCase());

    if (!tenant) {
      console.warn(`[Magic Link] 등록되지 않은 이메일: ${email}`);
      return res.status(200).json({ 
        success: true,
        message: '이메일이 등록되어 있다면 로그인 링크가 전송됩니다.'
      });
    }

    // ✅ JWT 토큰 생성 (7일 유효)
    const token = jwt.sign(
      {
        tenantId: tenant[0],
        email: tenant[3],
        brandName: tenant[2],
        plan: tenant[4],
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
      },
      process.env.JWT_SECRET
    );

    const portalDomain = process.env.PORTAL_DOMAIN || 'http://localhost:3000';
    const magicLink = `${portalDomain}/?token=${token}`;

    console.log(`✉️ [Magic Link] 생성: ${email} → ${tenant[0]}`);

    // ✅ n8n 이메일 전송
    if (process.env.N8N_EMAIL_WEBHOOK_URL) {
      try {
        await fetch(process.env.N8N_EMAIL_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            brandName: tenant[2],
            magicLink: magicLink,
            tenantId: tenant[0],
            plan: tenant[4],
            timestamp: new Date().toISOString()
          })
        });
        console.log(`📧 [Magic Link] 이메일 전송: ${email}`);
      } catch (webhookError) {
        console.error('❌ Webhook 실패:', webhookError.message);
      }
    } else {
      console.warn('⚠️ N8N_EMAIL_WEBHOOK_URL 미설정');
      if (process.env.NODE_ENV === 'development') {
        console.log('🔗 Magic Link:', magicLink);
      }
    }

    return res.status(200).json({
      success: true,
      message: '로그인 링크가 이메일로 전송되었습니다.',
      ...(process.env.NODE_ENV === 'development' && { magicLink })
    });

  } catch (error) {
    console.error('❌ [Magic Link] Error:', error);

    return res.status(500).json({
      error: '서버 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}