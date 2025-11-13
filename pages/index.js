// pages/index.js
// ════════════════════════════════════════════════════════════
// 완전한 버전 - 모든 기능 포함 (FAQ, 통계, 대화, 데이터, 설정)
// ════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, LogOut, Database, TrendingUp, Clock, AlertCircle, Crown, Calendar, BarChart3, Users, MessageSquare, Zap, Building2, ChevronDown, X, Copy, Check, ChevronLeft, ChevronRight, Settings, ExternalLink, BookOpen } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import ConversationsPage from '../components/ConversationsPage';
import CommaChips from '../components/CommaChips';
import OnboardingModal from "../components/onboarding/OnboardingModal";
import CriteriaSheetEditor from '@/components/mypage/CriteriaSheetEditor';
import { useMatrixData } from '@/hooks/useMatrixData';
import { useTemplates } from '@/hooks/useTemplates';
import MyPageTabs from '@/components/mypage/MyPageTabs';
import MinimalHeader from '../components/layout/MinimalHeader';
import FirstSetupGuide from '../components/onboarding/FirstSetupGuide';
import LoginPWA from '../components/LoginPWA';

// ════════════════════════════════════════════════════════════
// 상수 및 설정
// ════════════════════════════════════════════════════════════

const PLAN_CONFIG = {
  trial: { name: 'Trial', maxFAQs: 300, hasExpiryDate: false, color: 'green', duration: 30 },
  starter: { name: 'Starter', maxFAQs: 300, hasExpiryDate: false, color: 'blue', duration: 30 },
  pro: { name: 'Pro', maxFAQs: Infinity, hasExpiryDate: true, color: 'purple', duration: 30 },
  business: { name: 'Business', maxFAQs: Infinity, hasExpiryDate: true, color: 'indigo', duration: 30 },
  enterprise: { name: 'Enterprise', maxFAQs: Infinity, hasExpiryDate: true, color: 'pink', duration: 30 }
};

const PLAN_BADGE_CLASS = {
  trial: 'bg-green-100 text-green-700 border border-green-300',
  starter: 'bg-blue-100 text-blue-700 border border-blue-300',
  pro: 'bg-purple-100 text-purple-700 border border-purple-300',
  business: 'bg-indigo-100 text-indigo-700 border border-indigo-300',
  enterprise: 'bg-pink-100 text-pink-700 border border-pink-300',
};

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

// ════════════════════════════════════════════════════════════
// 메인 컴포넌트
// ════════════════════════════════════════════════════════════

export default function TenantPortal() {
  // ──────────────────────────────────────────────────────────
  // 1. 인증 관련 State
  // ──────────────────────────────────────────────────────────
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availableTenants, setAvailableTenants] = useState([]);
  const [showTenantSelector, setShowTenantSelector] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // ──────────────────────────────────────────────────────────
  // 2. 탭 & UI State
  // ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('conversations'); // 기본: 대화 관리
  const [dateRange, setDateRange] = useState('7d');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // ──────────────────────────────────────────────────────────
  // 3. 온보딩 관련 State
  // ──────────────────────────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showFirstSetupGuide, setShowFirstSetupGuide] = useState(false);
  const [canDismissOnboarding, setCanDismissOnboarding] = useState(true);

  // 온보딩 입력값
  const [obBrandName, setObBrandName] = useState('');
  const [obEmail, setObEmail] = useState('');
  const [obSlackId, setObSlackId] = useState('');
  const [obFacilities, setObFacilities] = useState([]);
  const [obPasses, setObPasses] = useState([]);
  const [obMenu, setObMenu] = useState([]);

  // ──────────────────────────────────────────────────────────
  // 4. FAQ 관련 State
  // ──────────────────────────────────────────────────────────
  const [faqData, setFaqData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    questions: [''],
    answer: '',
    staffHandoff: '필요없음',
    guide: '',
    keyData: '',
    expiryDate: ''
  });

  // ──────────────────────────────────────────────────────────
  // 5. 통계 관련 State
  // ──────────────────────────────────────────────────────────
  const [statsData, setStatsData] = useState(null);

  // ──────────────────────────────────────────────────────────
  // 6. 데이터 관련 State
  // ──────────────────────────────────────────────────────────

  // 설정 데이터
  const [settingsData, setSettingsData] = useState({
    tenantId: "",
    brandName: "",
    email: null,
    industry: "other",
    address: "",
    plan: "trial",
    status: "active",
    widgetUrl: "",
    naverInboundUrl: "",
    naverAuthorization: "",
    slack: {
      allowedUserIds: [],
      defaultChannelId: null,
      teamId: null,
    },
    subscription: {
      plan: "trial",
      status: "trialing",
      startedAt: new Date().toISOString().split('T')[0],
      renewsAt: null,
    },
  });

  // 라이브러리 데이터
  const [libraryData, setLibraryData] = useState({
    links: {},
    passwords: {},
    rules: {},
    info: {},
  });

  // 테넌트 데이터
  const [tenantData, setTenantData] = useState({
    industry: 'studycafe',
    criteriaSheet: null,
    criteriaData: {},
    items: {
      facility: [],
      product: []
    }
  });

  const [savingCriteria, setSavingCriteria] = useState(false);

  // ──────────────────────────────────────────────────────────
  // 7. Hooks
  // ──────────────────────────────────────────────────────────
  const {
    items,
    isLoading: matrixLoading,
    updateItem,
    addItem,
    refresh
  } = useMatrixData(currentTenant?.id);

  const {
    data: templates,
    refresh: refreshTemplates
  } = useTemplates(currentTenant?.id);

  // ──────────────────────────────────────────────────────────
  // 8. FAQ & 통계 데이터 로딩
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoggedIn && currentTenant && activeTab === 'faq') {
      fetch(`/api/faqs?tenantId=${currentTenant.id}`)
        .then(res => res.json())
        .then(data => setFaqData(data.faqs || []))
        .catch(err => console.error('FAQ 로드 실패:', err));
    }
  }, [isLoggedIn, currentTenant, activeTab]);

  useEffect(() => {
    if (isLoggedIn && currentTenant && activeTab === 'stats') {
      fetch(`/api/stats?tenantId=${currentTenant.id}&range=${dateRange}`)
        .then(res => res.json())
        .then(data => setStatsData(data))
        .catch(err => console.error('통계 로드 실패:', err));
    }
  }, [isLoggedIn, currentTenant, activeTab, dateRange]);

  // ──────────────────────────────────────────────────────────
  // 9. 테넌트 정보 & 라이브러리 로딩
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (currentTenant?.id) {
      // 라이브러리 로딩
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

      // 설정 데이터 로딩
      const loadSettings = async () => {
        try {
          const res = await fetch(`/api/tenants/${currentTenant.id}`);
          if (res.ok) {
            const tenant = await res.json();
            console.log('✅ 테넌트 데이터 로드:', tenant);

            setSettingsData({
              tenantId: tenant.tenantId,
              brandName: tenant.brandName || "",
              email: tenant.email || null,
              industry: tenant.industry || "other",
              address: tenant.address || "",
              plan: tenant.plan || "trial",
              status: tenant.status || "active",
              widgetUrl: tenant.widgetUrl || `https://chat.yamoo.ai.kr/chat/${currentTenant.id}`,
              naverInboundUrl: tenant.naverInboundUrl || `https://chat.yamoo.ai.kr/${currentTenant.id}/naver/inbound`,
              naverAuthorization: tenant.naverAuthorization || "",
              slack: {
                allowedUserIds: tenant.slack?.allowedUserIds || [],
                defaultChannelId: tenant.slack?.defaultChannelId || null,
                teamId: tenant.slack?.teamId || null,
              },
              subscription: {
                plan: tenant.subscription?.plan || tenant.plan || "trial",
                status: tenant.subscription?.status || tenant.status || "trialing",
                startedAt: tenant.subscription?.startedAt || new Date().toISOString().split('T')[0],
                renewsAt: tenant.subscription?.renewsAt || null,
              },
            });
          }
        } catch (error) {
          console.error('❌ 설정 로딩 실패:', error);
        }
      };

      loadLibrary();
      loadSettings();
    }
  }, [currentTenant?.id]);

  // ──────────────────────────────────────────────────────────
  // 10. FAQ 관련 함수들
  // ──────────────────────────────────────────────────────────

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, '']
    }));
  };

  const removeQuestion = (index) => {
    if (formData.questions.length === 1) return;
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  const updateQuestion = (index, value) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === index ? value : q)
    }));
  };

  const openModal = (item = null) => {
    if (item) {
      const questions = item.question ? item.question.split('\n').filter(q => q.trim()) : [''];
      setFormData({
        questions: questions.length > 0 ? questions : [''],
        answer: item.answer || '',
        staffHandoff: item.staffHandoff || '필요없음',
        guide: item.guide || '',
        keyData: item.keyData || '',
        expiryDate: item.expiryDate || ''
      });
      setEditingItem(item);
    } else {
      setFormData({
        questions: [''],
        answer: '',
        staffHandoff: '필요없음',
        guide: '',
        keyData: '',
        expiryDate: ''
      });
      setEditingItem(null);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSave = async () => {
    const payload = {
      tenantId: currentTenant.id,
      question: formData.questions.filter(q => q.trim()).join('\n'),
      answer: formData.answer,
      staffHandoff: formData.staffHandoff,
      guide: formData.guide,
      keyData: formData.keyData,
      expiryDate: formData.expiryDate
    };

    try {
      const url = editingItem ? `/api/faqs/${editingItem.id}` : '/api/faqs';
      const method = editingItem ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const res = await fetch(`/api/faqs?tenantId=${currentTenant.id}`);
      const data = await res.json();
      setFaqData(data.faqs || []);
      closeModal();
    } catch (err) {
      console.error('FAQ 저장 실패:', err);
      alert('저장에 실패했습니다.');
    }
  };

  const handleDelete = async (item) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      await fetch(`/api/faqs/${item.id}`, { method: 'DELETE' });
      const res = await fetch(`/api/faqs?tenantId=${currentTenant.id}`);
      const data = await res.json();
      setFaqData(data.faqs || []);
    } catch (err) {
      console.error('FAQ 삭제 실패:', err);
      alert('삭제에 실패했습니다.');
    }
  };

  // FAQ 검색 필터
  const filteredFAQData = faqData.filter(item => {
    if (!searchTerm) return true;
    const lower = searchTerm.toLowerCase();
    return (
      item.question?.toLowerCase().includes(lower) ||
      item.answer?.toLowerCase().includes(lower)
    );
  });

  // ──────────────────────────────────────────────────────────
  // 11. 저장 함수들
  // ──────────────────────────────────────────────────────────

  // 설정 저장
  const handleSettingsSave = async (newSettings) => {
    try {
      const res = await fetch(`/api/tenants/${newSettings.tenantId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: newSettings.brandName,
          email: newSettings.email,
          address: newSettings.address,
          slack: newSettings.slack,
          naverAuthorization: newSettings.naverAuthorization,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || '설정 저장 실패');
      }

      console.log('✅ 설정 저장 완료');
      setSettingsData(newSettings);
      setCurrentTenant(prev => ({
        ...prev,
        brandName: newSettings.brandName,
        email: newSettings.email,
      }));
    } catch (error) {
      console.error('❌ 설정 저장 실패:', error);
      throw error;
    }
  };

  // 라이브러리 저장
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

  // Criteria Sheet 저장
  const handleMatrixSave = async (newCriteriaSheet) => {
    try {
      setTenantData(prev => ({
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

  // Criteria 저장 (복잡한 버전)
  const handleCriteriaSave = async (updatedData) => {
    if (savingCriteria) return;
    setSavingCriteria(true);

    const allItems = Object.values(updatedData.items || {})
      .flat()
      .map(row => (row?.type ? row : { ...row, type: updatedData.activeSheet }));

    // Slug 함수
    const slug = (s) =>
      String(s || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
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

    for (const item of itemsWithKeys) {
      if (item.id?.startsWith('row_')) {
        await addItem(currentTenant?.id, item);
      } else {
        await updateItem(currentTenant?.id, item.id, item);
      }
    }

    // 커스텀 드롭다운 옵션 병합
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
    setSavingCriteria(false);
  };

  // ──────────────────────────────────────────────────────────
  // 12. 온보딩 완료 핸들러
  // ──────────────────────────────────────────────────────────
  const handleOnboardingComplete = async (payload) => {
    try {
      const facilities = (payload.dictionaries?.facilities || []).map((x) => x.name);

      // 로컬 상태 업데이트
      setObEmail(payload.contactEmail || "");
      setObBrandName(payload.brandName || obBrandName || currentTenant?.brandName || "");
      setObSlackId(payload.slackUserId || "");
      setObFacilities(facilities);
      setObPasses((payload.dictionaries?.passes || []).map((x) => x.name));
      setObMenu((payload.dictionaries?.menu || []).map((x) => x.name));

      // 온보딩 API 호출
      await fetch('/api/onboarding/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant?.id,
          slackUserId: payload.slackUserId,
          facilities,
          criteriaSheet: payload.criteriaSheet,
          industry: payload.industry,
          brandName: payload.brandName,
          contactEmail: payload.contactEmail,
          address: payload.address,
        }),
      });

      setTenantData(prev => ({
        ...prev,
        industry: payload.industry || prev.industry,
        criteriaSheet: payload.criteriaSheet || prev.criteriaSheet,
      }));

      await refresh();
      await refreshTemplates?.();

      // 테넌트 정보 재로드
      try {
        const res = await fetch(`/api/tenants/${currentTenant.id}`);
        if (res.ok) {
          const updatedTenant = await res.json();
          setCurrentTenant(prev => ({
            ...prev,
            onboardingCompleted: updatedTenant.onboardingCompleted,
          }));
          console.log('✅ 온보딩 완료: onboardingCompleted =', updatedTenant.onboardingCompleted);
        }
      } catch (error) {
        console.error('테넌트 재로드 실패:', error);
      }

      setShowOnboarding(false);

      // 첫 설정 가이드 표시
      setShowFirstSetupGuide(true);

    } catch (error) {
      console.error('온보딩 완료 처리 실패', error);
      alert('온보딩 완료 처리 중 오류가 발생했습니다.');
    }
  };

  // ──────────────────────────────────────────────────────────
  // 13. 로그아웃
  // ──────────────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('tenantId');
    localStorage.removeItem('magicLogin');
    setIsLoggedIn(false);
    setCurrentTenant(null);
    window.location.href = '/';
  };

  // ──────────────────────────────────────────────────────────
  // 14. 초기 인증 체크 (마운트 시 1회)
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    setIsLoading(true);
    try {
      // 개발 환경 Fast Lane
      if (process.env.NODE_ENV === 'development') {
        console.log('🧭 Dev Fastlane: 내부 테스트 모드 진입');
        const devTenant = {
          id: 't_dev',
          brandName: '로컬 테스트',
          email: 'dev@yamoo.ai',
          plan: 'trial',
          status: 'active',
          faqCount: 0,
          onboardingCompleted: false,
        };
        setCurrentTenant(devTenant);
        setIsLoggedIn(true);
        setShowOnboarding(true);
        setCanDismissOnboarding(true);
        setAuthChecked(true);
        setIsLoading(false);
        console.log('✅ Dev Fastlane 완료: 온보딩 표시');
        return;
      }

      // 1) URL에 토큰이 있는지 확인 (슬랙 또는 매직링크)
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      if (urlToken) {
        console.log('🔗 토큰 발견, 검증 시작...');

        // 먼저 verify-token으로 토큰 소스 확인
        const verifyRes = await fetch(`/api/auth/verify-token?token=${encodeURIComponent(urlToken)}`);

        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          console.log('📦 verify-token 응답:', verifyData);

          // ✅ Slack에서 온 경우: 세션 쿠키 설정 후 해당 테넌트로 로그인
          if (verifyData.source === 'slack' && verifyData.tenants && verifyData.tenants.length > 0) {
            const tenant = verifyData.tenants[0];

            // 슬랙 로그인도 세션 쿠키 설정 (페이지 새로고침 시 로그인 유지)
            const magicRes = await fetch(`/api/auth/magic-link?token=${encodeURIComponent(urlToken)}`, {
              credentials: 'include'
            });

            if (magicRes.ok) {
              console.log('✅ 슬랙 세션 쿠키 설정 완료');
            }

            setCurrentTenant({
              id: tenant.id,
              brandName: tenant.brandName || tenant.name,
              email: tenant.email,
              plan: tenant.plan,
              status: tenant.status,
              faqCount: tenant.faqCount || 0,
              showOnboarding: tenant.showOnboarding || false,
            });
            setIsLoggedIn(true);
            setShowOnboarding(tenant.showOnboarding || false);
            setAuthChecked(true);
            setIsLoading(false);
            window.history.replaceState({}, document.title, '/');
            console.log('✅ 슬랙 로그인 성공:', tenant.brandName || tenant.name);
            return;
          }

          // ✅ 매직링크인 경우: 세션 쿠키 설정 후 세션 확인
          if (verifyData.source !== 'slack') {
            console.log('🔗 매직링크 토큰 확인, 세션 쿠키 설정 중...');
            const magicRes = await fetch(`/api/auth/magic-link?token=${encodeURIComponent(urlToken)}`, {
              credentials: 'include'
            });

            if (magicRes.ok) {
              console.log('✅ 매직링크 세션 쿠키 설정 완료');

              // 세션 쿠키가 설정되었으므로 잠시 대기 후 세션 확인 API 호출
              await new Promise(resolve => setTimeout(resolve, 200));

              const cookieRes = await fetch('/api/auth/verify-session', {
                credentials: 'include'
              });

              if (cookieRes.ok) {
                const data = await cookieRes.json();

                if (data.tenants && data.tenants.length > 0) {
                  if (data.tenants.length === 1) {
                    const tenant = data.tenants[0];
                    setCurrentTenant({
                      id: tenant.id,
                      brandName: tenant.brandName || tenant.name,
                      email: tenant.email,
                      plan: tenant.plan,
                      status: tenant.status,
                      faqCount: tenant.faqCount || 0,
                      showOnboarding: tenant.showOnboarding || false,
                    });
                    setIsLoggedIn(true);
                    setShowOnboarding(tenant.showOnboarding || false);
                    setAuthChecked(true);
                    console.log('✅ 매직링크 로그인 성공:', tenant.brandName || tenant.name);
                  } else {
                    // 여러 테넌트가 있을 때: 첫 번째 테넌트를 자동 선택
                    const tenant = data.tenants[0];
                    setCurrentTenant({
                      id: tenant.id,
                      brandName: tenant.brandName || tenant.name,
                      email: tenant.email,
                      plan: tenant.plan,
                      status: tenant.status,
                      faqCount: tenant.faqCount || 0,
                      showOnboarding: tenant.showOnboarding || false,
                    });
                    setAvailableTenants(data.tenants);
                    setIsLoggedIn(true);
                    setShowOnboarding(tenant.showOnboarding || false);
                    setAuthChecked(true);
                    console.log(`✅ 매직링크 로그인 성공 (${data.tenants.length}개 테넌트 중 첫 번째 선택):`, tenant.brandName || tenant.name);
                  }

                  setIsLoading(false);
                  window.history.replaceState({}, document.title, '/');
                  return;
                }
              }
            }
          }
        }
      }

      // 2) 세션 쿠키 확인 (OTP 또는 이미 설정된 세션)
      const cookieRes = await fetch('/api/auth/verify-session', {
        credentials: 'include'
      });
      if (cookieRes.ok) {
        const data = await cookieRes.json();

        if (data.tenants && data.tenants.length > 0) {
          if (data.tenants.length === 1) {
            const tenant = data.tenants[0];
            setCurrentTenant({
              id: tenant.id,
              brandName: tenant.brandName || tenant.name,
              email: tenant.email,
              plan: tenant.plan,
              status: tenant.status,
              faqCount: tenant.faqCount || 0,
              showOnboarding: tenant.showOnboarding || false,
            });
            setIsLoggedIn(true);
            setShowOnboarding(tenant.showOnboarding || false);
            console.log('✅ 세션 로그인 성공:', tenant.brandName || tenant.name);
          } else {
            // 여러 테넌트가 있을 때: 첫 번째 테넌트를 자동 선택
            const tenant = data.tenants[0];
            setCurrentTenant({
              id: tenant.id,
              brandName: tenant.brandName || tenant.name,
              email: tenant.email,
              plan: tenant.plan,
              status: tenant.status,
              faqCount: tenant.faqCount || 0,
              showOnboarding: tenant.showOnboarding || false,
            });
            setAvailableTenants(data.tenants);
            setIsLoggedIn(true);
            setShowOnboarding(tenant.showOnboarding || false);
            console.log(`✅ 세션 로그인 성공 (${data.tenants.length}개 테넌트 중 첫 번째 선택):`, tenant.brandName || tenant.name);
          }
          setAuthChecked(true);
          setIsLoading(false);
          return;
        }
      }

      // 3) 로그인 필요
      console.log('⚠️ 인증 필요 - 로그인 화면 표시');
      setAuthChecked(true);
      setIsLoading(false);
    } catch (error) {
      console.error('❌ 인증 체크 실패:', error);
      setAuthChecked(true);
      setIsLoading(false);
    }
  }

  // 토큰 검증 함수
  async function verifyToken(token) {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/auth/verify-token?token=${token}`);  // ✅ 올바른 엔드포인트
      if (!res.ok) throw new Error('토큰 검증 실패');

      const data = await res.json();
      console.log('🔍 verify-token 응답:', data);

      // ✅ Slack 로그인: tenants 배열에서 첫 번째 테넌트 사용
      if (data.tenants && data.tenants.length > 0) {
        const tenant = data.tenants[0];
        localStorage.setItem('userEmail', tenant.email);
        localStorage.setItem('tenantId', tenant.id);

        setCurrentTenant({
          id: tenant.id,
          brandName: tenant.brandName || tenant.name,
          email: tenant.email,
          plan: tenant.plan,
          status: tenant.status,
          faqCount: tenant.faqCount || 0,
          showOnboarding: tenant.showOnboarding || false,
        });
        setIsLoggedIn(true);
        setShowOnboarding(tenant.showOnboarding || false);
        setCanDismissOnboarding(true);

        console.log('✅ Slack 로그인 성공:', tenant.brandName);
        setIsLoading(false);
        window.history.replaceState({}, document.title, '/');
        return;
      }

      // ✅ 레거시 로직 (email, tenantId 직접 반환되는 경우)
      const { email, tenantId } = data;

      if (tenantId) {
        localStorage.setItem('userEmail', email);
        localStorage.setItem('tenantId', tenantId);

        const tRes = await fetch(`/api/tenants/${tenantId}`);
        if (!tRes.ok) throw new Error('테넌트 조회 실패');

        const tenant = await tRes.json();
        setCurrentTenant(tenant);
        setIsLoggedIn(true);

        const shouldShowOnboarding = !tenant.onboardingCompleted;
        setShowOnboarding(shouldShowOnboarding);
        setCanDismissOnboarding(true);

        console.log('✅ 매직링크 인증 성공');
        setIsLoading(false);

        window.history.replaceState({}, document.title, '/');
      } else {
        throw new Error('tenantId가 없습니다');
      }
    } catch (err) {
      console.error('❌ 토큰 검증 실패:', err);
      setIsLoading(false);
    }
  }

  // 세션 쿠키 확인 및 테넌트 조회
  async function verifySessionAndLogin() {
    setIsLoading(true);
    try {
      console.log('🔍 세션 확인 시작...');
      // 세션 쿠키 확인 (OTP 검증 후 쿠키가 설정되어 있음)
      const res = await fetch('/api/auth/verify-session', {
        credentials: 'include'
      });

      console.log('📡 세션 확인 응답 상태:', res.status, res.statusText);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('❌ 세션 확인 실패:', errorData);
        throw new Error(errorData.error || '세션 확인 실패');
      }

      const data = await res.json();
      console.log('📦 세션 확인 응답 데이터:', data);

      if (data.tenants && data.tenants.length > 0) {
        if (data.tenants.length === 1) {
          const tenant = data.tenants[0];
          setCurrentTenant({
            id: tenant.id,
            brandName: tenant.brandName || tenant.name,
            email: tenant.email,
            plan: tenant.plan,
            status: tenant.status,
            faqCount: tenant.faqCount || 0,
            showOnboarding: tenant.showOnboarding || false,
          });
          setIsLoggedIn(true);
          setShowOnboarding(tenant.showOnboarding || false);
          setCanDismissOnboarding(true);
          setAuthChecked(true);
          console.log('✅ 세션 로그인 성공:', tenant.brandName || tenant.name);
        } else {
          // 여러 테넌트가 있을 때: 첫 번째 테넌트를 자동 선택
          const tenant = data.tenants[0];
          setCurrentTenant({
            id: tenant.id,
            brandName: tenant.brandName || tenant.name,
            email: tenant.email,
            plan: tenant.plan,
            status: tenant.status,
            faqCount: tenant.faqCount || 0,
            showOnboarding: tenant.showOnboarding || false,
          });
          setAvailableTenants(data.tenants);
          setIsLoggedIn(true);
          setShowOnboarding(tenant.showOnboarding || false);
          setCanDismissOnboarding(true);
          setAuthChecked(true);
          console.log(`✅ 세션 로그인 성공 (${data.tenants.length}개 테넌트 중 첫 번째 선택):`, tenant.brandName || tenant.name);
        }
      } else {
        console.warn('⚠️ 테넌트를 찾을 수 없습니다.');
        throw new Error('테넌트를 찾을 수 없습니다.');
      }

      setIsLoading(false);
    } catch (err) {
      console.error('❌ 세션 확인 에러:', err);
      setIsLoading(false);
      // 세션이 없으면 다시 로그인 화면으로
      setIsLoggedIn(false);
      setAuthChecked(true);
    }
  }

  // ──────────────────────────────────────────────────────────
  // 15. Computed Values
  // ──────────────────────────────────────────────────────────
  const currentPlanConfig = PLAN_CONFIG[currentTenant?.plan?.toLowerCase()] || PLAN_CONFIG.trial;

  const criteriaData = useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    const templateSheets = Object.keys(templates || {});
    const dataSheets = Array.from(new Set(arr.map(i => i?.type).filter(Boolean)));
    const sheets = Array.from(new Set([...(templateSheets.length ? templateSheets : []), ...dataSheets]));
    const itemsBy = Object.fromEntries(sheets.map(s => [s, arr.filter(i => i.type === s)]));
    return {
      sheets: sheets.length ? sheets : ["facility"],
      activeSheet: sheets[0] || "facility",
      items: itemsBy
    };
  }, [items, templates]);

  // ──────────────────────────────────────────────────────────
  // 16. 렌더링
  // ──────────────────────────────────────────────────────────

  // 로딩 중
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <img
            src="/logo.png"
            alt="야무"
            className="w-16 h-16 object-contain mx-auto mb-4 animate-pulse"
          />
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 로그인 필요 - LoginPWA 컴포넌트 표시
  if (!isLoggedIn && authChecked) {
    // ✅ OTP 성공 시 세션 쿠키를 확인하여 로그인 상태 세팅
    return <LoginPWA onLoginSuccess={verifySessionAndLogin} />;
  }


  // 메인 UI
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 온보딩 모달 */}
      {showOnboarding && (
        <OnboardingModal
          open={showOnboarding}
          tenantId={currentTenant?.id}
          initial={{
            brandName: obBrandName || currentTenant?.brandName,
            email: obEmail || currentTenant?.email,
            industry: "study_cafe",
            facilities: obFacilities,
            passes: obPasses,
            menu: obMenu,
          }}
          onClose={() => setShowOnboarding(false)}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* 첫 설정 가이드 */}
      <FirstSetupGuide
        open={showFirstSetupGuide}
        onClose={() => setShowFirstSetupGuide(false)}
        onStartDataSetup={() => {
          setShowFirstSetupGuide(false);
          setActiveTab('data');
        }}
        onSkip={() => {
          setShowFirstSetupGuide(false);
          setActiveTab('conversations');
        }}
      />

      {/* 미니멀 헤더 */}
      <MinimalHeader
        currentTab={activeTab}
        onTabChange={setActiveTab}
        brandName={currentTenant?.brandName}
        plan={currentTenant?.plan}
        availableTenants={availableTenants}
        onTenantChange={(tenant) => {
          console.log('🔄 테넌트 변경 시작:', tenant);
          setCurrentTenant({
            id: tenant.id,
            brandName: tenant.brandName || tenant.name,
            email: tenant.email,
            plan: tenant.plan,
            status: tenant.status,
            faqCount: tenant.faqCount || 0,
            showOnboarding: tenant.showOnboarding || false,
          });
          console.log('✅ 테넌트 변경 완료:', tenant.brandName || tenant.name);
          // 페이지 새로고침으로 데이터 재로드 (PWA에서 상태 업데이트가 제대로 반영되도록)
          window.location.reload();
        }}
        onLogout={() => {
          setIsLoggedIn(false);
          setCurrentTenant(null);
          setAuthChecked(false);
          // 세션 쿠키 삭제
          fetch('/api/auth/logout', { method: 'POST' }).then(() => {
            window.location.href = '/';
          });
        }}
      />

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-6">
        {/* 대화 관리 (메인) */}
        {activeTab === 'conversations' && (
          <ConversationsPage tenantId={currentTenant?.id} />
        )}

        {/* FAQ 관리 */}
        {activeTab === 'faq' && (
          <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">FAQ 관리</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {faqData.length} / {currentPlanConfig.maxFAQs === Infinity ? '무제한' : currentPlanConfig.maxFAQs}
                </p>
              </div>
            </div>

            {/* 검색 & 추가 */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:outline-none"
                  placeholder="FAQ 검색..."
                />
              </div>
              <button
                onClick={() => openModal()}
                className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 rounded-xl hover:shadow-lg font-semibold flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">추가</span>
              </button>
            </div>

            {/* FAQ 리스트 */}
            {filteredFAQData.length > 0 ? (
              <div className="space-y-3">
                {filteredFAQData.map(item => {
                  const questions = item.question ? item.question.split('\n').filter(q => q.trim()) : ['질문 없음'];
                  const isExpired = !!item.expiryDate && new Date(item.expiryDate) < new Date();

                  return (
                    <div
                      key={item.id}
                      className={`bg-white border rounded-xl p-5 hover:shadow-md transition-all ${isExpired ? 'border-red-200 bg-red-50/30' : 'border-gray-200 hover:border-yellow-300'
                        }`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-1 space-y-2">
                          {questions.map((q, idx) => (
                            <p key={idx} className="text-gray-900 font-medium">{q}</p>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openModal(item)}
                            className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-yellow-50 hover:text-yellow-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">{item.answer}</p>

                      {/* 태그들 */}
                      <div className="flex flex-wrap gap-2">
                        {item.staffHandoff && item.staffHandoff !== '필요없음' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            {item.staffHandoff}
                          </span>
                        )}
                        {item.expiryDate && (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${isExpired ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-red-500' : 'bg-green-500'}`}></span>
                            {isExpired ? '만료됨' : new Date(item.expiryDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20">
                <Database className="w-16 h-16 text-gray-300 mb-4" />
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

        {/* 통계 */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">통계</h2>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-400 focus:outline-none"
              >
                <option value="7d">최근 7일</option>
                <option value="30d">최근 30일</option>
                <option value="90d">최근 90일</option>
              </select>
            </div>

            {statsData ? (
              <>
                {/* KPI 카드 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl shadow-lg p-4">
                    <MessageSquare className="w-8 h-8 text-purple-600 mb-2" />
                    <div className="text-2xl font-bold text-gray-800">{statsData.stats?.total || 0}</div>
                    <div className="text-sm text-gray-600">총 대화</div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-lg p-4">
                    <Zap className="w-8 h-8 text-yellow-600 mb-2" />
                    <div className="text-2xl font-bold text-gray-800">{statsData.stats?.aiAutoRate || 0}%</div>
                    <div className="text-sm text-gray-600">AI 처리율</div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-lg p-4">
                    <Clock className="w-8 h-8 text-blue-600 mb-2" />
                    <div className="text-2xl font-bold text-gray-800">{statsData.stats?.avgResponseTime || 0}초</div>
                    <div className="text-sm text-gray-600">평균 응답</div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-lg p-4">
                    <Users className="w-8 h-8 text-green-600 mb-2" />
                    <div className="text-2xl font-bold text-gray-800">{statsData.stats?.aiAutoMessages || 0}</div>
                    <div className="text-sm text-gray-600">AI 메시지</div>
                  </div>
                </div>

                {/* 차트 영역 - 필요시 추가 */}
              </>
            ) : (
              <div className="flex items-center justify-center py-20">
                <p className="text-gray-600">통계 데이터를 불러오는 중...</p>
              </div>
            )}
          </div>
        )}

        {/* 데이터 관리 */}
        {activeTab === 'data' && (
          <MyPageTabs
            tenantId={currentTenant?.id}
            initialData={tenantData.criteriaSheet || criteriaData}
            initialLibrary={libraryData}
            initialSettings={settingsData}
            templates={templates}
            onSave={handleMatrixSave}
            onSaveLibrary={handleLibrarySave}
            onSaveSettings={handleSettingsSave}
            defaultTab="data"
          />
        )}

        {/* 설정 */}
        {activeTab === 'settings' && (
          <MyPageTabs
            tenantId={currentTenant?.id}
            initialData={tenantData.criteriaSheet || criteriaData}
            initialLibrary={libraryData}
            initialSettings={settingsData}
            templates={templates}
            onSave={handleMatrixSave}
            onSaveLibrary={handleLibrarySave}
            onSaveSettings={handleSettingsSave}
            defaultTab="settings"
          />
        )}
      </main>

      {/* FAQ 추가/수정 모달 - 완전한 버전 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {editingItem ? 'FAQ 수정' : 'FAQ 추가'}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 본문 - 스크롤 */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* 질문 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    질문 <span className="text-red-500">*</span>
                  </label>
                  {formData.questions.map((q, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={q}
                        onChange={(e) => updateQuestion(idx, e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:outline-none text-sm"
                        placeholder={idx === 0 ? "주 질문을 입력하세요" : "유사 질문을 입력하세요"}
                      />
                      {formData.questions.length > 1 && (
                        <button
                          onClick={() => removeQuestion(idx)}
                          className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addQuestion}
                    className="mt-2 text-sm text-yellow-600 hover:text-yellow-700 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    유사 질문 추가
                  </button>
                </div>

                {/* 답변 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    답변 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.answer}
                    onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:outline-none text-sm resize-none"
                    rows={5}
                    placeholder="답변을 입력하세요"
                  />
                </div>

                {/* 담당자 전달 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    담당자 전달이 필요한가요?
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, staffHandoff: '필요없음' }))}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${formData.staffHandoff === '필요없음'
                        ? 'bg-yellow-400 text-gray-900'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      아니요
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, staffHandoff: '전달 필요' }))}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${formData.staffHandoff === '전달 필요'
                        ? 'bg-yellow-400 text-gray-900'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      네
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, staffHandoff: '조건부 전달' }))}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${formData.staffHandoff === '조건부 전달'
                        ? 'bg-yellow-400 text-gray-900'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      조건부
                    </button>
                  </div>
                </div>

                {/* 접기/펼치기 - 상세 옵션 */}
                <details className="group border-t border-gray-200 pt-4">
                  <summary className="flex items-center justify-between py-2 cursor-pointer list-none">
                    <span className="text-sm font-medium text-gray-700">
                      답변 시 주의사항이 있다면?
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
                  </summary>

                  <div className="pt-4 space-y-5">
                    {/* 주의사항 */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        주의사항
                      </label>
                      <textarea
                        value={formData.guide}
                        onChange={(e) => setFormData(prev => ({ ...prev, guide: e.target.value }))}
                        rows={2}
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:outline-none text-sm resize-none"
                        placeholder="예: 월요일은 휴무입니다"
                      />
                      <p className="mt-1.5 text-xs text-gray-500">
                        답변 시 주의할 점, 예외상황, 전달 조건 등
                      </p>
                    </div>

                    {/* 기준정보 */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        기준정보
                      </label>
                      <textarea
                        value={formData.keyData}
                        onChange={(e) => setFormData(prev => ({ ...prev, keyData: e.target.value }))}
                        rows={2}
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:outline-none text-sm resize-none"
                        placeholder="예: 전화번호 02-1234-5678"
                      />
                      <p className="mt-1.5 text-xs text-gray-500">
                        링크, 규정 등 고정값 혹은 답변 생성 시 참고 정보
                      </p>
                    </div>

                    {/* 만료일 */}
                    {currentPlanConfig?.hasExpiryDate && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
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
                            onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                            className="w-full px-4 py-2.5 pr-10 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400 focus:outline-none text-sm cursor-pointer"
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

            {/* 하단 버튼 */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-white">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-sm font-medium"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 rounded-lg hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm font-semibold"
              >
                {editingItem ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}