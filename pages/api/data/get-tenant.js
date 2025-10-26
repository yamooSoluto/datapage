// pages/api/data/get-tenant.js
//용도: 매직링크 자동 로그인 시 테넌트 정보 조회
//기능: Google Sheets의 "Tenants" 시트에서 테넌트 정보 읽기
//호출: 포탈 메인 페이지(/) → API

import { google } from 'googleapis';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, tenantId } = req.query;

  if (!email || !tenantId) {
    return res.status(400).json({ error: 'Email and tenantId required' });
  }

  try {
    // ✅ Google Sheets 인증
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // ✅ Tenants 시트에서 조회
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Tenants!A2:K1000',
    });

    const rows = response.data.values || [];
    
    // ✅ 이메일과 테넌트ID가 모두 일치하는 행 찾기
    const tenant = rows.find(row => 
      row[0] === tenantId && 
      row[3]?.toLowerCase() === email.toLowerCase()
    );

    if (!tenant) {
      console.warn(`❌ [Get Tenant] 테넌트 없음: ${email} / ${tenantId}`);
      return res.status(404).json({ 
        error: '테넌트를 찾을 수 없습니다.',
        expired: false
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
        .filter(row => row[0] === tenant[0])
        .length;
    } catch (faqError) {
      console.warn('⚠️ FAQ 개수 조회 실패:', faqError.message);
    }

    // ✅ 테넌트 정보 반환
    const tenantData = {
      id: tenant[0],
      branchNo: tenant[1] || '',
      name: tenant[2] || '',
      email: tenant[3] || '',
      plan: tenant[4] || 'trial',
      status: tenant[5] || 'active',
      createdAt: tenant[6] || '',
      widgetIframe: tenant[7] || '',
      onboardingFormLink: tenant[8] || '',
      naverOutbound: tenant[9] || '',
      portalDomain: tenant[10] || '',
      showOnboarding: faqCount === 0,
      faqCount: faqCount
    };

    console.log(`✅ [Get Tenant] 조회 성공: ${tenantData.id} (FAQ: ${faqCount}개)`);

    return res.status(200).json(tenantData);

  } catch (error) {
    console.error('❌ [Get Tenant] 오류:', error);

    return res.status(500).json({
      error: '서버 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}