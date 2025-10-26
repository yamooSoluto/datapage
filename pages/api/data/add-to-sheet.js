// pages/api/data/add-to-sheet.js

//용도: Slack에서 FAQ 추가할 때 사용
//기능: Google Sheets의 "FAQs" 시트에 질문/답변 추가
//호출: Slack → n8n → API

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

    // ✅ 2. 테넌트 정보 조회 (Google Sheets ID)
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
    
    if (!tenantDoc.exists) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenantData = tenantDoc.data();
    const sheetId = tenantData.googleSheetId || tenantData.sheetId;

    if (!sheetId) {
      console.error(`[add-to-sheet] No Google Sheet ID for tenant: ${tenantId}`);
      return res.status(400).json({ error: 'Google Sheet not configured for this tenant' });
    }

    // ✅ 3. Google Sheets API 인증
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // ✅ 4. 새 행 데이터 준비
    const timestamp = new Date().toISOString();
    const staffHandoff = needsHandoff ? '전달필요' : '필요없음';

    const newRow = [
      question,           // A: Question
      answer,             // B: Answer
      staffHandoff,       // C: Staff Handoff
      guide || '',        // D: Guide
      keyData || '',      // E: Key Data
      '',                 // F: Expiry Date (빈값)
      timestamp,          // G: Created At
      addedBy || 'slack', // H: Added By
      source,             // I: Source
      conversationId || '' // J: Conversation ID (참고용)
    ];

    console.log(`[add-to-sheet] Adding row to sheet: ${sheetId}`);

    // ✅ 5. Google Sheets에 행 추가
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'FAQs!A:J', // FAQs 시트의 A~J 열
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [newRow],
      },
    });

    console.log(`[add-to-sheet] ✅ Successfully added data for conversation: ${conversationId}`);

    // ✅ 6. Firestore에 히스토리 기록 (선택사항)
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
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'completed',
    });

    return res.status(200).json({
      success: true,
      message: 'Data added to sheet successfully',
      conversationId,
    });

  } catch (error) {
    console.error('[add-to-sheet] Error:', error);
    return res.status(500).json({
      error: 'Failed to add data to sheet',
      details: error.message,
    });
  }
}