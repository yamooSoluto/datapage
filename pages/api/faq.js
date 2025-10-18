import { google } from 'googleapis';

// 플랜별 제한 설정
const PLAN_LIMITS = {
  starter: 100,
  pro: Infinity,
  business: Infinity,
  enterprise: Infinity
};

// 플랜별 만료일 기능 사용 가능 여부
const PLAN_EXPIRY = {
  starter: false,
  pro: true,
  business: true,
  enterprise: true
};

// Google Sheets API 초기화
const getSheetsClient = async () => {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
};

export default async function handler(req, res) {
  const { tenant } = req.query;

  // 테넌트 ID 필수
  if (!tenant) {
    return res.status(400).json({ error: 'Tenant ID가 필요합니다.' });
  }

  try {
    const sheets = await getSheetsClient();

    // ==================== GET: FAQ 조회 ====================
    if (req.method === 'GET') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'FAQ_Master!A2:J1000', // 헤더 제외
      });

      const rows = response.data.values || [];
      
      // 해당 테넌트의 FAQ만 필터링
      const filtered = rows
        .filter(row => row[0] === tenant) // A열: TenantID
        .map((row, index) => ({
          id: `faq_${tenant}_${index}`,
          question: row[1] || '',      // B열: Question
          answer: row[2] || '',        // C열: Answer
          staffHandoff: row[3] || '필요없음', // D열: StaffHandoff
          guide: row[4] || '',         // E열: Guide
          keyData: row[5] || '',       // F열: KeyData
          expiryDate: row[6] || null,  // G열: ExpiryDate
          createdAt: row[7] || '',     // H열: CreatedAt
          updatedAt: row[8] || '',     // I열: UpdatedAt
          vectorUuid: row[9] || ''     // J열: VectorUUID
        }));

      return res.status(200).json(filtered);
    }

    // ==================== POST: FAQ 추가 ====================
    if (req.method === 'POST') {
      const { question, answer, staffHandoff, guide, keyData, expiryDate, plan } = req.body;

      // 필수 필드 검증
      if (!question || !answer) {
        return res.status(400).json({ error: '질문과 답변은 필수입니다.' });
      }

      // 현재 FAQ 개수 확인 (플랜 제한 체크용)
      const countResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'FAQ_Master!A2:A1000',
      });
      
      const currentCount = (countResponse.data.values || [])
        .filter(row => row[0] === tenant)
        .length;

      // 플랜 제한 체크
      if (currentCount >= (PLAN_LIMITS[plan] || 10)) {
        return res.status(403).json({ error: 'PLAN_LIMIT_REACHED' });
      }

      // 만료일 기능 체크
      if (expiryDate && !PLAN_EXPIRY[plan]) {
        return res.status(403).json({ error: 'EXPIRY_NOT_AVAILABLE' });
      }

      // 고유 Vector UUID 생성
      const vectorUuid = `vec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Google Sheets에 추가
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'FAQ_Master!A:J',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[
            tenant,
            question,
            answer,
            staffHandoff || '필요없음',
            guide || '',
            keyData || '',
            expiryDate || '',
            now, // createdAt
            now, // updatedAt
            vectorUuid
          ]]
        }
      });

      console.log(`✅ FAQ 추가됨 - Tenant: ${tenant}, Vector UUID: ${vectorUuid}`);

      // N8N Webhook 호출 (설정되어 있는 경우)
      if (process.env.N8N_WEBHOOK_URL) {
        try {
          await fetch(process.env.N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              tenant,
              question,
              answer,
              guide,
              keyData,
              vectorUuid,
              timestamp: new Date().toISOString()
            })
          });
          console.log(`📡 N8N Webhook 전송 성공 - ${vectorUuid}`);
        } catch (webhookError) {
          console.error('N8N Webhook 실패:', webhookError.message);
          // Webhook 실패해도 FAQ 추가는 성공으로 처리
        }
      }

      return res.status(200).json({ success: true, vectorUuid });
    }

    // ==================== PUT: FAQ 수정 ====================
    if (req.method === 'PUT') {
      const { vectorUuid, question, answer, staffHandoff, guide, keyData, expiryDate } = req.body;

      if (!vectorUuid) {
        return res.status(400).json({ error: 'Vector UUID가 필요합니다.' });
      }

      // 전체 데이터 조회
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'FAQ_Master!A2:J1000',
      });

      const rows = response.data.values || [];
      
      // 해당 FAQ 찾기 (테넌트 ID + Vector UUID로 검색)
      const rowIndex = rows.findIndex(row => 
        row[0] === tenant && row[9] === vectorUuid
      );

      if (rowIndex === -1) {
        return res.status(404).json({ error: 'FAQ를 찾을 수 없습니다.' });
      }

      const actualRow = rowIndex + 2; // 헤더(1) + 0-based index
      const now = new Date().toISOString().split('T')[0];

      // B열부터 I열까지 업데이트 (A열 TenantID, J열 VectorUUID는 유지)
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: `FAQ_Master!B${actualRow}:I${actualRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[
            question,
            answer,
            staffHandoff || '필요없음',
            guide || '',
            keyData || '',
            expiryDate || '',
            rows[rowIndex][7], // createdAt 유지
            now // updatedAt 업데이트
          ]]
        }
      });

      console.log(`✏️ FAQ 수정됨 - Tenant: ${tenant}, Vector UUID: ${vectorUuid}`);

      // N8N Webhook 호출
      if (process.env.N8N_WEBHOOK_URL) {
        try {
          await fetch(process.env.N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update',
              tenant,
              vectorUuid,
              question,
              answer,
              guide,
              keyData,
              timestamp: new Date().toISOString()
            })
          });
          console.log(`📡 N8N Webhook 전송 성공 (수정) - ${vectorUuid}`);
        } catch (webhookError) {
          console.error('N8N Webhook 실패:', webhookError.message);
        }
      }

      return res.status(200).json({ success: true });
    }

    // ==================== DELETE: FAQ 삭제 ====================
    if (req.method === 'DELETE') {
      const { vectorUuid } = req.body;

      if (!vectorUuid) {
        return res.status(400).json({ error: 'Vector UUID가 필요합니다.' });
      }

      // 전체 데이터 조회
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'FAQ_Master!A2:J1000',
      });

      const rows = response.data.values || [];
      
      // 해당 FAQ 찾기
      const rowIndex = rows.findIndex(row => 
        row[0] === tenant && row[9] === vectorUuid
      );

      if (rowIndex === -1) {
        return res.status(404).json({ error: 'FAQ를 찾을 수 없습니다.' });
      }

      const actualRow = rowIndex + 2;

      // FAQ_Master 시트의 SheetID 가져오기 (보통 첫 번째 시트는 0)
      const sheetMetadata = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
      });

      const faqSheet = sheetMetadata.data.sheets.find(
        sheet => sheet.properties.title === 'FAQ_Master'
      );

      const sheetId = faqSheet ? faqSheet.properties.sheetId : 0;

      // 행 삭제
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        resource: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: actualRow - 1, // 0-based
                endIndex: actualRow
              }
            }
          }]
        }
      });

      console.log(`🗑️ FAQ 삭제됨 - Tenant: ${tenant}, Vector UUID: ${vectorUuid}`);

      // N8N Webhook 호출
      if (process.env.N8N_WEBHOOK_URL) {
        try {
          await fetch(process.env.N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'delete',
              tenant,
              vectorUuid,
              timestamp: new Date().toISOString()
            })
          });
          console.log(`📡 N8N Webhook 전송 성공 (삭제) - ${vectorUuid}`);
        } catch (webhookError) {
          console.error('N8N Webhook 실패:', webhookError.message);
        }
      }

      return res.status(200).json({ success: true });
    }

    // 지원하지 않는 메서드
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('FAQ API error:', error);
    
    return res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}