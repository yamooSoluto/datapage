// pages/api/auth/request-magic-link.js
// ════════════════════════════════════════
// Firestore 기반 매직링크 요청
// ════════════════════════════════════════

import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';

// Firebase Admin 초기화
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  let formattedKey = privateKey;
  if (privateKey) {
    if (privateKey.includes('\n')) {
      formattedKey = privateKey;
    } else if (privateKey.includes('\\n')) {
      formattedKey = privateKey.replace(/\\n/g, '\n');
    }
    formattedKey = formattedKey.replace(/^["']|["']$/g, '');
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedKey,
      }),
    });
    console.log('✅ Firebase Admin initialized');
  } catch (initError) {
    console.error('❌ Firebase Admin initialization failed:', initError.message);
    throw initError;
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: '올바른 이메일 주소를 입력해주세요.' });
  }

  try {
    // ✅ 1. Firestore에서 이메일로 테넌트 검색
    const tenantsSnapshot = await db.collection('tenants')
      .where('email', '==', email.toLowerCase())
      .get();

    if (tenantsSnapshot.empty) {
      console.warn(`[Magic Link] 등록되지 않은 이메일: ${email}`);
      // 보안상 존재 여부를 명확히 알려주지 않음
      return res.status(200).json({
        success: true,
        message: '이메일이 등록되어 있다면 로그인 링크가 전송됩니다.'
      });
    }

    // 첫 번째 테넌트 정보 가져오기
    const tenantDoc = tenantsSnapshot.docs[0];
    const tenant = tenantDoc.data();
    const tenantId = tenantDoc.id;

    // ✅ 2. JWT 토큰 생성 (7일 유효)
    const token = jwt.sign(
      {
        tenantId: tenantId,
        email: tenant.email,
        brandName: tenant.brandName,
        plan: tenant.plan || 'trial',
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7일
      },
      process.env.JWT_SECRET
    );

    const portalDomain = process.env.PORTAL_DOMAIN || 'http://localhost:3000';
    const magicLink = `${portalDomain}/?token=${token}`;

    console.log(`✉️ [Magic Link] 생성됨: ${email} → ${tenantId}`);

    // ✅ 3. n8n Webhook으로 이메일 전송 요청
    if (process.env.N8N_EMAIL_WEBHOOK_URL) {
      try {
        await fetch(process.env.N8N_EMAIL_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            brandName: tenant.brandName,
            magicLink: magicLink,
            tenantId: tenantId,
            plan: tenant.plan || 'trial',
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

    if (error.code === 'unavailable') {
      return res.status(503).json({
        error: 'Firestore 연결에 실패했습니다.',
      });
    }

    return res.status(500).json({
      error: '서버 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}