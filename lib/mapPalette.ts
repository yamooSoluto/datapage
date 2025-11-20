// lib/mapPalette.ts

// ✅ CriteriaSheetEditor에서 쓰는 데이터 구조 가정
//  - data.sheets: string[]  (예: ["space", "facility", ...])
//  - data.items[sheetId]: { id: string; name?: string; label?: string; emoji?: string; [key: string]: any }[]
// 실제 필드명이 다르면 아래에서 mapRowLabel 부분만 맞춰주면 됨.

export type MapCandidateKind = "space" | "facility";

export interface MapCandidate {
    kind: MapCandidateKind;       // "space" | "facility"
    sheetId: string;              // "space" or "facility"
    rowId: string;                // row의 id
    label: string;                // 화면에 보여줄 이름
    emoji?: string;               // 선택 아이콘용 (있으면)
    raw: any;                     // 원본 row 전체 (추가정보 필요할 때)
}

// CriteriaSheetEditor의 전체 데이터 타입 (간단 버전)
export interface CriteriaSheetData {
    sheets: string[];
    items: Record<string, any[]>;   // key = sheetId, value = rows
}

/**
 * 한 row에서 “표시용 라벨” 뽑는 함수
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
