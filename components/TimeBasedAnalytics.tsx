import React, { useMemo, useState } from 'react';
import { Patient } from '../types';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Cell, ComposedChart } from 'recharts';
import { DateFilterValue } from './DateFilter';
import NeolinkAIButton from './NeolinkAIButton';

interface TimeBasedAnalyticsProps {
  patients: Patient[];
  period: string;
  startDate?: string;
  endDate?: string;
}

const TimeBasedAnalytics: React.FC<TimeBasedAnalyticsProps> = ({ patients, period, startDate, endDate }) => {
  // Removed internal state for simple prop-driven behavior



  // Month-wise data based on selected range
  const monthWiseData = useMemo(() => {
    const months = [];
    const now = new Date();

    if (period === 'Custom' && startDate && endDate) {
      const sDate = new Date(startDate);
      const eDate = new Date(endDate);

      // Generate monthly data for custom range
      const current = new Date(sDate.getFullYear(), sDate.getMonth(), 1);
      const last = new Date(eDate.getFullYear(), eDate.getMonth(), 1);

      while (current <= last) {
        const monthName = current.toLocaleString('default', { month: 'short', year: '2-digit' });

        const monthPatients = patients.filter(p => {
          const admissionDate = new Date(p.admissionDate);
          return admissionDate.getFullYear() === current.getFullYear() &&
            admissionDate.getMonth() === current.getMonth();
        });

        months.push({
          month: monthName,
          admissions: monthPatients.length,
          discharged: monthPatients.filter(p => p.outcome === 'Discharged').length,
          referred: monthPatients.filter(p => p.outcome === 'Referred').length,
          deaths: monthPatients.filter(p => p.outcome === 'Deceased').length,
          inProgress: monthPatients.filter(p => p.outcome === 'In Progress').length
        });

        current.setMonth(current.getMonth() + 1);
      }

      return months;
    }

    const monthCount = (period === 'Last 3 Months' || period === '3months') ? 2 : (period === 'Last 6 Months' || period === '6months') ? 5 : 11;

    for (let i = monthCount; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleString('default', { month: 'short', year: '2-digit' });

      const monthPatients = patients.filter(p => {
        const admissionDate = new Date(p.admissionDate);
        return admissionDate.getFullYear() === date.getFullYear() &&
          admissionDate.getMonth() === date.getMonth();
      });

      months.push({
        month: monthName,
        admissions: monthPatients.length,
        discharged: monthPatients.filter(p => p.outcome === 'Discharged').length,
        referred: monthPatients.filter(p => p.outcome === 'Referred').length,
        deaths: monthPatients.filter(p => p.outcome === 'Deceased').length,
        inProgress: monthPatients.filter(p => p.outcome === 'In Progress').length
      });
    }

    return months;
  }, [patients, period, startDate, endDate]);

  // Day-wise data for short ranges
  const dayWiseData = useMemo(() => {
    const days = [];
    const now = new Date();

    if (period === 'Custom' && startDate && endDate) {
      const sDate = new Date(startDate);
      const eDate = new Date(endDate);
      const daysDiff = Math.floor((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24));

      // Only use daily data if range is 60 days or less
      if (daysDiff <= 60) {
        for (let i = 0; i <= daysDiff; i++) {
          const date = new Date(sDate);
          date.setDate(sDate.getDate() + i);
          date.setHours(0, 0, 0, 0);

          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);

          const dayPatients = patients.filter(p => {
            const admissionDate = new Date(p.admissionDate);
            return admissionDate >= date && admissionDate < nextDate;
          });

          days.push({
            day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            admissions: dayPatients.length,
            discharged: dayPatients.filter(p => p.outcome === 'Discharged').length,
            deaths: dayPatients.filter(p => p.outcome === 'Deceased').length
          });
        }

        return days;
      }

      return [];
    }

    // Determine how many days back to go.
    // 'Today' = 0
    // 'Last 7 Days' = 6
    // 'Last 30 Days' = 29
    const dayCount = (period === 'Today' || period === 'today') ? 0 :
      (period === 'Last 7 Days' || period === '7days' || period === 'This Week') ? 6 :
        (period === 'Last 30 Days' || period === '30days' || period === 'This Month') ? 29 : -1;

    // If dayCount is -1, it means the selected range isn't supported by this view (e.g. months/years)
    if (dayCount === -1) return [];

    for (let i = dayCount; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayPatients = patients.filter(p => {
        const admissionDate = new Date(p.admissionDate);
        return admissionDate >= date && admissionDate < nextDate;
      });

      days.push({
        day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        admissions: dayPatients.length,
        discharged: dayPatients.filter(p => p.outcome === 'Discharged').length,
        deaths: dayPatients.filter(p => p.outcome === 'Deceased').length
      });
    }

    return days;
  }, [patients, period, startDate, endDate]);

  // Year-wise data for all-time view
  const yearWiseData = useMemo(() => {
    if (period !== 'All Time' && period !== 'all') return [];

    const years = new Map<number, { admissions: number; discharged: number; referred: number; deaths: number }>();

    patients.forEach(p => {
      const year = new Date(p.admissionDate).getFullYear();
      if (!years.has(year)) {
        years.set(year, { admissions: 0, discharged: 0, referred: 0, deaths: 0 });
      }
      const yearData = years.get(year)!;
      yearData.admissions++;
      if (p.outcome === 'Discharged') yearData.discharged++;
      if (p.outcome === 'Referred') yearData.referred++;
      if (p.outcome === 'Deceased') yearData.deaths++;
    });

    return Array.from(years.entries())
      .map(([year, data]) => ({ year: year.toString(), ...data }))
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));
  }, [patients, period]);

  // Diagnosis Distribution
  const diagnosisData = useMemo(() => {
    const diagnosisCounts: { [key: string]: number } = {};
    patients.forEach(p => {
      const diagnosis = p.diagnosis || 'Unknown';
      diagnosisCounts[diagnosis] = (diagnosisCounts[diagnosis] || 0) + 1;
    });

    return Object.entries(diagnosisCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [patients]);

  // Length of Stay Histogram
  const lengthOfStayData = useMemo(() => {
    const ranges = [
      { range: '0-3 Days', count: 0 },
      { range: '4-7 Days', count: 0 },
      { range: '8-14 Days', count: 0 },
      { range: '15-30 Days', count: 0 },
      { range: '30+ Days', count: 0 },
    ];

    patients.forEach(p => {
      const start = new Date(p.admissionDate);
      const end = p.releaseDate ? new Date(p.releaseDate) : new Date();
      const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (days <= 3) ranges[0].count++;
      else if (days <= 7) ranges[1].count++;
      else if (days <= 14) ranges[2].count++;
      else if (days <= 30) ranges[3].count++;
      else ranges[4].count++;
    });

    return ranges;
  }, [patients]);

  const chartData = useMemo(() => {
    if (period === 'Custom' && startDate && endDate) {
      const sDate = new Date(startDate);
      const eDate = new Date(endDate);
      const daysDiff = Math.floor((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24));

      // Use daily data if 60 days or less, otherwise monthly
      return daysDiff <= 60 ? dayWiseData : monthWiseData;
    }

    const isDayView = ['Today', 'today', 'Last 7 Days', '7days', 'Last 30 Days', '30days', 'This Week', 'This Month'].includes(period);
    const isYearView = ['All Time', 'all'].includes(period);

    return isDayView ? dayWiseData : isYearView ? yearWiseData : monthWiseData;
  }, [period, dayWiseData, yearWiseData, monthWiseData, startDate, endDate]);

  const xAxisKey = useMemo(() => {
    if (period === 'Custom' && startDate && endDate) {
      const sDate = new Date(startDate);
      const eDate = new Date(endDate);
      const daysDiff = Math.floor((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24));

      return daysDiff <= 60 ? 'day' : 'month';
    }

    const isDayView = ['Today', 'today', 'Last 7 Days', '7days', 'Last 30 Days', '30days', 'This Week', 'This Month'].includes(period);
    const isYearView = ['All Time', 'all'].includes(period);

    return isYearView ? 'year' : isDayView ? 'day' : 'month';
  }, [period, startDate, endDate]);

  // ---------------------------------------------------------------------------
  // NEW ANALYTICS: "World Class" Features
  // ---------------------------------------------------------------------------

  // 1. Birth Weight Analysis (NICU Specific)
  const weightAnalysisData = useMemo(() => {
    // Categories:
    // ELBW: < 1.0 kg
    // VLBW: 1.0 - 1.499 kg
    // LBW: 1.5 - 2.499 kg
    // Normal: 2.5 - 3.8 kg
    // LGA: > 3.8 kg
    const buckets = [
      { name: 'ELBW (<1kg)', min: 0, max: 0.999, total: 0, discharged: 0, referred: 0, deceased: 0, other: 0, survivalRate: 0, totalLOS: 0, avgLOS: 0 },
      { name: 'VLBW (1-1.5kg)', min: 1, max: 1.499, total: 0, discharged: 0, referred: 0, deceased: 0, other: 0, survivalRate: 0, totalLOS: 0, avgLOS: 0 },
      { name: 'LBW (1.5-2.5kg)', min: 1.5, max: 2.499, total: 0, discharged: 0, referred: 0, deceased: 0, other: 0, survivalRate: 0, totalLOS: 0, avgLOS: 0 },
      { name: 'Normal (2.5-3.8kg)', min: 2.5, max: 3.8, total: 0, discharged: 0, referred: 0, deceased: 0, other: 0, survivalRate: 0, totalLOS: 0, avgLOS: 0 },
      { name: 'LGA (>3.8kg)', min: 3.801, max: 15, total: 0, discharged: 0, referred: 0, deceased: 0, other: 0, survivalRate: 0, totalLOS: 0, avgLOS: 0 },
    ];

    patients.forEach(p => {
      // Only count patients with birth weight recorded
      if (p.birthWeight !== undefined) {
        const weight = p.birthWeight;
        const bucket = buckets.find(b => weight >= b.min && weight <= b.max);

        if (bucket) {
          bucket.total++;
          if (p.outcome === 'Discharged') bucket.discharged++;
          else if (p.outcome === 'Referred') bucket.referred++;
          else if (p.outcome === 'Deceased') bucket.deceased++;
          else bucket.other++; // In Progress, Step Down, etc.

          // Calculate Length of Stay for all patients in this bucket
          const start = new Date(p.admissionDate);
          const end = p.releaseDate ? new Date(p.releaseDate) : new Date();
          const los = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
          bucket.totalLOS += los;
        }
      }
    });

    // Calculate rates and averages
    buckets.forEach(b => {
      b.survivalRate = b.total > 0 ? parseFloat(((b.discharged / b.total) * 100).toFixed(1)) : 0;
      b.avgLOS = b.total > 0 ? parseFloat((b.totalLOS / b.total).toFixed(1)) : 0;
    });

    return buckets; // Returns all buckets, even if total is 0
  }, [patients]);

  // 2. Length of Stay vs Mortality
  const losMortalityData = useMemo(() => {
    const ranges = [
      { range: '0-3 Days', total: 0, deceased: 0, mortalityRate: 0 },
      { range: '4-7 Days', total: 0, deceased: 0, mortalityRate: 0 },
      { range: '8-14 Days', total: 0, deceased: 0, mortalityRate: 0 },
      { range: '15-30 Days', total: 0, deceased: 0, mortalityRate: 0 },
      { range: '30+ Days', total: 0, deceased: 0, mortalityRate: 0 },
    ];

    patients.forEach(p => {
      const start = new Date(p.admissionDate);
      const end = p.releaseDate ? new Date(p.releaseDate) : new Date();
      const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      let index = -1;
      if (days <= 3) index = 0;
      else if (days <= 7) index = 1;
      else if (days <= 14) index = 2;
      else if (days <= 30) index = 3;
      else index = 4;

      if (index !== -1) {
        ranges[index].total++;
        if (p.outcome === 'Deceased') ranges[index].deceased++;
      }
    });

    ranges.forEach(r => {
      r.mortalityRate = r.total > 0 ? parseFloat(((r.deceased / r.total) * 100).toFixed(1)) : 0;
    });

    return ranges;
  }, [patients]);

  // 3. Admission vs Outcomes (Discharge & Referral) Comparison
  // Re-using chartData but structuring for specific comparison
  const outcomesComparisonData = useMemo(() => {
    return chartData.map(d => ({
      ...d,
      positiveOutcomes: (d.discharged || 0) + (d.referred || 0), // Grouping "Left Alive"
      negativeOutcomes: d.deaths || 0,
      netChange: (d.admissions || 0) - ((d.discharged || 0) + (d.referred || 0) + (d.deaths || 0)) // Net bed change
    }));
  }, [chartData]);


  // 4. Temporal Insights (Admissions by Day of Week)
  const temporalData = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const counts = days.map(d => ({ day: d, admissions: 0, deaths: 0 }));

    patients.forEach(p => {
      const date = new Date(p.admissionDate);
      const dayIndex = date.getDay();
      counts[dayIndex].admissions++;

      if (p.outcome === 'Deceased') {
        const deathDate = p.releaseDate ? new Date(p.releaseDate) : date; // approx if release date missing
        const deathDayIndex = deathDate.getDay();
        counts[deathDayIndex].deaths++;
      }
    });

    return counts;
  }, [patients]);

  return (
    <div className="space-y-8 animate-fadeIn">


      {/* Row 1: The Big Picture (Comparisons) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Chart 1: Admission vs Outcome Flow */}
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="text-2xl">🌊</span> Patient Flow Dynamics
            </h3>
            <NeolinkAIButton
              chartTitle="Patient Flow Dynamics"
              chartType="bar chart"
              dataPoints={outcomesComparisonData.map(d => ({ label: d[xAxisKey as keyof typeof d] as string, value: `Admissions: ${d.admissions}, Discharged/Referred: ${d.positiveOutcomes}` }))}
              context="NICU/PICU patient admissions vs discharges/referrals trend"
            />
          </div>
          <p className="text-sm text-slate-500 mb-6">Comparing Inflow (Admissions) vs Outflow (Discharges & Referrals)</p>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outcomesComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey={xAxisKey} stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                <Bar dataKey="admissions" name="Admissions (In)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Bar dataKey="positiveOutcomes" name="Discharged/Referred (Out)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Net Capacity Trends */}
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="text-2xl">⚖️</span> Net Capacity Impact
            </h3>
            <NeolinkAIButton
              chartTitle="Net Capacity Impact"
              chartType="bar chart"
              dataPoints={outcomesComparisonData.map(d => ({ label: d[xAxisKey as keyof typeof d] as string, value: `Net Change: ${d.netChange}` }))}
              context="Net patient change - positive means beds filling, negative means beds freeing up"
            />
          </div>
          <p className="text-sm text-slate-500 mb-6">Net change in patient load (Admissions - All Exits)</p>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outcomesComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey={xAxisKey} stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: 'transparent' }}
                />
                <Legend />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="netChange" name="Net Patient Change" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  {
                    outcomesComparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.netChange > 0 ? '#ef4444' : '#10b981'} />
                    ))
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Deep Dive (Weight & LOS) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Chart 3: Birth Weight Analysis */}
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="text-2xl">⚖️</span> Outcome by Birth Weight
            </h3>
            <NeolinkAIButton
              chartTitle="Outcome by Birth Weight"
              chartType="horizontal bar chart"
              dataPoints={weightAnalysisData.map(d => ({ label: d.name, value: `Total: ${d.total}, Discharged: ${d.discharged}, Deceased: ${d.deceased}, Survival: ${d.survivalRate}%` }))}
              context="NICU birth weight categories and survival outcomes"
            />
          </div>
          <p className="text-sm text-slate-500 mb-6">Detailed outcome distribution across weight categories</p>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weightAnalysisData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" stroke="#64748b" xAxisId="bottom" />
                <XAxis type="number" stroke="#f59e0b" xAxisId="top" orientation="top" hide />
                <YAxis dataKey="name" type="category" stroke="#64748b" width={120} tick={{ fontSize: 11, fontWeight: 'bold' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" />

                {/* Stacked Bars for Outcome */}
                <Bar dataKey="discharged" name="Discharged" stackId="a" fill="#10b981" barSize={30} xAxisId="bottom" />
                <Bar dataKey="referred" name="Referred" stackId="a" fill="#f59e0b" barSize={30} xAxisId="bottom" />
                <Bar dataKey="deceased" name="Deceased" stackId="a" fill="#ef4444" barSize={30} xAxisId="bottom" />
                <Bar dataKey="other" name="In Progress/Step Down" stackId="a" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={30} xAxisId="bottom" />

                {/* Line for Average LOS */}
                <Line type="monotone" dataKey="avgLOS" name="Avg Hospital Stay (Days)" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6' }} xAxisId="bottom" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: LOS vs Mortality */}
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="text-2xl">⏱️</span> Length of Stay vs Mortality
            </h3>
            <NeolinkAIButton
              chartTitle="Length of Stay vs Mortality"
              chartType="combo bar and line chart"
              dataPoints={losMortalityData.map(d => ({ label: d.range, value: `Total: ${d.total}, Deceased: ${d.deceased}, Mortality: ${d.mortalityRate}%` }))}
              context="Analyzing critical LOS periods for mortality risk in NICU/PICU"
            />
          </div>
          <p className="text-sm text-slate-500 mb-6">Analyzing critical periods for mortality risk</p>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={losMortalityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="range" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" orientation="left" stroke="#64748b" />
                <YAxis yAxisId="right" orientation="right" stroke="#ef4444" unit="%" />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                <Legend />
                <Bar yAxisId="left" dataKey="total" name="Total Patients" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <Line yAxisId="right" type="monotone" dataKey="mortalityRate" name="Mortality Rate %" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Row 3: Temporal Analysis */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="text-2xl">📅</span> Temporal Analysis (Day of Week)
            </h3>
            <NeolinkAIButton
              chartTitle="Temporal Analysis by Day of Week"
              chartType="bar chart"
              dataPoints={temporalData.map(d => ({ label: d.day, value: `Admissions: ${d.admissions}, Deaths: ${d.deaths}` }))}
              context="Day-of-week patterns for admissions and mortality in NICU/PICU"
            />
          </div>
          <p className="text-sm text-slate-500 mb-6">Identifying high-traffic days for resource planning</p>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={temporalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="day" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend />
                <Bar dataKey="admissions" name="Admissions" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={60} />
                <Bar dataKey="deaths" name="Deaths" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Existing Charts (retained for completeness but styled to match) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 opacity-80 hover:opacity-100 transition-opacity">
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-slate-700">Top Diagnoses</h4>
            <NeolinkAIButton
              chartTitle="Top Diagnoses Distribution"
              chartType="horizontal bar chart"
              dataPoints={diagnosisData.map(d => ({ label: d.name, value: d.count }))}
              context="Most common diagnoses in the unit"
            />
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diagnosisData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
          <h4 className="font-bold text-slate-700 mb-4">Length of Stay (Overall)</h4>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lengthOfStayData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="count" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
};

export default TimeBasedAnalytics;
