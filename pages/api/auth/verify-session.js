// pages/api/auth/verify-session.js
// ════════════════════════════════════════
// 세션 쿠키 검증 (yamoo_session)
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

  try {
    // 쿠키에서 세션 토큰 가져오기
    const cookieHeader = req.headers.cookie || '';
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [key, ...values] = c.trim().split('=');
        return [key, decodeURIComponent(values.join('='))]; // 디코딩 추가
      })
    );
    const sessionToken = cookies.yamoo_session;

    if (!sessionToken) {
      console.log('⚠️ [Verify Session] 세션 쿠키 없음. 쿠키 헤더:', cookieHeader);
      return res.status(401).json({ error: '세션이 없습니다.' });
    }

    console.log('🔍 [Verify Session] 세션 토큰 발견, 검증 시작...');

    // JWT 검증
    const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET);
    const { email, role } = decoded;

    if (!email) {
      return res.status(400).json({ error: '이메일 정보가 없습니다.' });
    }

    // 관리자인 경우
    if (role === 'admin') {
      return res.status(200).json({
        success: true,
        email,
        role: 'admin',
        source: 'session',
        tenants: [],
      });
    }

    // 일반 사용자: Firestore에서 테넌트 조회
    const tenantsSnapshot = await db.collection('tenants')
      .where('email', '==', email.toLowerCase())
      .get();

    if (tenantsSnapshot.empty) {
      return res.status(404).json({ error: '테넌트를 찾을 수 없습니다.' });
    }

    // 테넌트 목록 구성
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
      });
    }

    console.log(`✅ [Verify Session] ${email} → ${tenants.length}개 테넌트`);

    return res.status(200).json({
      success: true,
      email,
      source: 'session',
      tenants,
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '세션이 만료되었습니다.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: '유효하지 않은 세션입니다.' });
    }
    console.error('❌ [Verify Session] Error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}

