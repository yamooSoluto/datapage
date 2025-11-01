export const config = { regions: ['icn1'] };
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    // 필요 시 서비스 계정 사용 가능 (환경에 맞게 교체)
    admin.initializeApp();
}
const db = admin.firestore();

// ============================================
// 📊 플랜별 조회 제한 설정 (null = 무제한)
// ============================================
const PLAN_LIMITS = {
    trial: { days: 30, maxDocs: null }, // maxDocs는 detail에서 사용
    starter: { days: 30, maxDocs: null },
    pro: { days: 90, maxDocs: null },
    business: { days: null, maxDocs: null },
    enterprise: { days: null, maxDocs: null },
};

// ── helpers ─────────────────────────────────────────────────
const clampLimit = (n, def = 50, max = 500) => {
    const x = Number(n);
    if (!Number.isFinite(x) || x <= 0) return def;
    return Math.min(x, max);
};

function normalizeChannel(val) {
    const v = String(val || '').toLowerCase();
    if (!v) return 'unknown';                       // 빈 값은 unknown 고정
    if (v.includes('naver') || v === 'api') return 'naver';
    if (v.includes('kakao')) return 'kakao';
    if (v.includes('widget') || v.includes('web')) return 'widget';
    return 'unknown';
}
function parseChannelFilter(v) {
    if (v === undefined || v === null) return null; // 쿼리 미지정 → 필터 미적용
    const s = String(v).trim();
    if (!s) return null;                            // 빈 문자열 → 필터 미적용
    return normalizeChannel(s);
}
function millis(v) {
    if (!v) return 0;
    if (typeof v?.toMillis === 'function') return v.toMillis();
    const n = Number(v);
    return Number.isFinite(n) ? n : new Date(v).getTime() || 0;
}
function buildSummary(d) {
    if (typeof d.summary === 'string' && d.summary.trim()) return d.summary.trim();
    const msgs = Array.isArray(d.messages) ? d.messages : [];
    const sorted = msgs.slice().sort((a, b) => millis(b.timestamp) - millis(a.timestamp));
    const pick = sorted.find((m) => (m?.text || '').trim());
    return pick ? String(pick.text).trim().slice(0, 140) : '';
}
function decodeCursor(cur) {
    try {
        if (!cur) return null;
        const obj = JSON.parse(Buffer.from(cur, 'base64').toString('utf8'));
        if (Number.isFinite(obj.ts)) return obj;
    } catch { }
    return null;
}
function encodeCursor(ts, chatId) {
    return Buffer.from(JSON.stringify({ ts, chatId }), 'utf8').toString('base64');
}

async function getPlanOfTenant(tenantId) {
    try {
        const snap = await db.collection('tenants').doc(String(tenantId)).get();
        const plan = (snap.exists && snap.data()?.plan) ? String(snap.data().plan) : 'starter';
        return PLAN_LIMITS[plan] ? plan : 'starter';
    } catch {
        return 'starter';
    }
}

function classifyCardType(cardType) {
    const type = String(cardType || '').toLowerCase();
    if (type.includes('create') || type.includes('update') || type.includes('upgrade'))
        return { isTask: true, taskType: 'work', cardType: type };
    if (type.includes('shadow') || type === 'skip')
        return { isTask: false, taskType: 'shadow', cardType: type };
    return { isTask: !!type, taskType: type ? 'other' : null, cardType: type };
}
function classifyCardTypeFromRoute(route) {
    const r = String(route || '').toLowerCase();
    if (r.includes('shadow') || r === 'skip') return { isTask: false, taskType: 'shadow', cardType: route };
    if (r.includes('create') || r.includes('update') || r.includes('upgrade')) return { isTask: true, taskType: 'work', cardType: route };
    if (r.includes('confirm')) return { isTask: false, taskType: 'confirm', cardType: route };
    if (r.includes('agent')) return { isTask: true, taskType: 'agent', cardType: route };
    return { isTask: false, taskType: null, cardType: route };
}

// ── handler ────────────────────────────────────────────────
export default async function handler(req, res) {
    try {
        // 짧은 CDN 캐시로 체감 성능 개선
        res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=60');

        const { tenant, channel, limit, cursor, since, until } = req.query || {};
        if (!tenant) return res.status(400).json({ error: 'tenant is required' });

        const pageSize = clampLimit(limit);
        const parsedChannel = parseChannelFilter(channel);

        // 플랜 조회 → days(null이면 기간 제한 없음)
        const plan = await getPlanOfTenant(tenant);
        const { days } = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;

        const now = Date.now();
        const sinceMs = Number(since) || null;
        const untilMs = Number(until) || null;

        // 기간 필터 적용 기준:
        // - since/until 쿼리가 있으면 그대로 우선 적용
        // - 없고, 플랜 days가 숫자면 days기간만큼 필터
        // - days가 null이면 (무제한) 기간 필터 생략
        let q = db.collection('FAQ_realtime_cw')
            .where('tenant_id', '==', String(tenant))
            .orderBy('lastMessageAt', 'desc');

        if (sinceMs) {
            q = q.where('lastMessageAt', '>=', admin.firestore.Timestamp.fromMillis(sinceMs));
        } else if (Number.isFinite(days)) {
            const defaultSince = now - (days * 86400 * 1000);
            q = q.where('lastMessageAt', '>=', admin.firestore.Timestamp.fromMillis(defaultSince));
        }
        if (untilMs) {
            q = q.where('lastMessageAt', '<=', admin.firestore.Timestamp.fromMillis(untilMs));
        }

        if (parsedChannel !== null) {
            q = q.where('channel', '==', parsedChannel);
        }

        const cur = decodeCursor(cursor);
        if (cur?.ts) {
            const lastTs = admin.firestore.Timestamp.fromMillis(cur.ts);
            q = q.startAfter(lastTs);
        }

        const snap = await q.limit(pageSize * 3).get(); // 여유로 가져와 chat_id 유니크화

        const byChat = new Map();
        snap.docs.forEach((doc) => {
            const data = doc.data();
            const chatId = data.chat_id;
            const prev = byChat.get(chatId);
            if (!prev) byChat.set(chatId, { doc, data });
            else {
                const a = prev.data.lastMessageAt?.toMillis() || 0;
                const b = data.lastMessageAt?.toMillis() || 0;
                if (b > a) byChat.set(chatId, { doc, data });
            }
        });

        const unique = Array.from(byChat.values())
            .sort((a, b) => {
                const A = a.data.lastMessageAt?.toMillis() || 0;
                const B = b.data.lastMessageAt?.toMillis() || 0;
                return B - A;
            })
            .slice(0, pageSize);

        // 슬랙 메타
        const slackRefs = unique.map(({ doc }) => db.collection('slack_threads').doc(doc.id));
        const slackDocs = slackRefs.length ? await db.getAll(...slackRefs) : [];
        const slackMap = new Map(slackDocs.map((sd, i) => [unique[i].doc.id, sd.exists ? sd.data() : null]));

        const conversations = unique.map(({ doc, data: v }) => {
            const msgs = Array.isArray(v.messages) ? v.messages : [];
            const cnt = {
                user: msgs.filter(m => String(m.sender).toLowerCase() === 'user').length,
                ai: msgs.filter(m => String(m.sender).toLowerCase() === 'ai').length,
                agent: msgs.filter(m => ['agent', 'admin'].includes(String(m.sender).toLowerCase())).length,
            };

            const pics = [], thumbs = [];
            msgs.forEach(m => {
                if (Array.isArray(m.pics)) {
                    m.pics.forEach(p => {
                        if (p?.url) {
                            pics.push(p.url);
                            thumbs.push(p.thumbnail_url || p.url);
                        }
                    });
                }
            });

            const slack = slackMap.get(doc.id);
            const slackRoute = v.slack_route || null;
            const cardFromSlack = slack?.card_type || null;
            const cardInfo = cardFromSlack ? classifyCardType(cardFromSlack)
                : (slackRoute ? classifyCardTypeFromRoute(slackRoute) : null);

            const extractMiddleChar = (name) => {
                if (!name || name.length < 3) return name?.charAt(0) || '?';
                const parts = name.trim().split(/\s+/);
                if (parts.length > 1) return parts[1]?.charAt(0) || parts[0]?.charAt(1) || '?';
                const mid = Math.floor(name.length / 2);
                return name.charAt(mid);
            };

            return {
                id: doc.id,
                chatId: v.chat_id,
                userId: v.user_id,
                userName: v.user_name || '익명',
                userNameInitial: extractMiddleChar(v.user_name),
                brandName: v.brand_name || v.brandName || null,
                channel: v.channel || 'unknown',
                status: v.status || 'waiting',
                modeSnapshot: v.modeSnapshot || 'AUTO',
                lastMessageAt: v.lastMessageAt?.toDate?.()?.toISOString() || null,

                lastMessageText: buildSummary(v) || (pics.length ? `(이미지 ${pics.length}개)` : ''),
                summary: typeof v.summary === 'string' ? v.summary : null,

                hasImages: pics.length > 0,
                imageCount: pics.length,
                firstImageUrl: pics[0] || null,
                firstThumbnailUrl: thumbs[0] || null,

                messageCount: { ...cnt, total: msgs.length },

                category: v.category || null,
                categories: v.category ? v.category.split('|').map(s => s.trim()).filter(Boolean) : [],

                hasSlackCard: !!slack,
                isTask: cardInfo?.isTask || false,
                taskType: cardInfo?.taskType || null,
                slackCardType: cardInfo?.cardType || null,
            };
        });

        const last = unique[unique.length - 1];
        const nextCursor = last
            ? encodeCursor(last.data.lastMessageAt?.toMillis() || 0, last.data.chat_id)
            : null;

        return res.status(200).json({
            conversations,
            nextCursor,
            _meta: {
                returned: conversations.length,
                uniqueChats: byChat.size,
                plan,
                planDays: (PLAN_LIMITS[plan] || {}).days ?? null,
                appliedChannel: parsedChannel,                 // null이면 필터 미적용
                appliedSince: sinceMs || null,                 // 기본 윈도우는 서버 내부에서만 적용
                appliedUntil: untilMs || null,
            }
        });
    } catch (e) {
        console.error('[conversations/list] error:', e);
        return res.status(500).json({ error: e.message || 'internal_error' });
    }
}
