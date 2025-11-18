// components/mypage/LibraryManager.tsx
// 라이브러리 관리 시스템 - 링크, 비밀번호, 규정, 공통정보 중앙 관리

import React from "react";
import { Plus, X, Edit3, Link as LinkIcon, Lock, FileText, Info, Trash2, AlertCircle } from "lucide-react";

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────
type LibraryType = "links" | "passwords" | "rules" | "info";

interface LibraryItem {
    key: string;
    label: string;
    value: string;
    usageCount?: number; // 사용 중인 항목 개수
}

interface LibraryData {
    links: Record<string, { label: string; value: string }>;
    passwords: Record<string, { label: string; value: string }>;
    rules: Record<string, { label: string; value: string }>;
    info: Record<string, { label: string; value: string }>;
}

interface LibraryManagerProps {
    initialData?: LibraryData;
    onSave?: (data: LibraryData) => void;
}

// ────────────────────────────────────────────────────────────
// 라이브러리 타입별 설정 (동적)
// ────────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = {
    links: {
        icon: LinkIcon,
        label: "링크",
        placeholder: "https://example.com",
        color: "blue",
    },
    passwords: {
        icon: Lock,
        label: "비밀번호",
        placeholder: "1234",
        color: "red",
    },
    rules: {
        icon: FileText,
        label: "규정",
        placeholder: "이 공간에서는...",
        color: "green",
    },
    info: {
        icon: Info,
        label: "공통정보",
        placeholder: "운영 시간: 09:00-22:00",
        color: "purple",
    },
};

// ────────────────────────────────────────────────────────────
// 모달 컴포넌트
// ────────────────────────────────────────────────────────────
function EditModal({ isOpen, onClose, item, type, onSave, categories }: any) {
    const [label, setLabel] = React.useState(item?.label || "");
    const [value, setValue] = React.useState(item?.value || "");
    const config = categories?.[type as LibraryType] || DEFAULT_CATEGORIES.links;

    React.useEffect(() => {
        if (isOpen) {
            setLabel(item?.label || "");
            setValue(item?.value || "");
        }
    }, [isOpen, item]);

    const handleSave = () => {
        if (!label.trim() || !value.trim()) {
            alert("이름과 값을 모두 입력해주세요.");
            return;
        }
        onSave({ label: label.trim(), value: value.trim() });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* 헤더 */}
                <div className="px-6 py-5 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">
                            {item ? `${config.label} 편집` : `새 ${config.label} 추가`}
                        </h3>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                        >
                            <X className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>
                </div>

                {/* 컨텐츠 */}
                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            이름
                        </label>
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="예: 스터디룸 예약"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent focus:bg-white transition-colors"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                            값
                        </label>
                        {type === "rules" ? (
                            <textarea
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder={config.placeholder}
                                rows={4}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent focus:bg-white transition-colors resize-none"
                            />
                        ) : (
                            <input
                                type="text"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder={config.placeholder}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent focus:bg-white transition-colors"
                            />
                        )}
                    </div>
                </div>

                {/* 버튼 */}
                <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition-colors shadow-lg"
                    >
                        저장
                    </button>
                </div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────
export default function LibraryManager({ initialData, onSave }: LibraryManagerProps) {
    const [activeTab, setActiveTab] = React.useState<LibraryType>("links");
    const [data, setData] = React.useState<LibraryData>(
        initialData || {
            links: {},
            passwords: {},
            rules: {},
            info: {},
        }
    );
    const [categories, setCategories] = React.useState(DEFAULT_CATEGORIES);
    const [editModalOpen, setEditModalOpen] = React.useState(false);
    const [editingItem, setEditingItem] = React.useState<{ key?: string; label?: string; value?: string } | null>(null);
    const [categoryModalOpen, setCategoryModalOpen] = React.useState(false);
    const [newCategoryName, setNewCategoryName] = React.useState("");
    const [isEditMode, setIsEditMode] = React.useState(false); // 편집 모드

    // 자동 저장
    React.useEffect(() => {
        const timer = setTimeout(() => {
            onSave?.(data);
        }, 500);
        return () => clearTimeout(timer);
    }, [data, onSave]);

    // 카테고리 추가
    const handleAddCategory = () => {
        if (!newCategoryName.trim()) {
            alert("카테고리 이름을 입력해주세요.");
            return;
        }

        const key = newCategoryName.toLowerCase().replace(/\s+/g, "_");

        if (categories[key as keyof typeof categories]) {
            alert("이미 존재하는 카테고리입니다.");
            return;
        }

        setCategories(prev => ({
            ...prev,
            [key]: {
                icon: Info,
                label: newCategoryName.trim(),
                placeholder: "내용을 입력하세요",
                color: "gray",
            }
        }));

        setData(prev => ({
            ...prev,
            [key]: {},
        }));

        setNewCategoryName("");
        setCategoryModalOpen(false);
        setActiveTab(key as LibraryType);
    };

    // 카테고리 삭제
    const handleDeleteCategory = (key: string) => {
        // 기본 카테고리는 삭제 불가
        if (DEFAULT_CATEGORIES[key as keyof typeof DEFAULT_CATEGORIES]) {
            alert("기본 카테고리는 삭제할 수 없습니다.");
            return;
        }

        const itemCount = Object.keys(data[key as keyof LibraryData] || {}).length;

        if (itemCount > 0) {
            if (!confirm(`이 카테고리에 ${itemCount}개의 항목이 있습니다.\n정말 삭제하시겠습니까?`)) {
                return;
            }
        }

        setCategories(prev => {
            const newCategories = { ...prev };
            delete newCategories[key as keyof typeof newCategories];
            return newCategories;
        });

        setData(prev => {
            const newData = { ...prev };
            delete newData[key as keyof LibraryData];
            return newData;
        });

        setActiveTab("links");
    };

    const handleAdd = () => {
        setEditingItem(null);
        setEditModalOpen(true);
    };

    const handleEdit = (key: string, item: { label: string; value: string }) => {
        setEditingItem({ key, ...item });
        setEditModalOpen(true);
    };

    const handleSave = (item: { label: string; value: string }) => {
        const key = editingItem?.key || item.label.toLowerCase().replace(/\s+/g, "_");

        setData((prev) => ({
            ...prev,
            [activeTab]: {
                ...prev[activeTab],
                [key]: item,
            },
        }));
    };

    const handleDelete = (key: string) => {
        if (!confirm("정말 삭제하시겠습니까?\n\n이 항목을 사용 중인 데이터가 있을 수 있습니다.")) {
            return;
        }

        setData((prev) => {
            const newData = { ...prev };
            delete newData[activeTab][key];
            return newData;
        });
    };

    const currentItems: LibraryItem[] = Object.entries(data[activeTab] || {}).map(([key, item]) => ({
        key,
        ...item,
    }));

    const config = categories[activeTab as keyof typeof categories] || categories.links;
    const Icon = config.icon;

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
            {/* 설명 헤더 - 통일된 디자인 */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
                    <p className="text-sm text-gray-600">
                        링크, 비밀번호, 규정 등을 중앙에서 관리하고 여러 항목에서 재사용하세요
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 relative">{/* relative 추가 */}
                {/* 미니멀 세그먼트 탭 - 작게, 스크롤 가능 */}
                <div className="mb-8 overflow-x-auto scrollbar-hide">
                    <div className="flex justify-center min-w-max">
                        <div className="inline-flex items-center gap-1 p-1 bg-black/5 rounded-full shadow-sm">
                            {Object.keys(categories).map((type) => {
                                const conf = categories[type as keyof typeof categories];
                                const TypeIcon = conf.icon;
                                const count = Object.keys(data[type as keyof LibraryData] || {}).length;
                                const isDefault = DEFAULT_CATEGORIES[type as keyof typeof DEFAULT_CATEGORIES];

                                return (
                                    <div key={type} className="relative">
                                        <button
                                            onClick={() => setActiveTab(type as LibraryType)}
                                            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeTab === type
                                                ? "text-gray-900 bg-white shadow-lg"
                                                : "text-gray-500 hover:text-gray-700"
                                                }`}
                                        >
                                            <span>{conf.label}</span>
                                            {count > 0 && (
                                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === type
                                                    ? "bg-gray-100 text-gray-700"
                                                    : "bg-gray-200 text-gray-600"
                                                    }`}>
                                                    {count}
                                                </span>
                                            )}

                                            {/* 삭제 버튼 (편집 모드 + 커스텀 카테고리만) */}
                                            {isEditMode && !isDefault && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteCategory(type);
                                                    }}
                                                    className="ml-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                                                    title="카테고리 삭제"
                                                >
                                                    <X className="w-2.5 h-2.5" />
                                                </button>
                                            )}
                                        </button>
                                    </div>
                                );
                            })}

                            {/* 카테고리 추가 버튼 (편집 모드만) */}
                            {isEditMode && (
                                <button
                                    onClick={() => setCategoryModalOpen(true)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-gray-500 hover:text-gray-900 hover:bg-white/50 transition-all font-medium"
                                    title="카테고리 추가"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 리스트 */}
                <div className="space-y-3">
                    {currentItems.length === 0 ? (
                        <div className="bg-white/60 backdrop-blur-sm rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                                <Icon className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-lg font-semibold text-gray-900 mb-2">
                                {config.label} 없음
                            </p>
                            <p className="text-sm text-gray-500 mb-6">
                                회원에게 안내 될 {config.label} 추가하기
                            </p>
                            <button
                                onClick={handleAdd}
                                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gray-900 text-white font-medium hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
                            >
                                <Plus className="w-5 h-5" />
                                {config.label} 추가
                            </button>
                        </div>
                    ) : (
                        <>
                            {currentItems.map((item) => (
                                <div
                                    key={item.key}
                                    className="bg-white/60 backdrop-blur-sm rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-md transition-all"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                    <Icon className="w-4 h-4 text-gray-600" />
                                                </div>
                                                <h3 className="font-semibold text-gray-900 truncate">
                                                    {item.label}
                                                </h3>
                                            </div>
                                            <p className="text-sm text-gray-600 break-all ml-10">
                                                {item.value}
                                            </p>
                                            {item.usageCount && item.usageCount > 0 && (
                                                <div className="flex items-center gap-1 mt-3 ml-10">
                                                    <div className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100 flex items-center gap-1.5">
                                                        <AlertCircle className="w-3 h-3 text-amber-600" />
                                                        <span className="text-xs font-medium text-amber-700">
                                                            {item.usageCount}개 항목에서 사용 중
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* 버튼 - 항상 표시 (모바일 고려) */}
                                        <div className="flex flex-col sm:flex-row items-center gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => handleEdit(item.key, item)}
                                                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                                title="편집"
                                            >
                                                <Edit3 className="w-4 h-4 text-gray-600" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.key)}
                                                className="w-9 h-9 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                                                title="삭제"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-600" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* 추가 버튼 - 미니멀 */}
                            <button
                                onClick={handleAdd}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border-2 border-dashed border-gray-200 text-gray-600 hover:border-gray-900 hover:text-gray-900 hover:bg-gray-50 transition-all font-medium"
                            >
                                <Plus className="w-5 h-5" />
                                <span>{config.label} 추가</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* 편집 버튼 - 창 밖에 고정 */}
            <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`fixed bottom-6 right-6 w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all z-50 ${isEditMode
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-gray-900 hover:bg-gray-800 text-white"
                    }`}
                title={isEditMode ? "편집 완료" : "카테고리 편집"}
            >
                {isEditMode ? (
                    <X className="w-5 h-5" />
                ) : (
                    <Edit3 className="w-5 h-5" />
                )}
            </button>

            {/* 편집 모달 */}
            <EditModal
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                item={editingItem}
                type={activeTab}
                categories={categories}
                onSave={handleSave}
            />

            {/* 카테고리 추가 모달 */}
            {categoryModalOpen && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                        <div className="px-6 py-5 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    새 카테고리 추가
                                </h3>
                                <button
                                    onClick={() => {
                                        setCategoryModalOpen(false);
                                        setNewCategoryName("");
                                    }}
                                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                >
                                    <X className="w-4 h-4 text-gray-600" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            <label className="block text-sm font-semibold text-gray-900 mb-2">
                                카테고리 이름
                            </label>
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                                placeholder="예: 공지사항"
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent focus:bg-white transition-colors"
                                autoFocus
                            />
                        </div>

                        <div className="px-6 py-5 border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => {
                                    setCategoryModalOpen(false);
                                    setNewCategoryName("");
                                }}
                                className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-gray-700 font-medium hover:bg-gray-200 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleAddCategory}
                                className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition-colors shadow-lg"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
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