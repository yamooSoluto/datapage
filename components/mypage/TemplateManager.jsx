// components/mypage/TemplateManager.jsx
// 옵션 템플릿 전체 구조 관리 페이지
// 모던 템플릿 관리자 - 드래그 지원 + 카드형 디자인

import React from "react";
import { X, Plus, GripVertical, ChevronDown, ChevronRight, Settings, Save } from "lucide-react";

// 기본 템플릿 데이터
const DEFAULT_TEMPLATES = {
    facility: {
        id: "facility",
        title: "시설/비품",
        icon: "🏢",
        facets: [
            {
                key: "existence",
                label: "존재",
                type: "multi",
                options: ["있음", "없음"]
            },
            {
                key: "cost",
                label: "비용",
                type: "multi",
                options: [
                    "무료",
                    "회원 무료",
                    {
                        group: "유료",
                        items: [
                            "1회 500원",
                            "1회 1,000원",
                            "1회 2,000원"
                        ]
                    },
                    "별도 요금"
                ]
            },
            {
                key: "location",
                label: "위치",
                type: "multi",
                options: [
                    { group: "층별", items: ["1층", "2층", "3층"] },
                    { group: "구역", items: ["로비", "복도", "카페존"] }
                ]
            }
        ]
    },
    room: {
        id: "room",
        title: "룸/존",
        icon: "🚪",
        facets: [
            { key: "existence", label: "존재", type: "multi", options: ["있음", "없음"] },
            {
                key: "capacity",
                label: "정원",
                type: "multi",
                options: [
                    { group: "소규모", items: ["1인", "2인", "3인", "4인"] },
                    { group: "중규모", items: ["5인", "6인", "8인"] }
                ]
            }
        ]
    }
};

// 드래그 앤 드롭 훅
function useDragAndDrop(onReorder) {
    const [draggedItem, setDraggedItem] = React.useState(null);

    const handleDragStart = (e, item, type) => {
        setDraggedItem({ item, type });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, targetItem, targetType) => {
        e.preventDefault();
        if (!draggedItem) return;

        if (draggedItem.type === targetType) {
            onReorder(draggedItem.item, targetItem);
        }

        setDraggedItem(null);
    };

    return { handleDragStart, handleDragOver, handleDrop, draggedItem };
}

// 템플릿 관리자 컴포넌트
function TemplateManager({ initialTemplates, onSave, onClose }) {
    const [templates, setTemplates] = React.useState(initialTemplates || DEFAULT_TEMPLATES);
    const [activeSheet, setActiveSheet] = React.useState("facility");
    const [expandedGroups, setExpandedGroups] = React.useState(new Set());
    const [draggedFacet, setDraggedFacet] = React.useState(null);
    const [draggedOption, setDraggedOption] = React.useState(null);
    const [dropTarget, setDropTarget] = React.useState(null); // 드롭 위치 표시

    const activeTemplate = templates[activeSheet];
    const facets = activeTemplate?.facets || [];

    // 필드 드래그 앤 드롭
    const handleFacetDragStart = (e, facetIdx) => {
        setDraggedFacet(facetIdx);
        e.dataTransfer.effectAllowed = 'move';

        // 마우스 위치에 가까운 고스트 이미지
        const dragElement = e.currentTarget.closest('.facet-card');
        const ghost = dragElement.cloneNode(true);
        ghost.style.position = 'absolute';
        ghost.style.top = '-1000px';
        ghost.style.width = dragElement.offsetWidth + 'px';
        ghost.style.opacity = '0.8';
        ghost.style.backgroundColor = 'white';
        ghost.style.borderRadius = '1rem';
        ghost.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)';
        document.body.appendChild(ghost);

        // 마우스 커서에 가까운 위치로 오프셋 설정
        const rect = dragElement.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        e.dataTransfer.setDragImage(ghost, offsetX, offsetY);

        setTimeout(() => document.body.removeChild(ghost), 0);
    };

    const handleFacetDragOver = (e, targetIdx) => {
        e.preventDefault();
        if (draggedFacet !== null && draggedFacet !== targetIdx) {
            setDropTarget({ type: 'facet', idx: targetIdx });
        }
    };

    const handleFacetDragLeave = () => {
        setDropTarget(null);
    };

    const handleFacetDrop = (e, toIdx) => {
        e.preventDefault();
        if (draggedFacet === null || draggedFacet === toIdx) {
            setDropTarget(null);
            return;
        }

        const newTemplates = { ...templates };
        const facets = [...newTemplates[activeSheet].facets];
        const [removed] = facets.splice(draggedFacet, 1);
        facets.splice(toIdx, 0, removed);
        newTemplates[activeSheet].facets = facets;
        setTemplates(newTemplates);
        setDraggedFacet(null);
        setDropTarget(null);
    };

    const handleFacetDragEnd = () => {
        setDraggedFacet(null);
        setDropTarget(null);
    };

    // 옵션 드래그 앤 드롭
    const handleOptionDragStart = (e, facetIdx, optionIdx) => {
        setDraggedOption({ facetIdx, optionIdx });
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();

        const dragElement = e.currentTarget.closest('.option-item');
        const ghost = dragElement.cloneNode(true);
        ghost.style.position = 'absolute';
        ghost.style.top = '-1000px';
        ghost.style.width = dragElement.offsetWidth + 'px';
        ghost.style.opacity = '0.8';
        ghost.style.backgroundColor = '#f9fafb';
        ghost.style.borderRadius = '0.75rem';
        ghost.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        document.body.appendChild(ghost);

        const rect = dragElement.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        e.dataTransfer.setDragImage(ghost, offsetX, offsetY);

        setTimeout(() => document.body.removeChild(ghost), 0);
    };

    const handleOptionDragOver = (e, facetIdx, targetIdx) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedOption && draggedOption.facetIdx === facetIdx && draggedOption.optionIdx !== targetIdx) {
            setDropTarget({ type: 'option', facetIdx, idx: targetIdx });
        }
    };

    const handleOptionDragLeave = () => {
        setDropTarget(null);
    };

    const handleOptionDrop = (e, facetIdx, toIdx) => {
        e.preventDefault();
        e.stopPropagation();
        if (!draggedOption || draggedOption.facetIdx !== facetIdx || draggedOption.optionIdx === toIdx) {
            setDropTarget(null);
            setDraggedOption(null);
            return;
        }

        const newTemplates = { ...templates };
        const options = [...newTemplates[activeSheet].facets[facetIdx].options];
        const [removed] = options.splice(draggedOption.optionIdx, 1);
        options.splice(toIdx, 0, removed);
        newTemplates[activeSheet].facets[facetIdx].options = options;
        setTemplates(newTemplates);
        setDraggedOption(null);
        setDropTarget(null);
    };

    const handleOptionDragEnd = () => {
        setDraggedOption(null);
        setDropTarget(null);
    };

    // 그룹 내 아이템 드래그 앤 드롭
    const handleGroupItemDragStart = (e, facetIdx, groupIdx, itemIdx) => {
        setDraggedOption({ facetIdx, groupIdx, itemIdx });
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();

        const dragElement = e.currentTarget.closest('.group-item');
        const ghost = dragElement.cloneNode(true);
        ghost.style.position = 'absolute';
        ghost.style.top = '-1000px';
        ghost.style.width = dragElement.offsetWidth + 'px';
        ghost.style.opacity = '0.8';
        ghost.style.backgroundColor = 'white';
        ghost.style.borderRadius = '0.5rem';
        ghost.style.boxShadow = '0 4px 12px rgba(251, 191, 36, 0.2)';
        document.body.appendChild(ghost);

        const rect = dragElement.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        e.dataTransfer.setDragImage(ghost, offsetX, offsetY);

        setTimeout(() => document.body.removeChild(ghost), 0);
    };

    const handleGroupItemDragOver = (e, facetIdx, groupIdx, targetIdx) => {
        e.preventDefault();
        e.stopPropagation();
        if (draggedOption &&
            draggedOption.facetIdx === facetIdx &&
            draggedOption.groupIdx === groupIdx &&
            draggedOption.itemIdx !== targetIdx) {
            setDropTarget({ type: 'groupItem', facetIdx, groupIdx, idx: targetIdx });
        }
    };

    const handleGroupItemDrop = (e, facetIdx, groupIdx, toIdx) => {
        e.preventDefault();
        e.stopPropagation();
        if (!draggedOption ||
            draggedOption.facetIdx !== facetIdx ||
            draggedOption.groupIdx !== groupIdx ||
            draggedOption.itemIdx === toIdx) {
            setDropTarget(null);
            setDraggedOption(null);
            return;
        }

        const newTemplates = { ...templates };
        const group = newTemplates[activeSheet].facets[facetIdx].options[groupIdx];
        const items = [...group.items];
        const [removed] = items.splice(draggedOption.itemIdx, 1);
        items.splice(toIdx, 0, removed);
        group.items = items;
        setTemplates(newTemplates);
        setDraggedOption(null);
        setDropTarget(null);
    };

    const toggleGroup = (facetIdx, groupIdx) => {
        const key = `${facetIdx}-${groupIdx}`;
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const deleteOption = (facetIdx, groupIdx, optionIdx) => {
        const newTemplates = { ...templates };
        const facet = newTemplates[activeSheet].facets[facetIdx];

        if (groupIdx === -1) {
            facet.options.splice(optionIdx, 1);
        } else {
            const group = facet.options[groupIdx];
            group.items.splice(optionIdx, 1);

            if (group.items.length === 0) {
                facet.options.splice(groupIdx, 1);
            }
        }

        setTemplates(newTemplates);
    };

    const deleteGroup = (facetIdx, groupIdx) => {
        if (!confirm('그룹 전체를 삭제하시겠습니까?')) return;

        const newTemplates = { ...templates };
        const facet = newTemplates[activeSheet].facets[facetIdx];
        facet.options.splice(groupIdx, 1);
        setTemplates(newTemplates);
    };

    const addOption = (facetIdx, groupIdx = -1) => {
        const text = prompt(groupIdx === -1 ? '옵션 이름:' : '그룹 내 옵션 이름:');
        if (!text?.trim()) return;

        const newTemplates = { ...templates };
        const facet = newTemplates[activeSheet].facets[facetIdx];

        if (groupIdx === -1) {
            facet.options.push(text.trim());
        } else {
            const group = facet.options[groupIdx];
            group.items.push(text.trim());
        }

        setTemplates(newTemplates);
    };

    const addGroup = (facetIdx) => {
        const groupName = prompt('그룹 이름:');
        if (!groupName?.trim()) return;

        const newTemplates = { ...templates };
        const facet = newTemplates[activeSheet].facets[facetIdx];

        facet.options.push({
            group: groupName.trim(),
            items: []
        });

        setTemplates(newTemplates);
    };

    const addFacet = () => {
        const key = prompt('필드 key (영문):');
        if (!key?.trim()) return;
        const label = prompt('필드 이름 (한글):');
        if (!label?.trim()) return;

        const newTemplates = { ...templates };
        newTemplates[activeSheet].facets.push({
            key: key.trim(),
            label: label.trim(),
            type: "multi",
            options: []
        });

        setTemplates(newTemplates);
    };

    const deleteFacet = (facetIdx) => {
        if (!confirm('필드 전체를 삭제하시겠습니까?')) return;

        const newTemplates = { ...templates };
        newTemplates[activeSheet].facets.splice(facetIdx, 1);
        setTemplates(newTemplates);
    };

    const handleSave = () => {
        onSave?.(templates);
        alert('✅ 템플릿이 저장되었습니다!');
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* 헤더 */}
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-gray-50 to-white">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">옵션 템플릿 관리</h2>
                        <p className="text-sm text-gray-500 mt-1">그룹과 옵션을 드래그하여 순서를 변경하세요</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleSave}
                            className="px-5 py-2.5 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 font-semibold rounded-xl hover:from-yellow-500 hover:to-amber-500 transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            저장
                        </button>
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                        >
                            닫기
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex">
                    {/* 사이드바 */}
                    <div className="w-56 border-r border-gray-100 bg-gray-50/50 p-6 overflow-y-auto flex-shrink-0">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">시트</h3>
                        <div className="space-y-1.5">
                            {Object.keys(templates).map(sheetId => {
                                const template = templates[sheetId];
                                const isActive = activeSheet === sheetId;
                                return (
                                    <button
                                        key={sheetId}
                                        onClick={() => setActiveSheet(sheetId)}
                                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive
                                            ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 shadow-md'
                                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-100'
                                            }`}
                                    >
                                        <span className="mr-2">{template.icon}</span>
                                        {template.title}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 메인 */}
                    <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30">
                        <div className="max-w-4xl mx-auto space-y-4">
                            {facets.map((facet, facetIdx) => {
                                const isDragging = draggedFacet === facetIdx;
                                const isDropTarget = dropTarget?.type === 'facet' && dropTarget.idx === facetIdx;

                                return (
                                    <div key={facetIdx} className="relative">
                                        {/* 드롭 인디케이터 (위) */}
                                        {isDropTarget && draggedFacet < facetIdx && (
                                            <div className="absolute -top-2 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 to-amber-400 rounded-full shadow-lg z-10"></div>
                                        )}

                                        <div
                                            className={`facet-card bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-100 ${isDragging ? 'opacity-30' : ''
                                                } ${isDropTarget ? 'ring-2 ring-yellow-400 ring-offset-2' : ''}`}
                                            onDragOver={(e) => handleFacetDragOver(e, facetIdx)}
                                            onDragLeave={handleFacetDragLeave}
                                            onDrop={(e) => handleFacetDrop(e, facetIdx)}
                                        >
                                            {/* 필드 헤더 */}
                                            <div className="flex items-center justify-between mb-5">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="drag-handle cursor-grab active:cursor-grabbing"
                                                        draggable
                                                        onDragStart={(e) => handleFacetDragStart(e, facetIdx)}
                                                        onDragEnd={handleFacetDragEnd}
                                                    >
                                                        <GripVertical className="w-5 h-5 text-gray-300 hover:text-yellow-500 transition-colors" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-gray-900 text-lg">{facet.label}</h4>
                                                        <span className="text-xs text-gray-400">({facet.key})</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => addOption(facetIdx)}
                                                        className="px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-medium text-gray-700 flex items-center gap-1.5 transition-all border border-gray-200"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                        옵션
                                                    </button>
                                                    <button
                                                        onClick={() => addGroup(facetIdx)}
                                                        className="px-3 py-2 bg-yellow-50 hover:bg-yellow-100 rounded-lg text-xs font-medium text-gray-900 transition-all border border-yellow-200"
                                                    >
                                                        +그룹
                                                    </button>
                                                    <button
                                                        onClick={() => deleteFacet(facetIdx)}
                                                        className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-all"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* 옵션 목록 */}
                                            <div className="space-y-2">
                                                {facet.options.map((opt, optIdx) => {
                                                    if (typeof opt === 'string') {
                                                        const isDragging = draggedOption?.facetIdx === facetIdx && draggedOption?.optionIdx === optIdx;
                                                        const isDropTarget = dropTarget?.type === 'option' && dropTarget.facetIdx === facetIdx && dropTarget.idx === optIdx;

                                                        return (
                                                            <div key={optIdx} className="relative">
                                                                {/* 드롭 인디케이터 */}
                                                                {isDropTarget && draggedOption.optionIdx < optIdx && (
                                                                    <div className="absolute -top-1 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-400 to-amber-400 rounded-full shadow-md z-10"></div>
                                                                )}

                                                                <div
                                                                    className={`option-item flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all group border border-gray-100 ${isDragging ? 'opacity-30' : ''
                                                                        } ${isDropTarget ? 'ring-2 ring-yellow-400' : ''}`}
                                                                    onDragOver={(e) => handleOptionDragOver(e, facetIdx, optIdx)}
                                                                    onDragLeave={handleOptionDragLeave}
                                                                    onDrop={(e) => handleOptionDrop(e, facetIdx, optIdx)}
                                                                >
                                                                    <div
                                                                        className="drag-handle cursor-grab active:cursor-grabbing"
                                                                        draggable
                                                                        onDragStart={(e) => handleOptionDragStart(e, facetIdx, optIdx)}
                                                                        onDragEnd={handleOptionDragEnd}
                                                                    >
                                                                        <GripVertical className="w-4 h-4 text-gray-300 group-hover:text-yellow-500 transition-colors" />
                                                                    </div>
                                                                    <span className="flex-1 text-sm text-gray-700 font-medium">{opt}</span>
                                                                    <button
                                                                        onClick={() => deleteOption(facetIdx, -1, optIdx)}
                                                                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white rounded-lg text-red-500 transition-all"
                                                                    >
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                </div>

                                                                {/* 드롭 인디케이터 (아래) */}
                                                                {isDropTarget && draggedOption.optionIdx > optIdx && (
                                                                    <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-400 to-amber-400 rounded-full shadow-md z-10"></div>
                                                                )}
                                                            </div>
                                                        );
                                                    } else if (opt.group) {
                                                        const isExpanded = expandedGroups.has(`${facetIdx}-${optIdx}`);
                                                        return (
                                                            <div key={optIdx} className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl overflow-hidden border border-amber-100">
                                                                <div className="flex items-center gap-3 px-4 py-3 group">
                                                                    <button
                                                                        onClick={() => toggleGroup(facetIdx, optIdx)}
                                                                        className="flex items-center gap-2 flex-1 text-left"
                                                                    >
                                                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-amber-600" /> : <ChevronRight className="w-4 h-4 text-amber-600" />}
                                                                        <span className="font-bold text-sm text-gray-900">{opt.group}</span>
                                                                        <span className="text-xs text-amber-600 font-medium px-2 py-0.5 bg-amber-100 rounded-full">
                                                                            {opt.items.length}
                                                                        </span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => addOption(facetIdx, optIdx)}
                                                                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-amber-100 rounded-lg text-amber-700 transition-all"
                                                                    >
                                                                        <Plus className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteGroup(facetIdx, optIdx)}
                                                                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded-lg text-red-500 transition-all"
                                                                    >
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                                {isExpanded && (
                                                                    <div className="px-4 pb-3 space-y-2">
                                                                        {opt.items.map((item, itemIdx) => {
                                                                            const isDragging = draggedOption?.facetIdx === facetIdx && draggedOption?.groupIdx === optIdx && draggedOption?.itemIdx === itemIdx;
                                                                            const isDropTarget = dropTarget?.type === 'groupItem' && dropTarget.facetIdx === facetIdx && dropTarget.groupIdx === optIdx && dropTarget.idx === itemIdx;

                                                                            return (
                                                                                <div key={itemIdx} className="relative">
                                                                                    {/* 드롭 인디케이터 */}
                                                                                    {isDropTarget && draggedOption.itemIdx < itemIdx && (
                                                                                        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full shadow-sm z-10"></div>
                                                                                    )}

                                                                                    <div
                                                                                        className={`group-item flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-amber-50/50 rounded-lg transition-all ml-6 group border border-amber-100 ${isDragging ? 'opacity-30' : ''
                                                                                            } ${isDropTarget ? 'ring-2 ring-amber-400' : ''}`}
                                                                                        onDragOver={(e) => handleGroupItemDragOver(e, facetIdx, optIdx, itemIdx)}
                                                                                        onDragLeave={handleOptionDragLeave}
                                                                                        onDrop={(e) => handleGroupItemDrop(e, facetIdx, optIdx, itemIdx)}
                                                                                    >
                                                                                        <div
                                                                                            className="drag-handle cursor-grab active:cursor-grabbing"
                                                                                            draggable
                                                                                            onDragStart={(e) => handleGroupItemDragStart(e, facetIdx, optIdx, itemIdx)}
                                                                                            onDragEnd={handleOptionDragEnd}
                                                                                        >
                                                                                            <GripVertical className="w-3.5 h-3.5 text-gray-300 group-hover:text-amber-500 transition-colors" />
                                                                                        </div>
                                                                                        <span className="flex-1 text-sm text-gray-700">{item}</span>
                                                                                        <button
                                                                                            onClick={() => deleteOption(facetIdx, optIdx, itemIdx)}
                                                                                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded text-red-500 transition-all"
                                                                                        >
                                                                                            <X className="w-3.5 h-3.5" />
                                                                                        </button>
                                                                                    </div>

                                                                                    {/* 드롭 인디케이터 (아래) */}
                                                                                    {isDropTarget && draggedOption.itemIdx > itemIdx && (
                                                                                        <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full shadow-sm z-10"></div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                        {opt.items.length === 0 && (
                                                                            <p className="text-xs text-amber-600/60 text-center py-3">옵션이 없습니다</p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    }
                                                })}
                                                {facet.options.length === 0 && (
                                                    <p className="text-sm text-gray-400 text-center py-8">옵션이 없습니다</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* 드롭 인디케이터 (아래) */}
                                        {isDropTarget && draggedFacet > facetIdx && (
                                            <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 to-amber-400 rounded-full shadow-lg z-10"></div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* 필드 추가 */}
                            <button
                                onClick={addFacet}
                                className="w-full py-6 border-2 border-dashed border-gray-200 rounded-2xl hover:border-yellow-300 hover:bg-yellow-50/30 text-gray-500 hover:text-gray-700 transition-all flex items-center justify-center gap-2 group"
                            >
                                <Plus className="w-5 h-5 group-hover:text-yellow-600 transition-colors" />
                                <span className="font-medium">필드 추가</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// 메인 데모 페이지
export default function TemplateDemoPage() {
    const [showManager, setShowManager] = React.useState(true);
    const [templates, setTemplates] = React.useState(DEFAULT_TEMPLATES);

    const handleSave = (newTemplates) => {
        setTemplates(newTemplates);
        console.log('저장된 템플릿:', JSON.stringify(newTemplates, null, 2));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-3xl shadow-xl p-10 text-center">
                    <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                        템플릿 관리자
                    </h1>
                    <p className="text-gray-500 mb-8">
                        모던하고 깔끔한 디자인 • 드래그 앤 드롭 지원
                    </p>

                    <button
                        onClick={() => setShowManager(true)}
                        className="px-8 py-4 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 font-bold rounded-2xl hover:from-yellow-500 hover:to-amber-500 transition-all shadow-lg hover:shadow-xl flex items-center gap-3 mx-auto"
                    >
                        <Settings className="w-5 h-5" />
                        템플릿 관리 열기
                    </button>

                    <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        <div className="p-6 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-100">
                            <h3 className="font-bold mb-3 text-gray-900">✨ 디자인</h3>
                            <ul className="text-sm text-gray-600 space-y-2">
                                <li>• 카드형 레이아웃</li>
                                <li>• 노란색 포인트</li>
                                <li>• 깔끔한 그라데이션</li>
                                <li>• 부드러운 그림자</li>
                            </ul>
                        </div>

                        <div className="p-6 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border border-amber-100">
                            <h3 className="font-bold mb-3 text-gray-900">🎯 기능</h3>
                            <ul className="text-sm text-gray-700 space-y-2">
                                <li>• 드래그 앤 드롭</li>
                                <li>• 그룹 접기/펼치기</li>
                                <li>• 호버 시 버튼 표시</li>
                                <li>• 개수 뱃지</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {showManager && (
                <TemplateManager
                    initialTemplates={templates}
                    onSave={handleSave}
                    onClose={() => setShowManager(false)}
                />
            )}
        </div>
    );
}