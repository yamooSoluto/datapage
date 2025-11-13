// pages/api/ai/tone-correction-async.ts
// 비동기 방식: 즉시 requestId 반환하고 n8n에 전송

import type { NextApiRequest, NextApiResponse } from "next";
import admin from "firebase-admin";
import { nanoid } from "nanoid";

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

// ✅ 메모리 저장소 (간단한 구현, 나중에 Redis로 업그레이드 가능)
// 프로덕션에서는 Redis나 DB를 사용해야 합니다
const requestStore = new Map<string, {
    status: 'pending' | 'processing' | 'completed' | 'error';
    result?: any;
    error?: string;
    createdAt: number;
}>();

// ✅ 30분 후 자동 정리
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of requestStore.entries()) {
        if (now - value.createdAt > 30 * 60 * 1000) {
            requestStore.delete(key);
        }
    }
}, 5 * 60 * 1000); // 5분마다 정리

export { requestStore }; // Callback에서 사용

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

        console.log("[tone-correction-async] Request:", {
            tenantId,
            conversationId,
            contentLength: content?.length,
            enableAI,
            planName,
        });

        if (!tenantId || !conversationId || !content) {
            return res.status(400).json({ error: "tenantId, conversationId, content required" });
        }

        // ✅ AI 미사용 시 즉시 반환
        if (!enableAI) {
            return res.status(200).json({
                ok: true,
                correctedText: content,
                source: 'original',
                sync: true, // 동기적으로 바로 반환
            });
        }

        // ✅ 1. 고유한 requestId 생성
        const requestId = nanoid();

        // ✅ 2. 상태 저장 (pending)
        requestStore.set(requestId, {
            status: 'pending',
            createdAt: Date.now(),
        });

        console.log("[tone-correction-async] Created request:", requestId);

        // ✅ 3. 테넌트 정보 조회
        let csTone = null;
        try {
            const tenantSnap = await db.collection("tenants").doc(tenantId).get();
            if (tenantSnap.exists) {
                csTone = tenantSnap.data()?.csTone || null;
            }
        } catch (e) {
            console.error("[tone-correction-async] Failed to fetch tenant:", e);
        }

        // ✅ 4. 대화 컨텍스트 조회
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
            console.error("[tone-correction-async] Failed to fetch context:", e);
        }

        // ✅ 5. AI 옵션 구성
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

        // ✅ 6. Callback URL 구성
        const callbackUrl = process.env.NEXT_PUBLIC_API_URL
            ? `${process.env.NEXT_PUBLIC_API_URL}/api/ai/tone-result`
            : `${req.headers.origin || 'http://localhost:3000'}/api/ai/tone-result`;

        // ✅ 7. n8n webhook URL (비동기 버전)
        const n8nUrl = process.env.N8N_TONE_CORRECTION_ASYNC_WEBHOOK ||
            process.env.N8N_TONE_CORRECTION_WEBHOOK ||
            "https://soluto.app.n8n.cloud/webhook/tone-correction-portal";

        // ✅ 8. 페이로드 구성
        const payload = {
            requestId, // requestId도 포함 (선택사항)
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
            callbackUrl, // ✅ n8n이 여기로 결과 전송
            syncMode: false, // 비동기 모드
        };

        console.log("[tone-correction-async] Sending to n8n:", {
            requestId,
            n8nUrl,
            callbackUrl,
        });

        // ✅ 9. n8n에 비동기 요청 전송 (응답 기다리지 않음)
        // Fire-and-forget 방식
        fetch(n8nUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        }).catch((err) => {
            console.error("[tone-correction-async] n8n request failed:", err);
            // ✅ 에러 상태 업데이트
            requestStore.set(requestId, {
                status: 'error',
                error: 'n8n 요청 실패',
                createdAt: Date.now(),
            });
        });

        // ✅ 10. 즉시 응답 반환 (conversationId를 키로 사용)
        return res.status(202).json({
            ok: true,
            requestId, // 참고용
            conversationId, // ✅ 폴링에 사용할 키
            status: 'pending',
            message: 'AI 보정 요청이 접수되었습니다. 잠시 후 결과를 확인하세요.',
        });

    } catch (e: any) {
        console.error("[tone-correction-async] Error:", e);
        return res.status(500).json({
            error: e?.message || "AI 보정 요청 중 오류가 발생했습니다.",
        });
    }
}
