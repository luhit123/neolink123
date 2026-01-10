import React, { useMemo } from 'react';
import { Patient } from '../types';
import { motion } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface MortalityChartsPanelProps {
  patients: Patient[];
}

const COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

const MortalityChartsPanel: React.FC<MortalityChartsPanelProps> = ({ patients }) => {
  // Top Causes Data
  const topCausesData = useMemo(() => {
    const causesMap = new Map<string, number>();

    patients.forEach(p => {
      const diagnosis = p.aiInterpretedDeathDiagnosis || p.diagnosisAtDeath || 'Unknown';
      const cause = diagnosis.split('.')[0].split(',')[0].trim();
      const shortCause = cause.length > 40 ? cause.substring(0, 40) + '...' : cause;
      causesMap.set(shortCause, (causesMap.get(shortCause) || 0) + 1);
    });

    return Array.from(causesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
  }, [patients]);

  // Time Series Data (by month)
  const timeSeriesData = useMemo(() => {
    const monthsMap = new Map<string, number>();

    patients.forEach(p => {
      const deathDate = p.dateOfDeath ? new Date(p.dateOfDeath) : new Date(p.releaseDate || p.admissionDate);
      const monthKey = `${deathDate.getFullYear()}-${String(deathDate.getMonth() + 1).padStart(2, '0')}`;
      monthsMap.set(monthKey, (monthsMap.get(monthKey) || 0) + 1);
    });

    return Array.from(monthsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12) // Last 12 months
      .map(([month, deaths]) => ({
        month: new Date(month + '-01').toLocaleDateString('en', { month: 'short', year: '2-digit' }),
        deaths
      }));
  }, [patients]);

  // Unit Distribution Data
  const unitDistributionData = useMemo(() => {
    const unitsMap = new Map<string, number>();

    patients.forEach(p => {
      unitsMap.set(p.unit, (unitsMap.get(p.unit) || 0) + 1);
    });

    return Array.from(unitsMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [patients]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-xl border-2 border-slate-200 rounded-lg p-3 shadow-xl">
          <p className="text-slate-900 font-semibold">{label || payload[0].name}</p>
          <p className="text-sky-600 font-bold text-lg">
            {payload[0].value} {payload[0].name === 'deaths' ? 'deaths' : 'patients'}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Top Causes - Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Top Causes of Death
          </h3>
          <span className="text-sm text-slate-500 font-medium">
            Top 8 diagnoses
          </span>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={topCausesData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" stroke="#64748b" />
            <YAxis
              type="category"
              dataKey="name"
              width={200}
              stroke="#64748b"
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" fill="#ef4444" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time Series - Line Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Mortality Trends
            </h3>
            <span className="text-sm text-slate-500 font-medium">
              Last 12 months
            </span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={timeSeriesData}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="deaths"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{ fill: '#8b5cf6', r: 5 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Unit Distribution - Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Unit Distribution
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={unitDistributionData}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Summary Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl p-4 border-2 border-blue-200">
          <div className="text-sm text-blue-600 font-medium mb-1">Average Age</div>
          <div className="text-2xl font-bold text-blue-900">
            {patients.length > 0
              ? (patients.reduce((sum, p) => sum + (p.age || 0), 0) / patients.length).toFixed(1)
              : '0'}
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-4 border-2 border-red-200">
          <div className="text-sm text-red-600 font-medium mb-1">Male Patients</div>
          <div className="text-2xl font-bold text-red-900">
            {patients.filter(p => p.gender === 'Male').length}
            <span className="text-sm text-red-600 ml-1">
              ({patients.length > 0 ? ((patients.filter(p => p.gender === 'Male').length / patients.length) * 100).toFixed(0) : 0}%)
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-4 border-2 border-purple-200">
          <div className="text-sm text-purple-600 font-medium mb-1">Female Patients</div>
          <div className="text-2xl font-bold text-purple-900">
            {patients.filter(p => p.gender === 'Female').length}
            <span className="text-sm text-purple-600 ml-1">
              ({patients.length > 0 ? ((patients.filter(p => p.gender === 'Female').length / patients.length) * 100).toFixed(0) : 0}%)
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border-2 border-emerald-200">
          <div className="text-sm text-emerald-600 font-medium mb-1">AI Interpreted</div>
          <div className="text-2xl font-bold text-emerald-900">
            {patients.filter(p => p.aiInterpretedDeathDiagnosis).length}
            <span className="text-sm text-emerald-600 ml-1">
              ({patients.length > 0 ? ((patients.filter(p => p.aiInterpretedDeathDiagnosis).length / patients.length) * 100).toFixed(0) : 0}%)
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default MortalityChartsPanel;
