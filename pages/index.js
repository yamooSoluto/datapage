import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, LogOut, Database, TrendingUp, Clock, AlertCircle, Crown, Calendar, BarChart3, Users, MessageSquare, Zap, Building2, ChevronDown, X, Copy, Check, ChevronLeft, ChevronRight, Settings, ExternalLink, BookOpen } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

console.log('🚀 페이지 로드됨!', new Date().toISOString());

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
  
  // ✅ 온보딩 관련 (3단계 스와이프)
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [copiedWidget, setCopiedWidget] = useState(false);
  const [copiedNaver, setCopiedNaver] = useState(false);
  const [canDismissOnboarding, setCanDismissOnboarding] = useState(false); // ✅ FAQ 작성 후 닫기 가능
  
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

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
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
    const expired = faqData.filter(i => i.expiryDate && new Date(i.expiryDate) < new Date()).length;
    const needStaff = faqData.filter(i => i.staffHandoff && i.staffHandoff !== '필요없음').length;
    return { total: faqData.length, expired, needStaff };
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
    const savedEmail = localStorage.getItem('userEmail');
    const savedTenantId = localStorage.getItem('tenantId');
    const isMagicLogin = localStorage.getItem('magicLogin');

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
      const res = await fetch(`/api/auth/verify-token?token=${token}`);
      const data = await res.json();

      if (data?.error) {
        console.error('❌ [Auth] 토큰 검증 실패:', data.error);
        setLoginError(data.error);
        setIsLoading(false);
        return;
      }

      if (data.tenants && data.tenants.length > 1) {
        setAvailableTenants(data.tenants);
        setShowTenantSelector(true);
      } else if (data.tenants && data.tenants.length === 1) {
        selectTenant(data.tenants[0]);
      } else {
        setLoginError('연결된 테넌트가 없습니다.');
      }

      setIsLoading(false);
    } catch (err) {
      console.error('❌ [Auth] 토큰 검증 에러:', err);
      setLoginError('토큰 검증 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  }

  function selectTenant(tenant) {
    setCurrentTenant(tenant);
    setIsLoggedIn(true);
    setShowTenantSelector(false);

    localStorage.setItem('userEmail', tenant.email || '');
    localStorage.setItem('tenantId', tenant.id);
    localStorage.setItem('magicLogin', 'true');

    const shouldShowOnboarding = !tenant.onboardingDismissed && (tenant.faqCount === 0 || tenant.showOnboarding);
    setShowOnboarding(shouldShowOnboarding);
    setCanDismissOnboarding(true); // ✅ 항상 닫기 가능

    console.log('✅ [Auth] 테넌트 선택 완료:', tenant.id);
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
      } else {
        alert('✅ 이메일로 로그인 링크가 발송되었습니다!');
        setEmail('');
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

  // ✅ 탭 전환 시 대화 리스트/업무카드 로드
  useEffect(() => {
    if (!isLoggedIn || !currentTenant?.id) return;
    if (activeTab === 'conversations') {
      fetchConversations();
    } else if (activeTab === 'tasks') {
      fetchTasks();
    }
    // 탭이 바뀌면 상세 초기화
    if (activeTab !== 'conversations' && selectedConversation) {
      setSelectedConversation(null);
    }
  }, [activeTab, conversationFilters, currentTenant, isLoggedIn]);

  async function fetchFAQData() {
    if (!currentTenant) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/data/get-faqs?tenantId=${currentTenant.id}`);
      const data = await res.json();
      if (data?.error) {
        console.error('❌ FAQ 조회 실패:', data.error);
        return;
      }
      setFaqData(data.faqs || []);
      console.log('✅ FAQ 데이터 로드 완료:', data.faqs?.length || 0);
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

  // ✅ 대화 리스트 가져오기
  async function fetchConversations() {
    if (!currentTenant?.id) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        tenant: currentTenant.id,
        limit: 50,
      });
      // 'all'은 전송하지 않음
      if (conversationFilters.status && conversationFilters.status !== 'all') {
        params.set('status', conversationFilters.status);
      }
      if (conversationFilters.channel && conversationFilters.channel !== 'all') {
        params.set('channel', conversationFilters.channel);
      }
      
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

  function openModal(item = null) {
    if (item) {
      setEditingItem(item);
      setFormData({
        questions: Array.isArray(item.question) ? item.question : [item.question || ''],
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
      const payload = {
        tenantId: currentTenant.id,
        ...formData,
        question: formData.questions
      };

      const url = editingItem
        ? `/api/data/update-faq?faqId=${editingItem.id}`
        : '/api/data/add-faq';

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data?.error) {
        alert(`❌ ${editingItem ? '수정' : '추가'} 실패: ${data.error}`);
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

  async function handleDelete(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/data/delete-faq?faqId=${id}`, { method: 'POST' });
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
      const questions = Array.isArray(item.question) ? item.question : [item.question];
      return questions.some(q => q?.toLowerCase().includes(term)) || 
             item.answer?.toLowerCase().includes(term);
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
                  className="w-full p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-2xl hover:shadow-lg transition-all text-left border border-yellow-200"
                >
                  <div className="font-bold text-gray-800">{tenant.brandName || tenant.id}</div>
                  <div className="text-sm text-gray-600">{tenant.email}</div>
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
                  className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none shadow-sm transition-all"
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
        {/* ✅ 모바일 최적화 헤더 */}
        <div className="bg-white/70 backdrop-blur-xl border-b border-white/30 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-3 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-yellow-400 to-amber-400 rounded-2xl shadow-lg shadow-yellow-400/30 flex items-center justify-center">
                  <Database className="w-5 h-5 sm:w-6 sm:h-6 text-gray-800" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent truncate">
                    {currentTenant?.brandName || '야무 포털'}
                  </h1>
                  {/* ✅ 플랜 뱃지 */}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${PLAN_BADGE_CLASS[currentTenant?.plan?.toLowerCase()] || PLAN_BADGE_CLASS.trial}`}>
                      {currentPlanConfig.name}
                    </span>
                    {subscriptionInfo && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        subscriptionInfo.isExpired ? 'bg-red-100 text-red-700' :
                        subscriptionInfo.isExpiringSoon ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {subscriptionInfo.isExpired 
                          ? '만료됨' 
                          : `D-${subscriptionInfo.daysLeft}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* ✅ 설정 버튼 (로그아웃 숨김) */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  className="p-2 sm:p-2.5 bg-white/60 backdrop-blur-sm rounded-xl hover:bg-white/80 transition-all"
                >
                  <Settings className="w-5 h-5 text-gray-600" />
                </button>

                {showSettingsMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                    <button
                      onClick={reopenOnboarding}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>설치 가이드</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-3 text-left hover:bg-red-50 flex items-center gap-2 text-sm text-red-600 border-t"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>로그아웃</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ✅ 온보딩 모달 (스와이프 가능) */}
        {showOnboarding && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              {/* 진행 표시 */}
              <div className="bg-gradient-to-r from-yellow-100 to-amber-100 px-6 py-4 flex items-center justify-between">
                <div className="flex gap-2">
                  {[1, 2, 3].map(step => (
                    <div
                      key={step}
                      className={`w-2 h-2 rounded-full transition-all ${
                        step === onboardingStep ? 'bg-yellow-600 w-8' : 'bg-yellow-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-600 font-semibold">
                  {onboardingStep} / 3
                </span>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                {onboardingStep === 1 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                      🎉 환영합니다!
                    </h2>
                    <p className="text-gray-600 text-sm">
                      야무지니가 정확한 답변을 하려면 먼저 기본 정보를 입력해주세요.
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li>✅ 영업시간, 위치, 연락처</li>
                        <li>✅ 주요 상품/서비스 정보</li>
                        <li>✅ 자주 받는 질문과 답변</li>
                      </ul>
                    </div>
                    <a
                      href={currentTenant?.OnboardingFormLink || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full px-6 py-4 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-800 rounded-2xl hover:shadow-xl transition-all font-bold text-center"
                    >
                      <ExternalLink className="inline w-5 h-5 mr-2" />
                      기본 정보 입력하러 가기
                    </a>
                    <p className="text-xs text-gray-500 text-center">
                      💡 작성하신 정보는 언제든 포털에서 수정 가능합니다
                    </p>
                  </div>
                )}

                {onboardingStep === 2 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                      💬 문의 위젯 링크
                    </h2>
                    <p className="text-gray-600 text-sm">
                      고객에게 전달하거나 테스트할 수 있는 문의 창 링크입니다.
                    </p>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="mb-3">
                        <div className="text-xs text-gray-600 mb-2 font-semibold">문의 위젯 링크</div>
                        <div className="bg-white p-3 rounded-lg font-mono text-sm break-all border border-blue-100">
                          {currentTenant?.WidgetLink || '링크가 설정되지 않았습니다'}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          if (currentTenant?.WidgetLink) {
                            navigator.clipboard.writeText(currentTenant.WidgetLink);
                            setCopiedWidget(true);
                            setTimeout(() => setCopiedWidget(false), 2000);
                          }
                        }}
                        className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold flex items-center justify-center gap-2"
                      >
                        {copiedWidget ? (
                          <>
                            <Check className="w-4 h-4" />
                            복사됨!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            링크 복사하기
                          </>
                        )}
                      </button>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                      <p className="font-semibold text-gray-800">✨ 활용 방법</p>
                      <ul className="space-y-1 text-gray-600 ml-4">
                        <li>• 고객에게 "여기로 문의해주세요" 전달</li>
                        <li>• SNS/카톡 프로필에 링크 게시</li>
                        <li>• 링크로 직접 테스트 가능</li>
                      </ul>
                    </div>
                  </div>
                )}

                {onboardingStep === 3 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                      💚 네이버톡톡 연동 (선택)
                    </h2>
                    <p className="text-gray-600 text-sm">
                      네이버 스마트플레이스에서 톡톡 상담을 사용 중이신가요?<br />
                      아래 링크를 연동하면 톡톡 문의도 자동 응답됩니다.
                    </p>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-start gap-2 mb-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800">
                          <strong>네이버톡톡이 없으신가요?</strong>
                          <p className="text-xs mt-1">건너뛰고 나중에 설정할 수 있습니다</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="mb-3">
                        <div className="text-xs text-gray-600 mb-2 font-semibold">
                          연동 경로
                        </div>
                        <div className="bg-white p-3 rounded-lg text-sm border border-green-100 space-y-1">
                          <p className="font-semibold text-green-700">네이버톡톡 관리자센터</p>
                          <p className="text-gray-600">→ 연동관리</p>
                          <p className="text-gray-600">→ 챗봇API설정</p>
                          <p className="text-gray-600">→ Event받을 URL 입력</p>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="text-xs text-gray-600 mb-2 font-semibold">입력할 URL</div>
                        <div className="bg-white p-3 rounded-lg font-mono text-xs break-all border border-green-100">
                          {currentTenant?.NaverOutbound || '링크가 설정되지 않았습니다'}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          if (currentTenant?.NaverOutbound) {
                            navigator.clipboard.writeText(currentTenant.NaverOutbound);
                            setCopiedNaver(true);
                            setTimeout(() => setCopiedNaver(false), 2000);
                          }
                        }}
                        className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-semibold flex items-center justify-center gap-2"
                      >
                        {copiedNaver ? (
                          <>
                            <Check className="w-4 h-4" />
                            복사됨!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            URL 복사하기
                          </>
                        )}
                      </button>
                    </div>

                    {/* ✅ 설치 가이드 재확인 안내 */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-start gap-2">
                        <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                          <strong>이 가이드를 다시 보려면?</strong>
                          <p className="text-xs mt-1">
                            포털 우측 상단 <Settings className="inline w-3 h-3" /> 설정 메뉴 → 📖 설치 가이드를 클릭하세요
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 text-center">
                      💡 네이버톡톡 연동은 선택사항입니다. 나중에 설정할 수 있습니다.
                    </p>
                  </div>
                )}
              </div>

              {/* 네비게이션 */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
                <button
                  onClick={() => setOnboardingStep(Math.max(1, onboardingStep - 1))}
                  disabled={onboardingStep === 1}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  이전
                </button>

                <div className="flex gap-2">
                  {onboardingStep < 3 ? (
                    <button
                      onClick={() => setOnboardingStep(onboardingStep + 1)}
                      className="px-6 py-2 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-800 rounded-xl hover:shadow-lg transition-all font-semibold flex items-center gap-2"
                    >
                      다음
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={dismissOnboarding}
                      className="px-6 py-2 bg-gradient-to-r from-green-400 to-emerald-400 text-white rounded-xl hover:shadow-lg transition-all font-semibold"
                    >
                      완료하고 시작하기 🚀
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-3 py-4 sm:px-6 sm:py-6">
          {/* ✅ 구독 정보 카드 (모바일 최적화) */}
          {subscriptionInfo && (
            <div className={`mb-4 p-3 sm:p-4 rounded-2xl border-2 ${
              subscriptionInfo.isExpired 
                ? 'bg-red-50 border-red-200' 
                : subscriptionInfo.isExpiringSoon 
                ? 'bg-orange-50 border-orange-200' 
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 sm:w-5 sm:h-5 ${
                    subscriptionInfo.isExpired ? 'text-red-600' :
                    subscriptionInfo.isExpiringSoon ? 'text-orange-600' :
                    'text-blue-600'
                  }`} />
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-gray-800">
                      {subscriptionInfo.isExpired ? '구독 만료' : '구독 중'}
                    </div>
                    <div className="text-xs text-gray-600">
                      {subscriptionInfo.endDate.toLocaleDateString('ko-KR')}까지
                    </div>
                  </div>
                </div>
                {(subscriptionInfo.isExpired || subscriptionInfo.isExpiringSoon) && (
                  <button className="text-xs px-3 py-1.5 bg-white rounded-lg font-semibold hover:shadow-md transition-all">
                    연장하기
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ✅ 탭 버튼 (모바일 최적화) */}
          <div className="flex gap-2 border-b border-white/30 backdrop-blur-xl pb-3 mb-4 overflow-x-auto">
            {/* FAQ */}
            <button
              onClick={() => setActiveTab('faq')}
              className={`px-4 py-2 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl transition-all font-bold shadow-sm text-sm sm:text-base whitespace-nowrap ${
                activeTab === 'faq'
                  ? 'bg-gradient-to-r from-yellow-400 via-yellow-300 to-amber-400 text-gray-800 shadow-lg shadow-yellow-400/30'
                  : 'bg-white/50 backdrop-blur-md text-gray-600 hover:bg-white/70'
              }`}
            >
              <Database className="inline w-4 h-4 mr-1 sm:mr-2" />
              FAQ 관리
            </button>

            {/* ✅ 대화 관리 */}
            <button
              onClick={() => setActiveTab('conversations')}
              className={`px-4 py-2 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl transition-all font-bold shadow-sm text-sm sm:text-base whitespace-nowrap ${
                activeTab === 'conversations'
                  ? 'bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-400 text-gray-800 shadow-lg shadow-blue-400/30'
                  : 'bg-white/50 backdrop-blur-md text-gray-600 hover:bg-white/70'
              }`}
            >
              <MessageSquare className="inline w-4 h-4 mr-1 sm:mr-2" />
              대화 관리
            </button>

            {/* ✅ 업무카드 */}
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-2 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl transition-all font-bold shadow-sm text-sm sm:text-base whitespace-nowrap ${
                activeTab === 'tasks'
                  ? 'bg-gradient-to-r from-red-400 via-red-300 to-orange-400 text-gray-800 shadow-lg shadow-red-400/30'
                  : 'bg-white/50 backdrop-blur-md text-gray-600 hover:bg-white/70'
              }`}
            >
              <AlertCircle className="inline w-4 h-4 mr-1 sm:mr-2" />
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
              className={`px-4 py-2 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl transition-all font-bold shadow-sm text-sm sm:text-base whitespace-nowrap ${
                activeTab === 'stats'
                  ? 'bg-gradient-to-r from-purple-400 via-purple-300 to-pink-400 text-gray-800 shadow-lg shadow-purple-400/30'
                  : 'bg-white/50 backdrop-blur-md text-gray-600 hover:bg-white/70'
              }`}
            >
              <BarChart3 className="inline w-4 h-4 mr-1 sm:mr-2" />
              통계
            </button>
          </div>

          {/* FAQ 탭 */}
          {activeTab === 'faq' && (
            <div className="space-y-4">
              {/* ✅ FAQ 제한 게이지 (trial도 표시) */}
              {currentPlanConfig.maxFAQs !== Infinity && (
                <div className="bg-white/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-lg shadow-gray-200/20 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm sm:text-base font-bold text-gray-700">
                      FAQ 사용량
                    </span>
                    <span className="text-xs sm:text-sm text-gray-600 font-semibold">
                      {faqStats.total} / {currentPlanConfig.maxFAQs}
                    </span>
                  </div>
                  <div className="w-full h-3 sm:h-4 bg-gray-200/70 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all rounded-full ${
                        faqStats.total >= currentPlanConfig.maxFAQs
                          ? 'bg-gradient-to-r from-red-500 to-red-600'
                          : 'bg-gradient-to-r from-yellow-400 to-amber-400'
                      }`}
                      style={{ width: `${(faqStats.total / currentPlanConfig.maxFAQs) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 검색 & 추가 */}
              <div className="flex gap-2 sm:gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none shadow-sm transition-all text-sm sm:text-base"
                    placeholder="FAQ 검색..."
                  />
                </div>
                <button
                  onClick={() => openModal()}
                  className="px-4 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-yellow-400 via-yellow-300 to-amber-400 text-gray-800 rounded-xl sm:rounded-2xl hover:shadow-xl hover:shadow-yellow-400/40 hover:scale-105 transition-all font-bold shadow-lg shadow-yellow-400/30 text-sm sm:text-base whitespace-nowrap"
                >
                  <Plus className="inline w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                  추가
                </button>
              </div>

              {/* FAQ 리스트 (모바일 최적화) */}
              {filteredFAQData.length > 0 ? (
                <div className="space-y-3 sm:space-y-4">
                  {filteredFAQData.map(item => {
                    const questions = Array.isArray(item.question) ? item.question : [item.question];
                    const isExpired = item.expiryDate && new Date(item.expiryDate) < new Date();

                    return (
                      <div
                        key={item.id}
                        className={`bg-white/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-lg shadow-gray-200/20 p-4 sm:p-6 hover:shadow-xl transition-all ${
                          isExpired ? 'opacity-50 border-2 border-red-200' : ''
                        }`}
                      >
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 space-y-1">
                                {questions.map((q, idx) => (
                                  <div key={idx} className="text-sm sm:text-base font-bold text-gray-800">
                                    {idx > 0 && '➕ '}{q}
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                                <button
                                  onClick={() => openModal(item)}
                                  className="p-1.5 sm:p-2 bg-yellow-100 text-yellow-600 rounded-lg hover:bg-yellow-200 transition-all"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="p-1.5 sm:p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">{item.answer}</p>
                          </div>

                          <div className="flex flex-wrap gap-1.5 sm:gap-2 text-xs">
                            {item.staffHandoff && item.staffHandoff !== '필요없음' && (
                              <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-blue-100 text-blue-700 rounded-lg font-semibold">
                                {item.staffHandoff}
                              </span>
                            )}
                            {item.expiryDate && (
                              <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg font-semibold ${
                                isExpired
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {isExpired ? '만료됨' : new Date(item.expiryDate).toLocaleDateString('ko-KR')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-lg shadow-gray-200/20 p-8 sm:p-16 text-center">
                  <Database className="w-16 h-16 sm:w-20 sm:h-20 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-base sm:text-lg font-semibold">
                    {searchTerm ? 'FAQ를 찾을 수 없습니다' : 'FAQ를 추가해주세요'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ✅ 대화 관리 탭 */}
          {activeTab === 'conversations' && (
            <div className="space-y-6">
              {/* 필터 */}
              <div className="bg-white/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-lg shadow-gray-200/20 p-4 sm:p-6">
                <div className="flex flex-wrap gap-3">
                  <select
                    value={conversationFilters.status}
                    onChange={(e) => setConversationFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="px-4 py-2 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm"
                  >
                    <option value="all">전체 상태</option>
                    <option value="waiting">대기중</option>
                    <option value="in_progress">진행중</option>
                    <option value="resolved">해결됨</option>
                  </select>

                  <select
                    value={conversationFilters.channel}
                    onChange={(e) => setConversationFilters(prev => ({ ...prev, channel: e.target.value }))}
                    className="px-4 py-2 bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm"
                  >
                    <option value="all">전체 채널</option>
                    <option value="widget">웹 위젯</option>
                    <option value="naver">네이버톡톡</option>
                    <option value="kakao">카카오톡</option>
                  </select>
                </div>
              </div>

              {/* 대화 리스트 */}
              {conversationsData.length > 0 ? (
                <div className="space-y-4">
                  {conversationsData.map(conv => (
                    <ConversationCard
                      key={conv.id}
                      conversation={conv}
                      onDetail={() => fetchConversationDetail(conv.chatId || conv.id)}
                      onClose={() => setSelectedConversation(null)}
                      selectedConversation={selectedConversation}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-lg shadow-gray-200/20 p-8 sm:p-16 text-center">
                  <MessageSquare className="w-16 h-16 sm:w-20 sm:h-20 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-base sm:text-lg font-semibold">
                    대화 내역이 없습니다
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ✅ 업무카드 탭 */}
          {activeTab === 'tasks' && (
            <div className="space-y-6">
              {/* 업무 요약 */}
              {tasksData?.summary && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-orange-50 rounded-2xl p-4 text-center">
                    <div className="text-3xl font-bold text-orange-600">{tasksData.summary.pending || 0}</div>
                    <div className="text-sm text-gray-600 font-semibold">대기중</div>
                  </div>
                  <div className="bg-blue-50 rounded-2xl p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600">{tasksData.summary.inProgress || 0}</div>
                    <div className="text-sm text-gray-600 font-semibold">진행중</div>
                  </div>
                  <div className="bg-green-50 rounded-2xl p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">{tasksData.summary.completed || 0}</div>
                    <div className="text-sm text-gray-600 font-semibold">완료</div>
                  </div>
                </div>
              )}

              {/* 업무카드 리스트 */}
              {tasksData?.tasks && tasksData.tasks.length > 0 ? (
                <div className="space-y-3">
                  {tasksData.tasks.map(task => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              ) : (
                <div className="bg-white/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-lg shadow-gray-200/20 p-8 sm:p-16 text-center">
                  <AlertCircle className="w-16 h-16 sm:w-20 sm:h-20 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-base sm:text-lg font-semibold">
                    업무카드가 없습니다
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 통계 탭 (기존 유지, 모바일 최적화) */}
          {activeTab === 'stats' && (
            <div className="space-y-4">
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

          {/* FAQ 모달 (모바일 최적화) */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-yellow-200/30 max-w-2xl w-full max-h-[90vh] overflow-hidden">
                <div className="sticky top-0 bg-gradient-to-r from-yellow-100/80 to-amber-100/80 backdrop-blur-xl px-4 py-4 sm:px-6 sm:py-5 rounded-t-3xl">
                  <h2 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-yellow-700 to-amber-700 bg-clip-text text-transparent">
                    {editingItem ? 'FAQ 수정 ✏️' : '새 FAQ 추가 ✨'}
                  </h2>
                </div>
                <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto max-h-[calc(90vh-160px)]">
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
                            className="w-full px-3 py-2 sm:px-4 sm:py-3 bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none shadow-sm transition-all text-sm sm:text-base"
                            placeholder={`질문 ${index + 1}`}
                          />
                        </div>
                        {formData.questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeQuestion(index)}
                            className="p-2 text-red-600 hover:bg-red-50/70 rounded-xl transition-all"
                            title="이 질문 삭제"
                          >
                            <X className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addQuestion}
                      className="mt-2 flex items-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors text-xs sm:text-sm font-bold"
                    >
                      <Plus className="w-4 h-4" />
                      <span>질문 추가</span>
                    </button>

                    <p className="text-xs text-gray-500 mt-2">
                      💡 같은 답변에 여러 질문을 등록할 수 있습니다
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">답변 <span className="text-red-500">*</span></label>
                    <textarea 
                      value={formData.answer} 
                      onChange={(e) => setFormData({...formData, answer: e.target.value})} 
                      rows="4" 
                      className="w-full px-3 py-2 sm:px-4 sm:py-3 bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none resize-none shadow-sm transition-all text-sm sm:text-base" 
                      placeholder="AI가 고객에게 제공할 답변을 입력하세요" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">담당자 전달</label>
                    <select 
                      value={formData.staffHandoff} 
                      onChange={(e) => setFormData({...formData, staffHandoff: e.target.value})} 
                      className="w-full px-3 py-2 sm:px-4 sm:py-3 bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none shadow-sm transition-all text-sm sm:text-base"
                    >
                      <option value="필요없음">필요없음</option>
                      <option value="전달필요">전달필요</option>
                      <option value="조건부전달">조건부전달</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">가이드 (선택)</label>
                    <input 
                      type="text" 
                      value={formData.guide} 
                      onChange={(e) => setFormData({...formData, guide: e.target.value})} 
                      className="w-full px-3 py-2 sm:px-4 sm:py-3 bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none shadow-sm transition-all text-sm sm:text-base" 
                      placeholder="답변 생성 시 추가 주의사항" 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">핵심 데이터 (선택)</label>
                    <input 
                      type="text" 
                      value={formData.keyData} 
                      onChange={(e) => setFormData({...formData, keyData: e.target.value})} 
                      className="w-full px-3 py-2 sm:px-4 sm:py-3 bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none shadow-sm transition-all text-sm sm:text-base" 
                      placeholder="전화번호, 링크 등 변형되어선 안되는 고정값" 
                    />
                  </div>

                  {currentPlanConfig?.hasExpiryDate && (
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        만료일 (선택)
                        <span className="ml-2 text-xs bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 px-2 py-1 rounded-full font-bold">
                          <Crown className="inline w-3 h-3 mr-1" />{currentPlanConfig.name} 전용
                        </span>
                      </label>
                      <div className="relative">
                        <input 
                          type="date" 
                          value={formData.expiryDate} 
                          onChange={(e) => setFormData({...formData, expiryDate: e.target.value})} 
                          className="w-full px-3 py-2 sm:px-4 sm:py-3 bg-white/70 backdrop-blur-sm rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none shadow-sm transition-all text-sm sm:text-base" 
                        />
                        <Calendar className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 pointer-events-none" />
                      </div>
                      <p className="text-xs text-gray-600 mt-2 font-semibold">휴가 일정 등 기간 한정 정보에 활용하세요</p>
                    </div>
                  )}

                  <div className="flex space-x-3 pt-4">
                    <button 
                      onClick={closeModal} 
                      className="flex-1 px-4 py-2.5 sm:px-6 sm:py-3 bg-gray-100/70 backdrop-blur-sm text-gray-700 rounded-xl sm:rounded-2xl hover:bg-gray-200/70 transition-all font-bold text-sm sm:text-base"
                    >
                      취소
                    </button>
                    <button 
                      onClick={handleSubmit} 
                      disabled={isLoading} 
                      className="flex-1 px-4 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-yellow-400 via-yellow-300 to-amber-400 text-gray-800 rounded-xl sm:rounded-2xl hover:shadow-xl hover:shadow-yellow-400/40 hover:scale-105 transition-all font-bold disabled:opacity-50 shadow-lg shadow-yellow-400/30 text-sm sm:text-base"
                    >
                      {editingItem ? '수정 완료 ✓' : '추가 ✨'}
                    </button>
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
    </div>
  );
}

// ✅ 대화 카드 컴포넌트
function ConversationCard({ conversation, onDetail, onClose, selectedConversation }) {
  const [expanded, setExpanded] = React.useState(false);

  const handleClick = () => {
    if (!expanded) {
      onDetail();
    }
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
      {expanded && selectedConversation && (
        (selectedConversation.conversation?.chatId === conversation.chatId ||
         selectedConversation.conversation?.id === conversation.id) && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">대화 내용</h3>
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(false); onClose(); }}
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
      ))}
    </div>
  );
}

// ✅ 업무카드 컴포넌트
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