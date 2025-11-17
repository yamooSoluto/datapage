// pages/api/auth/verify-session.js
// 세션 검증 + Firebase Custom Token 발급

import jwt from 'jsonwebtoken';
import admin, { db } from '@/lib/firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

// ─────────────────────────────
// Firebase Auth 유저 + Custom Claims + Custom Token 생성 헬퍼
// ─────────────────────────────
async function ensureFirebaseUserAndClaims(email, role, tenants) {
  const emailLower = String(email || '').toLowerCase();
  if (!emailLower) {
    throw new Error('[Verify Session] email is required for Firebase Auth');
  }

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(emailLower);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      userRecord = await admin.auth().createUser({ email: emailLower });
      console.log(`✅ [Verify Session] Created Firebase user: ${emailLower}`);
    } else {
      console.error('❌ [Verify Session] getUserByEmail failed:', err);
      throw err;
    }
  }

  const allowedTenants = Array.isArray(tenants)
    ? tenants.map((t) => t.id).filter(Boolean)
    : [];

  const customClaims = {
    email: emailLower,
    role: role || 'user',
    isAdmin: role === 'admin',
    allowedTenants,
  };

  try {
    await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);
    console.log(`✅ [Verify Session] Set custom claims for ${emailLower}:`, {
      role: customClaims.role,
      tenants: allowedTenants.length,
    });
  } catch (err) {
    console.error('❌ [Verify Session] setCustomUserClaims failed:', err);
    throw err;
  }

  const customToken = await admin.auth().createCustomToken(userRecord.uid);

  return {
    customToken,
    claims: customClaims,
  };
}

// ─────────────────────────────
// 메인 핸들러
// ─────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.cookies['yamoo_session'];

    if (!token) {
      return res.status(401).json({ error: '세션이 없습니다.' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('[Verify Session] JWT_SECRET not set');
      return res.status(500).json({ error: '서버 설정 오류 (JWT_SECRET)' });
    }

    // 세션 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;
    const role = decoded.role || 'user';

    if (!email) {
      return res.status(400).json({ error: '이메일 정보가 없습니다.' });
    }

    // ─────────────────────────────
    // A) 관리자 세션
    // ─────────────────────────────
    if (role === 'admin') {
      console.log(`[Verify Session] Admin session: ${email}`);

      // admin용 Firebase Auth 유저/클레임/토큰 생성
      const firebase = await ensureFirebaseUserAndClaims(email, 'admin', []);

      return res.status(200).json({
        success: true,
        email,
        role: 'admin',
        source: 'session',
        tenants: [],
        firebase, // { customToken, claims }
      });
    }

    // ─────────────────────────────
    // B) 일반 사용자: Firestore에서 테넌트 조회
    // ─────────────────────────────
    const tenantsSnapshot = await db
      .collection('tenants')
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
        const faqSnapshot = await db
          .collection('tenants')
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

    // 일반 유저용 Firebase Auth 유저/클레임/토큰 생성
    const firebase = await ensureFirebaseUserAndClaims(email, 'user', tenants);

    return res.status(200).json({
      success: true,
      email,
      source: 'session',
      tenants,
      firebase, // { customToken, claims }
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