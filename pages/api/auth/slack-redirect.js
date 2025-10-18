import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';

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

    // ✅ 2. 즉시 Magic Link 토큰 생성 (단기 - 1시간)
    const token = jwt.sign(
      {
        tenantId: tenant,
        branchNo: tenantData.branchNo || '',
        brandName: tenantData.brandName || tenant,
        plan: tenantData.plan || 'trial',
        // 테넌트 이메일이 있으면 추가
        email: tenantData.tenantEmail || null,
        exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1시간 유효
      },
      process.env.JWT_SECRET
    );

    // ✅ 3. 포털 URL 결정 (커스텀 도메인 우선)
    const portalDomain = 
      tenantData.portalDomain || 
      process.env.PORTAL_DOMAIN || 
      'http://localhost:3000';

    const redirectUrl = `${portalDomain}/?token=${token}`;

    console.log(`🔗 [Slack Redirect] ${tenant} → ${redirectUrl}`);

    // ✅ 4. 로딩 페이지 + 자동 리다이렉트
    return res.status(200).send(loadingPage(redirectUrl, tenantData.brandName));

  } catch (error) {
    console.error('❌ [Slack Redirect] Error:', error);
    return res.status(500).send(errorPage('포털에 접속할 수 없습니다.'));
  }
}

// ✅ 로딩 페이지 HTML
function loadingPage(redirectUrl, brandName = '') {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="refresh" content="0;url=${redirectUrl}">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>포털로 이동 중...</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
          text-align: center;
          color: white;
          padding: 40px;
        }
        .logo {
          font-size: 48px;
          margin-bottom: 20px;
        }
        .spinner {
          border: 4px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top: 4px solid white;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
          margin: 30px auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        h2 { font-size: 24px; font-weight: 600; margin-bottom: 10px; }
        p { font-size: 16px; opacity: 0.9; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🚀</div>
        <h2>${brandName ? `${brandName} ` : ''}포털로 이동 중...</h2>
        <div class="spinner"></div>
        <p>잠시만 기다려주세요</p>
      </div>
      <script>
        setTimeout(() => {
          window.location.href = "${redirectUrl}";
        }, 500);
      </script>
    </body>
    </html>
  `;
}

// ✅ 에러 페이지 HTML
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
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: #f7fafc;
        }
        .container {
          text-align: center;
          padding: 40px;
          max-width: 500px;
        }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { font-size: 24px; color: #2d3748; margin-bottom: 10px; }
        p { font-size: 16px; color: #718096; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">❌</div>
        <h1>오류가 발생했습니다</h1>
        <p>${message}</p>
      </div>
    </body>
    </html>
  `;
}