// pages/api/stats/[tenant].js
import admin from "firebase-admin";

// ─────────────────────────────────────────────
// 🔐 Firebase Admin 초기화 (중복 방지 + 안전한 키 파싱)
// ─────────────────────────────────────────────
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
    });
    console.log("✅ Firebase Admin initialized successfully");
  } catch (initError) {
    console.error("❌ Firebase Admin initialization failed:", initError);
  }
}

const db = admin.firestore();

// ─────────────────────────────────────────────
// 📊 Stats API Handler
// ─────────────────────────────────────────────
export default async function handler(req, res) {
  const { tenant } = req.query;
  const { view = "conversations", limit = 50, range = "7d" } = req.query;

  if (!tenant) {
    return res.status(400).json({ error: "Tenant ID required" });
  }

  // 숫자 안전 변환기
  const toInt = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  try {
    // ✅ MOCK 모드 (테스트용)
    if (process.env.USE_MOCK_STATS === "true") {
      return res.status(200).json({
        view: "conversations",
        conversations: [
          {
            id: "demo_conversation",
            userName: "테스트 회원",
            mediumName: "appKakao",
            tags: ["테스트_태그"],
            userChats: 3,
            aiAutoChats: 2,
            agentChats: 1,
            firstOpenedAt: "2025-01-01T10:00:00Z",
          },
        ],
        stats: {
          total: 1,
          aiAutoRate: 67,
          avgResponseTime: 3,
          byMedium: { appKakao: 1 },
          byTag: { "테스트_태그": 1 },
        },
        chartData: {
          mediumData: [{ name: "카카오", count: 1 }],
          tagData: [{ name: "테스트_태그", count: 1 }],
          aiVsAgentData: [
            { name: "AI 자동", value: 2 },
            { name: "상담원", value: 1 },
          ],
        },
      });
    }

    // ✅ 실제 Firestore 조회
    console.log(`[Stats API] Fetching tenant: ${tenant}`);

    // (선택) range에 따른 날짜 필터: 최근 X일
    const now = new Date();
    const days = range === "30d" ? 30 : range === "90d" ? 90 : 7;
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    let q = db
      .collection("stats_conversations")
      .where("tenantId", "==", tenant)
      .orderBy("firstOpenedAt", "desc");

    // firstOpenedAt이 Timestamp인 케이스를 우선 지원
    try {
      q = q.where("firstOpenedAt", ">=", admin.firestore.Timestamp.fromDate(since));
    } catch (_) {}

    const snapshot = await q.limit(Number(limit)).get();

    if (snapshot.empty) {
      return res.status(200).json({
        view,
        conversations: [],
        stats: {
          total: 0,
          aiAutoRate: 0,
          avgResponseTime: 0,
          byMedium: {},
          byTag: {},
        },
        chartData: { mediumData: [], tagData: [], aiVsAgentData: [] },
      });
    }

    // =============================
    // 📄 문서 변환 (혼합 스키마 호환)
    // =============================
    const conversations = [];
    snapshot.forEach((doc) => {
      const data = doc.data();

      // Timestamp 또는 ISO 문자열/number 모두 호환
      const ts =
        data.firstOpenedAt?.toDate?.() ??
        (typeof data.firstOpenedAt === "string"
          ? new Date(data.firstOpenedAt)
          : typeof data.firstOpenedAt === "number"
          ? new Date(data.firstOpenedAt)
          : null);

      const mediumRaw = data.mediumName || data.medium || "unknown";
      const mediumName = mediumRaw === "Channel::WebWidget" ? "widget" : mediumRaw;

      const aiAuto = toInt(data.ai_autochats ?? data.aiAutoChats);
      const aiMedi = toInt(data.ai_mediatedchats ?? data.aiMediatedChats);
      const agent = toInt(data.agent_chats ?? data.agentChats);
      const user = toInt(data.user_chats ?? data.userChats);

      conversations.push({
        id: data.conversationId || doc.id,
        userId: data.userId || null,
        userName: data.userName || "익명",
        mediumName,
        page: data.page || null,
        tags: data.tags || [],
        url: data.url || null,
        firstOpenedAt: ts ? ts.toISOString() : null,
        userChats: user,
        aiAutoChats: aiAuto,
        aiMediatedChats: aiMedi,
        agentChats: agent,
        responseTimeFirst: toInt(data.responseTime_first ?? data.responseTimeFirst) || null,
      });
    });

    // =============================
    // 📈 통계 계산
    // =============================
    const stats = {
      total: conversations.length,
      totalMessages: conversations.reduce(
        (sum, c) =>
          sum +
          (c.userChats || 0) +
          (c.aiAutoChats || 0) +
          (c.aiMediatedChats || 0) +
          (c.agentChats || 0),
        0
      ),
      aiAutoMessages: conversations.reduce((sum, c) => sum + (c.aiAutoChats || 0), 0),
      aiMediatedMessages: conversations.reduce((sum, c) => sum + (c.aiMediatedChats || 0), 0),
      agentMessages: conversations.reduce((sum, c) => sum + (c.agentChats || 0), 0),
      avgResponseTime: (() => {
        const arr = conversations
          .map((c) => c.responseTimeFirst)
          .filter((v) => typeof v === "number" && v >= 0);
        return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
      })(),
      aiAutoRate: 0,
      byMedium: {},
      byTag: {},
    };

    // 분류
    conversations.forEach((conv) => {
      const medium = conv.mediumName || "unknown";
      stats.byMedium[medium] = (stats.byMedium[medium] || 0) + 1;
      (conv.tags || []).forEach((tag) => {
        stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
      });
    });

    // 'AI 자동응답률' = 전체 메시지 중 AI 자동 비율
    stats.aiAutoRate =
      stats.totalMessages > 0
        ? Math.round((stats.aiAutoMessages / stats.totalMessages) * 100)
        : 0;

    // =============================
    // 📊 차트 데이터 구성
    // =============================
    const chartData = {
      mediumData: Object.entries(stats.byMedium).map(([name, count]) => ({
        name:
          name === "appKakao"
            ? "카카오"
            : name === "appNaverTalk"
            ? "네이버톡"
            : name === "web"
            ? "웹"
            : name === "widget"
            ? "위젯"
            : name === "unknown"
            ? "기타"
            : name,
        count,
      })),
      tagData: Object.entries(stats.byTag)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      aiVsAgentData: [
        { name: "AI 자동", value: stats.aiAutoMessages },
        { name: "AI 보조", value: stats.aiMediatedMessages },
        { name: "상담원", value: stats.agentMessages },
      ].filter((i) => i.value > 0),
    };

    return res.status(200).json({
      view,
      conversations,
      stats,
      chartData,
    });
  } catch (error) {
    console.error("🔥 [Stats API] Error:", error);
    return res.status(500).json({
      error: "Server error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
