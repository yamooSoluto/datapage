// pages/api/auth/verify-token.js
// ════════════════════════════════════════
// JWT 토큰 검증 및 테넌트 목록 반환
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
    // ✅ JWT 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { email, tenantId, source } = decoded; // ⭐ tenantId도 추출

    // ✅ Slack에서 온 경우: tenantId로 직접 조회
    if (source === 'slack' && tenantId) {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'Tenants!A2:K1000',
      });

      const rows = response.data.values || [];
      const tenant = rows.find(row => row[0] === tenantId);

      if (!tenant) {
        return res.status(404).json({ 
          error: '테넌트를 찾을 수 없습니다.' 
        });
      }

      // ✅ FAQ 개수 조회
      let faqCount = 0;
      try {
        const faqResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: 'FAQ_Master!A2:A1000',
        });
        faqCount = (faqResponse.data.values || []).filter(row => row[0] === tenantId).length;
      } catch (faqError) {
        console.warn('⚠️ FAQ 개수 조회 실패:', faqError.message);
      }

      const tenantData = {
        id: tenant[0],
        branchNo: tenant[1] || '',
        name: tenant[2] || '',
        brandName: tenant[2] || '',
        email: tenant[3] || '',
        plan: tenant[4] || 'trial',
        status: tenant[5] || 'active',
        createdAt: tenant[6] || '',
        widgetIframe: tenant[7] || '',
        WidgetLink: tenant[7] || '',
        onboardingFormLink: tenant[8] || '',
        OnboardingFormLink: tenant[8] || '',
        naverOutbound: tenant[9] || '',
        NaverOutbound: tenant[9] || '',
        portalDomain: tenant[10] || '',
        faqCount,
        showOnboarding: faqCount === 0,
      };

      console.log(`✅ [Verify Token] Slack → ${tenantId} (FAQ: ${faqCount}개)`);

      return res.status(200).json({
        success: true,
        source: 'slack',
        tenants: [tenantData], // ⭐ 단일 테넌트를 배열로
      });
    }

    // ✅ Magic Link: 이메일로 여러 테넌트 조회
    if (!email) {
      return res.status(400).json({ error: '이메일 정보가 없습니다.' });
    }

    // ✅ Google Sheets 인증
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // ✅ Tenants 시트에서 해당 이메일의 테넌트 조회
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Tenants!A2:K1000',
    });

    const rows = response.data.values || [];
    
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
      return res.status(404).json({ 
        error: '등록된 테넌트를 찾을 수 없습니다.' 
      });
    }

    // ✅ FAQ 개수 조회
    try {
      const faqResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'FAQ_Master!A2:A1000',
      });
      
      const faqRows = faqResponse.data.values || [];
      
      tenants.forEach(tenant => {
        const faqCount = faqRows.filter(row => row[0] === tenant.id).length;
        tenant.faqCount = faqCount;
        tenant.showOnboarding = faqCount === 0;
      });
    } catch (faqError) {
      console.warn('⚠️ FAQ 개수 조회 실패:', faqError.message);
    }

    console.log(`✅ [Verify Token] ${email} → ${tenants.length}개 테넌트${source === 'slack' ? ' (from Slack)' : ''}`);

    return res.status(200).json({
      success: true,
      email,
      source, // ⭐ source 전달 (slack / magic-link)
      tenants,
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '토큰이 만료되었습니다.' });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }

    console.error('❌ [Verify Token] Error:', error);
    return res.status(500).json({ 
      error: '서버 오류가 발생했습니다.' 
    });
  }
}