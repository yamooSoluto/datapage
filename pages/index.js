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

// ✅ 애플 스타일 배지 클래스 (진한 텍스트로 가독성 개선)
const PLAN_BADGE_CLASS = {
  trial: 'bg-green-50 text-green-800 border border-green-300',
  starter: 'bg-blue-50 text-blue-800 border border-blue-300',
  pro: 'bg-purple-50 text-purple-800 border border-purple-300',
  business: 'bg-indigo-50 text-indigo-800 border border-indigo-300',
  enterprise: 'bg-pink-50 text-pink-800 border border-pink-300',
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

  // ✅ 온보딩 관련
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

  // [나머지 함수들은 동일하게 유지...]
  // fetchTenantByEmail, verifyToken, sendMagicLink, handleLogout 등

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

      if (data?.tenants && data.tenants.length > 1) {
        setAvailableTenants(data.tenants);
        setShowTenantSelector(true);
        localStorage.setItem('userEmail', data.email);
        setIsLoading(false);
        return;
      }

      if (data?.tenant) {
        setCurrentTenant(data.tenant);
        setIsLoggedIn(true);

        localStorage.setItem('userEmail', data.email);
        localStorage.setItem('tenantId', data.tenant.id);
        localStorage.setItem('magicLogin', 'true');

        const shouldShowOnboarding = !data.tenant.onboardingDismissed && (data.tenant.faqCount === 0 || data.tenant.showOnboarding);
        setShowOnboarding(shouldShowOnboarding);
        setCanDismissOnboarding(true);

        window.history.replaceState({}, document.title, window.location.pathname);

        fetchFaqData(data.tenant.id);
        fetchStatsData(data.tenant.id);
      }
    } catch (error) {
      console.error('❌ [Auth] 토큰 검증 실패:', error);
      setLoginError('로그인 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  async function sendMagicLink(e) {
    e.preventDefault();
    if (!email.trim()) {
      setLoginError('이메일을 입력해주세요');
      return;
    }

    setIsLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/data/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (data.error) {
        setLoginError(data.error);
      } else {
        alert('✅ 이메일이 발송되었습니다! 받은편지함을 확인해주세요.');
        setEmail('');
      }
    } catch (error) {
      console.error('❌ [MagicLink] 전송 실패:', error);
      setLoginError('이메일 전송 중 오류가 발생했습니다');
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
    setTasksData({ tasks: [], summary: {} });
    setActiveTab('faq');
    console.log('✅ 로그아웃 완료');
  }

  function selectTenant(tenant) {
    setCurrentTenant(tenant);
    setIsLoggedIn(true);
    setShowTenantSelector(false);

    localStorage.setItem('tenantId', tenant.id);
    localStorage.setItem('magicLogin', 'true');

    const shouldShowOnboarding = !tenant.onboardingDismissed && (tenant.faqCount === 0 || tenant.showOnboarding);
    setShowOnboarding(shouldShowOnboarding);
    setCanDismissOnboarding(true);

    fetchFaqData(tenant.id);
    fetchStatsData(tenant.id);
  }

  async function dismissOnboarding() {
    if (!currentTenant?.id || !canDismissOnboarding) return;

    try {
      const res = await fetch('/api/data/dismiss-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: currentTenant.id })
      });

      const data = await res.json();
      if (!data.error) {
        setShowOnboarding(false);
        setCurrentTenant(prev => ({ ...prev, onboardingDismissed: true }));
      }
    } catch (error) {
      console.error('❌ 온보딩 해제 실패:', error);
    }
  }

  async function fetchFaqData(tenantId) {
    try {
      const res = await fetch(`/api/data/list-faq?tenantId=${tenantId}`);
      const data = await res.json();
      setFaqData(data.faqs || []);
    } catch (error) {
      console.error('❌ FAQ 조회 실패:', error);
    }
  }

  async function fetchStatsData(tenantId) {
    try {
      const res = await fetch(`/api/data/stats?tenantId=${tenantId}&range=${dateRange}`);
      const data = await res.json();
      setStatsData(data);
    } catch (error) {
      console.error('❌ 통계 조회 실패:', error);
    }
  }

  async function fetchTasksData(tenantId) {
    try {
      const res = await fetch(`/api/data/tasks?tenantId=${tenantId}`);
      const data = await res.json();
      setTasksData(data);
    } catch (error) {
      console.error('❌ 업무 조회 실패:', error);
    }
  }

  useEffect(() => {
    if (activeTab === 'stats' && currentTenant) {
      fetchStatsData(currentTenant.id);
    } else if (activeTab === 'tasks' && currentTenant) {
      fetchTasksData(currentTenant.id);
    }
  }, [activeTab, dateRange, currentTenant]);

  const filteredFaqData = useMemo(() => {
    if (!searchTerm) return faqData;
    return faqData.filter(item =>
      item.questions.some(q => q.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.answer.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [faqData, searchTerm]);

  function openModal(item = null) {
    if (item) {
      setEditingItem(item);
      setFormData({
        questions: [...item.questions],
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
  }

  async function handleSubmit() {
    const validQuestions = formData.questions.filter(q => q.trim());
    if (validQuestions.length === 0) {
      alert('최소 1개의 질문이 필요합니다');
      return;
    }
    if (!formData.answer.trim()) {
      alert('답변을 입력해주세요');
      return;
    }

    if (!currentPlanConfig.hasExpiryDate && formData.expiryDate) {
      alert(`만료일 설정은 Pro 이상 플랜에서 사용 가능합니다.\n현재 플랜: ${currentPlanConfig.name}`);
      return;
    }

    const method = editingItem ? 'PUT' : 'POST';
    const endpoint = '/api/data/upsert-faq';

    const payload = {
      tenantId: currentTenant.id,
      questions: validQuestions,
      answer: formData.answer.trim(),
      staffHandoff: formData.staffHandoff,
      guide: formData.guide?.trim() || null,
      keyData: formData.keyData?.trim() || null,
      expiryDate: formData.expiryDate || null,
      ...(editingItem && { docId: editingItem.id })
    };

    setIsLoading(true);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result.error) {
        alert(result.error);
      } else {
        await fetchFaqData(currentTenant.id);
        closeModal();
      }
    } catch (error) {
      console.error('❌ FAQ 저장 실패:', error);
      alert('저장 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(docId) {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/data/delete-faq', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: currentTenant.id, docId })
      });

      const result = await res.json();
      if (result.error) {
        alert(result.error);
      } else {
        await fetchFaqData(currentTenant.id);
      }
    } catch (error) {
      console.error('❌ FAQ 삭제 실패:', error);
      alert('삭제 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🎨 로그인 화면 (애플 스타일)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* ✅ 잔잔한 솜사탕 그라데이션 배경 */}
        <div className="absolute inset-0 bg-gradient-to-br from-pink-50 via-white to-purple-50" />

        {/* 로그인 컨텐츠 */}
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            {/* 로고/타이틀 */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
                <Zap className="w-8 h-8 text-yellow-500" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                YAMU 관리자
              </h1>
              <p className="text-gray-600">
                이메일로 간편하게 로그인하세요
              </p>
            </div>

            {/* 로그인 카드 */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-200 p-8">
              <form onSubmit={sendMagicLink} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    이메일
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    disabled={isLoading}
                  />
                </div>

                {loginError && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-800">{loginError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? '처리 중...' : '로그인 링크 받기'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-600">
                입력하신 이메일로 로그인 링크를 보내드립니다
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🎨 테넌트 선택 화면 (애플 스타일)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (showTenantSelector) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* ✅ 잔잔한 솜사탕 그라데이션 배경 */}
        <div className="absolute inset-0 bg-gradient-to-br from-pink-50 via-white to-purple-50" />

        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                관리할 계정을 선택하세요
              </h1>
              <p className="text-gray-600">
                여러 계정이 연결되어 있습니다
              </p>
            </div>

            <div className="space-y-3">
              {availableTenants.map(tenant => (
                <button
                  key={tenant.id}
                  onClick={() => selectTenant(tenant)}
                  className="w-full p-6 bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200 hover:border-gray-300 hover:shadow-xl transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {tenant.branchName || tenant.id}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {tenant.email}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium ${PLAN_BADGE_CLASS[tenant.plan?.toLowerCase()] || PLAN_BADGE_CLASS.trial}`}>
                          {tenant.plan || 'Trial'}
                        </span>
                        <span className="text-xs text-gray-500">
                          FAQ {tenant.faqCount || 0}개
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🎨 메인 대시보드 (애플 스타일)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className="min-h-screen relative">
      {/* ✅ 잔잔한 솜사탕 그라데이션 배경 */}
      <div className="fixed inset-0 bg-gradient-to-br from-pink-50 via-white to-purple-50 -z-10" />

      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* 로고 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  YAMU
                </h1>
                <p className="text-xs text-gray-600">
                  {currentTenant?.branchName || '관리 포탈'}
                </p>
              </div>
            </div>

            {/* 플랜 배지 + 설정 */}
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${PLAN_BADGE_CLASS[currentTenant?.plan?.toLowerCase()] || PLAN_BADGE_CLASS.trial}`}>
                {currentTenant?.plan || 'Trial'}
              </span>

              {/* 설정 메뉴 */}
              <div className="relative">
                <button
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <Settings className="w-5 h-5" />
                </button>

                {showSettingsMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-200 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">{currentTenant?.email}</p>
                      <p className="text-xs text-gray-500 mt-1">ID: {currentTenant?.id?.slice(0, 20)}...</p>
                    </div>

                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 온보딩 모달 (필요시) */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl">
            {/* 온보딩 내용 - 간소화 */}
            <div className="p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-yellow-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  YAMU에 오신 것을 환영합니다!
                </h2>
                <p className="text-gray-600">
                  AI 챗봇 설정을 시작해볼까요?
                </p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-semibold text-gray-900 mb-2">1. FAQ 추가</h3>
                  <p className="text-sm text-gray-600">자주 묻는 질문과 답변을 등록하세요</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-semibold text-gray-900 mb-2">2. 채널 연동</h3>
                  <p className="text-sm text-gray-600">네이버톡톡, 카카오톡 등을 연결하세요</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-semibold text-gray-900 mb-2">3. 테스트</h3>
                  <p className="text-sm text-gray-600">챗봇이 잘 작동하는지 확인하세요</p>
                </div>
              </div>

              <button
                onClick={dismissOnboarding}
                className="w-full px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
              >
                시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 탭 네비게이션 */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'faq', label: 'FAQ 관리', icon: BookOpen },
            { id: 'conversations', label: '대화 내역', icon: MessageSquare },
            { id: 'stats', label: '통계', icon: BarChart3 },
            { id: 'tasks', label: '업무', icon: Users },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all flex-shrink-0 ${activeTab === tab.id
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-white/80 text-gray-700 hover:bg-white border border-gray-200'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* FAQ 탭 */}
        {activeTab === 'faq' && (
          <div className="space-y-6">
            {/* 통계 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">전체 FAQ</span>
                  <Database className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">{faqStats.total}</p>
                <p className="text-xs text-gray-600 mt-1">
                  최대 {currentPlanConfig.maxFAQs === Infinity ? '무제한' : currentPlanConfig.maxFAQs}개
                </p>
              </div>

              <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">만료 예정</span>
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">{faqStats.expired}</p>
                <p className="text-xs text-gray-600 mt-1">업데이트 필요</p>
              </div>

              <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">담당자 전달</span>
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">{faqStats.needStaff}</p>
                <p className="text-xs text-gray-600 mt-1">주의 필요</p>
              </div>
            </div>

            {/* 검색 + 추가 */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="FAQ 검색..."
                  className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
              <button
                onClick={() => openModal()}
                disabled={faqStats.total >= currentPlanConfig.maxFAQs}
                className="px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                FAQ 추가
              </button>
            </div>

            {/* FAQ 리스트 */}
            <div className="space-y-3">
              {filteredFaqData.length === 0 ? (
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 p-12 text-center">
                  <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium mb-2">
                    {searchTerm ? '검색 결과가 없습니다' : 'FAQ를 추가해주세요'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {searchTerm ? '다른 키워드로 검색해보세요' : '첫 FAQ를 추가하고 AI 챗봇을 시작하세요'}
                  </p>
                </div>
              ) : (
                filteredFaqData.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 p-6 hover:border-gray-300 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          {item.questions.map((q, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium"
                            >
                              {q}
                            </span>
                          ))}
                        </div>

                        <p className="text-gray-700 mb-3 leading-relaxed">
                          {item.answer}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {item.staffHandoff && item.staffHandoff !== '필요없음' && (
                            <span className="px-2 py-1 bg-orange-50 text-orange-800 border border-orange-200 rounded-md font-medium">
                              담당자 전달: {item.staffHandoff}
                            </span>
                          )}
                          {item.expiryDate && (
                            <span className={`px-2 py-1 rounded-md font-medium ${new Date(item.expiryDate) < new Date()
                              ? 'bg-red-50 text-red-800 border border-red-200'
                              : 'bg-green-50 text-green-800 border border-green-200'
                              }`}>
                              만료: {item.expiryDate}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => openModal(item)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

        {/* 대화 내역 탭 */}
        {activeTab === 'conversations' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-gray-200 p-6">
            <ConversationsPage tenantId={currentTenant?.id} />
          </div>
        )}

        {/* 통계 탭 */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 p-6">
              <p className="text-gray-700">통계 데이터 준비 중...</p>
            </div>
          </div>
        )}

        {/* 업무 탭 */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {tasksData.tasks.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 p-12 text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-700 font-medium">
                  업무가 없습니다
                </p>
              </div>
            ) : (
              tasksData.tasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))
            )}
          </div>
        )}
      </main>

      {/* FAQ 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            {/* 헤더 */}
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingItem ? 'FAQ 수정' : 'FAQ 추가'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 폼 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 질문 */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  질문 <span className="text-red-600">*</span>
                </label>

                {formData.questions.map((question, index) => (
                  <div key={index} className="flex items-start gap-2 mb-3">
                    <input
                      type="text"
                      value={question}
                      onChange={(e) => updateQuestion(index, e.target.value)}
                      className="flex-1 px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
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
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  질문 추가
                </button>

                <p className="text-xs text-gray-600 mt-2">
                  같은 답변에 여러 질문을 등록할 수 있습니다
                </p>
              </div>

              {/* 답변 */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  답변 <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  rows="4"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all"
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
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
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
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
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
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="전화번호, 링크 등 변형되어선 안되는 고정값"
                />
              </div>

              {/* 만료일 (Pro 이상) */}
              {currentPlanConfig?.hasExpiryDate && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    만료일 (선택)
                    <span className="ml-2 px-2 py-1 bg-purple-50 text-purple-800 text-xs rounded-md border border-purple-300 font-semibold">
                      <Crown className="inline w-3 h-3 mr-1" />
                      {currentPlanConfig.name} 전용
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    휴가 일정 등 기간 한정 정보에 활용하세요
                  </p>
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-800 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingItem ? '수정 완료' : '추가'}
              </button>
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
    widget: 'bg-blue-50 text-blue-800 border border-blue-300',
    naver: 'bg-green-50 text-green-800 border border-green-300',
    kakao: 'bg-yellow-50 text-yellow-800 border border-yellow-300',
  }[task.channel] || 'bg-gray-50 text-gray-800 border border-gray-300';

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200 p-6 hover:border-gray-300 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-semibold text-gray-900">{task.userName}</span>
            <span className={`px-2 py-1 rounded-md text-xs font-semibold ${channelBadge}`}>
              {task.channel}
            </span>
            {task.priority === 'high' && (
              <span className="px-2 py-1 bg-red-50 text-red-800 border border-red-300 rounded-md text-xs font-semibold">
                긴급
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 mb-3 leading-relaxed">{task.lastMessage}</p>
          <p className="text-xs text-gray-600">
            {task.lastMessageAt ? new Date(task.lastMessageAt).toLocaleString('ko-KR') : '-'}
          </p>
        </div>
        {task.slackUrl && (
          <a
            href={task.slackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-800 transition-colors font-semibold flex items-center gap-2 flex-shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
            슬랙에서 보기
          </a>
        )}
      </div>
    </div>
  );
}