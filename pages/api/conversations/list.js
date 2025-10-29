// pages/api/conversations/list.js
import admin from "firebase-admin";

// ── Firebase Admin singleton (환경변수 기반) ────────────────
if (!admin.apps.length) {
    try {
        // 환경변수가 있으면 명시적 credential 사용
        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
                }),
            });
            console.log("[Firebase] Initialized with explicit credentials");
        } else {
            // Vercel/GCP 환경에서는 applicationDefault() 사용
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
            });
            console.log("[Firebase] Initialized with application default credentials");
        }
    } catch (error) {
        console.error("[Firebase] Initialization error:", error);
        // 이미 초기화된 경우 무시
        if (!error.message?.includes("already exists")) {
            throw error;
        }
    }
}

const db = admin.firestore();

// Vercel 서버리스 리전 (Node 런타임)
export const config = { regions: ["icn1"] };

// ── Helpers ─────────────────────────────────────────────────
const N = 50; // 리스트 컷
const asMs = (ts) =>
    typeof ts?.toMillis === "function" ? ts.toMillis() : Number(ts) || null;

const normalizeChannel = (v) => {
    const s = String(v || "").toLowerCase();
    if (!s) return "unknown";
    if (s.includes("naver")) return "naver";
    if (s.includes("kakao")) return "kakao";
    if (s.includes("widget") || s.includes("web")) return "widget";
    return "unknown";
};

const isWorkRoute = (route) => {
    const r = String(route || "").toLowerCase();
    return r === "create" || r === "update" || r === "upgrade" || r === "upgrade_task";
};

const toRouteKinds = (d) => {
    // 우선순위: 배열 필드가 오면 그대로, 없으면 단일 필드 추론
    if (Array.isArray(d.routeKinds) && d.routeKinds.length) return d.routeKinds;
    const r = [];
    const single = d.slack_route || d.route || d.last_route;
    if (single) r.push(String(single).toLowerCase());
    return r;
};

const countByRole = (messages = []) => {
    let user = 0, ai = 0, agent = 0;
    for (const m of messages) {
        const s = String(m?.sender || "").toLowerCase();
        if (s === "user") user++;
        else if (s === "ai") ai++;
        else if (s === "agent" || s === "admin") agent++;
    }
    return { user, ai, agent };
};

const lastSnippet = (d) => {
    // 사용자 최근 텍스트 > ai/admin 답변 > 문서 요약
    const msgs = Array.isArray(d.messages) ? d.messages : [];
    const lastUser = [...msgs].reverse().find((m) => m.sender === "user" && m.text);
    if (lastUser?.text) return lastUser.text;
    if (d.ai_answer) return d.ai_answer;
    if (d.admin) return d.admin;
    const any = [...msgs].reverse().find((m) => m.text);
    return any?.text || "";
};

const asArray = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    return String(v).split(",").map(s => s.trim()).filter(Boolean);
};

const makeItem = ({ tenantId, convId, base, counters }) => {
    const routeKinds = toRouteKinds(base);
    const hasWork = routeKinds.some(isWorkRoute);
    const channel = normalizeChannel(base.channel || base.source);
    const categories = asArray(base.categories || base.category);
    const name =
        base.user_name ||
        base.contact_name ||
        base.alias ||
        `${base.brandName || base.brand_name || ""} (${convId})`;

    // 프론트엔드가 기대하는 필드명으로 매핑
    return {
        id: `${tenantId}_${convId}`,
        tenantId,
        chatId: String(convId),
        title: name,                                      // ✅ userName → title
        preview: lastSnippet(base),                       // ✅ lastMessageText → preview
        lastMessageAt: asMs(base.lastMessageAt) || asMs(base.messages?.slice(-1)[0]?.timestamp) || null,
        channel,
        route: routeKinds[0] || (hasWork ? "work" : "auto"),  // ✅ 대표 route 추가
        routeClass: hasWork ? "work" : "passive",
        categories,
        counts: {                                          // ✅ counters → counts
            user: counters.user || 0,
            ai: counters.ai || 0,
            agent: counters.agent || 0,
        },
        status: base.status || null,
    };
};

// ── Query by stats_conversations (fast path) ────────────────
async function listByStats(tenantId) {
    const start = `${tenantId}_`;
    const end = `${tenantId}_\uf8ff`;
    const idField = admin.firestore.FieldPath.documentId();

    const snap = await db
        .collection("stats_conversations")
        .where(idField, ">=", start)
        .where(idField, "<", end)
        .get();

    console.log(`[listByStats] Found ${snap.size} stats docs for tenant: ${tenantId}`);

    if (snap.empty) return [];

    // 최신순 정렬 (updated_at 기준, 없으면 id 순)
    const stats = snap.docs
        .map((d) => {
            const data = d.data() || {};
            const updated = asMs(data.updated_at) || 0;
            const idx = d.id.indexOf("_");
            const convId = idx >= 0 ? d.id.slice(idx + 1) : null;
            return { convId, updated, data };
        })
        .filter((x) => x.convId)
        .sort((a, b) => b.updated - a.updated)
        .slice(0, N);

    // 각 대화의 최신 문서 1건만 가져와 요약
    const promises = stats.map(async ({ convId, data }) => {
        const qs = await db
            .collection("FAQ_realtime_cw")
            .where("chat_id", "==", String(convId))
            .where("tenant_id", "==", tenantId)  // ✅ tenant_id 조건 추가
            .orderBy("lastMessageAt", "desc")
            .limit(1)
            .get();

        const doc = qs.empty ? null : qs.docs[0];
        const base = doc ? doc.data() : { chat_id: convId, tenant_id: tenantId };

        const counters = {
            user: data.user_chats || 0,
            ai: data.ai_allchats || data.ai_autochats || 0,
            agent: data.agent_chats || 0,
        };
        return makeItem({ tenantId, convId, base, counters });
    });

    const items = await Promise.all(promises);
    // null 방지 및 최종 정렬
    return items
        .filter(Boolean)
        .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
}

// ── Fallback: scan FAQ_realtime_cw (when no stats) ──────────
async function listByFallback(tenantId) {
    console.log(`[listByFallback] Scanning FAQ_realtime_cw for tenant: ${tenantId}`);

    // 최근 문서부터 모으되, chat_id 단위로 1개씩만
    const qs = await db
        .collection("FAQ_realtime_cw")
        .where("tenant_id", "==", tenantId)
        .orderBy("lastMessageAt", "desc")
        .limit(400) // 여유로 많이 가져와 chatId uniq 처리
        .get();

    console.log(`[listByFallback] Found ${qs.size} docs`);

    if (qs.empty) return [];

    const byChat = new Map();
    for (const doc of qs.docs) {
        const d = doc.data();
        const chatId = String(d.chat_id || "");
        if (!chatId) continue;
        if (byChat.has(chatId)) continue; // 최신 1건만
        byChat.set(chatId, d);
        if (byChat.size >= N) break;
    }

    const items = [];
    for (const [convId, base] of byChat.entries()) {
        const counters = countByRole(base.messages || []);
        items.push(makeItem({ tenantId, convId, base, counters }));
    }

    return items.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
}

// ── API Handler ─────────────────────────────────────────────
export default async function handler(req, res) {
    try {
        const tenantId = String(req.query.tenant || req.headers["x-tenant-id"] || "").trim();
        if (!tenantId) {
            console.log("[list] Missing tenant parameter");
            return res.status(400).json({ ok: false, error: "tenant required" });
        }

        console.log(`[list] Processing request for tenant: ${tenantId}`);

        // 1) stats 우선
        let items = await listByStats(tenantId);

        // 2) 폴백
        if (!items.length) {
            console.log(`[list] No stats found, trying fallback`);
            items = await listByFallback(tenantId);
        }

        console.log(`[list] Returning ${items.length} items for tenant: ${tenantId}`);

        return res.status(200).json({ ok: true, items });
    } catch (e) {
        console.error("[list] fatal:", e);
        return res.status(500).json({ ok: false, error: e.message, stack: process.env.NODE_ENV === 'development' ? e.stack : undefined });
    }
}