// pages/api/auth/magic-link.js
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

    // ✅ 2. Google Sheets에서 테넌트 정보 조회
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
    
    // ✅ 3. 테넌트 찾기
    let tenant = null;
    
    if (decoded.tenantId) {
      tenant = rows.find(row => row[0] === decoded.tenantId);
    } else if (decoded.email) {
      tenant = rows.find(row => row[3]?.toLowerCase() === decoded.email.toLowerCase());
    }

    if (!tenant) {
      console.warn('❌ [Magic Link] 테넌트를 찾을 수 없음:', decoded);
      return res.status(404).json({ 
        error: '테넌트를 찾을 수 없습니다.',
        expired: false
      });
    }

    // ✅ 4. FAQ 개수 확인 (온보딩 표시 여부)
    let faqCount = 0;
    try {
      const faqResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'FAQ_Master!A2:A1000',
      });
      
      faqCount = (faqResponse.data.values || [])
        .filter(row => row[0] === tenant[0])
        .length;
    } catch (faqError) {
      console.warn('⚠️ FAQ 개수 조회 실패:', faqError.message);
    }

    // ✅ 5. 테넌트 정보 반환
    const tenantData = {
      id: tenant[0],                    // A: TenantID
      branchNo: tenant[1] || '',        // B: BranchNo
      name: tenant[2] || '',            // C: BrandName
      email: tenant[3] || '',           // D: Email
      plan: tenant[4] || 'trial',       // E: Plan
      status: tenant[5] || 'active',    // F: status
      createdAt: tenant[6] || '',       // G: CreatedAt
      widgetIframe: tenant[7] || '',    // H: WidgetLink
      onboardingFormLink: tenant[8] || '', // I: OnboardingFormLink
      naverOutbound: tenant[9] || '',   // J: NaverOutbound
      portalDomain: tenant[10] || '',   // K: PortalDomain
      showOnboarding: faqCount === 0,
      faqCount: faqCount
    };

    console.log('✅ [Magic Link] 로그인 성공:', tenantData.id, `(FAQ: ${faqCount}개)`);

    return res.status(200).json(tenantData);

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