# 🔄 Google Sheets → Firestore 마이그레이션 가이드

## 📋 변경 사항 요약

Google Sheets 기반의 매직링크 인증 시스템을 Firestore 기반으로 전환했습니다.

---

## 🎯 주요 변경점

### 1️⃣ **데이터 소스 변경**
- **Before:** Google Sheets API → `Tenants!A2:K1000` 범위 읽기
- **After:** Firestore → `tenants` 컬렉션 쿼리

### 2️⃣ **인증 초기화**
- **Before:** `google.auth.GoogleAuth` + Service Account
- **After:** `firebase-admin` 초기화 (이미 slack-redirect.js에서 사용 중)

### 3️⃣ **쿼리 방식**
- **Before:** 시트 전체 읽기 → JavaScript 필터링
- **After:** Firestore `.where('email', '==', email)` 쿼리

---

## 📁 수정된 파일 목록

### ✅ **1. request-magic-link.js**
```javascript
// Before
const sheets = google.sheets({ version: 'v4', auth });
const response = await sheets.spreadsheets.values.get({
  spreadsheetId: process.env.GOOGLE_SHEET_ID,
  range: 'Tenants!A2:H1000',
});
const rows = response.data.values || [];
const tenant = rows.find(row => row[3]?.toLowerCase() === email.toLowerCase());

// After
const tenantsSnapshot = await db.collection('tenants')
  .where('email', '==', email.toLowerCase())
  .get();
const tenantDoc = tenantsSnapshot.docs[0];
const tenant = tenantDoc.data();
```

**주요 변경:**
- Google Sheets API 제거
- Firestore 쿼리로 이메일 검색
- 데이터 매핑: `tenant.brandName`, `tenant.plan` 등 직접 접근

---

### ✅ **2. verify-token.js**
```javascript
// Slack 소스: tenantId로 직접 조회
const tenantDoc = await db.collection('tenants').doc(tenantId).get();
const tenant = tenantDoc.data();

// Magic Link: 이메일로 여러 테넌트 조회
const tenantsSnapshot = await db.collection('tenants')
  .where('email', '==', email.toLowerCase())
  .get();

// FAQ 개수도 Firestore에서 조회
const faqSnapshot = await db.collection('faq_master')
  .where('tenantId', '==', tenantId)
  .get();
const faqCount = faqSnapshot.size;
```

**주요 변경:**
- 시트 범위 읽기 → Firestore 쿼리
- FAQ 개수: 별도 컬렉션(`faq_master`) 카운트
- 테넌트 데이터 매핑: Firestore 스키마에 맞춤

---

### ✅ **3. send-magic-link.js**
```javascript
// Before
const response = await sheets.spreadsheets.values.get({
  spreadsheetId: process.env.GOOGLE_SHEET_ID,
  range: 'Tenants!A2:K1000',
});
const tenants = rows.filter(row => row[3]?.toLowerCase() === email.toLowerCase());

// After
const tenantsSnapshot = await db.collection('tenants')
  .where('email', '==', email.toLowerCase())
  .get();
const tenantsCount = tenantsSnapshot.size;
```

**주요 변경:**
- 관리자 인증 로직 유지
- 일반 사용자 이메일 조회를 Firestore로 전환
- 테넌트 개수: `tenantsSnapshot.size` 활용

---

### ✅ **4. magic-link.js**
```javascript
// 레거시 토큰 지원 (tenantId만 있는 경우)
const tenantDoc = await db.collection('tenants').doc(decoded.tenantId).get();
const tenant = tenantDoc.data();
userEmail = String(tenant.email || '').toLowerCase();
```

**주요 변경:**
- Google Sheets 레거시 fallback 제거
- Firestore에서 tenantId로 직접 조회
- 에러 핸들링 강화

---

## 🔧 환경 변수 변경

### 🗑️ **제거 가능한 환경 변수**
```bash
# Google Sheets 관련 (더 이상 사용 안 함)
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx
GOOGLE_PRIVATE_KEY=xxx
GOOGLE_SHEET_ID=xxx
```

### ✅ **유지해야 할 환경 변수**
```bash
# Firebase Admin (이미 slack-redirect.js에서 사용 중)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@xxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# JWT & Portal
JWT_SECRET=your-jwt-secret
PORTAL_DOMAIN=https://app.yamoo.ai.kr
N8N_EMAIL_WEBHOOK_URL=https://xxx.n8n.cloud/webhook/xxx

# Admin (관리자 인증)
ADMIN_EMAILS=admin@yamoo.ai.kr,@yamoo.ai.kr
ADMIN_LOGIN_SECRET=your-secret-code
```

---

## 📊 Firestore 컬렉션 구조

### **tenants** 컬렉션
```
tenants/{tenantId}
  ├─ email: "soluto9999@naver.com"
  ├─ brandName: "테스트9999"
  ├─ branchNo: "0046"
  ├─ plan: "trial"
  ├─ status: "active"
  ├─ widgetUrl: "https://chat.yamoo.ai.kr/chat/b0uq99xu"
  ├─ naverInboundUrl: "..."
  └─ subscription
      ├─ plan: "trial"
      ├─ status: "trialing"
      └─ startedAt: "2025-11-10"
```

### **faq_master** 컬렉션 (FAQ 개수 조회용)
```
faq_master/{faqId}
  ├─ tenantId: "t_01K9NVNJ3KP8AW1Q16TFZR2YRR"
  ├─ question: "..."
  └─ answer: "..."
```

---

## 🚀 배포 절차

### 1️⃣ **백업**
```bash
# 기존 파일 백업
cp pages/api/auth/request-magic-link.js pages/api/auth/request-magic-link.js.bak
cp pages/api/auth/verify-token.js pages/api/auth/verify-token.js.bak
cp pages/api/auth/send-magic-link.js pages/api/auth/send-magic-link.js.bak
cp pages/api/auth/magic-link.js pages/api/auth/magic-link.js.bak
```

### 2️⃣ **새 파일 배포**
```bash
# 새 Firestore 버전으로 교체
cp request-magic-link-firestore.js pages/api/auth/request-magic-link.js
cp verify-token-firestore.js pages/api/auth/verify-token.js
cp send-magic-link-firestore.js pages/api/auth/send-magic-link.js
cp magic-link-firestore.js pages/api/auth/magic-link.js
```

### 3️⃣ **환경 변수 검증**
```bash
# Vercel 환경 변수 확인
vercel env ls

# 필요 시 추가
vercel env add FIREBASE_PROJECT_ID
vercel env add FIREBASE_CLIENT_EMAIL
vercel env add FIREBASE_PRIVATE_KEY
```

### 4️⃣ **배포 & 테스트**
```bash
# Vercel 배포
vercel --prod

# 테스트
curl -X POST https://app.yamoo.ai.kr/api/auth/send-magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

---

## ⚠️ 주의사항

### 1. **Firebase Admin 초기화 중복 방지**
모든 파일에서 동일한 초기화 코드 사용:
```javascript
if (!admin.apps.length) {
  admin.initializeApp({ ... });
}
```

### 2. **FAQ 컬렉션 구조 확인**
- `faq_master` 컬렉션이 존재하는지 확인
- `tenantId` 필드로 쿼리 가능한지 검증

### 3. **인덱스 생성 필요**
Firestore에서 다음 쿼리가 자주 실행되므로 인덱스 생성 권장:
```
tenants: email (ASC)
faq_master: tenantId (ASC)
```

Firebase Console → Firestore → Indexes에서 확인/생성

### 4. **에러 모니터링**
초기 배포 후 로그 확인:
```bash
vercel logs --follow
```

---

## ✅ 테스트 체크리스트

- [ ] 관리자 이메일 로그인 (비밀키 없이)
- [ ] 관리자 이메일 로그인 (비밀키 입력)
- [ ] 일반 사용자 매직링크 요청
- [ ] 이메일로 받은 매직링크 클릭
- [ ] 여러 테넌트 소유 이메일 테스트
- [ ] Slack에서 포털 접속 (source='slack')
- [ ] 레거시 토큰 (tenantId만) 처리
- [ ] FAQ 개수 표시 확인
- [ ] 만료된 토큰 에러 처리
- [ ] 존재하지 않는 이메일 처리

---

## 🔍 트러블슈팅

### 문제: "Firebase Admin initialization failed"
**해결:** FIREBASE_PRIVATE_KEY 환경 변수 형식 확인
```bash
# 올바른 형식 (개행 문자 포함)
"-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
```

### 문제: "Firestore 연결에 실패했습니다"
**해결:** Firebase 프로젝트 설정 확인
- Service Account 권한 확인
- Firestore 활성화 여부 확인

### 문제: FAQ 개수가 0으로 표시됨
**해결:** `faq_master` 컬렉션 구조 확인
- `tenantId` 필드 존재 여부
- 인덱스 생성 여부

---

## 📞 지원

문제 발생 시:
1. Vercel 로그 확인: `vercel logs`
2. Firebase Console에서 Firestore 쿼리 테스트
3. 환경 변수 재확인

---

**마이그레이션 완료 후 Google Sheets 관련 코드는 안전하게 제거할 수 있습니다!** ✨