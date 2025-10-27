// pages/api/tasks/dashboard.js
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

export default async function handler(req, res) {
  try {
    const { tenant, limit = 100 } = req.query;
    if (!tenant) return res.status(400).json({ error: "tenant is required" });

    const pageSize = Math.min(200, Math.max(1, Number(limit) || 100));

    // 1) 업무카드(슬랙) 목록
    const threadsSnapshot = await db
      .collection("slack_threads")
      .where("tenant_id", "==", tenant)
      .where("is_task", "==", true)
      .orderBy("created_at", "desc")
      .limit(pageSize)
      .get();

    if (threadsSnapshot.empty) {
      return res.json({ tasks: [], summary: { pending: 0, inProgress: 0, completed: 0 } });
    }

    // 2) 관련 대화 배치 조회
    const convRefs = threadsSnapshot.docs.map(td =>
      db.collection("FAQ_realtime_cw").doc(`${tenant}_${td.data().conversation_id}`)
    );
    const convDocs = convRefs.length ? await db.getAll(...convRefs) : [];
    const convMap = new Map(convDocs.map(cd => [cd.id, cd.exists ? cd.data() : null]));

    // 3) merge & 상태 계산
    const tasks = threadsSnapshot.docs.map(td => {
      const t = td.data();
      const convId = `${tenant}_${t.conversation_id}`;
      const conv = convMap.get(convId);
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
        channel: conv?.channel || "unknown",
        cardType: t.card_type || null,
        status: taskStatus,
        lastMessage: lastMsg?.text?.slice(0, 120) || (lastMsg?.pics?.length ? "(이미지)" : ""),
        lastMessageAt: conv?.lastMessageAt?.toDate?.()?.toISOString() || null,
        slackUrl: `https://slack.com/app_redirect?channel=${t.channel_id}&message_ts=${t.thread_ts}`,
        priority: t.priority || "normal",
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
