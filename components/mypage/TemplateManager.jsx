// components/mypage/TemplateManager.jsx
// 🎨 완벽한 모바일 반응형 템플릿 관리자

import React from "react";
import { X, Plus, ChevronDown, ChevronRight, Save, Trash2 } from "lucide-react";

// 기본 템플릿
const DEFAULT_TEMPLATES = {
    facility: {
        id: "facility",
        title: "시설/비품",
        icon: "🏢",
        facets: [
            { key: "existence", label: "존재", type: "multi", options: ["있음", "없음"] },
            { key: "cost", label: "비용", type: "multi", options: ["무료", "회원 무료", "유료", "별도 요금"] },
            { key: "location", label: "위치", type: "multi", options: ["1층", "2층", "3층", "로비", "복도"] }
        ]
    },
    room: {
        id: "room",
        title: "룸/존",
        icon: "🚪",
        facets: [
            { key: "existence", label: "존재", type: "multi", options: ["있음", "없음"] },
            { key: "capacity", label: "정원", type: "multi", options: ["1인", "2인", "3인", "4인", "5인", "6인"] }
        ]
    },
    product: {
        id: "product",
        title: "상품/서비스",
        icon: "🎫",
        facets: [
            { key: "existence", label: "존재", type: "multi", options: ["있음", "없음"] },
            { key: "price", label: "가격", type: "multi", options: ["무료", "유료"] }
        ]
    },
    rules: {
        id: "rules",
        title: "규정",
        icon: "📋",
        facets: [
            { key: "existence", label: "존재", type: "multi", options: ["있음", "없음"] },
            { key: "rule", label: "규정", type: "multi", options: ["허용", "금지", "조건부"] }
        ]
    }
};

export default function TemplateManager({ initialTemplates = {}, onSave = () => { }, onClose }) {
    const [templates, setTemplates] = React.useState(() => {
        const hasAny = initialTemplates && Object.keys(initialTemplates).length > 0;
        return hasAny ? initialTemplates : DEFAULT_TEMPLATES;
    });
    const [activeSheet, setActiveSheet] = React.useState("facility");
    const [expandedFacets, setExpandedFacets] = React.useState({});

    const activeTemplate = templates?.[activeSheet] ?? { facets: [], icon: "", title: "" };

    // Facet 펼치기/접기
    const toggleFacet = (facetKey) => {
        setExpandedFacets(prev => ({
            ...prev,
            [facetKey]: !prev[facetKey]
        }));
    };

    // 옵션 추가
    const addOption = (facetKey) => {
        const newOption = prompt("새 옵션을 입력하세요:");
        if (!newOption || !newOption.trim()) return;
        setTemplates(prev => {
            const updated = { ...prev };
            const sheet = updated[activeSheet] ||= { id: activeSheet, title: activeSheet, icon: "", facets: [] };
            const facet = sheet.facets.find(f => f.key === facetKey);
            if (!facet) return updated;
            facet.options = Array.from(new Set([...(facet.options || []), newOption.trim()]));
            return updated;
        });
    };

    // 옵션 삭제
    const removeOption = (facetKey, optionIndex) => {
        if (!confirm("이 옵션을 삭제하시겠습니까?")) return;

        setTemplates(prev => {
            const updated = { ...prev };
            const facet = updated[activeSheet].facets.find(f => f.key === facetKey);
            if (facet) {
                facet.options = facet.options.filter((_, idx) => idx !== optionIndex);
            }
            return updated;
        });
    };

    // Facet 추가
    const addFacet = () => {
        const key = prompt("필드 키를 입력하세요 (예: hours, quantity):");
        if (!key || !key.trim()) return;

        const label = prompt("필드 라벨을 입력하세요 (예: 운영시간, 수량):");
        if (!label || !label.trim()) return;

        setTemplates(prev => {
            const updated = { ...prev };
            updated[activeSheet].facets.push({
                key: key.trim(),
                label: label.trim(),
                type: "multi",
                options: []
            });
            return updated;
        });
    };

    // 저장
    const handleSave = () => {
        onSave(templates);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
            {/* 모달 */}
            <div className="w-full sm:max-w-4xl h-[90vh] sm:h-auto sm:max-h-[85vh] bg-white sm:rounded-2xl shadow-2xl flex flex-col">
                {/* 헤더 - 모바일 최적화 */}
                <div className="sticky top-0 z-10 bg-gradient-to-r from-yellow-400 to-amber-400 px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">템플릿 관리</h2>
                        <p className="text-xs sm:text-sm text-gray-700 mt-1">옵션 템플릿을 편집하세요</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-white/90 hover:bg-white flex items-center justify-center transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-900" />
                    </button>
                </div>

                {/* 시트 탭 - 가로 스크롤 + 크기 통일 */}
                <div className="bg-white border-b-2 border-gray-200 overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2 px-4 py-3">
                        {Object.values(templates).map(sheet => (
                            <button
                                key={sheet.id}
                                onClick={() => setActiveSheet(sheet.id)}
                                className={`
                                    flex-shrink-0 min-w-[120px] flex items-center justify-center gap-2 
                                    px-4 py-3 rounded-xl font-semibold transition-all
                                    ${activeSheet === sheet.id
                                        ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 shadow-md'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }
                                `}
                            >
                                <span className="text-lg">{sheet.icon}</span>
                                <span className="text-sm whitespace-nowrap">{sheet.title}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 컨텐츠 영역 - 스크롤 가능 */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <div className="space-y-4">
                        {/* Facet 목록 */}
                        {(activeTemplate?.facets ?? []).map((facet, i) => (
                            <div
                                key={facet.key}
                                className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden"
                            >
                                {/* Facet 헤더 */}
                                <button
                                    onClick={() => toggleFacet(facet.key)}
                                    className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        {expandedFacets[facet.key] ? (
                                            <ChevronDown className="w-5 h-5 text-gray-400" />
                                        ) : (
                                            <ChevronRight className="w-5 h-5 text-gray-400" />
                                        )}
                                        <div className="text-left">
                                            <div className="font-bold text-gray-900">{facet.label}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">
                                                {facet.options.length}개 옵션
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-mono text-gray-400">
                                        {facet.key}
                                    </div>
                                </button>

                                {/* Facet 옵션 - 펼쳐짐 */}
                                {expandedFacets[facet.key] && (
                                    <div className="border-t-2 border-gray-200 p-4 bg-gray-50 space-y-2">
                                        {/* 옵션 목록 */}
                                        {facet.options.map((option, optIndex) => (
                                            <div
                                                key={optIndex}
                                                className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-lg border border-gray-200"
                                            >
                                                <div className="flex-1 text-sm text-gray-900">
                                                    {option}
                                                </div>
                                                <button
                                                    onClick={() => removeOption(facet.key, optIndex)}
                                                    className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
                                                    title="삭제"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-600" />
                                                </button>
                                            </div>
                                        ))}

                                        {/* 시트 탭 오른쪽 */}
                                        <button
                                            onClick={() => {
                                                const id = prompt("새 시트 ID(영문/숫자/underscore):", "custom");
                                                if (!id) return;
                                                const title = prompt("시트 제목:", id) || id;
                                                const icon = prompt("아이콘(이모지):", "🧩") || "🧩";
                                                setTemplates(prev => ({ ...prev, [id]: { id, title, icon, facets: [] } }));
                                                setActiveSheet(id);
                                            }}
                                            className="flex-shrink-0 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600"
                                        > + 시트 </button>

                                        {/* 시트 편집 */}
                                        <div className="flex gap-2 px-4 py-2">
                                            <button onClick={() => {
                                                const title = prompt("새 제목:", (templates[activeSheet]?.title || activeSheet));
                                                if (!title) return;
                                                setTemplates(prev => ({ ...prev, [activeSheet]: { ...prev[activeSheet], title } }));
                                            }} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm">제목변경</button>

                                            <button onClick={() => {
                                                const icon = prompt("새 아이콘(이모지):", (templates[activeSheet]?.icon || "🧩"));
                                                if (!icon) return;
                                                setTemplates(prev => ({ ...prev, [activeSheet]: { ...prev[activeSheet], icon } }));
                                            }} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm">아이콘변경</button>

                                            <button onClick={() => {
                                                if (!confirm("이 시트를 삭제할까요? (데이터는 삭제되지 않습니다)")) return;
                                                setTemplates(prev => {
                                                    const copy = { ...prev }; delete copy[activeSheet];
                                                    const keys = Object.keys(copy); setActiveSheet(keys[0] || "facility");
                                                    return copy;
                                                });
                                            }} className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-sm">시트삭제</button>
                                        </div>


                                        {/* 옵션 추가 버튼 */}
                                        <button
                                            onClick={() => addOption(facet.key)}
                                            className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-yellow-400 hover:text-yellow-600 hover:bg-yellow-50 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span className="text-sm font-medium">옵션 추가</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* 필드 추가 버튼 */}
                        <button
                            onClick={addFacet}
                            className="w-full px-6 py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-600 hover:border-yellow-400 hover:text-yellow-600 hover:bg-yellow-50 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            <span className="font-medium">새 필드 추가</span>
                        </button>
                    </div>
                </div>

                {/* 하단 버튼 - 고정 */}
                <div className="sticky bottom-0 bg-white border-t-2 border-gray-200 p-4 sm:p-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3.5 rounded-xl border-2 border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-all"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 px-6 py-3.5 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 font-bold hover:shadow-lg hover:shadow-yellow-400/30 transition-all flex items-center justify-center gap-2"
                    >
                        <Save className="w-5 h-5" />
                        <span>저장</span>
                    </button>
                </div>
            </div>

            {/* 스크롤바 숨기기 CSS */}
            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}