// pages/api/conversations/list.js
import { getFirestore, FieldPath, Timestamp } from "firebase-admin/firestore";
import { initializeApp, getApps, applicationDefault } from "firebase-admin/app";

// ── Firebase Admin singleton ────────────────────────────────
if (!getApps().length) {
    initializeApp({
        credential: applicationDefault(),
    });
}
const db = getFirestore();

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

const makeItem = ({ tenantId, convId, base, counters }) => {
    const routeKinds = toRouteKinds(base);
    const hasWork = routeKinds.some(isWorkRoute);
    const channel = normalizeChannel(base.channel || base.source);
    const categories = Array.isArray(base.categories) ? base.categories : [];
    const name =
        base.user_name ||
        base.contact_name ||
        base.alias ||
        `${base.brandName || base.brand_name || ""} (${convId})`;

    return {
        id: `${tenantId}_${convId}`,
        tenantId,
        chatId: String(convId),
        userName: name,
        lastMessageAt: asMs(base.lastMessageAt) || asMs(base.messages?.slice(-1)[0]?.timestamp) || null,
        lastMessageText: lastSnippet(base),
        channel,
        routeKinds,
        routeClass: hasWork ? "work" : "passive",
        categories,
        counters: {
            user: counters.user || 0,
            ai: counters.ai || 0,
            agent: counters.agent || 0,
        },
        // status는 더 이상 의미 없으면 프론트에서 숨겨도 OK
        status: base.status || null,
    };
};

// ── Query by stats_conversations (fast path) ────────────────
async function listByStats(tenantId) {
    const start = `${tenantId}_`;
    const end = `${tenantId}_\uf8ff`;
    const idField = FieldPath.documentId();

    const snap = await db
        .collection("stats_conversations")
        .where(idField, ">=", start)
        .where(idField, "<", end)
        .get();

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
            .orderBy("lastMessageAt", "desc")
            .limit(1)
            .get();

        const doc = qs.empty ? null : qs.docs[0];
        const base = doc ? doc.data() : { chat_id: convId };
        if (!base.tenant_id) base.tenant_id = tenantId;

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
    // 최근 문서부터 모으되, chat_id 단위로 1개씩만
    const qs = await db
        .collection("FAQ_realtime_cw")
        .where("tenant_id", "==", tenantId)
        .orderBy("lastMessageAt", "desc")
        .limit(400) // 여유로 많이 가져와 chatId uniq 처리
        .get();

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
        if (!tenantId) return res.status(400).json({ ok: false, error: "tenant required" });

        // 1) stats 우선
        let items = await listByStats(tenantId);

        // 2) 폴백
        if (!items.length) {
            items = await listByFallback(tenantId);
        }

        return res.status(200).json({ ok: true, items });
    } catch (e) {
        console.error("[list] fatal:", e);
        return res.status(500).json({ ok: false, error: e.message });
    }
}
// before (예시)
// const url = `/api/faq?tenant=${tenantId}`;

// after
const url = `/api/conversations/list?tenant=${tenantId}`;
const resp = await fetch(url, { method: "GET" });
const data = await resp.json();
setItems(Array.isArray(data.items) ? data.items : []);
