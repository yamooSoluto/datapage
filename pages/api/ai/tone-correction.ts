// pages/api/ai/tone-correction.ts
import type { NextApiRequest, NextApiResponse } from "next";
import admin from "firebase-admin";

// Firebase 초기화
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

// ✅ 진행 중인 요청 추적 (같은 conversationId로 동시 요청 방지)
const pendingRequests: Map<string, { timestamp: number }> = new Map();
const REQUEST_TIMEOUT = 30000; // 30초

export const config = { api: { bodyParser: true } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") return res.status(405).end();

    try {
        const {
            tenantId,
            chatId,
            conversationId, // chatId의 alias
            content,
            enableAI,
            planName,
            voice,
            contentType,
            toneFlags,
            source = 'web_portal',
        } = req.body || {};

        const actualChatId = conversationId || chatId;

        // 필수 파라미터 검증
        if (!tenantId || !actualChatId || !content) {
            return res.status(400).json({ error: "tenantId, chatId, content required" });
        }

        // ✅ 동일 conversationId로 진행 중인 요청 확인
        const requestKey = `${tenantId}_${actualChatId}`;
        const pendingRequest = pendingRequests.get(requestKey);

        if (pendingRequest) {
            const elapsed = Date.now() - pendingRequest.timestamp;
            if (elapsed < REQUEST_TIMEOUT) {
                console.warn("[tone-correction] ⚠️ Request already in progress:", requestKey);
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

        console.log("[tone-correction] Request:", {
            tenantId,
            chatId: actualChatId,
            contentLength: content?.length,
            enableAI,
            planName,
            source,
        });

        // AI 보정이 비활성화면 원본 그대로 반환
        if (!enableAI) {
            return res.status(200).json({
                ok: true,
                correctedText: content,
                source: 'original'
            });
        }

        // ✅ 1. 테넌트 정보 조회 (csTone)
        let tenantDoc = null;
        let csTone = null;
        try {
            const tenantSnap = await db.collection("tenants").doc(tenantId).get();
            if (tenantSnap.exists) {
                tenantDoc = tenantSnap.data();
                csTone = tenantDoc?.csTone || null;
            }
        } catch (e) {
            console.error("[tone-correction] Failed to fetch tenant:", e);
        }

        // ✅ 2. 대화 정보 조회 (최근 5개 메시지)
        let userMessage = "";
        let previousMessages = [];

        try {
            // 최근 5개 문서 조회
            const contextSnap = await db
                .collection("FAQ_realtime_cw")
                .where("tenant_id", "==", tenantId)
                .where("chat_id", "==", actualChatId)
                .orderBy("lastMessageAt", "desc")
                .limit(5)
                .get();

            if (!contextSnap.empty) {
                const allMessages: any[] = [];

                // 모든 문서의 messages 병합
                contextSnap.docs.forEach((doc) => {
                    const data = doc.data();

                    // userMessage는 가장 최근 문서에서
                    if (!userMessage && data.user_message) {
                        userMessage = data.user_message;
                    }

                    // 모든 문서의 messages 배열 수집
                    if (Array.isArray(data.messages)) {
                        allMessages.push(...data.messages);
                    }
                });

                // 시간 순으로 정렬
                allMessages.sort((a, b) => {
                    const getMillis = (m: any) => {
                        if (m.timestamp?.toMillis) return m.timestamp.toMillis();
                        if (m.timestamp?._seconds) return m.timestamp._seconds * 1000;
                        if (m.timestamp?.seconds) return m.timestamp.seconds * 1000;
                        return 0;
                    };
                    return getMillis(a) - getMillis(b);
                });

                // 최근 5개 메시지만 추출
                previousMessages = allMessages.slice(-5).map(m => ({
                    sender: m.sender,
                    text: m.text || "",
                    timestamp: m.timestamp,
                    modeSnapshot: m.modeSnapshot || null,
                }));

                // userMessage가 없으면 마지막 user 메시지 사용
                if (!userMessage) {
                    const lastUserMsg = [...allMessages]
                        .reverse()
                        .find((m) => m.sender === "user");
                    if (lastUserMsg) {
                        userMessage = lastUserMsg.text || "";
                    }
                }

                console.log(`[tone-correction] Context loaded: ${previousMessages.length} messages, userMessage length: ${userMessage?.length || 0}`);
            }
        } catch (e) {
            console.error("[tone-correction] Failed to fetch conversation context:", e);
            // 컨텍스트 없이도 진행
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

        // ✅ 4. n8n webhook URL
        const n8nUrl = process.env.N8N_TONE_CORRECTION_WEBHOOK ||
            "https://soluto.app.n8n.cloud/webhook/tone-correction";

        // ✅ 5. 페이로드 구성 (conversationId만 사용, requestId 제거)
        const payload: any = {
            tenantId,
            conversationId: actualChatId,
            userMessage, // ✅ 추가
            agentInstruction: content,
            mode: "mediated",
            source, // 'web_portal'
            planName: planName || "trial",
            csTone: csTone || null, // ✅ 테넌트 CS 톤 (null로 명시)
            previousMessages: previousMessages || [], // ✅ 최근 5개 메시지 (빈 배열로 명시)
            ...aiOptions,
            // ✅ 웹포탈 콜백 URL (conversationId만 사용)
            callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'https://app.yamoo.ai.kr'}/api/ai/tone-result`,
            executionMode: "production",
        };

        // ✅ undefined 필드 제거 (명시적으로)
        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) {
                delete payload[key];
            }
        });

        console.log("[tone-correction] Calling n8n:", {
            url: n8nUrl,
            tenantId,
            conversationId: actualChatId,
            hasUserMessage: !!userMessage,
            previousMessagesCount: previousMessages.length,
            hasCsTone: !!csTone,
        });

        // ✅ 페이로드 전체 로그 (디버깅용)
        console.log("[tone-correction] Full payload:", JSON.stringify(payload, null, 2));

        // ✅ 6. n8n webhook 호출 (비동기)
        const response = await fetch(n8nUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            console.error("[tone-correction] n8n error:", response.status, errorText);

            // ✅ 에러 발생 시 진행 중인 요청 제거
            pendingRequests.delete(requestKey);

            // n8n 오류여도 200 반환 (비동기이므로)
            return res.status(200).json({
                ok: true,
                message: "AI correction request sent",
                conversationId: actualChatId,
                warning: `n8n returned ${response.status}`
            });
        }

        console.log("[tone-correction] n8n request sent successfully");

        // ✅ 비동기 요청이므로 진행 중인 요청은 타임아웃으로 자동 정리됨
        // tone-result에서 콜백이 오면 결과가 저장되므로 여기서는 정리하지 않음

        return res.status(200).json({
            ok: true,
            message: "AI correction request sent",
            conversationId: actualChatId,
            // 폴링 시작 안내
            pollUrl: `/api/ai/tone-poll?conversationId=${encodeURIComponent(actualChatId)}`,
        });

    } catch (e: any) {
        console.error("[tone-correction] Error:", e);

        // ✅ 에러 발생 시 진행 중인 요청 제거
        const requestKey = `${req.body?.tenantId}_${req.body?.conversationId || req.body?.chatId}`;
        if (requestKey) {
            pendingRequests.delete(requestKey);
        }

        return res.status(500).json({
            error: e?.message || "unknown error",
            stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined
        });
    }
}
