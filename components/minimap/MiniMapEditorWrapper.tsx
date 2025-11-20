// components/minimap/MiniMapEditorWrapper.tsx
// MiniMapEditor와 CriteriaSheetEditor 데이터를 쌍방향 동기화하는 래퍼

import React, { useState, useEffect, useCallback } from "react";
import MiniMapEditor, { MiniMapData } from "./MiniMapEditor";
import type { MapCandidate } from "@/lib/mapPalette";

interface MiniMapEditorWrapperProps {
    tenantId: string;
    frameId?: string;
    initialName?: string;
    initialData?: MiniMapData;

    // 데이터 시트 관련
    sheetData: any; // CriteriaSheetEditor의 data 구조
    onUpdateSheetData: (updatedData: any) => void; // 데이터 시트 업데이트 콜백

    // 기타
    onSave?: (data: MiniMapData) => Promise<void> | void;
}

export default function MiniMapEditorWrapper({
    tenantId,
    frameId,
    initialName,
    initialData,
    sheetData,
    onUpdateSheetData,
    onSave,
}: MiniMapEditorWrapperProps) {
    // 공간/시설 candidates 생성
    const spaceCandidates = React.useMemo(() => {
        const spaceSheet = sheetData?.sheets?.find((s: any) => s.name === "공간");
        if (!spaceSheet) return [];

        return spaceSheet.rows.map((row: any) => {
            const label = row.cells?.name || row.cells?.label || "이름 없음";
            const emoji = row.cells?.emoji || "📍";
            const note = row.cells?.notes || ""; // notes 필드 가져오기

            return {
                id: row.id,
                sheetId: spaceSheet.id,
                rowId: row.id,
                label,
                emoji,
                note, // note 필드 추가
            } as MapCandidate & { note: string };
        });
    }, [sheetData]);

    const facilityCandidates = React.useMemo(() => {
        const facilitySheet = sheetData?.sheets?.find((s: any) => s.name === "시설");
        if (!facilitySheet) return [];

        return facilitySheet.rows.map((row: any) => {
            const label = row.cells?.name || row.cells?.label || "이름 없음";
            const emoji = row.cells?.emoji || "🔧";
            const note = row.cells?.notes || ""; // notes 필드 가져오기

            return {
                id: row.id,
                sheetId: facilitySheet.id,
                rowId: row.id,
                label,
                emoji,
                note, // note 필드 추가
            } as MapCandidate & { note: string };
        });
    }, [sheetData]);

    // 미니맵에서 note가 업데이트되면 데이터 시트에 반영
    const handleUpdateNote = useCallback((
        type: "space" | "facility",
        itemId: string,
        note: string
    ) => {
        const sheetName = type === "space" ? "공간" : "시설";

        // sheetData 복사
        const updatedData = { ...sheetData };
        const targetSheet = updatedData.sheets?.find((s: any) => s.name === sheetName);

        if (!targetSheet) {
            console.warn(`Sheet "${sheetName}" not found`);
            return;
        }

        // 해당 row 찾아서 notes 필드 업데이트
        const targetRow = targetSheet.rows.find((r: any) => r.id === itemId);
        if (!targetRow) {
            console.warn(`Row with id "${itemId}" not found in sheet "${sheetName}"`);
            return;
        }

        // cells에 notes 필드 업데이트
        targetRow.cells = {
            ...targetRow.cells,
            notes: note,
        };

        // 데이터 시트에 변경사항 반영
        onUpdateSheetData(updatedData);
    }, [sheetData, onUpdateSheetData]);

    // 데이터 시트에서 note가 변경되면 미니맵 데이터에 반영
    const enrichedInitialData = React.useMemo(() => {
        if (!initialData) return initialData;

        // initialData의 frames를 순회하며 note 필드 동기화
        const updatedFrames = initialData.frames.map(frame => {
            // zones의 note 업데이트
            const updatedZones = frame.zones.map(zone => {
                const candidate = spaceCandidates.find(
                    c => c.sheetId === zone.candidate.sheetId && c.rowId === zone.candidate.rowId
                );
                return {
                    ...zone,
                    note: candidate?.note || zone.note || "",
                };
            });

            // objects의 note 업데이트
            const updatedObjects = frame.objects.map(obj => {
                const candidate = facilityCandidates.find(
                    c => c.sheetId === obj.candidate.sheetId && c.rowId === obj.candidate.rowId
                );
                return {
                    ...obj,
                    note: candidate?.note || obj.note || "",
                };
            });

            return {
                ...frame,
                zones: updatedZones,
                objects: updatedObjects,
            };
        });

        return {
            ...initialData,
            frames: updatedFrames,
        };
    }, [initialData, spaceCandidates, facilityCandidates]);

    return (
        <MiniMapEditor
            tenantId={tenantId}
            frameId={frameId}
            initialName={initialName}
            initialData={enrichedInitialData}
            spaceCandidates={spaceCandidates}
            facilityCandidates={facilityCandidates}
            onSave={onSave}
            onUpdateNote={handleUpdateNote}
        />
    );
}