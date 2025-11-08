import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, LogOut, Database, TrendingUp, Clock, AlertCircle, Crown, Calendar, BarChart3, Users, MessageSquare, Zap, Building2, ChevronDown, X, Copy, Check, ChevronLeft, ChevronRight, Settings, ExternalLink, BookOpen } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import ModularFAQBuilderV2 from '../components/ModularFAQBuilderV2';
import ConversationsPage from '../components/ConversationsPage';
import CommaChips from '../components/CommaChips';
import OnboardingModal from "../components/onboarding/OnboardingModal";
import CriteriaSheetEditor from '@/components/mypage/CriteriaSheetEditor';
import { useMatrixData } from '@/hooks/useMatrixData';
import { useTemplates } from '@/hooks/useTemplates';
import MyPageTabs from '@/components/mypage/MyPageTabs';

console.log('🚀 페이지 로드됨!', new Date().toISOString());

const FORCE_ONBOARDING = process.env.NODE_ENV === 'development';

// ✅ 플랜 설정
const PLAN_CONFIG = {
  trial: { name: 'Trial', maxFAQs: 300, hasExpiryDate: false, color: 'green', duration: 30 },
  starter: { name: 'Starter', maxFAQs: 300, hasExpiryDate: false, color: 'blue', duration: 30 },
  pro: { name: 'Pro', maxFAQs: Infinity, hasExpiryDate: true, color: 'purple', duration: 30 },
  business: { name: 'Business', maxFAQs: Infinity, hasExpiryDate: true, color: 'indigo', duration: 30 },
  enterprise: { name: 'Enterprise', maxFAQs: Infinity, hasExpiryDate: true, color: 'pink', duration: 30 }
};

// ✅ Tailwind 동적 클래스 방지
const PLAN_BADGE_CLASS = {
  trial: 'bg-green-100 text-green-700 border border-green-300',
  starter: 'bg-blue-100 text-blue-700 border border-blue-300',
  pro: 'bg-purple-100 text-purple-700 border border-purple-300',
  business: 'bg-indigo-100 text-indigo-700 border border-indigo-300',
  enterprise: 'bg-pink-100 text-pink-700 border border-pink-300',
};

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

export default function TenantPortal() {
  console.log('🔧 TenantPortal 컴포넌트 렌더링됨!');

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentTenant, setCurrentTenant] = useState(null);

  const [availableTenants, setAvailableTenants] = useState([]);
  const [showTenantSelector, setShowTenantSelector] = useState(false);

  const [dateRange, setDateRange] = useState('7d');
  const [email, setEmail] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 프로필 & 온보딩 입력 초안
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);


  const [settingsData, setSettingsData] = useState({
    companyName: "",
    contact: "",
    email: "",
    slackUserId: "",
    plan: "free",
    chatWidgetUrl: "",
    naverTalkTalkUrl: "",
  });

  // 설정 저장 함수
  const handleSettingsSave = async (newSettings) => {
    try {
      setSettingsData(newSettings);

      const res = await fetch('/api/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant?.id,
          settings: newSettings,
        }),
      });

      if (!res.ok) throw new Error('설정 저장 실패');
      console.log('✅ 설정 저장 완료');
    } catch (error) {
      console.error('❌ 설정 저장 실패:', error);
      throw error;
    }
  };

  // 2. 라이브러리 state 추가 (기존 state들 아래에)
  const [libraryData, setLibraryData] = useState({
    links: {},
    passwords: {},
    rules: {},
    info: {},
  });

  // 3. 라이브러리 불러오기 함수 추가 (useEffect 안에)
  useEffect(() => {
    if (currentTenant?.id) {
      // 기존 데이터 로딩...

      // 라이브러리 데이터 로딩 추가
      const loadLibrary = async () => {
        try {
          const res = await fetch(`/api/library/get?tenantId=${currentTenant.id}`);
          if (res.ok) {
            const data = await res.json();
            setLibraryData(data.library || {
              links: {},
              passwords: {},
              rules: {},
              info: {},
            });
          }
        } catch (error) {
          console.error('라이브러리 로딩 실패:', error);
        }
      };

      loadLibrary();
    }
  }, [currentTenant?.id]);

  // 4. 라이브러리 저장 함수 추가
  const handleLibrarySave = async (newLibrary) => {
    try {
      setLibraryData(newLibrary);

      const res = await fetch('/api/library/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant?.id,
          library: newLibrary,
        }),
      });

      if (!res.ok) throw new Error('라이브러리 저장 실패');

      console.log('✅ 라이브러리 저장 완료');
    } catch (error) {
      console.error('❌ 라이브러리 저장 실패:', error);
      alert('라이브러리 저장에 실패했습니다.');
    }
  };

  // 5. Criteria Sheet 저장 함수 추가
  const handleMatrixSave = async (newCriteriaSheet) => {
    try {
      setTenantData((prev) => ({
        ...prev,
        criteriaSheet: newCriteriaSheet,
      }));

      const res = await fetch('/api/criteria/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant?.id,
          criteriaSheet: newCriteriaSheet,
        }),
      });

      if (!res.ok) throw new Error('Criteria sheet 저장 실패');

      console.log('✅ Criteria sheet 저장 완료');
    } catch (error) {
      console.error('❌ Criteria sheet 저장 실패:', error);
      alert('데이터 저장에 실패했습니다.');
    }
  };

  // 탭 & 온보딩
  const [activeTab, setActiveTab] = useState('conversations'); // 기본: 대화 관리
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [canDismissOnboarding, setCanDismissOnboarding] = useState(true);

  // 온보딩 입력값(2단계용)
  const [obEmail, setObEmail] = useState('');
  const [obSlackId, setObSlackId] = useState('');
  const [obFacilities, setObFacilities] = useState([]);
  const [obPasses, setObPasses] = useState([]);
  const [obMenu, setObMenu] = useState([]);

  // 시트 동적화 + 템플릿/데이터 병합 - 아이템에서 Facet 스키마 자동 추론 유틸 추가
  function deriveTemplateFromItems(items = [], sheetId = 'custom', seed = {}) {
    const labelMap = {
      existence: "존재", cost: "비용", location: "위치", hours: "이용시간",
      quantity: "수량", access: "이용", noise: "소음", capacity: "정원", rule: "규정", penalty: "패널티"
    };

    const buckets = {};
    for (const it of items) {
      const f = it?.facets || {};
      for (const k of Object.keys(f)) {
        const arr = Array.isArray(f[k]) ? f[k] : (f[k] != null ? [f[k]] : []);
        (buckets[k] ||= new Set());
        arr.forEach(v => String(v).trim() && buckets[k].add(String(v)));
      }
    }
    const facets = Object.entries(buckets).map(([k, set]) => ({
      key: k, label: labelMap[k] || k, type: "multi", options: Array.from(set)
    }));
    return { id: sheetId, title: seed?.title || sheetId, icon: seed?.icon || "📦", facets };
  }


  // CRITERIA 기반 데이터 (SimpleCriteriaInput용)
  const [tenantData, setTenantData] = useState({
    industry: 'studycafe', // 기본값
    criteriaSheet: null,
    criteriaData: {},      // 일반 정책용
    items: {               // 시설/상품용 (신규)
      facility: [],        // [{ id: 1, name: '프린터', data: { ... } }]
      product: []          // [{ id: 1, name: '시간제', data: { ... } }]
    }
  });

  const {
    items,
    isLoading: matrixLoading,
    updateItem,
    addItem,
    refresh
  } = useMatrixData(currentTenant?.id);

  const {
    data: templates,
    refresh: refreshTemplates  // ← 이거만 추가!
  } = useTemplates(currentTenant?.id);

  // 템플릿과 실데이터로 동적 시트 목록 만들기
  const criteriaData = useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    // 1) 현재 템플릿에 등록된 시트
    const templateSheets = Object.keys(templates || {});
    // 2) 실데이터에 등장한 type(=sheetId)
    const dataSheets = Array.from(new Set(arr.map(i => i?.type).filter(Boolean)));
    // 3) 합집합
    const sheets = Array.from(new Set([...(templateSheets.length ? templateSheets : []), ...dataSheets]));
    const itemsBy = Object.fromEntries(sheets.map(s => [s, arr.filter(i => i.type === s)]));
    return {
      sheets: sheets.length ? sheets : ["facility"],
      activeSheet: sheets[0] || "facility",
      items: itemsBy
    };
  }, [items, templates]);

  // 템플릿 비어도 안전하도록 초기 템플릿 생성
  function buildTemplatesFromItems(allItems = [], seedTemplates = {}) {
    const bySheet = allItems.reduce((m, it) => {
      const k = it?.type || 'facility';
      (m[k] ||= []).push(it);
      return m;
    }, {});
    const out = {};
    for (const [sheetId, list] of Object.entries(bySheet)) {
      out[sheetId] = seedTemplates[sheetId]
        || deriveTemplateFromItems(list, sheetId, seedTemplates[sheetId]);
    }
    return out;
  }


  // ========== 저장 함수 ==========
  const [savingCriteria, setSavingCriteria] = useState(false);

  const handleCriteriaSave = async (updatedData) => {
    if (savingCriteria) return;
    setSavingCriteria(true);
    const allItems = Object.values(updatedData.items || {})
      .flat()
      // 새 시트에서도 item.type에 sheetId를 심어 저장
      .map(row => (row?.type ? row : { ...row, type: updatedData.activeSheet }));

    for (const item of allItems) {
      if (item.id.startsWith('row_')) {
        await addItem(currentTenant?.id, item);
      } else {
        await updateItem(currentTenant?.id, item.id, item);
      }
    }

    // index.js (handleCriteriaSave 내부, allItems 만든 뒤)
    const slug = (s) =>
      String(s || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "") // 악센트 제거
        .replace(/[^a-zA-Z0-9가-힣]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase();

    const itemsWithKeys = allItems.map(item => {
      const facetKeys = {};
      const f = item.facets || {};
      Object.keys(f).forEach(k => {
        const arr = Array.isArray(f[k]) ? f[k] : (f[k] != null ? [f[k]] : []);
        facetKeys[k] = arr.map(v => slug(v));
      });
      return { ...item, facetKeys };
    });

    // 이후 addItem/updateItem에 itemsWithKeys를 사용
    for (const item of itemsWithKeys) {
      if (item.id?.startsWith('row_')) await addItem(currentTenant?.id, item);
      else await updateItem(currentTenant?.id, item.id, item);
    }

    // 2) 커스텀 드롭다운 옵션을 템플릿에 병합
    if (updatedData.customOptions && templates) {
      const merged = JSON.parse(JSON.stringify(templates));
      Object.entries(updatedData.customOptions).forEach(([compoundKey, opts]) => {
        const [sheetKey, facetKey] = String(compoundKey).split(/[_\.]/);
        const sheet = merged?.[sheetKey];
        if (!sheet) return;
        const facet = sheet.facets?.find(f => f.key === facetKey);
        if (!facet) return;
        const set = new Set([...(facet.options || []), ...opts]);
        facet.options = Array.from(set);
      });

      await fetch(`/api/templates?tenant=${currentTenant?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: merged })
      });
      await refreshTemplates?.();
    }

    await refresh();
    //alert('저장 완료!');
    setSavingCriteria(false);
  };

  // FAQ / 통계 데이터
  const [faqData, setFaqData] = useState([]);
  const [statsData, setStatsData] = useState(null);

  // 샘플/모듈 빌더 모달 (이름 하나로 통일)
  const [showBuilder, setShowBuilder] = useState(false);


  // ✅ 업무카드 탭용 상태
  const [tasksData, setTasksData] = useState({ tasks: [], summary: {} });

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSampleBuilder, setShowSampleBuilder] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // ✅ 설정 메뉴
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const [formData, setFormData] = useState({
    questions: [''],
    answer: '',
    staffHandoff: '필요없음',
    guide: '',
    keyData: '',
    expiryDate: ''
  });

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, '']
    }));
  };

  const removeQuestion = (index) => {
    if (formData.questions.length === 1) {
      alert('최소 1개의 질문은 필요합니다.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  const updateQuestion = (index, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === index ? value : q))
    }));
  };

  const currentPlanConfig = useMemo(() => {
    if (!currentTenant || !currentTenant.plan) {
      return PLAN_CONFIG.trial;
    }

    const planKey = currentTenant.plan.toLowerCase();
    return PLAN_CONFIG[planKey] || PLAN_CONFIG.trial;
  }, [currentTenant]);

  const faqStats = useMemo(() => {
    const list = Array.isArray(faqData) ? faqData : [];
    const expired = list.filter(i => i?.expiryDate && new Date(i.expiryDate) < new Date()).length;
    const needStaff = list.filter(i => i?.staffHandoff && i.staffHandoff !== '필요없음').length;
    return { total: list.length, expired, needStaff };
  }, [faqData]);

  // ✅ 구독 만료일 계산
  const subscriptionInfo = useMemo(() => {
    if (!currentTenant) return null;

    const startDate = currentTenant.subscriptionStartDate
      ? new Date(currentTenant.subscriptionStartDate)
      : currentTenant.createdAt
        ? new Date(currentTenant.createdAt)
        : new Date();

    const duration = currentPlanConfig.duration || 30;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + duration);

    const today = new Date();
    const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

    return {
      startDate,
      endDate,
      daysLeft,
      isExpired: daysLeft < 0,
      isExpiringSoon: daysLeft >= 0 && daysLeft <= 7
    };
  }, [currentTenant, currentPlanConfig]);

  useEffect(() => {
    // 🚀 개발환경 Fastlane: 로그인 스킵 + 테스트용 테넌트 세팅
    if (process.env.NODE_ENV === 'development') {
      console.log('🧭 Dev Fastlane: 내부 테스트 모드 진입');
      const devTenant = {
        id: 't_dev',
        brandName: '로컬 테스트',
        email: 'dev@yamoo.ai',
        plan: 'trial',
        status: 'active',
        faqCount: 0,
      };
      setCurrentTenant(devTenant);
      setIsLoggedIn(true);
      setShowOnboarding(true);
      setCanDismissOnboarding(true);
      console.log('✅ Dev Fastlane 완료: 온보딩 강제 표시');
      return; // ✅ 아래 로그인 로직 완전히 스킵
    }

    // ⬇️ 이하부터는 실제 로그인 흐름 (배포 환경)
    const savedEmail = localStorage.getItem('userEmail');
    const savedTenantId = localStorage.getItem('tenantId');
    const isMagicLogin = localStorage.getItem('magicLogin');

    // ✅ 개발환경에서는 자동 로그인 패스
    if (process.env.NODE_ENV === 'development') {
      console.log('🧭 Dev Fastlane: 로그인 생략');
      setIsLoggedIn(true);
      setCurrentTenant({ id: 't_dev', brandName: '로컬 테스트', email: 'dev@yamoo.ai' });
      return;
    }

    if (savedEmail && savedTenantId && isMagicLogin === 'true') {
      console.log('✅ [Auth] 저장된 세션 발견:', { savedEmail, savedTenantId });
      fetchTenantByEmail(savedEmail, savedTenantId);
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      console.log('✅ [Auth] URL 토큰 발견');
      verifyToken(token);
      return;
    }

    console.log('📧 [Auth] 이메일 로그인 대기 중');
  }, []);

  async function fetchTenantByEmail(email, tenantId) {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/data/get-tenant?email=${encodeURIComponent(email)}&tenantId=${encodeURIComponent(tenantId)}`);
      const data = await res.json();

      if (data?.error) {
        console.error('❌ [Auth] 테넌트 조회 실패:', data.error);
        localStorage.removeItem('userEmail');
        localStorage.removeItem('tenantId');
        localStorage.removeItem('magicLogin');
        setIsLoading(false);
        return;
      }

      setCurrentTenant(data);
      setIsLoggedIn(true);

      // ✅ 온보딩 표시 조건: FAQ가 없으면 무조건 표시
      const shouldShowOnboarding = !data.onboardingDismissed && (data.faqCount === 0 || data.showOnboarding);
      setShowOnboarding(shouldShowOnboarding);
      setCanDismissOnboarding(true); // ✅ 항상 닫기 가능

      console.log('✅ [Auth] 자동 로그인 성공(세션)');
      setIsLoading(false);
    } catch (err) {
      console.error('❌ [Auth] 조회 에러:', err);
      setIsLoading(false);
    }
  }

  async function verifyToken(token) {
    setIsLoading(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const redirectPath = urlParams.get('redirect');     // 예: /admin
      const isAdminFastlane = urlParams.get('admin') === '1';

      const res = await fetch(`/api/auth/verify-token?token=${token}`);
      const data = await res.json();

      if (data?.error) {
        console.error('❌ [Auth] 토큰 검증 실패:', data.error);
        setLoginError(data.error);
        setIsLoading(false);
        return;
      }

      // ✅ Slack에서 온 경우 온보딩 스킵
      const fromSlack = data.source === 'slack';
      const fromAdmin = isAdminFastlane || data.role === 'admin';

      if (data.tenants && data.tenants.length > 1) {
        setAvailableTenants(data.tenants);
        setShowTenantSelector(true);
      } else if (data.tenants && data.tenants.length === 1) {
        const t = data.tenants[0];
        const fromSlack = data.source === 'slack';
        const fromAdmin = isAdminFastlane || data.role === 'admin';

        selectTenant(t, (fromSlack || fromAdmin));

        // 프로필 로드 & 온보딩 판단
        const p = await loadProfile(t.id);
        const needOnboarding =
          !t.onboardingDismissed && (
            !p || !p.dictionaries || (
              (!p.dictionaries.facilities || p.dictionaries.facilities.length === 0) &&
              (!p.dictionaries.passes || p.dictionaries.passes.length === 0) &&
              (!p.dictionaries.menu || p.dictionaries.menu.length === 0)
            )
          );

        setShowOnboarding(fromSlack ? false : needOnboarding);
        setCanDismissOnboarding(true);

        if (redirectPath) {
          setTimeout(() => window.location.replace(redirectPath), 50);
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error('❌ [Auth] 토큰 검증 에러:', err);
      setLoginError('토큰 검증 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  }

  function selectTenant(tenant, fromSlack = false) {
    setCurrentTenant(tenant);
    setIsLoggedIn(true);
    setShowTenantSelector(false);

    localStorage.setItem('userEmail', tenant.email || '');
    localStorage.setItem('tenantId', tenant.id);
    localStorage.setItem('magicLogin', 'true');

    // ✅ Slack에서 온 경우 온보딩 무조건 스킵
    const shouldShowOnboarding = fromSlack
      ? false
      : !tenant.onboardingDismissed && (tenant.faqCount === 0 || tenant.showOnboarding);

    setShowOnboarding(shouldShowOnboarding);
    setCanDismissOnboarding(true);

    console.log(`✅ [Auth] 테넌트 선택 완료: ${tenant.id}${fromSlack ? ' (from Slack)' : ''}`);
  }


  async function handleEmailLogin(e) {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();
      if (data?.error) {
        setLoginError(data.error);
      } else if (data?.adminChallenge) {
        // ❗관리자: 2단계 비밀키 입력
        const secret = window.prompt('관리자 비밀키를 입력하세요');
        if (!secret) return;
        const res2 = await fetch('/api/auth/send-magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, adminSecret: secret }),
        });
        const data2 = await res2.json();
        if (data2?.direct && data2?.redirectUrl) {
          // 즉시 관리자 페이지로 이동 (token & redirect 포함)
          window.location.href = data2.redirectUrl;
          return;
        }
        setLoginError(data2?.error || '관리자 로그인 실패');
      } else if (data?.success) {
        alert('✅ 이메일로 로그인 링크가 발송되었습니다!');
        setEmail('');
      } else {
        setLoginError('알 수 없는 응답입니다.');
      }
    } catch (err) {
      setLoginError('로그인 요청 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('tenantId');
    localStorage.removeItem('magicLogin');
    setIsLoggedIn(false);
    setCurrentTenant(null);
    setFaqData([]);
    setStatsData(null);
    console.log('✅ 로그아웃 완료');
  }

  useEffect(() => {
    if (isLoggedIn && currentTenant && activeTab === 'faq') {
      fetchFAQData();
    }
  }, [isLoggedIn, currentTenant, activeTab]);

  useEffect(() => {
    if (isLoggedIn && currentTenant && activeTab === 'stats') {
      fetchStatsData();
    }
  }, [isLoggedIn, currentTenant, activeTab, dateRange]);


  async function loadProfile(tenantId) {
    setProfileLoading(true);
    try {
      const r = await fetch(`/api/profile?tenantId=${tenantId}`);
      const j = await r.json();
      const p = j?.data || null;
      setProfile(p);

      // 온보딩 프리필
      setObEmail(currentTenant?.email || p?.contactEmail || '');
      setObSlackId(p?.slackUserId || '');
      setObFacilities((p?.dictionaries?.facilities || []).map(x => x?.name).filter(Boolean));
      setObPasses((p?.dictionaries?.passes || []).map(x => x?.name).filter(Boolean));
      setObMenu((p?.dictionaries?.menu || []).map(x => x?.name).filter(Boolean));

      // CRITERIA 데이터 로드
      setTenantData({
        industry: p?.industry || 'studycafe',
        criteriaSheet: p?.criteriaSheet || null,
        criteriaData: p?.criteriaData || {},
        items: p?.items || { facility: [], product: [] }
      });

      return p; // ✅ 중요
    } finally {
      setProfileLoading(false);
    }
  }

  // ✅ 기존 index 페이지에서 saveProfileBasic 함수를 이렇게 수정

  const saveProfileBasic = async (overrides = {}) => {
    try {
      const tenantId = currentTenant?.id;
      if (!tenantId) {
        console.warn('테넌트 정보가 없습니다.');
        return;
      }

      const facilitiesPayload = overrides.facilities ?? obFacilities;
      const passesPayload = overrides.passes ?? obPasses;
      const menuPayload = overrides.menu ?? obMenu;

      // ✅ tenant 파라미터로 호출 (tenantId 아님!)
      const response = await fetch(`/api/profile?tenant=${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: overrides.brandName ?? obBrandName ?? '',
          slackUserId: overrides.slackUserId ?? obSlackId ?? '',
          // ✅ 배열을 그대로 전송 (API가 자동으로 정규화)
          facilities: facilitiesPayload,  // ['헬스장', 'VIP룸'] 형태
          passes: passesPayload,
          menu: menuPayload,
          // ✅ CRITERIA 기반 데이터 추가
          industry: overrides.industry ?? tenantData.industry,
          criteriaSheet: overrides.criteriaSheet ?? tenantData.criteriaSheet,
          criteriaData: overrides.criteriaData ?? tenantData.criteriaData,
          items: overrides.items ?? tenantData.items,  // 시설/상품 데이터 추가
          links: overrides.links ?? {},
          policies: overrides.policies ?? {}
        })
      });

      if (response.ok) {
        // ✅ SWR 캐시 갱신 (useProfile 훅 사용하는 곳에 자동 반영)
        // mutate 함수가 있다면:
        // await mutate();

        alert('저장되었습니다! FAQ 모달에서 바로 사용 가능합니다 ✨');
      } else {
        const error = await response.json();
        console.error('저장 실패:', error);
        alert('저장에 실패했습니다');
      }
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장 중 오류가 발생했습니다');
    }
  };

  // ✅ 탭 전환 시 대화 리스트/업무카드 로드
  useEffect(() => {
    if (!isLoggedIn || !currentTenant?.id) return;
    if (activeTab === 'tasks') {
      fetchTasks();
    }
    // 대화 탭은 ConversationsPage 컴포넌트가 자체적으로 로드
  }, [activeTab, currentTenant, isLoggedIn]);


  // 📍  메시지 리스너 
  useEffect(() => {
    const handleSampleMessage = (event) => {
      if (event.data.type === 'FAQ_SAMPLE_COMPLETE') {
        const sampleData = event.data.data;
        console.log('✅ 샘플 데이터 받음:', sampleData);

        setFormData({
          questions: [sampleData.question],
          answer: sampleData.fullAnswer,
          staffHandoff: '필요없음',
          guide: sampleData.details.length > 0
            ? `답변 유형: ${sampleData.answerType || '미지정'}\n포함 정보: ${sampleData.details.join(', ')}`
            : '',
          keyData: sampleData.additionalText || '',
          expiryDate: ''
        });

        setShowSampleBuilder(false);
        alert('✨ 샘플 FAQ가 입력되었습니다!');
      }
    };

    window.addEventListener('message', handleSampleMessage);
    return () => window.removeEventListener('message', handleSampleMessage);
  }, []);


  async function fetchFAQData() {
    if (!currentTenant) return;
    setIsLoading(true);
    try {
      // ✅ 통합 마스터 시트 API (faq.js)
      const res = await fetch(`/api/faq?tenant=${currentTenant.id}`);
      const data = await res.json();
      if (data?.error) {
        console.error('❌ FAQ 조회 실패:', data.error);
        return;
      }
      // ✅ faq.js는 배열을 직접 리턴
      setFaqData(Array.isArray(data) ? data : []);
      console.log('✅ FAQ 데이터 로드 완료:', data?.length || 0);
    } catch (error) {
      console.error('❌ FAQ 조회 에러:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchStatsData() {
    if (!currentTenant) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/stats/${currentTenant.id}?range=${dateRange}`);
      const data = await res.json();
      if (data?.error) {
        console.error('❌ 통계 조회 실패:', data.error);
        return;
      }
      setStatsData(data);
      console.log('✅ 통계 데이터 로드 완료');
    } catch (error) {
      console.error('❌ 통계 조회 에러:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // ✅ 대화 탭은 ConversationsPage 컴포넌트가 자체적으로 관리

  function openModal(item = null) {
    if (item) {
      setEditingItem(item);
      // ✅ faq.js는 question을 문자열로 저장 (줄바꿈으로 여러 질문 구분)
      const questions = item.question
        ? item.question.split('\n').filter(q => q.trim())
        : [''];

      setFormData({
        questions: questions.length > 0 ? questions : [''],
        answer: item.answer || '',
        staffHandoff: item.staffHandoff || '필요없음',
        guide: item.guide || '',
        keyData: item.keyData || '',
        expiryDate: item.expiryDate || ''
      });
    } else {
      setEditingItem(null);
      setFormData({
        questions: [''],
        answer: '',
        staffHandoff: '필요없음',
        guide: '',
        keyData: '',
        expiryDate: ''
      });
    }
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({
      questions: [''],
      answer: '',
      staffHandoff: '필요없음',
      guide: '',
      keyData: '',
      expiryDate: ''
    });
  }

  async function handleSubmit() {
    if (formData.questions.some(q => !q.trim())) {
      alert('모든 질문을 입력해주세요.');
      return;
    }
    if (!formData.answer.trim()) {
      alert('답변을 입력해주세요.');
      return;
    }

    // ✅ FAQ 개수 제한 체크
    if (!editingItem && faqStats.total >= currentPlanConfig.maxFAQs) {
      alert(`${currentPlanConfig.name} 플랜은 최대 ${currentPlanConfig.maxFAQs}개까지 등록 가능합니다.`);
      return;
    }

    setIsLoading(true);
    try {
      // ✅ 통합 마스터 시트 API (faq.js)
      const payload = {
        question: formData.questions.join('\n'), // 여러 질문을 줄바꿈으로 연결
        answer: formData.answer,
        staffHandoff: formData.staffHandoff || '필요없음',
        guide: formData.guide || '',
        keyData: formData.keyData || '',
        expiryDate: formData.expiryDate || '',
        plan: currentTenant.plan || 'starter'
      };

      const method = editingItem ? 'PUT' : 'POST';

      // 수정일 경우 vectorUuid 추가
      if (editingItem && editingItem.vectorUuid) {
        payload.vectorUuid = editingItem.vectorUuid;
      }

      const res = await fetch(`/api/faq?tenant=${currentTenant.id}`, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data?.error) {
        if (data.error === 'PLAN_LIMIT_REACHED') {
          alert(`❌ 플랜 제한에 도달했습니다. 최대 ${currentPlanConfig.maxFAQs}개까지 등록 가능합니다.`);
        } else if (data.error === 'EXPIRY_NOT_AVAILABLE') {
          alert('❌ 만료일 기능은 Pro 이상 플랜에서만 사용 가능합니다.');
        } else {
          alert(`❌ ${editingItem ? '수정' : '추가'} 실패: ${data.error}`);
        }
        return;
      }

      alert(`✅ FAQ ${editingItem ? '수정' : '추가'} 완료!`);
      closeModal();
      fetchFAQData();
    } catch (error) {
      alert(`❌ ${editingItem ? '수정' : '추가'} 중 오류 발생`);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(item) {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    setIsLoading(true);
    try {
      // ✅ 통합 마스터 시트 API (faq.js)
      const vectorUuid = item.vectorUuid || item.id;

      const res = await fetch(`/api/faq?tenant=${currentTenant.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vectorUuid })
      });

      const data = await res.json();
      if (data?.error) {
        alert('❌ 삭제 실패: ' + data.error);
        return;
      }
      alert('✅ 삭제 완료!');
      fetchFAQData();
    } catch (error) {
      alert('❌ 삭제 중 오류 발생');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredFAQData = useMemo(() => {
    if (!searchTerm) return faqData;
    const term = searchTerm.toLowerCase();
    return faqData.filter(item => {
      // ✅ faq.js는 question을 문자열로 저장
      const questionText = String(item.question || '');
      const answerText = String(item.answer || '');
      return questionText.toLowerCase().includes(term) || answerText.toLowerCase().includes(term);
    });
  }, [faqData, searchTerm]);

  // ✅ 온보딩 닫기 (항상 가능)
  async function dismissOnboarding() {
    try {
      await fetch('/api/data/dismiss-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: currentTenant.id })
      });
      setShowOnboarding(false);
    } catch (err) {
      console.error('온보딩 닫기 실패:', err);
      // 실패해도 모달은 닫기
      setShowOnboarding(false);
    }
  }

  // ✅ 온보딩 다시 보기
  function reopenOnboarding() {
    setOnboardingStep(1);
    setShowOnboarding(true);
    setShowSettingsMenu(false);
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob" />
          <div className="absolute top-40 right-10 w-72 h-72 bg-amber-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000" />
        </div>

        <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-yellow-200/30 p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-yellow-400 to-amber-400 rounded-3xl shadow-lg shadow-yellow-400/40 mb-4">
              <Database className="w-10 h-10 text-gray-800" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent mb-2">
              야무 포털
            </h1>
            <p className="text-gray-600 text-sm font-semibold">CS 자동화 관리 시스템</p>
          </div>

          {showTenantSelector ? (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-gray-800 mb-4">관리할 사업장을 선택하세요</h2>
              {availableTenants.map(tenant => (
                <button
                  key={tenant.id}
                  onClick={() => selectTenant(tenant)}
                  className="w-full p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-2xl hover:shadow-lg hover:scale-[1.02] transition-all text-center border border-yellow-200"
                >
                  <div className="font-bold text-gray-800 text-lg">{tenant.name || tenant.brandName || tenant.id}</div>
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none shadow-sm transition-all text-gray-800 placeholder:text-gray-400"
                  placeholder="your@email.com"
                  required
                />
              </div>
              {loginError && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-xl">{loginError}</div>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-gradient-to-r from-yellow-400 via-yellow-300 to-amber-400 text-gray-800 rounded-2xl hover:shadow-xl hover:shadow-yellow-400/40 hover:scale-105 transition-all font-bold disabled:opacity-50 shadow-lg shadow-yellow-400/30"
              >
                {isLoading ? '처리 중...' : '로그인 링크 받기'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-amber-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="relative">

        {showOnboarding && (
          <OnboardingModal
            open={showOnboarding}
            initial={{
              email: obEmail,
              slackUserId: obSlackId,
              industry: "study_cafe",   // 기본 업종
              facilities: obFacilities, // 있으면 유지, 없으면 []
              passes: obPasses,
              menu: obMenu,
            }}
            tenantId={currentTenant?.id}
            onClose={() => setShowOnboarding(false)}
            onComplete={async (payload) => {
              try {
                const facilities = (payload.dictionaries?.facilities || []).map((x) => x.name);

                // 로컬 상태 업데이트
                setObEmail(payload.contactEmail || "");
                setObSlackId(payload.slackUserId || "");
                setObFacilities(facilities);
                setObPasses((payload.dictionaries?.passes || []).map((x) => x.name));
                setObMenu((payload.dictionaries?.menu || []).map((x) => x.name));

                await saveProfileBasic({
                  slackUserId: payload.slackUserId,
                  facilities,
                  criteriaSheet: payload.criteriaSheet,
                  industry: payload.industry,
                });
                setTenantData(prev => ({
                  ...prev,
                  industry: payload.industry || prev.industry,
                  criteriaSheet: payload.criteriaSheet || prev.criteriaSheet,
                }));
                await refresh();
                await refreshTemplates?.();
                setShowOnboarding(false);
              } catch (error) {
                console.error('온보딩 완료 처리 실패', error);
                alert('온보딩 완료 처리 중 오류가 발생했습니다.');
              }
            }}
          />
        )}

        {/* ✅ 모바일 최적화 헤더 */}
        <div className="bg-white/70 backdrop-blur-xl border-b border-white/30 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-3 py-2 sm:px-6 sm:py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-yellow-400 to-amber-400 rounded-xl shadow-sm flex items-center justify-center">
                  <Database className="w-4 h-4 sm:w-5 sm:h-5 text-gray-800" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                      {currentTenant?.brandName || '야무 포털'}
                    </h1>
                    {/* ✅ 플랜 & 구독 정보 - 한 줄로 통합 */}
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${PLAN_BADGE_CLASS[currentTenant?.plan?.toLowerCase()] || PLAN_BADGE_CLASS.trial}`}>
                      {currentPlanConfig.name}
                    </span>
                    {subscriptionInfo && (
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${subscriptionInfo.isExpired ? 'bg-red-100 text-red-700' :
                        subscriptionInfo.isExpiringSoon ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                        {subscriptionInfo.isExpired
                          ? '만료'
                          : `D-${subscriptionInfo.daysLeft}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 설정 메뉴 */}
              <div className="relative">
                <button
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
                >
                  <Settings className="w-5 h-5 text-gray-600" />
                </button>

                {showSettingsMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                    <button
                      onClick={reopenOnboarding}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-sm transition-colors"
                    >
                      <BookOpen className="w-4 h-4 text-gray-600" />
                      <span className="text-gray-900">설치 가이드</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-3 text-left hover:bg-red-50 flex items-center gap-3 text-sm border-t border-gray-100 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-red-600" />
                      <span className="text-red-600">로그아웃</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>


        {/* ===================================== */}
        {/* 메인 컨텐츠 */}
        {/* ===================================== */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* ✅ 헤더 - 플랫 구조, 명확하고 직관적 */}
          <div className="sticky top-0 z-10 -mx-4 px-4 sm:-mx-6 sm:px-6 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between py-3">

              {/* 왼쪽: 메인 탭 네비게이션 */}
              <div className="flex gap-4 overflow-x-auto scrollbar-hide">

                {/* 대화 관리 */}
                <button
                  onClick={() => setActiveTab('conversations')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'conversations'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  대화 관리
                </button>

                {/* FAQ */}
                <button
                  onClick={() => setActiveTab('faq')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'faq'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                  <Database className="w-4 h-4" />
                  FAQ
                </button>

                {/* 통계 */}
                <button
                  onClick={() => setActiveTab('stats')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'stats'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  통계
                </button>

                {/* 구분선 */}
                <div className="w-px h-6 bg-gray-200 self-center" />

                {/* 설정 */}
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'settings'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                  <Settings className="w-4 h-4" />
                  설정
                </button>

                {/* 데이터 관리 (데이터 + 라이브러리) */}
                <button
                  onClick={() => setActiveTab('data')}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'data' || activeTab === 'library'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                  <Database className="w-4 h-4" />
                  데이터 관리
                </button>

              </div>

              {/* 오른쪽: 사용자 정보 */}
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                <span className="text-xs text-gray-500 hidden sm:block">
                  {currentTenant?.companyName || 'Guest'}
                </span>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                  title="로그아웃"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>

          {/* mypage - 이제 사용 안 함 */}
          {activeTab === 'mypage' && null}

          {/* 설정 탭 */}
          {activeTab === 'settings' && (
            <div className="space-y-6 py-6">
              <MyPageTabs
                tenantId={currentTenant?.id}
                initialData={tenantData.criteriaSheet || criteriaData}
                initialLibrary={libraryData}
                initialSettings={settingsData}
                onSaveMatrix={handleMatrixSave}
                onSaveLibrary={handleLibrarySave}
                onSaveSettings={handleSettingsSave}
                defaultTab="settings"
              />
            </div>
          )}

          {/* 데이터 관리 탭 (데이터 + 라이브러리 서브탭) */}
          {(activeTab === 'data' || activeTab === 'library') && (
            <div className="space-y-8 py-8">
              {/* 초미니멀 세그먼트 컨트롤 */}
              <div className="flex justify-center">
                <div className="relative inline-flex items-center gap-0.5 p-0.5 bg-black/5 rounded-full">
                  {/* 슬라이더 */}
                  <div
                    className={`absolute top-0.5 bottom-0.5 w-[calc(50%-1px)] transition-all duration-300 ease-out bg-white rounded-full shadow-lg ${activeTab === 'data'
                      ? 'left-0.5'
                      : 'left-[calc(50%+1px)]'
                      }`}
                  />

                  <button
                    onClick={() => setActiveTab('data')}
                    className={`relative z-10 w-32 px-6 py-2 text-sm font-medium rounded-full transition-colors ${activeTab === 'data' ? 'text-gray-900' : 'text-gray-500'
                      }`}
                  >
                    데이터
                  </button>

                  <button
                    onClick={() => setActiveTab('library')}
                    className={`relative z-10 w-32 px-6 py-2 text-sm font-medium rounded-full transition-colors ${activeTab === 'library' ? 'text-gray-900' : 'text-gray-500'
                      }`}
                  >
                    라이브러리
                  </button>
                </div>
              </div>

              {/* 데이터 서브탭 */}
              {activeTab === 'data' && (
                <>
                  {matrixLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="text-center">
                        <div className="w-16 h-16 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">데이터 로딩 중...</p>
                      </div>
                    </div>
                  ) : (
                    <CriteriaSheetEditor
                      tenantId={currentTenant?.id}
                      initialData={tenantData.criteriaSheet || criteriaData}
                      library={libraryData}
                      onSave={handleMatrixSave}
                    />
                  )}
                </>
              )}

              {/* 라이브러리 서브탭 */}
              {activeTab === 'library' && (
                <MyPageTabs
                  tenantId={currentTenant?.id}
                  initialData={tenantData.criteriaSheet || criteriaData}
                  initialLibrary={libraryData}
                  initialSettings={settingsData}
                  onSave={handleMatrixSave}
                  onSaveLibrary={handleLibrarySave}
                  onSaveSettings={handleSettingsSave}
                  defaultTab="library"
                />
              )}
            </div>
          )}

          {/* FAQ 탭 */}
          {activeTab === 'faq' && (
            <div className="space-y-4 pt-4">
              {/* FAQ 사용량 게이지 - 세련된 디자인 */}
              {currentPlanConfig.maxFAQs !== Infinity && (
                <div className="relative overflow-hidden bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-100 p-6">
                  {/* 배경 장식 */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-100/30 rounded-full blur-3xl -z-0"></div>

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                        <span className="text-sm font-semibold text-gray-700">
                          FAQ 사용량
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-gray-900">
                          {faqStats.total}
                        </span>
                        <span className="text-sm text-gray-500">
                          / {currentPlanConfig.maxFAQs}
                        </span>
                      </div>
                    </div>

                    {/* 프로그레스 바 */}
                    <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ease-out ${faqStats.total >= currentPlanConfig.maxFAQs
                          ? 'bg-gradient-to-r from-red-400 to-red-500'
                          : 'bg-gradient-to-r from-yellow-400 to-amber-400'
                          }`}
                        style={{
                          width: `${Math.min((faqStats.total / currentPlanConfig.maxFAQs) * 100, 100)}%`
                        }}
                      />
                    </div>

                    {/* 경고 메시지 */}
                    {faqStats.total >= currentPlanConfig.maxFAQs * 0.9 && (
                      <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                        {faqStats.total >= currentPlanConfig.maxFAQs
                          ? 'FAQ 한도에 도달했습니다'
                          : '곧 FAQ 한도에 도달합니다'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 검색 & 추가 버튼 */}
              <div className="flex gap-3">
                {/* 검색 */}
                <div className="flex-1 relative group">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-yellow-500 transition-colors" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:outline-none transition-all text-gray-800 placeholder:text-gray-400"
                    placeholder="FAQ 검색..."
                  />
                </div>

                {/* 추가 버튼 */}
                <button
                  onClick={() => openModal()}
                  className="px-6 py-3.5 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 rounded-xl hover:shadow-lg hover:shadow-yellow-400/30 hover:-translate-y-0.5 transition-all font-semibold flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">추가</span>
                </button>
              </div>

              {/* FAQ 리스트 */}
              {filteredFAQData.length > 0 ? (
                <div className="space-y-3">
                  {filteredFAQData.map(item => {
                    const questions = item.question
                      ? item.question.split('\n').filter(q => q.trim())
                      : [item.question || '질문 없음'];
                    const isExpired = !!item.expiryDate && !Number.isNaN(new Date(item.expiryDate).getTime()) &&
                      new Date(item.expiryDate) < new Date();

                    return (
                      <div
                        key={item.id}
                        className={`group relative bg-white border rounded-xl overflow-hidden transition-all hover:shadow-md ${isExpired
                          ? 'border-red-200 bg-red-50/30'
                          : 'border-gray-200 hover:border-yellow-300'
                          }`}
                      >
                        {/* 왼쪽 accent 라인 */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${isExpired ? 'bg-red-400' : 'bg-yellow-400 opacity-0 group-hover:opacity-100'
                          } transition-opacity`}></div>

                        <div className="p-4 sm:p-5">
                          {/* 헤더: 질문 & 액션 버튼 */}
                          <div className="flex items-start gap-3 mb-3">
                            {/* 질문들 */}
                            <div className="flex-1 space-y-2">
                              {questions.map((q, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  {idx > 0 && (
                                    <span className="text-yellow-500 text-xs mt-0.5 flex-shrink-0">➕</span>
                                  )}
                                  <p className="text-gray-900 font-medium leading-relaxed">
                                    {q}
                                  </p>
                                </div>
                              ))}
                            </div>

                            {/* 액션 버튼 */}
                            <div className="flex gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => openModal(item)}
                                className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-yellow-50 hover:text-yellow-600 transition-all"
                                title="수정"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(item)}
                                className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all"
                                title="삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* 답변 */}
                          <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 mb-3 pl-0">
                            {item.answer}
                          </p>

                          {/* 태그들 */}
                          <div className="flex flex-wrap gap-2">
                            {item.staffHandoff && item.staffHandoff !== '필요없음' && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                {item.staffHandoff}
                              </span>
                            )}
                            {item.expiryDate && (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${isExpired
                                ? 'bg-red-50 text-red-700'
                                : 'bg-green-50 text-green-700'
                                }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-red-500' : 'bg-green-500'
                                  }`}></span>
                                {isExpired
                                  ? '만료됨'
                                  : new Date(item.expiryDate).toLocaleDateString('ko-KR', {
                                    month: 'short',
                                    day: 'numeric'
                                  })
                                }
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // 빈 상태
                <div className="flex flex-col items-center justify-center py-20 px-4">
                  <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                    <Database className="w-10 h-10 text-gray-400" />
                  </div>
                  <p className="text-gray-900 font-semibold mb-1">
                    {searchTerm ? 'FAQ를 찾을 수 없습니다' : 'FAQ가 없습니다'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {searchTerm ? '다른 검색어를 입력해보세요' : '첫 FAQ를 추가해보세요'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ✅ 대화 관리 탭 */}
          {activeTab === 'conversations' && (
            <div className="pt-4">
              <ConversationsPage tenantId={currentTenant.id} />
            </div>
          )}


          {/* 통계 탭 (기존 유지, 모바일 최적화) */}
          {activeTab === 'stats' && (
            <div className="space-y-4 pt-4">
              {/* 날짜 필터 */}
              <div className="flex justify-end">
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="px-3 py-2 sm:px-4 sm:py-2 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-400 focus:outline-none text-sm sm:text-base"
                >
                  <option value="7d">최근 7일</option>
                  <option value="30d">최근 30일</option>
                  <option value="90d">최근 90일</option>
                </select>
              </div>

              {statsData ? (
                <>
                  {/* KPI 카드 (모바일 2열) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2">
                        <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-gray-800">{statsData.stats?.total || 0}</div>
                      <div className="text-xs sm:text-sm text-gray-600 font-semibold">총 대화</div>
                    </div>

                    <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600" />
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-gray-800">{statsData.stats?.aiAutoRate || 0}%</div>
                      <div className="text-xs sm:text-sm text-gray-600 font-semibold">AI 처리율</div>
                    </div>

                    <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-gray-800">{statsData.stats?.avgResponseTime || 0}초</div>
                      <div className="text-xs sm:text-sm text-gray-600 font-semibold">평균 응답</div>
                    </div>

                    <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Users className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-gray-800">{statsData.stats?.aiAutoMessages || 0}</div>
                      <div className="text-xs sm:text-sm text-gray-600 font-semibold">AI 메시지</div>
                    </div>
                  </div>

                  {/* 차트 (모바일은 세로 정렬) */}
                  {statsData.chartData && (
                    <>
                      {statsData.chartData.mediumData && statsData.chartData.mediumData.length > 0 && (
                        <div className="bg-white/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-lg shadow-gray-200/20 p-4 sm:p-6">
                          <h3 className="text-base sm:text-lg font-bold mb-4 text-gray-800">채널별 분포</h3>
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={statsData.chartData.mediumData}
                                dataKey="count"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={60}
                                label={(entry) => `${entry.name} (${entry.count})`}
                              >
                                {statsData.chartData.mediumData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {statsData.conversations && statsData.conversations.length > 0 && (
                        <div className="bg-white/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-lg shadow-gray-200/20 p-4 sm:p-6">
                          <h3 className="text-base sm:text-lg font-bold mb-4 text-gray-800">최근 상담 내역</h3>
                          <div className="space-y-2">
                            {statsData.conversations.slice(0, 10).map((conv) => {
                              const dt = conv.firstOpenedAt ? new Date(conv.firstOpenedAt) : null;
                              const mediumLabel = conv.mediumName === "appKakao" ? "카카오" :
                                conv.mediumName === "appNaverTalk" ? "네이버" :
                                  conv.mediumName === "widget" ? "위젯" :
                                    conv.mediumName || "기타";
                              return (
                                <div key={conv.id} className="flex justify-between items-center p-3 sm:p-4 border-b border-white/30 hover:bg-white/40 rounded-xl transition-all">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-800 text-sm sm:text-base truncate">{conv.userName || "Unknown"}</p>
                                    <p className="text-xs text-gray-600 font-semibold">{mediumLabel} · {dt ? dt.toLocaleString("ko-KR", { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "-"}</p>
                                  </div>
                                  <div className="text-right text-xs sm:text-sm space-x-1 sm:space-x-2 flex-shrink-0">
                                    <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 font-bold rounded-lg whitespace-nowrap">AI {conv.aiAutoChats || 0}</span>
                                    {(conv.agentChats || 0) > 0 && <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 font-bold rounded-lg whitespace-nowrap">상담 {conv.agentChats}</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="bg-white/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-lg shadow-gray-200/20 p-8 sm:p-16 text-center">
                  <BarChart3 className="w-16 h-16 sm:w-20 sm:h-20 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-base sm:text-lg font-semibold">통계 데이터를 불러오는 중...</p>
                </div>
              )}
            </div>
          )}

          {/* FAQ 모달 - 작고 깔끔하게 */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden">
                {/* 헤더 - 컴팩트하게 */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                  <h2 className="text-base font-bold text-gray-900">
                    {editingItem ? 'FAQ 수정' : '새 FAQ 추가'}
                  </h2>
                  <button
                    onClick={closeModal}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 내용 - 간격 줄이기 */}
                <div className="flex-1 overflow-y-auto px-5 py-5">
                  <div className="space-y-5">
                    {/* 질문 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold text-gray-900">
                          질문 <span className="text-red-500">*</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => setShowBuilder(true)}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 rounded-lg hover:shadow-md transition-all text-xs font-bold"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          샘플로 쉽게 만들기
                        </button>
                      </div>

                      <div className="space-y-2">
                        {formData.questions.map((question, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <input
                              type="text"
                              value={question}
                              onChange={(e) => updateQuestion(index, e.target.value)}
                              className="flex-1 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:outline-none transition-all text-gray-900 placeholder:text-gray-400"
                              placeholder="예: 영업시간이 어떻게 되나요?"
                            />
                            {formData.questions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeQuestion(index)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={addQuestion}
                        className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        질문 추가
                      </button>
                    </div>

                    {/* 답변 */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-900 mb-2">
                        답변 <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={formData.answer}
                        onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                        rows="3"
                        className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:outline-none resize-none transition-all text-gray-900 placeholder:text-gray-400"
                        placeholder="예: 평일 오전 9시부터 오후 6시까지 운영합니다"
                      />
                    </div>

                    {/* 담당자 전달 - 노랑 통일 */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-900 mb-2">
                        담당자 전달이 필요한가요?
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, staffHandoff: '필요없음' })}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${formData.staffHandoff === '필요없음'
                            ? 'bg-yellow-400 text-gray-900'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                          아니요
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, staffHandoff: '전달 필요' })}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${formData.staffHandoff === '전달 필요'
                            ? 'bg-yellow-400 text-gray-900'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                          네
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, staffHandoff: '조건부 전달' });
                            // 조건부 선택 시 details 자동 펼침
                            const details = document.querySelector('details');
                            if (details && !details.open) {
                              details.open = true;
                            }
                          }}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${formData.staffHandoff === '조건부 전달'
                            ? 'bg-yellow-400 text-gray-900'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                          조건부
                        </button>
                      </div>
                    </div>

                    {/* 접기/펼치기 - 밑줄 스타일 */}
                    <details className="group border-b border-gray-200">
                      <summary className="flex items-center justify-between py-2.5 cursor-pointer list-none">
                        <span className="text-xs font-medium text-gray-600">
                          답변 시 주의사항이 있다면?
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
                      </summary>

                      <div className="pt-4 pb-5 space-y-5">
                        {/* 주의사항 */}
                        <div>
                          <label className="block text-xs font-bold text-gray-900 mb-1.5">
                            주의사항
                          </label>
                          <textarea
                            value={formData.guide}
                            onChange={(e) => setFormData({ ...formData, guide: e.target.value })}
                            rows="2"
                            className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:outline-none resize-none transition-all text-gray-900 placeholder:text-gray-400"
                            placeholder="예: 월요일은 휴무입니다"
                          />
                          <p className="mt-1.5 text-xs text-gray-500">
                            답변 시 주의할 점, 예외상황, 전달 조건 등
                          </p>
                        </div>

                        {/* 기준정보 */}
                        <div>
                          <label className="block text-xs font-bold text-gray-900 mb-1.5">
                            기준정보
                          </label>
                          <textarea
                            value={formData.keyData}
                            onChange={(e) => setFormData({ ...formData, keyData: e.target.value })}
                            rows="2"
                            className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:outline-none resize-none transition-all text-gray-900 placeholder:text-gray-400"
                            placeholder="예: 전화번호 02-1234-5678"
                          />
                          <p className="mt-1.5 text-xs text-gray-500">
                            링크, 규정 등 고정값 혹은 답변 생성 시 참고 정보
                          </p>
                        </div>

                        {/* 만료일 */}
                        {currentPlanConfig?.hasExpiryDate && (
                          <div>
                            <label className="block text-xs font-bold text-gray-900 mb-1.5">
                              <span>만료일</span>
                              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 text-xs rounded-full font-medium border border-purple-200/50">
                                <Crown className="w-3 h-3" />
                                {currentPlanConfig.name} 전용
                              </span>
                            </label>
                            <div className="relative">
                              <input
                                type="date"
                                value={formData.expiryDate}
                                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                                className="w-full px-3 py-2.5 pr-10 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:outline-none transition-all text-gray-900 cursor-pointer"
                              />
                              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                            </div>
                            <p className="mt-1.5 text-xs text-gray-500">
                              기간 한정 이벤트, 휴가 일정 등에 활용
                            </p>
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                </div>

                {/* 하단 버튼 - 작게 */}
                <div className="flex gap-2 px-5 py-3 border-t border-gray-100 bg-white">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-xs bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 text-xs bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 rounded-lg hover:shadow-md hover:-translate-y-0.5 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? '처리 중...' : editingItem ? '수정' : '추가'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {showBuilder && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
              <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                  <h2 className="text-base font-bold text-gray-900">FAQ 모듈 빌더</h2>
                  <button
                    onClick={() => setShowBuilder(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="close"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4"><path fill="currentColor" d="M6.4 4.9L4.9 6.4 10.5 12l-5.6 5.6 1.5 1.5L12 13.5l5.6 5.6 1.5-1.5L13.5 12l5.6-5.6-1.5-1.5L12 10.5z" /></svg>
                  </button>
                </div>

                {/* 본문 */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <ModularFAQBuilderV2
                    onCancel={() => setShowBuilder(false)}
                    onComplete={({ question, answer, questionModules, answerModules, category, staffHandoff, guide, keyData, tags }) => {
                      // ✅ 빌더에서 만든 내용을 기존 formData 형식에 주입
                      setFormData(prev => ({
                        ...prev,
                        // 질문은 다중 입력을 지원하므로 배열 1칸에 넣어줍니다.
                        questions: [question || ''],
                        answer: answer || '',
                        // 카테고리/모듈 정보는 안전하게 문자열화하여 keyData로 보관 (백엔드 영향 없음)
                        staffHandoff: staffHandoff || prev.staffHandoff || '필요없음',
                        guide: guide || prev.guide || '',
                        keyData: (() => {
                          const bundle = (() => {
                            try {
                              return JSON.stringify({ category, qMods: questionModules, aMods: answerModules });
                            } catch { return ''; }
                          })();
                          // 1) 사용자가 입력한 keyData
                          // 2) 태그가 있으면 마지막 줄에 tags: a,b,c 형태로 추가 (컬럼 분리 전 임시)
                          const userKeyData = keyData || '';
                          const withBundle = bundle ? `${userKeyData}${userKeyData ? '\n\n' : ''}[BUNDLE]\n${bundle}` : userKeyData;
                          return withBundle.trim();
                        })(),
                      }));

                      // 빌더 닫기
                      setShowBuilder(false);
                    }}
                  />
                </div>

                {/* 푸터 - 힌트 */}
                <div className="px-5 py-3 bg-gray-50 border-t">
                  <p className="text-xs text-gray-500">
                    완료를 누르면 질문/답변이 모달 폼에 채워집니다. 모달에서 저장하면 기존 흐름(/api/faq) 그대로 동작합니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          <style jsx>{`
            @keyframes blob {
              0%, 100% { transform: translate(0, 0) scale(1); }
              33% { transform: translate(30px, -50px) scale(1.1); }
              66% { transform: translate(-20px, 20px) scale(0.9); }
            }
            .animate-blob { animation: blob 7s infinite; }
            .animation-delay-2000 { animation-delay: 2s; }
            .animation-delay-4000 { animation-delay: 4s; }
          `}</style>
        </div>
      </div>
    </div>
  );
}