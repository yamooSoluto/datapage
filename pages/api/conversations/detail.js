export const config = { regions: ['icn1'] };
import * as admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ============================================
// 📊 플랜별 조회 제한 설정 (null = 무제한)
// ============================================
const PLAN_LIMITS = {
    trial: { days: 30, maxDocs: null },
    starter: { days: 30, maxDocs: null },
    pro: { days: 90, maxDocs: null },
    business: { days: null, maxDocs: null },
    enterprise: { days: null, maxDocs: null },
};

async function getPlanOfTenant(tenantId) {
    try {
        const snap = await db.collection('tenants').doc(String(tenantId)).get();
        const plan = (snap.exists && snap.data()?.plan) ? String(snap.data().plan) : 'starter';
        return PLAN_LIMITS[plan] ? plan : 'starter';
    } catch {
        return 'starter';
    }
}

function millis(v) {
    if (!v) return 0;
    if (typeof v?.toMillis === 'function') return v.toMillis();
    const n = Number(v);
    return Number.isFinite(n) ? n : new Date(v).getTime() || 0;
}

export default async function handler(req, res) {
    try {
        res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');

        const { tenant, chatId, since, until } = req.query || {};
        const tenantId = String(tenant || '').trim();
        const conversationId = String(chatId || '').trim();
        if (!tenantId || !conversationId)
            return res.status(400).json({ error: 'tenant & chatId are required' });

        const plan = await getPlanOfTenant(tenantId);
        const { days, maxDocs } = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;

        const now = Date.now();
        const sinceMs = Number(since) || null;
        const untilMs = Number(until) || null;

        let qRef = db.collection('FAQ_realtime_cw')
            .where('tenant_id', '==', tenantId)
            .where('chat_id', '==', conversationId)
            .orderBy('lastMessageAt', 'desc');

        // 기간 필터: 쿼리 우선, 없으면 플랜 days 적용, days=null이면 생략
        if (sinceMs) {
            qRef = qRef.where('lastMessageAt', '>=', admin.firestore.Timestamp.fromMillis(sinceMs));
        } else if (Number.isFinite(days)) {
            const defaultSince = now - (days * 86400 * 1000);
            qRef = qRef.where('lastMessageAt', '>=', admin.firestore.Timestamp.fromMillis(defaultSince));
        }
        if (untilMs) {
            qRef = qRef.where('lastMessageAt', '<=', admin.firestore.Timestamp.fromMillis(untilMs));
        }

        // 문서 수 제한: maxDocs가 숫자일 때만 적용, null이면 무제한
        if (Number.isFinite(maxDocs)) {
            qRef = qRef.limit(Number(maxDocs));
        }

        const snap = await qRef.get();
        if (snap.empty) {
            return res.status(200).json({
                ok: true,
                items: [],
                meta: {
                    tenantId, conversationId, plan,
                    appliedSince: sinceMs || (Number.isFinite(days) ? (now - days * 86400 * 1000) : null),
                    appliedUntil: untilMs || null,
                    limitDocs: Number.isFinite(maxDocs) ? maxDocs : null,
                }
            });
        }

        // 최신 1건 기준(기존 동작 유지)
        const head = snap.docs[0].data() || {};
        const messages = Array.isArray(head.messages) ? head.messages : [];
        const summary = (typeof head.summary === 'string' && head.summary.trim()) ? head.summary.trim() : '';

        const counters = {
            user: head.user_chats || head.counters?.user || 0,
            ai: head.ai_allchats || head.counters?.ai || 0,
            agent: head.agent_chats || head.counters?.agent || 0,
            total: (head.user_chats || 0) + (head.ai_allchats || 0) + (head.agent_chats || 0),
        };

        return res.status(200).json({
            ok: true,
            meta: {
                tenantId,
                conversationId,
                brand_name: head.brandName || head.brand_name || null,
                channel: head.channel || 'unknown',
                status: head.status || null,
                lastMessageAt: millis(head.lastMessageAt),
                plan,
                appliedSince: sinceMs || (Number.isFinite(days) ? (now - days * 86400 * 1000) : null),
                appliedUntil: untilMs || null,
                limitDocs: Number.isFinite(maxDocs) ? maxDocs : null,
            },
            summary,
            counters,
            messages,
        });
    } catch (e) {
        console.error('[conversations/detail] error:', e);
        return res.status(500).json({ ok: false, error: e.message || 'internal_error' });
    }
}
