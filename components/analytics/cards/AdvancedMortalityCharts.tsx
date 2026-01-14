import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Patient, Unit } from '../../../types';
import AnalyticsCard from '../AnalyticsCard';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  AreaChart,
  Area,
  ComposedChart,
  Cell,
  Legend
} from 'recharts';
import { haptics } from '../../../utils/haptics';

interface AdvancedMortalityChartsProps {
  deceasedPatients: Patient[];
  allPatients?: Patient[];
}

type ChartView = 'hourly' | 'dayOfWeek' | 'ageGroup' | 'survival' | 'comparison';

const COLORS = {
  primary: '#3b82f6',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
  purple: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
  orange: '#f97316',
};

const AdvancedMortalityCharts: React.FC<AdvancedMortalityChartsProps> = ({
  deceasedPatients,
  allPatients = []
}) => {
  const [activeView, setActiveView] = useState<ChartView>('hourly');

  // Hour of Death Distribution
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${i.toString().padStart(2, '0')}:00`,
      shortLabel: i.toString().padStart(2, '0'),
      deaths: 0,
      shift: i >= 6 && i < 14 ? 'Morning' : i >= 14 && i < 22 ? 'Evening' : 'Night'
    }));

    deceasedPatients.forEach(p => {
      if (p.dateOfDeath) {
        const hour = new Date(p.dateOfDeath).getHours();
        hours[hour].deaths++;
      }
    });

    return hours;
  }, [deceasedPatients]);

  // Day of Week Distribution
  const dayOfWeekData = useMemo(() => {
    const days = [
      { day: 0, name: 'Sunday', short: 'Sun', deaths: 0 },
      { day: 1, name: 'Monday', short: 'Mon', deaths: 0 },
      { day: 2, name: 'Tuesday', short: 'Tue', deaths: 0 },
      { day: 3, name: 'Wednesday', short: 'Wed', deaths: 0 },
      { day: 4, name: 'Thursday', short: 'Thu', deaths: 0 },
      { day: 5, name: 'Friday', short: 'Fri', deaths: 0 },
      { day: 6, name: 'Saturday', short: 'Sat', deaths: 0 },
    ];

    deceasedPatients.forEach(p => {
      if (p.dateOfDeath) {
        const dayIndex = new Date(p.dateOfDeath).getDay();
        days[dayIndex].deaths++;
      }
    });

    return days;
  }, [deceasedPatients]);

  // Age Group Distribution with Mortality Rate
  const ageGroupData = useMemo(() => {
    const groups = [
      { name: '0-24h', min: 0, max: 1, deaths: 0, admissions: 0, label: '<24h' },
      { name: '1-7 days', min: 1, max: 7, deaths: 0, admissions: 0, label: '1-7d' },
      { name: '8-28 days', min: 8, max: 28, deaths: 0, admissions: 0, label: '8-28d' },
      { name: '1-6 months', min: 29, max: 180, deaths: 0, admissions: 0, label: '1-6mo' },
      { name: '6-12 months', min: 181, max: 365, deaths: 0, admissions: 0, label: '6-12mo' },
      { name: '1-5 years', min: 366, max: 1825, deaths: 0, admissions: 0, label: '1-5yr' },
      { name: '>5 years', min: 1826, max: Infinity, deaths: 0, admissions: 0, label: '>5yr' },
    ];

    const getAgeInDays = (patient: Patient) => {
      const age = patient.age || 0;
      switch (patient.ageUnit) {
        case 'days': return age;
        case 'weeks': return age * 7;
        case 'months': return age * 30;
        case 'years': return age * 365;
        default: return age;
      }
    };

    deceasedPatients.forEach(p => {
      const ageInDays = getAgeInDays(p);
      const group = groups.find(g => ageInDays >= g.min && ageInDays <= g.max);
      if (group) group.deaths++;
    });

    allPatients.forEach(p => {
      const ageInDays = getAgeInDays(p);
      const group = groups.find(g => ageInDays >= g.min && ageInDays <= g.max);
      if (group) group.admissions++;
    });

    return groups.map(g => ({
      ...g,
      mortalityRate: g.admissions > 0 ? ((g.deaths / g.admissions) * 100).toFixed(1) : '0'
    }));
  }, [deceasedPatients, allPatients]);

  // Survival Time Analysis (Hours from admission to death)
  const survivalData = useMemo(() => {
    const bins = [
      { name: '<6h', min: 0, max: 6, count: 0, label: '<6 hours' },
      { name: '6-12h', min: 6, max: 12, count: 0, label: '6-12 hours' },
      { name: '12-24h', min: 12, max: 24, count: 0, label: '12-24 hours' },
      { name: '1-3d', min: 24, max: 72, count: 0, label: '1-3 days' },
      { name: '3-7d', min: 72, max: 168, count: 0, label: '3-7 days' },
      { name: '1-2w', min: 168, max: 336, count: 0, label: '1-2 weeks' },
      { name: '2-4w', min: 336, max: 672, count: 0, label: '2-4 weeks' },
      { name: '>4w', min: 672, max: Infinity, count: 0, label: '>4 weeks' },
    ];

    deceasedPatients.forEach(p => {
      if (p.dateOfDeath && p.admissionDate) {
        const hours = (new Date(p.dateOfDeath).getTime() - new Date(p.admissionDate).getTime()) / (1000 * 60 * 60);
        const bin = bins.find(b => hours >= b.min && hours < b.max);
        if (bin) bin.count++;
      }
    });

    // Calculate cumulative survival
    let cumulative = deceasedPatients.length;
    return bins.map(b => {
      cumulative -= b.count;
      return {
        ...b,
        cumulative,
        percentage: deceasedPatients.length > 0 ? ((b.count / deceasedPatients.length) * 100).toFixed(1) : '0'
      };
    });
  }, [deceasedPatients]);

  // Month over Month Comparison
  const comparisonData = useMemo(() => {
    const monthlyData: { [key: string]: { deaths: number; admissions: number } } = {};

    // Get last 12 months
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = { deaths: 0, admissions: 0 };
    }

    deceasedPatients.forEach(p => {
      const date = new Date(p.dateOfDeath || p.releaseDate || p.admissionDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) {
        monthlyData[key].deaths++;
      }
    });

    allPatients.forEach(p => {
      const date = new Date(p.admissionDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) {
        monthlyData[key].admissions++;
      }
    });

    return Object.entries(monthlyData).map(([key, data]) => {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        fullMonth: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        deaths: data.deaths,
        admissions: data.admissions,
        mortalityRate: data.admissions > 0 ? ((data.deaths / data.admissions) * 100).toFixed(1) : '0'
      };
    });
  }, [deceasedPatients, allPatients]);

  // Shift-wise Summary
  const shiftSummary = useMemo(() => {
    const shifts = {
      Morning: { name: 'Morning (6AM-2PM)', count: 0, color: COLORS.warning },
      Evening: { name: 'Evening (2PM-10PM)', count: 0, color: COLORS.purple },
      Night: { name: 'Night (10PM-6AM)', count: 0, color: COLORS.primary },
    };

    hourlyData.forEach(h => {
      shifts[h.shift as keyof typeof shifts].count += h.deaths;
    });

    return Object.values(shifts);
  }, [hourlyData]);

  // Key insights
  const insights = useMemo(() => {
    const peakHour = hourlyData.reduce((max, h) => h.deaths > max.deaths ? h : max, hourlyData[0]);
    const peakDay = dayOfWeekData.reduce((max, d) => d.deaths > max.deaths ? d : max, dayOfWeekData[0]);
    const highestMortalityAge = ageGroupData.reduce((max, g) =>
      parseFloat(g.mortalityRate) > parseFloat(max.mortalityRate) ? g : max, ageGroupData[0]);
    const earlyDeaths = survivalData.slice(0, 3).reduce((sum, s) => sum + s.count, 0);
    const earlyDeathPercent = deceasedPatients.length > 0
      ? ((earlyDeaths / deceasedPatients.length) * 100).toFixed(0) : '0';

    return {
      peakHour,
      peakDay,
      highestMortalityAge,
      earlyDeaths,
      earlyDeathPercent
    };
  }, [hourlyData, dayOfWeekData, ageGroupData, survivalData, deceasedPatients.length]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-xl border-2 border-slate-200 rounded-lg p-3 shadow-xl">
          <p className="text-slate-900 font-semibold">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="font-bold">
              {entry.name}: {entry.value}
              {entry.name === 'Mortality Rate' ? '%' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const tabs = [
    { id: 'hourly' as ChartView, label: 'Time', icon: '🕐' },
    { id: 'dayOfWeek' as ChartView, label: 'Day', icon: '📅' },
    { id: 'ageGroup' as ChartView, label: 'Age', icon: '👶' },
    { id: 'survival' as ChartView, label: 'Survival', icon: '⏱️' },
    { id: 'comparison' as ChartView, label: 'Trends', icon: '📈' },
  ];

  return (
    <AnalyticsCard
      title="Advanced Mortality Analytics"
      subtitle="Time patterns & risk analysis"
      headerGradient="from-rose-600 to-red-700"
      icon={
        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      }
    >
      {/* Tab Navigation */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              haptics.selection();
              setActiveView(tab.id);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeView === tab.id
                ? 'bg-rose-600 text-white shadow-lg'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Chart Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeView === 'hourly' && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Hour of Death Distribution</h3>
              <p className="text-xs text-slate-500 mb-3">When do most deaths occur during the day?</p>

              <div className="h-48 sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis
                      dataKey="shortLabel"
                      tick={{ fontSize: 9 }}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="deaths" radius={[4, 4, 0, 0]}>
                      {hourlyData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.shift === 'Night' ? COLORS.primary :
                                entry.shift === 'Morning' ? COLORS.warning : COLORS.purple}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Shift Summary */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                {shiftSummary.map((shift, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold" style={{ color: shift.color }}>{shift.count}</div>
                    <div className="text-[10px] text-slate-600">{shift.name.split(' ')[0]}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'dayOfWeek' && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Day of Week Distribution</h3>
              <p className="text-xs text-slate-500 mb-3">Which days have higher mortality?</p>

              <div className="h-48 sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayOfWeekData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="short" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="deaths" fill={COLORS.danger} radius={[4, 4, 0, 0]}>
                      {dayOfWeekData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.day === 0 || entry.day === 6 ? COLORS.purple : COLORS.danger}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 bg-amber-50 rounded-lg p-3 border border-amber-200">
                <div className="flex items-center gap-2">
                  <span className="text-amber-600 text-lg">⚡</span>
                  <div>
                    <div className="text-xs font-semibold text-amber-800">Peak Day: {insights.peakDay.name}</div>
                    <div className="text-[10px] text-amber-600">{insights.peakDay.deaths} deaths recorded</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'ageGroup' && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Age Group Mortality Analysis</h3>
              <p className="text-xs text-slate-500 mb-3">Deaths and mortality rate by age</p>

              <div className="h-52 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={ageGroupData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar yAxisId="left" dataKey="deaths" name="Deaths" fill={COLORS.danger} radius={[4, 4, 0, 0]} />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="mortalityRate"
                      name="Mortality Rate"
                      stroke={COLORS.purple}
                      strokeWidth={3}
                      dot={{ fill: COLORS.purple, r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 bg-rose-50 rounded-lg p-3 border border-rose-200">
                <div className="flex items-center gap-2">
                  <span className="text-rose-600 text-lg">🎯</span>
                  <div>
                    <div className="text-xs font-semibold text-rose-800">
                      Highest Risk: {insights.highestMortalityAge.name}
                    </div>
                    <div className="text-[10px] text-rose-600">
                      {insights.highestMortalityAge.mortalityRate}% mortality rate
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'survival' && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Time to Death Analysis</h3>
              <p className="text-xs text-slate-500 mb-3">Duration from admission to death</p>

              <div className="h-48 sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={survivalData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Deaths"
                      stroke={COLORS.danger}
                      fill={COLORS.danger}
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Early Death Alert */}
              <div className="mt-4 bg-red-50 rounded-lg p-3 border border-red-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-red-600 text-lg">⚠️</span>
                    <div>
                      <div className="text-xs font-semibold text-red-800">Early Deaths (&lt;24h)</div>
                      <div className="text-[10px] text-red-600">Critical observation period</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-red-600">{insights.earlyDeathPercent}%</div>
                    <div className="text-[10px] text-red-500">{insights.earlyDeaths} patients</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'comparison' && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Monthly Mortality Trends</h3>
              <p className="text-xs text-slate-500 mb-3">12-month comparison with mortality rate</p>

              <div className="h-52 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={comparisonData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="month" tick={{ fontSize: 9 }} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar yAxisId="left" dataKey="deaths" name="Deaths" fill={COLORS.danger} radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="admissions" name="Admissions" fill={COLORS.success} radius={[4, 4, 0, 0]} opacity={0.5} />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="mortalityRate"
                      name="Mortality Rate"
                      stroke={COLORS.purple}
                      strokeWidth={2}
                      dot={{ fill: COLORS.purple, r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Trend Summary */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="bg-red-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-red-600">
                    {comparisonData.reduce((sum, d) => sum + d.deaths, 0)}
                  </div>
                  <div className="text-[10px] text-slate-600">Total Deaths</div>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-green-600">
                    {comparisonData.reduce((sum, d) => sum + d.admissions, 0)}
                  </div>
                  <div className="text-[10px] text-slate-600">Admissions</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-purple-600">
                    {comparisonData.length > 0
                      ? (comparisonData.reduce((sum, d) => sum + parseFloat(d.mortalityRate), 0) / comparisonData.length).toFixed(1)
                      : '0'}%
                  </div>
                  <div className="text-[10px] text-slate-600">Avg Rate</div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Key Insights Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <div className="text-[10px] text-slate-500 font-medium mb-2">KEY INSIGHTS</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-50 rounded-lg p-2">
            <div className="text-[10px] text-blue-600 font-medium">Peak Hour</div>
            <div className="text-sm font-bold text-blue-800">{insights.peakHour.label}</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-2">
            <div className="text-[10px] text-purple-600 font-medium">Peak Day</div>
            <div className="text-sm font-bold text-purple-800">{insights.peakDay.name}</div>
          </div>
        </div>
      </div>
    </AnalyticsCard>
  );
};

export default AdvancedMortalityCharts;
