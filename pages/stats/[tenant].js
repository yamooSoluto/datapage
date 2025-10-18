import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Download, Calendar, TrendingUp, Users, MessageSquare, Zap } from 'lucide-react';

// 세련된 색상 팔레트
const COLORS = {
  primary: 'rgba(99, 102, 241, 0.8)',
  secondary: 'rgba(139, 92, 246, 0.8)',
  success: 'rgba(34, 197, 94, 0.8)',
  warning: 'rgba(251, 146, 60, 0.8)',
  info: 'rgba(59, 130, 246, 0.8)',
  pink: 'rgba(236, 72, 153, 0.8)',
};

const CHART_COLORS = [
  COLORS.primary,
  COLORS.secondary,
  COLORS.success,
  COLORS.warning,
  COLORS.info,
  COLORS.pink,
];

// 커스텀 툴팁
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-xl border border-gray-100">
        <p className="font-semibold text-gray-900 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// 통계 카드
const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-50">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-3xl font-bold" style={{ color }}>{value}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div 
        className="p-3 rounded-xl"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon size={24} style={{ color }} />
      </div>
    </div>
  </div>
);

// 메인 컴포넌트
export default function StatsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('7d');
  const [view, setView] = useState('conversations');

  const tenantId = typeof window !== 'undefined' 
    ? window.location.pathname.split('/').pop() 
    : 't_01K4AY0QTGPBVE8WBJDG87YJCF';

  useEffect(() => {
    fetchData();
  }, [dateRange, view]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/stats/${tenantId}?view=${view}&limit=50`
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const result = await response.json();
      
      // dailyTrend 샘플 데이터 추가
      if (!result.chartData.dailyTrend) {
        const today = new Date();
        result.chartData.dailyTrend = Array.from({ length: 7 }, (_, i) => {
          const date = new Date(today);
          date.setDate(date.getDate() - (6 - i));
          return {
            date: `${date.getMonth() + 1}/${date.getDate()}`,
            ai: Math.floor(Math.random() * 20) + 10,
            agent: Math.floor(Math.random() * 5),
          };
        });
      }
      
      setData(result);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setError(err.message);
      
      // 에러 시 샘플 데이터
      setData({
        stats: {
          total: 5,
          aiAutoRate: 80,
          avgResponseTime: 3,
          agentMessages: 0,
        },
        chartData: {
          mediumData: [
            { name: '카카오', count: 3 },
            { name: '웹', count: 2 },
          ],
          tagData: [
            { name: '프로모션이벤트_무료체험', count: 2 },
          ],
          aiVsAgentData: [
            { name: 'AI 자동', value: 12 },
            { name: 'AI 보조', value: 3 },
            { name: '상담원', value: 0 },
          ],
          dailyTrend: [
            { date: '10/05', ai: 18, agent: 2 },
            { date: '10/06', ai: 22, agent: 3 },
            { date: '10/07', ai: 19, agent: 1 },
            { date: '10/08', ai: 25, agent: 2 },
            { date: '10/09', ai: 21, agent: 3 },
            { date: '10/10', ai: 23, agent: 1 },
            { date: '10/11', ai: 20, agent: 2 },
          ],
        },
        conversations: [
          {
            id: '1',
            userName: '크라운 753',
            mediumName: 'appKakao',
            tags: ['프로모션이벤트_무료체험'],
            firstOpenedAt: '2025-01-07T10:06:12Z',
            aiAutoChats: 3,
            agentChats: 0,
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!data || !data.conversations) return;
    
    const csv = [
      ['회원명', '채널', '주제', '시간', 'AI 응답', '상담원 응답'],
      ...data.conversations.map(c => [
        c.userName,
        c.mediumName,
        c.tags[0] || '',
        new Date(c.firstOpenedAt).toLocaleString(),
        c.aiAutoChats,
        c.agentChats
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `stats_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-indigo-600 mb-4"></div>
          <p className="text-gray-600">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">데이터 로드 실패</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // 데이터가 완전히 비어있는 경우
  if (data && data.stats.total === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          {/* 헤더 */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">상담 통계</h1>
            <p className="text-gray-500">실시간 고객 상담 분석 대시보드</p>
          </div>

          {/* Empty State */}
          <div className="bg-white rounded-2xl p-12 shadow-lg border border-gray-50 text-center">
            <div className="max-w-md mx-auto">
              <div className="text-gray-300 text-8xl mb-6">📊</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">아직 상담 데이터가 없습니다</h2>
              <p className="text-gray-500 mb-6">
                고객과의 첫 상담이 시작되면 여기에 통계가 표시됩니다.<br/>
                CS 자동화 시스템이 대화를 분석하고 인사이트를 제공합니다.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={fetchData}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
                >
                  새로고침
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">상담 통계</h1>
          <p className="text-gray-500">실시간 고객 상담 분석 대시보드</p>
        </div>

        {/* 필터 & 액션 */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex gap-2 bg-white rounded-xl p-1 shadow-md">
            {['7d', '30d', '90d'].map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  dateRange === range
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {range === '7d' ? '최근 7일' : range === '30d' ? '최근 30일' : '최근 90일'}
              </button>
            ))}
          </div>
          
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <Download size={18} />
            <span className="text-sm font-medium">엑셀 내보내기</span>
          </button>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="총 상담 수"
            value={data.stats.total}
            icon={MessageSquare}
            color={COLORS.primary}
            subtitle="전체 대화"
          />
          <StatCard
            title="AI 자동응답률"
            value={`${data.stats.aiAutoRate}%`}
            icon={Zap}
            color={COLORS.success}
            subtitle="자동 처리 비율"
          />
          <StatCard
            title="평균 응답시간"
            value={`${data.stats.avgResponseTime}초`}
            icon={TrendingUp}
            color={COLORS.info}
            subtitle="첫 응답 기준"
          />
          <StatCard
            title="상담원 개입"
            value={data.stats.agentMessages}
            icon={Users}
            color={COLORS.warning}
            subtitle="수동 처리"
          />
        </div>

        {/* 차트 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 유입 경로 */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-50">
            <h3 className="text-lg font-bold text-gray-900 mb-4">유입 경로별 상담</h3>
            {data.chartData.mediumData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.chartData.mediumData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="count" 
                    fill={COLORS.primary}
                    radius={[8, 8, 0, 0]}
                    maxBarSize={50}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-gray-300 text-5xl mb-3">📊</div>
                  <p className="text-gray-400 text-sm">데이터가 없습니다</p>
                </div>
              </div>
            )}
          </div>

          {/* AI vs 상담원 */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-50">
            <h3 className="text-lg font-bold text-gray-900 mb-4">응답 유형 분포</h3>
            {data.chartData.aiVsAgentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={data.chartData.aiVsAgentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {data.chartData.aiVsAgentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => <span className="text-sm text-gray-700">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-gray-300 text-5xl mb-3">📈</div>
                  <p className="text-gray-400 text-sm">데이터가 없습니다</p>
                </div>
              </div>
            )}
          </div>

          {/* 일별 트렌드 */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-50 lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-900 mb-4">일별 상담 추이</h3>
            {data.chartData.dailyTrend && data.chartData.dailyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.chartData.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="top"
                    height={36}
                    formatter={(value) => <span className="text-sm text-gray-700">{value}</span>}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="ai" 
                    stroke={COLORS.primary}
                    strokeWidth={3}
                    dot={{ r: 4, fill: COLORS.primary }}
                    name="AI 응답"
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="agent" 
                    stroke={COLORS.warning}
                    strokeWidth={3}
                    dot={{ r: 4, fill: COLORS.warning }}
                    name="상담원 응답"
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-gray-300 text-5xl mb-3">📉</div>
                  <p className="text-gray-400 text-sm">일별 데이터가 없습니다</p>
                </div>
              </div>
            )}
          </div>

          {/* 상담 주제 */}
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-50 lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-900 mb-4">주요 상담 주제</h3>
            {data.chartData.tagData.length > 0 ? (
              <div className="space-y-4">
                {data.chartData.tagData.map((tag, index) => {
                  const maxCount = Math.max(...data.chartData.tagData.map(t => t.count));
                  const percentage = (tag.count / maxCount) * 100;
                  return (
                    <div key={index}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">{tag.name}</span>
                        <span className="text-sm font-bold text-gray-900">{tag.count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            background: `linear-gradient(90deg, ${CHART_COLORS[index % CHART_COLORS.length]}, ${CHART_COLORS[(index + 1) % CHART_COLORS.length]})`
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-gray-300 text-5xl mb-3">🏷️</div>
                  <p className="text-gray-400 text-sm">상담 주제 데이터가 없습니다</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 최근 상담 테이블 */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-50">
          <h3 className="text-lg font-bold text-gray-900 mb-4">최근 상담 내역</h3>
          {data.conversations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">회원명</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">채널</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">주제</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">시간</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">응답</th>
                  </tr>
                </thead>
                <tbody>
                  {data.conversations.map((conv, index) => (
                    <tr key={index} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-sm text-gray-900">{conv.userName}</td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                          {conv.mediumName === 'appKakao' ? '카카오' : conv.mediumName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {conv.tags[0] || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {new Date(conv.firstOpenedAt).toLocaleString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          conv.agentChats > 0 
                            ? 'bg-orange-50 text-orange-700' 
                            : 'bg-green-50 text-green-700'
                        }`}>
                          {conv.agentChats > 0 ? '상담원' : 'AI 자동'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="text-gray-300 text-6xl mb-4">💬</div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">상담 내역이 없습니다</h4>
              <p className="text-gray-500 text-sm">첫 고객 상담이 시작되면 여기에 표시됩니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}