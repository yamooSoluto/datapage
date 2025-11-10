// pages/api/stats/[tenant].js
// Firestore 기반 통계 API (BigQuery 대신)

import admin from '../../../lib/firebase';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { tenant } = req.query;
    const { view = 'conversations', limit = 50, range = '7d' } = req.query;

    if (!tenant) {
        return res.status(400).json({ error: 'tenant is required' });
    }

    console.log(`📊 통계 조회: ${tenant}, range: ${range}`);

    try {
        const db = admin.firestore();

        // 날짜 범위 계산
        const days = parseInt(range.replace('d', '')) || 7;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        console.log(`📅 조회 기간: ${startDate.toISOString()} ~ ${endDate.toISOString()}`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 1. FAQ_realtime_cw에서 대화 데이터 조회
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const conversationsQuery = db
            .collection('FAQ_realtime_cw')
            .where('tenant_id', '==', tenant)
            .where('lastMessageAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
            .where('lastMessageAt', '<=', admin.firestore.Timestamp.fromDate(endDate))
            .limit(parseInt(limit) * 2); // 여유롭게 조회

        const conversationsSnapshot = await conversationsQuery.get();

        // chat_id 중복 제거 (같은 대화의 여러 문서)
        const chatMap = new Map();
        conversationsSnapshot.forEach(doc => {
            const data = doc.data();
            const chatId = data.chat_id;

            if (!chatMap.has(chatId)) {
                chatMap.set(chatId, { doc, data });
            } else {
                const existing = chatMap.get(chatId);
                const existingTs = existing.data.lastMessageAt?.toMillis() || 0;
                const currentTs = data.lastMessageAt?.toMillis() || 0;
                if (currentTs > existingTs) {
                    chatMap.set(chatId, { doc, data });
                }
            }
        });

        const uniqueConversations = Array.from(chatMap.values());
        console.log(`✅ 고유 대화: ${uniqueConversations.length}개`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 2. 기본 통계 계산
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const totalConversations = uniqueConversations.length;
        let aiAutoCount = 0;
        let agentMessages = 0;
        let totalResponseTime = 0;
        let responseTimeCount = 0;

        const channelCounts = {};
        const dailyData = {};

        uniqueConversations.forEach(({ data }) => {
            const messages = Array.isArray(data.messages) ? data.messages : [];

            // AI 자동 응답 카운트 (agent 메시지 없음)
            const hasAgentMessage = messages.some(m => {
                const sender = String(m.sender || '').toLowerCase();
                return sender === 'agent' || sender === 'admin';
            });

            if (!hasAgentMessage) {
                aiAutoCount++;
            } else {
                agentMessages++;
            }

            // 첫 응답 시간 계산
            const userMsg = messages.find(m => m.sender === 'user');
            const aiMsg = messages.find(m => m.sender === 'ai');

            if (userMsg && aiMsg) {
                const userTs = userMsg.timestamp?.toMillis?.() || 0;
                const aiTs = aiMsg.timestamp?.toMillis?.() || 0;
                if (userTs && aiTs && aiTs > userTs) {
                    totalResponseTime += Math.round((aiTs - userTs) / 1000);
                    responseTimeCount++;
                }
            }

            // 채널별 집계
            const channel = data.channel || 'unknown';
            channelCounts[channel] = (channelCounts[channel] || 0) + 1;

            // 일별 집계
            const date = data.lastMessageAt?.toDate?.();
            if (date) {
                const dateKey = `${date.getMonth() + 1}/${date.getDate()}`;
                if (!dailyData[dateKey]) {
                    dailyData[dateKey] = { date: dateKey, ai: 0, agent: 0 };
                }

                if (hasAgentMessage) {
                    dailyData[dateKey].agent++;
                } else {
                    dailyData[dateKey].ai++;
                }
            }
        });

        const aiAutoRate = totalConversations > 0
            ? Math.round((aiAutoCount / totalConversations) * 100)
            : 0;

        const avgResponseTime = responseTimeCount > 0
            ? Math.round(totalResponseTime / responseTimeCount)
            : 3;

        console.log(`✅ 기본 통계: 총 ${totalConversations}개, AI ${aiAutoRate}%`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 3. 채널별 데이터 변환
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const mediumData = Object.entries(channelCounts).map(([channel, count]) => ({
            name: channel === 'widget' ? '웹' :
                channel === 'naver' ? '네이버' :
                    channel === 'kakao' ? '카카오' :
                        channel === 'api' ? '네이버' : channel,
            count
        })).sort((a, b) => b.count - a.count);

        console.log(`✅ 채널별 집계: ${mediumData.length}개`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 4. AI vs Agent 분포
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const aiVsAgentData = [
            { name: 'AI 자동', value: aiAutoCount },
            { name: 'AI 보조', value: 0 }, // TODO: CONFIRM 모드 구분
            { name: '상담원', value: agentMessages }
        ];

        console.log(`✅ AI vs Agent 분포 완료`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 5. 일별 추이 (빈 날짜 채우기)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const dailyTrend = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateKey = `${d.getMonth() + 1}/${d.getDate()}`;

            dailyTrend.push(
                dailyData[dateKey] || { date: dateKey, ai: 0, agent: 0 }
            );
        }

        console.log(`✅ 일별 추이: ${dailyTrend.length}일`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 6. 태그 집계 (선택적)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const tagCounts = {};
        uniqueConversations.forEach(({ data }) => {
            const category = data.category || '';
            if (category) {
                const tags = category.split('|').map(t => t.trim()).filter(Boolean);
                tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });

        const tagData = Object.entries(tagCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        console.log(`✅ 태그 집계: ${tagData.length}개`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 7. 최근 대화 목록 (limit 적용)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const conversations = uniqueConversations
            .slice(0, parseInt(limit))
            .map(({ doc, data }) => {
                const messages = Array.isArray(data.messages) ? data.messages : [];

                const userCount = messages.filter(m => m.sender === 'user').length;
                const aiCount = messages.filter(m => m.sender === 'ai').length;
                const agentCount = messages.filter(m => {
                    const s = String(m.sender || '').toLowerCase();
                    return s === 'agent' || s === 'admin';
                }).length;

                return {
                    id: doc.id,
                    userName: data.user_name || '익명',
                    mediumName: data.channel === 'api' ? 'appNaver' :
                        data.channel === 'kakao' ? 'appKakao' :
                            data.channel === 'widget' ? 'web' : data.channel,
                    tags: data.category ? data.category.split('|').map(t => t.trim()) : [],
                    firstOpenedAt: data.lastMessageAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                    aiAutoChats: aiCount,
                    agentChats: agentCount
                };
            });

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
            conversations
        };

        console.log('✅ 통계 응답 완료');

        return res.status(200).json(response);

    } catch (error) {
        console.error('❌ 통계 조회 실패:', error);

        // Fallback: 빈 데이터 반환
        const days = parseInt(range.replace('d', '')) || 7;

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
                dailyTrend: Array.from({ length: days }, (_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - (days - 1 - i));
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
