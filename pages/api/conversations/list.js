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
    if (s.includes("channel")) return s; // channeltalk_kakao 등
    if (s.includes("widget") || s.includes("web")) return "widget";
    return "unknown";
}

function clampLimit(x, def = 50, max = 100) {
    const n = Number(x) || def;
    return Math.max(1, Math.min(max, n));
}

function decodeCursor(cur) {
    try {
        if (!cur) return null;
        const obj = JSON.parse(Buffer.from(cur, "base64").toString("utf8"));
        if (Number.isFinite(obj.ts) && typeof obj.chatId === "string") return obj;
        return null;
    } catch {
        return null;
    }
}

function encodeCursor(ts, chatId) {
    return Buffer.from(JSON.stringify({ ts, chatId }), "utf8").toString("base64");
}

export default async function handler(req, res) {
    try {
        const { tenant, status = "all", channel = "all", limit, cursor } = req.query;
        if (!tenant) return res.status(400).json({ error: "tenant is required" });

        const pageSize = clampLimit(limit);

        // ✅ chat_id 기반 조회 (각 채팅방의 최신 세션만)
        let q = db
            .collection("FAQ_realtime_cw")
            .where("tenant_id", "==", tenant)
            .orderBy("lastMessageAt", "desc");

        // 필터 적용
        if (status !== "all") q = q.where("status", "==", status);
        if (channel !== "all") q = q.where("channel", "==", normalizeChannel(channel));

        // 커서 적용 (타임스탬프 기반)
        const cur = decodeCursor(cursor);
        if (cur) {
            const lastTs = admin.firestore.Timestamp.fromMillis(cur.ts);
            q = q.startAfter(lastTs);
        }

        // ✅ 더 많이 가져와서 chat_id 중복 제거 (pageSize * 3)
        const snap = await q.limit(pageSize * 3).get();

        // ✅ chat_id 기준으로 그룹핑 (최신 문서만 사용)
        const chatMap = new Map();
        snap.docs.forEach(doc => {
            const data = doc.data();
            const chatId = data.chat_id;

            if (!chatMap.has(chatId)) {
                chatMap.set(chatId, { doc, data });
            } else {
                // 이미 있으면 더 최신 것만 유지
                const existing = chatMap.get(chatId);
                const existingTs = existing.data.lastMessageAt?.toMillis() || 0;
                const currentTs = data.lastMessageAt?.toMillis() || 0;

                if (currentTs > existingTs) {
                    chatMap.set(chatId, { doc, data });
                }
            }
        });

        // ✅ 최신순 정렬 후 페이지 크기만큼만 반환
        const uniqueDocs = Array.from(chatMap.values())
            .sort((a, b) => {
                const tsA = a.data.lastMessageAt?.toMillis() || 0;
                const tsB = b.data.lastMessageAt?.toMillis() || 0;
                return tsB - tsA;
            })
            .slice(0, pageSize);

        // 슬랙 스레드 배치 조회
        const slackRefs = uniqueDocs.map(({ doc }) =>
            db.collection("slack_threads").doc(`${tenant}_${doc.data().chat_id}`)
        );
        const slackDocs = slackRefs.length > 0 ? await db.getAll(...slackRefs) : [];
        const slackMap = new Map(
            slackDocs.map(sd => [sd.id.split('_').slice(1).join('_'), sd.exists ? sd.data() : null])
        );

        // 응답 변환
        const conversations = uniqueDocs.map(({ doc, data: v }) => {
            const msgs = Array.isArray(v.messages) ? v.messages : [];
            const userCount = msgs.filter(m => m.sender === "user").length;
            const aiCount = msgs.filter(m => m.sender === "ai").length;
            const agentCount = msgs.filter(m => m.sender === "agent" || m.sender === "admin").length;
            const lastMsg = msgs[msgs.length - 1];

            const slack = slackMap.get(v.chat_id);

            return {
                id: doc.id,
                chatId: v.chat_id,
                userId: v.user_id,
                userName: v.user_name || "익명",
                brandName: v.brand_name || v.brandName || null,
                channel: v.channel || "unknown",
                status: v.status || "waiting",
                modeSnapshot: v.modeSnapshot || "AUTO",
                lastMessageAt: v.lastMessageAt?.toDate?.()?.toISOString() || null,
                lastMessageText: lastMsg?.text?.slice(0, 80) || (lastMsg?.pics?.length ? "(이미지)" : ""),
                messageCount: {
                    user: userCount,
                    ai: aiCount,
                    agent: agentCount,
                    total: msgs.length
                },
                hasSlackCard: !!slack,
                isTask: !!(slack?.is_task),
            };
        });

        // 다음 페이지 커서
        const last = uniqueDocs[uniqueDocs.length - 1];
        const nextCursor = last
            ? encodeCursor(
                last.data.lastMessageAt?.toMillis() || 0,
                last.data.chat_id
            )
            : null;

        return res.json({
            conversations,
            nextCursor,
            _meta: {
                totalDocs: snap.size,
                uniqueChats: chatMap.size,
                returned: conversations.length,
            }
        });
    } catch (error) {
        console.error("[conversations/list] error:", error);
        return res.status(500).json({ error: error.message || "internal_error" });
    }
}