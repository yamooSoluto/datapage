// pages/api/profile.ts
import type { NextApiRequest, NextApiResponse } from "next";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
    // 환경변수: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        } as any),
    });
}
const db = admin.firestore();

/** 문자열 콤마입력을 배열로 정규화 */
const splitComma = (v?: string) =>
    String(v || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

/** 시설/이용권/메뉴 각각 "문자열/배열" 둘 다 허용 → [{name}] 로 통일 */
function normalizeDictInput(input: any): Array<{ name: string }> {
    if (!input) return [];
    if (typeof input === "string") return splitComma(input).map((name) => ({ name }));
    if (Array.isArray(input)) {
        return Array.from(
            new Set(
                input
                    .map((x) => (typeof x === "string" ? x : x?.name))
                    .filter(Boolean)
                    .map((s) => String(s).trim())
            )
        ).map((name) => ({ name }));
    }
    return [];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const tenant = String(req.query.tenant || "").trim();
    if (!tenant) return res.status(400).json({ error: "tenant required" });

    const ref = db.collection("tenants").doc(tenant).collection("meta").doc("profile");

    try {
        if (req.method === "GET") {
            const snap = await ref.get();
            if (!snap.exists) {
                return res.status(200).json({
                    brandName: "",
                    slackUserId: "",
                    dictionaries: { facilities: [], passes: [], menu: [] },
                    criteriaSheet: null,
                    links: {},
                    policies: {},
                    updatedAt: 0,
                });
            }
            return res.status(200).json(snap.data());
        }

        if (req.method === "PUT") {
            const body = req.body || {};
            const now = Date.now();

            // 입력: 문자열(콤마) or 배열 → 표준 형태로 정규화
            const facilities = normalizeDictInput(body.facilities);
            const passes = normalizeDictInput(body.passes);
            const menu = normalizeDictInput(body.menu);

            const profile = {
                brandName: String(body.brandName || "").trim(),
                slackUserId: String(body.slackUserId || "").trim(),
                dictionaries: {
                    facilities,
                    passes,
                    menu,
                },
                criteriaSheet: body.criteriaSheet || null,
                links: body.links || {},
                policies: body.policies || {},
                updatedAt: now,
            };

            await ref.set(profile, { merge: true });
            return res.status(200).json({ ok: true, updatedAt: now });
        }

        return res.status(405).json({ error: "method not allowed" });
    } catch (e: any) {
        console.error("[profile]", e);
        return res.status(500).json({ error: "internal_error" });
    }
}
