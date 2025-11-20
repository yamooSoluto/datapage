// lib/useMapPalette.ts
import { useMemo } from "react";
import {
    CriteriaSheetData,
    buildMapCandidatesFromCriteria,
    MapCandidate,
} from "./mapPalette";

interface UseMapPaletteOptions {
    spaceSheetIds?: string[];
    facilitySheetIds?: string[];
}

/**
 * CriteriaSheetEditor 의 data를 받아서
 *  - 공간 후보(spaces)
 *  - 시설 후보(facilities)
 *  - 전체(all)
 * 를 반환하는 훅
 */
export function useMapPalette(
    criteriaData: CriteriaSheetData | null | undefined,
    options?: UseMapPaletteOptions
): {
    spaces: MapCandidate[];
    facilities: MapCandidate[];
    all: MapCandidate[];
} {
    return useMemo(() => {
        if (!criteriaData) {
            return { spaces: [], facilities: [], all: [] };
        }
        return buildMapCandidatesFromCriteria(criteriaData, options);
    }, [criteriaData, options?.spaceSheetIds?.join(","), options?.facilitySheetIds?.join(",")]);
}
