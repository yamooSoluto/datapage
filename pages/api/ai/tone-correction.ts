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
            content, // ✅ 기존 필드 (하위 호환성)
            agentInstruction, // ✅ GCP 함수 형식 필드
            userMessage, // ✅ GCP 함수 형식 필드 (선택적, 없으면 자동으로 채워짐)
            mode, // ✅ GCP 함수 형식 필드
            enableAI,
            planName,
            voice,
            contentType,
            toneFlags,
            source = 'web_portal',
            csTone: requestCsTone, // ✅ GCP 함수 형식 필드 (선택적) - 중복 선언 방지를 위해 별칭 사용
            previousMessages, // ✅ GCP 함수 형식 필드 (선택적)
            executionMode, // ✅ GCP 함수 형식 필드
        } = req.body || {};

        const actualChatId = conversationId || chatId;

        // ✅ agentInstruction 또는 content 중 하나는 필수
        const finalContent = agentInstruction || content;

        // 필수 파라미터 검증
        if (!tenantId || !actualChatId || !finalContent) {
            return res.status(400).json({ error: "tenantId, chatId, and (content or agentInstruction) required" });
        }

        // ✅ enableAI 기본값: undefined/null 이면 "켜진 상태"로 간주
        const effectiveEnableAI = enableAI === false ? false : true;

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
            contentLength: finalContent?.length,
            hasAgentInstruction: !!agentInstruction,
            hasUserMessage: !!userMessage,
            mode,
            enableAI,
            effectiveEnableAI,
            planName,
            source,
        });

        // AI 보정이 명시적으로 꺼져 있을 때만 원본 그대로 반환
        if (!effectiveEnableAI) {
            return res.status(200).json({
                ok: true,
                correctedText: finalContent,
                source: "original",
            });
        }

        // ✅ 1. 테넌트 정보 조회 (csTone)
        let tenantDoc = null;
        let csTone = null;
        try {
            const tenantSnap = await db.collection("tenants").doc(tenantId).get();
            if (tenantSnap.exists) {
                tenantDoc = tenantSnap.data();
                // ✅ csTone 값 확인 (디버깅)
                console.log("[tone-correction] Tenant data:", {
                    tenantId,
                    hasTenantDoc: !!tenantDoc,
                    csToneRaw: tenantDoc?.csTone,
                    csToneType: typeof tenantDoc?.csTone,
                    csToneLength: tenantDoc?.csTone?.length,
                    allKeys: Object.keys(tenantDoc || {}),
                });

                // ✅ csTone이 있으면 사용, 없으면 null (빈 문자열도 유지)
                csTone = tenantDoc?.csTone !== undefined ? tenantDoc.csTone : null;

                console.log("[tone-correction] Final csTone:", csTone);
            } else {
                console.warn("[tone-correction] Tenant document does not exist:", tenantId);
            }
        } catch (e) {
            console.error("[tone-correction] Failed to fetch tenant:", e);
        }

        // ✅ 2. 대화 정보 조회 (최근 5개 메시지)
        // ✅ 요청에서 userMessage가 제공되면 사용, 없으면 자동으로 채움
        let finalUserMessage = userMessage || "";
        let finalPreviousMessages = previousMessages || [];

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

                    // userMessage는 가장 최근 문서에서 (요청에 없을 때만)
                    if (!finalUserMessage && data.user_message) {
                        finalUserMessage = data.user_message;
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

                // 최근 5개 메시지만 추출 (요청에 없을 때만)
                if (!finalPreviousMessages || finalPreviousMessages.length === 0) {
                    finalPreviousMessages = allMessages.slice(-5).map(m => ({
                        sender: m.sender,
                        text: m.text || "",
                        timestamp: m.timestamp,
                        modeSnapshot: m.modeSnapshot || null,
                    }));
                }

                // userMessage가 없으면 마지막 user 메시지 사용
                if (!finalUserMessage) {
                    const lastUserMsg = [...allMessages]
                        .reverse()
                        .find((m) => m.sender === "user");
                    if (lastUserMsg) {
                        finalUserMessage = lastUserMsg.text || "";
                    }
                }

                console.log(`[tone-correction] Context loaded: ${finalPreviousMessages.length} messages, userMessage length: ${finalUserMessage?.length || 0}`);
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
            aiOptions.voice = voice || "agent";
            aiOptions.contentType = contentType || "tone_correction";
            aiOptions.toneFlags = toneFlags || "";
        }

        // ✅ 4. n8n webhook URL
        const n8nUrl = process.env.N8N_TONE_CORRECTION_WEBHOOK ||
            "https://soluto.app.n8n.cloud/webhook/tone-correction";

        // ✅ 5. 페이로드 구성 (GCP 함수 형식에 맞춤)
        // ✅ csTone 값 결정: 요청에서 명시적으로 값이 있으면 사용, 없으면 DB에서 가져온 값 사용
        // requestCsTone이 undefined가 아니고 null도 아니면 요청 값 사용, 그 외에는 DB 값 사용
        const finalCsTone = (requestCsTone !== undefined && requestCsTone !== null) ? requestCsTone : csTone;

        console.log("[tone-correction] csTone decision:", {
            requestCsTone,
            dbCsTone: csTone,
            finalCsTone,
        });

        const payload: any = {
            tenantId,
            conversationId: actualChatId,
            userMessage: finalUserMessage, // ✅ 요청에서 받거나 자동으로 채워진 값
            agentInstruction: finalContent, // ✅ agentInstruction 또는 content
            mode: mode || (contentType === 'policy_based' ? 'mediated' : 'tone_correction'), // ✅ 요청에서 받거나 자동 설정
            source: source || 'web_portal',
            planName: planName || "trial",
            csTone: finalCsTone, // ✅ null이어도 명시적으로 포함 (GCP 함수가 기대함)
            previousMessages: finalPreviousMessages, // ✅ 요청에서 받거나 자동으로 채워진 값
            ...aiOptions,
            // ✅ 웹포탈 콜백 URL (conversationId만 사용)
            callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'https://app.yamoo.ai.kr'}/api/ai/tone-result`,
            executionMode: executionMode || "production",
        };

        // ✅ undefined 필드 제거 (명시적으로) - null은 유지
        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) {
                delete payload[key];
            }
        });

        console.log("[tone-correction] Calling n8n:", {
            url: n8nUrl,
            tenantId,
            conversationId: actualChatId,
            hasUserMessage: !!finalUserMessage,
            previousMessagesCount: finalPreviousMessages.length,
            csTone: payload.csTone, // ✅ null이어도 표시
            hasCsTone: payload.csTone !== null && payload.csTone !== undefined,
            mode: payload.mode,
            hasAgentInstruction: !!payload.agentInstruction,
        });

        // ✅ 페이로드 전체 로그 (디버깅용)
        console.log("[tone-correction] Full payload:", JSON.stringify(payload, null, 2));

        // ✅ 6. n8n webhook 호출 (비동기) - 타임아웃 설정
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

        let response;
        try {
            response = await fetch(n8nUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
        } catch (fetchError: any) {
            clearTimeout(timeoutId);

            // 타임아웃 에러 처리
            if (fetchError.name === 'AbortError' || controller.signal.aborted) {
                console.error("[tone-correction] n8n request timeout after 10s");

                // 타임아웃이어도 비동기 요청이므로 200 반환 (n8n이 처리 중일 수 있음)
                return res.status(200).json({
                    ok: true,
                    message: "AI correction request sent (timeout, but request may be processing)",
                    conversationId: actualChatId,
                    warning: "n8n request timeout, but workflow may still be running",
                    pollUrl: `/api/ai/tone-poll?conversationId=${encodeURIComponent(actualChatId)}`,
                });
            }

            // 다른 네트워크 에러
            console.error("[tone-correction] n8n fetch error:", fetchError.message);
            throw fetchError;
        }

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
