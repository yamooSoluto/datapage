// pages/api/stats/[tenantId].js
// BigQuery 기반 통계 API

const DATASET = process.env.BQ_DATASET || 'cs_analytics';

let bigQueryInstance = null;
function getBigQuery() {
  if (bigQueryInstance) return bigQueryInstance;
  try {
    const { BigQuery } = require('@google-cloud/bigquery');
    bigQueryInstance = new BigQuery();
  } catch (err) {
    console.warn('⚠️ BigQuery SDK not installed. Stats API will return empty data.', err.message);
    bigQueryInstance = null;
  }
  return bigQueryInstance;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tenantId } = req.query;
  const { view = 'conversations', limit = 50, range = '7d' } = req.query;

  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId is required' });
  }

  console.log(`📊 통계 조회: ${tenantId}, range: ${range}`);

  const bq = getBigQuery();
  if (!bq) {
    console.warn('BigQuery client unavailable. Returning empty stats.');
    return res.status(200).json({
      stats: {
        total: 0,
        aiAutoRate: 0,
        avgResponseTime: 0,
        agentMessages: 0,
      },
      chartData: {
        mediumData: [],
        tagData: [],
        aiVsAgentData: [],
        dailyTrend: [],
      },
      conversations: [],
    });
  }

  try {
    // 날짜 범위 계산
    const days = parseInt(range.replace('d', '')) || 7;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`📅 조회 기간: ${startDateStr} ~ ${endDateStr}`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1. 기본 통계 (총 대화, AI 자동응답률, 상담원 개입)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const statsQuery = `
      SELECT
        COUNT(DISTINCT chat_id) as total_conversations,
        SUM(ai_auto) as ai_auto_count,
        SUM(agent_chats) as agent_messages,
        AVG(first_response_time_sec) as avg_response_time
      FROM \`${DATASET}.conversations_daily_raw\`
      WHERE tenant_id = @tenantId
        AND DATE(first_message_iso) BETWEEN @startDate AND @endDate
    `;

    const [statsRows] = await bq.query({
      query: statsQuery,
      params: { tenantId, startDate: startDateStr, endDate: endDateStr }
    });

    const statsResult = statsRows[0] || {};
    const totalConversations = parseInt(statsResult.total_conversations) || 0;
    const aiAutoCount = parseInt(statsResult.ai_auto_count) || 0;
    const agentMessages = parseInt(statsResult.agent_messages) || 0;
    const avgResponseTime = Math.round(parseFloat(statsResult.avg_response_time) || 3);
    const aiAutoRate = totalConversations > 0
      ? Math.round((aiAutoCount / totalConversations) * 100)
      : 0;

    console.log(`✅ 기본 통계: 총 ${totalConversations}개, AI ${aiAutoRate}%`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2. 채널별 집계
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const mediumQuery = `
      SELECT
        channel,
        COUNT(DISTINCT chat_id) as count
      FROM \`${DATASET}.conversations_daily_raw\`
      WHERE tenant_id = @tenantId
        AND DATE(first_message_iso) BETWEEN @startDate AND @endDate
      GROUP BY channel
      ORDER BY count DESC
    `;

    const [mediumRows] = await bq.query({
      query: mediumQuery,
      params: { tenantId, startDate: startDateStr, endDate: endDateStr }
    });

    const mediumData = mediumRows.map(row => ({
      name: row.channel === 'widget' ? '웹' :
        row.channel === 'naver' ? '네이버' :
          row.channel === 'kakao' ? '카카오' : row.channel,
      count: parseInt(row.count) || 0
    }));

    console.log(`✅ 채널별 집계: ${mediumData.length}개`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3. AI vs Agent 분포
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const aiVsAgentQuery = `
      SELECT
        SUM(ai_auto) as ai_only,
        SUM(ai_mediatedchats) as ai_assisted,
        SUM(agent_direct + agent_modal + agent_thread) as agent_only
      FROM \`${DATASET}.stats_conversations_daily_raw\` s
      WHERE s.tenant_id = @tenantId
        AND DATE(s.updated_at) BETWEEN @startDate AND @endDate
    `;

    const [aiVsAgentRows] = await bq.query({
      query: aiVsAgentQuery,
      params: { tenantId, startDate: startDateStr, endDate: endDateStr }
    });

    const aiVsResult = aiVsAgentRows[0] || {};
    const aiVsAgentData = [
      { name: 'AI 자동', value: parseInt(aiVsResult.ai_only) || 0 },
      { name: 'AI 보조', value: parseInt(aiVsResult.ai_assisted) || 0 },
      { name: '상담원', value: parseInt(aiVsResult.agent_only) || 0 }
    ];

    console.log(`✅ AI vs Agent 분포 완료`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 4. 일별 추이 (최근 7일)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const dailyTrendQuery = `
      SELECT
        DATE(first_message_iso) as date,
        SUM(CASE WHEN mode_snapshot = 'AUTO' THEN 1 ELSE 0 END) as ai_count,
        COUNT(DISTINCT chat_id) - SUM(CASE WHEN mode_snapshot = 'AUTO' THEN 1 ELSE 0 END) as agent_count
      FROM \`${DATASET}.conversations_daily_raw\`
      WHERE tenant_id = @tenantId
        AND DATE(first_message_iso) BETWEEN @startDate AND @endDate
      GROUP BY date
      ORDER BY date ASC
    `;

    const [dailyRows] = await bq.query({
      query: dailyTrendQuery,
      params: { tenantId, startDate: startDateStr, endDate: endDateStr }
    });

    const dailyTrend = dailyRows.map(row => {
      const d = new Date(row.date.value);
      return {
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        ai: parseInt(row.ai_count) || 0,
        agent: parseInt(row.agent_count) || 0
      };
    });

    // 빈 날짜 채우기
    if (dailyTrend.length < days) {
      const filledTrend = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;

        const existing = dailyTrend.find(t => t.date === dateStr);
        filledTrend.push(existing || { date: dateStr, ai: 0, agent: 0 });
      }
      dailyTrend.length = 0;
      dailyTrend.push(...filledTrend);
    }

    console.log(`✅ 일별 추이: ${dailyTrend.length}일`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 5. 주요 태그 (messages에서 추출)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // BigQuery의 messages_daily_raw에는 태그가 없으므로
    // Firestore에서 조회하거나 생략
    const tagData = []; // TODO: 필요시 Firestore에서 조회

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 6. 최근 대화 목록 (Firestore에서 조회)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // API에서 conversations를 별도로 조회하는 것이 일반적
    const conversations = []; // TODO: /api/conversations/list 사용

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 최종 응답
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const response = {
      stats: {
        total: totalConversations,
        aiAutoRate: aiAutoRate,
        avgResponseTime: avgResponseTime,
        agentMessages: agentMessages
      },
      chartData: {
        mediumData,
        tagData,
        aiVsAgentData,
        dailyTrend
      },
      conversations // 빈 배열 또는 별도 API 호출
    };

    console.log('✅ 통계 응답 완료');

    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ BigQuery 통계 조회 실패:', error);

    // Fallback: 빈 데이터 반환
    return res.status(200).json({
      stats: {
        total: 0,
        aiAutoRate: 0,
        avgResponseTime: 3,
        agentMessages: 0
      },
      chartData: {
        mediumData: [],
        tagData: [],
        aiVsAgentData: [
          { name: 'AI 자동', value: 0 },
          { name: 'AI 보조', value: 0 },
          { name: '상담원', value: 0 }
        ],
        dailyTrend: Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return {
            date: `${d.getMonth() + 1}/${d.getDate()}`,
            ai: 0,
            agent: 0
          };
        })
      },
      conversations: []
    });
  }
}
