// pages/api/auth/slack-redirect.js
// ════════════════════════════════════════
// Slack에서 포탈로 즉시 접속 (관리자 전용)
// ════════════════════════════════════════

import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';

// Firebase Admin 초기화
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  
  // ✅ Private Key 처리 (여러 포맷 대응)
  let formattedKey = privateKey;
  if (privateKey) {
    // 1. 이미 실제 개행문자가 있는 경우 그대로 사용
    if (privateKey.includes('\n')) {
      formattedKey = privateKey;
    }
    // 2. \\n 이스케이프 문자열인 경우 실제 개행으로 변환
    else if (privateKey.includes('\\n')) {
      formattedKey = privateKey.replace(/\\n/g, '\n');
    }
    // 3. 따옴표로 감싸진 경우 제거
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
  const { tenant } = req.query;

  if (!tenant) {
    return res.status(400).send(errorPage('잘못된 요청입니다.'));
  }

  try {
    // ✅ 1. Firestore에서 테넌트 정보 조회
    const tenantDoc = await db.collection('tenants').doc(tenant).get();

    if (!tenantDoc.exists) {
      return res.status(404).send(errorPage('테넌트를 찾을 수 없습니다.'));
    }

    const tenantData = tenantDoc.data();

    // ✅ 2. 24시간 유효 토큰 생성 (관리자 전용)
    const token = jwt.sign(
      {
        tenantId: tenant,
        branchNo: tenantData.branchNo || '',
        brandName: tenantData.brandName || tenant,
        plan: tenantData.plan || 'trial',
        email: tenantData.tenantEmail || null,
        source: 'slack',  // ← Slack에서 온 것 표시
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // ✅ 24시간
      },
      process.env.JWT_SECRET
    );

    // ✅ 3. 포털 URL 결정
    const portalDomain = 
      tenantData.portalDomain || 
      process.env.PORTAL_DOMAIN || 
      'https://app.yamoo.ai.kr';

    const redirectUrl = `${portalDomain}/?token=${token}`;

    console.log(`🔗 [Slack → Portal] ${tenant} → ${tenantData.brandName}`);

    // ✅ 4. 즉시 리다이렉트 (로딩 최소화)
    return res.status(200).send(instantRedirect(redirectUrl, tenantData.brandName));

  } catch (error) {
    console.error('❌ [Slack Redirect] Error:', error);
    return res.status(500).send(errorPage('포털에 접속할 수 없습니다.'));
  }
}

// ✅ 즉시 리다이렉트 (0.1초 후 이동)
function instantRedirect(redirectUrl, brandName = '') {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="refresh" content="0;url=${redirectUrl}">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${brandName || '야무'} 포털</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%);
        }
        .container {
          text-align: center;
          color: white;
          padding: 40px;
        }
        .spinner {
          border: 4px solid rgba(255,255,255,0.3);
          border-top: 4px solid white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        h2 { 
          font-size: 20px; 
          font-weight: 600; 
          margin-top: 20px;
          opacity: 0.95;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="spinner"></div>
        <h2>${brandName || '포털'}로 이동 중...</h2>
      </div>
      <script>
        // 즉시 리다이렉트
        window.location.href = "${redirectUrl}";
      </script>
    </body>
    </html>
  `;
}

// ✅ 에러 페이지
function errorPage(message) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>오류</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
        }
        .container {
          text-align: center;
          padding: 40px;
          max-width: 500px;
          background: white;
          border-radius: 24px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { 
          font-size: 24px; 
          color: #92400E; 
          margin-bottom: 10px;
          font-weight: 700;
        }
        p { 
          font-size: 16px; 
          color: #78350F;
          line-height: 1.6;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">⚠️</div>
        <h1>접속 오류</h1>
        <p>${message}</p>
      </div>
    </body>
    </html>
  `;
}