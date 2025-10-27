// pages/api/conversations/list.js
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

// ── helpers
function normalizeChannel(v) {
  const s = String(v || "").toLowerCase().trim();
  if (!s) return "widget";
  if (s.includes("naver")) return "naver";
  if (s.includes("kakao")) return "kakao";
  if (s.includes("widget") || s.includes("web")) return "widget";
  return "unknown";
}
function clampLimit(x, def = 50, max = 100) {
  const n = Number(x) || def;
  return Math.max(1, Math.min(max, n));
}
function decodeCursor(cur) {
  // base64({ ts:number, id:string })
  try {
    if (!cur) return null;
    const obj = JSON.parse(Buffer.from(cur, "base64").toString("utf8"));
    if (Number.isFinite(obj.ts) && typeof obj.id === "string") return obj;
    return null;
  } catch {
    return null;
  }
}
function encodeCursor(ts, id) {
  return Buffer.from(JSON.stringify({ ts, id }), "utf8").toString("base64");
}

export default async function handler(req, res) {
  try {
    const { tenant, status = "all", channel = "all", limit, cursor } = req.query;
    if (!tenant) return res.status(400).json({ error: "tenant is required" });

    const pageSize = clampLimit(limit);

    // 기본 쿼리: tenant + lastMessageAt desc + docId desc (안정 페이지네이션)
    let q = db
      .collection("FAQ_realtime_cw")
      .where("tenant_id", "==", tenant)
      .orderBy("lastMessageAt", "desc")
      .orderBy(admin.firestore.FieldPath.documentId(), "desc");

    // 필터 (동일/다중 where → 복합 인덱스 필요)
    if (status !== "all") q = q.where("status", "==", status);
    if (channel !== "all") q = q.where("channel", "==", normalizeChannel(channel));

    // 커서 적용
    const cur = decodeCursor(cursor);
    if (cur) {
      const lastTs = new Date(cur.ts);
      q = q.startAfter(lastTs, cur.id);
    }

    const snap = await q.limit(pageSize).get();

    // 슬랙 스레드 배치 조회 (N+1 제거)
    const convDocs = snap.docs;
    const slackRefs = convDocs.map(d => db.collection("slack_threads").doc(d.id));
    const slackDocs = (slackRefs.length > 0) ? await db.getAll(...slackRefs) : [];
    const slackMap = new Map(slackDocs.map(sd => [sd.id, sd.exists ? sd.data() : null]));

    // 응답 변환
    const conversations = convDocs.map(d => {
      const v = d.data();
      const msgs = Array.isArray(v.messages) ? v.messages : [];
      const userCount = msgs.filter(m => m.sender === "user").length;
      const aiCount = msgs.filter(m => m.sender === "ai").length;
      const agentCount = msgs.filter(m => m.sender === "agent").length;
      const lastMsg = msgs[msgs.length - 1];

      const slack = slackMap.get(d.id);
      return {
        id: d.id,
        chatId: v.chat_id,
        userId: v.user_id,
        userName: v.user_name || "익명",
        brandName: v.brandName || null,
        channel: v.channel || "unknown",
        status: v.status || "waiting",
        modeSnapshot: v.modeSnapshot || "AUTO",
        lastMessageAt: v.lastMessageAt?.toDate?.()?.toISOString() || null,
        lastMessageText: lastMsg?.text?.slice(0, 80) || (lastMsg?.pics?.length ? "(이미지)" : ""),
        messageCount: { user: userCount, ai: aiCount, agent: agentCount, total: msgs.length },
        hasSlackCard: !!slack,
        isTask: !!(slack?.is_task),
      };
    });

    // 다음 페이지 커서
    const last = convDocs[convDocs.length - 1];
    const nextCursor = last
      ? encodeCursor(last.get("lastMessageAt")?.toMillis?.() || 0, last.id)
      : null;

    return res.json({ conversations, nextCursor });
  } catch (error) {
    console.error("[conversations/list] error:", error);
    return res.status(500).json({ error: error.message || "internal_error" });
  }
}
