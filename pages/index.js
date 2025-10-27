//pages/index.js

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, LogOut, Database, TrendingUp, Clock, AlertCircle, Crown, Calendar, BarChart3, Users, MessageSquare, Zap, Building2, ChevronDown, X, Copy, Check } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';


// ✅ 플랜 설정 (기존과 동일 - Starter 300개)
const PLAN_CONFIG = {
  trial: { name: 'Trial', maxFAQs: 300, hasExpiryDate: false, color: 'green' },
  starter: { name: 'Starter', maxFAQs: 300, hasExpiryDate: false, color: 'blue' },
  pro: { name: 'Pro', maxFAQs: Infinity, hasExpiryDate: true, color: 'purple' },
  business: { name: 'Business', maxFAQs: Infinity, hasExpiryDate: true, color: 'indigo' },
  enterprise: { name: 'Enterprise', maxFAQs: Infinity, hasExpiryDate: true, color: 'pink' }
};

// ✅ Tailwind 동적 클래스 방지 - 고정 매핑
const PLAN_BADGE_CLASS = {
  trial: 'bg-green-100 text-green-700',
  starter: 'bg-blue-100 text-blue-700',
  pro: 'bg-purple-100 text-purple-700',
  business: 'bg-indigo-100 text-indigo-700',
  enterprise: 'bg-pink-100 text-pink-700',
};

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

export default function TenantPortal() {
  console.log('🔧 TenantPortal 컴포넌트 렌더링됨!');
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentTenant, setCurrentTenant] = useState(null);
  
  // ✅ 멀티 테넌트 선택 관련
  const [availableTenants, setAvailableTenants] = useState([]);
  const [showTenantSelector, setShowTenantSelector] = useState(false);
  
  const [dateRange, setDateRange] = useState('7d');
  const [email, setEmail] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // ✅ 온보딩 관련 state (기존 3단계 오버레이 유지)
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [copiedWidget, setCopiedWidget] = useState(false);
  const [copiedNaver, setCopiedNaver] = useState(false);
  
  const [activeTab, setActiveTab] = useState('faq');
  const [faqData, setFaqData] = useState([]);
  const [statsData, setStatsData] = useState(null);
  // ✅ 대화/업무 탭용 상태
const [conversationsData, setConversationsData] = useState([]);
const [conversationFilters, setConversationFilters] = useState({
  status: 'all',
  channel: 'all',
});
const [selectedConversation, setSelectedConversation] = useState(null);

// ✅ 업무카드 탭용 상태
const [tasksData, setTasksData] = useState({ tasks: [], summary: {} });

// (선택) 실시간 모니터링
// const [liveConversations, setLiveConversations] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // ✅ 질문 배열을 지원하는 formData 구조
  const [formData, setFormData] = useState({
    questions: [''], // ✅ 배열
    answer: '',
    staffHandoff: '필요없음',
    guide: '',
    keyData: '',
    expiryDate: ''
  });

  // ✅ 질문 추가/삭제/수정 함수
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

  // ✅ FAQ 통계 (기존 게이지/카드 복구)
  const faqStats = useMemo(() => {
    const expired = faqData.filter(i => i.expiryDate && new Date(i.expiryDate) < new Date()).length;
    const needStaff = faqData.filter(i => i.staffHandoff && i.staffHandoff !== '필요없음').length;
    return { total: faqData.length, expired, needStaff };
  }, [faqData]);

  // ✅ 저장된 세션/토큰 우선순위 로그인
  useEffect(() => {
    // 1) localStorage 최우선
    const savedEmail = localStorage.getItem('userEmail');
    const savedTenantId = localStorage.getItem('tenantId');
    const isMagicLogin = localStorage.getItem('magicLogin');

    if (savedEmail && savedTenantId && isMagicLogin === 'true') {
      console.log('✅ [Auth] 저장된 세션 발견:', { savedEmail, savedTenantId });
      fetchTenantByEmail(savedEmail, savedTenantId);
      return;
    }

    // 2) URL 토큰 확인
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      console.log('✅ [Auth] URL 토큰 발견');
      verifyToken(token);
      return;
    }

    // 3) 아무 것도 없으면 대기
    console.log('📧 [Auth] 이메일 로그인 대기 중');
  }, []);

  // ✅ 저장된 세션으로 로그인 (단일 테넌트)
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

      // 로그인 성공
      setCurrentTenant(data);
      setIsLoggedIn(true);

      // 온보딩 노출 규칙 유지
      if (data.showOnboarding || data.faqCount === 0) {
        setShowOnboarding(true);
      }

      console.log('✅ [Auth] 자동 로그인 성공(세션)');
    } catch (e) {
      console.error('❌ [Auth] 오류:', e);
    } finally {
      setIsLoading(false);
    }
  }

  // ✅ URL 토큰 방식 (멀티 테넌트 지원)
  async function verifyToken(token) {
    setIsLoading(true);
    try {
      // 1단계: 토큰으로 이메일 확인
      const res = await fetch(`/api/auth/magic-link?token=${encodeURIComponent(token)}`);
      const data = await res.json();

      if (data?.error) {
        console.error('❌ [Auth] 토큰 검증 실패:', data.error);
        setLoginError(data?.error || '로그인에 실패했습니다.');
        if (data?.expired) {
          setLoginError('로그인 링크가 만료되었습니다. 새로운 링크를 요청해주세요.');
        }
        setIsLoading(false);
        return;
      }

      const userEmail = data.email;

      // 2단계: 해당 이메일로 등록된 모든 테넌트 조회
      const tenantsRes = await fetch(`/api/data/get-tenants-by-email?email=${encodeURIComponent(userEmail)}`);
      const tenantsData = await tenantsRes.json();

      if (tenantsData?.error || !tenantsData?.tenants || tenantsData.tenants.length === 0) {
        console.error('❌ [Auth] 테넌트를 찾을 수 없음');
        setLoginError('등록된 테넌트를 찾을 수 없습니다.');
        setIsLoading(false);
        return;
      }

      const tenants = tenantsData.tenants;

      // ✅ URL 항상 정리 (단일/멀티 모두)
      window.history.replaceState({}, document.title, '/');

      // 3단계: 테넌트가 1개면 바로 로그인, 2개 이상이면 선택 화면
      if (tenants.length === 1) {
        // 단일 테넌트 → 바로 로그인
        loginWithTenant(tenants[0], userEmail);
      } else {
        // 멀티 테넌트 → 선택 화면 표시
        setAvailableTenants(tenants);
        setEmail(userEmail);
        setShowTenantSelector(true);
        console.log(`🏢 [Auth] ${tenants.length}개 테넌트 발견 - 선택 대기`);
      }

    } catch (e) {
      console.error('❌ [Auth] 오류:', e);
      setLoginError('로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  // ✅ 테넌트 선택 후 로그인
  function loginWithTenant(tenant, userEmail) {
    setCurrentTenant(tenant);
    setIsLoggedIn(true);

    // 🔐 세션 저장
    if (userEmail) localStorage.setItem('userEmail', userEmail);
    localStorage.setItem('tenantId', tenant.id);
    localStorage.setItem('magicLogin', 'true');

    // 온보딩 체크
    if (tenant.showOnboarding || tenant.faqCount === 0) {
      setShowOnboarding(true);
    }

    // 선택 화면 숨기기
    setShowTenantSelector(false);
    
    console.log('✅ [Auth] 로그인 성공:', tenant.name || tenant.id);
  }

  // 이메일 로그인 제출
  async function handleEmailLogin(e) {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (data.success) {
        alert('✅ 로그인 링크가 이메일로 전송되었습니다!');
        setEmail('');
      } else {
        setLoginError(data.error || '로그인 링크 전송에 실패했습니다.');
      }
    } catch (error) {
      console.error('❌ [Email Login] Error:', error);
      setLoginError('서버 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn && currentTenant?.id) {
      fetchFAQs();
    }
  }, [isLoggedIn, currentTenant]);

  useEffect(() => {
    if (activeTab === 'stats' && currentTenant?.id) {
      fetchStats();
    }
  }, [activeTab, dateRange, currentTenant]);

  // ✅ 탭 전환 시 대화 리스트/업무카드 로드
useEffect(() => {
  if (!isLoggedIn || !currentTenant?.id) return;
  if (activeTab === 'conversations') {
    fetchConversations();
  } else if (activeTab === 'tasks') {
    fetchTasks();
  }
  // filters 바뀌면 대화 리스트 갱신
}, [activeTab, conversationFilters, currentTenant, isLoggedIn]);

// (선택) 실시간 모니터링 — Firestore SDK를 사용 중일 때만 활성화
// useEffect(() => {
//   if (!currentTenant?.id || activeTab !== 'conversations') return;
//   const unsubscribe = window?.db
//     ?.collection("FAQ_realtime_cw")
//     .where("tenant_id", "==", currentTenant.id)
//     .where("status", "in", ["waiting", "in_progress"])
//     .orderBy("lastMessageAt", "desc")
//     .limit(10)
//     .onSnapshot((snapshot) => {
//       const active = [];
//       snapshot.forEach((doc) => active.push({ id: doc.id, ...doc.data() }));
//       setLiveConversations(active);
//     });
//   return () => unsubscribe && unsubscribe();
// }, [currentTenant, activeTab]);


  // ✅ FAQ 로드 - 양쪽 응답 형태 모두 지원
  async function fetchFAQs() {
    if (!currentTenant?.id) return;
    try {
      // 우선 기존 엔드포인트로 시도
      let res = await fetch(`/api/faq?tenant=${currentTenant.id}`);
      let data = await res.json();

      // 리팩토링 신형 응답도 허용
      if (!Array.isArray(data)) {
        // 신형 엔드포인트/형태로 재시도
        if (!data?.faqs) {
          const res2 = await fetch(`/api/faq?tenantId=${currentTenant.id}`);
          const data2 = await res2.json();
          data = data2?.faqs || [];
        } else {
          data = data.faqs;
        }
      }
      setFaqData(data || []);
    } catch (e) {
      console.error('FAQ 로드 실패:', e);
    }
  }

  // ✅ 통계 로드 - 파라미터·필드 양쪽 지원
  async function fetchStats() {
    if (!currentTenant?.id) return;
    try {
      // 구형 파라미터 우선
      let res = await fetch(
        `/api/stats/${currentTenant.id}?view=conversations&limit=50&range=${encodeURIComponent(dateRange || '7d')}`
      );
      let data = await res.json();

      // 신형으로 폴백
      if (!data?.stats) {
        const res2 = await fetch(`/api/stats/${currentTenant.id}?dateRange=${encodeURIComponent(dateRange || '7d')}`);
        const data2 = await res2.json();
        data = data2;
      }

      // 필드 표준화(카드에서 기대하는 키로 매핑)
      const norm = { ...data };
      if (norm.stats) {
        // 두 포맷 커버
        norm.stats.aiAuto = norm.stats.aiAuto ?? Math.round((norm.stats.aiAutoRate ?? 0) * (norm.stats.total ?? 0) / 100);
        norm.stats.agent = norm.stats.agent ?? norm.stats.agentChats;
        norm.stats.aiConfirm = norm.stats.aiConfirm ?? norm.stats.confirmChats ?? 0;
      }
      // chartData 보정
      if (!norm.chartData?.timeSeriesData && norm.chartData?.mediumData) {
        // 최소한 존재 보장(원 그래프가 mediumData만 있을 때)
        norm.chartData.timeSeriesData = [];
      }
      setStatsData(norm);
    } catch (e) {
      console.error('Stats 로드 실패:', e);
    }
  }

  // ✅ 대화 리스트 가져오기
async function fetchConversations() {
  if (!currentTenant?.id) return;
  setIsLoading(true);
  try {
    const params = new URLSearchParams({
      tenant: currentTenant.id,
      ...conversationFilters,
      limit: 50,
    });
    const res = await fetch(`/api/conversations/list?${params}`);
    const data = await res.json();
    if (data.error) {
      console.error('❌ 대화 데이터 조회 실패:', data.error);
      return;
    }
    setConversationsData(data.conversations || []);
    console.log('✅ 대화 데이터 로드 완료:', data.conversations?.length || 0);
  } catch (error) {
    console.error('❌ 대화 조회 에러:', error);
  } finally {
    setIsLoading(false);
  }
}

// ✅ 대화 상세 가져오기
async function fetchConversationDetail(chatId) {
  if (!currentTenant?.id || !chatId) return;
  setIsLoading(true);
  try {
    const res = await fetch(`/api/conversations/detail?tenant=${currentTenant.id}&chatId=${chatId}`);
    const data = await res.json();
    if (data.error) {
      console.error('❌ 대화 상세 조회 실패:', data.error);
      return;
    }
    setSelectedConversation(data);
    console.log('✅ 대화 상세 로드 완료:', data);
  } catch (error) {
    console.error('❌ 대화 상세 조회 에러:', error);
  } finally {
    setIsLoading(false);
  }
}

// ✅ 업무카드 대시보드 가져오기
async function fetchTasks() {
  if (!currentTenant?.id) return;
  setIsLoading(true);
  try {
    const res = await fetch(`/api/tasks/dashboard?tenant=${currentTenant.id}`);
    const data = await res.json();
    if (data.error) {
      console.error('❌ 업무카드 조회 실패:', data.error);
      return;
    }
    setTasksData(data);
    console.log('✅ 업무카드 데이터 로드 완료:', data.summary);
  } catch (error) {
    console.error('❌ 업무카드 조회 에러:', error);
  } finally {
    setIsLoading(false);
  }
}


  function handleLogout() {
    setIsLoggedIn(false);
    setCurrentTenant(null);
    setShowOnboarding(false);
    localStorage.removeItem('userEmail');
    localStorage.removeItem('tenantId');
    localStorage.removeItem('magicLogin');
    window.location.reload();
  }

  function openModal(item = null) {
    if (item) {
      setEditingItem(item);
      // ✅ 기존 question(문자열, //) 또는 questions(배열) 모두 지원
      const questionsArray = item.questions || (item.question ? item.question.split('//') : ['']);
      setFormData({
        questions: questionsArray,
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

  // ✅ FAQ 저장/수정 - 양쪽 백엔드 모두 호환
  async function handleSubmit() {
    const questions = formData.questions.filter(q => q.trim());
    if (questions.length === 0) return alert('최소 1개의 질문을 입력해주세요.');
    if (!formData.answer.trim()) return alert('답변을 입력해주세요.');

    const faqCount = faqData.length;
    const maxFAQs = currentPlanConfig.maxFAQs;
    if (!editingItem && faqCount >= maxFAQs) {
      return alert(`현재 ${currentPlanConfig.name} 플랜에서는 최대 ${maxFAQs}개의 FAQ만 등록할 수 있습니다.`);
    }

    setIsLoading(true);
    try {
      // 구형 백엔드 호환용 페이로드(문자열 question + plan + vectorUuid)
      const bodyLegacy = {
        question: questions.join('//'),
        answer: formData.answer,
        staffHandoff: formData.staffHandoff,
        guide: formData.guide,
        keyData: formData.keyData,
        expiryDate: formData.expiryDate,
        plan: currentTenant.plan, // 기존 API가 검증/로그 용도로 사용
        ...(editingItem ? { vectorUuid: editingItem.vectorUuid } : {})
      };

      const method = editingItem ? 'PUT' : 'POST';

      // 구형 우선 시도
      let res = await fetch(`/api/faq?tenant=${currentTenant.id}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyLegacy),
      });

      // 신형으로 폴백
      if (!res.ok) {
        const bodyNew = {
          tenantId: currentTenant.id,
          questions,
          answer: formData.answer,
          staffHandoff: formData.staffHandoff,
          guide: formData.guide,
          keyData: formData.keyData,
          expiryDate: formData.expiryDate,
          ...(editingItem ? { id: editingItem.id } : {})
        };

        res = await fetch('/api/faq', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyNew),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return alert(`오류: ${err.error || '저장 실패'}`);
      }

      alert(editingItem ? '✅ FAQ가 수정되었습니다!' : '✅ FAQ가 추가되었습니다!');
      closeModal();
      fetchFAQs();
      if (showOnboarding && !editingItem) {
        setOnboardingStep(2); // 다음 단계로
      }
    } catch (e) {
      console.error('FAQ 저장 실패:', e);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  // ✅ FAQ 삭제 - 벡터 삭제 보존
  async function handleDelete(item) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setIsLoading(true);
    try {
      // 1) 구형: vectorUuid 사용 + tenant 쿼리
      let res = await fetch(`/api/faq?tenant=${currentTenant.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vectorUuid: item.vectorUuid }),
      });

      // 2) 폴백: 신형 id 기반
      if (!res.ok) {
        res = await fetch(`/api/faq?id=${item.id}`, { method: 'DELETE' });
      }

      if (!res.ok) return alert('삭제 실패');
      alert('✅ FAQ가 삭제되었습니다.');
      fetchFAQs();
    } catch (e) {
      console.error('FAQ 삭제 실패:', e);
    } finally {
      setIsLoading(false);
    }
  }

  // ✅ 기존 question(문자열//) 또는 questions(배열) 모두 지원
  const filteredFAQs = faqData.filter(item => {
    const questionsArray = item.questions || (item.question ? item.question.split('//') : []);
    return questionsArray.some(q =>
      q?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || item.answer?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // ✅ 온보딩 복사 함수
  function copyToClipboard(text, type) {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'widget') {
        setCopiedWidget(true);
        setTimeout(() => setCopiedWidget(false), 2000);
      } else if (type === 'naver') {
        setCopiedNaver(true);
        setTimeout(() => setCopiedNaver(false), 2000);
      }
    });
  }

  // ✅ 로그인 전 화면
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-96 h-96 bg-yellow-200/30 rounded-full blur-3xl animate-blob top-0 -left-20"></div>
          <div className="absolute w-96 h-96 bg-amber-200/30 rounded-full blur-3xl animate-blob animation-delay-2000 top-0 -right-20"></div>
          <div className="absolute w-96 h-96 bg-orange-200/30 rounded-full blur-3xl animate-blob animation-delay-4000 bottom-0 left-1/2 transform -translate-x-1/2"></div>
        </div>

        {/* ✅ 멀티 테넌트 선택 화면 */}
        {showTenantSelector ? (
          <div className="relative z-10 bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-yellow-200/30 p-8 w-full max-w-md">
            <div className="text-center mb-6">
              <Building2 className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
                지점 선택
              </h2>
              <p className="text-sm text-gray-600 mt-2 font-semibold">
                {email}로 등록된 {availableTenants.length}개의 지점이 있습니다
              </p>
            </div>

            <div className="space-y-3">
              {availableTenants.map((tenant) => {
                const planKey = (tenant.plan || 'trial').toLowerCase();
                return (
                  <button
                    key={tenant.id}
                    onClick={() => loginWithTenant(tenant, email)}
                    className="w-full p-4 bg-gradient-to-r from-yellow-50 to-amber-50 hover:from-yellow-100 hover:to-amber-100 rounded-2xl border-2 border-yellow-200/50 hover:border-yellow-400/50 transition-all text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-bold text-gray-800 text-lg">{tenant.name || tenant.id}</p>
                        {tenant.branchNo && (
                          <p className="text-sm text-gray-600 font-semibold">지점코드: {tenant.branchNo}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          <span className={`px-2 py-0.5 rounded-full ${PLAN_BADGE_CLASS[planKey]}`}>
                            {PLAN_CONFIG[planKey]?.name}
                          </span>
                        </p>
                      </div>
                      <ChevronDown className="w-5 h-5 text-yellow-600 transform -rotate-90 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                setShowTenantSelector(false);
                setAvailableTenants([]);
              }}
              className="w-full mt-6 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl transition-all font-bold"
            >
              취소
            </button>
          </div>
        ) : (
          // ✅ 이메일 로그인 화면
          <div className="relative z-10 bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-yellow-200/30 p-8 w-full max-w-md">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 via-yellow-300 to-amber-400 rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-yellow-400/30">
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent mb-2">
                야무지니 포털
              </h1>
              <p className="text-gray-600 font-semibold">이메일로 로그인하세요</p>
            </div>

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일 주소"
                  required
                  className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none shadow-sm transition-all"
                />
              </div>

              {loginError && (
                <div className="p-3 bg-red-50/70 backdrop-blur-sm border border-red-200 rounded-xl">
                  <p className="text-sm text-red-600 font-semibold">{loginError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-gradient-to-r from-yellow-400 via-yellow-300 to-amber-400 text-gray-800 rounded-2xl hover:shadow-xl hover:shadow-yellow-400/40 hover:scale-105 transition-all font-bold disabled:opacity-50 shadow-lg shadow-yellow-400/30"
              >
                {isLoading ? '전송 중...' : '로그인 링크 받기'}
              </button>
            </form>

            <p className="text-xs text-gray-500 text-center mt-6 font-semibold">
              로그인 링크가 이메일로 전송됩니다
            </p>
          </div>
        )}
      </div>
    );
  }

  // ✅ 로그인 후 메인 화면
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-yellow-200/20 rounded-full blur-3xl animate-blob top-0 -left-20"></div>
        <div className="absolute w-96 h-96 bg-amber-200/20 rounded-full blur-3xl animate-blob animation-delay-2000 top-0 -right-20"></div>
        <div className="absolute w-96 h-96 bg-orange-200/20 rounded-full blur-3xl animate-blob animation-delay-4000 bottom-0 left-1/2 transform -translate-x-1/2"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">
        {/* ✅ 기존 3단계 온보딩 오버레이 복구 */}
        {showOnboarding && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-yellow-200/30 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-yellow-100/90 to-amber-100/90 backdrop-blur-xl px-6 py-5 rounded-t-3xl flex justify-between items-center">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-700 to-amber-700 bg-clip-text text-transparent">
                  🎉 환영합니다!
                </h2>
                <button
                  onClick={() => setShowOnboarding(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                {/* 단계 표시 */}
                <div className="flex items-center justify-center space-x-4 mb-8">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className="flex items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${onboardingStep >= step ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-800 shadow-lg' : 'bg-gray-200 text-gray-500'}`}>
                        {step}
                      </div>
                      {step < 3 && (
                        <div className={`w-16 h-1 mx-2 rounded-full transition-all ${onboardingStep > step ? 'bg-gradient-to-r from-yellow-400 to-amber-400' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  ))}
                </div>

                {/* 단계별 내용 */}
                {onboardingStep === 1 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <Database className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-gray-800 mb-2">첫 FAQ 등록하기</h3>
                      <p className="text-gray-600 font-semibold">
                        AI 상담을 시작하려면 FAQ를 등록해야 합니다
                      </p>
                    </div>

                    <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-2xl p-6">
                      <h4 className="font-bold text-gray-800 mb-3">💡 FAQ 작성 팁</h4>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li>• 고객이 자주 묻는 질문을 입력하세요</li>
                        <li>• 명확하고 친절한 답변을 작성하세요</li>
                        <li>• 한 FAQ에 여러 유사 질문을 등록할 수 있습니다</li>
                      </ul>
                    </div>

                    <button
                      onClick={() => {
                        setShowOnboarding(false);
                        openModal();
                      }}
                      className="w-full px-6 py-3 bg-gradient-to-r from-yellow-400 via-yellow-300 to-amber-400 text-gray-800 rounded-2xl hover:shadow-xl hover:shadow-yellow-400/40 hover:scale-105 transition-all font-bold shadow-lg shadow-yellow-400/30"
                    >
                      FAQ 등록하러 가기 ✨
                    </button>
                  </div>
                )}

                {onboardingStep === 2 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <MessageSquare className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-gray-800 mb-2">위젯 설치하기</h3>
                      <p className="text-gray-600 font-semibold">
                        웹사이트에 AI 챗봇을 추가하세요
                      </p>
                    </div>

                    {currentTenant?.widgetIframe && (
                      <div className="bg-gray-50 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-bold text-gray-700">위젯 코드</label>
                          <button
                            onClick={() => copyToClipboard(currentTenant.widgetIframe, 'widget')}
                            className="flex items-center space-x-1 px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg transition-colors text-sm font-bold"
                          >
                            {copiedWidget ? (
                              <>
                                <Check className="w-4 h-4" />
                                <span>복사됨!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>복사</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="text-xs bg-gray-800 text-green-400 p-4 rounded-xl overflow-x-auto">
                          {currentTenant.widgetIframe}
                        </pre>
                      </div>
                    )}

                    <div className="flex space-x-3">
                      <button
                        onClick={() => setOnboardingStep(1)}
                        className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-2xl hover:bg-gray-200 transition-all font-bold"
                      >
                        이전
                      </button>
                      <button
                        onClick={() => setOnboardingStep(3)}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-400 via-yellow-300 to-amber-400 text-gray-800 rounded-2xl hover:shadow-xl hover:shadow-yellow-400/40 hover:scale-105 transition-all font-bold shadow-lg shadow-yellow-400/30"
                      >
                        다음
                      </button>
                    </div>
                  </div>
                )}

                {onboardingStep === 3 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <Zap className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-gray-800 mb-2">네이버톡톡 연동하기</h3>
                      <p className="text-gray-600 font-semibold">
                        네이버톡톡에서도 AI 상담을 시작하세요
                      </p>
                    </div>

                    {currentTenant?.naverOutbound && (
                      <div className="bg-gray-50 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-bold text-gray-700">Outbound URL</label>
                          <button
                            onClick={() => copyToClipboard(currentTenant.naverOutbound, 'naver')}
                            className="flex items-center space-x-1 px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg transition-colors text-sm font-bold"
                          >
                            {copiedNaver ? (
                              <>
                                <Check className="w-4 h-4" />
                                <span>복사됨!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>복사</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="text-xs bg-gray-800 text-green-400 p-4 rounded-xl overflow-x-auto">
                          {currentTenant.naverOutbound}
                        </pre>
                        <p className="text-xs text-gray-600 mt-2 font-semibold">
                          네이버톡톡 파트너센터 &gt; 계정 설정 &gt; Outbound API에 입력하세요
                        </p>
                      </div>
                    )}

                    <div className="flex space-x-3">
                      <button
                        onClick={() => setOnboardingStep(2)}
                        className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-2xl hover:bg-gray-200 transition-all font-bold"
                      >
                        이전
                      </button>
                      <button
                        onClick={() => setShowOnboarding(false)}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-400 via-yellow-300 to-amber-400 text-gray-800 rounded-2xl hover:shadow-xl hover:shadow-yellow-400/40 hover:scale-105 transition-all font-bold shadow-lg shadow-yellow-400/30"
                      >
                        시작하기 🚀
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 via-yellow-300 to-amber-400 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-400/30">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
                  {currentTenant?.name || '야무지니'}
                </h1>
                <p className="text-sm text-gray-600 font-semibold">
                  {currentTenant?.email} · {currentPlanConfig.name} 플랜
                  {currentTenant?.branchNo && ` · 지점: ${currentTenant.branchNo}`}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100/70 backdrop-blur-sm hover:bg-gray-200/70 rounded-2xl transition-all text-gray-700 font-bold"
            >
              <LogOut className="w-4 h-4" />
              <span>로그아웃</span>
            </button>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-2 mb-6 flex space-x-2">
  {/* FAQ */}
  <button
    onClick={() => setActiveTab('faq')}
    className={`flex-1 px-6 py-3 rounded-2xl font-bold transition-all ${
      activeTab === 'faq'
        ? 'bg-gradient-to-r from-yellow-400 via-yellow-300 to-amber-400 text-gray-800 shadow-lg shadow-yellow-400/30'
        : 'text-gray-600 hover:bg-white/50'
    }`}
  >
    <Database className="inline w-5 h-5 mr-2" />
    FAQ 관리
  </button>

  {/* ✅ 대화 관리 */}
  <button
    onClick={() => setActiveTab('conversations')}
    className={`flex-1 px-6 py-3 rounded-2xl font-bold transition-all ${
      activeTab === 'conversations'
        ? 'bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-400 text-gray-800 shadow-lg shadow-blue-400/30'
        : 'text-gray-600 hover:bg-white/50'
    }`}
  >
    <MessageSquare className="inline w-5 h-5 mr-2" />
    대화 관리
  </button>

  {/* ✅ 업무카드 */}
  <button
    onClick={() => setActiveTab('tasks')}
    className={`flex-1 px-6 py-3 rounded-2xl font-bold transition-all ${
      activeTab === 'tasks'
        ? 'bg-gradient-to-r from-red-400 via-red-300 to-orange-400 text-gray-800 shadow-lg shadow-red-400/30'
        : 'text-gray-600 hover:bg-white/50'
    }`}
  >
    <AlertCircle className="inline w-5 h-5 mr-2" />
    업무카드
    {tasksData?.summary?.pending > 0 && (
      <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
        {tasksData.summary.pending}
      </span>
    )}
  </button>

  {/* 통계 */}
  <button
    onClick={() => setActiveTab('stats')}
    className={`flex-1 px-6 py-3 rounded-2xl font-bold transition-all ${
      activeTab === 'stats'
        ? 'bg-gradient-to-r from-purple-400 via-purple-300 to-pink-400 text-gray-800 shadow-lg shadow-purple-400/30'
        : 'text-gray-600 hover:bg-white/50'
    }`}
  >
    <BarChart3 className="inline w-5 h-5 mr-2" />
    통계
  </button>
</div>


        {activeTab === 'faq' && (
          <div>
            {/* ✅ Starter 게이지 카드 복구 */}
            {currentPlanConfig.name === 'Starter' && (
              <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">FAQ 등록 현황</h3>
                    <p className="text-sm text-gray-600 font-semibold">
                      Starter 플랜: {faqStats.total} / {currentPlanConfig.maxFAQs}개 사용 중
                    </p>
                  </div>
                  {faqStats.total >= currentPlanConfig.maxFAQs && (
                    <button className="px-4 py-2 bg-gradient-to-r from-purple-400 to-pink-400 text-white rounded-xl hover:shadow-lg transition-all font-bold text-sm">
                      <Crown className="inline w-4 h-4 mr-1" />
                      업그레이드
                    </button>
                  )}
                </div>
                <div className="w-full h-3 bg-gray-200/70 rounded-full overflow-hidden backdrop-blur-sm">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all rounded-full"
                    style={{ width: `${Math.min(100, (faqStats.total / currentPlanConfig.maxFAQs) * 100)}%` }}
                  />
                </div>
                {faqStats.total >= currentPlanConfig.maxFAQs * 0.9 && (
                  <p className="text-xs text-orange-600 mt-2 font-semibold">
                    ⚠️ FAQ 한도에 거의 도달했습니다. Pro 플랜으로 업그레이드하면 무제한으로 등록할 수 있습니다.
                  </p>
                )}
              </div>
            )}

            <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-6 mb-6">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                <div className="flex items-center space-x-4">
                  <h2 className="text-xl font-bold text-gray-800">FAQ 목록</h2>
                  <span className="text-sm text-gray-600 font-semibold">
                    {faqStats.total}개
                    {faqStats.expired > 0 && <span className="text-red-600 ml-2">만료: {faqStats.expired}</span>}
                    {faqStats.needStaff > 0 && <span className="text-yellow-600 ml-2">전달필요: {faqStats.needStaff}</span>}
                  </span>
                </div>
                <button
                  onClick={() => openModal()}
                  disabled={faqStats.total >= currentPlanConfig.maxFAQs}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-yellow-400 via-yellow-300 to-amber-400 text-gray-800 rounded-2xl hover:shadow-xl hover:shadow-yellow-400/40 hover:scale-105 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-400/30"
                >
                  <Plus className="w-5 h-5" />
                  <span>추가</span>
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="FAQ 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/70 backdrop-blur-sm rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none shadow-sm transition-all"
                />
              </div>
            </div>

            <div className="space-y-4">
              {filteredFAQs.map((item) => {
                const isExpiringSoon = item.expiryDate && new Date(item.expiryDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                const isExpired = item.expiryDate && new Date(item.expiryDate) < new Date();
                const questionsArray = item.questions || (item.question ? item.question.split('//') : []);
                
                return (
                  <div key={item.id || item.vectorUuid} className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-6 hover:shadow-xl transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-start space-x-2 mb-2">
                          <div className="flex-1">
                            {questionsArray.map((q, idx) => (
                              <p key={idx} className="text-lg font-bold text-gray-800 mb-1">
                                {questionsArray.length > 1 ? `${idx + 1}. ` : ''}{q}
                              </p>
                            ))}
                          </div>
                          {item.expiryDate && (
                            <div className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-bold ${isExpired ? 'bg-red-100 text-red-700' : isExpiringSoon ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                              <Clock className="w-3 h-3" />
                              <span>{new Date(item.expiryDate).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-gray-600 font-semibold">{item.answer}</p>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => openModal(item)}
                          className="p-2 text-yellow-600 hover:bg-yellow-50/70 rounded-xl transition-all"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-2 text-red-600 hover:bg-red-50/70 rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500 font-semibold">
                      <span className={`px-2 py-1 rounded-lg ${item.staffHandoff === '필요없음' ? 'bg-green-100 text-green-700' : item.staffHandoff === '전달필요' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {item.staffHandoff}
                      </span>
                      {item.guide && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg">가이드 있음</span>}
                      {item.keyData && <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg">핵심 데이터</span>}
                    </div>
                  </div>
                );
              })}

              {filteredFAQs.length === 0 && (
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-16 text-center">
                  <AlertCircle className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg font-semibold">
                    {searchTerm ? '검색 결과가 없습니다' : 'FAQ를 추가해주세요'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

{/* ✅ 대화 관리 탭 */}
{activeTab === 'conversations' && (
  <div className="space-y-6">
    {/* (선택) 실시간 */}
    {/* {liveConversations.length > 0 && (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <span className="font-bold text-green-700">
            실시간 활성 대화: {liveConversations.length}개
          </span>
        </div>
      </div>
    )} */}

    {/* 필터 */}
    <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-6">
      <div className="flex gap-4">
        <select
          value={conversationFilters.status}
          onChange={(e) => setConversationFilters({ ...conversationFilters, status: e.target.value })}
          className="px-4 py-2 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 focus:outline-none"
        >
          <option value="all">전체 상태</option>
          <option value="waiting">대기중</option>
          <option value="in_progress">진행중</option>
          <option value="resolved">해결됨</option>
        </select>

        <select
          value={conversationFilters.channel}
          onChange={(e) => setConversationFilters({ ...conversationFilters, channel: e.target.value })}
          className="px-4 py-2 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 focus:outline-none"
        >
          <option value="all">전체 채널</option>
          <option value="widget">위젯</option>
          <option value="naver">네이버톡</option>
          <option value="kakao">카카오톡</option>
        </select>
      </div>
    </div>

    {/* 리스트 */}
    {conversationsData.length > 0 ? (
      <div className="space-y-4">
        {conversationsData.map((conv) => (
          <ConversationCard
            key={conv.id || conv.chatId}
            conversation={conv}
            onDetail={() => fetchConversationDetail(conv.chatId || conv.id)}
            selectedConversation={selectedConversation}
            onClose={() => setSelectedConversation(null)}
          />
        ))}
      </div>
    ) : (
      <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-16 text-center">
        <MessageSquare className="w-20 h-20 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg font-semibold">대화 내역이 없습니다</p>
      </div>
    )}
  </div>
)}

{/* ✅ 업무카드 탭 */}
{activeTab === 'tasks' && (
  <div className="space-y-6">
    {/* 요약 */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-3xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <Clock className="w-8 h-8 text-orange-600" />
          <span className="text-3xl font-bold text-orange-600">{tasksData?.summary?.pending || 0}</span>
        </div>
        <p className="text-gray-700 font-semibold">대기중</p>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-3xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <Zap className="w-8 h-8 text-blue-600" />
          <span className="text-3xl font-bold text-blue-600">{tasksData?.summary?.inProgress || 0}</span>
        </div>
        <p className="text-gray-700 font-semibold">처리중</p>
      </div>

      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <Check className="w-8 h-8 text-green-600" />
          <span className="text-3xl font-bold text-green-600">{tasksData?.summary?.completed || 0}</span>
        </div>
        <p className="text-gray-700 font-semibold">완료</p>
      </div>
    </div>

    {/* 리스트 */}
    {tasksData?.tasks?.length > 0 ? (
      <div className="space-y-4">
        {tasksData.tasks.filter(t => t.status === 'pending').length > 0 && (
          <div>
            <h3 className="text-lg font-bold mb-3 text-orange-700">🔴 대기중</h3>
            {tasksData.tasks
              .filter(t => t.status === 'pending')
              .map(task => <TaskCard key={task.id} task={task} />)}
          </div>
        )}

        {tasksData.tasks.filter(t => t.status === 'inProgress').length > 0 && (
          <div>
            <h3 className="text-lg font-bold mb-3 text-blue-700">🟡 처리중</h3>
            {tasksData.tasks
              .filter(t => t.status === 'inProgress')
              .map(task => <TaskCard key={task.id} task={task} />)}
          </div>
        )}

        {tasksData.tasks.filter(t => t.status === 'completed').length > 0 && (
          <div>
            <h3 className="text-lg font-bold mb-3 text-green-700">🟢 완료</h3>
            {tasksData.tasks
              .filter(t => t.status === 'completed')
              .slice(0, 10)
              .map(task => <TaskCard key={task.id} task={task} />)}
          </div>
        )}
      </div>
    ) : (
      <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-16 text-center">
        <AlertCircle className="w-20 h-20 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg font-semibold">업무카드가 없습니다</p>
      </div>
    )}
  </div>
)}

        {activeTab === 'stats' && (
          <div>
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-6 mb-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <h2 className="text-xl font-bold text-gray-800">통계 대시보드</h2>
                <div className="flex items-center space-x-2">
                  <button onClick={() => setDateRange('7d')} className={`px-4 py-2 rounded-xl font-bold transition-all ${dateRange === '7d' ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-800 shadow-lg' : 'bg-white/70 text-gray-600 hover:bg-white'}`}>7일</button>
                  <button onClick={() => setDateRange('30d')} className={`px-4 py-2 rounded-xl font-bold transition-all ${dateRange === '30d' ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-800 shadow-lg' : 'bg-white/70 text-gray-600 hover:bg-white'}`}>30일</button>
                  <button onClick={() => setDateRange('90d')} className={`px-4 py-2 rounded-xl font-bold transition-all ${dateRange === '90d' ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-800 shadow-lg' : 'bg-white/70 text-gray-600 hover:bg-white'}`}>90일</button>
                </div>
              </div>
            </div>

            {statsData?.stats ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 backdrop-blur-xl rounded-3xl shadow-lg shadow-blue-200/20 p-6 hover:shadow-xl transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <Users className="w-8 h-8 text-blue-600" />
                      <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">총 상담</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{statsData.stats.total}</p>
                    <p className="text-sm text-gray-600 font-semibold mt-1">전체 상담 건수</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 backdrop-blur-xl rounded-3xl shadow-lg shadow-green-200/20 p-6 hover:shadow-xl transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <MessageSquare className="w-8 h-8 text-green-600" />
                      <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">AI 자동</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{statsData.stats.aiAuto}</p>
                    <p className="text-sm text-gray-600 font-semibold mt-1">자동 응답 건수</p>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-50 to-amber-50 backdrop-blur-xl rounded-3xl shadow-lg shadow-yellow-200/20 p-6 hover:shadow-xl transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <AlertCircle className="w-8 h-8 text-yellow-600" />
                      <span className="text-xs font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">확인 필요</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{statsData.stats.aiConfirm}</p>
                    <p className="text-sm text-gray-600 font-semibold mt-1">확인 모드 건수</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 backdrop-blur-xl rounded-3xl shadow-lg shadow-purple-200/20 p-6 hover:shadow-xl transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <Users className="w-8 h-8 text-purple-600" />
                      <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-full">상담원</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-800">{statsData.stats.agent}</p>
                    <p className="text-sm text-gray-600 font-semibold mt-1">상담원 처리 건수</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-6 hover:shadow-xl transition-all">
                    <h3 className="text-lg font-bold mb-4 text-gray-800">일별 상담 추이</h3>
                    {statsData.chartData?.timeSeriesData && statsData.chartData.timeSeriesData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={statsData.chartData.timeSeriesData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px', fontWeight: 600 }} />
                          <YAxis stroke="#9ca3af" style={{ fontSize: '12px', fontWeight: 600 }} />
                          <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                          <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 4 }} name="상담 건수" />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-gray-400">
                        <p>데이터가 없습니다</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-6 hover:shadow-xl transition-all">
                    <h3 className="text-lg font-bold mb-4 text-gray-800">AI vs 상담원 비율</h3>
                    {statsData.chartData?.aiVsAgentData && statsData.chartData.aiVsAgentData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie data={statsData.chartData.aiVsAgentData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                            {statsData.chartData.aiVsAgentData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-gray-400">
                        <p>데이터가 없습니다</p>
                      </div>
                    )}
                  </div>
                </div>

                {statsData.chartData?.tagData && statsData.chartData.tagData.length > 0 && (
                  <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-6 mb-6 hover:shadow-xl transition-all">
                    <h3 className="text-lg font-bold mb-4 text-gray-800">자주 나오는 상담 주제</h3>
                    <div className="space-y-3">
                      {statsData.chartData.tagData.slice(0, 5).map((tag) => (
                        <div key={tag.name} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 font-semibold">{tag.name}</span>
                          <div className="flex items-center">
                            <div className="w-48 h-3 bg-gray-200/70 rounded-full mr-3 overflow-hidden backdrop-blur-sm">
                              <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all rounded-full" style={{ width: `${(tag.count / statsData.stats.total) * 100}%` }} />
                            </div>
                            <span className="text-sm font-bold text-gray-800 w-10 text-right">{tag.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {statsData.conversations && statsData.conversations.length > 0 && (
                  <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-6 hover:shadow-xl transition-all">
                    <h3 className="text-lg font-bold mb-4 text-gray-800">최근 상담 내역</h3>
                    <div className="space-y-2">
                      {statsData.conversations.slice(0, 10).map((conv) => {
                        const dt = conv.firstOpenedAt ? new Date(conv.firstOpenedAt) : null;
                        const mediumLabel = conv.mediumName === "appKakao" ? "카카오" : conv.mediumName === "appNaverTalk" ? "네이버톡" : conv.mediumName === "widget" ? "위젯" : conv.mediumName === "web" ? "웹" : conv.mediumName || "기타";
                        return (
                          <div key={conv.id} className="flex justify-between items-center p-4 border-b border-white/30 hover:bg-white/40 rounded-xl transition-all">
                            <div className="flex-1">
                              <p className="font-bold text-gray-800">{conv.userName || "Unknown"}</p>
                              <p className="text-xs text-gray-600 font-semibold">{mediumLabel} · {dt ? dt.toLocaleString("ko-KR") : "-"}</p>
                            </div>
                            <div className="text-right text-sm space-x-2">
                              <span className="px-2 py-1 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 font-bold rounded-lg">AI {conv.aiAutoChats || 0}</span>
                              {(conv.agentChats || 0) > 0 && <span className="px-2 py-1 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 font-bold rounded-lg">상담원 {conv.agentChats}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-16 text-center">
                <BarChart3 className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-semibold">통계 데이터를 불러오는 중...</p>
              </div>
            )}
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-yellow-200/30 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-yellow-100/80 to-amber-100/80 backdrop-blur-xl px-6 py-5 rounded-t-3xl">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-700 to-amber-700 bg-clip-text text-transparent">{editingItem ? 'FAQ 수정 ✏️' : '새 FAQ 추가 ✨'}</h2>
              </div>
              <div className="p-6 space-y-5">
                {/* ✅ 질문 배열 입력 필드 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    질문 또는 기본 정보 <span className="text-red-500">*</span>
                  </label>

                  {formData.questions.map((question, index) => (
                    <div key={index} className="flex items-start space-x-2 mb-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={question}
                          onChange={(e) => updateQuestion(index, e.target.value)}
                          className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none shadow-sm transition-all"
                          placeholder={`질문 ${index + 1}`}
                        />
                      </div>
                      {formData.questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(index)}
                          className="p-2.5 text-red-600 hover:bg-red-50/70 rounded-xl transition-all"
                          title="이 질문 삭제"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addQuestion}
                    className="mt-2 flex items-center space-x-2 px-4 py-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors text-sm font-bold"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>질문 추가</span>
                  </button>

                  <p className="text-xs text-gray-500 mt-2">
                    💡 같은 답변에 여러 질문을 등록할 수 있습니다
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">답변 <span className="text-red-500">*</span></label>
                  <textarea value={formData.answer} onChange={(e) => setFormData({...formData, answer: e.target.value})} rows="4" className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none resize-none shadow-sm transition-all" placeholder="AI가 고객에게 제공할 답변을 입력하세요" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">담당자 전달</label>
                  <select value={formData.staffHandoff} onChange={(e) => setFormData({...formData, staffHandoff: e.target.value})} className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none shadow-sm transition-all">
                    <option value="필요없음">필요없음</option>
                    <option value="전달필요">전달필요</option>
                    <option value="조건부전달">조건부전달</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">가이드 (선택)</label>
                  <input type="text" value={formData.guide} onChange={(e) => setFormData({...formData, guide: e.target.value})} className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none shadow-sm transition-all" placeholder="답변 생성 시 추가 주의사항" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">핵심 데이터 (선택)</label>
                  <input type="text" value={formData.keyData} onChange={(e) => setFormData({...formData, keyData: e.target.value})} className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none shadow-sm transition-all" placeholder="전화번호, 링크 등 변형되어선 안되는 고정값" />
                </div>
                {currentPlanConfig?.hasExpiryDate && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      만료일 (선택)
                      <span className="ml-2 text-xs bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 px-2 py-1 rounded-full font-bold"><Crown className="inline w-3 h-3 mr-1" />{currentPlanConfig.name|| 'Trial'} 전용</span>
                    </label>
                    <div className="relative">
                      <input type="date" value={formData.expiryDate} onChange={(e) => setFormData({...formData, expiryDate: e.target.value})} className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none shadow-sm transition-all" />
                      <Calendar className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                    <p className="text-xs text-gray-600 mt-2 font-semibold">휴가 일정 등 기간 한정 정보에 활용하세요</p>
                  </div>
                )}
                <div className="flex space-x-3 pt-4">
                  <button onClick={closeModal} className="flex-1 px-6 py-3 bg-gray-100/70 backdrop-blur-sm text-gray-700 rounded-2xl hover:bg-gray-200/70 transition-all font-bold">취소</button>
                  <button onClick={handleSubmit} disabled={isLoading} className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-400 via-yellow-300 to-amber-400 text-gray-800 rounded-2xl hover:shadow-xl hover:shadow-yellow-400/40 hover:scale-105 transition-all font-bold disabled:opacity-50 shadow-lg shadow-yellow-400/30">{editingItem ? '수정 완료 ✓' : '추가 ✨'}</button>
                </div>
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
  );
}

// 대화 카드
function ConversationCard({ conversation, onDetail, selectedConversation, onClose }) {
  const [expanded, setExpanded] = React.useState(false);

  const handleClick = () => {
    if (!expanded) onDetail();
    setExpanded(!expanded);
  };

  const channelBadge = {
    widget: 'bg-blue-100 text-blue-700',
    naver: 'bg-green-100 text-green-700',
    kakao: 'bg-yellow-100 text-yellow-700',
    unknown: 'bg-gray-100 text-gray-700',
  }[conversation.channel] || 'bg-gray-100 text-gray-700';

  const statusBadge = {
    waiting: 'bg-orange-100 text-orange-700',
    in_progress: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
  }[conversation.status] || 'bg-gray-100 text-gray-700';

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-6 hover:shadow-xl transition-all">
      {/* 요약 */}
      <div className="flex justify-between items-start cursor-pointer" onClick={handleClick}>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-lg">{conversation.userName}</span>
            <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${channelBadge}`}>{conversation.channel}</span>
            <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${statusBadge}`}>
              {conversation.status === 'waiting' ? '대기중'
                : conversation.status === 'in_progress' ? '진행중' : '해결됨'}
            </span>
            {conversation.isTask && (
              <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-lg font-semibold">📌 업무카드</span>
            )}
          </div>
          <p className="text-gray-600 text-sm mb-3">{conversation.lastMessageText}</p>
          <div className="flex gap-4 text-sm text-gray-500">
            <span>💬 {conversation.messageCount?.total ?? 0}개 메시지</span>
            <span>🤖 AI {conversation.messageCount?.ai ?? 0}</span>
            <span>👤 상담원 {conversation.messageCount?.agent ?? 0}</span>
          </div>
        </div>
        <div className="text-sm text-gray-500 text-right">
          {conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleString('ko-KR') : '-'}
        </div>
      </div>

{/* 상세(펼침) */}
{expanded &&
  selectedConversation &&
  (selectedConversation.conversation?.chatId === conversation.chatId ||
    selectedConversation.conversation?.id === conversation.id) && (
    <div className="mt-6 pt-6 border-t border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">대화 내용</h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
            onClose();
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

          <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
            {selectedConversation.messages?.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl ${
                  msg.sender === 'user' ? 'bg-gray-100'
                  : msg.sender === 'ai' ? 'bg-blue-50'
                  : 'bg-green-50'
                }`}
              >
                <div className="text-xs text-gray-500 mb-1 font-semibold">
                  {msg.sender === 'user' ? '👤 사용자'
                    : msg.sender === 'ai' ? '🤖 AI' : '👨‍💼 상담원'} |{' '}
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleString('ko-KR') : '-'}
                </div>
                <div className="text-sm">{msg.text || '(이미지/파일)'}</div>
              </div>
            ))}
          </div>

          {selectedConversation.stats && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-4">
              <h4 className="font-bold text-sm mb-2">대화 통계</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><div className="text-gray-500">사용자 메시지</div><div className="font-bold">{selectedConversation.stats.userChats}개</div></div>
                <div><div className="text-gray-500">AI 처리</div><div className="font-bold">{selectedConversation.stats.aiChats}개</div></div>
                <div><div className="text-gray-500">상담원 개입</div><div className="font-bold">{selectedConversation.stats.agentChats}개</div></div>
              </div>
            </div>
          )}

          {selectedConversation.slack?.slackUrl && (
            <a
              href={selectedConversation.slack.slackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all font-semibold"
            >
              슬랙에서 보기
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// 업무카드
function TaskCard({ task }) {
  const channelBadge = {
    widget: 'bg-blue-100 text-blue-700',
    naver: 'bg-green-100 text-green-700',
    kakao: 'bg-yellow-100 text-yellow-700',
  }[task.channel] || 'bg-gray-100 text-gray-700';

  return (
    <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-lg p-4 mb-3 hover:shadow-xl transition-all">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold">{task.userName}</span>
            <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${channelBadge}`}>{task.channel}</span>
            {task.priority === 'high' && (
              <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-lg font-semibold">🚨 긴급</span>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-2">{task.lastMessage}</p>
          <p className="text-xs text-gray-400">
            {task.lastMessageAt ? new Date(task.lastMessageAt).toLocaleString('ko-KR') : '-'}
          </p>
        </div>
        {task.slackUrl && (
          <a
            href={task.slackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-xl hover:bg-purple-700 transition-all font-semibold"
          >
            슬랙에서 보기
          </a>
        )}
      </div>
    </div>
  );
}
