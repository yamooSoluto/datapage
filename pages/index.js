import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, LogOut, Database, TrendingUp, Clock, AlertCircle, Crown, Calendar, BarChart3, Users, MessageSquare, Zap, Building2, ChevronDown, X, Copy, Check, ChevronLeft, ChevronRight, Settings, ExternalLink, BookOpen } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import ConversationsPage from '../components/ConversationsPage';

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
  trial: 'bg-green-50 text-green-700 border border-green-200',
  starter: 'bg-blue-50 text-blue-700 border border-blue-200',
  pro: 'bg-purple-50 text-purple-700 border border-purple-200',
  business: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  enterprise: 'bg-pink-50 text-pink-700 border border-pink-200',
};

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

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
  const [canDismissOnboarding, setCanDismissOnboarding] = useState(false);

  const [activeTab, setActiveTab] = useState('faq');
  const [faqData, setFaqData] = useState([]);
  const [statsData, setStatsData] = useState(null);

  const [tasksData, setTasksData] = useState({ tasks: [], summary: {} });

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

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

      const shouldShowOnboarding = !data.onboardingDismissed && (data.faqCount === 0 || data.showOnboarding);
      setShowOnboarding(shouldShowOnboarding);
      setCanDismissOnboarding(true);

      fetchFaqData(data.id);
      fetchStatsData(data.id);
    } catch (error) {
      console.error('❌ [Auth] 테넌트 조회 에러:', error);
      localStorage.removeItem('userEmail');
      localStorage.removeItem('tenantId');
      localStorage.removeItem('magicLogin');
    } finally {
      setIsLoading(false);
    }
  }

  async function verifyToken(token) {
    setIsLoading(true);
    try {
      const res = await fetch('/api/data/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await res.json();

      if (data?.error) {
        setLoginError(data.error);
        setIsLoading(false);
        return;
      }

      setCurrentTenant(data);
      setIsLoggedIn(true);

      localStorage.setItem('userEmail', data.email);
      localStorage.setItem('tenantId', data.id);
      localStorage.setItem('magicLogin', 'true');

      const shouldShowOnboarding = !data.onboardingDismissed && (data.faqCount === 0 || data.showOnboarding);
      setShowOnboarding(shouldShowOnboarding);
      setCanDismissOnboarding(true);

      window.history.replaceState({}, document.title, window.location.pathname);

      fetchFaqData(data.id);
      fetchStatsData(data.id);
    } catch (error) {
      console.error('❌ [Auth] 토큰 검증 에러:', error);
      setLoginError('로그인에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/data/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await res.json();

      if (data?.error) {
        setLoginError(data.error);
        return;
      }

      alert('이메일로 로그인 링크를 발송했습니다. 메일함을 확인해주세요.');
      setEmail('');
    } catch (error) {
      console.error('❌ 매직링크 발송 에러:', error);
      setLoginError('로그인 링크 발송에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  const fetchFaqData = async (tenantId) => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/data/list?tenant=${tenantId}`);
      const data = await res.json();
      setFaqData(data.items || []);
    } catch (error) {
      console.error('❌ FAQ 데이터 로드 실패:', error);
    }
  };

  const fetchStatsData = async (tenantId) => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/data/stats?tenant=${tenantId}&days=${dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90}`);
      const data = await res.json();
      setStatsData(data);
    } catch (error) {
      console.error('❌ 통계 데이터 로드 실패:', error);
    }
  };

  const fetchTasksData = async (tenantId) => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/data/tasks?tenant=${tenantId}`);
      const data = await res.json();
      setTasksData(data || { tasks: [], summary: {} });
    } catch (error) {
      console.error('❌ 업무카드 데이터 로드 실패:', error);
    }
  };

  useEffect(() => {
    if (currentTenant?.id && activeTab === 'stats') {
      fetchStatsData(currentTenant.id);
    }
  }, [activeTab, dateRange, currentTenant]);

  useEffect(() => {
    if (currentTenant?.id && activeTab === 'tasks') {
      fetchTasksData(currentTenant.id);
    }
  }, [activeTab, currentTenant]);

  const openModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        questions: item.questions || [''],
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
  };

  const closeModal = () => {
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
  };

  const handleSubmit = async () => {
    if (formData.questions.every(q => !q.trim()) || !formData.answer.trim()) {
      alert('질문과 답변은 필수 항목입니다.');
      return;
    }

    const filteredQuestions = formData.questions.filter(q => q.trim());
    if (filteredQuestions.length === 0) {
      alert('최소 1개의 질문을 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = editingItem ? '/api/data/update' : '/api/data/add';
      const payload = {
        tenant: currentTenant.id,
        questions: filteredQuestions,
        answer: formData.answer,
        staffHandoff: formData.staffHandoff,
        guide: formData.guide || null,
        keyData: formData.keyData || null,
        expiryDate: formData.expiryDate || null
      };

      if (editingItem) {
        payload.id = editingItem.id;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data?.error) {
        alert(`오류: ${data.error}`);
        return;
      }

      alert(editingItem ? 'FAQ가 수정되었습니다!' : 'FAQ가 추가되었습니다!');
      closeModal();
      fetchFaqData(currentTenant.id);

      if (!editingItem && showOnboarding) {
        setCanDismissOnboarding(true);
      }
    } catch (error) {
      console.error('❌ FAQ 저장 에러:', error);
      alert('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/data/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant: currentTenant.id, id })
      });

      const data = await res.json();
      if (data?.error) {
        alert(`오류: ${data.error}`);
        return;
      }

      alert('FAQ가 삭제되었습니다!');
      fetchFaqData(currentTenant.id);
    } catch (error) {
      console.error('❌ FAQ 삭제 에러:', error);
      alert('삭제에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('tenantId');
    localStorage.removeItem('magicLogin');
    setIsLoggedIn(false);
    setCurrentTenant(null);
    setEmail('');
    setLoginError('');
  };

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return faqData;
    const query = searchTerm.toLowerCase();
    return faqData.filter(item =>
      item.questions?.some(q => q.toLowerCase().includes(query)) ||
      item.answer?.toLowerCase().includes(query)
    );
  }, [faqData, searchTerm]);

  const dismissOnboarding = async () => {
    if (!canDismissOnboarding) {
      alert('먼저 FAQ를 1개 이상 작성해주세요!');
      return;
    }

    try {
      await fetch('/api/data/dismiss-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant: currentTenant.id })
      });
      setShowOnboarding(false);
    } catch (error) {
      console.error('❌ 온보딩 닫기 에러:', error);
    }
  };

  const copyToClipboard = (text, setter) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* 로고 */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 bg-yellow-400 rounded-2xl flex items-center justify-center">
              <Zap className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">YAMU</h1>
            <p className="text-sm text-gray-500">AI 고객 상담 자동화</p>
          </div>

          {/* 로그인 카드 */}
          <div className="bg-white rounded-2xl p-8 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">로그인</h2>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이메일
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                  required
                />
              </div>

              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{loginError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-3 bg-yellow-400 text-gray-900 rounded-xl font-semibold hover:bg-yellow-500 transition-colors disabled:opacity-50"
              >
                {isLoading ? '전송 중...' : '로그인 링크 받기'}
              </button>
            </form>

            <p className="text-xs text-gray-500 text-center mt-6">
              이메일로 전송된 링크를 클릭하여 로그인하세요
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* 로고 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">YAMU</h1>
                <p className="text-xs text-gray-500">{currentTenant?.name || '관리 포털'}</p>
              </div>
            </div>

            {/* 우측 메뉴 */}
            <div className="flex items-center gap-3">
              {/* 플랜 배지 */}
              {currentTenant?.plan && (
                <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${PLAN_BADGE_CLASS[currentTenant.plan.toLowerCase()] || PLAN_BADGE_CLASS.trial}`}>
                  {currentPlanConfig.name}
                </div>
              )}

              {/* 설정 메뉴 */}
              <div className="relative">
                <button
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Settings className="w-5 h-5" />
                </button>

                {showSettingsMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50">
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex gap-1 -mb-px">
            <button
              onClick={() => setActiveTab('faq')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'faq'
                ? 'border-yellow-400 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                FAQ 관리
              </div>
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'stats'
                ? 'border-yellow-400 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                통계
              </div>
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'tasks'
                ? 'border-yellow-400 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                업무카드
                {tasksData.summary?.total > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {tasksData.summary.total}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('conversations')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'conversations'
                ? 'border-yellow-400 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                대화 목록
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 구독 만료 경고 */}
        {subscriptionInfo?.isExpiringSoon && !subscriptionInfo.isExpired && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-yellow-900">구독 만료 임박</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  {subscriptionInfo.daysLeft}일 후 구독이 만료됩니다. 서비스 연장을 원하시면 문의해주세요.
                </p>
              </div>
            </div>
          </div>
        )}

        {subscriptionInfo?.isExpired && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-red-900">구독 만료</h3>
                <p className="text-sm text-red-700 mt-1">
                  구독이 만료되었습니다. 서비스를 계속 이용하시려면 문의해주세요.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* FAQ 탭 */}
        {activeTab === 'faq' && (
          <div className="space-y-6">
            {/* 통계 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">총 FAQ</p>
                    <p className="text-3xl font-bold text-gray-900">{faqStats.total}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Database className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                {currentPlanConfig.maxFAQs !== Infinity && (
                  <p className="text-xs text-gray-500 mt-3">
                    최대 {currentPlanConfig.maxFAQs}개
                  </p>
                )}
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">만료된 FAQ</p>
                    <p className="text-3xl font-bold text-gray-900">{faqStats.expired}</p>
                  </div>
                  <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">담당자 전달 필요</p>
                    <p className="text-3xl font-bold text-gray-900">{faqStats.needStaff}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* 검색 & 추가 버튼 */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="FAQ 검색..."
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => openModal()}
                disabled={currentPlanConfig.maxFAQs !== Infinity && faqData.length >= currentPlanConfig.maxFAQs}
                className="px-6 py-3 bg-yellow-400 text-gray-900 rounded-xl font-semibold hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-5 h-5" />
                FAQ 추가
              </button>
            </div>

            {/* FAQ 리스트 */}
            <div className="space-y-3">
              {filteredData.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
                  <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {searchTerm ? '검색 결과가 없습니다' : 'FAQ를 추가해보세요'}
                  </p>
                </div>
              ) : (
                filteredData.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* 질문들 */}
                        <div className="mb-3">
                          {item.questions?.map((q, idx) => (
                            <div key={idx} className="flex items-start gap-2 mb-2">
                              <span className="text-gray-400 text-sm flex-shrink-0">Q{idx + 1}</span>
                              <p className="text-gray-900 font-medium">{q}</p>
                            </div>
                          ))}
                        </div>

                        {/* 답변 */}
                        <div className="mb-4">
                          <p className="text-sm text-gray-600 line-clamp-2">{item.answer}</p>
                        </div>

                        {/* 메타 정보 */}
                        <div className="flex flex-wrap gap-2">
                          {item.staffHandoff && item.staffHandoff !== '필요없음' && (
                            <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-md border border-purple-200">
                              {item.staffHandoff}
                            </span>
                          )}
                          {item.expiryDate && (
                            <span className={`px-2 py-1 text-xs rounded-md border ${new Date(item.expiryDate) < new Date()
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-gray-50 text-gray-700 border-gray-200'
                              }`}>
                              {new Date(item.expiryDate) < new Date() ? '만료됨' : `${item.expiryDate}까지`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => openModal(item)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 통계 탭 */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            {/* 기간 선택 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDateRange('7d')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateRange === '7d'
                  ? 'bg-yellow-400 text-gray-900'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                  }`}
              >
                최근 7일
              </button>
              <button
                onClick={() => setDateRange('30d')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateRange === '30d'
                  ? 'bg-yellow-400 text-gray-900'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                  }`}
              >
                최근 30일
              </button>
              <button
                onClick={() => setDateRange('90d')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateRange === '90d'
                  ? 'bg-yellow-400 text-gray-900'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                  }`}
              >
                최근 90일
              </button>
            </div>

            {/* 차트 영역 */}
            {statsData ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 일별 대화 수 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">일별 대화 수</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={statsData.dailyChats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* 채널별 분포 */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">채널별 분포</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statsData.byChannel}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statsData.byChannel.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
                <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">통계 데이터를 불러오는 중...</p>
              </div>
            )}
          </div>
        )}

        {/* 업무카드 탭 */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            {/* 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">전체 업무</p>
                    <p className="text-3xl font-bold text-gray-900">{tasksData.summary?.total || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">긴급</p>
                    <p className="text-3xl font-bold text-red-600">{tasksData.summary?.high || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">일반</p>
                    <p className="text-3xl font-bold text-gray-900">{tasksData.summary?.normal || 0}</p>
                  </div>
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-gray-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* 업무 리스트 */}
            <div className="space-y-3">
              {tasksData.tasks && tasksData.tasks.length > 0 ? (
                tasksData.tasks.map((task, idx) => (
                  <TaskCard key={idx} task={task} />
                ))
              ) : (
                <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
                  <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">업무가 없습니다</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 대화 목록 탭 */}
        {activeTab === 'conversations' && currentTenant?.id && (
          <ConversationsPage tenantId={currentTenant.id} />
        )}
      </main>


      {/* ✅ 개선된 온보딩 모달 - 웹사이트 디자인 일관성 */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-200">
            {/* 헤더 */}
            <div className="relative p-8 text-center">
              {/* 닫기 버튼 (오른쪽 상단) */}
              {canDismissOnboarding && (
                <button
                  onClick={dismissOnboarding}
                  className="absolute top-4 right-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}

              {/* 로고 아이콘 */}
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl shadow-lg mb-6">
                <Zap className="w-10 h-10 text-white" />
              </div>

              {/* ✅ 제목 - 줄바꿈 수정 */}
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                YAMU에 오신 것을
                <br />
                환영합니다!
              </h2>

              <p className="text-gray-600 leading-relaxed">
                AI 챗봇 설정을 시작해볼까요?
              </p>
            </div>

            {/* 단계 카드 */}
            <div className="px-8 pb-8 space-y-3">
              {/* 1. FAQ 추가 */}
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200 hover:border-gray-300 transition-all">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                    <span className="text-lg font-bold text-gray-900">1</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      FAQ 추가
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      자주 묻는 질문과 답변을 등록하세요
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. 채널 연동 */}
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200 hover:border-gray-300 transition-all">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                    <span className="text-lg font-bold text-gray-900">2</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      채널 연동
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      네이버톡톡, 카카오톡 등을 연결하세요
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. 테스트 */}
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200 hover:border-gray-300 transition-all">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                    <span className="text-lg font-bold text-gray-900">3</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      테스트
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      챗봇이 잘 작동하는지 확인하세요
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ✅ 시작하기 버튼 - 작동 보장 */}
            <div className="px-8 pb-8">
              <button
                onClick={dismissOnboarding}
                disabled={!canDismissOnboarding}
                className="w-full px-6 py-4 bg-gray-900 text-white rounded-2xl font-semibold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAQ 추가/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* 헤더 */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingItem ? 'FAQ 수정' : 'FAQ 추가'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 폼 */}
            <div className="p-6 space-y-6">
              {/* 질문 */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  질문 <span className="text-red-500">*</span>
                </label>

                {formData.questions.map((question, index) => (
                  <div key={index} className="flex items-start gap-2 mb-3">
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => updateQuestion(index, e.target.value)}
                      className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                      placeholder={`질문 ${index + 1}`}
                    />
                    {formData.questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeQuestion(index)}
                        className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addQuestion}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  질문 추가
                </button>

                <p className="text-xs text-gray-500 mt-2">
                  같은 답변에 여러 질문을 등록할 수 있습니다
                </p>
              </div>

              {/* 답변 */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  답변 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  rows="4"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none"
                  placeholder="AI가 고객에게 제공할 답변을 입력하세요"
                />
              </div>

              {/* 담당자 전달 */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  담당자 전달
                </label>
                <select
                  value={formData.staffHandoff}
                  onChange={(e) => setFormData({ ...formData, staffHandoff: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                >
                  <option value="필요없음">필요없음</option>
                  <option value="전달필요">전달필요</option>
                  <option value="조건부전달">조건부전달</option>
                </select>
              </div>

              {/* 가이드 */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  가이드 (선택)
                </label>
                <input
                  type="text"
                  value={formData.guide}
                  onChange={(e) => setFormData({ ...formData, guide: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  placeholder="답변 생성 시 추가 주의사항"
                />
              </div>

              {/* 핵심 데이터 */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  핵심 데이터 (선택)
                </label>
                <input
                  type="text"
                  value={formData.keyData}
                  onChange={(e) => setFormData({ ...formData, keyData: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  placeholder="전화번호, 링크 등 변형되어선 안되는 고정값"
                />
              </div>

              {/* 만료일 (Pro 이상) */}
              {currentPlanConfig?.hasExpiryDate && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    만료일 (선택)
                    <span className="ml-2 px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-md border border-purple-200">
                      <Crown className="inline w-3 h-3 mr-1" />
                      {currentPlanConfig.name} 전용
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    />
                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    휴가 일정 등 기간 한정 정보에 활용하세요
                  </p>
                </div>
              )}

              {/* 버튼 */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-yellow-400 text-gray-900 rounded-xl font-semibold hover:bg-yellow-500 transition-colors disabled:opacity-50"
                >
                  {editingItem ? '수정 완료' : '추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 업무카드 컴포넌트
function TaskCard({ task }) {
  const channelBadge = {
    widget: 'bg-blue-50 text-blue-700 border border-blue-200',
    naver: 'bg-green-50 text-green-700 border border-green-200',
    kakao: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  }[task.channel] || 'bg-gray-50 text-gray-700 border border-gray-200';

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-semibold text-gray-900">{task.userName}</span>
            <span className={`px-2 py-1 rounded-md text-xs font-medium ${channelBadge}`}>
              {task.channel}
            </span>
            {task.priority === 'high' && (
              <span className="px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs font-medium">
                긴급
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-3">{task.lastMessage}</p>
          <p className="text-xs text-gray-400">
            {task.lastMessageAt ? new Date(task.lastMessageAt).toLocaleString('ko-KR') : '-'}
          </p>
        </div>
        {task.slackUrl && (
          <a
            href={task.slackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors font-medium flex items-center gap-2 flex-shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
            슬랙에서 보기
          </a>
        )}
      </div>
    </div>
  );
}