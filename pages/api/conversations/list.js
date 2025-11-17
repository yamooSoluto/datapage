// /pages/api/conversations/list.js
export const config = { regions: ['icn1'] };

import admin, { db } from "@/lib/firebase-admin";

// ─── helpers
function normalizeChannel(val) {
    const v = String(val || '').toLowerCase();
    if (!v) return 'unknown';
    if (v.includes('naver') || v === 'api') return 'naver';
    if (v.includes('kakao')) return 'kakao';
    if (v.includes('widget') || v.includes('web')) return 'widget';
    return 'unknown';
}
function millis(v) {
    if (!v) return 0;
    if (typeof v?.toMillis === 'function') return v.toMillis();
    const n = Number(v);
    return Number.isFinite(n) ? n : new Date(v).getTime() || 0;
}
const clampLimit = (n, def = 50, max = 500) => {
    const x = Number(n);
    if (!Number.isFinite(x) || x <= 0) return def;
    return Math.min(x, max);
};

function decodeCursor(cur) {
    try {
        if (!cur) return null;
        const obj = JSON.parse(Buffer.from(cur, "base64").toString("utf8"));
        if (Number.isFinite(obj.ts) && typeof obj.chatId === "string") return obj;
        return null;
    } catch { return null; }
}
function encodeCursor(ts, chatId) {
    return Buffer.from(JSON.stringify({ ts, chatId }), "utf8").toString("base64");
}

function classifyCardType(cardType) {
    const type = String(cardType || "").toLowerCase();
    if (type.includes('create') || type.includes('update') || type.includes('upgrade')) {
        return { isTask: true, taskType: 'work', cardType: type };
    }
    if (type.includes('shadow') || type.includes('skip')) {
        return { isTask: false, taskType: 'shadow', cardType: type };
    }
    return { isTask: !!type, taskType: type ? 'other' : null, cardType: type };
}
function classifyCardTypeFromRoute(route) {
    const r = String(route || "").toLowerCase();
    if (r.includes('shadow') || r === 'skip') return { isTask: false, taskType: 'shadow', cardType: route };
    if (r.includes('create') || r.includes('update') || r.includes('upgrade')) return { isTask: true, taskType: 'work', cardType: route };
    if (r.includes('confirm')) return { isTask: false, taskType: 'confirm', cardType: route };
    if (r.includes('agent')) return { isTask: true, taskType: 'agent', cardType: route };
    return { isTask: false, taskType: null, cardType: route };
}

function getTaskFlagsFromStats(stats) {
    if (!stats) {
        return {
            everWork: false,
            lastSlackRoute: null,
        };
    }
    const routeUpdate = stats.route_update || 0;
    const routeUpgrade = stats.route_upgrade_task || 0;
    const routeCreate = stats.route_create || 0;
    const lastSlackRoute = stats.last_slack_route || null;
    let everWork = false;
    if (routeUpdate > 0 || routeUpgrade > 0 || routeCreate > 0) {
        everWork = true;
    } else if (lastSlackRoute) {
        const s = String(lastSlackRoute || "").toLowerCase();
        const re = /\b(create|update|upgrade)\b/i;
        if (!s.includes("shadow") && re.test(s)) {
            everWork = true;
        }
    }
    return {
        everWork,
        lastSlackRoute,
    };
}

// ✅ 사용자 선택 archive 상태 계산 (status와 별개!)
function getCurrentArchiveStatus(v) {
    const archiveStatus = (v.archive_status || '').toLowerCase();

    if (archiveStatus === 'completed') return 'completed';
    if (archiveStatus === 'hold') return 'hold';
    if (v.important === true || archiveStatus === 'important') return 'important';

    return 'active';
}

// ✅ 필터 적용 (archive_status 기반)
function applyArchiveFilter(conversations, filter) {
    if (!filter || filter === 'all') return conversations;

    return conversations.filter(conv => {
        const archiveStatus = conv.currentArchiveStatus;

        switch (filter) {
            case 'active':
                // active는 hold/important/completed가 아닌 것들
                return archiveStatus === 'active';
            case 'hold':
                return archiveStatus === 'hold';
            case 'important':
                return archiveStatus === 'important';
            case 'completed':
                return archiveStatus === 'completed';
            default:
                return true;
        }
    });
}

// ────────────────────────────────────────────────
export default async function handler(req, res) {
    try {
        res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');

        const {
            tenant,
            channel = "all",
            category = "all",
            filter = "active", // ✅ active/hold/important/completed
            limit,
            cursor
        } = req.query;

        if (!tenant) return res.status(400).json({ error: "tenant is required" });

        const pageSize = clampLimit(limit);
        let q = db.collection("FAQ_realtime_cw")
            .where("tenant_id", "==", tenant)
            .orderBy("lastMessageAt", "desc");

        if (channel !== "all") q = q.where("channel", "==", normalizeChannel(channel));

        const cur = decodeCursor(cursor);
        if (cur) {
            const lastTs = admin.firestore.Timestamp.fromMillis(cur.ts);
            q = q.startAfter(lastTs);
        }

        const snap = await q.limit(pageSize * 3).get();

        // chat_id별 최신 문서만
        const chatMap = new Map();
        snap.docs.forEach(doc => {
            const data = doc.data();
            const chatId = data.chat_id;
            if (!chatMap.has(chatId)) {
                chatMap.set(chatId, { doc, data });
            } else {
                const existing = chatMap.get(chatId);
                const existingTs = existing.data.lastMessageAt?.toMillis() || 0;
                const currentTs = data.lastMessageAt?.toMillis() || 0;
                if (currentTs > existingTs) chatMap.set(chatId, { doc, data });
            }
        });

        const uniqueDocs = Array.from(chatMap.values())
            .sort((a, b) => {
                const tsA = a.data.lastMessageAt?.toMillis() || 0;
                const tsB = b.data.lastMessageAt?.toMillis() || 0;
                return tsB - tsA;
            })
            .slice(0, pageSize);

        // 슬랙 스레드 배치 조회
        const slackRefs = uniqueDocs.map(({ doc }) =>
            db.collection("slack_threads").doc(doc.id)
        );
        const slackDocs = slackRefs.length ? await db.getAll(...slackRefs) : [];
        const slackMap = new Map(
            slackDocs.map((sd, idx) => [
                uniqueDocs[idx].doc.id,
                sd.exists ? sd.data() : null,
            ])
        );

        // stats 조회
        const statsRefs = uniqueDocs.map(({ data }) =>
            db.collection("stats_conversations").doc(`${tenant}_${data.chat_id}`)
        );
        const statsDocs = statsRefs.length ? await db.getAll(...statsRefs) : [];
        const statsMap = new Map(
            statsDocs.map((sd, idx) => {
                const chatId = uniqueDocs[idx].data.chat_id;
                return [chatId, sd.exists ? sd.data() : null];
            })
        );

        // 응답 변환
        let conversations = uniqueDocs.map(({ doc, data: v }) => {
            const msgs = Array.isArray(v.messages) ? v.messages : [];

            const stats = statsMap.get(v.chat_id) || null;
            const userCount = stats?.user_chats || 0;
            const aiCount = stats?.ai_allchats || 0;
            const agentCount = stats?.agent_chats || 0;
            const totalCount = userCount + aiCount + agentCount;

            const lastMsg = msgs[msgs.length - 1] || null;

            // 이미지 스캔
            const allPics = [];
            const allThumbnails = [];
            msgs.forEach(m => {
                if (Array.isArray(m.pics) && m.pics.length) {
                    m.pics.forEach(p => {
                        if (p?.url) {
                            allPics.push(p.url);
                            allThumbnails.push(p.thumbnail_url || p.url);
                        }
                    });
                }
            });

            const slack = slackMap.get(doc.id);
            const { everWork, lastSlackRoute } = getTaskFlagsFromStats(stats);

            const slackRoute = v.slack_route || lastSlackRoute || null;
            const cardTypeFromSlack = slack?.card_type || null;

            const cardInfo = cardTypeFromSlack
                ? classifyCardType(cardTypeFromSlack)
                : (slackRoute ? classifyCardTypeFromRoute(slackRoute) : null);

            const finalIsTask = everWork || (cardInfo?.isTask || false);
            const finalTaskType = everWork ? "work" : (cardInfo?.taskType || null);

            const extractMiddleChar = (name) => {
                if (!name || name.length < 3) return name?.charAt(0) || '?';
                const parts = name.trim().split(/\s+/);
                if (parts.length > 1) return parts[1]?.charAt(0) || parts[0]?.charAt(1) || '?';
                const mid = Math.floor(name.length / 2);
                return name.charAt(mid);
            };

            // ✅ archive 상태 계산
            const currentArchiveStatus = getCurrentArchiveStatus(v);

            return {
                id: doc.id,
                chatId: v.chat_id,
                userId: v.user_id,
                userName: v.user_name || "익명",
                userNameInitial: extractMiddleChar(v.user_name),
                brandName: v.brand_name || v.brandName || null,
                channel: v.channel || "unknown",
                status: v.status || "waiting", // ✅ Chatwoot 상태
                archiveStatus: v.archive_status || null, // ✅ 사용자 선택 상태
                currentArchiveStatus, // ✅ 계산된 archive 상태
                important: v.important || false,
                modeSnapshot: v.modeSnapshot || "AUTO",
                lastMessageAt: v.lastMessageAt?.toDate?.()?.toISOString() || null,
                archivedAt: v.archived_at?.toDate?.()?.toISOString() || null,

                lastMessageText: v.summary || lastMsg?.text?.slice(0, 80) || (allPics.length > 0 ? `(이미지 ${allPics.length}개)` : ""),
                summary: v.summary || null,
                task: v.task || null,

                draftStatus: v.draft_status || null,
                hasPendingDraft: v.draft_status === "pending_approval",

                hasImages: allPics.length > 0,
                imageCount: allPics.length,
                firstImageUrl: allPics[0] || null,
                firstThumbnailUrl: allThumbnails[0] || null,

                messageCount: { user: userCount, ai: aiCount, agent: agentCount, total: totalCount },

                category: v.category || null,
                categories: v.category ? v.category.split('|').map(c => c.trim()) : [],

                hasSlackCard: !!slack,
                isTask: finalIsTask,
                isTaskEver: everWork,
                taskType: finalTaskType,
                slackCardType: cardInfo?.cardType || null,
            };
        });

        // ✅ archive 필터 적용
        conversations = applyArchiveFilter(conversations, filter);

        // nextCursor
        const last = conversations[conversations.length - 1];
        const nextCursor = last && uniqueDocs.find(d => d.data.chat_id === last.chatId)
            ? encodeCursor(
                uniqueDocs.find(d => d.data.chat_id === last.chatId).data.lastMessageAt?.toMillis() || 0,
                last.chatId
            )
            : null;

        return res.json({
            conversations,
            nextCursor,
            _meta: {
                totalDocs: snap.size,
                uniqueChats: chatMap.size,
                beforeFilter: uniqueDocs.length,
                afterFilter: conversations.length,
                appliedFilter: filter,
            }
        });
    } catch (error) {
        console.error("[conversations/list] error:", error);
        return res.status(500).json({ error: error.message || "internal_error" });
    }
}