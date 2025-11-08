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
// 라이브러리 타입별 설정
// ────────────────────────────────────────────────────────────
const LIBRARY_CONFIG = {
    links: {
        icon: LinkIcon,
        label: "링크",
        namePlaceholder: "예: 스터디룸 예약",
        valuePlaceholder: "https://study.example.com/reserve",
        color: "blue",
    },
    passwords: {
        icon: Lock,
        label: "비밀번호",
        namePlaceholder: "예: 와이파이",
        valuePlaceholder: "wifi12345",
        color: "red",
    },
    rules: {
        icon: FileText,
        label: "규정",
        namePlaceholder: "예: 취식 규정",
        valuePlaceholder: "이 공간에서는 음료와 간식류만 섭취 가능합니다.",
        color: "green",
    },
    info: {
        icon: Info,
        label: "공통정보",
        namePlaceholder: "예: 운영 시간",
        valuePlaceholder: "평일 09:00-22:00, 주말 10:00-20:00",
        color: "purple",
    },
};

// ────────────────────────────────────────────────────────────
// 커스텀 탭 추가 모달
// ────────────────────────────────────────────────────────────
function CustomTabModal({ isOpen, onClose, onAdd }: any) {
    const [tabName, setTabName] = React.useState("");

    React.useEffect(() => {
        if (isOpen) {
            setTabName("");
        }
    }, [isOpen]);

    const handleAdd = () => {
        if (!tabName.trim()) {
            alert("탭 이름을 입력해주세요.");
            return;
        }
        onAdd(tabName.trim());
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">
                            새 탭 추가
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            탭 이름
                        </label>
                        <input
                            type="text"
                            value={tabName}
                            onChange={(e) => setTabName(e.target.value)}
                            placeholder="예: 이메일, 전화번호, 주소 등"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                            autoFocus
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            원하는 데이터 유형의 이름을 입력하세요
                        </p>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleAdd}
                        className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
                    >
                        추가
                    </button>
                </div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// 모달 컴포넌트
// ────────────────────────────────────────────────────────────
function EditModal({ isOpen, onClose, item, type, onSave }: any) {
    const [label, setLabel] = React.useState(item?.label || "");
    const [value, setValue] = React.useState(item?.value || "");
    const config = LIBRARY_CONFIG[type as LibraryType];

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">
                            {item ? `${config.label} 편집` : `새 ${config.label} 추가`}
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            이름
                        </label>
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder={config.namePlaceholder}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            값
                        </label>
                        {type === "rules" || type === "info" ? (
                            <textarea
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder={config.valuePlaceholder}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                            />
                        ) : (
                            <input
                                type="text"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder={config.valuePlaceholder}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                            />
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
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
    const [editModalOpen, setEditModalOpen] = React.useState(false);
    const [editingItem, setEditingItem] = React.useState<{ key?: string; label?: string; value?: string } | null>(null);
    const [customTabModalOpen, setCustomTabModalOpen] = React.useState(false);
    const [customTabs, setCustomTabs] = React.useState<Record<string, { label: string; icon: any }>>({});

    // 자동 저장
    React.useEffect(() => {
        const timer = setTimeout(() => {
            onSave?.(data);
        }, 500);
        return () => clearTimeout(timer);
    }, [data, onSave]);

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

    const handleAddCustomTab = (tabName: string) => {
        const tabKey = tabName.toLowerCase().replace(/\s+/g, "_");

        setCustomTabs((prev) => ({
            ...prev,
            [tabKey]: {
                label: tabName,
                icon: FileText, // 기본 아이콘
            },
        }));

        setData((prev) => ({
            ...prev,
            [tabKey]: {},
        }));

        setActiveTab(tabKey as LibraryType);
    };

    const handleDeleteCustomTab = (tabKey: string) => {
        if (!confirm(`"${customTabs[tabKey]?.label}" 탭을 삭제하시겠습니까?\n\n이 탭의 모든 데이터가 삭제됩니다.`)) {
            return;
        }

        setCustomTabs((prev) => {
            const newTabs = { ...prev };
            delete newTabs[tabKey];
            return newTabs;
        });

        setData((prev) => {
            const newData = { ...prev };
            delete newData[tabKey];
            return newData;
        });

        // 기본 탭으로 이동
        setActiveTab("links");
    };

    const currentItems: LibraryItem[] = Object.entries(data[activeTab] || {}).map(([key, item]) => ({
        key,
        ...item,
    }));

    const config = LIBRARY_CONFIG[activeTab] || {
        icon: FileText,
        label: customTabs[activeTab]?.label || activeTab,
        namePlaceholder: "예: 항목 이름",
        valuePlaceholder: "값을 입력하세요",
        color: "gray",
    };
    const Icon = config.icon;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* 헤더 */}
            <div className="bg-white border-b sticky top-0 z-20 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <h1 className="text-2xl font-bold text-gray-900">라이브러리 관리</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        링크, 비밀번호, 규정 등을 중앙에서 관리하고 여러 항목에서 재사용하세요
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                {/* 탭 */}
                <div className="bg-white rounded-2xl shadow-sm p-3 mb-4">
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                        {/* 기본 탭들 */}
                        {(Object.keys(LIBRARY_CONFIG) as LibraryType[]).map((type) => {
                            const conf = LIBRARY_CONFIG[type];
                            const TypeIcon = conf.icon;
                            const count = Object.keys(data[type] || {}).length;

                            return (
                                <button
                                    key={type}
                                    onClick={() => setActiveTab(type)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === type
                                        ? "bg-gray-900 text-white"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                >
                                    <TypeIcon className="w-4 h-4" />
                                    {conf.label}
                                    {count > 0 && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === type ? "bg-white/20" : "bg-gray-200"
                                            }`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}

                        {/* 커스텀 탭들 */}
                        {Object.entries(customTabs).map(([key, tab]) => {
                            const count = Object.keys(data[key] || {}).length;
                            const TabIcon = tab.icon;

                            return (
                                <div key={key} className="relative group">
                                    <button
                                        onClick={() => setActiveTab(key as LibraryType)}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === key
                                            ? "bg-gray-900 text-white"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                            }`}
                                    >
                                        <TabIcon className="w-4 h-4" />
                                        {tab.label}
                                        {count > 0 && (
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === key ? "bg-white/20" : "bg-gray-200"
                                                }`}>
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteCustomTab(key)}
                                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                                        title="탭 삭제"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            );
                        })}

                        {/* 탭 추가 버튼 */}
                        <button
                            onClick={() => setCustomTabModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700"
                            title="새 탭 추가"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">탭 추가</span>
                        </button>
                    </div>
                </div>

                {/* 리스트 */}
                <div className="space-y-3">
                    {currentItems.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                                <Icon className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-lg font-medium text-gray-900 mb-2">
                                {config.label}이 없습니다
                            </p>
                            <p className="text-sm text-gray-500 mb-6">
                                첫 번째 {config.label}을 추가해보세요
                            </p>
                            <button
                                onClick={handleAdd}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors"
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
                                    className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Icon className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                                <h3 className="font-semibold text-gray-900 truncate">
                                                    {item.label}
                                                </h3>
                                            </div>
                                            <p className="text-sm text-gray-600 break-all">
                                                {item.value}
                                            </p>
                                            {item.usageCount && item.usageCount > 0 && (
                                                <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
                                                    <AlertCircle className="w-3 h-3" />
                                                    {item.usageCount}개 항목에서 사용 중
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEdit(item.key, item)}
                                                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                                title="편집"
                                            >
                                                <Edit3 className="w-4 h-4 text-gray-600" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.key)}
                                                className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                                                title="삭제"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-600" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* 추가 버튼 */}
                            <button
                                onClick={handleAdd}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 hover:border-gray-900 hover:bg-gray-50 transition-all font-medium"
                            >
                                <Plus className="w-5 h-5" />
                                <span>{config.label} 추가</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* 편집 모달 */}
            <EditModal
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                item={editingItem}
                type={activeTab}
                onSave={handleSave}
            />

            {/* 커스텀 탭 추가 모달 */}
            <CustomTabModal
                isOpen={customTabModalOpen}
                onClose={() => setCustomTabModalOpen(false)}
                onAdd={handleAddCustomTab}
            />

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