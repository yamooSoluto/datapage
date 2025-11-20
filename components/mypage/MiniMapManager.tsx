// components/mypage/MiniMapManager.tsx
import React from "react";
import MiniMapEditor, {
    type MiniMapData,
} from "@/components/minimap/MiniMapEditor";
import { useMapPalette } from "@/lib/useMapPalette";
import type { CriteriaSheetData } from "@/lib/mapPalette";
import { MapPinned, Loader2 } from "lucide-react";

interface MiniMapManagerProps {
    tenantId?: string;
    criteriaData?: CriteriaSheetData | null;
    defaultFrameId?: string;
}

const DEFAULT_FRAMES = [
    { id: "frame_1f_main", label: "1층 메인" },
    { id: "frame_2f_main", label: "2층 메인" },
];

export default function MiniMapManager({
    tenantId,
    criteriaData,
    defaultFrameId = DEFAULT_FRAMES[0].id,
}: MiniMapManagerProps) {
    const frames = DEFAULT_FRAMES;
    const [activeFrameId, setActiveFrameId] = React.useState(
        () => defaultFrameId || frames[0]?.id || "frame_default"
    );

    React.useEffect(() => {
        if (!defaultFrameId) return;
        setActiveFrameId(defaultFrameId);
    }, [defaultFrameId]);

    const { spaces, facilities } = useMapPalette(criteriaData, {
        spaceSheetIds: ["space", "공간"],
        facilitySheetIds: ["facility", "시설"],
    });

    const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
    const [saveError, setSaveError] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);

    const handleSave = React.useCallback(
        async (mapData: MiniMapData) => {
            if (!tenantId) {
                setSaveError("tenantId가 없어 저장할 수 없습니다.");
                return;
            }
            setIsSaving(true);
            setSaveError(null);
            try {
                const response = await fetch("/api/floor-maps/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tenantId,
                        ...mapData,
                        frameId: activeFrameId,
                    }),
                });

                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(text || "저장에 실패했습니다.");
                }

                setLastSavedAt(
                    new Intl.DateTimeFormat("ko-KR", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                    }).format(new Date())
                );
            } catch (error: any) {
                console.error("MiniMap save failed", error);
                setSaveError(
                    typeof error?.message === "string"
                        ? error.message
                        : "저장 중 오류가 발생했습니다."
                );
            } finally {
                setIsSaving(false);
            }
        },
        [tenantId, activeFrameId]
    );

    const paletteIsEmpty = spaces.length === 0 && facilities.length === 0;

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                            <MapPinned className="w-6 h-6 text-indigo-500" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                                미니맵 관리
                            </h2>
                            <p className="text-sm text-gray-600">
                                Criteria 시트 데이터를 바로 끌어와 공간/시설 팔레트를 구성합니다.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-gray-700">
                            <span className="text-gray-500">공간 후보</span>
                            <strong>{spaces.length}</strong>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-700">
                            <span className="text-gray-500">시설 후보</span>
                            <strong>{facilities.length}</strong>
                        </div>
                        {paletteIsEmpty && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-50 text-yellow-800 text-xs font-medium">
                                Criteria 시트에 항목을 추가하면 자동으로 후보가 생성됩니다.
                            </span>
                        )}
                        {lastSavedAt && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-50 text-green-800 text-xs font-medium">
                                최근 저장: {lastSavedAt}
                            </span>
                        )}
                        {saveError && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium">
                                {saveError}
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">
                                프레임 선택
                            </h3>
                            <p className="text-sm text-gray-500">
                                층/존 별로 다른 미니맵을 관리할 수 있습니다.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <select
                                value={activeFrameId}
                                onChange={(e) => setActiveFrameId(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 bg-white"
                            >
                                {frames.map((frame) => (
                                    <option key={frame.id} value={frame.id}>
                                        {frame.label}
                                    </option>
                                ))}
                            </select>
                            {isSaving && (
                                <span className="inline-flex items-center gap-1 text-gray-500 text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    저장 중...
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-dashed border-gray-200 overflow-hidden bg-gray-50">
                        <MiniMapEditor
                            tenantId={tenantId || "demo-tenant"}
                            frameId={activeFrameId}
                            initialName="기본 미니맵"
                            spaceCandidates={spaces}
                            facilityCandidates={facilities}
                            onSave={handleSave}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

