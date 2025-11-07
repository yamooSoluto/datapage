import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/firebase";
import { generateInitialSheetData } from "@/components/onboarding/config";

type SheetSelections = {
    space?: string[];
    facility?: string[];
    seat?: string[];
    [key: string]: string[] | undefined;
};

const chunk = <T,>(arr: T[], size: number) => {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "method_not_allowed" });
    }

    const { tenantId, industry = "other", selections = {}, sheetData } = req.body || {};
    if (!tenantId) {
        return res.status(400).json({ error: "tenantId_required" });
    }

    try {
        const normalizedSelections: SheetSelections = {
            space: Array.isArray(selections.space) ? selections.space : [],
            facility: Array.isArray(selections.facility) ? selections.facility : [],
            seat: Array.isArray(selections.seat) ? selections.seat : [],
        };

        const generated = sheetData?.items ? sheetData : generateInitialSheetData(industry, normalizedSelections);
        const sheetIds: string[] = Array.isArray(generated.sheets) && generated.sheets.length
            ? generated.sheets
            : Object.keys(generated.items || {});

        const tenantRef = db.collection("tenants").doc(tenantId);
        const itemsRef = tenantRef.collection("items");
        const batch = db.batch();

        // 기존 시트 아이템 정리 (최대 10개 chunk)
        if (sheetIds.length) {
            const chunks = chunk(sheetIds, 10);
            for (const ids of chunks) {
                const snapshot = await itemsRef.where("type", "in", ids).get();
                snapshot.forEach((doc) => batch.delete(doc.ref));
            }
        }

        // 새 아이템 추가
        Object.entries(generated.items || {}).forEach(([sheetId, rows]) => {
            if (!Array.isArray(rows)) return;
            rows.forEach((row: any, index) => {
                const docRef = itemsRef.doc();
                batch.set(docRef, {
                    id: docRef.id,
                    type: sheetId,
                    sheetId,
                    name: row.name,
                    icon: row.icon || "🧩",
                    facets: row.facets || { existence: "있음" },
                    order: row.order ?? index + 1,
                    isRequired: row.isRequired ?? false,
                    createdAt: row.createdAt || Date.now(),
                    onboardingSeed: true,
                });
            });
        });

        // 온보딩 정보 메타 업데이트
        batch.set(
            tenantRef.collection("meta").doc("profile"),
            {
                industry,
                onboardingInitialized: true,
                criteriaData: generated,
                updatedAt: Date.now(),
            },
            { merge: true }
        );

        await batch.commit();

        return res.status(200).json({
            ok: true,
            sheets: sheetIds,
            counts: Object.fromEntries(
                Object.entries(generated.items || {}).map(([sheetId, rows]) => [sheetId, Array.isArray(rows) ? rows.length : 0])
            ),
        });
    } catch (error: any) {
        console.error("[onboarding/initialize]", error);
        return res.status(500).json({ error: "internal_error", message: error?.message });
    }
}

