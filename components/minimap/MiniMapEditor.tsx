// components/minimap/MiniMapEditor.tsx
// 심플하지만 확장 가능한 미니맵 에디터 뼈대
// - 기본 구조 템플릿(ㅁ, ㄱ, ㄴ, T)
// - 공간 / 시설 팔레트
// - 그리드 캔버스 + 요소 배치
// - 선택 / 좌표 수정 / 삭제
// ※ 실제 저장은 onSave에서 처리 (Firestore 연동은 상위에서)

import React, {
    useState,
    useMemo,
    useCallback,
    MouseEvent,
} from "react";
import type { MapCandidate } from "@/lib/mapPalette";

const GRID_SIZE = 40;
const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 640;

// === 타입 정의 ===

// 미니맵에 저장될 벽/문/기둥 같은 구조 요소
export type SegmentType = "wall" | "door" | "column" | "elevator";

export interface Segment {
    id: string;
    type: SegmentType;
    // 벽/문: x1,y1 ~ x2,y2 (그리드 스냅)
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

// 공간(존) 영역 (직사각형 정도로)
export interface ZoneRect {
    id: string;
    kind: "space";
    candidate: MapCandidate;
    x: number;
    y: number;
    width: number;
    height: number;
}

// 시설/아이템 (정수기, 에어컨 등)
export interface MapObject {
    id: string;
    kind: "facility";
    candidate: MapCandidate;
    x: number;
    y: number;
    rotation: number;
    status: "ok" | "issue" | "broken" | "off";
}

// 전체 미니맵 데이터
export interface MiniMapData {
    frameId: string;
    name: string;
    width: number;
    height: number;
    segments: Segment[];
    zones: ZoneRect[];
    objects: MapObject[];
}

// 선택 상태
type Selection =
    | { type: "segment"; id: string }
    | { type: "zone"; id: string }
    | { type: "object"; id: string }
    | null;

type Tool =
    | "select"
    | "wall"
    | "space"
    | "facility";

interface MiniMapEditorProps {
    tenantId: string;
    frameId: string;
    initialName?: string;
    initialData?: Partial<MiniMapData>;
    spaceCandidates: MapCandidate[];
    facilityCandidates: MapCandidate[];
    onSave?: (data: MiniMapData) => Promise<void> | void;
}

export default function MiniMapEditor({
    tenantId,
    frameId,
    initialName = "기본 미니맵",
    initialData,
    spaceCandidates,
    facilityCandidates,
    onSave,
}: MiniMapEditorProps) {
    const [name, setName] = useState(initialName);
    const [width] = useState(initialData?.width || DEFAULT_WIDTH);
    const [height] = useState(initialData?.height || DEFAULT_HEIGHT);

    const [segments, setSegments] = useState<Segment[]>(
        initialData?.segments || []
    );
    const [zones, setZones] = useState<ZoneRect[]>(
        initialData?.zones || []
    );
    const [objects, setObjects] = useState<MapObject[]>(
        initialData?.objects || []
    );

    const [tool, setTool] = useState<Tool>("select");
    const [activeCandidate, setActiveCandidate] = useState<MapCandidate | null>(
        null
    );
    const [selection, setSelection] = useState<Selection>(null);
    const [isSaving, setIsSaving] = useState(false);

    // 벽 드래그용
    const [wallStart, setWallStart] = useState<{
        x: number;
        y: number;
    } | null>(null);

    // 그리드 좌표 스냅
    const snapToGrid = (x: number, y: number) => {
        const sx = Math.round(x / GRID_SIZE) * GRID_SIZE;
        const sy = Math.round(y / GRID_SIZE) * GRID_SIZE;
        return { x: sx, y: sy };
    };

    // 캔버스 클릭 좌표 계산
    const getCanvasPos = (e: MouseEvent<HTMLDivElement>) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        return snapToGrid(x, y);
    };

    // === 기본 구조 템플릿 ===
    const applyTemplate = (type: "box" | "ㄱ" | "ㄴ" | "T") => {
        const newSegments: Segment[] = [];
        const margin = GRID_SIZE;
        const w = width - margin * 2;
        const h = height - margin * 2;

        const nextId = (() => {
            let i = 1;
            return () => `seg_tpl_${type}_${i++}`;
        })();

        const hSeg = (x1: number, y: number, x2: number): Segment => ({
            id: nextId(),
            type: "wall",
            x1,
            y1: y,
            x2,
            y2: y,
        });
        const vSeg = (x: number, y1: number, y2: number): Segment => ({
            id: nextId(),
            type: "wall",
            x1: x,
            y1,
            x2: x,
            y2,
        });

        const left = margin;
        const right = margin + w;
        const top = margin;
        const bottom = margin + h;

        if (type === "box") {
            newSegments.push(
                hSeg(left, top, right),
                hSeg(left, bottom, right),
                vSeg(left, top, bottom),
                vSeg(right, top, bottom)
            );
        } else if (type === "ㄱ") {
            // ㄱ자: 왼쪽, 아래쪽 벽 + 위쪽 일부
            const midX = left + w * 0.4;
            newSegments.push(
                vSeg(left, top, bottom),
                hSeg(left, bottom, right),
                hSeg(left, top, midX)
            );
        } else if (type === "ㄴ") {
            // ㄴ자: 오른쪽, 아래쪽 + 위쪽 일부
            const midX = right - w * 0.4;
            newSegments.push(
                vSeg(right, top, bottom),
                hSeg(left, bottom, right),
                hSeg(midX, top, right)
            );
        } else if (type === "T") {
            // T자: 상단 가로 + 중앙 세로
            const midX = left + w / 2;
            const midY = top + h / 2;
            newSegments.push(
                hSeg(left, top, right),
                vSeg(midX, top, bottom),
                hSeg(left, midY, right)
            );
        }

        // 기존 벽은 유지 + 템플릿 추가 (원하면 교체로 바꿔도 됨)
        setSegments((prev) => [...prev, ...newSegments]);
    };

    // === 요소 생성 ===
    const createZone = (candidate: MapCandidate, x: number, y: number) => {
        const id = `zone_${candidate.rowId}_${Date.now()}`;
        const defaultWidth = GRID_SIZE * 4;
        const defaultHeight = GRID_SIZE * 3;

        const zone: ZoneRect = {
            id,
            kind: "space",
            candidate,
            x,
            y,
            width: defaultWidth,
            height: defaultHeight,
        };
        setZones((prev) => [...prev, zone]);
        setSelection({ type: "zone", id });
    };

    const createObject = (candidate: MapCandidate, x: number, y: number) => {
        const id = `obj_${candidate.rowId}_${Date.now()}`;
        const obj: MapObject = {
            id,
            kind: "facility",
            candidate,
            x,
            y,
            rotation: 0,
            status: "ok",
        };
        setObjects((prev) => [...prev, obj]);
        setSelection({ type: "object", id });
    };

    const createWallSegment = (start: { x: number; y: number }, end: { x: number; y: number }) => {
        // 수평/수직만 허용 (더 깔끔)
        let { x: x1, y: y1 } = start;
        let { x: x2, y: y2 } = end;

        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);

        if (dx < GRID_SIZE && dy < GRID_SIZE) {
            return; // 너무 짧은 건 무시
        }

        if (dx > dy) {
            // 수평으로 고정
            y2 = y1;
        } else {
            // 수직으로 고정
            x2 = x1;
        }

        const id = `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const seg: Segment = {
            id,
            type: "wall",
            x1,
            y1,
            x2,
            y2,
        };
        setSegments((prev) => [...prev, seg]);
        setSelection({ type: "segment", id });
    };

    // === 캔버스 클릭 핸들러 ===
    const handleCanvasMouseDown = (e: MouseEvent<HTMLDivElement>) => {
        if (tool === "wall") {
            const { x, y } = getCanvasPos(e);
            setWallStart({ x, y });
            return;
        }

        if (tool === "space" && activeCandidate) {
            const { x, y } = getCanvasPos(e);
            createZone(activeCandidate, x, y);
            return;
        }

        if (tool === "facility" && activeCandidate) {
            const { x, y } = getCanvasPos(e);
            createObject(activeCandidate, x, y);
            return;
        }

        // select 모드면 추후 “빈 공간 클릭 시 선택 해제” 정도만
        if (tool === "select") {
            setSelection(null);
        }
    };

    const handleCanvasMouseUp = (e: MouseEvent<HTMLDivElement>) => {
        if (tool === "wall" && wallStart) {
            const { x, y } = getCanvasPos(e);
            createWallSegment(wallStart, { x, y });
            setWallStart(null);
        }
    };

    // === 선택된 요소 가져오기 ===
    const selectedSegment = useMemo(() => {
        if (!selection || selection.type !== "segment") return null;
        return segments.find((s) => s.id === selection.id) || null;
    }, [selection, segments]);

    const selectedZone = useMemo(() => {
        if (!selection || selection.type !== "zone") return null;
        return zones.find((z) => z.id === selection.id) || null;
    }, [selection, zones]);

    const selectedObject = useMemo(() => {
        if (!selection || selection.type !== "object") return null;
        return objects.find((o) => o.id === selection.id) || null;
    }, [selection, objects]);

    // === 속성 업데이트 ===
    const updateZone = (id: string, patch: Partial<ZoneRect>) => {
        setZones((prev) =>
            prev.map((z) => (z.id === id ? { ...z, ...patch } : z))
        );
    };

    const updateObject = (id: string, patch: Partial<MapObject>) => {
        setObjects((prev) =>
            prev.map((o) => (o.id === id ? { ...o, ...patch } : o))
        );
    };

    const deleteSelected = () => {
        if (!selection) return;
        if (selection.type === "segment") {
            setSegments((prev) => prev.filter((s) => s.id !== selection.id));
        } else if (selection.type === "zone") {
            setZones((prev) => prev.filter((z) => z.id !== selection.id));
        } else if (selection.type === "object") {
            setObjects((prev) => prev.filter((o) => o.id !== selection.id));
        }
        setSelection(null);
    };

    // === 저장 ===
    const handleSave = async () => {
        if (!onSave) return;
        const payload: MiniMapData = {
            frameId,
            name,
            width,
            height,
            segments,
            zones,
            objects,
        };

        try {
            setIsSaving(true);
            await onSave(payload);
        } finally {
            setIsSaving(false);
        }
    };

    // === 렌더링 ===

    const renderGrid = () => {
        const cols = Math.floor(width / GRID_SIZE);
        const rows = Math.floor(height / GRID_SIZE);
        const lines = [];

        for (let c = 0; c <= cols; c++) {
            const x = c * GRID_SIZE;
            lines.push(
                <div
                    key={`v_${c}`}
                    className="absolute top-0 bottom-0 border-l border-dashed border-gray-200/60 pointer-events-none"
                    style={{ left: x }}
                />
            );
        }

        for (let r = 0; r <= rows; r++) {
            const y = r * GRID_SIZE;
            lines.push(
                <div
                    key={`h_${r}`}
                    className="absolute left-0 right-0 border-t border-dashed border-gray-200/60 pointer-events-none"
                    style={{ top: y }}
                />
            );
        }

        return lines;
    };

    const renderSegments = () =>
        segments.map((seg) => {
            const isSelected =
                selection?.type === "segment" && selection.id === seg.id;
            const isVertical = seg.x1 === seg.x2;
            const thickness = 6;

            const style: React.CSSProperties = isVertical
                ? {
                    left: Math.min(seg.x1, seg.x2) - thickness / 2,
                    top: Math.min(seg.y1, seg.y2),
                    width: thickness,
                    height: Math.abs(seg.y2 - seg.y1),
                }
                : {
                    left: Math.min(seg.x1, seg.x2),
                    top: Math.min(seg.y1, seg.y2) - thickness / 2,
                    width: Math.abs(seg.x2 - seg.x1),
                    height: thickness,
                };

            return (
                <div
                    key={seg.id}
                    className={`absolute rounded-full cursor-pointer ${isSelected ? "bg-blue-500" : "bg-gray-800"
                        }`}
                    style={style}
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelection({ type: "segment", id: seg.id });
                    }}
                />
            );
        });

    const renderZones = () =>
        zones.map((zone) => {
            const isSelected = selection?.type === "zone" && selection.id === zone.id;
            return (
                <div
                    key={zone.id}
                    className={`absolute rounded-xl border-2 cursor-pointer ${isSelected
                        ? "border-blue-500 bg-blue-50/40"
                        : "border-amber-300 bg-amber-50/30"
                        }`}
                    style={{
                        left: zone.x,
                        top: zone.y,
                        width: zone.width,
                        height: zone.height,
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelection({ type: "zone", id: zone.id });
                    }}
                >
                    <div className="text-xs px-2 py-1 text-gray-700 truncate">
                        {zone.candidate.emoji && (
                            <span className="mr-1">{zone.candidate.emoji}</span>
                        )}
                        {zone.candidate.label}
                    </div>
                </div>
            );
        });

    const renderObjects = () =>
        objects.map((obj) => {
            const isSelected =
                selection?.type === "object" && selection.id === obj.id;

            return (
                <div
                    key={obj.id}
                    className={`absolute flex items-center justify-center rounded-full text-xs font-medium cursor-pointer shadow ${isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-800 border border-gray-300"
                        }`}
                    style={{
                        left: obj.x - 16,
                        top: obj.y - 16,
                        width: 32,
                        height: 32,
                        transform: `rotate(${obj.rotation}deg)`,
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelection({ type: "object", id: obj.id });
                    }}
                >
                    {obj.candidate.emoji ? (
                        <span className="text-base">{obj.candidate.emoji}</span>
                    ) : (
                        <span className="px-1 truncate max-w-[28px]">
                            {obj.candidate.label.slice(0, 2)}
                        </span>
                    )}
                </div>
            );
        });

    return (
        <div className="flex h-[calc(100vh-80px)] bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* 좌측: 팔레트 */}
            <div className="w-64 border-r border-gray-200 flex flex-col">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <div className="text-xs font-semibold text-gray-500 mb-1">
                        프레임
                    </div>
                    <div className="text-sm font-bold text-gray-900 truncate">
                        {name}
                    </div>
                    <div className="mt-2">
                        <label className="block text-[11px] text-gray-500 mb-1">
                            맵 이름 수정
                        </label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>

                {/* 기본 구조 템플릿 */}
                <div className="px-3 py-3 border-b border-gray-100">
                    <div className="text-xs font-semibold text-gray-500 mb-2">
                        기본 구조 템플릿
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                        {[
                            { key: "box", label: "ㅁ" },
                            { key: "ㄱ", label: "ㄱ" },
                            { key: "ㄴ", label: "ㄴ" },
                            { key: "T", label: "T" },
                        ].map((tpl) => (
                            <button
                                key={tpl.key}
                                onClick={() => applyTemplate(tpl.key as any)}
                                className="text-xs py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50"
                            >
                                {tpl.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 툴 선택 */}
                <div className="px-3 py-3 border-b border-gray-100">
                    <div className="text-xs font-semibold text-gray-500 mb-2">
                        도구
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                        {[
                            { key: "select", label: "선택" },
                            { key: "wall", label: "벽" },
                            { key: "space", label: "공간" },
                            { key: "facility", label: "시설" },
                        ].map((t) => (
                            <button
                                key={t.key}
                                onClick={() => {
                                    setTool(t.key as Tool);
                                    if (t.key === "wall") setActiveCandidate(null);
                                }}
                                className={`text-xs py-1 rounded-md border ${tool === t.key
                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 팔레트: 공간 / 시설 */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-500">
                                공간
                            </span>
                            <span className="text-[11px] text-gray-400">
                                {spaceCandidates.length}개
                            </span>
                        </div>
                        <div className="space-y-1">
                            {spaceCandidates.map((c) => {
                                const active =
                                    activeCandidate?.rowId === c.rowId &&
                                    tool === "space";
                                return (
                                    <button
                                        key={`space_${c.rowId}`}
                                        onClick={() => {
                                            setTool("space");
                                            setActiveCandidate(c);
                                        }}
                                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs border ${active
                                            ? "border-blue-500 bg-blue-50 text-blue-700"
                                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                            }`}
                                    >
                                        {c.emoji && (
                                            <span className="text-base flex-shrink-0">
                                                {c.emoji}
                                            </span>
                                        )}
                                        <span className="truncate">{c.label}</span>
                                    </button>
                                );
                            })}
                            {spaceCandidates.length === 0 && (
                                <p className="text-[11px] text-gray-400">
                                    공간 시트에 항목을 추가하면 여기 나타나요.
                                </p>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-500">
                                시설
                            </span>
                            <span className="text-[11px] text-gray-400">
                                {facilityCandidates.length}개
                            </span>
                        </div>
                        <div className="space-y-1">
                            {facilityCandidates.map((c) => {
                                const active =
                                    activeCandidate?.rowId === c.rowId &&
                                    tool === "facility";
                                return (
                                    <button
                                        key={`facility_${c.rowId}`}
                                        onClick={() => {
                                            setTool("facility");
                                            setActiveCandidate(c);
                                        }}
                                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs border ${active
                                            ? "border-blue-500 bg-blue-50 text-blue-700"
                                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                            }`}
                                    >
                                        {c.emoji && (
                                            <span className="text-base flex-shrink-0">
                                                {c.emoji}
                                            </span>
                                        )}
                                        <span className="truncate">{c.label}</span>
                                    </button>
                                );
                            })}
                            {facilityCandidates.length === 0 && (
                                <p className="text-[11px] text-gray-400">
                                    시설 시트에 항목을 추가하면 여기 나타나요.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* 좌측 하단: 삭제 / 저장 안내 */}
                <div className="px-3 py-2 border-t border-gray-200 text-[11px] text-gray-400">
                    - 벽: 클릭 드래그로 수평/수직 벽 생성
                    <br />
                    - 공간/시설: 캔버스 클릭으로 배치
                </div>
            </div>

            {/* 중앙: 캔버스 */}
            <div className="flex-1 flex flex-col bg-gray-50">
                {/* 상단 바 */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
                    <div className="text-xs text-gray-500">
                        tenant: <span className="font-mono">{tenantId}</span> / frame:{" "}
                        <span className="font-mono">{frameId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {selection && (
                            <button
                                onClick={deleteSelected}
                                className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                            >
                                선택 삭제
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !onSave}
                            className="px-4 py-1.5 text-xs rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? "저장 중..." : "저장"}
                        </button>
                    </div>
                </div>

                {/* 실제 그리드 캔버스 */}
                <div className="flex-1 flex items-center justify-center p-4">
                    <div
                        className="relative bg-white rounded-xl shadow-inner border border-gray-200 overflow-hidden"
                        style={{ width, height }}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseUp={handleCanvasMouseUp}
                    >
                        {/* 그리드 라인 */}
                        {renderGrid()}

                        {/* 영역 / 시설 / 벽 순으로 그려서 가독성 확보 */}
                        {renderZones()}
                        {renderObjects()}
                        {renderSegments()}
                    </div>
                </div>
            </div>

            {/* 우측: 속성/상태 패널 */}
            <div className="w-72 border-l border-gray-200 bg-white flex flex-col">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <div className="text-xs font-semibold text-gray-500 mb-1">
                        선택된 요소
                    </div>
                    {!selection && (
                        <div className="text-[13px] text-gray-400">
                            캔버스에서 요소를 선택하면 속성이 여기 표시됩니다.
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-xs">
                    {selectedSegment && (
                        <div className="space-y-2">
                            <div className="font-semibold text-gray-700 mb-1">벽</div>
                            <div className="text-gray-500">
                                ({selectedSegment.x1}, {selectedSegment.y1}) → (
                                {selectedSegment.x2}, {selectedSegment.y2})
                            </div>
                            <p className="text-[11px] text-gray-400">
                                벽은 아직 드래그 이동/편집 기능은 없고, 삭제 후 다시
                                그리는 방식입니다. (나중에 행/열 선택 & 복사 기능 확장
                                용이하게 구조만 잡아둔 상태)
                            </p>
                        </div>
                    )}

                    {selectedZone && (
                        <div className="space-y-2">
                            <div className="font-semibold text-gray-700 mb-1">
                                공간 (존)
                            </div>
                            <div className="text-gray-700">
                                {selectedZone.candidate.emoji && (
                                    <span className="mr-1">
                                        {selectedZone.candidate.emoji}
                                    </span>
                                )}
                                {selectedZone.candidate.label}
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <div>
                                    <label className="block text-[11px] text-gray-500 mb-1">
                                        X
                                    </label>
                                    <input
                                        type="number"
                                        value={selectedZone.x}
                                        onChange={(e) =>
                                            updateZone(selectedZone.id, {
                                                x: snapToGrid(+e.target.value, selectedZone.y).x,
                                            })
                                        }
                                        className="w-full px-2 py-1 border border-gray-200 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-gray-500 mb-1">
                                        Y
                                    </label>
                                    <input
                                        type="number"
                                        value={selectedZone.y}
                                        onChange={(e) =>
                                            updateZone(selectedZone.id, {
                                                y: snapToGrid(selectedZone.x, +e.target.value).y,
                                            })
                                        }
                                        className="w-full px-2 py-1 border border-gray-200 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-gray-500 mb-1">
                                        폭
                                    </label>
                                    <input
                                        type="number"
                                        value={selectedZone.width}
                                        onChange={(e) =>
                                            updateZone(selectedZone.id, {
                                                width: Math.max(GRID_SIZE, +e.target.value),
                                            })
                                        }
                                        className="w-full px-2 py-1 border border-gray-200 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-gray-500 mb-1">
                                        높이
                                    </label>
                                    <input
                                        type="number"
                                        value={selectedZone.height}
                                        onChange={(e) =>
                                            updateZone(selectedZone.id, {
                                                height: Math.max(GRID_SIZE, +e.target.value),
                                            })
                                        }
                                        className="w-full px-2 py-1 border border-gray-200 rounded-lg"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedObject && (
                        <div className="space-y-2">
                            <div className="font-semibold text-gray-700 mb-1">
                                시설 / 아이템
                            </div>
                            <div className="text-gray-700">
                                {selectedObject.candidate.emoji && (
                                    <span className="mr-1">
                                        {selectedObject.candidate.emoji}
                                    </span>
                                )}
                                {selectedObject.candidate.label}
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <div>
                                    <label className="block text-[11px] text-gray-500 mb-1">
                                        X
                                    </label>
                                    <input
                                        type="number"
                                        value={selectedObject.x}
                                        onChange={(e) =>
                                            updateObject(selectedObject.id, {
                                                x: snapToGrid(+e.target.value, selectedObject.y).x,
                                            })
                                        }
                                        className="w-full px-2 py-1 border border-gray-200 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-gray-500 mb-1">
                                        Y
                                    </label>
                                    <input
                                        type="number"
                                        value={selectedObject.y}
                                        onChange={(e) =>
                                            updateObject(selectedObject.id, {
                                                y: snapToGrid(selectedObject.x, +e.target.value).y,
                                            })
                                        }
                                        className="w-full px-2 py-1 border border-gray-200 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-gray-500 mb-1">
                                        회전(°)
                                    </label>
                                    <input
                                        type="number"
                                        value={selectedObject.rotation}
                                        onChange={(e) =>
                                            updateObject(selectedObject.id, {
                                                rotation: +e.target.value,
                                            })
                                        }
                                        className="w-full px-2 py-1 border border-gray-200 rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-gray-500 mb-1">
                                        상태
                                    </label>
                                    <select
                                        value={selectedObject.status}
                                        onChange={(e) =>
                                            updateObject(selectedObject.id, {
                                                status: e.target.value as MapObject["status"],
                                            })
                                        }
                                        className="w-full px-2 py-1 border border-gray-200 rounded-lg"
                                    >
                                        <option value="ok">정상</option>
                                        <option value="issue">이상 있음</option>
                                        <option value="broken">고장</option>
                                        <option value="off">OFF</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-4 py-2 border-t border-gray-200 text-[11px] text-gray-400">
                    나중에 행/열 선택 & 복붙, 드래그 이동 같은 고급 기능을
                    붙이기 쉬운 구조로만 가볍게 잡아둔 상태야 ✨
                </div>
            </div>
        </div>
    );
}
