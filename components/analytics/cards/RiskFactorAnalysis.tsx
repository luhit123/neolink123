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
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { haptics } from '../../../utils/haptics';

interface RiskFactorAnalysisProps {
  deceasedPatients: Patient[];
  allPatients?: Patient[];
}

type ViewType = 'birthWeight' | 'gestational' | 'admission' | 'heatmap' | 'radar';

const COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
  veryLow: '#0d9488',
  blue: '#3b82f6',
  purple: '#8b5cf6',
};

const RiskFactorAnalysis: React.FC<RiskFactorAnalysisProps> = ({
  deceasedPatients,
  allPatients = []
}) => {
  const [activeView, setActiveView] = useState<ViewType>('birthWeight');

  // Birth Weight Risk Analysis
  const birthWeightRisk = useMemo(() => {
    const categories = [
      { name: 'ELBW', label: '<1kg', min: 0, max: 1, deaths: 0, admissions: 0, color: COLORS.critical },
      { name: 'VLBW', label: '1-1.5kg', min: 1, max: 1.5, deaths: 0, admissions: 0, color: COLORS.high },
      { name: 'LBW', label: '1.5-2.5kg', min: 1.5, max: 2.5, deaths: 0, admissions: 0, color: COLORS.medium },
      { name: 'NBW', label: '2.5-4kg', min: 2.5, max: 4, deaths: 0, admissions: 0, color: COLORS.low },
      { name: 'HBW', label: '>4kg', min: 4, max: Infinity, deaths: 0, admissions: 0, color: COLORS.veryLow },
    ];

    deceasedPatients.forEach(p => {
      if (p.birthWeight) {
        const weight = parseFloat(p.birthWeight.toString());
        const cat = categories.find(c => weight >= c.min && weight < c.max);
        if (cat) cat.deaths++;
      }
    });

    allPatients.forEach(p => {
      if (p.birthWeight) {
        const weight = parseFloat(p.birthWeight.toString());
        const cat = categories.find(c => weight >= c.min && weight < c.max);
        if (cat) cat.admissions++;
      }
    });

    return categories.map(c => ({
      ...c,
      mortalityRate: c.admissions > 0 ? ((c.deaths / c.admissions) * 100).toFixed(1) : '0',
      riskLevel: c.admissions > 0 && (c.deaths / c.admissions) > 0.3 ? 'Critical' :
                 c.admissions > 0 && (c.deaths / c.admissions) > 0.2 ? 'High' :
                 c.admissions > 0 && (c.deaths / c.admissions) > 0.1 ? 'Moderate' : 'Low'
    }));
  }, [deceasedPatients, allPatients]);

  // Admission Type Risk
  const admissionTypeRisk = useMemo(() => {
    const types = [
      { name: 'Inborn', deaths: 0, admissions: 0 },
      { name: 'Outborn-HF', label: 'Outborn (Health Facility)', deaths: 0, admissions: 0 },
      { name: 'Outborn-Com', label: 'Outborn (Community)', deaths: 0, admissions: 0 },
      { name: 'Unknown', deaths: 0, admissions: 0 },
    ];

    const categorize = (admissionType?: string) => {
      if (!admissionType) return 'Unknown';
      const lower = admissionType.toLowerCase();
      if (lower.includes('inborn')) return 'Inborn';
      if (lower.includes('community')) return 'Outborn-Com';
      if (lower.includes('outborn') || lower.includes('referred')) return 'Outborn-HF';
      return 'Unknown';
    };

    deceasedPatients.forEach(p => {
      const type = categorize(p.admissionType);
      const cat = types.find(t => t.name === type);
      if (cat) cat.deaths++;
    });

    allPatients.forEach(p => {
      const type = categorize(p.admissionType);
      const cat = types.find(t => t.name === type);
      if (cat) cat.admissions++;
    });

    return types.filter(t => t.admissions > 0).map(t => ({
      ...t,
      mortalityRate: ((t.deaths / t.admissions) * 100).toFixed(1)
    }));
  }, [deceasedPatients, allPatients]);

  // Mode of Delivery Risk
  const deliveryModeRisk = useMemo(() => {
    const modes = new Map<string, { deaths: number; admissions: number }>();

    deceasedPatients.forEach(p => {
      const mode = p.modeOfDelivery || 'Unknown';
      const shortMode = mode.split(' ')[0]; // Just first word
      if (!modes.has(shortMode)) modes.set(shortMode, { deaths: 0, admissions: 0 });
      modes.get(shortMode)!.deaths++;
    });

    allPatients.forEach(p => {
      const mode = p.modeOfDelivery || 'Unknown';
      const shortMode = mode.split(' ')[0];
      if (!modes.has(shortMode)) modes.set(shortMode, { deaths: 0, admissions: 0 });
      modes.get(shortMode)!.admissions++;
    });

    return Array.from(modes.entries())
      .filter(([_, data]) => data.admissions > 0)
      .map(([name, data]) => ({
        name,
        deaths: data.deaths,
        admissions: data.admissions,
        mortalityRate: ((data.deaths / data.admissions) * 100).toFixed(1)
      }))
      .sort((a, b) => parseFloat(b.mortalityRate) - parseFloat(a.mortalityRate));
  }, [deceasedPatients, allPatients]);

  // Heatmap Data - Hour vs Day
  const heatmapData = useMemo(() => {
    const grid: { hour: number; day: number; dayName: string; deaths: number }[] = [];

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour += 4) { // Group by 4-hour blocks
        grid.push({
          hour,
          day,
          dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day],
          deaths: 0
        });
      }
    }

    deceasedPatients.forEach(p => {
      if (p.dateOfDeath) {
        const date = new Date(p.dateOfDeath);
        const day = date.getDay();
        const hour = Math.floor(date.getHours() / 4) * 4;
        const cell = grid.find(g => g.day === day && g.hour === hour);
        if (cell) cell.deaths++;
      }
    });

    return grid;
  }, [deceasedPatients]);

  // Radar Chart Data - Risk Profile
  const radarData = useMemo(() => {
    const factors = [
      { name: 'Low Birth Weight', fullMark: 100, value: 0 },
      { name: 'Outborn', fullMark: 100, value: 0 },
      { name: 'Early Death (<24h)', fullMark: 100, value: 0 },
      { name: 'Night Deaths', fullMark: 100, value: 0 },
      { name: 'Weekend Deaths', fullMark: 100, value: 0 },
      { name: 'NICU Cases', fullMark: 100, value: 0 },
    ];

    if (deceasedPatients.length === 0) return factors;

    // Calculate percentages
    factors[0].value = Math.round((deceasedPatients.filter(p => p.birthWeight && parseFloat(p.birthWeight.toString()) < 2.5).length / deceasedPatients.length) * 100);

    factors[1].value = Math.round((deceasedPatients.filter(p => {
      const type = p.admissionType?.toLowerCase() || '';
      return type.includes('outborn') || type.includes('referred');
    }).length / deceasedPatients.length) * 100);

    factors[2].value = Math.round((deceasedPatients.filter(p => {
      if (!p.dateOfDeath || !p.admissionDate) return false;
      const hours = (new Date(p.dateOfDeath).getTime() - new Date(p.admissionDate).getTime()) / (1000 * 60 * 60);
      return hours < 24;
    }).length / deceasedPatients.length) * 100);

    factors[3].value = Math.round((deceasedPatients.filter(p => {
      if (!p.dateOfDeath) return false;
      const hour = new Date(p.dateOfDeath).getHours();
      return hour < 6 || hour >= 22;
    }).length / deceasedPatients.length) * 100);

    factors[4].value = Math.round((deceasedPatients.filter(p => {
      if (!p.dateOfDeath) return false;
      const day = new Date(p.dateOfDeath).getDay();
      return day === 0 || day === 6;
    }).length / deceasedPatients.length) * 100);

    factors[5].value = Math.round((deceasedPatients.filter(p => p.unit === Unit.NICU).length / deceasedPatients.length) * 100);

    return factors;
  }, [deceasedPatients]);

  // Calculate overall risk score
  const overallRiskScore = useMemo(() => {
    const avgRate = allPatients.length > 0
      ? (deceasedPatients.length / allPatients.length) * 100
      : 0;

    if (avgRate > 20) return { score: 'Critical', color: COLORS.critical };
    if (avgRate > 15) return { score: 'High', color: COLORS.high };
    if (avgRate > 10) return { score: 'Moderate', color: COLORS.medium };
    if (avgRate > 5) return { score: 'Low', color: COLORS.low };
    return { score: 'Very Low', color: COLORS.veryLow };
  }, [deceasedPatients.length, allPatients.length]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-xl border-2 border-slate-200 rounded-lg p-3 shadow-xl">
          <p className="text-slate-900 font-semibold">{label || payload[0].payload?.name}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color || COLORS.blue }} className="font-bold text-sm">
              {entry.name}: {entry.value}{entry.name.includes('Rate') ? '%' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const getHeatmapColor = (deaths: number) => {
    if (deaths === 0) return 'bg-slate-100';
    if (deaths === 1) return 'bg-yellow-200';
    if (deaths === 2) return 'bg-orange-300';
    if (deaths === 3) return 'bg-orange-500';
    return 'bg-red-600';
  };

  const tabs = [
    { id: 'birthWeight' as ViewType, label: 'Weight', icon: '⚖️' },
    { id: 'admission' as ViewType, label: 'Admission', icon: '🏥' },
    { id: 'heatmap' as ViewType, label: 'Heatmap', icon: '🔥' },
    { id: 'radar' as ViewType, label: 'Profile', icon: '📊' },
  ];

  return (
    <AnalyticsCard
      title="Risk Factor Analysis"
      subtitle="Identify high-risk patterns"
      headerGradient="from-amber-500 to-orange-600"
      icon={
        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      }
    >
      {/* Overall Risk Badge */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="px-3 py-1 rounded-full text-white text-xs font-bold"
            style={{ backgroundColor: overallRiskScore.color }}
          >
            {overallRiskScore.score} Risk
          </div>
          <span className="text-xs text-slate-500">
            {allPatients.length > 0 ? ((deceasedPatients.length / allPatients.length) * 100).toFixed(1) : '0'}% mortality
          </span>
        </div>
      </div>

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
                ? 'bg-amber-600 text-white shadow-lg'
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
          {activeView === 'birthWeight' && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Birth Weight Mortality Risk</h3>
              <p className="text-xs text-slate-500 mb-3">Lower birth weight = Higher risk</p>

              <div className="h-48 sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={birthWeightRisk} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="mortalityRate" name="Mortality Rate %" radius={[4, 4, 0, 0]}>
                      {birthWeightRisk.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Risk Legend */}
              <div className="mt-3 grid grid-cols-5 gap-1">
                {birthWeightRisk.map((cat, i) => (
                  <div key={i} className="text-center">
                    <div
                      className="w-full h-2 rounded-full mb-1"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="text-[9px] text-slate-600">{cat.name}</div>
                    <div className="text-[10px] font-bold" style={{ color: cat.color }}>
                      {cat.mortalityRate}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'admission' && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Admission Type Risk</h3>
              <p className="text-xs text-slate-500 mb-3">Inborn vs Outborn mortality comparison</p>

              <div className="space-y-3">
                {admissionTypeRisk.map((type, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-700">{type.label || type.name}</span>
                      <span className="text-lg font-bold" style={{
                        color: parseFloat(type.mortalityRate) > 20 ? COLORS.critical :
                               parseFloat(type.mortalityRate) > 15 ? COLORS.high :
                               parseFloat(type.mortalityRate) > 10 ? COLORS.medium : COLORS.low
                      }}>
                        {type.mortalityRate}%
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>{type.deaths} deaths</span>
                      <span>{type.admissions} admissions</span>
                    </div>
                    <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${type.mortalityRate}%`,
                          backgroundColor: parseFloat(type.mortalityRate) > 20 ? COLORS.critical :
                                           parseFloat(type.mortalityRate) > 15 ? COLORS.high :
                                           parseFloat(type.mortalityRate) > 10 ? COLORS.medium : COLORS.low
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Delivery Mode Summary */}
              {deliveryModeRisk.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-700 mb-2">By Delivery Mode</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {deliveryModeRisk.slice(0, 4).map((mode, i) => (
                      <div key={i} className="bg-slate-50 rounded-lg p-2">
                        <div className="text-[10px] text-slate-500">{mode.name}</div>
                        <div className="text-sm font-bold text-slate-700">{mode.mortalityRate}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeView === 'heatmap' && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Death Timing Heatmap</h3>
              <p className="text-xs text-slate-500 mb-3">When do deaths cluster?</p>

              <div className="overflow-x-auto">
                <div className="min-w-[280px]">
                  {/* Hour Labels */}
                  <div className="flex mb-1">
                    <div className="w-10"></div>
                    {[0, 4, 8, 12, 16, 20].map(hour => (
                      <div key={hour} className="flex-1 text-[9px] text-slate-500 text-center">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>

                  {/* Heatmap Grid */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, dayIndex) => (
                    <div key={day} className="flex items-center mb-1">
                      <div className="w-10 text-[10px] text-slate-600 font-medium">{day}</div>
                      <div className="flex-1 flex gap-0.5">
                        {[0, 4, 8, 12, 16, 20].map(hour => {
                          const cell = heatmapData.find(h => h.day === dayIndex && h.hour === hour);
                          const deaths = cell?.deaths || 0;
                          return (
                            <div
                              key={hour}
                              className={`flex-1 h-6 rounded ${getHeatmapColor(deaths)} flex items-center justify-center`}
                              title={`${day} ${hour}:00-${hour + 4}:00: ${deaths} deaths`}
                            >
                              {deaths > 0 && (
                                <span className={`text-[9px] font-bold ${deaths > 2 ? 'text-white' : 'text-slate-700'}`}>
                                  {deaths}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Legend */}
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <span className="text-[9px] text-slate-500">Less</span>
                    <div className="w-4 h-4 bg-slate-100 rounded" />
                    <div className="w-4 h-4 bg-yellow-200 rounded" />
                    <div className="w-4 h-4 bg-orange-300 rounded" />
                    <div className="w-4 h-4 bg-orange-500 rounded" />
                    <div className="w-4 h-4 bg-red-600 rounded" />
                    <span className="text-[9px] text-slate-500">More</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'radar' && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Mortality Risk Profile</h3>
              <p className="text-xs text-slate-500 mb-3">% of deaths with each risk factor</p>

              <div className="h-56 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                    <PolarGrid stroke="#E2E8F0" />
                    <PolarAngleAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: '#64748b' }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fontSize: 8 }}
                    />
                    <Radar
                      name="Risk Profile"
                      dataKey="value"
                      stroke={COLORS.critical}
                      fill={COLORS.critical}
                      fillOpacity={0.3}
                    />
                    <Tooltip content={<CustomTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Risk Factor Summary */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {radarData.slice(0, 4).map((factor, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-2 flex items-center justify-between">
                    <span className="text-[10px] text-slate-600 truncate mr-1">{factor.name}</span>
                    <span className={`text-xs font-bold ${
                      factor.value > 50 ? 'text-red-600' :
                      factor.value > 30 ? 'text-orange-600' : 'text-green-600'
                    }`}>
                      {factor.value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </AnalyticsCard>
  );
};

export default RiskFactorAnalysis;
