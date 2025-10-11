import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  LogOut,
  Database,
  TrendingUp,
  Clock,
  AlertCircle,
  Crown,
  Calendar,
} from "lucide-react";

// 플랜 설정 (여기만 수정하면 전체 적용!)
const PLAN_CONFIG = {
  starter: {
    name: "Starter",
    maxFAQs: 10,
    hasExpiryDate: false,
    color: "blue",
  },
  pro: {
    name: "Pro",
    maxFAQs: Infinity,
    hasExpiryDate: true,
    color: "purple",
  },
  business: {
    name: "Business",
    maxFAQs: Infinity,
    hasExpiryDate: true,
    color: "indigo",
  },
  enterprise: {
    name: "Enterprise",
    maxFAQs: Infinity,
    hasExpiryDate: true,
    color: "pink",
  },
};

export default function TenantPortal() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [faqData, setFaqData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    staffHandoff: "필요없음",
    guide: "",
    keyData: "",
    expiryDate: "",
  });

  const currentPlanConfig = currentTenant
    ? PLAN_CONFIG[currentTenant.plan]
    : null;

  // FAQ 데이터 로드
  const loadFAQs = async () => {
    if (!currentTenant) return;

    try {
      const response = await fetch(`/api/faq?tenant=${currentTenant.id}`);
      if (!response.ok) throw new Error("Failed to load FAQs");
      const data = await response.json();
      setFaqData(data);
    } catch (error) {
      console.error("FAQ 로드 실패:", error);
      alert("FAQ 데이터를 불러오는데 실패했습니다.");
    }
  };

  useEffect(() => {
    if (isLoggedIn && currentTenant) {
      loadFAQs();
    }
  }, [isLoggedIn, currentTenant]);

  // 로그인 처리
  const handleLogin = async () => {
    if (!email || !password) {
      setLoginError("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setLoginError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentTenant(data);
        setIsLoggedIn(true);
      } else {
        setLoginError(data.error || "로그인에 실패했습니다.");
      }
    } catch (error) {
      console.error("로그인 에러:", error);
      setLoginError("서버 연결에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 로그아웃
  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentTenant(null);
    setEmail("");
    setPassword("");
    setFaqData([]);
  };

  // 만료된 FAQ 체크
  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  // FAQ 추가/수정
  const handleSubmit = async () => {
    if (!formData.question || !formData.answer) {
      alert("질문과 답변은 필수 입력 항목입니다.");
      return;
    }

    // Starter 플랜 제한 체크
    if (
      !editingItem &&
      currentTenant.plan === "starter" &&
      faqData.length >= PLAN_CONFIG.starter.maxFAQs
    ) {
      alert(
        `${PLAN_CONFIG.starter.name} 플랜은 최대 ${PLAN_CONFIG.starter.maxFAQs}개까지 등록 가능합니다.\n상위 플랜으로 업그레이드하세요!`
      );
      return;
    }

    setIsLoading(true);

    try {
      if (editingItem) {
        // 수정
        const response = await fetch(`/api/faq?tenant=${currentTenant.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vectorUuid: editingItem.vectorUuid,
            ...formData,
          }),
        });

        if (response.ok) {
          await loadFAQs();
          closeModal();
          alert("FAQ가 수정되었습니다.");
        } else {
          const error = await response.json();
          alert(error.error || "수정에 실패했습니다.");
        }
      } else {
        // 추가
        const response = await fetch(`/api/faq?tenant=${currentTenant.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            plan: currentTenant.plan,
          }),
        });

        if (response.ok) {
          await loadFAQs();
          closeModal();
          alert("FAQ가 추가되었습니다.");
        } else {
          const error = await response.json();
          if (error.error === "PLAN_LIMIT_REACHED") {
            alert("플랜 제한에 도달했습니다. 업그레이드하세요!");
          } else if (error.error === "EXPIRY_NOT_AVAILABLE") {
            alert("만료일 기능은 Pro 이상 플랜에서 사용 가능합니다.");
          } else {
            alert(error.error || "추가에 실패했습니다.");
          }
        }
      }
    } catch (error) {
      console.error("Submit 에러:", error);
      alert("서버 연결에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // FAQ 삭제
  const handleDelete = async (item) => {
    if (
      !confirm("정말 삭제하시겠습니까?\n연결된 벡터 데이터도 함께 삭제됩니다.")
    ) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/faq?tenant=${currentTenant.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vectorUuid: item.vectorUuid,
        }),
      });

      if (response.ok) {
        await loadFAQs();
        alert("FAQ가 삭제되었습니다.");
      } else {
        alert("삭제에 실패했습니다.");
      }
    } catch (error) {
      console.error("삭제 에러:", error);
      alert("서버 연결에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 모달 열기
  const openModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        question: item.question,
        answer: item.answer,
        staffHandoff: item.staffHandoff,
        guide: item.guide || "",
        keyData: item.keyData || "",
        expiryDate: item.expiryDate || "",
      });
    } else {
      setEditingItem(null);
      setFormData({
        question: "",
        answer: "",
        staffHandoff: "필요없음",
        guide: "",
        keyData: "",
        expiryDate: "",
      });
    }
    setIsModalOpen(true);
  };

  // 모달 닫기
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  // 검색 필터링
  const filteredData = faqData.filter(
    (item) =>
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 통계 계산
  const stats = useMemo(() => {
    const expired = faqData.filter((item) => isExpired(item.expiryDate)).length;
    const needStaff = faqData.filter(
      (item) => item.staffHandoff !== "필요없음"
    ).length;
    return { total: faqData.length, expired, needStaff };
  }, [faqData]);

  // 로그인 페이지
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
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                placeholder="이메일을 입력하세요"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                placeholder="비밀번호를 입력하세요"
                disabled={isLoading}
              />
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {loginError}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50"
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 대시보드
  return (
    <div className="min-h-screen bg-gray-50">
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
                  <h1 className="text-xl font-bold text-gray-800">
                    {currentTenant.name}
                  </h1>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full flex items-center">
                    <Crown className="w-3 h-3 mr-1" />
                    {currentPlanConfig.name}
                  </span>
                </div>
                <p className="text-sm text-gray-500">FAQ 데이터 관리</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">로그아웃</span>
            </button>
          </div>
        </div>
      </header>

      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">처리 중...</p>
          </div>
        </div>
      )}

      {/* 플랜 제한 알림 (Starter만) */}
      {currentTenant.plan === "starter" && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900">
                  Starter 플랜 제한
                </h3>
                <p className="text-xs text-blue-700 mt-1">
                  현재 {stats.total}/{PLAN_CONFIG.starter.maxFAQs}개 사용
                  중입니다. Pro 플랜으로 업그레이드하면 무제한 FAQ + 만료일
                  설정이 가능합니다.
                </p>
                <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{
                      width: `${
                        (stats.total / PLAN_CONFIG.starter.maxFAQs) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
              <button className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap">
                업그레이드
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">전체 FAQ</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {stats.total}
                  {currentTenant.plan === "starter" && (
                    <span className="text-lg text-gray-400">
                      /{PLAN_CONFIG.starter.maxFAQs}
                    </span>
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
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {stats.needStaff}
                </p>
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
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  {stats.expired}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* 검색 및 추가 버튼 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="질문 또는 답변 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
            <button
              onClick={() => openModal()}
              disabled={
                currentTenant.plan === "starter" &&
                stats.total >= PLAN_CONFIG.starter.maxFAQs
              }
              className="flex items-center justify-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              <span>새 FAQ 추가</span>
            </button>
          </div>
        </div>

        {/* FAQ 리스트 */}
        <div className="space-y-4">
          {filteredData.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
              <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {searchTerm
                  ? "검색 결과가 없습니다."
                  : "등록된 FAQ가 없습니다."}
              </p>
              {!searchTerm &&
                stats.total <
                  (PLAN_CONFIG[currentTenant.plan].maxFAQs || Infinity) && (
                  <button
                    onClick={() => openModal()}
                    className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    첫 FAQ 추가하기 →
                  </button>
                )}
            </div>
          ) : (
            filteredData.map((item) => {
              const expired = isExpired(item.expiryDate);
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl shadow-sm p-6 border-2 transition-all ${
                    expired
                      ? "border-red-300 bg-red-50"
                      : "border-gray-200 hover:shadow-md"
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 pr-4">
                      <div className="flex items-start space-x-2 mb-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-gray-800 flex-1">
                          {item.question}
                        </h3>
                        {expired && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center whitespace-nowrap">
                            <Clock className="w-3 h-3 mr-1" />
                            만료됨
                          </span>
                        )}
                        {item.staffHandoff !== "필요없음" && (
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full whitespace-nowrap">
                            {item.staffHandoff}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                    <div className="flex space-x-2 flex-shrink-0">
                      <button
                        onClick={() => openModal(item)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
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
                        <p className="text-xs text-gray-500 mb-1">
                          핵심 데이터
                        </p>
                        <p className="text-sm text-gray-700 font-mono">
                          {item.keyData}
                        </p>
                      </div>
                    )}
                    {item.expiryDate && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">만료일</p>
                        <p
                          className={`text-sm font-medium ${
                            expired ? "text-red-600" : "text-gray-700"
                          }`}
                        >
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

      {/* 추가/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
              <h2 className="text-2xl font-bold text-gray-800">
                {editingItem ? "FAQ 수정" : "새 FAQ 추가"}
              </h2>
            </div>

            <div className="p-6 space-y-5">
              {/* 질문 (필수) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  질문 또는 기본 정보 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.question}
                  onChange={(e) =>
                    setFormData({ ...formData, question: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="예: 영업시간이 어떻게 되나요?"
                />
              </div>

              {/* 답변 (필수) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  답변 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.answer}
                  onChange={(e) =>
                    setFormData({ ...formData, answer: e.target.value })
                  }
                  rows="4"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                  placeholder="AI가 고객에게 제공할 답변을 입력하세요"
                />
              </div>

              {/* 담당자 전달 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  담당자 전달
                </label>
                <select
                  value={formData.staffHandoff}
                  onChange={(e) =>
                    setFormData({ ...formData, staffHandoff: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                >
                  <option value="필요없음">필요없음</option>
                  <option value="전달필요">전달필요</option>
                  <option value="조건부전달">조건부전달</option>
                </select>
              </div>

              {/* 가이드 (선택) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  가이드 (선택)
                </label>
                <input
                  type="text"
                  value={formData.guide}
                  onChange={(e) =>
                    setFormData({ ...formData, guide: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="답변 생성 시 추가 주의사항"
                />
              </div>

              {/* 핵심 데이터 (선택) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  핵심 데이터 (선택)
                </label>
                <input
                  type="text"
                  value={formData.keyData}
                  onChange={(e) =>
                    setFormData({ ...formData, keyData: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  placeholder="전화번호, 링크 등 변형되어선 안되는 고정값"
                />
              </div>

              {/* 만료일 (플랜별 조건부) */}
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
                    <input
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) =>
                        setFormData({ ...formData, expiryDate: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                    />
                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    휴가 일정 등 기간 한정 정보에 활용하세요
                  </p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  취소
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium disabled:opacity-50"
                >
                  {editingItem ? "수정 완료" : "추가"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
