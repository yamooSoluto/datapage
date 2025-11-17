// pages/api/tasks/dashboard.js
import { db } from "@/lib/firebase-admin";

export default async function handler(req, res) {
    try {
        const { tenant, limit = 100 } = req.query;
        if (!tenant) return res.status(400).json({ error: "tenant is required" });

        const pageSize = Math.min(200, Math.max(1, Number(limit) || 100));

        // ✅ 업무카드(슬랙) 목록 조회
        const threadsSnapshot = await db
            .collection("slack_threads")
            .where("tenant_id", "==", tenant)
            .where("is_task", "==", true)
            .orderBy("created_at", "desc")
            .limit(pageSize)
            .get();

        if (threadsSnapshot.empty) {
            return res.json({
                tasks: [],
                summary: { pending: 0, inProgress: 0, completed: 0 }
            });
        }

        // ✅ 관련 대화 배치 조회 (chat_id 기반, 최신 세션만)
        const chatIds = threadsSnapshot.docs.map(td => td.data().conversation_id);

        // chat_id별로 최신 문서 조회
        const convPromises = chatIds.map(chatId =>
            db
                .collection("FAQ_realtime_cw")
                .where("tenant_id", "==", tenant)
                .where("chat_id", "==", chatId)
                .orderBy("lastMessageAt", "desc")
                .limit(1)
                .get()
        );

        const convSnapshots = await Promise.all(convPromises);
        const convMap = new Map();

        convSnapshots.forEach((snap, idx) => {
            if (!snap.empty) {
                const chatId = chatIds[idx];
                convMap.set(chatId, snap.docs[0].data());
            }
        });

        // ✅ merge & 상태 계산
        const tasks = threadsSnapshot.docs.map(td => {
            const t = td.data();
            const conv = convMap.get(t.conversation_id);
            const msgs = Array.isArray(conv?.messages) ? conv.messages : [];
            const lastMsg = msgs[msgs.length - 1];

            let taskStatus = "pending";
            if (conv?.status === "in_progress") taskStatus = "inProgress";
            else if (conv?.status === "resolved" || t.is_resolved) taskStatus = "completed";

            return {
                id: td.id,
                conversationId: t.conversation_id,
                chatId: conv?.chat_id || t.conversation_id,
                userName: conv?.user_name || "익명",
                brandName: conv?.brand_name || conv?.brandName || null,
                channel: conv?.channel || "unknown",
                cardType: t.card_type || null,
                status: taskStatus,
                lastMessage: lastMsg?.text?.slice(0, 120) || (lastMsg?.pics?.length ? "(이미지)" : ""),
                lastMessageAt: conv?.lastMessageAt?.toDate?.()?.toISOString() || null,
                slackUrl: `https://slack.com/app_redirect?channel=${t.channel_id}&message_ts=${t.thread_ts || t.root_ts}`,
                priority: t.priority || "normal",
                createdAt: t.created_at?.toDate?.()?.toISOString() || null,
            };
        });

        const summary = {
            pending: tasks.filter(t => t.status === "pending").length,
            inProgress: tasks.filter(t => t.status === "inProgress").length,
            completed: tasks.filter(t => t.status === "completed").length,
        };

        return res.json({ tasks, summary });
    } catch (error) {
        console.error("[tasks/dashboard] error:", error);
        return res.status(500).json({ error: error.message || "internal_error" });
    }
}