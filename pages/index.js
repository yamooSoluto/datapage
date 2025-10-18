import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, LogOut, Database, TrendingUp, Clock, AlertCircle, Crown, Calendar, BarChart3, Users, MessageSquare, Zap } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

// 플랜 설정
const PLAN_CONFIG = {
  starter: { name: 'Starter', maxFAQs: 100, hasExpiryDate: false, color: 'blue' },
  pro: { name: 'Pro', maxFAQs: Infinity, hasExpiryDate: true, color: 'purple' },
  business: { name: 'Business', maxFAQs: Infinity, hasExpiryDate: true, color: 'indigo' },
  enterprise: { name: 'Enterprise', maxFAQs: Infinity, hasExpiryDate: true, color: 'pink' }
};

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

export default function TenantPortal() {
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
  const [formData, setFormData] = useState({
    question: '', answer: '', staffHandoff: '필요없음', guide: '', keyData: '', expiryDate: ''
  });

  const currentPlanConfig = currentTenant ? PLAN_CONFIG[currentTenant.plan] : null;

  // Magic Link 자동 로그인 처리
// pages/index.js 내부 - useEffect 수정
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (token) {
    console.log('🔑 Magic Link 토큰 감지:', token.slice(0, 20) + '...');
    setIsLoading(true);
    
    fetch(`/api/auth/magic-link?token=${token}`)
      .then(res => {
        console.log('📡 API 응답 상태:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('📦 받은 데이터:', data);
        
        if (data.id) {
          console.log('✅ 자동 로그인 성공:', data.name);
          setCurrentTenant(data);
          setIsLoggedIn(true);
          
          // ✅ 온보딩 표시
          if (data.showOnboarding || data.faqCount === 0) {
            setShowOnboarding(true);
          }
          
          // URL 정리
          window.history.replaceState({}, document.title, '/');
        } else {
          console.error('❌ 로그인 실패:', data.error);
          setLoginError(data.error || '로그인에 실패했습니다.');
          
          if (data.expired) {
            setLoginError('로그인 링크가 만료되었습니다. 새로운 링크를 요청해주세요.');
          }
        }
      })
      .catch(err => {
        console.error('❌ Magic Link 오류:', err);
        setLoginError('로그인 처리 중 오류가 발생했습니다.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }
}, []);

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

  // 로그인 처리
// Magic Link 요청 함수 (handleLogin을 이걸로 교체)
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
      // 성공 메시지
      setLoginError(''); // 에러 초기화
      alert('✅ 로그인 링크가 이메일로 전송되었습니다!\n\n메일함을 확인해주세요.');
      setEmail(''); // 이메일 입력 초기화
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
    setPassword('');
    setFaqData([]);
    setStatsData(null);
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const handleSubmit = async () => {
    if (!formData.question || !formData.answer) {
      alert('질문과 답변은 필수 입력 항목입니다.');
      return;
    }
    if (!editingItem && currentTenant.plan === 'starter' && faqData.length >= PLAN_CONFIG.starter.maxFAQs) {
      alert(`${PLAN_CONFIG.starter.name} 플랜은 최대 ${PLAN_CONFIG.starter.maxFAQs}개까지 등록 가능합니다.\n상위 플랜으로 업그레이드하세요!`);
      return;
    }
    setIsLoading(true);
    try {
      if (editingItem) {
        const response = await fetch(`/api/faq?tenant=${currentTenant.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vectorUuid: editingItem.vectorUuid, ...formData })
        });
        if (response.ok) {
          await loadFAQs();
          closeModal();
          alert('FAQ가 수정되었습니다.');
        } else {
          const error = await response.json();
          alert(error.error || '수정에 실패했습니다.');
        }
      } else {
        const response = await fetch(`/api/faq?tenant=${currentTenant.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, plan: currentTenant.plan })
        });
        if (response.ok) {
          await loadFAQs();
          closeModal();
          alert('FAQ가 추가되었습니다.');
        } else {
          const error = await response.json();
          if (error.error === 'PLAN_LIMIT_REACHED') {
            alert('플랜 제한에 도달했습니다. 업그레이드하세요!');
          } else if (error.error === 'EXPIRY_NOT_AVAILABLE') {
            alert('만료일 기능은 Pro 이상 플랜에서 사용 가능합니다.');
          } else {
            alert(error.error || '추가에 실패했습니다.');
          }
        }
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

  const openModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        question: item.question,
        answer: item.answer,
        staffHandoff: item.staffHandoff,
        guide: item.guide || '',
        keyData: item.keyData || '',
        expiryDate: item.expiryDate || ''
      });
    } else {
      setEditingItem(null);
      setFormData({
        question: '', answer: '', staffHandoff: '필요없음', guide: '', keyData: '', expiryDate: ''
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          {/* 헤더 */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-center rounded-t-2xl">
            <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full mx-auto mb-4 flex items-center justify-center backdrop-blur-sm">
              <span className="text-5xl">🎉</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">환영합니다!</h2>
            <p className="text-indigo-100">3단계로 AI 자동응답을 시작하세요</p>
            <div className="flex justify-center mt-4 space-x-2">
              {[1, 2, 3].map(step => (
                <div 
                  key={step}
                  className={`w-2 h-2 rounded-full transition-all ${
                    step <= currentStep ? 'bg-white w-8' : 'bg-white bg-opacity-30'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="p-8">
            {/* Step 1: 템플릿 작성 */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-3xl">📝</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">기본 템플릿 작성</h3>
                  <p className="text-gray-600">50개의 자주 묻는 질문을 간단히 작성하세요</p>
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 mb-2">왜 필요한가요?</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• AI가 고객 질문에 정확하게 답변하려면 기본 정보가 필요해요</li>
                        <li>• 단답형/선택형으로 쉽게 완성할 수 있습니다 (약 5분)</li>
                        <li>• 나중에 포털에서 언제든 수정 가능해요</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-6">
                  <h4 className="font-semibold text-gray-900 mb-3">포함된 내용</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {['영업 정보', '배송/결제', '반품/교환', '상품 문의', '이벤트', '기타'].map(category => (
                      <div key={category} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                        <span className="text-gray-700">{category}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowOnboarding(false)}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                  >
                    나중에 하기
                  </button>
                  <a
                    href={currentTenant?.onboardingFormLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setCurrentStep(2)}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-medium text-center transition-all"
                  >
                    템플릿 작성하기 →
                  </a>
                </div>
              </div>
            )}

            {/* Step 2: 위젯 설치 */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-purple-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-3xl">🔗</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">위젯 설치</h3>
                  <p className="text-gray-600">웹사이트에 채팅 위젯을 추가하세요</p>
                </div>

                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6">
                  <h4 className="font-semibold text-purple-900 mb-3">설치 방법</h4>
                  <ol className="text-sm text-purple-800 space-y-2">
                    <li className="flex items-start">
                      <span className="font-bold mr-2">1.</span>
                      <span>아래 코드를 복사하세요</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold mr-2">2.</span>
                      <span>웹사이트의 HTML {'</body>'} 태그 바로 위에 붙여넣으세요</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold mr-2">3.</span>
                      <span>페이지를 새로고침하면 채팅 위젯이 나타납니다</span>
                    </li>
                  </ol>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">위젯 코드</label>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(currentTenant?.widgetIframe || '');
                        alert('✅ 코드가 복사되었습니다!');
                      }}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>복사</span>
                    </button>
                  </div>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto">
                    <code>{currentTenant?.widgetIframe || '<iframe src="..."></iframe>'}</code>
                  </pre>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                  >
                    ← 이전
                  </button>
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 font-medium transition-all"
                  >
                    다음 →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: 네이버톡톡 (선택) */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-3xl">💬</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">네이버톡톡 연동</h3>
                  <p className="text-gray-600">네이버톡톡에서도 자동응답 사용 (선택사항)</p>
                </div>

                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                  <h4 className="font-semibold text-green-900 mb-3">연동 방법</h4>
                  <ol className="text-sm text-green-800 space-y-2">
                    <li className="flex items-start">
                      <span className="font-bold mr-2">1.</span>
                      <span>네이버톡톡 파트너센터 접속</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold mr-2">2.</span>
                      <span>설정 → 채팅 설정 → Outbound API</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold mr-2">3.</span>
                      <span>아래 URL을 입력하고 저장</span>
                    </li>
                  </ol>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Outbound URL</label>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(currentTenant?.naverOutbound || '');
                        alert('✅ URL이 복사되었습니다!');
                      }}
                      className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>복사</span>
                    </button>
                  </div>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm break-all font-mono">
                    {currentTenant?.naverOutbound || 'https://api.yoursite.com/naver/...'}
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-yellow-800">
                      <p className="font-semibold mb-1">선택사항</p>
                      <p>네이버톡톡을 사용하지 않는다면 이 단계를 건너뛰어도 됩니다.</p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                  >
                    ← 이전
                  </button>
                  <button
                    onClick={() => setShowOnboarding(false)}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 font-medium transition-all"
                  >
                    시작하기 🚀
                  </button>
                </div>
              </div>
            )}

            {/* 하단 안내 */}
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowOnboarding(false)}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                나중에 다시 보기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 로그인 페이지
// pages/index.js의 로그인 페이지 부분만 교체

// 로그인 페이지 (Magic Link 방식으로 변경)
if (!isLoggedIn) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full mb-4">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">FAQ 관리 포털</h1>
          <p className="text-gray-600 mt-2">AI 자동응답 데이터 관리</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이메일 주소
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleRequestMagicLink()}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              placeholder="your@email.com"
              disabled={isLoading}
            />
          </div>

          {loginError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <button
            onClick={handleRequestMagicLink}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                전송 중...
              </span>
            ) : (
              '로그인 링크 받기'
            )}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Magic Link 로그인
            </h3>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• 비밀번호 없이 안전하게 로그인</li>
              <li>• 이메일로 받은 링크를 클릭하면 자동 로그인</li>
              <li>• 링크는 7일간 유효합니다</li>
            </ul>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            처음 가입하셨나요?{' '}
            <a href="mailto:support@yoursite.com" className="text-indigo-600 hover:text-indigo-700 font-medium">
              고객 지원팀
            </a>
            에 문의하세요
          </p>
        </div>
      </div>
    </div>
  );
}

  // 대시보드
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 온보딩 오버레이 */}
      {showOnboarding && <OnboardingOverlay />}

      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-700 rounded-lg flex items-center justify-center">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-bold text-gray-800">{currentTenant.name}</h1>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full flex items-center">
                    <Crown className="w-3 h-3 mr-1" />
                    {currentPlanConfig.name}
                  </span>
                </div>
                <p className="text-sm text-gray-500">데이터 관리 포털</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setShowOnboarding(true)}
                className="px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                설치 가이드
              </button>
              <button onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button onClick={() => setActiveTab('faq')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'faq'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5" />
                <span>FAQ 관리</span>
              </div>
            </button>
            <button onClick={() => setActiveTab('stats')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'stats'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>상담 통계</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">처리 중...</p>
          </div>
        </div>
      )}

      {/* FAQ 탭 내용 */}
      {activeTab === 'faq' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {currentTenant.plan === 'starter' && (
            <div className="mb-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-blue-900">Starter 플랜 제한</h3>
                    <p className="text-xs text-blue-700 mt-1">
                      현재 {stats.total}/{PLAN_CONFIG.starter.maxFAQs}개 사용 중입니다. 
                      Pro 플랜으로 업그레이드하면 무제한 FAQ + 만료일 설정이 가능합니다.
                    </p>
                    <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 transition-all"
                        style={{ width: `${Math.min(100, (stats.total / PLAN_CONFIG.starter.maxFAQs) * 100)}%` }} />
                    </div>
                  </div>
                  <button className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
                    업그레이드
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">전체 FAQ</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">
                    {stats.total}
                    {currentTenant.plan === 'starter' && (
                      <span className="text-lg text-gray-400">/{PLAN_CONFIG.starter.maxFAQs}</span>
                    )}
                  </p>
                </div>
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Database className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">담당자 필요</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">{stats.needStaff}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">만료된 FAQ</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">{stats.expired}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" placeholder="질문 또는 답변 검색..." value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
              </div>
              <button onClick={() => openModal()}
                disabled={currentTenant.plan === 'starter' && stats.total >= PLAN_CONFIG.starter.maxFAQs}
                className="flex items-center justify-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                <Plus className="w-5 h-5" />
                <span>새 FAQ 추가</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredData.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
                <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">
                  {searchTerm ? '검색 결과가 없습니다.' : '등록된 FAQ가 없습니다.'}
                </p>
                {!searchTerm && stats.total < (PLAN_CONFIG[currentTenant.plan].maxFAQs || Infinity) && (
                  <button onClick={() => openModal()} className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium">
                    첫 FAQ 추가하기 →
                  </button>
                )}
              </div>
            ) : (
              filteredData.map((item) => {
                const expired = isExpired(item.expiryDate);
                return (
                  <div key={item.id} 
                    className={`bg-white rounded-xl shadow-sm p-6 border-2 transition-all ${
                      expired ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:shadow-md'
                    }`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 pr-4">
                        <div className="flex items-start space-x-2 mb-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-gray-800 flex-1">{item.question}</h3>
                          {expired && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center whitespace-nowrap">
                              <Clock className="w-3 h-3 mr-1" />만료됨
                            </span>
                          )}
                          {item.staffHandoff !== '필요없음' && (
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full whitespace-nowrap">
                              {item.staffHandoff}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 leading-relaxed">{item.answer}</p>
                      </div>
                      <div className="flex space-x-2 flex-shrink-0">
                        <button onClick={() => openModal(item)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(item)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-gray-100">
                      {item.guide && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">가이드</p>
                          <p className="text-sm text-gray-700">{item.guide}</p>
                        </div>
                      )}
                      {item.keyData && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">핵심 데이터</p>
                          <p className="text-sm text-gray-700 font-mono">{item.keyData}</p>
                        </div>
                      )}
                      {item.expiryDate && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">만료일</p>
                          <p className={`text-sm font-medium ${expired ? 'text-red-600' : 'text-gray-700'}`}>
                            {item.expiryDate}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">수정일</p>
                        <p className="text-sm text-gray-700">{item.updatedAt}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 통계 탭 내용 */}
      {activeTab === 'stats' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {statsData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm p-6 border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600">총 상담</p>
                    <Users className="w-5 h-5 text-indigo-600" />
                  </div>
                  <p className="text-3xl font-bold text-gray-800">{statsData.stats.total}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6 border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600">AI 자동응답률</p>
                    <Zap className="w-5 h-5 text-green-600" />
                  </div>
                  <p className="text-3xl font-bold text-green-600">{statsData.stats.aiAutoRate}%</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6 border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600">평균 응답시간</p>
                    <Clock className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-3xl font-bold text-blue-600">{statsData.stats.avgResponseTime}초</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-6 border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600">상담원 개입</p>
                    <MessageSquare className="w-5 h-5 text-orange-600" />
                  </div>
                  <p className="text-3xl font-bold text-orange-600">{statsData.stats.agentChats}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-xl shadow-sm p-6 border">
                  <h3 className="text-lg font-bold mb-4 flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2 text-indigo-600" />
                    유입경로별 상담
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={statsData.chartData.mediumData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border">
                  <h3 className="text-lg font-bold mb-4">AI vs 상담원 비율</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={statsData.chartData.aiVsAgentData} cx="50%" cy="50%" 
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80} fill="#8884d8" dataKey="value">
                        {statsData.chartData.aiVsAgentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border mb-6">
                <h3 className="text-lg font-bold mb-4">자주 나오는 상담 주제</h3>
                <div className="space-y-2">
                  {statsData.chartData.tagData.slice(0, 5).map((tag) => (
                    <div key={tag.name} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{tag.name}</span>
                      <div className="flex items-center">
                        <div className="w-48 h-4 bg-gray-200 rounded-full mr-2 overflow-hidden">
                          <div
                            className="h-full bg-purple-600 transition-all"
                            style={{
                              width: `${(tag.count / statsData.stats.total) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-800 w-8 text-right">
                          {tag.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border">
                <h3 className="text-lg font-bold mb-4">최근 상담 내역</h3>
                <div className="space-y-2">
                  {statsData.conversations.slice(0, 10).map((conv) => {
                    const dt = conv.firstOpenedAt ? new Date(conv.firstOpenedAt) : null;
                    const mediumLabel =
                      conv.mediumName === "appKakao"
                        ? "카카오"
                        : conv.mediumName === "appNaverTalk"
                        ? "네이버톡"
                        : conv.mediumName === "widget"
                        ? "위젯"
                        : conv.mediumName === "web"
                        ? "웹"
                        : conv.mediumName || "기타";

                    return (
                      <div
                        key={conv.id}
                        className="flex justify-between items-center p-3 border-b hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">
                            {conv.userName || "Unknown"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {mediumLabel} · {dt ? dt.toLocaleString("ko-KR") : "-"}
                          </p>
                        </div>
                        <div className="text-right text-sm space-x-2">
                          <span className="text-green-600 font-medium">
                            AI {conv.aiAutoChats || 0}
                          </span>
                          {(conv.agentChats || 0) > 0 && (
                            <span className="text-blue-600 font-medium">
                              상담원 {conv.agentChats}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center border">
              <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">통계 데이터를 불러오는 중...</p>
            </div>
          )}
        </div>
      )}

      {/* FAQ 추가/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
              <h2 className="text-2xl font-bold text-gray-800">
                {editingItem ? 'FAQ 수정' : '새 FAQ 추가'}
              </h2>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  질문 또는 기본 정보 <span className="text-red-500">*</span>
                </label>
                <input type="text" value={formData.question}
                  onChange={(e) => setFormData({...formData, question: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="예: 영업시간이 어떻게 되나요?" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  답변 <span className="text-red-500">*</span>
                </label>
                <textarea value={formData.answer}
                  onChange={(e) => setFormData({...formData, answer: e.target.value})}
                  rows="4"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                  placeholder="AI가 고객에게 제공할 답변을 입력하세요" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">담당자 전달</label>
                <select value={formData.staffHandoff}
                  onChange={(e) => setFormData({...formData, staffHandoff: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none">
                  <option value="필요없음">필요없음</option>
                  <option value="전달필요">전달필요</option>
                  <option value="조건부전달">조건부전달</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">가이드 (선택)</label>
                <input type="text" value={formData.guide}
                  onChange={(e) => setFormData({...formData, guide: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="답변 생성 시 추가 주의사항" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">핵심 데이터 (선택)</label>
                <input type="text" value={formData.keyData}
                  onChange={(e) => setFormData({...formData, keyData: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="전화번호, 링크 등 변형되어선 안되는 고정값" />
              </div>
              {currentPlanConfig.hasExpiryDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    만료일 (선택)
                    <span className="ml-2 text-xs text-purple-600 font-normal">
                      <Crown className="inline w-3 h-3 mr-1" />
                      {currentPlanConfig.name} 전용
                    </span>
                  </label>
                  <div className="relative">
                    <input type="date" value={formData.expiryDate}
                      onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">휴가 일정 등 기간 한정 정보에 활용하세요</p>
                </div>
              )}
              <div className="flex space-x-3 pt-4">
                <button onClick={closeModal}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                  취소
                </button>
                <button onClick={handleSubmit} disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium disabled:opacity-50">
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