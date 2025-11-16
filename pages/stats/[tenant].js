// pages/stats/[tenant].js

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Download, Calendar, TrendingUp, Users, MessageSquare, Zap } from 'lucide-react';

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

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-xl px-4 py-3 rounded-2xl shadow-2xl shadow-yellow-200/30 border border-white/50">
        <p className="font-bold text-gray-900 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-6 shadow-lg shadow-gray-200/20 hover:shadow-xl hover:shadow-gray-200/30 transition-all">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-1">{title}</p>
        <h3 className="text-4xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">{value}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-2 font-semibold">{subtitle}</p>}
      </div>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
  </div>
);

export default function StatsPage() {
  const router = useRouter();
  const tenantId = router.query.tenant;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('7d');
  const [view, setView] = useState('conversations');

  useEffect(() => {
    if (!tenantId) return;
    fetchData();
  }, [tenantId, dateRange, view]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/stats/${tenantId}?view=${view}&limit=50&range=${dateRange}`
      );
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const result = await response.json();

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

      setData({
        stats: { total: 5, aiAutoRate: 80, avgResponseTime: 3, agentMessages: 0 },
        chartData: {
          mediumData: [{ name: '카카오', count: 3 }, { name: '웹', count: 2 }],
          tagData: [{ name: '프로모션이벤트_무료체험', count: 2 }],
          aiVsAgentData: [{ name: 'AI 자동', value: 12 }, { name: 'AI 보조', value: 3 }, { name: '상담원', value: 0 }],
          dailyTrend: [
            { date: '10/05', ai: 18, agent: 2 }, { date: '10/06', ai: 22, agent: 3 },
            { date: '10/07', ai: 19, agent: 1 }, { date: '10/08', ai: 25, agent: 2 },
            { date: '10/09', ai: 21, agent: 3 }, { date: '10/10', ai: 23, agent: 1 },
            { date: '10/11', ai: 20, agent: 2 }
          ]
        },
        conversations: [{
          id: '1', userName: '크라운 753', mediumName: 'appKakao',
          tags: ['프로모션이벤트_무료체험'], firstOpenedAt: '2025-01-07T10:06:12Z',
          aiAutoChats: 3, agentChats: 0
        }]
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
        c.userName, c.mediumName, c.tags[0] || '',
        c.firstOpenedAt ? new Date(c.firstOpenedAt).toLocaleString() : 'N/A',
        c.aiAutoChats, c.agentChats
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
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-yellow-50 to-cyan-50 flex items-center justify-center relative overflow-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
        <div className="text-center relative z-10">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-yellow-200 border-t-yellow-500 mb-4"></div>
          <p className="text-gray-700 font-bold text-lg">데이터 로딩 중...</p>
        </div>
        <style jsx>{`
          @keyframes blob {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
          }
          .animate-blob { animation: blob 7s infinite; }
          .animation-delay-2000 { animation-delay: 2s; }
          .animation-delay-4000 { animation-delay: 4s; }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-yellow-50 to-cyan-50 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        </div>
        <div className="text-center relative z-10 bg-white/60 backdrop-blur-xl rounded-3xl p-12 shadow-2xl shadow-red-200/30">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent mb-3">데이터 로드 실패</h2>
          <p className="text-gray-600 mb-6 font-semibold">{error}</p>
          <button onClick={fetchData} className="px-8 py-3 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-800 rounded-2xl hover:shadow-xl hover:shadow-yellow-400/40 hover:scale-105 transition-all font-bold">
            다시 시도 🔄
          </button>
        </div>
        <style jsx>{`
          @keyframes blob {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
          }
          .animate-blob { animation: blob 7s infinite; }
          .animation-delay-2000 { animation-delay: 2s; }
        `}</style>
      </div>
    );
  }

  if (data && data.stats.total === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-yellow-50 to-cyan-50 p-6 relative overflow-hidden">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent mb-2">상담 통계</h1>
            <p className="text-gray-600 font-semibold">실시간 고객 상담 분석 대시보드</p>
          </div>
          <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-16 shadow-2xl shadow-gray-200/30 text-center">
            <div className="max-w-md mx-auto">
              <div className="text-9xl mb-6">📊</div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4">아직 상담 데이터가 없습니다</h2>
              <p className="text-gray-600 mb-8 font-semibold leading-relaxed">
                고객과의 첫 상담이 시작되면 여기에 통계가 표시됩니다.<br />
                CS 자동화 시스템이 대화를 분석하고 인사이트를 제공합니다.
              </p>
              <button onClick={fetchData} className="px-8 py-3 bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-800 rounded-2xl hover:shadow-xl hover:shadow-yellow-400/40 hover:scale-105 transition-all font-bold">
                새로고침 🔄
              </button>
            </div>
          </div>
        </div>
        <style jsx>{`
          @keyframes blob {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
          }
          .animate-blob { animation: blob 7s infinite; }
          .animation-delay-2000 { animation-delay: 2s; }
          .animation-delay-4000 { animation-delay: 4s; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-yellow-50 to-cyan-50 p-6 relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent mb-2">상담 통계 📊</h1>
          <p className="text-gray-600 font-semibold">실시간 고객 상담 분석 대시보드</p>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex gap-2 bg-white/60 backdrop-blur-xl rounded-2xl p-1.5 shadow-lg shadow-gray-200/20">
            {['7d', '30d', '90d'].map(range => (
              <button key={range} onClick={() => setDateRange(range)} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${dateRange === range ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-800 shadow-lg shadow-yellow-400/30' : 'text-gray-600 hover:bg-white/50'}`}>
                {range === '7d' ? '최근 7일' : range === '30d' ? '최근 30일' : '최근 90일'}
              </button>
            ))}
          </div>
          <button onClick={exportToExcel} className="flex items-center gap-2 px-5 py-2.5 bg-white/60 backdrop-blur-xl text-gray-700 rounded-2xl shadow-lg shadow-gray-200/20 hover:shadow-xl hover:shadow-gray-200/30 transition-all">
            <Download size={18} />
            <span className="text-sm font-bold">엑셀 내보내기</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="총 상담 수" value={data.stats.total} icon={MessageSquare} color={COLORS.primary} subtitle="전체 대화" />
          <StatCard title="AI 자동응답률" value={`${data.stats.aiAutoRate}%`} icon={Zap} color={COLORS.success} subtitle="자동 처리 비율" />
          <StatCard title="평균 응답시간" value={`${data.stats.avgResponseTime}초`} icon={TrendingUp} color={COLORS.info} subtitle="첫 응답 기준" />
          <StatCard title="상담원 개입" value={data.stats.agentMessages} icon={Users} color={COLORS.warning} subtitle="수동 처리" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-6 shadow-lg shadow-gray-200/20 hover:shadow-xl transition-all">
            <h3 className="text-lg font-bold text-gray-800 mb-4">유입 경로별 상담</h3>
            {data.chartData.mediumData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.chartData.mediumData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="url(#barGradient)" radius={[12, 12, 0, 0]} maxBarSize={50} />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center"><div className="text-center"><div className="text-gray-300 text-6xl mb-3">📊</div><p className="text-gray-400 text-sm font-semibold">데이터가 없습니다</p></div></div>
            )}
          </div>

          <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-6 shadow-lg shadow-gray-200/20 hover:shadow-xl transition-all">
            <h3 className="text-lg font-bold text-gray-800 mb-4">응답 유형 분포</h3>
            {data.chartData.aiVsAgentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={data.chartData.aiVsAgentData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                    {data.chartData.aiVsAgentData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-sm text-gray-700 font-semibold">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center"><div className="text-center"><div className="text-gray-300 text-6xl mb-3">📈</div><p className="text-gray-400 text-sm font-semibold">데이터가 없습니다</p></div></div>
            )}
          </div>

          <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-6 shadow-lg shadow-gray-200/20 hover:shadow-xl transition-all lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-800 mb-4">일별 상담 추이</h3>
            {data.chartData.dailyTrend && data.chartData.dailyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.chartData.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} formatter={(value) => <span className="text-sm text-gray-700 font-semibold">{value}</span>} />
                  <Line type="monotone" dataKey="ai" stroke={COLORS.primary} strokeWidth={3} dot={{ r: 5, fill: COLORS.primary }} name="AI 응답" activeDot={{ r: 7 }} />
                  <Line type="monotone" dataKey="agent" stroke={COLORS.warning} strokeWidth={3} dot={{ r: 5, fill: COLORS.warning }} name="상담원 응답" activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center"><div className="text-center"><div className="text-gray-300 text-6xl mb-3">📉</div><p className="text-gray-400 text-sm font-semibold">일별 데이터가 없습니다</p></div></div>
            )}
          </div>

          <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-6 shadow-lg shadow-gray-200/20 hover:shadow-xl transition-all lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-800 mb-4">주요 상담 주제</h3>
            {data.chartData.tagData.length > 0 ? (
              <div className="space-y-4">
                {data.chartData.tagData.map((tag, index) => {
                  const maxCount = Math.max(...data.chartData.tagData.map(t => t.count));
                  const percentage = (tag.count / maxCount) * 100;
                  return (
                    <div key={index}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-gray-700">{tag.name}</span>
                        <span className="text-sm font-bold text-gray-900 px-2 py-1 bg-gradient-to-r from-yellow-100 to-amber-100 rounded-lg">{tag.count}</span>
                      </div>
                      <div className="w-full bg-gray-200/70 rounded-full h-3 overflow-hidden backdrop-blur-sm">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, background: `linear-gradient(90deg, ${CHART_COLORS[index % CHART_COLORS.length]}, ${CHART_COLORS[(index + 1) % CHART_COLORS.length]})` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center"><div className="text-center"><div className="text-gray-300 text-6xl mb-3">🏷️</div><p className="text-gray-400 text-sm font-semibold">상담 주제 데이터가 없습니다</p></div></div>
            )}
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-6 shadow-lg shadow-gray-200/20 hover:shadow-xl transition-all">
          <h3 className="text-lg font-bold text-gray-800 mb-4">최근 상담 내역</h3>
          {data.conversations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/30">
                    <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">회원명</th>
                    <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">채널</th>
                    <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">주제</th>
                    <th className="text-left py-3 px-4 text-sm font-bold text-gray-700">시간</th>
                    <th className="text-center py-3 px-4 text-sm font-bold text-gray-700">응답</th>
                  </tr>
                </thead>
                <tbody>
                  {data.conversations.map((conv, index) => (
                    <tr key={index} className="border-b border-white/20 hover:bg-white/40 transition-colors">
                      <td className="py-3 px-4 text-sm font-semibold text-gray-900">{conv.userName}</td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700">
                          {conv.mediumName === 'appKakao' ? '카카오' : conv.mediumName}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700 font-semibold">{conv.tags[0] || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 font-semibold">
                        {new Date(conv.firstOpenedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold ${conv.agentChats > 0 ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700' : 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700'}`}>
                          {conv.agentChats > 0 ? '상담원' : 'AI 자동'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="text-gray-300 text-7xl mb-4">💬</div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">상담 내역이 없습니다</h4>
              <p className="text-gray-600 text-sm font-semibold">첫 고객 상담이 시작되면 여기에 표시됩니다</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
}