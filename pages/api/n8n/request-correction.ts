// pages/api/n8n/request-correction.ts
import type { NextApiRequest, NextApiResponse } from "next";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        }),
    });
}
const db = admin.firestore();

const N8N_CORRECTION_HOOK = process.env.N8N_CORRECTION_WEBHOOK || process.env.N8N_MAIN_WEBHOOK || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

        const { tenant, chatId, text, mode = "tone_corrected" } = req.body || {};
        if (!tenant || !chatId || !String(text || "").trim()) {
            return res.status(400).json({ error: "tenant, chatId, text required" });
        }
        if (!N8N_CORRECTION_HOOK) {
            return res.status(500).json({ error: "n8n webhook not configured" });
        }

        // 최신 대화 컨텍스트(최근 문서 1개) 수집
        const docId = `${tenant}_${chatId}`;
        const snap = await db.collection("FAQ_realtime_cw").doc(docId).get();
        const data = snap.exists ? snap.data() || {} : {};
        const userMsgs = Array.isArray(data?.messages)
            ? data.messages.filter((m: any) => m?.sender === "user").map((m: any) => m?.text).filter(Boolean)
            : [];

        // n8n으로 “보정 요청” 전송 — n8n은 결과 완성 후 /api/n8n/send-final 로 콜백
        const payload = {
            type: "correction_request",
            tenantId: tenant,
            conversationId: String(chatId),
            draft: String(text),             // 상담원이 쓴 초안
            recentUserMessages: userMsgs,    // 참고 컨텍스트
            mode,                            // tone_corrected | mediated 등
            callback: `${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/n8n/send-final`, // 결과 전송 목적지
        };

        const r = await fetch(N8N_CORRECTION_HOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!r.ok) throw new Error(`n8n_failed_${r.status}`);
        return res.status(200).json({ ok: true, queued: true });
    } catch (e: any) {
        console.error("[request-correction] error:", e?.message || e);
        return res.status(500).json({ error: "internal_error", detail: e?.message || String(e) });
    }
}
