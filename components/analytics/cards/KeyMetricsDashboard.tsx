import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Patient, Unit } from '../../../types';
import AnalyticsCard from '../AnalyticsCard';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

interface KeyMetricsDashboardProps {
  deceasedPatients: Patient[];
  allPatients?: Patient[];
  timeRangeLabel?: string;
}

const KeyMetricsDashboard: React.FC<KeyMetricsDashboardProps> = ({
  deceasedPatients,
  allPatients = [],
  timeRangeLabel = 'Selected Period'
}) => {
  // Calculate key metrics
  const metrics = useMemo(() => {
    const totalDeaths = deceasedPatients.length;
    const totalAdmissions = allPatients.length;
    const mortalityRate = totalAdmissions > 0 ? ((totalDeaths / totalAdmissions) * 100) : 0;

    // Average time to death (in hours)
    let avgTimeToDeath = 0;
    let timeToDeathCount = 0;
    deceasedPatients.forEach(p => {
      if (p.dateOfDeath && p.admissionDate) {
        const hours = (new Date(p.dateOfDeath).getTime() - new Date(p.admissionDate).getTime()) / (1000 * 60 * 60);
        if (hours >= 0) {
          avgTimeToDeath += hours;
          timeToDeathCount++;
        }
      }
    });
    avgTimeToDeath = timeToDeathCount > 0 ? avgTimeToDeath / timeToDeathCount : 0;

    // Average age at death
    let avgAge = 0;
    deceasedPatients.forEach(p => {
      let ageInDays = p.age || 0;
      switch (p.ageUnit) {
        case 'weeks': ageInDays *= 7; break;
        case 'months': ageInDays *= 30; break;
        case 'years': ageInDays *= 365; break;
      }
      avgAge += ageInDays;
    });
    avgAge = totalDeaths > 0 ? avgAge / totalDeaths : 0;

    // AI diagnosis coverage
    const aiDiagnosed = deceasedPatients.filter(p => p.aiInterpretedDeathDiagnosis).length;
    const aiCoverage = totalDeaths > 0 ? ((aiDiagnosed / totalDeaths) * 100) : 0;

    // Early deaths (<24h)
    const earlyDeaths = deceasedPatients.filter(p => {
      if (!p.dateOfDeath || !p.admissionDate) return false;
      const hours = (new Date(p.dateOfDeath).getTime() - new Date(p.admissionDate).getTime()) / (1000 * 60 * 60);
      return hours < 24;
    }).length;
    const earlyDeathRate = totalDeaths > 0 ? ((earlyDeaths / totalDeaths) * 100) : 0;

    // Unit breakdown
    const unitBreakdown = Object.values(Unit).map(unit => ({
      unit,
      short: unit.includes('Neonatal') ? 'NICU' :
             unit.includes('Pediatric') ? 'PICU' :
             unit.includes('Special') ? 'SNCU' :
             unit.includes('High') ? 'HDU' : 'GW',
      deaths: deceasedPatients.filter(p => p.unit === unit).length,
      admissions: allPatients.filter(p => p.unit === unit).length
    })).filter(u => u.admissions > 0);

    // Gender breakdown
    const maleDeaths = deceasedPatients.filter(p => p.gender === 'Male').length;
    const femaleDeaths = deceasedPatients.filter(p => p.gender === 'Female').length;

    // Monthly trend (mini sparkline)
    const monthlyTrend: { month: string; deaths: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const deaths = deceasedPatients.filter(p => {
        const deathDate = new Date(p.dateOfDeath || p.releaseDate || p.admissionDate);
        return deathDate.getFullYear() === d.getFullYear() &&
               deathDate.getMonth() === d.getMonth();
      }).length;
      monthlyTrend.push({
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        deaths
      });
    }

    return {
      totalDeaths,
      totalAdmissions,
      mortalityRate,
      avgTimeToDeath,
      avgAge,
      aiCoverage,
      aiDiagnosed,
      earlyDeaths,
      earlyDeathRate,
      unitBreakdown,
      maleDeaths,
      femaleDeaths,
      monthlyTrend
    };
  }, [deceasedPatients, allPatients]);

  // Format time duration
  const formatDuration = (hours: number) => {
    if (hours < 24) return `${Math.round(hours)}h`;
    if (hours < 168) return `${(hours / 24).toFixed(1)}d`;
    return `${(hours / 168).toFixed(1)}w`;
  };

  // Format age
  const formatAge = (days: number) => {
    if (days < 1) return '<1 day';
    if (days < 7) return `${Math.round(days)} days`;
    if (days < 30) return `${(days / 7).toFixed(1)} weeks`;
    if (days < 365) return `${(days / 30).toFixed(1)} months`;
    return `${(days / 365).toFixed(1)} years`;
  };

  const MetricCard = ({
    title,
    value,
    subtitle,
    icon,
    gradient,
    trend,
    trendLabel
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    gradient: string;
    trend?: 'up' | 'down' | 'neutral';
    trendLabel?: string;
  }) => (
    <div className={`bg-gradient-to-br ${gradient} rounded-xl p-3 text-white`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-xs font-medium opacity-80 mb-0.5">{title}</div>
          <div className="text-2xl font-bold">{value}</div>
          {subtitle && <div className="text-[10px] opacity-70 mt-0.5">{subtitle}</div>}
        </div>
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
          {icon}
        </div>
      </div>
      {trendLabel && (
        <div className="mt-2 flex items-center gap-1 text-[10px]">
          {trend === 'up' && <span>↑</span>}
          {trend === 'down' && <span>↓</span>}
          <span className="opacity-80">{trendLabel}</span>
        </div>
      )}
    </div>
  );

  return (
    <AnalyticsCard
      title="Key Metrics Dashboard"
      subtitle={timeRangeLabel}
      headerGradient="from-emerald-500 to-teal-600"
      icon={
        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      }
    >
      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <MetricCard
          title="Total Deaths"
          value={metrics.totalDeaths}
          subtitle={`of ${metrics.totalAdmissions} admissions`}
          gradient="from-red-500 to-rose-600"
          icon={<span className="text-white text-lg">💔</span>}
        />
        <MetricCard
          title="Mortality Rate"
          value={`${metrics.mortalityRate.toFixed(1)}%`}
          subtitle="overall rate"
          gradient="from-orange-500 to-amber-600"
          icon={<span className="text-white text-lg">📊</span>}
        />
        <MetricCard
          title="Avg Time to Death"
          value={formatDuration(metrics.avgTimeToDeath)}
          subtitle="from admission"
          gradient="from-blue-500 to-indigo-600"
          icon={<span className="text-white text-lg">⏱️</span>}
        />
        <MetricCard
          title="Early Deaths"
          value={`${metrics.earlyDeathRate.toFixed(0)}%`}
          subtitle={`${metrics.earlyDeaths} within 24h`}
          gradient="from-purple-500 to-violet-600"
          icon={<span className="text-white text-lg">⚠️</span>}
        />
      </div>

      {/* Mini Sparkline */}
      <div className="bg-slate-50 rounded-xl p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-slate-700">6-Month Trend</div>
          <div className="text-[10px] text-slate-500">Deaths per month</div>
        </div>
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.monthlyTrend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white px-2 py-1 rounded shadow text-xs">
                        <span className="font-semibold">{payload[0].payload.month}:</span> {payload[0].value} deaths
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="deaths"
                stroke="#ef4444"
                fill="#fee2e2"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between mt-1">
          {metrics.monthlyTrend.map((m, i) => (
            <div key={i} className="text-[9px] text-slate-400">{m.month}</div>
          ))}
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-200">
          <div className="text-lg font-bold text-emerald-600">{metrics.aiCoverage.toFixed(0)}%</div>
          <div className="text-[10px] text-slate-600">AI Coverage</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 text-center border border-blue-200">
          <div className="text-lg font-bold text-blue-600">{formatAge(metrics.avgAge)}</div>
          <div className="text-[10px] text-slate-600">Avg Age</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-2 text-center border border-purple-200">
          <div className="text-lg font-bold text-purple-600">
            {metrics.maleDeaths}/{metrics.femaleDeaths}
          </div>
          <div className="text-[10px] text-slate-600">M/F Ratio</div>
        </div>
      </div>

      {/* Unit Breakdown */}
      <div className="border-t border-slate-100 pt-3">
        <div className="text-xs font-semibold text-slate-700 mb-2">Unit Breakdown</div>
        <div className="space-y-2">
          {metrics.unitBreakdown.map((unit, i) => {
            const rate = unit.admissions > 0 ? ((unit.deaths / unit.admissions) * 100) : 0;
            return (
              <div key={i} className="flex items-center gap-2">
                <div className="w-12 text-xs font-medium text-slate-600">{unit.short}</div>
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${rate}%`,
                      backgroundColor: rate > 20 ? '#ef4444' :
                                       rate > 15 ? '#f97316' :
                                       rate > 10 ? '#eab308' : '#22c55e'
                    }}
                  />
                </div>
                <div className="w-16 text-right">
                  <span className="text-xs font-bold" style={{
                    color: rate > 20 ? '#ef4444' :
                           rate > 15 ? '#f97316' :
                           rate > 10 ? '#eab308' : '#22c55e'
                  }}>
                    {rate.toFixed(1)}%
                  </span>
                </div>
                <div className="w-10 text-right text-[10px] text-slate-400">
                  {unit.deaths}/{unit.admissions}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gender Distribution */}
      <div className="mt-4 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-xs text-slate-600">Male: {metrics.maleDeaths}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-pink-500"></div>
          <span className="text-xs text-slate-600">Female: {metrics.femaleDeaths}</span>
        </div>
      </div>
    </AnalyticsCard>
  );
};

export default KeyMetricsDashboard;
