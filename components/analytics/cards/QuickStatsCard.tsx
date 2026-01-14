import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Patient, Unit } from '../../../types';
import AnalyticsCard from '../AnalyticsCard';

interface QuickStatsCardProps {
  deceasedPatients: Patient[];
  allPatients: Patient[];
  institutionName: string;
}

interface StatBoxProps {
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
  delay?: number;
}

const StatBox: React.FC<StatBoxProps> = ({ label, value, subValue, color, trend, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
    className={`${color} rounded-2xl p-4 text-center`}
  >
    <div className="flex items-center justify-center gap-1">
      <span className="text-3xl font-bold text-slate-800">{value}</span>
      {trend && trend !== 'neutral' && (
        <svg
          className={`w-5 h-5 ${trend === 'up' ? 'text-red-500' : 'text-green-500'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={trend === 'up' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
          />
        </svg>
      )}
    </div>
    {subValue && (
      <p className="text-xs text-slate-500 mt-1">{subValue}</p>
    )}
    <p className="text-sm font-medium text-slate-600 mt-1">{label}</p>
  </motion.div>
);

const QuickStatsCard: React.FC<QuickStatsCardProps> = ({
  deceasedPatients,
  allPatients,
  institutionName
}) => {
  // Calculate statistics
  const stats = useMemo(() => {
    const totalDeaths = deceasedPatients.length;
    const totalAdmissions = allPatients.length;
    const mortalityRate = totalAdmissions > 0
      ? ((totalDeaths / totalAdmissions) * 100).toFixed(1)
      : '0.0';

    // Deaths by unit
    const unitCounts: Record<string, number> = {};
    deceasedPatients.forEach(p => {
      unitCounts[p.unit] = (unitCounts[p.unit] || 0) + 1;
    });

    // Inborn vs Outborn (NICU only)
    const nicuDeaths = deceasedPatients.filter(p => p.unit === Unit.NICU);
    const inbornDeaths = nicuDeaths.filter(p => {
      const admissionType = p.admissionType?.toLowerCase() || '';
      return admissionType === 'inborn' || admissionType.includes('inborn');
    }).length;
    const outbornDeaths = nicuDeaths.length - inbornDeaths;

    // AI interpreted count
    const aiInterpreted = deceasedPatients.filter(p => p.aiInterpretedDeathDiagnosis).length;

    return {
      totalDeaths,
      mortalityRate,
      unitCounts,
      inbornDeaths,
      outbornDeaths,
      nicuTotal: nicuDeaths.length,
      aiInterpreted,
      aiPercentage: totalDeaths > 0 ? ((aiInterpreted / totalDeaths) * 100).toFixed(0) : '0'
    };
  }, [deceasedPatients, allPatients]);

  return (
    <AnalyticsCard
      title="Mortality Overview"
      subtitle={institutionName}
      icon={
        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      }
    >
      <div className="space-y-4">
        {/* Primary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox
            label="Total Deaths"
            value={stats.totalDeaths}
            color="bg-blue-50"
            delay={0}
          />
          <StatBox
            label="Mortality Rate"
            value={`${stats.mortalityRate}%`}
            color="bg-sky-50"
            delay={0.1}
          />
        </div>

        {/* Unit Breakdown */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-50 rounded-2xl p-4"
        >
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Deaths by Unit</h3>
          <div className="space-y-2">
            {Object.entries(stats.unitCounts).map(([unit, count], idx) => {
              const percentage = stats.totalDeaths > 0
                ? ((count / stats.totalDeaths) * 100).toFixed(0)
                : '0';
              return (
                <div key={unit} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 truncate">{unit}</span>
                      <span className="font-semibold text-slate-800">{count}</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ delay: 0.3 + idx * 0.1, duration: 0.5 }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 w-10 text-right">{percentage}%</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* NICU Inborn vs Outborn */}
        {stats.nicuTotal > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-4"
          >
            <h3 className="text-sm font-semibold text-slate-700 mb-3">NICU Breakdown</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.inbornDeaths}</div>
                <div className="text-xs text-slate-600">Inborn</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{stats.outbornDeaths}</div>
                <div className="text-xs text-slate-600">Outborn</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* AI Interpretation Status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-between bg-emerald-50 rounded-2xl p-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">AI Interpreted</p>
              <p className="text-xs text-slate-500">{stats.aiPercentage}% of cases</p>
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{stats.aiInterpreted}</div>
        </motion.div>
      </div>
    </AnalyticsCard>
  );
};

export default QuickStatsCard;
