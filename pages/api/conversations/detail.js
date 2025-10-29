// pages/api/conversations/detail.js
// Conversation detail API — icn1 region
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

// ───────── helpers (list.js와 동일) ─────────
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
function toneFromRouteClass(routeClass) {
    if (routeClass === "task") return "color";
    if (routeClass === "shadow") return "muted";
    return "neutral";
}

async function recoverChannelByInboxId(inboxId) {
    if (!inboxId) return "unknown";
    const qs = await db.collection("integrations").where("cw.inboxId", "==", Number(inboxId)).limit(1).get();
    if (qs.empty) return "unknown";
    const ch = String(qs.docs[0].data()?.channel || "").toLowerCase();
    return normalizeChannel(ch);
}

export default async function handler(req, res) {
    try {
        const tenantId = String(req.query.tenant || req.query.tenantId || "").trim();
        const chatId = String(req.query.chatId || req.query.cid || "").trim();
        if (!tenantId || !chatId) {
            return res.status(400).json({ error: "missing tenant or chatId" });
        }

        // 최신 스냅샷 1건
        const qs = await db.collection("FAQ_realtime_cw")
            .where("tenant_id", "==", tenantId)
            .where("chat_id", "==", chatId)
            .orderBy("lastMessageAt", "desc")
            .limit(1)
            .get();

        if (qs.empty) {
            return res.status(404).json({ error: "conversation_not_found" });
        }

        const doc = qs.docs[0];
        const d = doc.data() || {};

        // stats
        const statsSnap = await db.doc(`stats_conversations/${tenantId}_${chatId}`).get();
        const stats = statsSnap.exists ? (statsSnap.data() || {}) : {};

        // counts
        const counts = {
            user: toInt(stats.user_chats, 0),
            ai: toInt(stats.ai_allchats, 0),
            agent: toInt(stats.agent_chats, 0),
        };

        // route 분류
        const routeClass = classifyRouteFromStats(stats);   // 'task' | 'interaction' | 'shadow' | 'none'
        const hasTaskRoute = routeClass === "task";
        const tone = toneFromRouteClass(routeClass);

        const brand = d.brandName || d.brand_name || "";
        const alias = stripBrandPrefix(d.user_name || "", brand) || (d.user_name || "");
        const channelRaw = d.channel || await recoverChannelByInboxId(d.cw_inbox_id);
        const channel = normalizeChannel(channelRaw);
        const categories = asArray(d.category || d.categories);

        const lastMs = d.lastMessageAt?.toMillis ? d.lastMessageAt.toMillis() : null;
        const firstMs = (() => {
            // doc.id 끝에 timestamp가 붙어있는 스키마도 고려 (없으면 null)
            const parts = String(doc.id).split("_");
            const ts = Number(parts[parts.length - 1]);
            return Number.isFinite(ts) ? ts : null;
        })();

        // 메시지 가공 (기본 정렬: 오름차순)
        const messages = (Array.isArray(d.messages) ? d.messages : [])
            .map((m) => {
                const tsMs =
                    (m.timestamp?.toMillis?.() ?? null) ??
                    (Number(m.timestamp) || null);
                const pics = Array.isArray(m.pics) ? m.pics.filter(p => p?.url) : [];
                return {
                    id: m.msgId || `${chatId}_${tsMs || ""}`,
                    sender: String(m.sender || "").toLowerCase(), // 'user' | 'ai' | 'agent'
                    text: m.text || "",
                    timestamp_ms: tsMs,
                    modeSnapshot: m.modeSnapshot || d.modeSnapshot || null,
                    has_pics: pics.length > 0,
                    pics_count: pics.length,
                    pics: pics.map(p => ({ url: p.url, info: p.info || null })),
                };
            })
            .sort((a, b) => toInt(a.timestamp_ms, 0) - toInt(b.timestamp_ms, 0));

        // 라우트 카운트 그대로 내려주기 (프론트 배지/툴팁용)
        const routeCounts = {
            shadow_create: toInt(stats.route_shadow_create, 0),
            shadow_update: toInt(stats.route_shadow_update, 0),
            skip: toInt(stats.route_skip, 0),
            create: toInt(stats.route_create, 0),
            update: toInt(stats.route_update, 0),
            upgrade_task: toInt(stats.route_upgrade_task, 0),
            confirm_draft: toInt(stats.route_confirm_draft, 0),
            agent_thread: toInt(stats.agent_thread, 0),
        };

        return res.json({
            chatId,
            brandName: brand,
            title: `${alias || "손님"} (${chatId})`,
            channel,                // 'naver' | 'widget' | 'kakao' | 'unknown'
            categories,             // array
            counts,                 // { user, ai, agent }
            routeClass,             // 'task' | 'interaction' | 'shadow' | 'none'
            hasTaskRoute,           // boolean
            tone,                   // 'color' | 'muted' | 'neutral'
            lastMessageAt: lastMs,
            firstMessageAt: firstMs,
            preview: String(
                d.admin ||
                d.ai_answer ||
                (messages.length ? messages[messages.length - 1].text : "") ||
                ""
            ),
            routeCounts,            // breakdown for UI badges
            messages,               // normalized messages
            raw: {
                slack_route: d.slack_route || null,
                status: d.status || null,
                cw_inbox_id: d.cw_inbox_id || null,
            },
        });
    } catch (e) {
        console.error("[api/conversations/detail] error", e);
        return res.status(500).json({ error: e.message || "internal_error" });
    }
}
