// components/minimap/MiniMapEditor.tsx
// 3단 레이어 구조: 프레임(층/동) → 공간(존) → 시설(아이템)
// - 프레임별 탭 전환
// - 클릭으로 배치, 드래그로 이동
// - 벽: 클릭-드래그로 그리기 (SVG로 연결점 부드럽게)
// - 문: 벽을 끊는 도면 스타일
// - note 필드: 데이터 시트와 쌍방향 동기화
// - CriteriaSheetEditor 데이터와 연동

import React, {
    useState,
    useRef,
    useEffect,
    MouseEvent,
} from "react";
import type { MapCandidate } from "@/lib/mapPalette";

const GRID_SIZE = 40;
const DEFAULT_WIDTH = 1400;
const DEFAULT_HEIGHT = 900;
const WALL_THICKNESS = 8;

// === 타입 정의 ===

// 벽 (수평/수직 직선만)
export interface Wall {
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

// 문 (벽을 끊는 형태)
export interface Door {
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

// 공간(존) 영역
export interface ZoneRect {
    id: string;
    kind: "space";
    candidate: MapCandidate;
    x: number;
    y: number;
    width: number;
    height: number;
    note?: string; // 비고 필드
}

// 시설/아이템
export interface MapObject {
    id: string;
    kind: "facility";
    candidate: MapCandidate;
    x: number;
    y: number;
    width: number;
    height: number;
    status: "ok" | "issue" | "broken" | "off";
    note?: string; // 비고 필드
}

// 프레임 (층/동/공간묶음)
export interface Frame {
    id: string;
    name: string;
    width: number;
    height: number;
    walls: Wall[];
    doors: Door[];
    zones: ZoneRect[];
    objects: MapObject[];
}

// 전체 미니맵 데이터
export interface MiniMapData {
    tenantId: string;
    frames: Frame[];
}

type Selection =
    | { type: "wall"; id: string }
    | { type: "door"; id: string }
    | { type: "zone"; id: string }
    | { type: "object"; id: string }
    | null;

type Tool = "select" | "wall" | "door" | "space" | "facility";

interface MiniMapEditorProps {
    tenantId: string;
    frameId?: string;
    initialName?: string;
    initialData?: MiniMapData;
    spaceCandidates: MapCandidate[];
    facilityCandidates: MapCandidate[];
    onSave?: (data: MiniMapData) => Promise<void> | void;
    onUpdateNote?: (type: "space" | "facility", itemId: string, note: string) => void; // note 업데이트 콜백
}

export default function MiniMapEditor({
    tenantId,
    frameId,
    initialName,
    initialData,
    spaceCandidates,
    facilityCandidates,
    onSave,
    onUpdateNote,
}: MiniMapEditorProps) {
    const fallbackFrame: Frame = {
        id: frameId || "frame_1",
        name: initialName || "1층",
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        walls: [],
        doors: [],
        zones: [],
        objects: [],
    };
    const initialFrames = initialData?.frames?.length
        ? initialData.frames
        : [fallbackFrame];

    // === State ===
    const [frames, setFrames] = useState<Frame[]>(initialFrames);
    const [activeFrameId, setActiveFrameId] = useState(() => {
        if (frameId && initialFrames.some((f) => f.id === frameId)) {
            return frameId;
        }
        return initialFrames[0].id;
    });
    const [tool, setTool] = useState<Tool>("select");
    const [selection, setSelection] = useState<Selection>(null);
    const [isSaving, setIsSaving] = useState(false);

    // 드래그 상태
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

    // 선택된 공간/시설 (클릭 배치용)
    const [selectedCandidate, setSelectedCandidate] = useState<{
        kind: "space" | "facility";
        candidate: MapCandidate;
    } | null>(null);

    // 벽/문 그리기용
    const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
    const [drawPreview, setDrawPreview] = useState<{ x: number; y: number } | null>(null);

    // 고스트 미리보기 (마우스 커서 위치)
    const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number } | null>(null);

    // 리사이즈 핸들 드래그
    const [resizeHandle, setResizeHandle] = useState<string | null>(null);

    const canvasRef = useRef<HTMLDivElement>(null);

    // === 현재 활성 프레임 ===
    const activeFrame = frames.find((f) => f.id === activeFrameId) || frames[0];

    const updateFrame = (frameId: string, updates: Partial<Frame>) => {
        setFrames((prev) =>
            prev.map((f) => (f.id === frameId ? { ...f, ...updates } : f))
        );
    };

    // === 유틸 함수 ===
    const snapToGrid = (x: number, y: number) => {
        return {
            x: Math.round(x / GRID_SIZE) * GRID_SIZE,
            y: Math.round(y / GRID_SIZE) * GRID_SIZE,
        };
    };

    const getCanvasPos = (e: MouseEvent<HTMLDivElement> | MouseEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        return snapToGrid(x, y);
    };

    const genId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    useEffect(() => {
        if (!frameId) return;
        setFrames((prev) => {
            if (prev.some((f) => f.id === frameId)) {
                return prev;
            }
            const nextFrame: Frame = {
                id: frameId,
                name: initialName || frameId,
                width: DEFAULT_WIDTH,
                height: DEFAULT_HEIGHT,
                walls: [],
                doors: [],
                zones: [],
                objects: [],
            };
            return [...prev, nextFrame];
        });
        setActiveFrameId(frameId);
    }, [frameId, initialName]);

    // === 프레임 관리 ===
    const addFrame = () => {
        const newFrame: Frame = {
            id: genId("frame"),
            name: `${frames.length + 1}층`,
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT,
            walls: [],
            doors: [],
            zones: [],
            objects: [],
        };
        setFrames([...frames, newFrame]);
        setActiveFrameId(newFrame.id);
    };

    const deleteFrame = (frameId: string) => {
        if (frames.length === 1) {
            alert("최소 1개의 프레임은 있어야 합니다.");
            return;
        }
        const remaining = frames.filter((f) => f.id !== frameId);
        setFrames(remaining);
        if (activeFrameId === frameId) {
            setActiveFrameId(remaining[0].id);
        }
    };

    const renameFrame = (frameId: string, newName: string) => {
        updateFrame(frameId, { name: newName });
    };

    // 벽 클릭 체크 함수
    const checkWallClick = (pos: { x: number; y: number }): string | null => {
        for (const wall of activeFrame.walls) {
            const isHorizontal = wall.y1 === wall.y2;
            if (isHorizontal) {
                if (
                    Math.abs(pos.y - wall.y1) < WALL_THICKNESS * 1.5 &&
                    pos.x >= Math.min(wall.x1, wall.x2) - 10 &&
                    pos.x <= Math.max(wall.x1, wall.x2) + 10
                ) {
                    return wall.id;
                }
            } else {
                if (
                    Math.abs(pos.x - wall.x1) < WALL_THICKNESS * 1.5 &&
                    pos.y >= Math.min(wall.y1, wall.y2) - 10 &&
                    pos.y <= Math.max(wall.y1, wall.y2) + 10
                ) {
                    return wall.id;
                }
            }
        }
        return null;
    };

    // === 벽/문 그리기 + 공간/시설 배치 (클릭) ===
    const handleCanvasMouseDown = (e: MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        const pos = getCanvasPos(e);

        // 공간/시설 배치 모드
        if (tool === "space" && selectedCandidate?.kind === "space") {
            const newZone: ZoneRect = {
                id: genId("zone"),
                kind: "space",
                candidate: selectedCandidate.candidate,
                x: pos.x,
                y: pos.y,
                width: GRID_SIZE * 4,
                height: GRID_SIZE * 3,
                note: "", // 초기 비고는 빈 문자열
            };
            updateFrame(activeFrameId, {
                zones: [...activeFrame.zones, newZone],
            });
            // ⭐ 선택 유지 (연속 배치 가능)
            return;
        }

        if (tool === "facility" && selectedCandidate?.kind === "facility") {
            const newObj: MapObject = {
                id: genId("obj"),
                kind: "facility",
                candidate: selectedCandidate.candidate,
                x: pos.x,
                y: pos.y,
                width: GRID_SIZE * 2,
                height: GRID_SIZE * 2,
                status: "ok",
                note: "", // 초기 비고는 빈 문자열
            };
            updateFrame(activeFrameId, {
                objects: [...activeFrame.objects, newObj],
            });
            // ⭐ 선택 유지 (연속 배치 가능)
            return;
        }

        // 벽/문 그리기
        if (tool === "wall" || tool === "door") {
            setDrawStart(pos);
            setDrawPreview(pos);
            return;
        }

        // 선택 모드
        if (tool === "select") {
            let clicked: Selection = null;

            // 시설 리사이즈 핸들 체크
            for (const obj of activeFrame.objects) {
                const handles = [
                    { id: "se", x: obj.x + obj.width, y: obj.y + obj.height },
                    { id: "sw", x: obj.x, y: obj.y + obj.height },
                    { id: "ne", x: obj.x + obj.width, y: obj.y },
                    { id: "nw", x: obj.x, y: obj.y },
                ];

                for (const handle of handles) {
                    if (Math.abs(handle.x - pos.x) < 10 && Math.abs(handle.y - pos.y) < 10) {
                        setSelection({ type: "object", id: obj.id });
                        setResizeHandle(handle.id);
                        setIsDragging(true);
                        return;
                    }
                }
            }

            // 문 체크
            for (const door of activeFrame.doors) {
                const isHorizontal = door.y1 === door.y2;
                if (isHorizontal) {
                    if (
                        Math.abs(pos.y - door.y1) < WALL_THICKNESS * 2 &&
                        pos.x >= Math.min(door.x1, door.x2) &&
                        pos.x <= Math.max(door.x1, door.x2)
                    ) {
                        clicked = { type: "door", id: door.id };
                        break;
                    }
                } else {
                    if (
                        Math.abs(pos.x - door.x1) < WALL_THICKNESS * 2 &&
                        pos.y >= Math.min(door.y1, door.y2) &&
                        pos.y <= Math.max(door.y1, door.y2)
                    ) {
                        clicked = { type: "door", id: door.id };
                        break;
                    }
                }
            }

            // 시설 체크
            if (!clicked) {
                for (const obj of activeFrame.objects) {
                    if (
                        pos.x >= obj.x &&
                        pos.x <= obj.x + obj.width &&
                        pos.y >= obj.y &&
                        pos.y <= obj.y + obj.height
                    ) {
                        clicked = { type: "object", id: obj.id };
                        break;
                    }
                }
            }

            // 공간 체크
            if (!clicked) {
                for (const zone of activeFrame.zones) {
                    if (
                        pos.x >= zone.x &&
                        pos.x <= zone.x + zone.width &&
                        pos.y >= zone.y &&
                        pos.y <= zone.y + zone.height
                    ) {
                        clicked = { type: "zone", id: zone.id };
                        break;
                    }
                }
            }

            // 벽 체크
            if (!clicked) {
                const wallId = checkWallClick(pos);
                if (wallId) {
                    clicked = { type: "wall", id: wallId };
                }
            }

            if (clicked) {
                setSelection(clicked);
                setIsDragging(true);

                // 드래그 오프셋 계산
                if (clicked.type === "zone") {
                    const zone = activeFrame.zones.find(z => z.id === clicked.id);
                    if (zone) {
                        setDragOffset({ x: pos.x - zone.x, y: pos.y - zone.y });
                    }
                } else if (clicked.type === "object") {
                    const obj = activeFrame.objects.find(o => o.id === clicked.id);
                    if (obj) {
                        setDragOffset({ x: pos.x - obj.x, y: pos.y - obj.y });
                    }
                }
            } else {
                setSelection(null);
            }
        }
    };

    const handleCanvasMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        const pos = getCanvasPos(e);

        // 고스트 미리보기 업데이트 (공간/시설 배치 모드일 때)
        if ((tool === "space" || tool === "facility") && selectedCandidate) {
            setGhostPosition(pos);
        } else {
            setGhostPosition(null);
        }

        if ((tool === "wall" || tool === "door") && drawStart) {
            // 수평/수직 스냅
            const dx = Math.abs(pos.x - drawStart.x);
            const dy = Math.abs(pos.y - drawStart.y);

            if (dx > dy) {
                setDrawPreview({ x: pos.x, y: drawStart.y });
            } else {
                setDrawPreview({ x: drawStart.x, y: pos.y });
            }
        } else if (tool === "select" && isDragging && selection) {
            if (resizeHandle && selection.type === "object") {
                // 리사이즈
                const obj = activeFrame.objects.find(o => o.id === selection.id);
                if (!obj) return;

                let newX = obj.x;
                let newY = obj.y;
                let newWidth = obj.width;
                let newHeight = obj.height;

                if (resizeHandle.includes("e")) {
                    newWidth = Math.max(GRID_SIZE, pos.x - obj.x);
                }
                if (resizeHandle.includes("w")) {
                    const diff = obj.x - pos.x;
                    newX = pos.x;
                    newWidth = Math.max(GRID_SIZE, obj.width + diff);
                }
                if (resizeHandle.includes("s")) {
                    newHeight = Math.max(GRID_SIZE, pos.y - obj.y);
                }
                if (resizeHandle.includes("n")) {
                    const diff = obj.y - pos.y;
                    newY = pos.y;
                    newHeight = Math.max(GRID_SIZE, obj.height + diff);
                }

                updateFrame(activeFrameId, {
                    objects: activeFrame.objects.map((o) =>
                        o.id === selection.id
                            ? { ...o, x: newX, y: newY, width: newWidth, height: newHeight }
                            : o
                    ),
                });
            } else if (dragOffset) {
                // 이동
                if (selection.type === "zone") {
                    updateFrame(activeFrameId, {
                        zones: activeFrame.zones.map((z) =>
                            z.id === selection.id
                                ? { ...z, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y }
                                : z
                        ),
                    });
                } else if (selection.type === "object") {
                    updateFrame(activeFrameId, {
                        objects: activeFrame.objects.map((o) =>
                            o.id === selection.id
                                ? { ...o, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y }
                                : o
                        ),
                    });
                }
            }
        }
    };

    const handleCanvasMouseUp = (e: MouseEvent<HTMLDivElement>) => {
        if ((tool === "wall" || tool === "door") && drawStart && drawPreview) {
            // 최소 길이 체크
            if (Math.abs(drawPreview.x - drawStart.x) > GRID_SIZE / 2 ||
                Math.abs(drawPreview.y - drawStart.y) > GRID_SIZE / 2) {

                if (tool === "wall") {
                    const newWall: Wall = {
                        id: genId("wall"),
                        x1: drawStart.x,
                        y1: drawStart.y,
                        x2: drawPreview.x,
                        y2: drawPreview.y,
                    };
                    updateFrame(activeFrameId, {
                        walls: [...activeFrame.walls, newWall],
                    });
                } else if (tool === "door") {
                    const newDoor: Door = {
                        id: genId("door"),
                        x1: drawStart.x,
                        y1: drawStart.y,
                        x2: drawPreview.x,
                        y2: drawPreview.y,
                    };
                    updateFrame(activeFrameId, {
                        doors: [...activeFrame.doors, newDoor],
                    });
                }
            }

            setDrawStart(null);
            setDrawPreview(null);
        }

        setIsDragging(false);
        setDragOffset(null);
        setResizeHandle(null);
    };

    // === note 업데이트 ===
    const handleNoteChange = (id: string, note: string, type: "zone" | "object") => {
        if (type === "zone") {
            const zone = activeFrame.zones.find(z => z.id === id);
            if (zone) {
                updateFrame(activeFrameId, {
                    zones: activeFrame.zones.map((z) =>
                        z.id === id ? { ...z, note } : z
                    ),
                });
                // 데이터 시트 업데이트 콜백
                onUpdateNote?.("space", zone.candidate.rowId, note);
            }
        } else if (type === "object") {
            const obj = activeFrame.objects.find(o => o.id === id);
            if (obj) {
                updateFrame(activeFrameId, {
                    objects: activeFrame.objects.map((o) =>
                        o.id === id ? { ...o, note } : o
                    ),
                });
                // 데이터 시트 업데이트 콜백
                onUpdateNote?.("facility", obj.candidate.rowId, note);
            }
        }
    };

    // === 삭제 ===
    const deleteSelected = () => {
        if (!selection) return;

        if (selection.type === "wall") {
            updateFrame(activeFrameId, {
                walls: activeFrame.walls.filter((w) => w.id !== selection.id),
            });
        } else if (selection.type === "door") {
            updateFrame(activeFrameId, {
                doors: activeFrame.doors.filter((d) => d.id !== selection.id),
            });
        } else if (selection.type === "zone") {
            updateFrame(activeFrameId, {
                zones: activeFrame.zones.filter((z) => z.id !== selection.id),
            });
        } else if (selection.type === "object") {
            updateFrame(activeFrameId, {
                objects: activeFrame.objects.filter((o) => o.id !== selection.id),
            });
        }
        setSelection(null);
    };

    // 키보드 Delete
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Delete" && selection) {
                deleteSelected();
            } else if (e.key === "Escape") {
                setTool("select");
                setSelectedCandidate(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selection]);

    // === 선택된 요소 찾기 ===
    const selectedWall = selection?.type === "wall"
        ? activeFrame.walls.find((w) => w.id === selection.id)
        : null;
    const selectedDoor = selection?.type === "door"
        ? activeFrame.doors.find((d) => d.id === selection.id)
        : null;
    const selectedZone = selection?.type === "zone"
        ? activeFrame.zones.find((z) => z.id === selection.id)
        : null;
    const selectedObject = selection?.type === "object"
        ? activeFrame.objects.find((o) => o.id === selection.id)
        : null;

    // === 저장 ===
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const data: MiniMapData = {
                tenantId,
                frames,
            };
            await onSave?.(data);
            alert("저장 완료!");
        } catch (error) {
            console.error(error);
            alert("저장 실패");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* 상단 헤더 */}
            <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
                <div className="flex items-center space-x-4">
                    <h1 className="text-base font-semibold text-gray-900">
                        미니맵 편집기
                    </h1>
                    <div className="text-sm text-gray-500">
                        {activeFrame.name}
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    {isSaving ? "저장 중..." : "저장"}
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* 좌측: 팔레트 */}
                <div className="w-60 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
                    {/* 프레임 탭 */}
                    <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-semibold text-gray-700">
                                프레임 (층/동)
                            </div>
                            <button
                                onClick={addFrame}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                                + 추가
                            </button>
                        </div>
                        <div className="space-y-1">
                            {frames.map((frame) => (
                                <div
                                    key={frame.id}
                                    className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${activeFrameId === frame.id
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-white text-gray-700 hover:bg-gray-50"
                                        }`}
                                    onClick={() => setActiveFrameId(frame.id)}
                                >
                                    <input
                                        value={frame.name}
                                        onChange={(e) =>
                                            renameFrame(frame.id, e.target.value)
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex-1 bg-transparent text-xs font-medium outline-none"
                                    />
                                    {frames.length > 1 && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteFrame(frame.id);
                                            }}
                                            className="ml-2 text-xs text-red-600 hover:text-red-700"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 도구 */}
                    <div className="px-3 py-2 border-b border-gray-200">
                        <div className="text-xs font-semibold text-gray-700 mb-2">
                            도구
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                            <button
                                onClick={() => {
                                    setTool("select");
                                    setSelectedCandidate(null);
                                }}
                                className={`px-2 py-1.5 text-xs font-medium rounded transition-colors ${tool === "select"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    }`}
                            >
                                <div className="text-sm">↖</div>
                                <div className="mt-0.5">선택</div>
                            </button>
                            <button
                                onClick={() => {
                                    setTool("wall");
                                    setSelectedCandidate(null);
                                }}
                                className={`px-2 py-1.5 text-xs font-medium rounded transition-colors ${tool === "wall"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    }`}
                            >
                                <div className="text-sm">▬</div>
                                <div className="mt-0.5">벽</div>
                            </button>
                            <button
                                onClick={() => {
                                    setTool("door");
                                    setSelectedCandidate(null);
                                }}
                                className={`px-2 py-1.5 text-xs font-medium rounded transition-colors ${tool === "door"
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    }`}
                            >
                                <div className="text-sm">⎕</div>
                                <div className="mt-0.5">문</div>
                            </button>
                        </div>
                        <div className="mt-2 p-2 bg-blue-50 rounded text-[11px] leading-tight">
                            {tool === "select" && (
                                <div className="text-gray-700">
                                    <span className="font-semibold">선택 모드</span><br />
                                    요소를 클릭하거나 드래그해서 이동
                                </div>
                            )}
                            {tool === "wall" && (
                                <div className="text-gray-700">
                                    <span className="font-semibold">벽 그리기 모드</span><br />
                                    클릭-드래그로 벽 그리기
                                </div>
                            )}
                            {tool === "door" && (
                                <div className="text-gray-700">
                                    <span className="font-semibold">문 그리기 모드</span><br />
                                    클릭-드래그로 문 그리기
                                </div>
                            )}
                            {tool === "space" && selectedCandidate && (
                                <div className="text-green-700">
                                    <span className="font-semibold">🟢 공간 배치 모드</span><br />
                                    <span className="text-xl">{selectedCandidate.candidate.emoji}</span> {selectedCandidate.candidate.label}<br />
                                    캔버스 클릭으로 연속 배치 가능
                                </div>
                            )}
                            {tool === "facility" && selectedCandidate && (
                                <div className="text-blue-700">
                                    <span className="font-semibold">🔵 시설 배치 모드</span><br />
                                    <span className="text-xl">{selectedCandidate.candidate.emoji}</span> {selectedCandidate.candidate.label}<br />
                                    캔버스 클릭으로 연속 배치 가능
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 공간 팔레트 */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="px-3 py-2 border-b border-gray-200">
                            <div className="text-xs font-semibold text-gray-700 mb-1.5">
                                공간 (Zone)
                            </div>
                            {tool === "space" && selectedCandidate?.kind === "space" && (
                                <div className="mb-2 p-2 bg-green-100 border border-green-300 rounded text-[10px] text-green-800 font-medium">
                                    ✓ 배치 모드 활성화<br />
                                    ESC로 취소
                                </div>
                            )}
                            <div className="text-[10px] text-gray-500 mb-2">
                                클릭하면 연속 배치 모드
                            </div>
                            <div className="space-y-1">
                                {spaceCandidates.map((candidate) => (
                                    <div
                                        key={`${candidate.sheetId}-${candidate.rowId}`}
                                        onClick={() => {
                                            setTool("space");
                                            setSelectedCandidate({ kind: "space", candidate });
                                        }}
                                        className={`flex items-center px-2 py-1.5 rounded cursor-pointer transition-colors ${tool === "space" && selectedCandidate?.candidate.rowId === candidate.rowId
                                            ? "bg-green-600 text-white border border-green-700"
                                            : "bg-green-50 border border-green-200 hover:bg-green-100"
                                            }`}
                                    >
                                        {candidate.emoji && (
                                            <span className="mr-1.5 text-sm">{candidate.emoji}</span>
                                        )}
                                        <span className="text-xs font-medium">
                                            {candidate.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="px-3 py-2">
                            <div className="text-xs font-semibold text-gray-700 mb-1.5">
                                시설 (Facility)
                            </div>
                            {tool === "facility" && selectedCandidate?.kind === "facility" && (
                                <div className="mb-2 p-2 bg-blue-100 border border-blue-300 rounded text-[10px] text-blue-800 font-medium">
                                    ✓ 배치 모드 활성화<br />
                                    ESC로 취소
                                </div>
                            )}
                            <div className="text-[10px] text-gray-500 mb-2">
                                클릭하면 연속 배치 모드
                            </div>
                            <div className="space-y-1">
                                {facilityCandidates.map((candidate) => (
                                    <div
                                        key={`${candidate.sheetId}-${candidate.rowId}`}
                                        onClick={() => {
                                            setTool("facility");
                                            setSelectedCandidate({ kind: "facility", candidate });
                                        }}
                                        className={`flex items-center px-2 py-1.5 rounded cursor-pointer transition-colors ${tool === "facility" && selectedCandidate?.candidate.rowId === candidate.rowId
                                            ? "bg-blue-600 text-white border border-blue-700"
                                            : "bg-blue-50 border border-blue-200 hover:bg-blue-100"
                                            }`}
                                    >
                                        {candidate.emoji && (
                                            <span className="mr-1.5 text-sm">{candidate.emoji}</span>
                                        )}
                                        <span className="text-xs font-medium">
                                            {candidate.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 중앙: 캔버스 (전체 화면 사용) */}
                <div className="flex-1 overflow-auto bg-gray-100">
                    <div
                        ref={canvasRef}
                        className="relative bg-white mx-auto my-4"
                        style={{
                            width: activeFrame.width,
                            height: activeFrame.height,
                            cursor:
                                tool === "space" || tool === "facility" ? "crosshair" :
                                    tool === "wall" || tool === "door" ? "crosshair" :
                                        "default",
                        }}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                    >
                        {/* 그리드 배경 */}
                        <svg
                            className="absolute inset-0 pointer-events-none"
                            width={activeFrame.width}
                            height={activeFrame.height}
                        >
                            <defs>
                                <pattern
                                    id="grid"
                                    width={GRID_SIZE}
                                    height={GRID_SIZE}
                                    patternUnits="userSpaceOnUse"
                                >
                                    <path
                                        d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
                                        fill="none"
                                        stroke="#e5e7eb"
                                        strokeWidth="0.5"
                                    />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#grid)" />
                        </svg>

                        {/* 벽 렌더링 - SVG로 연결점 부드럽게 */}
                        <svg
                            className="absolute inset-0"
                            width={activeFrame.width}
                            height={activeFrame.height}
                            style={{ pointerEvents: 'none' }}
                        >
                            {activeFrame.walls.map((wall) => {
                                const isSelected = selection?.type === "wall" && selection.id === wall.id;

                                return (
                                    <line
                                        key={wall.id}
                                        x1={wall.x1}
                                        y1={wall.y1}
                                        x2={wall.x2}
                                        y2={wall.y2}
                                        stroke={isSelected ? "#2563eb" : "#111827"}
                                        strokeWidth={WALL_THICKNESS}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (tool === "select") {
                                                setSelection({ type: "wall", id: wall.id });
                                            }
                                        }}
                                    />
                                );
                            })}

                            {/* 그리기 미리보기 */}
                            {drawStart && drawPreview && (
                                <line
                                    x1={drawStart.x}
                                    y1={drawStart.y}
                                    x2={drawPreview.x}
                                    y2={drawPreview.y}
                                    stroke={tool === "wall" ? "#6b7280" : "#111827"}
                                    strokeWidth={WALL_THICKNESS}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    opacity={0.5}
                                    strokeDasharray={tool === "door" ? "4 4" : undefined}
                                />
                            )}
                        </svg>

                        {/* 문 렌더링 (벽을 끊는 스타일) */}
                        {activeFrame.doors.map((door) => {
                            const isHorizontal = door.y1 === door.y2;
                            const length = Math.abs(
                                isHorizontal ? door.x2 - door.x1 : door.y2 - door.y1
                            );

                            return (
                                <div
                                    key={door.id}
                                    className={`absolute border-2 ${selection?.type === "door" && selection.id === door.id
                                        ? "border-blue-600 bg-blue-50"
                                        : "border-gray-900 bg-white"
                                        }`}
                                    style={{
                                        left: Math.min(door.x1, door.x2),
                                        top: isHorizontal
                                            ? door.y1 - WALL_THICKNESS / 2
                                            : Math.min(door.y1, door.y2),
                                        width: isHorizontal ? length : WALL_THICKNESS,
                                        height: isHorizontal ? WALL_THICKNESS : length,
                                    }}
                                />
                            );
                        })}

                        {/* 공간(존) 렌더링 */}
                        {activeFrame.zones.map((zone) => (
                            <div
                                key={zone.id}
                                className={`absolute border-2 rounded flex items-center justify-center transition-colors ${selection?.type === "zone" && selection.id === zone.id
                                    ? "border-blue-600 bg-blue-100/50"
                                    : "border-green-400 bg-green-100/30 hover:border-green-500"
                                    }`}
                                style={{
                                    left: zone.x,
                                    top: zone.y,
                                    width: zone.width,
                                    height: zone.height,
                                }}
                            >
                                <div className="text-xs font-medium text-gray-700 pointer-events-none text-center px-2">
                                    <div className="text-2xl mb-1">{zone.candidate.emoji}</div>
                                    <div className="text-sm">{zone.candidate.label}</div>
                                    {zone.note && (
                                        <div className="text-[10px] text-gray-500 mt-1">
                                            {zone.note}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* 시설(아이템) 렌더링 - 사각형 + 리사이즈 핸들 */}
                        {activeFrame.objects.map((obj) => (
                            <div key={obj.id}>
                                <div
                                    className={`absolute rounded border-2 flex flex-col items-center justify-center cursor-pointer transition-colors ${selection?.type === "object" && selection.id === obj.id
                                        ? "border-blue-600 bg-blue-100"
                                        : obj.status === "ok"
                                            ? "border-gray-400 bg-white hover:border-gray-500"
                                            : obj.status === "issue"
                                                ? "border-yellow-400 bg-yellow-50"
                                                : obj.status === "broken"
                                                    ? "border-red-400 bg-red-50"
                                                    : "border-gray-400 bg-gray-100"
                                        }`}
                                    style={{
                                        left: obj.x,
                                        top: obj.y,
                                        width: obj.width,
                                        height: obj.height,
                                    }}
                                >
                                    <span className="text-2xl mb-0.5">{obj.candidate.emoji}</span>
                                    <span className="text-[10px] text-gray-600 font-medium text-center px-1 leading-tight">
                                        {obj.candidate.label}
                                    </span>
                                    {obj.note && (
                                        <span className="text-[9px] text-gray-500 mt-0.5 text-center px-1">
                                            {obj.note}
                                        </span>
                                    )}
                                </div>

                                {/* 리사이즈 핸들 (선택된 경우만) */}
                                {selection?.type === "object" && selection.id === obj.id && (
                                    <>
                                        {/* SE (우하단) */}
                                        <div
                                            className="absolute w-3 h-3 bg-blue-600 rounded-full cursor-se-resize border-2 border-white shadow-sm"
                                            style={{
                                                left: obj.x + obj.width - 6,
                                                top: obj.y + obj.height - 6,
                                            }}
                                        />
                                        {/* SW (좌하단) */}
                                        <div
                                            className="absolute w-3 h-3 bg-blue-600 rounded-full cursor-sw-resize border-2 border-white shadow-sm"
                                            style={{
                                                left: obj.x - 6,
                                                top: obj.y + obj.height - 6,
                                            }}
                                        />
                                        {/* NE (우상단) */}
                                        <div
                                            className="absolute w-3 h-3 bg-blue-600 rounded-full cursor-ne-resize border-2 border-white shadow-sm"
                                            style={{
                                                left: obj.x + obj.width - 6,
                                                top: obj.y - 6,
                                            }}
                                        />
                                        {/* NW (좌상단) */}
                                        <div
                                            className="absolute w-3 h-3 bg-blue-600 rounded-full cursor-nw-resize border-2 border-white shadow-sm"
                                            style={{
                                                left: obj.x - 6,
                                                top: obj.y - 6,
                                            }}
                                        />
                                    </>
                                )}
                            </div>
                        ))}

                        {/* ⭐ 고스트 미리보기 */}
                        {ghostPosition && selectedCandidate && (
                            <div className="pointer-events-none">
                                {selectedCandidate.kind === "space" ? (
                                    /* 공간 고스트 */
                                    <div
                                        className="absolute border-2 border-dashed border-green-500 bg-green-100/40 rounded flex items-center justify-center"
                                        style={{
                                            left: ghostPosition.x,
                                            top: ghostPosition.y,
                                            width: GRID_SIZE * 4,
                                            height: GRID_SIZE * 3,
                                        }}
                                    >
                                        <div className="text-center">
                                            <div className="text-3xl opacity-60">
                                                {selectedCandidate.candidate.emoji}
                                            </div>
                                            <div className="text-xs font-medium text-gray-600 mt-1">
                                                클릭해서 배치
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* 시설 고스트 */
                                    <div
                                        className="absolute border-1 border-dashed border-gray-200 bg-gray-100/40 rounded flex flex-col items-center justify-center"
                                        style={{
                                            left: ghostPosition.x,
                                            top: ghostPosition.y,
                                            width: GRID_SIZE * 2,
                                            height: GRID_SIZE * 2,
                                        }}
                                    >
                                        <span className="text-2xl opacity-60">
                                            {selectedCandidate.candidate.emoji}
                                        </span>
                                        <span className="text-[9px] text-gray-600 font-medium mt-1">
                                            클릭
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 우측: 속성 패널 */}
                <div className="w-64 border-l border-gray-200 bg-white flex flex-col">
                    <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                        <div className="text-xs font-semibold text-gray-500 mb-1">
                            선택된 요소
                        </div>
                        {!selection && (
                            <div className="text-[11px] text-gray-400">
                                요소를 클릭해서 선택하세요
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
                        {selectedWall && (
                            <div className="space-y-2">
                                <div className="font-semibold text-sm text-gray-700">벽</div>
                                <div className="text-xs text-gray-500">
                                    {selectedWall.y1 === selectedWall.y2 ? "수평" : "수직"} ·{" "}
                                    {Math.abs(
                                        (selectedWall.x2 - selectedWall.x1) +
                                        (selectedWall.y2 - selectedWall.y1)
                                    )}px
                                </div>
                                <button
                                    onClick={deleteSelected}
                                    className="w-full px-2 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                                >
                                    삭제
                                </button>
                            </div>
                        )}

                        {selectedDoor && (
                            <div className="space-y-2">
                                <div className="font-semibold text-sm text-gray-700">문</div>
                                <div className="text-xs text-gray-500">
                                    {selectedDoor.y1 === selectedDoor.y2 ? "수평" : "수직"}
                                </div>
                                <button
                                    onClick={deleteSelected}
                                    className="w-full px-2 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                                >
                                    삭제
                                </button>
                            </div>
                        )}

                        {selectedZone && (
                            <div className="space-y-2">
                                <div className="font-semibold text-sm text-gray-700">공간</div>
                                <div className="flex items-center text-xs text-gray-700 mb-2">
                                    <span className="text-xl mr-2">{selectedZone.candidate.emoji}</span>
                                    <span className="font-medium">{selectedZone.candidate.label}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[11px] text-gray-500 mb-1">
                                            폭
                                        </label>
                                        <input
                                            type="number"
                                            value={selectedZone.width}
                                            onChange={(e) => {
                                                updateFrame(activeFrameId, {
                                                    zones: activeFrame.zones.map((z) =>
                                                        z.id === selectedZone.id
                                                            ? { ...z, width: Math.max(GRID_SIZE, +e.target.value) }
                                                            : z
                                                    ),
                                                });
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-gray-500 mb-1">
                                            높이
                                        </label>
                                        <input
                                            type="number"
                                            value={selectedZone.height}
                                            onChange={(e) => {
                                                updateFrame(activeFrameId, {
                                                    zones: activeFrame.zones.map((z) =>
                                                        z.id === selectedZone.id
                                                            ? { ...z, height: Math.max(GRID_SIZE, +e.target.value) }
                                                            : z
                                                    ),
                                                });
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] text-gray-500 mb-1">
                                        비고 (Note)
                                    </label>
                                    <textarea
                                        value={selectedZone.note || ""}
                                        onChange={(e) => handleNoteChange(selectedZone.id, e.target.value, "zone")}
                                        placeholder="수리예정일, 상태 등을 자유롭게 입력"
                                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded resize-none"
                                        rows={2}
                                    />
                                </div>
                                <button
                                    onClick={deleteSelected}
                                    className="w-full px-2 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                                >
                                    삭제
                                </button>
                            </div>
                        )}

                        {selectedObject && (
                            <div className="space-y-2">
                                <div className="font-semibold text-sm text-gray-700">시설</div>
                                <div className="flex items-center text-xs text-gray-700 mb-2">
                                    <span className="text-xl mr-2">{selectedObject.candidate.emoji}</span>
                                    <span className="font-medium">{selectedObject.candidate.label}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[11px] text-gray-500 mb-1">
                                            폭
                                        </label>
                                        <input
                                            type="number"
                                            value={selectedObject.width}
                                            onChange={(e) => {
                                                updateFrame(activeFrameId, {
                                                    objects: activeFrame.objects.map((o) =>
                                                        o.id === selectedObject.id
                                                            ? { ...o, width: Math.max(GRID_SIZE, +e.target.value) }
                                                            : o
                                                    ),
                                                });
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-gray-500 mb-1">
                                            높이
                                        </label>
                                        <input
                                            type="number"
                                            value={selectedObject.height}
                                            onChange={(e) => {
                                                updateFrame(activeFrameId, {
                                                    objects: activeFrame.objects.map((o) =>
                                                        o.id === selectedObject.id
                                                            ? { ...o, height: Math.max(GRID_SIZE, +e.target.value) }
                                                            : o
                                                    ),
                                                });
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[11px] text-gray-500 mb-1">
                                            상태
                                        </label>
                                        <select
                                            value={selectedObject.status}
                                            onChange={(e) => {
                                                updateFrame(activeFrameId, {
                                                    objects: activeFrame.objects.map((o) =>
                                                        o.id === selectedObject.id
                                                            ? { ...o, status: e.target.value as MapObject["status"] }
                                                            : o
                                                    ),
                                                });
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                                        >
                                            <option value="ok">정상</option>
                                            <option value="issue">이상</option>
                                            <option value="broken">고장</option>
                                            <option value="off">OFF</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] text-gray-500 mb-1">
                                        비고 (Note)
                                    </label>
                                    <textarea
                                        value={selectedObject.note || ""}
                                        onChange={(e) => handleNoteChange(selectedObject.id, e.target.value, "object")}
                                        placeholder="수리예정일, 상태 등을 자유롭게 입력"
                                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded resize-none"
                                        rows={2}
                                    />
                                </div>
                                <button
                                    onClick={deleteSelected}
                                    className="w-full px-2 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                                >
                                    삭제
                                </button>
                            </div>
                        )}
                    </div>

                    {selection && (
                        <div className="px-3 py-2 border-t border-gray-200">
                            <div className="text-[10px] text-gray-400">
                                💡 Delete 키로도 삭제 가능
                                {selection.type === "object" && " · 모서리 드래그로 크기 조절"}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}