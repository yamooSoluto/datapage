// pages/api/ai/tone-correction-sync.ts
// 동기 방식: n8n이 바로 응답을 반환하도록

import type { NextApiRequest, NextApiResponse } from "next";
import admin from "firebase-admin";

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

export const config = {
    api: {
        bodyParser: true,
        // ✅ 30초 타임아웃 (Vercel Hobby 플랜 최대값)
        maxDuration: 30,
    }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") return res.status(405).end();

    try {
        const {
            tenantId,
            conversationId,
            content,
            enableAI,
            planName,
            voice,
            contentType,
            toneFlags,
            source = 'web_portal',
        } = req.body || {};

        console.log("[tone-correction-sync] Request:", {
            tenantId,
            conversationId,
            contentLength: content?.length,
            enableAI,
            planName,
        });

        if (!tenantId || !conversationId || !content) {
            return res.status(400).json({ error: "tenantId, conversationId, content required" });
        }

        if (!enableAI) {
            return res.status(200).json({
                ok: true,
                correctedText: content,
                source: 'original'
            });
        }

        // ✅ 1. 테넌트 정보 조회
        let csTone = null;
        try {
            const tenantSnap = await db.collection("tenants").doc(tenantId).get();
            if (tenantSnap.exists) {
                csTone = tenantSnap.data()?.csTone || null;
            }
        } catch (e) {
            console.error("[tone-correction-sync] Failed to fetch tenant:", e);
        }

        // ✅ 2. 대화 정보 조회 (최근 5개 메시지)
        let userMessage = "";
        let previousMessages = [];

        try {
            const contextSnap = await db
                .collection("FAQ_realtime_cw")
                .where("tenant_id", "==", tenantId)
                .where("chat_id", "==", conversationId)
                .orderBy("lastMessageAt", "desc")
                .limit(5)
                .get();

            if (!contextSnap.empty) {
                const allMessages: any[] = [];

                contextSnap.docs.forEach((doc) => {
                    const data = doc.data();
                    if (!userMessage && data.user_message) {
                        userMessage = data.user_message;
                    }
                    if (Array.isArray(data.messages)) {
                        allMessages.push(...data.messages);
                    }
                });

                allMessages.sort((a, b) => {
                    const getMillis = (m: any) => {
                        if (m.timestamp?.toMillis) return m.timestamp.toMillis();
                        if (m.timestamp?._seconds) return m.timestamp._seconds * 1000;
                        if (m.timestamp?.seconds) return m.timestamp.seconds * 1000;
                        return 0;
                    };
                    return getMillis(a) - getMillis(b);
                });

                previousMessages = allMessages.slice(-5).map(m => ({
                    sender: m.sender,
                    text: m.text || "",
                    timestamp: m.timestamp,
                    modeSnapshot: m.modeSnapshot || null,
                }));

                if (!userMessage) {
                    const lastUserMsg = [...allMessages]
                        .reverse()
                        .find((m) => m.sender === "user");
                    if (lastUserMsg) {
                        userMessage = lastUserMsg.text || "";
                    }
                }
            }
        } catch (e) {
            console.error("[tone-correction-sync] Failed to fetch context:", e);
        }

        // ✅ 3. AI 옵션 구성
        const aiOptions: any = {};
        if (planName === 'business') {
            aiOptions.routing = "agent_mediation";
            aiOptions.voice = voice || "agent";
            aiOptions.contentType = contentType || "tone_correction";
            aiOptions.toneFlags = toneFlags || "";
        } else if (planName === 'pro') {
            aiOptions.routing = "agent_mediation";
            aiOptions.voice = "agent";
            aiOptions.contentType = "tone_correction";
            aiOptions.toneFlags = "";
        }

        // ✅ 4. n8n webhook URL (동기 버전)
        const n8nUrl = process.env.N8N_TONE_CORRECTION_SYNC_WEBHOOK ||
            process.env.N8N_TONE_CORRECTION_WEBHOOK ||
            "https://soluto.app.n8n.cloud/webhook/tone-correction-sync";

        // ✅ 5. 페이로드 구성
        const payload = {
            tenantId,
            conversationId,
            userMessage,
            agentInstruction: content,
            mode: "mediated",
            source,
            planName: planName || "trial",
            csTone: csTone || null,
            previousMessages: previousMessages || [],
            ...aiOptions,
            executionMode: "production",
            // ✅ 동기 모드 표시
            syncMode: true,
        };

        console.log("[tone-correction-sync] Calling n8n (sync mode)");

        // ✅ 6. n8n webhook 호출 (동기 - 응답 대기)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25초

        try {
            const response = await fetch(n8nUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                console.error("[tone-correction-sync] n8n error:", response.status, errorText);
                throw new Error(`n8n returned ${response.status}`);
            }

            const result = await response.json();
            console.log("[tone-correction-sync] Success:", {
                hasCorrectedText: !!result.correctedText,
                textLength: result.correctedText?.length,
            });

            return res.status(200).json({
                ok: true,
                correctedText: result.correctedText || content,
                originalText: content,
                customerMessage: userMessage || '', // ✅ 고객 메시지 반환
                metadata: result.metadata || null,
            });

        } catch (err: any) {
            clearTimeout(timeoutId);

            if (err.name === 'AbortError') {
                console.error("[tone-correction-sync] Timeout after 25s");
                return res.status(504).json({
                    error: "AI 보정 시간이 초과되었습니다. 다시 시도해주세요.",
                });
            }

            throw err;
        }

    } catch (e: any) {
        console.error("[tone-correction-sync] Error:", e);
        return res.status(500).json({
            error: e?.message || "AI 보정 중 오류가 발생했습니다.",
        });
    }
}