console.log('🚀 페이지 로드됨!', new Date().toISOString());

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, LogOut, Database, TrendingUp, Clock, AlertCircle, Crown, Calendar, BarChart3, Users, MessageSquare, Zap } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

// 플랜 설정
const PLAN_CONFIG = {
  trial: { name: 'Trial', maxFAQs: 100, hasExpiryDate: false, color: 'green' },
  starter: { name: 'Starter', maxFAQs: 100, hasExpiryDate: false, color: 'blue' },
  pro: { name: 'Pro', maxFAQs: Infinity, hasExpiryDate: true, color: 'purple' },
  business: { name: 'Business', maxFAQs: Infinity, hasExpiryDate: true, color: 'indigo' },
  enterprise: { name: 'Enterprise', maxFAQs: Infinity, hasExpiryDate: true, color: 'pink' }
};

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

export default function TenantPortal() {
  console.log('🔧 TenantPortal 컴포넌트 렌더링됨!');
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [dateRange, setDateRange] = useState('7d');
  const [email, setEmail] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // 온보딩 관련 state
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  const [activeTab, setActiveTab] = useState('faq');
  const [faqData, setFaqData] = useState([]);
  const [statsData, setStatsData] = useState(null);
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
    return PLAN_CONFIG.trial;  // 기본값을 trial로 변경!
  }
  
  const planKey = currentTenant.plan.toLowerCase();
  return PLAN_CONFIG[planKey] || PLAN_CONFIG.trial;  // 없으면 trial
}, [currentTenant]);

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

// ✅ 저장된 세션으로 로그인
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

// ✅ URL 토큰 방식 (기존 로직을 함수로 래핑)
async function verifyToken(token) {
  setIsLoading(true);
  try {
    const res = await fetch(`/api/auth/magic-link?token=${encodeURIComponent(token)}`);
    const data = await res.json();

    if (data?.id) {
      // 로그인 성공
      setCurrentTenant(data);
      setIsLoggedIn(true);

      // 🔐 세션 저장 (다음 방문 자동로그인)
      if (data.email) localStorage.setItem('userEmail', data.email);
      localStorage.setItem('tenantId', data.id);
      localStorage.setItem('magicLogin', 'true');

      if (data.showOnboarding || data.faqCount === 0) {
        setShowOnboarding(true);
      }

      // URL 정리
      window.history.replaceState({}, document.title, '/');
      console.log('✅ [Auth] 자동 로그인 성공(토큰)');
    } else {
      console.error('❌ [Auth] 로그인 실패:', data?.error);
      setLoginError(data?.error || '로그인에 실패했습니다.');
      if (data?.expired) {
        setLoginError('로그인 링크가 만료되었습니다. 새로운 링크를 요청해주세요.');
      }
    }
  } catch (e) {
    console.error('❌ [Auth] 오류:', e);
    setLoginError('로그인 처리 중 오류가 발생했습니다.');
  } finally {
    setIsLoading(false);
  }
}


  // FAQ 데이터 로드
  const loadFAQs = async () => {
    if (!currentTenant) return;
    try {
      const response = await fetch(`/api/faq?tenant=${currentTenant.id}`);
      if (!response.ok) throw new Error('Failed to load FAQs');
      const data = await response.json();
      setFaqData(data);
    } catch (error) {
      console.error('FAQ 로드 실패:', error);
      alert('FAQ 데이터를 불러오는데 실패했습니다.');
    }
  };

  // 통계 데이터 로드
  const loadStats = async () => {
    if (!currentTenant) return;
    const apiUrl = `/api/stats/${currentTenant.id}?view=conversations&limit=50&range=${encodeURIComponent(dateRange || '7d')}`;
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`Failed to load stats (${response.status})`);
      const data = await response.json();
      if (data && data.conversations && data.stats) {
        setStatsData(data);
      } else {
        setStatsData(null);
      }
    } catch (error) {
      console.error('통계 로드 실패:', error);
      setStatsData(null);
    }
  };

  useEffect(() => {
    if (isLoggedIn && currentTenant) {
      loadFAQs();
      loadStats();
    }
  }, [isLoggedIn, currentTenant, dateRange]);

  // Magic Link 요청 함수
  const handleRequestMagicLink = async () => {
    if (!email || !email.includes('@')) {
      setLoginError('올바른 이메일 주소를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setLoginError('');

    try {
      const response = await fetch('/api/auth/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        setLoginError('');
        alert('✅ 로그인 링크가 이메일로 전송되었습니다!\n\n메일함을 확인해주세요.');
        setEmail('');
      } else {
        setLoginError(data.error || '이메일 전송에 실패했습니다.');
      }
    } catch (error) {
      console.error('Magic Link 요청 실패:', error);
      setLoginError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentTenant(null);
    setEmail('');
    setFaqData([]);
    setStatsData(null);
    localStorage.removeItem('userEmail');
    localStorage.removeItem('tenantId');
    localStorage.removeItem('magicLogin');
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };


// ✅ handleSubmit (질문 배열 → 문자열 결합)
const handleSubmit = async () => {
  const validQuestions = formData.questions.filter(q => q.trim());
  if (validQuestions.length === 0 || !formData.answer) {
    alert('질문과 답변은 필수 입력 항목입니다.');
    return;
  }

  // ✅ 질문 연결
  const questionString = validQuestions.map(q => q.trim()).join('//');

  if (!editingItem && currentTenant.plan === 'starter' && faqData.length >= PLAN_CONFIG.starter.maxFAQs) {
    alert(`${PLAN_CONFIG.starter.name} 플랜은 최대 ${PLAN_CONFIG.starter.maxFAQs}개까지 등록 가능합니다.\n상위 플랜으로 업그레이드하세요!`);
    return;
  }

  setIsLoading(true);
  try {
    const method = editingItem ? 'PUT' : 'POST';
    const payload = {
      question: questionString,
      answer: formData.answer,
      staffHandoff: formData.staffHandoff,
      guide: formData.guide,
      keyData: formData.keyData,
      expiryDate: formData.expiryDate,
      plan: currentTenant.plan,
      ...(editingItem ? { vectorUuid: editingItem.vectorUuid } : {})
    };

    const response = await fetch(`/api/faq?tenant=${currentTenant.id}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      await loadFAQs();
      closeModal();
      alert(editingItem ? 'FAQ가 수정되었습니다.' : 'FAQ가 추가되었습니다.');
    } else {
      const error = await response.json();
      alert(error.error || (editingItem ? '수정 실패' : '추가 실패'));
    }
  } catch (error) {
    console.error('Submit 에러:', error);
    alert('서버 연결에 실패했습니다.');
  } finally {
    setIsLoading(false);
  }
};


  const handleDelete = async (item) => {
    if (!confirm('정말 삭제하시겠습니까?\n연결된 벡터 데이터도 함께 삭제됩니다.')) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/faq?tenant=${currentTenant.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vectorUuid: item.vectorUuid })
      });
      if (response.ok) {
        await loadFAQs();
        alert('FAQ가 삭제되었습니다.');
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('삭제 에러:', error);
      alert('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

// ✅ openModal (기존 단일 question → 배열 기반으로 변경)
const openModal = (item = null) => {
  if (item) {
    setEditingItem(item);
    setFormData({
      questions: item.question.includes('//')
        ? item.question.split('//').map(q => q.trim())
        : [item.question],
      answer: item.answer,
      staffHandoff: item.staffHandoff,
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
  };

  const filteredData = faqData.filter(item => {
    const q = (item.question || '').toLowerCase();
    const a = (item.answer || '').toLowerCase();
    const s = (searchTerm || '').toLowerCase();
    return q.includes(s) || a.includes(s);
  });

  const stats = useMemo(() => {
    const expired = faqData.filter(item => isExpired(item.expiryDate)).length;
    const needStaff = faqData.filter(item => item.staffHandoff !== '필요없음').length;
    return { total: faqData.length, expired, needStaff };
  }, [faqData]);

  // 온보딩 오버레이 컴포넌트
  const OnboardingOverlay = () => {
    const [currentStep, setCurrentStep] = useState(1);

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-yellow-200/30 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          {/* 헤더 */}
          <div className="bg-gradient-to-br from-yellow-400 via-yellow-300 to-amber-400 p-10 text-center rounded-t-3xl relative overflow-hidden">
            <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
            <div className="relative z-10">
              <div className="w-24 h-24 bg-white/30 rounded-full mx-auto mb-4 flex items-center justify-center backdrop-blur-md shadow-lg">
                <span className="text-6xl">🎉</span>
              </div>
              <h2 className="text-4xl font-bold text-gray-800 mb-2">환영합니다!</h2>
              <p className="text-gray-700 text-lg font-semibold">3단계로 AI 자동응답을 시작하세요</p>
              <div className="flex justify-center mt-6 space-x-2">
                {[1, 2, 3].map(step => (
                  <div 
                    key={step}
                    className={`h-2 rounded-full transition-all ${
                      step <= currentStep ? 'bg-gray-800 w-12' : 'bg-white/50 w-2'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="p-8">
            {/* Step 1 */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-blue-400/30">
                    <span className="text-4xl">📝</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">기본 템플릿 작성</h3>
                  <p className="text-gray-600">50개의 자주 묻는 질문을 간단히 작성하세요</p>
                </div>
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg shadow-yellow-200/20 border border-yellow-100/50">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-3">왜 필요한가요?</h4>
                      <ul className="space-y-2">
                        <li className="flex items-start">
                          <span className="text-yellow-600 mr-2 mt-0.5">•</span>
                          <span className="text-sm font-semibold text-gray-700">AI가 고객 질문에 정확하게 답변하려면 기본 정보가 필요해요</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-yellow-600 mr-2 mt-0.5">•</span>
                          <span className="text-sm font-semibold text-gray-700">단답형/선택형으로 쉽게 완성할 수 있습니다 (약 5분)</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-yellow-600 mr-2 mt-0.5">•</span>
                          <span className="text-sm font-semibold text-gray-700">나중에 포털에서 언제든 수정 가능해요</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-indigo-100/50">
                  <h4 className="font-bold text-gray-900 mb-4">포함된 내용</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {['영업 정보', '배송/결제', '반품/교환', '상품 문의', '이벤트', '기타'].map(category => (
                      <div key={category} className="flex items-center space-x-2 bg-gradient-to-r from-indigo-50 to-purple-50 px-3 py-2.5 rounded-xl border border-indigo-100/50">
                        <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"></div>
                        <span className="text-gray-800 font-semibold">{category}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button onClick={() => setShowOnboarding(false)} className="flex-1 px-6 py-3.5 bg-gray-100/70 backdrop-blur-sm text-gray-700 rounded-2xl hover:bg-gray-200/70 font-bold transition-all">나중에 하기</button>
                  <a href={currentTenant?.onboardingFormLink} target="_blank" rel="noopener noreferrer" onClick={() => setCurrentStep(2)} className="flex-1 px-6 py-3.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-2xl hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 font-bold text-center transition-all">템플릿 작성하기 ✨</a>
                </div>
              </div>
            )}

            {/* Step 2 */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-400 rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-purple-400/30">
                    <span className="text-4xl">🔗</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">위젯 설치</h3>
                  <p className="text-gray-600">웹사이트에 채팅 위젯을 추가하세요</p>
                </div>
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg shadow-purple-200/20 border border-purple-100/50">
                  <h4 className="font-bold text-purple-900 mb-4">설치 방법</h4>
                  <ol className="space-y-3">
                    <li className="flex items-center">
                      <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-3 shadow-md">
                        <span className="text-xs font-bold text-white">1</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">아래 코드를 복사하세요</span>
                    </li>
                    <li className="flex items-center">
                      <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-3 shadow-md">
                        <span className="text-xs font-bold text-white">2</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">웹사이트의 HTML {'</body>'} 태그 바로 위에 붙여넣으세요</span>
                    </li>
                    <li className="flex items-center">
                      <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-3 shadow-md">
                        <span className="text-xs font-bold text-white">3</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">페이지를 새로고침하면 채팅 위젯이 나타납니다</span>
                    </li>
                  </ol>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-gray-700">위젯 코드</label>
                    <button onClick={() => { navigator.clipboard.writeText(currentTenant?.widgetIframe || ''); alert('✅ 코드가 복사되었습니다!'); }} className="text-sm text-yellow-600 hover:text-yellow-700 font-bold flex items-center space-x-1 px-3 py-1.5 bg-yellow-50/70 rounded-lg hover:bg-yellow-100/70 transition-all">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      <span>복사</span>
                    </button>
                  </div>
                  <pre className="bg-gray-900 text-green-400 p-5 rounded-2xl text-xs overflow-x-auto shadow-xl"><code>{currentTenant?.widgetIframe || '<iframe src="..."></iframe>'}</code></pre>
                </div>
                <div className="flex space-x-3">
                  <button onClick={() => setCurrentStep(1)} className="px-6 py-3.5 bg-gray-100/70 backdrop-blur-sm text-gray-700 rounded-2xl hover:bg-gray-200/70 font-bold transition-all">← 이전</button>
                  <button onClick={() => setCurrentStep(3)} className="flex-1 px-6 py-3.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl hover:shadow-xl hover:shadow-purple-500/40 hover:scale-105 font-bold transition-all">다음 ✨</button>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-400 rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-green-400/30">
                    <span className="text-4xl">💬</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">네이버톡톡 연동</h3>
                  <p className="text-gray-600">네이버톡톡에서도 자동응답 사용 (선택사항)</p>
                </div>
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg shadow-green-200/20 border border-green-100/50">
                  <h4 className="font-bold text-green-900 mb-4">연동 방법</h4>
                  <ol className="space-y-3">
                    <li className="flex items-center">
                      <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mr-3 shadow-md">
                        <span className="text-xs font-bold text-white">1</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">네이버톡톡 파트너센터 접속</span>
                    </li>
                    <li className="flex items-center">
                      <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mr-3 shadow-md">
                        <span className="text-xs font-bold text-white">2</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">설정 → 채팅 설정 → Outbound API</span>
                    </li>
                    <li className="flex items-center">
                      <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mr-3 shadow-md">
                        <span className="text-xs font-bold text-white">3</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">아래 URL을 입력하고 저장</span>
                    </li>
                  </ol>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-gray-700">Outbound URL</label>
                    <button onClick={() => { navigator.clipboard.writeText(currentTenant?.naverOutbound || ''); alert('✅ URL이 복사되었습니다!'); }} className="text-sm text-green-600 hover:text-green-700 font-bold flex items-center space-x-1 px-3 py-1.5 bg-green-50/70 rounded-lg hover:bg-green-100/70 transition-all">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      <span>복사</span>
                    </button>
                  </div>
                  <div className="bg-gray-900 text-green-400 p-5 rounded-2xl text-sm break-all font-mono shadow-xl">{currentTenant?.naverOutbound || 'https://api.yoursite.com/naver/...'}</div>
                </div>
                <div className="bg-gradient-to-br from-yellow-50/80 to-amber-50/80 backdrop-blur-xl rounded-2xl p-5 shadow-lg">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div className="text-sm text-yellow-800">
                      <p className="font-bold mb-1">선택사항</p>
                      <p className="font-semibold">네이버톡톡을 사용하지 않는다면 이 단계를 건너뛰어도 됩니다.</p>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button onClick={() => setCurrentStep(2)} className="px-6 py-3.5 bg-gray-100/70 backdrop-blur-sm text-gray-700 rounded-2xl hover:bg-gray-200/70 font-bold transition-all">← 이전</button>
                  <button onClick={() => setShowOnboarding(false)} className="flex-1 px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-2xl hover:shadow-xl hover:shadow-green-500/40 hover:scale-105 font-bold transition-all">시작하기 🚀</button>
                </div>
              </div>
            )}

            <div className="mt-6 text-center">
              <button onClick={() => setShowOnboarding(false)} className="text-sm text-gray-600 hover:text-gray-800 transition-colors font-semibold">나중에 다시 보기</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 로그인 페이지
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-yellow-50 to-cyan-100 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative bg-white/40 backdrop-blur-xl rounded-3xl shadow-2xl shadow-yellow-200/20 p-8 w-full max-w-md border border-white/50">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 via-yellow-300 to-amber-400 rounded-3xl mb-4 shadow-lg shadow-yellow-400/30 transform hover:scale-105 transition-transform">
              <Database className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">FAQ 관리 포털</h1>
            <p className="text-gray-600 mt-2">AI 자동응답 데이터 관리</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">이메일 주소</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleRequestMagicLink()} className="w-full px-4 py-3 bg-white/70 backdrop-blur-sm rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none shadow-sm shadow-gray-200/50 transition-all" placeholder="your@email.com" disabled={isLoading} />
            </div>

            {loginError && (
              <div className="bg-red-50/70 backdrop-blur-sm text-red-700 px-4 py-3 rounded-2xl text-sm flex items-start space-x-2 shadow-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <button onClick={handleRequestMagicLink} disabled={isLoading} className="w-full bg-gradient-to-r from-yellow-400 via-yellow-300 to-amber-400 text-gray-800 py-3.5 rounded-2xl font-bold hover:shadow-xl hover:shadow-yellow-400/40 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-400/30">
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  전송 중...
                </span>
              ) : (
                '로그인 링크 받기 ✨'
              )}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/30">
            <div className="bg-gradient-to-br from-yellow-50/70 to-amber-50/70 backdrop-blur-sm rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-bold text-amber-900 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Magic Link 로그인
              </h3>
              <ul className="text-xs text-amber-800 space-y-1">
                <li>• 비밀번호 없이 안전하게 로그인</li>
                <li>• 이메일로 받은 링크를 클릭하면 자동 로그인</li>
                <li>• 링크는 7일간 유효합니다</li>
              </ul>
            </div>
            <p className="text-xs text-gray-600 text-center mt-4">처음 가입하셨나요? <a href="mailto:support@yoursite.com" className="text-yellow-600 hover:text-yellow-700 font-semibold">고객 지원팀</a>에 문의하세요</p>
          </div>
        </div>

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
    );
  }

  // 대시보드 (계속...)
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-yellow-50 to-cyan-50 relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {showOnboarding && <OnboardingOverlay />}

      <header className="bg-white/60 backdrop-blur-xl sticky top-0 z-10 shadow-sm shadow-yellow-100/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 via-yellow-300 to-amber-400 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-400/30 transform hover:scale-105 transition-transform">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">{currentTenant.name}</h1>
                  <span className="px-2.5 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 text-xs font-bold rounded-full flex items-center shadow-sm">
                    <Crown className="w-3 h-3 mr-1" />{currentPlanConfig.name}
                  </span>
                </div>
                <p className="text-sm text-gray-600">데이터 관리 포털</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={() => setShowOnboarding(true)} className="px-4 py-2.5 text-sm text-yellow-600 hover:bg-yellow-50/70 rounded-xl transition-all font-semibold">설치 가이드 ✨</button>
              <button onClick={handleLogout} className="flex items-center space-x-2 px-4 py-2.5 text-gray-700 hover:bg-white/70 rounded-xl transition-all backdrop-blur-sm">
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline font-semibold">로그아웃</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button onClick={() => setActiveTab('faq')} className={`py-4 px-1 font-bold text-sm transition-all relative ${activeTab === 'faq' ? 'text-yellow-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <div className="flex items-center space-x-2"><Database className="w-5 h-5" /><span>FAQ 관리</span></div>
              {activeTab === 'faq' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 to-amber-400 rounded-full shadow-lg shadow-yellow-400/50"></div>}
            </button>
            <button onClick={() => setActiveTab('stats')} className={`py-4 px-1 font-bold text-sm transition-all relative ${activeTab === 'stats' ? 'text-yellow-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <div className="flex items-center space-x-2"><BarChart3 className="w-5 h-5" /><span>상담 통계</span></div>
              {activeTab === 'stats' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 to-amber-400 rounded-full shadow-lg shadow-yellow-400/50"></div>}
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-yellow-200/30">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-200 border-t-yellow-500 mx-auto"></div>
            <p className="mt-4 text-gray-700 font-semibold">처리 중...</p>
          </div>
        </div>
      )}

      {activeTab === 'faq' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
          {currentTenant.plan === 'starter' && (
            <div className="mb-6">
              <div className="bg-gradient-to-r from-blue-100/80 to-indigo-100/80 backdrop-blur-xl rounded-3xl p-5 shadow-lg shadow-blue-200/20">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-blue-900 mb-1">Starter 플랜 제한</h3>
                    <p className="text-sm text-blue-700 mb-3">현재 {stats.total}/{PLAN_CONFIG.starter.maxFAQs}개 사용 중입니다. Pro 플랜으로 업그레이드하면 무제한 FAQ + 만료일 설정이 가능합니다.</p>
                    <div className="h-2 bg-white/50 rounded-full overflow-hidden backdrop-blur-sm">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all rounded-full shadow-sm" style={{ width: `${Math.min(100, (stats.total / PLAN_CONFIG.starter.maxFAQs) * 100)}%` }} />
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-bold rounded-xl hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 transition-all whitespace-nowrap">업그레이드 ✨</button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-indigo-200/20 p-6 hover:shadow-xl hover:shadow-indigo-200/30 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-semibold mb-1">전체 FAQ</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{stats.total}{currentTenant.plan === 'starter' && <span className="text-lg text-gray-400">/{PLAN_CONFIG.starter.maxFAQs}</span>}</p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-400/30"><Database className="w-7 h-7 text-white" /></div>
              </div>
            </div>
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-orange-200/20 p-6 hover:shadow-xl hover:shadow-orange-200/30 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-semibold mb-1">담당자 필요</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">{stats.needStaff}</p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-amber-400 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-400/30"><TrendingUp className="w-7 h-7 text-white" /></div>
              </div>
            </div>
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-red-200/20 p-6 hover:shadow-xl hover:shadow-red-200/30 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-semibold mb-1">만료된 FAQ</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">{stats.expired}</p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-red-400 to-pink-400 rounded-2xl flex items-center justify-center shadow-lg shadow-red-400/30"><Clock className="w-7 h-7 text-white" /></div>
              </div>
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-5 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="질문 또는 답변 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white/70 backdrop-blur-sm rounded-2xl focus:ring-2 focus:ring-yellow-400 focus:outline-none shadow-sm transition-all" />
              </div>
              <button onClick={() => openModal()} disabled={currentTenant.plan === 'starter' && stats.total >= PLAN_CONFIG.starter.maxFAQs} className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-yellow-400 via-yellow-300 to-amber-400 text-gray-800 rounded-2xl hover:shadow-xl hover:shadow-yellow-400/40 hover:scale-105 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-400/30">
                <Plus className="w-5 h-5" /><span>새 FAQ 추가</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredData.length === 0 ? (
              <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-16 text-center">
                <Database className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-semibold">{searchTerm ? '검색 결과가 없습니다.' : '등록된 FAQ가 없습니다.'}</p>
                {!searchTerm && stats.total < (PLAN_CONFIG[currentTenant.plan].maxFAQs || Infinity) && (
                  <button onClick={() => openModal()} className="mt-6 px-6 py-3 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-800 font-bold rounded-2xl hover:shadow-xl hover:shadow-yellow-400/40 hover:scale-105 transition-all">첫 FAQ 추가하기 ✨</button>
                )}
              </div>
            ) : (
              filteredData.map((item) => {
                const expired = isExpired(item.expiryDate);
                return (
                  <div key={item.id} className={`bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg p-6 transition-all hover:shadow-xl ${expired ? 'shadow-red-200/30 hover:shadow-red-200/40 bg-red-50/40' : 'shadow-gray-200/20 hover:shadow-gray-200/30'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 pr-4">
                        <div className="flex items-start space-x-2 mb-3 flex-wrap gap-2">
                          {/* ✅ 질문 배열로 분리하여 렌더링 */}
<div className="flex items-start space-x-2 mb-3 flex-wrap gap-2">
  <div className="flex-1">
    {item.question && item.question.includes('//') ? (
      <div className="space-y-1">
        {item.question.split('//').map((q, idx) => (
          <h3
            key={idx}
            className="text-base font-semibold text-gray-800 flex items-start"
          >
            <span className="text-yellow-600 mr-2">{idx + 1}.</span>
            {q.trim()}
          </h3>
        ))}
      </div>
    ) : (
      <h3 className="text-lg font-bold text-gray-800">{item.question}</h3>
    )}
  </div>
</div>

                          {expired && <span className="px-3 py-1.5 bg-gradient-to-r from-red-400 to-pink-400 text-white text-xs font-bold rounded-full flex items-center whitespace-nowrap shadow-lg shadow-red-400/30"><Clock className="w-3 h-3 mr-1" />만료됨</span>}
                          {item.staffHandoff !== '필요없음' && <span className="px-3 py-1.5 bg-gradient-to-r from-orange-400 to-amber-400 text-white text-xs font-bold rounded-full whitespace-nowrap shadow-lg shadow-orange-400/30">{item.staffHandoff}</span>}
                        </div>
                        <p className="text-gray-700 leading-relaxed">{item.answer}</p>
                      </div>
                      <div className="flex space-x-2 flex-shrink-0">
                        <button onClick={() => openModal(item)} className="p-2.5 text-yellow-600 hover:bg-yellow-50/70 rounded-xl transition-all backdrop-blur-sm"><Edit2 className="w-5 h-5" /></button>
                        <button onClick={() => handleDelete(item)} className="p-2.5 text-red-600 hover:bg-red-50/70 rounded-xl transition-all backdrop-blur-sm"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-white/30">
                      {item.guide && <div><p className="text-xs text-gray-500 mb-1 font-semibold">가이드</p><p className="text-sm text-gray-700">{item.guide}</p></div>}
                      {item.keyData && <div><p className="text-xs text-gray-500 mb-1 font-semibold">핵심 데이터</p><p className="text-sm text-gray-700 font-mono bg-gray-50/50 px-2 py-1 rounded-lg">{item.keyData}</p></div>}
                      {item.expiryDate && <div><p className="text-xs text-gray-500 mb-1 font-semibold">만료일</p><p className={`text-sm font-bold ${expired ? 'text-red-600' : 'text-gray-700'}`}>{item.expiryDate}</p></div>}
                      <div><p className="text-xs text-gray-500 mb-1 font-semibold">수정일</p><p className="text-sm text-gray-700">{item.updatedAt}</p></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
          {statsData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-yellow-200/20 p-6 hover:shadow-xl hover:shadow-yellow-200/30 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600 font-semibold">총 상담</p>
                    <Users className="w-5 h-5 text-yellow-600" />
                  </div>
                  <p className="text-4xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">{statsData.stats.total}</p>
                </div>
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-green-200/20 p-6 hover:shadow-xl hover:shadow-green-200/30 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600 font-semibold">AI 자동응답률</p>
                    <Zap className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{statsData.stats.aiAutoRate}%</p>
                </div>
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-blue-200/20 p-6 hover:shadow-xl hover:shadow-blue-200/30 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600 font-semibold">평균 응답시간</p>
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{statsData.stats.avgResponseTime}초</p>
                </div>
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-orange-200/20 p-6 hover:shadow-xl hover:shadow-orange-200/30 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600 font-semibold">상담원 개입</p>
                    <MessageSquare className="w-5 h-5 text-orange-600" />
                  </div>
                  <p className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">{statsData.stats.agentChats}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-6 hover:shadow-xl transition-all">
                  <h3 className="text-lg font-bold mb-4 flex items-center text-gray-800"><BarChart3 className="w-5 h-5 mr-2 text-yellow-600" />유입경로별 상담</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={statsData.chartData.mediumData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" fill="url(#colorGradient)" radius={[8, 8, 0, 0]} />
                      <defs>
                        <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" />
                          <stop offset="100%" stopColor="#f59e0b" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-lg shadow-gray-200/20 p-6 hover:shadow-xl transition-all">
                  <h3 className="text-lg font-bold mb-4 text-gray-800">AI vs 상담원 비율</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={statsData.chartData.aiVsAgentData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                        {statsData.chartData.aiVsAgentData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

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
  );
}