// pages/api/data/add-to-sheet.js
// ✅ 통합 마스터 시트 방식으로 변경
// 용도: Slack에서 FAQ 추가할 때 사용
// 기능: Google Sheets의 "FAQ_Master" 시트에 질문/답변 추가 (테넌트 구분)
// 호출: Slack → n8n → API

import admin from 'firebase-admin';
import { google } from 'googleapis';

// Firebase Admin 초기화
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      tenantId,
      conversationId,
      question,
      answer,
      guide,
      keyData,
      needsHandoff,
      addedBy,
      source = 'slack'
    } = req.body;

    // ✅ 1. 필수 필드 검증
    if (!tenantId || !question || !answer) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['tenantId', 'question', 'answer']
      });
    }

    console.log(`[add-to-sheet] Processing for tenant: ${tenantId}`);

    // ✅ 2. Google Sheets API 인증
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // ✅ 3. 통합 마스터 시트 ID 사용
    const masterSheetId = process.env.GOOGLE_SHEET_ID;
    
    if (!masterSheetId) {
      console.error('[add-to-sheet] GOOGLE_SHEET_ID not configured');
      return res.status(500).json({ error: 'Google Sheet not configured' });
    }

    // ✅ 4. 고유 Vector UUID 생성
    const vectorUuid = `vec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const staffHandoff = needsHandoff ? '전달필요' : '필요없음';

    // ✅ 5. FAQ_Master 시트 구조에 맞게 행 추가
    const newRow = [
      tenantId,           // A: TenantID ⭐ 핵심 차이점
      question,           // B: Question
      answer,             // C: Answer
      staffHandoff,       // D: StaffHandoff
      guide || '',        // E: Guide
      keyData || '',      // F: KeyData
      '',                 // G: ExpiryDate (빈값)
      timestamp,          // H: CreatedAt
      timestamp,          // I: UpdatedAt
      vectorUuid          // J: VectorUUID
    ];

    console.log(`[add-to-sheet] Adding row to master sheet: ${masterSheetId}`);

    // ✅ 6. Google Sheets에 행 추가
    await sheets.spreadsheets.values.append({
      spreadsheetId: masterSheetId,
      range: 'FAQ_Master!A:J', // ⭐ FAQ_Master 시트 사용
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [newRow],
      },
    });

    console.log(`[add-to-sheet] ✅ Successfully added data for tenant: ${tenantId}, conversation: ${conversationId}`);

    // ✅ 7. Firestore에 히스토리 기록 (선택사항)
    await db.collection('faq_additions').add({
      tenantId,
      conversationId,
      question,
      answer,
      guide,
      keyData,
      needsHandoff,
      addedBy,
      source,
      vectorUuid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'completed',
    });

    // ✅ 8. N8N Webhook 호출 (벡터 임베딩 업데이트)
    if (process.env.N8N_WEBHOOK_URL) {
      try {
        await fetch(process.env.N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            tenant: tenantId,
            question,
            answer,
            guide,
            keyData,
            vectorUuid,
            timestamp: new Date().toISOString()
          })
        });
        console.log(`[add-to-sheet] 📡 N8N Webhook sent - ${vectorUuid}`);
      } catch (webhookError) {
        console.error('[add-to-sheet] N8N Webhook failed:', webhookError.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Data added to master sheet successfully',
      conversationId,
      vectorUuid,
    });

  } catch (error) {
    console.error('[add-to-sheet] Error:', error);
    return res.status(500).json({
      error: 'Failed to add data to sheet',
      details: error.message,
    });
  }
}