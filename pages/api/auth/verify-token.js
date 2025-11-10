// pages/api/auth/verify-token.js
// ════════════════════════════════════════
// JWT 토큰 검증 및 테넌트 목록 반환
// ✅ Firestore 버전
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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: '토큰이 필요합니다.' });
  }

  // ✅ 개발 환경 Fastlane: JWT 검증 없이 바로 통과
  const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV !== 'production';
  if (isDev && token === 'dev-admin') {
    console.log('🧭 [Dev Fastlane] 관리자 토큰 통과');
    return res.status(200).json({
      success: true,
      email: 'dev-admin@yamoo.ai',
      source: 'magic-link-admin-dev',
      tenants: [
        {
          id: 't_dev',
          name: '로컬테넌트',
          email: 'dev-admin@yamoo.ai',
          plan: 'pro',
          status: 'active',
          faqCount: 0,
          showOnboarding: true,
        },
      ],
    });
  }

  try {
    // ✅ JWT 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { email, tenantId, source } = decoded;

    // ─────────────────────────────────────────────────────
    // A) Slack에서 온 경우: tenantId로 직접 조회
    // ─────────────────────────────────────────────────────
    if (source === 'slack' && tenantId) {
      const tenantDoc = await db.collection('tenants').doc(tenantId).get();

      if (!tenantDoc.exists) {
        return res.status(404).json({
          error: '테넌트를 찾을 수 없습니다.'
        });
      }

      const data = tenantDoc.data();

      // ✅ FAQ 개수 조회 (faqItems 서브컬렉션)
      let faqCount = 0;
      try {
        const faqSnapshot = await db.collection('tenants')
          .doc(tenantId)
          .collection('faqItems')
          .get();
        faqCount = faqSnapshot.size;
      } catch (faqError) {
        console.warn('⚠️ FAQ 개수 조회 실패:', faqError.message);
      }

      const tenantData = {
        id: tenantDoc.id,
        branchNo: data.branchNo || '',
        name: data.brandName || '',
        brandName: data.brandName || '',
        email: data.email || '',
        plan: data.plan || 'trial',
        status: data.status || 'active',
        createdAt: data.subscription?.startedAt || '',
        widgetIframe: data.widgetUrl || '',
        WidgetLink: data.widgetUrl || '',
        naverOutbound: data.naverInboundUrl || '',
        NaverOutbound: data.naverInboundUrl || '',
        faqCount,
        showOnboarding: faqCount === 0,
      };

      console.log(`✅ [Verify Token] Slack → ${tenantId} (FAQ: ${faqCount}개)`);

      return res.status(200).json({
        success: true,
        source: 'slack',
        tenants: [tenantData],
      });
    }

    // ─────────────────────────────────────────────────────
    // B) Magic Link: 이메일로 여러 테넌트 조회
    // ─────────────────────────────────────────────────────
    if (!email) {
      return res.status(400).json({ error: '이메일 정보가 없습니다.' });
    }

    // ✅ Firestore에서 이메일로 테넌트 조회
    const tenantsSnapshot = await db.collection('tenants')
      .where('email', '==', email.toLowerCase())
      .get();

    if (tenantsSnapshot.empty) {
      return res.status(404).json({
        error: '등록된 테넌트를 찾을 수 없습니다.'
      });
    }

    // ✅ 테넌트 목록 구성
    const tenants = [];

    for (const doc of tenantsSnapshot.docs) {
      const data = doc.data();

      // FAQ 개수 조회
      let faqCount = 0;
      try {
        const faqSnapshot = await db.collection('tenants')
          .doc(doc.id)
          .collection('faqItems')
          .get();
        faqCount = faqSnapshot.size;
      } catch (faqError) {
        console.warn(`⚠️ FAQ 개수 조회 실패 (${doc.id}):`, faqError.message);
      }

      tenants.push({
        id: doc.id,
        branchNo: data.branchNo || '',
        name: data.brandName || '',
        email: data.email || '',
        plan: data.plan || 'trial',
        status: data.status || 'active',
        createdAt: data.subscription?.startedAt || '',
        widgetIframe: data.widgetUrl || '',
        naverOutbound: data.naverInboundUrl || '',
        faqCount,
        showOnboarding: faqCount === 0,
      });
    }

    console.log(`✅ [Verify Token] ${email} → ${tenants.length}개 테넌트${source === 'slack' ? ' (from Slack)' : ''}`);

    return res.status(200).json({
      success: true,
      email,
      source,
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