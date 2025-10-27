// pages/api/data/get-tenants-by-email.js
// ════════════════════════════════════════
// 이메일로 등록된 모든 테넌트 조회
// ════════════════════════════════════════

import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
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

    // ✅ Tenants 시트에서 모든 데이터 가져오기
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Tenants!A2:K1000',
    });

    const rows = response.data.values || [];
    
    // ✅ 해당 이메일로 등록된 모든 테넌트 찾기
    const tenants = rows
      .filter(row => row[3]?.toLowerCase() === email.toLowerCase())
      .map(row => ({
        id: row[0],                    // A: TenantID
        branchNo: row[1] || '',        // B: BranchNo
        name: row[2] || '',            // C: BrandName
        email: row[3] || '',           // D: Email
        plan: row[4] || 'trial',       // E: Plan
        status: row[5] || 'active',    // F: status
        createdAt: row[6] || '',       // G: CreatedAt
        widgetIframe: row[7] || '',    // H: WidgetLink
        onboardingFormLink: row[8] || '', // I: OnboardingFormLink
        naverOutbound: row[9] || '',   // J: NaverOutbound
        portalDomain: row[10] || '',   // K: PortalDomain
      }));

    if (tenants.length === 0) {
      console.warn(`[Get Tenants] 이메일에 등록된 테넌트 없음: ${email}`);
      return res.status(404).json({ 
        error: '등록된 테넌트를 찾을 수 없습니다.',
        tenants: []
      });
    }

    // ✅ FAQ 개수도 함께 조회 (옵션)
    try {
      const faqResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'FAQ_Master!A2:A1000',
      });
      
      const faqRows = faqResponse.data.values || [];
      
      // 각 테넌트별 FAQ 개수 추가
      tenants.forEach(tenant => {
        const faqCount = faqRows.filter(row => row[0] === tenant.id).length;
        tenant.faqCount = faqCount;
        tenant.showOnboarding = faqCount === 0;
      });
    } catch (faqError) {
      console.warn('⚠️ FAQ 개수 조회 실패:', faqError.message);
      // FAQ 조회 실패해도 테넌트 목록은 반환
    }

    console.log(`✅ [Get Tenants] ${email} → ${tenants.length}개 테넌트`);

    return res.status(200).json({
      success: true,
      count: tenants.length,
      tenants: tenants
    });

  } catch (error) {
    console.error('❌ [Get Tenants] Error:', error);

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