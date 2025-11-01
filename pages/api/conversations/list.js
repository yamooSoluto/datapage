// pages/api/conversations/list.js
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

// ── helpers
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

// 요약: 문서에 summary가 있으면 그걸, 없으면 최근 user/ai 텍스트 한 줄
function buildSummary(d) {
    if (typeof d.summary === 'string' && d.summary.trim()) {
        return d.summary.trim();
    }
    const msgs = Array.isArray(d.messages) ? d.messages : [];
    // 최근 메시지 순으로 스캔
    const sorted = msgs
        .slice()
        .sort((a, b) => millis(b.timestamp) - millis(a.timestamp));
    const pick = sorted.find((m) => (m?.text || '').trim());
    return pick ? String(pick.text).trim().slice(0, 140) : '';
}

const clampLimit = (n, def = 50, max = 500) => {
    const x = Number(n);
    if (!Number.isFinite(x) || x <= 0) return def;
    return Math.min(x, max);
};

// 리스트 필터용 채널 파라미터 파싱
// - 쿼리 파라미터가 빈 문자열/누락이면 "필터 미적용(null)"
// - 값이 들어오면 normalizeChannel로 정규화 (unknown 포함 허용)
function parseChannelFilter(v) {
    if (v === undefined || v === null) return null; // 필터 미적용
    const s = String(v).trim();
    if (!s) return null; // 필터 미적용
    return normalizeChannel(s); // 'unknown' 포함 그대로 필터
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

// ✅ 슬랙 카드 타입 분류 (card_type 기반)
function classifyCardType(cardType) {
    const type = String(cardType || "").toLowerCase();

    // 업무 카드 (create/update/upgrade)
    if (type.includes('create') || type.includes('update') || type.includes('upgrade')) {
        return {
            isTask: true,
            taskType: 'work',
            cardType: type
        };
    }

    // Shadow 카드 (skip/shadow - 자동 처리됨)
    if (type.includes('shadow') || type.includes('skip')) {
        return {
            isTask: false,
            taskType: 'shadow',
            cardType: type
        };
    }

    // 기타
    return {
        isTask: !!type,
        taskType: type ? 'other' : null,
        cardType: type
    };
}

// ✅ slack_route 기반 카드 타입 분류 (폴백)
function classifyCardTypeFromRoute(route) {
    const r = String(route || "").toLowerCase();

    // Shadow 라우트
    if (r.includes('shadow') || r === 'skip') {
        return {
            isTask: false,
            taskType: 'shadow',
            cardType: route
        };
    }

    // 업무 라우트
    if (r.includes('create') || r.includes('update') || r.includes('upgrade')) {
        return {
            isTask: true,
            taskType: 'work',
            cardType: route
        };
    }

    // Confirm 라우트
    if (r.includes('confirm')) {
        return {
            isTask: false,
            taskType: 'confirm',
            cardType: route
        };
    }

    // Agent 라우트
    if (r.includes('agent')) {
        return {
            isTask: true,
            taskType: 'agent',
            cardType: route
        };
    }

    return {
        isTask: false,
        taskType: null,
        cardType: route
    };
}


// ──────────────────────────────────────────────
// handler
// ──────────────────────────────────────────────

export default async function handler(req, res) {
    try {
        const {
            tenant,
            channel = "all",
            category = "all",
            limit,
            cursor
        } = req.query;

        if (!tenant) return res.status(400).json({ error: "tenant is required" });

        const pageSize = clampLimit(limit);

        // ✅ chat_id 기반 조회 (각 채팅방의 최신 세션만)
        let q = db
            .collection("FAQ_realtime_cw")
            .where("tenant_id", "==", tenant)
            .orderBy("lastMessageAt", "desc");

        // 필터 적용
        if (channel !== "all") q = q.where("channel", "==", normalizeChannel(channel));

        // 카테고리 필터는 클라이언트에서 처리 (문자열 기반)

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

        // 슬랙 스레드 배치 조회 - doc.id를 직접 사용
        const slackRefs = uniqueDocs.map(({ doc }) =>
            db.collection("slack_threads").doc(doc.id)
        );
        const slackDocs = slackRefs.length > 0 ? await db.getAll(...slackRefs) : [];
        const slackMap = new Map(
            slackDocs.map((sd, idx) => [uniqueDocs[idx].doc.id, sd.exists ? sd.data() : null])
        );

        // 응답 변환
        const conversations = uniqueDocs.map(({ doc, data: v }) => {
            const msgs = Array.isArray(v.messages) ? v.messages : [];
            const userCount = msgs.filter(m => m.sender === "user").length;
            const aiCount = msgs.filter(m => m.sender === "ai").length;

            // ✅ agent 카운트 제대로 계산 (admin도 포함)
            const agentCount = msgs.filter(m => {
                const sender = String(m.sender || '').toLowerCase();
                return sender === 'agent' || sender === 'admin';
            }).length;

            const lastMsg = msgs[msgs.length - 1];

            // ✅ 이미지 첨부 정보 수집
            // ✅ 썸네일 URL 추출
            const allPics = [];
            const allThumbnails = [];

            msgs.forEach(m => {
                if (Array.isArray(m.pics) && m.pics.length > 0) {
                    m.pics.forEach(p => {
                        if (p?.url) {
                            allPics.push(p.url);
                            // ✅ 썸네일 URL 우선, 없으면 원본
                            allThumbnails.push(p.thumbnail_url || p.url);
                        }
                    });
                }
            });

            const slack = slackMap.get(doc.id);

            // ✅ 슬랙 카드 타입 분류
            // slack_threads 없으면 FAQ_realtime_cw의 slack_route 사용
            const slackRoute = v.slack_route || null;
            const cardTypeFromSlack = slack?.card_type || null;

            const cardInfo = cardTypeFromSlack
                ? classifyCardType(cardTypeFromSlack)
                : (slackRoute ? classifyCardTypeFromRoute(slackRoute) : null);

            // ✅ 사용자 이름에서 중간 글자 추출 (예: "화곡역 송아지" -> "송")
            const extractMiddleChar = (name) => {
                if (!name || name.length < 3) return name?.charAt(0) || '?';
                const parts = name.trim().split(/\s+/);
                if (parts.length > 1) {
                    // 공백으로 구분된 경우 두번째 단어의 첫 글자
                    return parts[1]?.charAt(0) || parts[0]?.charAt(1) || '?';
                }
                // 공백 없으면 중간 글자
                const mid = Math.floor(name.length / 2);
                return name.charAt(mid);
            };

            return {
                id: doc.id,
                chatId: v.chat_id,
                userId: v.user_id,
                userName: v.user_name || "익명",
                userNameInitial: extractMiddleChar(v.user_name), // ✅ 중간 글자 추가
                brandName: v.brand_name || v.brandName || null,
                channel: v.channel || "unknown",
                status: v.status || "waiting",
                modeSnapshot: v.modeSnapshot || "AUTO",
                lastMessageAt: v.lastMessageAt?.toDate?.()?.toISOString() || null,

                // ✅ summary 우선, 없으면 마지막 메시지 텍스트
                lastMessageText: v.summary || lastMsg?.text?.slice(0, 80) || (allPics.length > 0 ? `(이미지 ${allPics.length}개)` : ""),
                summary: v.summary || null, // ✅ summary 필드 추가

                // ✅ 이미지 정보 추가
                hasImages: allPics.length > 0,
                imageCount: allPics.length,
                firstImageUrl: allPics[0] || null,
                firstThumbnailUrl: allThumbnails[0] || null,

                messageCount: {
                    user: userCount,
                    ai: aiCount,
                    agent: agentCount, // ✅ Agent 카운트 추가
                    total: msgs.length
                },
                // ✅ 카테고리 정보 추가 (문자열 또는 배열 모두 지원)
                category: v.category || null, // 문자열 (예: "결제/환불|예약/변경")
                categories: v.category ? v.category.split('|').map(c => c.trim()) : [], // 배열로 변환
                // ✅ 슬랙 카드 정보 추가
                hasSlackCard: !!slack,
                isTask: cardInfo?.isTask || false,
                taskType: cardInfo?.taskType || null, // 'work', 'shadow', 'other'
                slackCardType: cardInfo?.cardType || null,
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