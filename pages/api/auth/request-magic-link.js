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
    // ✅ 1. Google Sheets에서 이메일로 테넌트 검색
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
      range: 'Tenants!A2:H1000',
    });

    const rows = response.data.values || [];
    const tenant = rows.find(row => row[3]?.toLowerCase() === email.toLowerCase());

    if (!tenant) {
      console.warn(`[Magic Link] 등록되지 않은 이메일: ${email}`);
      // 보안상 존재 여부를 명확히 알려주지 않음
      return res.status(200).json({ 
        success: true,
        message: '이메일이 등록되어 있다면 로그인 링크가 전송됩니다.'
      });
    }

    // ✅ 2. JWT 토큰 생성 (7일 유효)
    const token = jwt.sign(
      {
        tenantId: tenant[0],      // A: TenantID
        email: tenant[3],         // D: Email
        brandName: tenant[2],     // C: BrandName
        plan: tenant[4],          // E: Plan
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7일
      },
      process.env.JWT_SECRET
    );

    const portalDomain = process.env.PORTAL_DOMAIN || 'http://localhost:3000';
    const magicLink = `${portalDomain}/?token=${token}`;

    console.log(`✉️ [Magic Link] 생성됨: ${email} → ${tenant[0]}`);

    // ✅ 3. n8n Webhook으로 이메일 전송 요청
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
        console.log(`📧 [Magic Link] 이메일 전송 요청: ${email}`);
      } catch (webhookError) {
        console.error('❌ [Magic Link] Webhook 실패:', webhookError.message);
        // Webhook 실패해도 토큰은 생성됨 (수동으로라도 전달 가능)
      }
    } else {
      console.warn('⚠️ [Magic Link] N8N_EMAIL_WEBHOOK_URL 미설정');
      // 개발 환경에서는 콘솔에 링크 출력
      if (process.env.NODE_ENV === 'development') {
        console.log('🔗 Magic Link:', magicLink);
      }
    }

    return res.status(200).json({
      success: true,
      message: '로그인 링크가 이메일로 전송되었습니다.',
      // 개발 환경에서만 토큰 노출
      ...(process.env.NODE_ENV === 'development' && { magicLink })
    });

  } catch (error) {
    console.error('❌ [Magic Link] Error:', error);

    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ 
        error: 'Google Sheets 연결에 실패했습니다.',
      });
    }

    return res.status(500).json({
      error: '서버 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// ===================================
// .env.local 설정
// ===================================
/*
JWT_SECRET=your-super-secret-key
GOOGLE_SHEET_ID=your-sheet-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN..."

PORTAL_DOMAIN=https://portal.yoursite.com
N8N_EMAIL_WEBHOOK_URL=https://your-n8n.com/webhook/send-magic-link

NODE_ENV=development  # 개발 모드에서는 콘솔에 Magic Link 출력
*/

// ===================================
// n8n 이메일 전송 워크플로우
// ===================================
/*
Webhook 노드:
- Path: send-magic-link
- Method: POST

Code 노드:
const { to, brandName, magicLink } = $input.item.json;

return {
  json: {
    to,
    subject: `🔐 ${brandName || '포털'} 로그인 링크`,
    html: `
      <h2>안녕하세요!</h2>
      <p>로그인하려면 아래 버튼을 클릭하세요:</p>
      <a href="${magicLink}" 
         style="display:inline-block; padding:15px 30px; 
                background:#6366f1; color:white; 
                text-decoration:none; border-radius:8px;">
        로그인하기
      </a>
      <p style="color:#666; font-size:14px; margin-top:20px;">
        링크는 7일간 유효합니다.<br>
        본인이 요청하지 않았다면 이 메일을 무시하세요.
      </p>
    `
  }
};

Send Email 노드:
- To: {{$json.to}}
- Subject: {{$json.subject}}
- HTML: {{$json.html}}
*/