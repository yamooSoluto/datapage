// pages/api/conversations/detail.js
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

// ============================================
// 📊 플랜별 조회 제한 설정 (여기서 수정)
// ============================================
const PLAN_LIMITS = {
    trial: {
        days: 30,        // 조회 가능 기간 (일)
        maxDocs: null,   // 최대 문서 수 (null = 무제한)
    },
    starter: {
        days: 30,
        maxDocs: null,
    },
    pro: {
        days: 90,
        maxDocs: null,
    },
    business: {
        days: null,      // null = 무제한
        maxDocs: null,
    },
    enterprise: {
        days: null,      // null = 무제한
        maxDocs: null,
    },
};

// 기본값 (플랜 정보 없을 때)
const DEFAULT_LIMIT = {
    days: 30,
    maxDocs: null,
};
// ============================================

// helpers
const safeIso = (t) =>
    (t?.toDate?.()?.toISOString?.() ? t.toDate().toISOString() : null);

export default async function handler(req, res) {
    try {
        const { tenant, chatId } = req.query;
        if (!tenant || !chatId) {
            return res.status(400).json({ error: "tenant and chatId are required" });
        }

        // ✅ 플랜 정보 가져오기 (tenants 컬렉션에서)
        let userPlan = 'trial'; // 기본값
        try {
            const tenantDoc = await db.collection("tenants").doc(tenant).get();
            if (tenantDoc.exists) {
                const tenantData = tenantDoc.data();
                userPlan = tenantData.plan || tenantData.subscription?.plan || 'trial';
            }
        } catch (e) {
            console.warn('[detail] Failed to get plan, using default:', e);
        }

        // ✅ 플랜별 제한 가져오기
        const limits = PLAN_LIMITS[userPlan] || DEFAULT_LIMIT;
        console.log(`[detail] Plan: ${userPlan}, Limits:`, limits);

        // 1) 우선 안정 키(tenant_chatId)로 조회
        const stableId = `${tenant}_${chatId}`;
        let convDoc = await db.collection("FAQ_realtime_cw").doc(stableId).get();

        // 2) 레거시( chatId_timestamp ) 호환: chat_id == chatId의 모든 문서 가져오기
        let allDocs = [];
        let query = db
            .collection("FAQ_realtime_cw")
            .where("tenant_id", "==", tenant)
            .where("chat_id", "==", chatId);

        // ✅ 기간 제한 적용 (days가 있으면)
        if (limits.days) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - limits.days);
            const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

            query = query.where("lastMessageAt", ">=", cutoffTimestamp);
            console.log(`[detail] Applying ${limits.days} days filter (after ${cutoffDate.toISOString()})`);
        }

        query = query.orderBy("lastMessageAt", "desc");

        // ✅ 문서 개수 제한 적용 (maxDocs가 있으면)
        if (limits.maxDocs) {
            query = query.limit(limits.maxDocs);
            console.log(`[detail] Applying maxDocs limit: ${limits.maxDocs}`);
        }

        if (!convDoc.exists) {
            const legacySnap = await query.get();

            if (!legacySnap.empty) {
                allDocs = legacySnap.docs;
                convDoc = legacySnap.docs[0]; // 최신 문서를 대표로 사용
            }
        } else {
            // 안정 키로 찾았어도, 같은 chat_id의 다른 문서들이 있을 수 있음
            const additionalSnap = await query.get();

            if (!additionalSnap.empty) {
                allDocs = additionalSnap.docs;
            } else {
                allDocs = [convDoc];
            }
        }

        if (!convDoc.exists) return res.status(404).json({ error: "conversation_not_found" });

        const d = convDoc.data();

        // ✅ 모든 문서의 메시지를 합치기
        const allMessages = [];
        allDocs.forEach(doc => {
            const docData = doc.data();
            const docMessages = Array.isArray(docData.messages) ? docData.messages : [];
            allMessages.push(...docMessages);
        });

        // ✅ 시간순 정렬 (오래된 순)
        allMessages.sort((a, b) => {
            const tsA = a.timestamp?.toMillis?.() || 0;
            const tsB = b.timestamp?.toMillis?.() || 0;
            return tsA - tsB;
        });

        // ✅ 중복 제거 (msgId 기준)
        const uniqueMessages = [];
        const seenMsgIds = new Set();
        allMessages.forEach(msg => {
            const msgId = msg.msgId || `${msg.sender}_${msg.timestamp?.toMillis?.()}_${msg.text?.slice(0, 20)}`;
            if (!seenMsgIds.has(msgId)) {
                seenMsgIds.add(msgId);
                uniqueMessages.push(msg);
            }
        });

        const messages = uniqueMessages.map((m) => ({
            sender: m.sender,
            text: m.text || "",
            pics: Array.isArray(m.pics) ? m.pics : [],
            timestamp: safeIso(m.timestamp),
            msgId: m.msgId || null,
            modeSnapshot: m.modeSnapshot || null, // ✅ 상담원 구분용 (UI에는 표시 안 함)
        }));

        // ✅ channel 보정: unknown이면 integrations에서 inboxId로 매핑
        let channel = d.channel || "unknown";
        if (channel === "unknown" && d.cw_inbox_id) {
            try {
                const integrationDoc = await db
                    .collection("integrations")
                    .doc(tenant)
                    .get();

                if (integrationDoc.exists) {
                    const integrationData = integrationDoc.data();
                    const cwConfig = integrationData?.cw;

                    if (cwConfig && Array.isArray(cwConfig.inboxes)) {
                        const inbox = cwConfig.inboxes.find(
                            (ib) => ib.inboxId === d.cw_inbox_id
                        );
                        if (inbox?.channel) {
                            channel = inbox.channel;
                            console.log(`[detail] Channel resolved: ${channel} (from inbox ${d.cw_inbox_id})`);
                        }
                    }
                }
            } catch (e) {
                console.error("[detail] Failed to resolve channel:", e);
            }
        }

        // 2) 슬랙/통계 배치 조회
        const [slackDoc, statsDoc] = await Promise.all([
            db.collection("slack_threads").doc(convDoc.id).get(),
            db.collection("stats_conversations").doc(convDoc.id).get(),
        ]);

        const slackData = slackDoc.exists ? slackDoc.data() : null;
        const stats = statsDoc.exists ? statsDoc.data() : null;

        return res.json({
            conversation: {
                id: convDoc.id,
                chatId: d.chat_id,
                userId: d.user_id,
                userName: d.user_name || "익명",
                brandName: d.brandName || null,
                channel: channel, // ✅ 보정된 channel 사용
                status: d.status || "waiting",
                modeSnapshot: d.modeSnapshot || "AUTO",
                lastMessageAt: safeIso(d.lastMessageAt),
                cwConversationId: d.cw_conversation_id || null,
                summary: d.summary || null,
                category: d.category || null, // 문자열 (예: "결제/환불|예약/변경")
                categories: d.category ? d.category.split('|').map(c => c.trim()) : [], // 배열로 변환
            },
            messages,
            slack: slackData
                ? {
                    channelId: slackData.channel_id,
                    threadTs: slackData.thread_ts,
                    cardType: slackData.card_type,
                    isTask: !!slackData.is_task,
                    slackUrl: `https://slack.com/app_redirect?channel=${slackData.channel_id}&message_ts=${slackData.thread_ts}`,
                }
                : null,
            stats: stats
                ? {
                    userChats: stats.user_chats || 0,
                    aiChats: stats.ai_allchats || 0,
                    agentChats: stats.agent_chats || 0,
                    aiAuto: stats.ai_auto || 0,
                    aiConfirmApproved: stats.ai_confirm_approved || 0,
                    aiConfirmEdited: stats.ai_confirm_edited || 0,
                }
                : null,
        });
    } catch (error) {
        console.error("[conversations/detail] error:", error);
        return res.status(500).json({ error: error.message || "internal_error" });
    }
}