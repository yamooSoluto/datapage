// lib/mapPalette.ts

// ✅ CriteriaSheetEditor에서 쓰는 데이터 구조 가정
//  - data.sheets: string[]  (예: ["space", "facility", ...])
//  - data.items[sheetId]: { id: string; name?: string; label?: string; emoji?: string; notes?: string; [key: string]: any }[]
// 실제 필드명이 다르면 아래에서 mapRowLabel / mapRowNote 부분만 맞춰주면 됨.

export type MapCandidateKind = "space" | "facility";

export interface MapCandidate {
    kind: MapCandidateKind;       // "space" | "facility"
    sheetId: string;              // "space" or "facility"
    rowId: string;                // row의 id
    label: string;                // 화면에 보여줄 이름
    emoji?: string;               // 선택 아이콘용 (있으면)
    note?: string;                // ⭐ 비고 필드 추가
    raw: any;                     // 원본 row 전체 (추가정보 필요할 때)
}

// CriteriaSheetEditor의 전체 데이터 타입 (간단 버전)
export interface CriteriaSheetData {
    sheets: string[];
    items: Record<string, any[]>;   // key = sheetId, value = rows
}

/**
 * 한 row에서 "표시용 라벨" 뽑는 함수
 * - name / label / title 순으로 찾고, 없으면 id를 쓴다
 */
function mapRowLabel(row: any): string {
    return (
        (typeof row.label === "string" && row.label.trim()) ||
        (typeof row.name === "string" && row.name.trim()) ||
        (typeof row.title === "string" && row.title.trim()) ||
        String(row.id || "").trim() ||
        "이름없는 항목"
    );
}

/**
 * ⭐ 한 row에서 "비고(note)" 뽑는 함수
 * - notes / note / memo 순으로 찾고, 없으면 빈 문자열
 */
function mapRowNote(row: any): string {
    return (
        (typeof row.notes === "string" && row.notes.trim()) ||
        (typeof row.note === "string" && row.note.trim()) ||
        (typeof row.memo === "string" && row.memo.trim()) ||
        ""
    );
}

/**
 * CriteriaSheet 데이터에서
 *   - space(공간)
 *   - facility(시설)
 * 시트에 들어있는 row들을 전부 미니맵 후보 리스트로 변환
 */
export function buildMapCandidatesFromCriteria(
    data: CriteriaSheetData,
    options?: {
        spaceSheetIds?: string[];      // 기본값: ["space", "공간"]
        facilitySheetIds?: string[];   // 기본값: ["facility", "시설"]
    }
): {
    spaces: MapCandidate[];
    facilities: MapCandidate[];
    all: MapCandidate[];
} {
    const spaceSheetIds = options?.spaceSheetIds || ["space", "공간"];
    const facilitySheetIds = options?.facilitySheetIds || ["facility", "시설"];

    const spaces: MapCandidate[] = [];
    const facilities: MapCandidate[] = [];

    if (!data || !Array.isArray(data.sheets) || !data.items) {
        return { spaces, facilities, all: [] };
    }

    for (const sheetId of data.sheets) {
        const rows = Array.isArray(data.items?.[sheetId])
            ? data.items[sheetId]
            : [];

        // 공간 시트
        if (spaceSheetIds.includes(sheetId)) {
            rows.forEach((row: any) => {
                if (!row || !row.id) return;
                spaces.push({
                    kind: "space",
                    sheetId,
                    rowId: String(row.id),
                    label: mapRowLabel(row),
                    emoji: typeof row.emoji === "string" ? row.emoji : undefined,
                    note: mapRowNote(row), // ⭐ note 필드 추가
                    raw: row,
                });
            });
            continue;
        }

        // 시설 시트
        if (facilitySheetIds.includes(sheetId)) {
            rows.forEach((row: any) => {
                if (!row || !row.id) return;
                facilities.push({
                    kind: "facility",
                    sheetId,
                    rowId: String(row.id),
                    label: mapRowLabel(row),
                    emoji: typeof row.emoji === "string" ? row.emoji : undefined,
                    note: mapRowNote(row), // ⭐ note 필드 추가
                    raw: row,
                });
            });
            continue;
        }

        // 그 외 시트들은 미니맵 팔레트 대상 아님
    }

    const all = [...spaces, ...facilities];

    return { spaces, facilities, all };
}

/**
 * ⭐ 미니맵에서 note가 변경되면 CriteriaSheet 데이터에 반영하는 헬퍼
 * @param data - 원본 CriteriaSheetData
 * @param sheetId - 대상 시트 ID (예: "space", "facility")
 * @param rowId - 대상 row ID
 * @param note - 새로운 note 값
 * @returns 업데이트된 CriteriaSheetData (불변성 유지)
 */
export function updateNoteInCriteriaData(
    data: CriteriaSheetData,
    sheetId: string,
    rowId: string,
    note: string
): CriteriaSheetData {
    if (!data || !data.items || !Array.isArray(data.items[sheetId])) {
        console.warn(`Sheet "${sheetId}" not found in data`);
        return data;
    }

    const updatedItems = { ...data.items };
    const targetRows = [...updatedItems[sheetId]];

    const rowIndex = targetRows.findIndex((r: any) => String(r.id) === rowId);
    if (rowIndex === -1) {
        console.warn(`Row with id "${rowId}" not found in sheet "${sheetId}"`);
        return data;
    }

    // 불변성 유지하며 업데이트
    targetRows[rowIndex] = {
        ...targetRows[rowIndex],
        notes: note, // ⭐ notes 필드 업데이트
    };

    updatedItems[sheetId] = targetRows;

    return {
        ...data,
        items: updatedItems,
    };
}

/**
 * ⭐ MapCandidate에서 note를 가져오는 헬퍼
 * @param candidate - MapCandidate 객체
 * @returns note 문자열
 */
export function getCandidateNote(candidate: MapCandidate): string {
    return candidate.note || mapRowNote(candidate.raw) || "";
}

/**
 * ⭐ 특정 rowId를 가진 candidate를 찾는 헬퍼
 * @param candidates - MapCandidate 배열
 * @param rowId - 찾을 row ID
 * @returns 찾은 candidate 또는 undefined
 */
export function findCandidateByRowId(
    candidates: MapCandidate[],
    rowId: string
): MapCandidate | undefined {
    return candidates.find(c => c.rowId === rowId);
}