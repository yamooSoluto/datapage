// /pages/api/conversations/detail.js
export const config = { regions: ['icn1'] };

import admin, { db } from "@/lib/firebase-admin";

// 플랜별 제한
const PLAN_LIMITS = {
    trial: { days: 30, maxDocs: null },
    starter: { days: 30, maxDocs: null },
    pro: { days: 90, maxDocs: null },
    business: { days: null, maxDocs: null },
    enterprise: { days: null, maxDocs: null },
};
const DEFAULT_LIMIT = { days: 30, maxDocs: null };

const safeIso = (t) => (t?.toDate?.()?.toISOString?.() ? t.toDate().toISOString() : null);
const millis = (v) => (typeof v?.toMillis === 'function' ? v.toMillis() : (Number(v) || new Date(v).getTime() || 0));

// stats_conversations 기반 업무 여부 판별
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

// ✅ 사용자가 선택한 archive 상태 계산 (status와 별개!)
function getCurrentArchiveStatus(d) {
    const archiveStatus = (d.archive_status || '').toLowerCase();

    // completed 상태
    if (archiveStatus === 'completed') {
        return 'completed';
    }

    // hold 상태
    if (archiveStatus === 'hold') {
        return 'hold';
    }

    // important 상태 (boolean 필드 또는 archive_status)
    if (d.important === true || archiveStatus === 'important') {
        return 'important';
    }

    // 기본은 active (보류/중요/완료가 아닌 일반 상태)
    return 'active';
}

export default async function handler(req, res) {
    try {
        res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');

        const { tenant, chatId } = req.query;
        if (!tenant || !chatId) {
            return res.status(400).json({ error: "tenant and chatId are required" });
        }

        // 플랜
        let plan = 'trial';
        try {
            const t = await db.collection("tenants").doc(tenant).get();
            if (t.exists) plan = t.data()?.plan || t.data()?.subscription?.plan || 'trial';
        } catch { }

        const limits = PLAN_LIMITS[plan] || DEFAULT_LIMIT;

        // 안정키 우선
        const stableId = `${tenant}_${chatId}`;
        let convDoc = await db.collection("FAQ_realtime_cw").doc(stableId).get();

        // 같은 chat_id 문서들
        let q = db.collection("FAQ_realtime_cw")
            .where("tenant_id", "==", tenant)
            .where("chat_id", "==", chatId)
            .orderBy("lastMessageAt", "desc");

        if (limits.days) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - limits.days);
            q = q.where("lastMessageAt", ">=", admin.firestore.Timestamp.fromDate(cutoffDate));
        }
        if (limits.maxDocs) q = q.limit(limits.maxDocs);

        let allDocs = [];
        if (!convDoc.exists) {
            const snap = await q.get();
            if (!snap.empty) {
                allDocs = snap.docs;
                convDoc = snap.docs[0];
            }
        } else {
            const snap = await q.get();
            allDocs = snap.empty ? [convDoc] : snap.docs;
        }

        if (!convDoc.exists) return res.status(404).json({ error: "conversation_not_found" });
        const d = convDoc.data();

        // 메시지 병합 + 정렬 + 중복 제거
        const allMessages = [];
        allDocs.forEach(doc => {
            const arr = Array.isArray(doc.data()?.messages) ? doc.data().messages : [];
            allMessages.push(...arr);
        });
        allMessages.sort((a, b) => (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0));

        const seen = new Set();
        const messages = [];
        allMessages.forEach(m => {
            const id = m.msgId || `${m.sender}_${m.timestamp?.toMillis?.()}_${m.text?.slice(0, 20)}`;
            if (!seen.has(id)) {
                seen.add(id);
                messages.push({
                    sender: m.sender,
                    text: m.text || "",
                    pics: Array.isArray(m.pics) ? m.pics : [],
                    timestamp: safeIso(m.timestamp),
                    msgId: m.msgId || null,
                    modeSnapshot: m.modeSnapshot || null,
                });
            }
        });

        // channel 보정
        let channel = d.channel || "unknown";
        if (channel === "unknown" && d.cw_inbox_id) {
            try {
                const integ = await db.collection("integrations").doc(tenant).get();
                const cw = integ.exists ? integ.data()?.cw : null;
                if (cw && Array.isArray(cw.inboxes)) {
                    const ib = cw.inboxes.find(t => t.inboxId === d.cw_inbox_id);
                    if (ib?.channel) channel = ib.channel;
                }
            } catch { }
        }

        // 슬랙/통계
        const [slackDoc, statsDoc] = await Promise.all([
            db.collection("slack_threads").doc(convDoc.id).get(),
            db.collection("stats_conversations").doc(convDoc.id).get(),
        ]);
        const slackData = slackDoc.exists ? slackDoc.data() : null;
        const stats = statsDoc.exists ? statsDoc.data() : null;

        const { everWork: isTaskEver, lastSlackRoute } = getTaskFlagsFromStats(stats);

        const summary = typeof d.summary === "string" && d.summary.trim()
            ? d.summary.trim()
            : "";

        // ✅ 사용자 선택 archive 상태 계산
        const currentArchiveStatus = getCurrentArchiveStatus(d);

        return res.json({
            conversation: {
                id: convDoc.id,
                chatId: d.chat_id,
                userId: d.user_id,
                userName: d.user_name || "익명",
                brandName: d.brandName || null,
                channel,
                status: d.status || "waiting", // ✅ Chatwoot 상태 (waiting/resolved 등)
                archiveStatus: d.archive_status || null, // ✅ 사용자 선택 상태 (hold/important/completed)
                currentArchiveStatus, // ✅ 계산된 현재 상태 (active/hold/important/completed)
                important: d.important || false,
                modeSnapshot: d.modeSnapshot || "AUTO",
                draftStatus: d.draft_status || null,
                aiDraft: d.ai_draft || null,
                confirmThreadTs: d.confirm_thread_ts || null,
                confirmThreadChannel: d.confirm_thread_channel || null,
                lastMessageAt: safeIso(d.lastMessageAt),
                draftCreatedAt: safeIso(d.draft_created_at),
                archivedAt: safeIso(d.archived_at),
                archiveNote: d.archive_note || null,
                cwConversationId: d.cw_conversation_id || null,
                summary: summary || null,
                task: d.task || null,
                category: d.category || null,
                categories: d.category ? d.category.split('|').map(c => c.trim()) : [],
                isTaskEver,
                lastSlackRoute: lastSlackRoute || null,
            },
            messages,
            slack: slackData ? {
                channelId: slackData.channel_id,
                threadTs: slackData.thread_ts,
                cardType: slackData.card_type,
                isTask: !!slackData.is_task || isTaskEver,
                slackUrl: `https://slack.com/app_redirect?channel=${slackData.channel_id}&message_ts=${slackData.thread_ts}`,
                lastSlackRoute: lastSlackRoute || null,
            } : null,
            stats: stats ? {
                userChats: stats.user_chats || 0,
                aiChats: stats.ai_allchats || 0,
                agentChats: stats.agent_chats || 0,
                aiAuto: stats.ai_auto || 0,
                aiConfirmApproved: stats.ai_confirm_approved || 0,
                aiConfirmEdited: stats.ai_confirm_edited || 0,
            } : null,
        });
    } catch (error) {
        console.error("[conversations/detail] error:", error);
        return res.status(500).json({ error: error.message || "internal_error" });
    }
}