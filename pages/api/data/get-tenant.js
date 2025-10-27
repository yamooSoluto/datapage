// pages/api/data/get-tenant.js
// ════════════════════════════════════════
// 특정 테넌트 정보 조회 (이메일 + TenantID)
// ════════════════════════════════════════

import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, tenantId } = req.query;

  if (!email || !tenantId) {
    return res.status(400).json({ error: 'Email and tenantId are required' });
  }

  try {
    // ✅ Google Sheets 인증
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // ✅ Tenants 시트에서 데이터 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Tenants!A2:K1000',
    });

    const rows = response.data.values || [];
    
    // ✅ 이메일과 TenantID가 모두 일치하는 행 찾기
    const tenant = rows.find(row => 
      row[0] === tenantId && 
      row[3]?.toLowerCase() === email.toLowerCase()
    );

    if (!tenant) {
      console.warn(`[Get Tenant] 테넌트를 찾을 수 없음: ${email} / ${tenantId}`);
      return res.status(404).json({ 
        error: '테넌트를 찾을 수 없습니다.'
      });
    }

    // ✅ FAQ 개수 확인
    let faqCount = 0;
    try {
      const faqResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'FAQ_Master!A2:A1000',
      });
      
      faqCount = (faqResponse.data.values || [])
        .filter(row => row[0] === tenantId)
        .length;
    } catch (faqError) {
      console.warn('⚠️ FAQ 개수 조회 실패:', faqError.message);
    }

    // ✅ 테넌트 정보 반환
    const tenantData = {
      id: tenant[0],                    // A: TenantID
      branchNo: tenant[1] || '',        // B: BranchNo
      brandName: tenant[2] || '',       // C: BrandName (헤더에서 사용)
      name: tenant[2] || '',            // C: BrandName (하위호환)
      email: tenant[3] || '',           // D: Email
      plan: tenant[4] || 'trial',       // E: Plan
      status: tenant[5] || 'active',    // F: status
      createdAt: tenant[6] || '',       // G: CreatedAt
      WidgetLink: tenant[7] || '',      // H: WidgetLink (온보딩에서 사용)
      widgetIframe: tenant[7] || '',    // H: WidgetLink (하위호환)
      OnboardingFormLink: tenant[8] || '', // I: OnboardingFormLink (온보딩에서 사용)
      onboardingFormLink: tenant[8] || '', // I: OnboardingFormLink (하위호환)
      NaverOutbound: tenant[9] || '',   // J: NaverOutbound (온보딩에서 사용)
      naverOutbound: tenant[9] || '',   // J: NaverOutbound (하위호환)
      portalDomain: tenant[10] || '',   // K: PortalDomain
      showOnboarding: faqCount === 0,
      faqCount: faqCount
    };

    console.log(`✅ [Get Tenant] ${email} → ${tenantId} (FAQ: ${faqCount}개)`);

    return res.status(200).json(tenantData);

  } catch (error) {
    console.error('❌ [Get Tenant] Error:', error);

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