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

// helpers
const safeIso = (t) =>
    (t?.toDate?.()?.toISOString?.() ? t.toDate().toISOString() : null);

export default async function handler(req, res) {
    try {
        const { tenant, chatId } = req.query;
        if (!tenant || !chatId) {
            return res.status(400).json({ error: "tenant and chatId are required" });
        }

        // 1) 우선 안정 키(tenant_chatId)로 조회
        const stableId = `${tenant}_${chatId}`;
        let convDoc = await db.collection("FAQ_realtime_cw").doc(stableId).get();

        // 2) 레거시( chatId_timestamp ) 호환: chat_id == chatId 중 최신 1건
        if (!convDoc.exists) {
            const legacySnap = await db
                .collection("FAQ_realtime_cw")
                .where("tenant_id", "==", tenant)
                .where("chat_id", "==", chatId)
                .orderBy("lastMessageAt", "desc")
                .limit(1)
                .get();
            if (!legacySnap.empty) convDoc = legacySnap.docs[0];
        }
        if (!convDoc.exists) return res.status(404).json({ error: "conversation_not_found" });

        const d = convDoc.data();
        const messages = (Array.isArray(d.messages) ? d.messages : []).map((m) => ({
            sender: m.sender,
            text: m.text || "",
            pics: Array.isArray(m.pics) ? m.pics : [],
            timestamp: safeIso(m.timestamp),
            modeSnapshot: m.modeSnapshot || null,
            msgId: m.msgId || null,
        }));

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
                channel: d.channel || "unknown",
                status: d.status || "waiting",
                modeSnapshot: d.modeSnapshot || "AUTO",
                lastMessageAt: safeIso(d.lastMessageAt),
                cwConversationId: d.cw_conversation_id || null,
                // ✅ summary 및 categories 추가
                summary: d.summary || null,
                categories: Array.isArray(d.categories) ? d.categories : [],
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