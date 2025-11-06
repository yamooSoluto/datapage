// pages/api/matrix.ts
// GET /api/matrix
// 자동 기본 데이터 생성
// items + links 반환

import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/firebase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const tenant = String(req.query.tenant || "").trim();
    if (!tenant) return res.status(400).json({ error: "tenant required" });

    try {
        const [itemsSnap, linksSnap] = await Promise.all([
            db.collection("tenants").doc(tenant).collection("items").get(),
            db.collection("tenants").doc(tenant).collection("links").get(),
        ]);

        let items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const links = linksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 🆕 데이터가 비어있으면 기본 데이터 자동 생성
        if (items.length === 0) {
            console.log(`✨ [matrix] 테넌트 ${tenant}에 데이터가 없습니다. 기본 데이터를 생성합니다...`);
            await createDefaultData(tenant);

            // 다시 로드
            const newItemsSnap = await db.collection("tenants").doc(tenant).collection("items").get();
            items = newItemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            console.log(`✅ [matrix] 기본 데이터 ${items.length}개 생성 완료!`);
        }

        res.status(200).json({ items, links });
    } catch (e: any) {
        console.error("[matrix] 오류:", e);
        res.status(500).json({ error: e.message });
    }
}

// 🆕 기본 필수 데이터 자동 생성
async function createDefaultData(tenant: string) {
    const batch = db.batch();

    // ═══════════════════════════════════════
    // 시설/비품 - 필수 기본 데이터
    // ═══════════════════════════════════════
    const defaultFacilities = [
        {
            name: "화장실",
            facets: {
                existence: ["있음"],
                location: ["매장 내"],
                cost: ["무료"],
                quantity: ["1개"],
                hours: ["영업시간 동안"]
            }
        },
        {
            name: "냉난방기",
            facets: {
                existence: ["있음"],
                location: ["전체"],
                cost: ["무료"],
                hours: ["영업시간 동안"]
            }
        },
        {
            name: "정수기",
            facets: {
                existence: ["있음"],
                location: ["로비"],
                cost: ["무료"],
                hours: ["24시간"],
                quantity: ["1개"]
            }
        },
        {
            name: "커피머신",
            facets: {
                existence: ["없음"],
                location: [],
                cost: [],
                hours: []
            }
        },
        {
            name: "전자레인지",
            facets: {
                existence: ["없음"],
                location: [],
                cost: []
            }
        }
    ];

    defaultFacilities.forEach((facility, index) => {
        const itemRef = db.collection("tenants").doc(tenant).collection("items").doc();
        batch.set(itemRef, {
            id: itemRef.id,
            type: "facility",
            name: facility.name,
            isRequired: true,
            isExample: true,
            facets: facility.facets,
            createdAt: Date.now(),
            order: index
        });
    });

    // ═══════════════════════════════════════
    // 룸/존 - 기본 공간 데이터
    // ═══════════════════════════════════════
    const defaultRooms = [
        {
            name: "로비",
            facets: {
                existence: ["있음"],
                location: ["1층"],
                noise: ["보통"],
                access: ["자유 이용"],
                hours: ["24시간"]
            }
        },
        {
            name: "메인 홀",
            facets: {
                existence: ["있음"],
                location: ["1층"],
                noise: ["보통"],
                capacity: ["30석"]
            }
        }
    ];

    defaultRooms.forEach((room, index) => {
        const itemRef = db.collection("tenants").doc(tenant).collection("items").doc();
        batch.set(itemRef, {
            id: itemRef.id,
            type: "room",
            name: room.name,
            isRequired: true,
            isExample: true,
            facets: room.facets,
            createdAt: Date.now(),
            order: defaultFacilities.length + index
        });
    });

    // ═══════════════════════════════════════
    // 상품/서비스 - 기본 이용권
    // ═══════════════════════════════════════
    const defaultProducts = [
        {
            name: "시간권",
            facets: {
                existence: ["없음"],
                price: [],
                duration: []
            }
        }
    ];

    defaultProducts.forEach((product, index) => {
        const itemRef = db.collection("tenants").doc(tenant).collection("items").doc();
        batch.set(itemRef, {
            id: itemRef.id,
            type: "product",
            name: product.name,
            isRequired: false,
            isExample: true,
            facets: product.facets,
            createdAt: Date.now(),
            order: index
        });
    });

    // ═══════════════════════════════════════
    // 규정 - 기본 정책
    // ═══════════════════════════════════════
    const defaultRules = [
        {
            name: "소음규정",
            facets: {
                existence: ["있음"],
                rule: ["조용한 대화 가능"],
                penalty: ["경고"]
            }
        },
        {
            name: "취식규정",
            facets: {
                existence: ["있음"],
                rule: ["뚜껑있는 음료 가능"],
                allowed: ["음료", "간단한 간식"],
                prohibited: ["배달음식", "냄새나는 음식"]
            }
        }
    ];

    defaultRules.forEach((rule, index) => {
        const itemRef = db.collection("tenants").doc(tenant).collection("items").doc();
        batch.set(itemRef, {
            id: itemRef.id,
            type: "rules",
            name: rule.name,
            isRequired: false,
            isExample: true,
            facets: rule.facets,
            createdAt: Date.now(),
            order: index
        });
    });

    await batch.commit();

    const totalItems = defaultFacilities.length + defaultRooms.length + defaultProducts.length + defaultRules.length;
    console.log(`✅ [createDefaultData] ${totalItems}개의 기본 데이터 생성 완료`);
}