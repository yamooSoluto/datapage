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
            requestId, // ✅ 폴링용 ID
            source = 'web_portal',
        } = req.body || {};

        const actualChatId = conversationId || chatId;

        console.log("[tone-correction] Request:", {
            tenantId,
            chatId: actualChatId,
            contentLength: content?.length,
            enableAI,
            planName,
            requestId,
            source,
        });

        // 필수 파라미터 검증
        if (!tenantId || !actualChatId || !content) {
            return res.status(400).json({ error: "tenantId, chatId, content required" });
        }

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

        // ✅ 5. 페이로드 구성 (슬랙과 동일한 스키마)
        const payload = {
            tenantId,
            conversationId: actualChatId,
            userMessage, // ✅ 추가
            agentInstruction: content,
            mode: "mediated",
            source, // 'web_portal'
            planName: planName || "trial",
            requestId, // ✅ 폴링용
            csTone, // ✅ 테넌트 CS 톤
            previousMessages, // ✅ 최근 5개 메시지
            ...aiOptions,
            // ✅ 웹포탈 콜백 URL
            callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'https://app.yamoo.ai.kr'}/api/ai/tone-result`,
            executionMode: "production",
        };

        console.log("[tone-correction] Calling n8n:", {
            url: n8nUrl,
            tenantId,
            conversationId: actualChatId,
            requestId,
            hasUserMessage: !!userMessage,
            previousMessagesCount: previousMessages.length,
            hasCsTone: !!csTone,
        });

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

            // n8n 오류여도 200 반환 (비동기이므로)
            return res.status(200).json({
                ok: true,
                message: "AI correction request sent",
                requestId,
                warning: `n8n returned ${response.status}`
            });
        }

        console.log("[tone-correction] n8n request sent successfully");

        return res.status(200).json({
            ok: true,
            message: "AI correction request sent",
            requestId,
            // 폴링 시작 안내
            pollUrl: `/api/ai/tone-poll?requestId=${requestId}`,
        });

    } catch (e: any) {
        console.error("[tone-correction] Error:", e);
        return res.status(500).json({
            error: e?.message || "unknown error",
            stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined
        });
    }
}