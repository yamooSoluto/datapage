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

// ✅ 진행 중인 요청 추적 (같은 conversationId로 동시 요청 방지)
const pendingRequests: Map<string, { timestamp: number }> = new Map();
const REQUEST_TIMEOUT = 30000; // 30초

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

        // ✅ 동일 conversationId로 진행 중인 요청 확인
        const requestKey = `${tenantId}_${conversationId}`;
        const pendingRequest = pendingRequests.get(requestKey);

        if (pendingRequest) {
            const elapsed = Date.now() - pendingRequest.timestamp;
            if (elapsed < REQUEST_TIMEOUT) {
                console.warn("[tone-correction-sync] ⚠️ Request already in progress:", requestKey);
                return res.status(429).json({
                    error: "이미 AI 보정 요청이 진행 중입니다. 잠시 후 다시 시도해주세요.",
                    retryAfter: Math.ceil((REQUEST_TIMEOUT - elapsed) / 1000),
                });
            } else {
                // 타임아웃된 요청 정리
                pendingRequests.delete(requestKey);
            }
        }

        // ✅ 진행 중인 요청 등록 (conversationId만 사용)
        pendingRequests.set(requestKey, { timestamp: Date.now() });

        // ✅ 타임아웃 후 자동 정리
        setTimeout(() => {
            pendingRequests.delete(requestKey);
        }, REQUEST_TIMEOUT);

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

        // ✅ 5. 페이로드 구성 (conversationId만 사용, requestId 제거)
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
            // ✅ 콜백 URL (conversationId만 사용)
            callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'https://app.yamoo.ai.kr'}/api/ai/tone-result`,
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

            // ✅ 디버깅: n8n 응답 전체 로그
            console.log("[tone-correction-sync] n8n response:", JSON.stringify(result, null, 2));
            console.log("[tone-correction-sync] Response keys:", Object.keys(result || {}));

            // ✅ n8n이 "Workflow was started" 같은 메시지만 반환하는 경우 (비동기 처리)
            if (result.message && result.message.includes("Workflow was started")) {
                console.log("[tone-correction-sync] ⚠️ n8n returned async response, waiting for callback...");

                // ✅ 진행 중인 요청 등록 해제 (콜백에서 처리)
                // pendingRequests는 타임아웃으로 정리됨

                // ✅ conversationId로 폴링하도록 안내
                return res.status(202).json({
                    ok: true,
                    message: "AI 보정 요청이 시작되었습니다. 결과를 기다리는 중...",
                    conversationId,
                    pollUrl: `/api/ai/tone-poll?conversationId=${encodeURIComponent(conversationId)}`,
                    // 클라이언트가 폴링하도록 안내
                    async: true,
                });
            }

            // ✅ n8n이 다양한 필드명으로 보낼 수 있음: correctedText, output, text 등
            let correctedText = result.correctedText ||
                result.output ||
                result.text ||
                result.response ||
                content; // fallback

            // ✅ JSON.stringify로 이중 인코딩된 경우 처리
            if (typeof correctedText === 'string' && correctedText.startsWith('"') && correctedText.endsWith('"')) {
                try {
                    correctedText = JSON.parse(correctedText);
                } catch (e) {
                    // 파싱 실패하면 그대로 사용
                    console.warn("[tone-correction-sync] Failed to parse double-encoded string:", e);
                }
            }

            console.log("[tone-correction-sync] Extracted correctedText:", {
                correctedText: correctedText?.substring(0, 50),
                length: correctedText?.length,
                type: typeof correctedText,
                source: result.correctedText ? 'correctedText' :
                    result.output ? 'output' :
                        result.text ? 'text' :
                            result.response ? 'response' : 'fallback'
            });

            // ✅ 진행 중인 요청 제거
            pendingRequests.delete(requestKey);

            return res.status(200).json({
                ok: true,
                correctedText: correctedText,
                originalText: content,
                customerMessage: userMessage || '', // ✅ 고객 메시지 반환
                metadata: result.metadata || null,
            });

        } catch (err: any) {
            clearTimeout(timeoutId);

            // ✅ 에러 발생 시 진행 중인 요청 제거
            pendingRequests.delete(requestKey);

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

        // ✅ 에러 발생 시 진행 중인 요청 제거
        const requestKey = `${req.body?.tenantId}_${req.body?.conversationId}`;
        if (requestKey) {
            pendingRequests.delete(requestKey);
        }

        return res.status(500).json({
            error: e?.message || "AI 보정 중 오류가 발생했습니다.",
        });
    }
}