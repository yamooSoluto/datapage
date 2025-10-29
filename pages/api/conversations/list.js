// pages/api/conversations/list.js
// Conversations list API (stats-backed) — icn1 region
export const config = { regions: ['icn1'] };

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

// ───────── helpers ─────────
const toInt = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
};
const asArray = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    return String(v).split(",").map(s => s.trim()).filter(Boolean);
};
const normalizeChannel = (v) => {
    const s = String(v || "").trim().toLowerCase();
    if (!s) return "unknown";
    if (s.includes("naver")) return "naver";
    if (s.includes("kakao")) return "kakao";
    if (s.includes("widget") || s.includes("web")) return "widget";
    return ["naver", "kakao", "widget"].includes(s) ? s : "unknown";
};
const stripBrandPrefix = (name, brand) => {
    const n = String(name || "").trim();
    const b = String(brand || "").trim();
    if (!n) return "";
    if (b && n.startsWith(b)) {
        return n.slice(b.length).trim().replace(/^[-_]+/, '').trim() || n;
    }
    return n;
};

// routeClass 계산: 업무카드(create/update/upgrade) / 상호작용(confirm/agent_thread) / shadow / none
function classifyRouteFromStats(st = {}) {
    const task =
        (st.route_upgrade_task || 0) +
        (st.route_create || 0) +
        (st.route_update || 0);

    const interaction =
        (st.route_confirm_draft || 0) +
        (st.agent_thread || 0);

    const shadowOnly =
        (st.route_shadow_create || 0) +
        (st.route_shadow_update || 0) +
        (st.route_skip || 0);

    if (task > 0) return "task";
    if (interaction > 0) return "interaction";
    if (shadowOnly > 0) return "shadow";
    return "none";
}

// UI 톤: task→color / shadow→muted / interaction/none→neutral(필요시 accent로 매핑)
function toneFromRouteClass(routeClass) {
    if (routeClass === "task") return "color";
    if (routeClass === "shadow") return "muted";
    return "neutral";
}

async function loadStatsFor(tenantId, chatIds) {
    const refs = chatIds.map(cid => db.doc(`stats_conversations/${tenantId}_${cid}`));
    if (!refs.length) return {};
    const snaps = await db.getAll(...refs);
    const out = {};
    snaps.forEach(s => {
        if (!s.exists) return;
        const id = s.id.split("_").slice(1).join("_"); // chatId
        out[id] = s.data();
    });
    return out;
}

async function recoverChannelsByInboxId(inboxIds) {
    const uniq = Array.from(new Set(inboxIds.filter(Boolean)));
    if (!uniq.length) return {};
    const out = {};
    for (let i = 0; i < uniq.length; i += 10) {
        const chunk = uniq.slice(i, i + 10);
        const qs = await db.collection("integrations").where("cw.inboxId", "in", chunk).get();
        qs.forEach(d => {
            const v = d.data();
            const inboxId = Number(v?.cw?.inboxId || 0);
            const ch = String(v?.channel || "").toLowerCase();
            out[inboxId] = normalizeChannel(ch);
        });
    }
    return out;
}

export default async function handler(req, res) {
    try {
        const tenantId = String(req.query.tenant || req.query.tenantId || "").trim();
        if (!tenantId) return res.status(400).json({ error: "missing tenant" });

        const limit = Math.min(100, Math.max(5, toInt(req.query.limit, 30)));
        const cursorTs = toInt(req.query.cursor, 0);
        const qChannel = normalizeChannel(req.query.channel);
        const qCategories = asArray(req.query.category || req.query.categories);
        const qSearch = String(req.query.q || "").trim();

        let q = db.collection("FAQ_realtime_cw")
            .where("tenant_id", "==", tenantId)
            .orderBy("lastMessageAt", "desc");

        if (cursorTs > 0) {
            q = q.startAfter(new admin.firestore.Timestamp(
                Math.floor(cursorTs / 1000), (cursorTs % 1000) * 1e6
            ));
        }
        if (["naver", "kakao", "widget", "unknown"].includes(qChannel)) {
            q = q.where("channel", "==", qChannel);
        }

        const snap = await q.limit(limit * 5).get();

        // chat_id 기준 최신만
        const byChat = new Map();
        snap.forEach(doc => {
            const d = doc.data() || {};
            const cid = String(d.chat_id || "");
            if (!cid || byChat.has(cid)) return;
            byChat.set(cid, { id: doc.id, ...d });
        });
        let items = Array.from(byChat.values());

        // category 필터
        if (qCategories.length > 0) {
            const wanted = new Set(qCategories.map(s => s.toLowerCase()));
            items = items.filter(d => {
                const cats = asArray(d.category || d.categories).map(s => s.toLowerCase());
                return cats.some(c => wanted.has(c));
            });
        }
        // 소프트 검색
        if (qSearch) {
            const ql = qSearch.toLowerCase();
            items = items.filter(d => {
                const hay = [
                    String(d.user_name || ""),
                    String(d.brandName || d.brand_name || ""),
                    String(d.admin || ""),
                    String(d.ai_answer || ""),
                    ...(Array.isArray(d.messages) ? d.messages.slice(-3).map(m => String(m.text || "")) : [])
                ].join(" ").toLowerCase();
                return hay.includes(ql);
            });
        }

        const slice = items.slice(0, limit);

        const chatIds = slice.map(d => String(d.chat_id));
        const statsMap = await loadStatsFor(tenantId, chatIds);

        const inboxIdsNeeding = slice.filter(d => !d.channel && d.cw_inbox_id)
            .map(d => Number(d.cw_inbox_id));
        const recovered = await recoverChannelsByInboxId(inboxIdsNeeding);

        const conversations = slice.map(d => {
            const chatId = String(d.chat_id);
            const brand = d.brandName || d.brand_name || "";
            const alias = stripBrandPrefix(d.user_name || "", brand) || (d.user_name || "");
            const stats = statsMap[chatId] || {};

            const counts = {
                user: toInt(stats.user_chats, 0),
                ai: toInt(stats.ai_allchats, 0),
                agent: toInt(stats.agent_chats, 0),
            };
            const categories = asArray(d.category || d.categories);
            const channel = normalizeChannel(d.channel || recovered[Number(d.cw_inbox_id)] || "unknown");

            // route 분류 + 톤
            const routeClass = classifyRouteFromStats(stats);           // 'task' | 'interaction' | 'shadow' | 'none'
            const hasTaskRoute = routeClass === "task";
            const tone = toneFromRouteClass(routeClass);                // 'color' | 'muted' | 'neutral'

            const lastMs = d.lastMessageAt?.toMillis ? d.lastMessageAt.toMillis() : Date.now();

            return {
                chatId,
                lastMessageAt: lastMs,
                title: `${alias || "손님"} (${chatId})`,
                preview: String(
                    d.admin ||
                    d.ai_answer ||
                    (Array.isArray(d.messages) && d.messages.length ? d.messages[d.messages.length - 1].text : "") ||
                    ""
                ),
                brandName: brand,
                avatarInitials: (alias || brand || chatId).slice(0, 2),
                channel,
                counts,
                categories,
                routeClass,       // NEW
                hasTaskRoute,     // NEW (업무카드 라우팅 여부)
                tone,
                slack_route: d.slack_route || null,
                status: d.status || null,
            };
        });

        const nextCursor = conversations.length
            ? conversations[conversations.length - 1].lastMessageAt
            : null;

        return res.json({
            conversations,
            nextCursor,
            _meta: {
                tenantId,
                fetched: slice.length,
                scannedDocs: snap.size,
                uniqueChats: byChat.size,
                hasMore: items.length > slice.length,
            },
        });
    } catch (e) {
        console.error("[api/conversations/list] error", e);
        return res.status(500).json({ error: e.message || "internal_error" });
    }
}
