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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import { haptics } from '../../../utils/haptics';

interface ChartsCardProps {
  deceasedPatients: Patient[];
}

type ChartType = 'causes' | 'units' | 'trend';

const COLORS = ['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

const ChartsCard: React.FC<ChartsCardProps> = ({ deceasedPatients }) => {
  const [activeChart, setActiveChart] = useState<ChartType>('causes');

  // Calculate chart data
  const chartData = useMemo(() => {
    // Top causes of death
    const causesMap = new Map<string, number>();
    deceasedPatients.forEach(p => {
      let diagnosis = p.aiInterpretedDeathDiagnosis || p.diagnosisAtDeath || 'Unknown';
      // Remove "Primary Cause:" prefix if present
      diagnosis = diagnosis.replace(/^(Primary\s*Cause\s*[:\-]\s*)/i, '').trim();
      const primaryCause = diagnosis.split('.')[0].split(',')[0].trim().substring(0, 30);
      causesMap.set(primaryCause, (causesMap.get(primaryCause) || 0) + 1);
    });
    const causes = Array.from(causesMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Unit distribution
    const unitMap = new Map<string, number>();
    deceasedPatients.forEach(p => {
      const shortUnit = p.unit.replace('Neonatal Intensive Care Unit', 'NICU')
        .replace('Pediatric Intensive Care Unit', 'PICU')
        .replace('Special New Born Care Unit', 'SNCU')
        .replace('High Dependency Unit', 'HDU')
        .replace('General Ward', 'GW');
      unitMap.set(shortUnit, (unitMap.get(shortUnit) || 0) + 1);
    });
    const units = Array.from(unitMap.entries())
      .map(([name, value]) => ({ name, value }));

    // Monthly trend (last 6 months)
    const monthlyMap = new Map<string, number>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString('en-US', { month: 'short' });
      monthlyMap.set(key, 0);
    }
    deceasedPatients.forEach(p => {
      const deathDate = new Date(p.dateOfDeath || p.releaseDate || p.admissionDate);
      const monthKey = deathDate.toLocaleDateString('en-US', { month: 'short' });
      if (monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1);
      }
    });
    const trend = Array.from(monthlyMap.entries())
      .map(([name, value]) => ({ name, value }));

    return { causes, units, trend };
  }, [deceasedPatients]);

  const ChartTabs = () => (
    <div className="flex gap-2 mb-4">
      {[
        { id: 'causes' as ChartType, label: 'Causes' },
        { id: 'units' as ChartType, label: 'Units' },
        { id: 'trend' as ChartType, label: 'Trend' }
      ].map(tab => (
        <button
          key={tab.id}
          onClick={() => {
            haptics.selection();
            setActiveChart(tab.id);
          }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeChart === tab.id
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const renderChart = () => {
    switch (activeChart) {
      case 'causes':
        return (
          <div className="h-64">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Top Causes of Death</h3>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart
                data={chartData.causes}
                layout="vertical"
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                  {chartData.causes.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case 'units':
        return (
          <div className="h-64">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Distribution by Unit</h3>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie
                  data={chartData.units}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {chartData.units.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );

      case 'trend':
        return (
          <div className="h-64">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Monthly Trend (Last 6 Months)</h3>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={chartData.trend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0EA5E9"
                  strokeWidth={3}
                  dot={{ fill: '#0EA5E9', r: 5 }}
                  activeDot={{ r: 8, fill: '#0284C7' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
    }
  };

  return (
    <AnalyticsCard
      title="Charts & Trends"
      subtitle="Visual mortality analysis"
      headerGradient="from-purple-600 to-indigo-700"
      icon={
        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      }
    >
      <ChartTabs />
      <AnimatePresence mode="wait">
        <motion.div
          key={activeChart}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {renderChart()}
        </motion.div>
      </AnimatePresence>

      {/* Quick Stats Below Chart */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-blue-600">{chartData.causes.length}</div>
          <div className="text-xs text-slate-600">Unique Causes</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-purple-600">{chartData.units.length}</div>
          <div className="text-xs text-slate-600">Units</div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-emerald-600">
            {chartData.trend.reduce((a, b) => a + b.value, 0)}
          </div>
          <div className="text-xs text-slate-600">6mo Total</div>
        </div>
      </div>
    </AnalyticsCard>
  );
};

export default ChartsCard;
