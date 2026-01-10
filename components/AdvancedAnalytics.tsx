import React, { useState, useMemo } from 'react';
import { Patient, Unit } from '../types';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area, ScatterChart, Scatter, ComposedChart, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import NeolinkAIButton from './NeolinkAIButton';

interface AdvancedAnalyticsProps {
  patients: Patient[];
  selectedUnit: Unit;
  dateFilter: {
    period: string;
    startDate?: string;
    endDate?: string;
  };
}

type AnalyticsView = 'overview' | 'trends' | 'outcomes' | 'clinical' | 'demographics' | 'performance' | 'comparisons' | 'timeline';

interface DrillDownModal {
  title: string;
  patients: Patient[];
  metric: string;
}

const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({ patients, selectedUnit, dateFilter }) => {
  const [activeView, setActiveView] = useState<AnalyticsView>('overview');
  const [drillDownModal, setDrillDownModal] = useState<DrillDownModal | null>(null);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<string | null>(null);

  // Calculate comprehensive metrics
  const metrics = useMemo(() => {
    const total = patients.length;
    const deceased = patients.filter(p => p.outcome === 'Deceased').length;
    const discharged = patients.filter(p => p.outcome === 'Discharged').length;
    const referred = patients.filter(p => p.outcome === 'Referred').length;
    const inProgress = patients.filter(p => p.outcome === 'In Progress').length;
    const stepDown = patients.filter(p => p.outcome === 'Step Down').length;
    const readmitted = patients.filter(p => p.readmissionFromStepDown).length;

    // Calculate lengths of stay
    const losData = patients.filter(p => p.outcome !== 'In Progress').map(p => {
      const admission = new Date(p.admissionDate);
      const release = p.releaseDate ? new Date(p.releaseDate) :
        p.finalDischargeDate ? new Date(p.finalDischargeDate) :
          p.stepDownDate ? new Date(p.stepDownDate) :
            new Date();
      return Math.ceil((release.getTime() - admission.getTime()) / (1000 * 60 * 60 * 24));
    });

    const avgLOS = losData.length > 0 ? (losData.reduce((a, b) => a + b, 0) / losData.length).toFixed(1) : '0';
    const medianLOS = losData.length > 0 ?
      losData.sort((a, b) => a - b)[Math.floor(losData.length / 2)] : 0;
    const maxLOS = losData.length > 0 ? Math.max(...losData) : 0;
    const minLOS = losData.length > 0 ? Math.min(...losData) : 0;

    // Current bed occupancy
    const currentOccupancy = inProgress;

    // Calculate time-based admission rate
    const oldestAdmission = patients.length > 0 ?
      new Date(Math.min(...patients.map(p => new Date(p.admissionDate).getTime()))) : new Date();
    const daysSinceOldest = Math.max(1, Math.ceil((new Date().getTime() - oldestAdmission.getTime()) / (1000 * 60 * 60 * 24)));
    const avgAdmissionsPerDay = (total / daysSinceOldest).toFixed(1);

    // Mortality rate
    const mortalityRate = total > 0 ? ((deceased / total) * 100).toFixed(1) : '0';
    const dischargeRate = total > 0 ? ((discharged / total) * 100).toFixed(1) : '0';
    const stepDownRate = total > 0 ? ((stepDown / total) * 100).toFixed(1) : '0';
    const readmissionRate = stepDown > 0 ? ((readmitted / stepDown) * 100).toFixed(1) : '0';
    const successRate = total > 0 ? (((discharged + stepDown) / total) * 100).toFixed(1) : '0';

    // Age distribution for NICU
    const under24hrs = patients.filter(p => p.ageUnit === 'days' && p.age < 1).length;
    const under7days = patients.filter(p => p.ageUnit === 'days' && p.age < 7).length;
    const under28days = patients.filter(p => p.ageUnit === 'days' && p.age <= 28 || (p.ageUnit === 'weeks' && p.age < 4)).length;

    // Admission types (NICU)
    const inborn = patients.filter(p => p.admissionType === 'Inborn').length;
    const outborn = patients.filter(p => p.admissionType === 'Outborn').length;

    // Inborn vs Outborn mortality
    const inbornDeceased = patients.filter(p => p.admissionType === 'Inborn' && p.outcome === 'Deceased').length;
    const outbornDeceased = patients.filter(p => p.admissionType === 'Outborn' && p.outcome === 'Deceased').length;
    const inbornMortality = inborn > 0 ? ((inbornDeceased / inborn) * 100).toFixed(1) : '0';
    const outbornMortality = outborn > 0 ? ((outbornDeceased / outborn) * 100).toFixed(1) : '0';

    // Gender breakdown
    const male = patients.filter(p => p.gender === 'Male').length;
    const female = patients.filter(p => p.gender === 'Female').length;
    const other = patients.filter(p => p.gender === 'Other' || p.gender === 'Ambiguous').length;

    // Weight analysis (NICU)
    const patientsWithWeight = patients.filter(p => p.weight);
    const avgWeight = patientsWithWeight.length > 0 ?
      (patientsWithWeight.reduce((sum, p) => sum + (p.weight || 0), 0) / patientsWithWeight.length).toFixed(2) : '0';
    const lowBirthWeight = patients.filter(p => p.weight && p.weight < 2.5).length; // < 2.5 kg

    // Very low birth weight
    const veryLowBirthWeight = patients.filter(p => p.weight && p.weight < 1.5).length; // < 1.5 kg
    const extremeLowBirthWeight = patients.filter(p => p.weight && p.weight < 1.0).length; // < 1.0 kg

    // Critical patients (mortality risk factors)
    const criticalWeight = patients.filter(p => p.weight && p.weight < 1.5 && p.outcome === 'In Progress').length;
    const criticalAge = patients.filter(p => p.ageUnit === 'days' && p.age < 1 && p.outcome === 'In Progress').length;

    return {
      total,
      deceased,
      discharged,
      referred,
      inProgress,
      stepDown,
      readmitted,
      mortalityRate: parseFloat(mortalityRate),
      dischargeRate: parseFloat(dischargeRate),
      stepDownRate: parseFloat(stepDownRate),
      readmissionRate: parseFloat(readmissionRate),
      successRate: parseFloat(successRate),
      avgLOS: parseFloat(avgLOS),
      medianLOS,
      maxLOS,
      minLOS,
      currentOccupancy,
      avgAdmissionsPerDay: parseFloat(avgAdmissionsPerDay),
      under24hrs,
      under7days,
      under28days,
      inborn,
      outborn,
      inbornDeceased,
      outbornDeceased,
      inbornMortality: parseFloat(inbornMortality),
      outbornMortality: parseFloat(outbornMortality),
      male,
      female,
      other,
      avgWeight: parseFloat(avgWeight),
      lowBirthWeight,
      veryLowBirthWeight,
      extremeLowBirthWeight,
      criticalWeight,
      criticalAge,
    };
  }, [patients]);

  // Generate hourly admission heatmap data
  const admissionHeatmap = useMemo(() => {
    const heatmapData: { day: string; hour: number; count: number }[] = [];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Initialize all day-hour combinations
    days.forEach(day => {
      for (let hour = 0; hour < 24; hour++) {
        heatmapData.push({ day, hour, count: 0 });
      }
    });

    patients.forEach(p => {
      const date = new Date(p.admissionDate);
      const dayIndex = date.getDay();
      const hour = date.getHours();
      const entry = heatmapData.find(h => h.day === days[dayIndex] && h.hour === hour);
      if (entry) entry.count++;
    });

    // Get data by hour (summed across all days)
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour: hour.toString().padStart(2, '0') + ':00',
      admissions: heatmapData.filter(h => h.hour === hour).reduce((sum, h) => sum + h.count, 0)
    }));

    return hourlyData;
  }, [patients]);

  // Generate daily trend data
  const dailyTrends = useMemo(() => {
    const trends: { [key: string]: { admissions: number; discharges: number; deaths: number; date: string; inProgress: number } } = {};

    patients.forEach(p => {
      const admitDate = new Date(p.admissionDate).toISOString().split('T')[0];
      if (!trends[admitDate]) {
        trends[admitDate] = { admissions: 0, discharges: 0, deaths: 0, date: admitDate, inProgress: 0 };
      }
      trends[admitDate].admissions++;

      if (p.outcome === 'Discharged' && p.releaseDate) {
        const dischargeDate = new Date(p.releaseDate).toISOString().split('T')[0];
        if (!trends[dischargeDate]) {
          trends[dischargeDate] = { admissions: 0, discharges: 0, deaths: 0, date: dischargeDate, inProgress: 0 };
        }
        trends[dischargeDate].discharges++;
      }

      if (p.outcome === 'Deceased' && p.releaseDate) {
        const deathDate = new Date(p.releaseDate).toISOString().split('T')[0];
        if (!trends[deathDate]) {
          trends[deathDate] = { admissions: 0, discharges: 0, deaths: 0, date: deathDate, inProgress: 0 };
        }
        trends[deathDate].deaths++;
      }
    });

    const sortedTrends = Object.values(trends)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running in-progress count
    let runningInProgress = 0;
    sortedTrends.forEach(trend => {
      runningInProgress += trend.admissions - trend.discharges - trend.deaths;
      trend.inProgress = runningInProgress;
    });

    return sortedTrends.slice(-30); // Last 30 days
  }, [patients]);

  // Length of stay distribution
  const losDistribution = useMemo(() => {
    const ranges = [
      { name: '0-3 days', min: 0, max: 3, count: 0, color: '#10b981' },
      { name: '4-7 days', min: 4, max: 7, count: 0, color: '#3b82f6' },
      { name: '8-14 days', min: 8, max: 14, count: 0, color: '#8b5cf6' },
      { name: '15-21 days', min: 15, max: 21, count: 0, color: '#f59e0b' },
      { name: '22-28 days', min: 22, max: 28, count: 0, color: '#ef4444' },
      { name: '29+ days', min: 29, max: 9999, count: 0, color: '#dc2626' },
    ];

    patients.forEach(p => {
      if (p.outcome === 'In Progress') return;

      const admission = new Date(p.admissionDate);
      const release = p.releaseDate ? new Date(p.releaseDate) :
        p.finalDischargeDate ? new Date(p.finalDischargeDate) :
          p.stepDownDate ? new Date(p.stepDownDate) :
            new Date();
      const days = Math.ceil((release.getTime() - admission.getTime()) / (1000 * 60 * 60 * 24));

      const range = ranges.find(r => days >= r.min && days <= r.max);
      if (range) range.count++;
    });

    return ranges;
  }, [patients]);

  // Diagnosis breakdown with mortality rate
  const diagnosisBreakdown = useMemo(() => {
    const counts: { [key: string]: { total: number; deceased: number } } = {};
    patients.forEach(p => {
      const diagnosis = p.diagnosis || 'Unknown';
      if (!counts[diagnosis]) {
        counts[diagnosis] = { total: 0, deceased: 0 };
      }
      counts[diagnosis].total++;
      if (p.outcome === 'Deceased') {
        counts[diagnosis].deceased++;
      }
    });

    return Object.entries(counts)
      .map(([name, data]) => ({
        name,
        total: data.total,
        deceased: data.deceased,
        mortalityRate: data.total > 0 ? ((data.deceased / data.total) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [patients]);

  // Weight distribution (NICU)
  const weightDistribution = useMemo(() => {
    if (selectedUnit !== Unit.NICU && selectedUnit !== Unit.SNCU) return [];

    return [
      { name: '<1kg (ELBW)', value: metrics.extremeLowBirthWeight, color: '#dc2626' },
      { name: '1-1.5kg (VLBW)', value: metrics.veryLowBirthWeight - metrics.extremeLowBirthWeight, color: '#ef4444' },
      { name: '1.5-2.5kg (LBW)', value: metrics.lowBirthWeight - metrics.veryLowBirthWeight, color: '#f59e0b' },
      { name: '2.5kg+', value: patients.filter(p => p.weight && p.weight >= 2.5).length, color: '#10b981' },
    ].filter(item => item.value > 0);
  }, [selectedUnit, metrics, patients]);

  // Referring hospital analysis
  const referringHospitals = useMemo(() => {
    const hospitals: { [key: string]: number } = {};
    patients.filter(p => p.admissionType === 'Outborn' && p.referringHospital).forEach(p => {
      const hospital = p.referringHospital || 'Unknown';
      hospitals[hospital] = (hospitals[hospital] || 0) + 1;
    });

    return Object.entries(hospitals)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [patients]);

  // Outcome comparisons by different dimensions
  const outcomesComparisons = useMemo(() => {
    // Admission vs each outcome
    const outcomes = {
      admitted: metrics.total,
      discharged: metrics.discharged,
      referred: metrics.referred,
      stepDown: metrics.stepDown,
      deceased: metrics.deceased,
      inProgress: metrics.inProgress,
    };

    // LOS by outcome
    const losByOutcome = [
      { outcome: 'Discharged', avgLOS: 0, count: 0 },
      { outcome: 'Step Down', avgLOS: 0, count: 0 },
      { outcome: 'Referred', avgLOS: 0, count: 0 },
      { outcome: 'Deceased', avgLOS: 0, count: 0 },
    ];

    patients.forEach(p => {
      if (p.outcome === 'In Progress') return;
      const admission = new Date(p.admissionDate);
      const release = p.releaseDate ? new Date(p.releaseDate) :
        p.finalDischargeDate ? new Date(p.finalDischargeDate) :
          p.stepDownDate ? new Date(p.stepDownDate) :
            new Date();
      const days = Math.ceil((release.getTime() - admission.getTime()) / (1000 * 60 * 60 * 24));

      const outcomeItem = losByOutcome.find(o => o.outcome === p.outcome);
      if (outcomeItem) {
        outcomeItem.avgLOS += days;
        outcomeItem.count++;
      }
    });

    losByOutcome.forEach(o => {
      o.avgLOS = o.count > 0 ? parseFloat((o.avgLOS / o.count).toFixed(1)) : 0;
    });

    // Gender-based outcomes
    const genderOutcomes = [
      { gender: 'Male', discharged: 0, deceased: 0, total: metrics.male },
      { gender: 'Female', discharged: 0, deceased: 0, total: metrics.female },
    ];

    patients.forEach(p => {
      const genderItem = genderOutcomes.find(g => g.gender === p.gender);
      if (genderItem) {
        if (p.outcome === 'Discharged') genderItem.discharged++;
        if (p.outcome === 'Deceased') genderItem.deceased++;
      }
    });

    // Monthly trends
    const monthlyData: { [key: string]: { admissions: number; discharges: number; deaths: number; month: string } } = {};
    patients.forEach(p => {
      const admitMonth = new Date(p.admissionDate).toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData[admitMonth]) {
        monthlyData[admitMonth] = { admissions: 0, discharges: 0, deaths: 0, month: admitMonth };
      }
      monthlyData[admitMonth].admissions++;

      if (p.outcome === 'Discharged' && p.releaseDate) {
        const dischargeMonth = new Date(p.releaseDate).toISOString().substring(0, 7);
        if (!monthlyData[dischargeMonth]) {
          monthlyData[dischargeMonth] = { admissions: 0, discharges: 0, deaths: 0, month: dischargeMonth };
        }
        monthlyData[dischargeMonth].discharges++;
      }

      if (p.outcome === 'Deceased' && p.releaseDate) {
        const deathMonth = new Date(p.releaseDate).toISOString().substring(0, 7);
        if (!monthlyData[deathMonth]) {
          monthlyData[deathMonth] = { admissions: 0, discharges: 0, deaths: 0, month: deathMonth };
        }
        monthlyData[deathMonth].deaths++;
      }
    });

    const monthlyTrends = Object.values(monthlyData)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12) // Last 12 months
      .map(m => ({
        ...m,
        monthName: new Date(m.month + '-01').toLocaleDateString('default', { month: 'short', year: 'numeric' })
      }));

    // Day of week analysis
    const dayOfWeekData = [
      { day: 'Sunday', admissions: 0, discharges: 0 },
      { day: 'Monday', admissions: 0, discharges: 0 },
      { day: 'Tuesday', admissions: 0, discharges: 0 },
      { day: 'Wednesday', admissions: 0, discharges: 0 },
      { day: 'Thursday', admissions: 0, discharges: 0 },
      { day: 'Friday', admissions: 0, discharges: 0 },
      { day: 'Saturday', admissions: 0, discharges: 0 },
    ];

    patients.forEach(p => {
      const admitDay = new Date(p.admissionDate).getDay();
      dayOfWeekData[admitDay].admissions++;

      if (p.outcome === 'Discharged' && p.releaseDate) {
        const dischargeDay = new Date(p.releaseDate).getDay();
        dayOfWeekData[dischargeDay].discharges++;
      }
    });

    // Referring hospital quality (for outborn)
    const referringQuality: { [key: string]: { admissions: number; deaths: number; discharged: number } } = {};
    patients.filter(p => p.admissionType === 'Outborn' && p.referringHospital).forEach(p => {
      const hospital = p.referringHospital || 'Unknown';
      if (!referringQuality[hospital]) {
        referringQuality[hospital] = { admissions: 0, deaths: 0, discharged: 0 };
      }
      referringQuality[hospital].admissions++;
      if (p.outcome === 'Deceased') referringQuality[hospital].deaths++;
      if (p.outcome === 'Discharged') referringQuality[hospital].discharged++;
    });

    const referringQualityData = Object.entries(referringQuality)
      .map(([name, data]) => ({
        name,
        admissions: data.admissions,
        deaths: data.deaths,
        discharged: data.discharged,
        mortalityRate: data.admissions > 0 ? ((data.deaths / data.admissions) * 100).toFixed(1) : '0',
        dischargeRate: data.admissions > 0 ? ((data.discharged / data.admissions) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => b.admissions - a.admissions)
      .slice(0, 10);

    return {
      outcomes,
      losByOutcome: losByOutcome.filter(o => o.count > 0),
      genderOutcomes,
      monthlyTrends,
      dayOfWeekData,
      referringQualityData,
    };
  }, [patients, metrics]);

  // Outcome by diagnosis (for radar chart)
  const outcomeByDiagnosis = useMemo(() => {
    const topDiagnoses = diagnosisBreakdown.slice(0, 5);
    return topDiagnoses.map(d => ({
      diagnosis: d.name.length > 20 ? d.name.substring(0, 20) + '...' : d.name,
      'Discharge Rate': patients.filter(p => p.diagnosis === d.name && p.outcome === 'Discharged').length / d.total * 100,
      'Survival Rate': (d.total - d.deceased) / d.total * 100,
    }));
  }, [diagnosisBreakdown, patients]);

  // Render KPI Card
  const KPICard = ({ title, value, subtitle, trend, icon, color, onClick, badge }: any) => (
    <div
      className={`bg-gradient-to-br ${color} rounded-lg sm:rounded-xl p-2.5 sm:p-4 shadow-lg cursor-pointer transform transition-all duration-200 hover:scale-105 relative overflow-hidden`}
      onClick={onClick}
    >
      {badge && (
        <div className="absolute top-1 right-1 sm:top-2 sm:right-2">
          <span className="bg-white/20 backdrop-blur-sm text-white text-[9px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
            {badge}
          </span>
        </div>
      )}
      <div className="flex items-start justify-between mb-1 sm:mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-[9px] sm:text-xs font-semibold text-white/70 uppercase tracking-wide truncate">{title}</p>
          <p className="text-xl sm:text-3xl font-black text-white mt-0.5 sm:mt-1">{value}</p>
          {subtitle && <p className="text-[10px] sm:text-sm text-white/80 mt-0.5 sm:mt-1 truncate">{subtitle}</p>}
        </div>
        <div className="text-2xl sm:text-4xl opacity-30 flex-shrink-0">{icon}</div>
      </div>
      {trend !== undefined && trend !== null && (
        <div className={`flex items-center gap-1 text-[10px] sm:text-xs font-bold ${trend > 0 ? 'text-red-200' : trend < 0 ? 'text-green-200' : 'text-white/60'}`}>
          {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  );

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];

  // Drill-down modal component
  const DrillDownModalComponent = () => {
    if (!drillDownModal) return null;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDrillDownModal(null)}>
        <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden border-2 border-slate-700" onClick={e => e.stopPropagation()}>
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-white">{drillDownModal.title}</h3>
                <p className="text-blue-100 text-sm mt-1">{drillDownModal.patients.length} patients</p>
              </div>
              <button
                onClick={() => setDrillDownModal(null)}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            <div className="space-y-3">
              {drillDownModal.patients.map((patient, idx) => (
                <div key={patient.id || idx} className="bg-slate-700 rounded-lg p-4 border border-slate-600 hover:border-blue-400 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-white font-bold text-lg">{patient.name}</h4>
                      <div className="flex flex-wrap gap-3 mt-2 text-sm">
                        <span className="text-slate-300">Age: <span className="text-white font-semibold">{patient.age} {patient.ageUnit}</span></span>
                        <span className="text-slate-300">Gender: <span className="text-white font-semibold">{patient.gender}</span></span>
                        {patient.weight && <span className="text-slate-300">Weight: <span className="text-white font-semibold">{patient.weight} kg</span></span>}
                        <span className="text-slate-300">Diagnosis: <span className="text-white font-semibold">{patient.diagnosis}</span></span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${patient.outcome === 'In Progress' ? 'bg-blue-500 text-white' :
                      patient.outcome === 'Discharged' ? 'bg-green-500 text-white' :
                        patient.outcome === 'Deceased' ? 'bg-red-500 text-white' :
                          patient.outcome === 'Step Down' ? 'bg-purple-500 text-white' :
                            'bg-orange-500 text-white'
                      }`}>
                      {patient.outcome}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header with View Tabs */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-3 sm:p-6 shadow-2xl border border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4">
          <div>
            <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-2 sm:gap-3">
              <span className="text-xl sm:text-3xl">📊</span>
              <span className="hidden sm:inline">World-Class Analytics Dashboard</span>
              <span className="sm:hidden">Analytics</span>
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              {selectedUnit} • {dateFilter.period} • {metrics.total} Patients
            </p>
          </div>
        </div>

        {/* View Tabs - Scrollable on mobile */}
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">
          {[
            { value: 'overview', label: 'Overview', mobileLabel: '🏠', icon: '🏠' },
            { value: 'trends', label: 'Trends', mobileLabel: '📈', icon: '📈' },
            { value: 'outcomes', label: 'Outcomes', mobileLabel: '🎯', icon: '🎯' },
            { value: 'clinical', label: 'Clinical', mobileLabel: '🏥', icon: '🏥' },
            { value: 'demographics', label: 'Demographics', mobileLabel: '👥', icon: '👥' },
            { value: 'comparisons', label: 'Compare', mobileLabel: '⚖️', icon: '⚖️' },
            { value: 'timeline', label: 'Timeline', mobileLabel: '⏰', icon: '⏰' },
            { value: 'performance', label: 'KPIs', mobileLabel: '⚡', icon: '⚡' },
          ].map(view => (
            <button
              key={view.value}
              onClick={() => setActiveView(view.value as AnalyticsView)}
              className={`px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all duration-200 flex items-center gap-1 sm:gap-2 whitespace-nowrap flex-shrink-0 ${activeView === view.value
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
            >
              <span className="sm:hidden">{view.mobileLabel}</span>
              <span className="hidden sm:inline">{view.icon}</span>
              <span className="hidden sm:inline">{view.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Overview View */}
      {activeView === 'overview' && (
        <div className="space-y-6">
          {/* Primary KPI Cards Grid */}
          <div>
            <h3 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
              <span className="text-xl sm:text-2xl">📌</span> Primary Metrics
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
              <KPICard
                title="Total Patients"
                value={metrics.total}
                icon="👥"
                color="from-blue-600 to-blue-700"
                onClick={() => setDrillDownModal({ title: 'All Patients', patients, metric: 'total' })}
              />
              <KPICard
                title="Active (In Progress)"
                value={metrics.inProgress}
                subtitle={`${((metrics.inProgress / metrics.total) * 100).toFixed(0)}% of total`}
                icon="🔄"
                color="from-blue-500 to-cyan-500"
                onClick={() => setDrillDownModal({ title: 'In Progress Patients', patients: patients.filter(p => p.outcome === 'In Progress'), metric: 'inProgress' })}
                badge="LIVE"
              />
              <KPICard
                title="Successfully Discharged"
                value={metrics.discharged}
                subtitle={`${metrics.dischargeRate}% rate`}
                icon="✅"
                color="from-green-500 to-emerald-500"
                onClick={() => setDrillDownModal({ title: 'Discharged Patients', patients: patients.filter(p => p.outcome === 'Discharged'), metric: 'discharged' })}
              />
              <KPICard
                title="Step Down"
                value={metrics.stepDown}
                subtitle={`${metrics.stepDownRate}% rate`}
                icon="↗️"
                color="from-purple-500 to-indigo-500"
                onClick={() => setDrillDownModal({ title: 'Step Down Patients', patients: patients.filter(p => p.outcome === 'Step Down'), metric: 'stepDown' })}
              />
              <KPICard
                title="Mortality"
                value={metrics.deceased}
                subtitle={`${metrics.mortalityRate}% rate`}
                icon="💔"
                color="from-red-500 to-rose-500"
                onClick={() => setDrillDownModal({ title: 'Deceased Patients', patients: patients.filter(p => p.outcome === 'Deceased'), metric: 'deceased' })}
              />
              <KPICard
                title="Referred Out"
                value={metrics.referred}
                subtitle={`${((metrics.referred / metrics.total) * 100).toFixed(0)}% of total`}
                icon="🔀"
                color="from-orange-500 to-amber-500"
                onClick={() => setDrillDownModal({ title: 'Referred Patients', patients: patients.filter(p => p.outcome === 'Referred'), metric: 'referred' })}
              />
            </div>
          </div>

          {/* Clinical Performance Metrics */}
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="text-2xl">🏆</span> Clinical Performance
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <KPICard
                title="Success Rate"
                value={`${metrics.successRate}%`}
                subtitle="Discharged + Step Down"
                icon="🎯"
                color="from-emerald-600 to-green-600"
              />
              <KPICard
                title="Avg Length of Stay"
                value={`${metrics.avgLOS}`}
                subtitle="days"
                icon="⏱️"
                color="from-teal-600 to-cyan-600"
              />
              <KPICard
                title="Median LOS"
                value={metrics.medianLOS}
                subtitle="days (50th percentile)"
                icon="📊"
                color="from-cyan-600 to-sky-600"
              />
              <KPICard
                title="LOS Range"
                value={`${metrics.minLOS}-${metrics.maxLOS}`}
                subtitle="min to max days"
                icon="📏"
                color="from-indigo-600 to-blue-600"
              />
              <KPICard
                title="Bed Occupancy"
                value={metrics.currentOccupancy}
                subtitle="current active beds"
                icon="🛏️"
                color="from-violet-600 to-purple-600"
                badge="NOW"
              />
            </div>
          </div>

          {/* Admission Metrics */}
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="text-2xl">📥</span> Admission Analytics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <KPICard
                title="Avg Daily Admissions"
                value={metrics.avgAdmissionsPerDay}
                subtitle="patients per day"
                icon="📅"
                color="from-blue-600 to-indigo-600"
              />
              {metrics.readmitted > 0 && (
                <KPICard
                  title="Readmissions"
                  value={metrics.readmitted}
                  subtitle={`${metrics.readmissionRate}% of step-downs`}
                  icon="⚠️"
                  color="from-amber-600 to-orange-600"
                  badge="ALERT"
                  onClick={() => setDrillDownModal({ title: 'Readmitted Patients', patients: patients.filter(p => p.readmissionFromStepDown), metric: 'readmitted' })}
                />
              )}
              {(selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) && (
                <>
                  <KPICard
                    title="Inborn Admissions"
                    value={metrics.inborn}
                    subtitle={`${((metrics.inborn / metrics.total) * 100).toFixed(0)}% of total`}
                    icon="🏥"
                    color="from-green-600 to-emerald-600"
                    onClick={() => setDrillDownModal({ title: 'Inborn Patients', patients: patients.filter(p => p.admissionType === 'Inborn'), metric: 'inborn' })}
                  />
                  <KPICard
                    title="Outborn Admissions"
                    value={metrics.outborn}
                    subtitle={`${((metrics.outborn / metrics.total) * 100).toFixed(0)}% of total`}
                    icon="🚑"
                    color="from-orange-600 to-red-600"
                    onClick={() => setDrillDownModal({ title: 'Outborn Patients', patients: patients.filter(p => p.admissionType === 'Outborn'), metric: 'outborn' })}
                  />
                  <KPICard
                    title="Critical Age"
                    value={metrics.under24hrs}
                    subtitle="< 24 hours old"
                    icon="👶"
                    color="from-red-600 to-rose-600"
                    badge="HIGH RISK"
                    onClick={() => setDrillDownModal({ title: 'Critical Age Patients (<24hrs)', patients: patients.filter(p => p.ageUnit === 'days' && p.age < 1), metric: 'criticalAge' })}
                  />
                </>
              )}
            </div>
          </div>

          {/* NICU-Specific Weight Metrics */}
          {(selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) && metrics.avgWeight > 0 && (
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">⚖️</span> Birth Weight Analytics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <KPICard
                  title="Average Weight"
                  value={`${metrics.avgWeight}`}
                  subtitle="kg"
                  icon="📊"
                  color="from-blue-600 to-cyan-600"
                />
                <KPICard
                  title="Low Birth Weight"
                  value={metrics.lowBirthWeight}
                  subtitle="< 2.5 kg"
                  icon="⚠️"
                  color="from-yellow-600 to-orange-600"
                  onClick={() => setDrillDownModal({ title: 'Low Birth Weight (<2.5kg)', patients: patients.filter(p => p.weight && p.weight < 2.5), metric: 'lbw' })}
                />
                <KPICard
                  title="Very Low BW"
                  value={metrics.veryLowBirthWeight}
                  subtitle="< 1.5 kg (VLBW)"
                  icon="⚠️"
                  color="from-orange-600 to-red-600"
                  badge="VLBW"
                  onClick={() => setDrillDownModal({ title: 'Very Low Birth Weight (<1.5kg)', patients: patients.filter(p => p.weight && p.weight < 1.5), metric: 'vlbw' })}
                />
                <KPICard
                  title="Extreme Low BW"
                  value={metrics.extremeLowBirthWeight}
                  subtitle="< 1.0 kg (ELBW)"
                  icon="🚨"
                  color="from-red-600 to-rose-600"
                  badge="ELBW"
                  onClick={() => setDrillDownModal({ title: 'Extreme Low Birth Weight (<1kg)', patients: patients.filter(p => p.weight && p.weight < 1.0), metric: 'elbw' })}
                />
                <KPICard
                  title="Critical Weight Active"
                  value={metrics.criticalWeight}
                  subtitle="< 1.5kg in progress"
                  icon="🔴"
                  color="from-rose-600 to-red-700"
                  badge="URGENT"
                  onClick={() => setDrillDownModal({ title: 'Critical Weight Active Patients', patients: patients.filter(p => p.weight && p.weight < 1.5 && p.outcome === 'In Progress'), metric: 'criticalActive' })}
                />
              </div>
            </div>
          )}

          {/* Main Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Outcome Distribution Pie */}
            <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-xl">🎯</span> Outcome Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'In Progress', value: metrics.inProgress, fill: '#3b82f6' },
                      { name: 'Discharged', value: metrics.discharged, fill: '#10b981' },
                      { name: 'Step Down', value: metrics.stepDown, fill: '#8b5cf6' },
                      { name: 'Referred', value: metrics.referred, fill: '#f59e0b' },
                      { name: 'Deceased', value: metrics.deceased, fill: '#ef4444' },
                    ].filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent, value }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {COLORS.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Length of Stay Distribution */}
            <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-xl">⏱️</span> Length of Stay Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={losDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={80} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {losDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Trends View */}
      {activeView === 'trends' && (
        <div className="space-y-6">
          {/* Daily Admissions & Discharges Trend */}
          <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-xl">📈</span> Daily Trends (Last 30 Days)
              </h3>
              <NeolinkAIButton
                chartTitle="Daily Admission & Discharge Trends"
                chartType="area and line chart"
                dataPoints={dailyTrends.slice(-7).map(d => ({
                  label: d.date,
                  value: `Adm: ${d.admissions}, Dis: ${d.discharges}, Deaths: ${d.deaths}, Active: ${d.inProgress}`
                }))}
                context={`${selectedUnit} daily patient flow trends - admissions, discharges, deaths, and active census`}
              />
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={dailyTrends}>
                <defs>
                  <linearGradient id="colorAdmissions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="colorDischarges" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                <YAxis yAxisId="left" stroke="#94a3b8" tick={{ fontSize: 11 }} label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#8b5cf6" tick={{ fontSize: 11 }} label={{ value: 'Active Census', angle: 90, position: 'insideRight', fill: '#8b5cf6' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area yAxisId="left" type="monotone" dataKey="admissions" stroke="#3b82f6" fillOpacity={1} fill="url(#colorAdmissions)" name="Admissions" />
                <Area yAxisId="left" type="monotone" dataKey="discharges" stroke="#10b981" fillOpacity={1} fill="url(#colorDischarges)" name="Discharges" />
                <Line yAxisId="left" type="monotone" dataKey="deaths" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} name="Deaths" />
                <Line yAxisId="right" type="monotone" dataKey="inProgress" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 3 }} name="Active Census" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Hourly Admission Pattern */}
          <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-xl">🔥</span> Hourly Admission Pattern (24h)
              </h3>
              <NeolinkAIButton
                chartTitle="Hourly Admission Pattern"
                chartType="bar chart"
                dataPoints={admissionHeatmap.map(d => ({ label: d.hour, value: d.admissions }))}
                context={`24-hour admission distribution pattern for ${selectedUnit}`}
              />
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={admissionHeatmap}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="hour" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} label={{ value: 'Admissions', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                <Bar dataKey="admissions" radius={[8, 8, 0, 0]}>
                  {admissionHeatmap.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.admissions > 5 ? '#ef4444' : entry.admissions > 3 ? '#f59e0b' : entry.admissions > 1 ? '#3b82f6' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 flex items-center gap-4 justify-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span className="text-slate-300">Low (1-2)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-blue-500"></div>
                <span className="text-slate-300">Medium (3-5)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-orange-500"></div>
                <span className="text-slate-300">High (6-10)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500"></div>
                <span className="text-slate-300">Very High (10+)</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-xl">📊</span> Cumulative Admissions vs Discharges
              </h3>
              <NeolinkAIButton
                chartTitle="Cumulative Admissions vs Discharges"
                chartType="line chart"
                dataPoints={dailyTrends.slice(-7).map(d => ({ label: d.date, value: `Adm: ${d.admissions}, Dis: ${d.discharges}` }))}
                context="Running total comparison of admissions vs discharges over time"
              />
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={dailyTrends.map((d, idx, arr) => ({
                date: d.date,
                totalAdmissions: arr.slice(0, idx + 1).reduce((sum, item) => sum + item.admissions, 0),
                totalDischarges: arr.slice(0, idx + 1).reduce((sum, item) => sum + item.discharges, 0),
                gap: arr.slice(0, idx + 1).reduce((sum, item) => sum + item.admissions, 0) - arr.slice(0, idx + 1).reduce((sum, item) => sum + item.discharges, 0),
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                <Legend />
                <Line type="monotone" dataKey="totalAdmissions" stroke="#3b82f6" strokeWidth={3} dot={false} name="Total Admissions" />
                <Line type="monotone" dataKey="totalDischarges" stroke="#10b981" strokeWidth={3} dot={false} name="Total Discharges" />
                <Line type="monotone" dataKey="gap" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Gap (Net Census Change)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Outcomes View */}
      {activeView === 'outcomes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-xl">📊</span> Outcome Breakdown
                </h3>
                <NeolinkAIButton
                  chartTitle="Patient Outcome Breakdown"
                  chartType="horizontal bar chart"
                  dataPoints={[
                    { label: 'In Progress', value: metrics.inProgress },
                    { label: 'Discharged', value: metrics.discharged },
                    { label: 'Step Down', value: metrics.stepDown },
                    { label: 'Referred', value: metrics.referred },
                    { label: 'Deceased', value: metrics.deceased }
                  ]}
                  context={`${selectedUnit} patient outcomes distribution`}
                />
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={[
                  { outcome: 'In Progress', count: metrics.inProgress, fill: '#3b82f6' },
                  { outcome: 'Discharged', count: metrics.discharged, fill: '#10b981' },
                  { outcome: 'Step Down', count: metrics.stepDown, fill: '#8b5cf6' },
                  { outcome: 'Referred', count: metrics.referred, fill: '#f59e0b' },
                  { outcome: 'Deceased', count: metrics.deceased, fill: '#ef4444' },
                ]} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#94a3b8" />
                  <YAxis dataKey="outcome" type="category" stroke="#94a3b8" width={100} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} label={{ position: 'right', fill: '#fff' }}>
                    {[...Array(5)].map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-xl">✨</span> Success & Quality Metrics
                </h3>
                <NeolinkAIButton
                  chartTitle="Success & Quality Metrics"
                  chartType="progress bars"
                  dataPoints={[
                    { label: 'Success Rate', value: `${metrics.successRate}%` },
                    { label: 'Discharge Rate', value: `${metrics.dischargeRate}%` },
                    { label: 'Step Down Rate', value: `${metrics.stepDownRate}%` },
                    { label: 'Mortality Rate', value: `${metrics.mortalityRate}%` }
                  ]}
                  context={`${selectedUnit} clinical quality performance indicators`}
                />
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-300 font-semibold">Overall Success Rate</span>
                    <span className="text-emerald-400 font-bold text-lg">{metrics.successRate}%</span>
                  </div>
                  <div className="w-full h-6 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-1000 flex items-center justify-end pr-2" style={{ width: `${metrics.successRate}%` }}>
                      <span className="text-white text-xs font-bold">{metrics.discharged + metrics.stepDown} patients</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-300 font-semibold">Discharge Rate</span>
                    <span className="text-green-400 font-bold text-lg">{metrics.dischargeRate}%</span>
                  </div>
                  <div className="w-full h-6 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-1000 flex items-center justify-end pr-2" style={{ width: `${metrics.dischargeRate}%` }}>
                      <span className="text-white text-xs font-bold">{metrics.discharged} patients</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-300 font-semibold">Step Down Rate</span>
                    <span className="text-purple-400 font-bold text-lg">{metrics.stepDownRate}%</span>
                  </div>
                  <div className="w-full h-6 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-1000 flex items-center justify-end pr-2" style={{ width: `${metrics.stepDownRate}%` }}>
                      <span className="text-white text-xs font-bold">{metrics.stepDown} patients</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-300 font-semibold">Survival Rate</span>
                    <span className="text-blue-400 font-bold text-lg">{(100 - metrics.mortalityRate).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-6 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-1000 flex items-center justify-end pr-2" style={{ width: `${100 - metrics.mortalityRate}%` }}>
                      <span className="text-white text-xs font-bold">{metrics.total - metrics.deceased} patients</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-300 font-semibold">Mortality Rate</span>
                    <span className="text-red-400 font-bold text-lg">{metrics.mortalityRate}%</span>
                  </div>
                  <div className="w-full h-6 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-500 to-rose-500 transition-all duration-1000 flex items-center justify-end pr-2" style={{ width: `${metrics.mortalityRate}%` }}>
                      <span className="text-white text-xs font-bold">{metrics.deceased} patients</span>
                    </div>
                  </div>
                </div>
                {metrics.readmissionRate > 0 && (
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-slate-300 font-semibold">Readmission Rate</span>
                      <span className="text-amber-400 font-bold text-lg">{metrics.readmissionRate}%</span>
                    </div>
                    <div className="w-full h-6 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000 flex items-center justify-end pr-2" style={{ width: `${metrics.readmissionRate}%` }}>
                        <span className="text-white text-xs font-bold">{metrics.readmitted} patients</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Outcome by Top Diagnoses - Radar Chart */}
          {outcomeByDiagnosis.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-xl">🎯</span> Outcome Quality by Top 5 Diagnoses (Radar Analysis)
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={outcomeByDiagnosis}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="diagnosis" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <Radar name="Discharge Rate %" dataKey="Discharge Rate" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                  <Radar name="Survival Rate %" dataKey="Survival Rate" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Clinical View */}
      {activeView === 'clinical' && (
        <div className="space-y-6">
          {/* Top Diagnoses with Mortality */}
          <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-xl">🏥</span> Top 10 Diagnoses with Mortality Analysis
            </h3>
            <ResponsiveContainer width="100%" height={450}>
              <ComposedChart data={diagnosisBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{ fontSize: 10 }} width={180} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                <Legend />
                <Bar dataKey="total" name="Total Cases" radius={[0, 4, 4, 0]} fill="#3b82f6" />
                <Bar dataKey="deceased" name="Deaths" radius={[0, 4, 4, 0]} fill="#ef4444" />
                <Line dataKey="mortalityRate" name="Mortality %" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: '#f59e0b' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Diagnosis Details Table */}
          <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-xl">📋</span> Detailed Diagnosis Statistics
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-3 text-slate-300 font-semibold">#</th>
                    <th className="text-left p-3 text-slate-300 font-semibold">Diagnosis</th>
                    <th className="text-center p-3 text-slate-300 font-semibold">Total Cases</th>
                    <th className="text-center p-3 text-slate-300 font-semibold">Deaths</th>
                    <th className="text-center p-3 text-slate-300 font-semibold">Mortality Rate</th>
                    <th className="text-center p-3 text-slate-300 font-semibold">Survival Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnosisBreakdown.map((d, idx) => (
                    <tr key={idx} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors cursor-pointer"
                      onClick={() => setDrillDownModal({ title: `Patients with ${d.name}`, patients: patients.filter(p => p.diagnosis === d.name), metric: 'diagnosis' })}>
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 text-white font-semibold">{d.name}</td>
                      <td className="text-center p-3 text-blue-400 font-bold">{d.total}</td>
                      <td className="text-center p-3 text-red-400 font-bold">{d.deceased}</td>
                      <td className="text-center p-3">
                        <span className={`px-3 py-1 rounded-full font-bold ${parseFloat(d.mortalityRate) > 20 ? 'bg-red-500/20 text-red-400' :
                          parseFloat(d.mortalityRate) > 10 ? 'bg-orange-500/20 text-orange-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                          {d.mortalityRate}%
                        </span>
                      </td>
                      <td className="text-center p-3">
                        <span className="text-green-400 font-bold">
                          {(100 - parseFloat(d.mortalityRate)).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Demographics View */}
      {activeView === 'demographics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-xl">👥</span> Gender Distribution
                </h3>
                <NeolinkAIButton
                  chartTitle="Gender Distribution"
                  chartType="pie chart"
                  dataPoints={[
                    { label: 'Male', value: metrics.male },
                    { label: 'Female', value: metrics.female },
                    { label: 'Other', value: metrics.other }
                  ]}
                  context={`${selectedUnit} patient gender breakdown`}
                />
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Male', value: metrics.male, fill: '#3b82f6' },
                      { name: 'Female', value: metrics.female, fill: '#ec4899' },
                      { name: 'Other', value: metrics.other, fill: '#8b5cf6' },
                    ].filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent, value }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    dataKey="value"
                  />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-black text-blue-400">{metrics.male}</div>
                  <div className="text-xs text-blue-300 mt-1">Male</div>
                </div>
                <div className="bg-pink-500/20 border border-pink-500/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-black text-pink-400">{metrics.female}</div>
                  <div className="text-xs text-pink-300 mt-1">Female</div>
                </div>
                <div className="bg-purple-500/20 border border-purple-500/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-black text-purple-400">{metrics.other}</div>
                  <div className="text-xs text-purple-300 mt-1">Other</div>
                </div>
              </div>
            </div>

            {/* Weight Distribution (NICU) */}
            {(selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) && weightDistribution.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">⚖️</span> Birth Weight Categories
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={weightDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent, value }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      dataKey="value"
                    >
                      {weightDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Admission Source (NICU) */}
            {(selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) && (
              <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">🏥</span> Admission Source with Mortality Comparison
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: 'Inborn', patients: metrics.inborn, deaths: metrics.inbornDeceased, mortality: metrics.inbornMortality },
                    { name: 'Outborn', patients: metrics.outborn, deaths: metrics.outbornDeceased, mortality: metrics.outbornMortality },
                  ].filter(item => item.patients > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                    <Legend />
                    <Bar dataKey="patients" name="Total Patients" fill="#10b981" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="deaths" name="Deaths" fill="#ef4444" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3">
                    <div className="text-sm text-green-300 mb-1">Inborn Mortality</div>
                    <div className="text-2xl font-black text-green-400">{metrics.inbornMortality}%</div>
                  </div>
                  <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-3">
                    <div className="text-sm text-orange-300 mb-1">Outborn Mortality</div>
                    <div className="text-2xl font-black text-orange-400">{metrics.outbornMortality}%</div>
                  </div>
                </div>
              </div>
            )}

            {/* Referring Hospitals (for Outborn) */}
            {(selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) && referringHospitals.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700 lg:col-span-2">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span className="text-xl">🚑</span> Top 10 Referring Hospitals (Outborn Admissions)
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={referringHospitals} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{ fontSize: 10 }} width={200} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]} fill="#f59e0b" label={{ position: 'right', fill: '#fff' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Risk Stratification View */}
      {activeView === 'risk' && (
        <div className="space-y-6">
          {/* Risk Level Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-red-600 to-rose-600 rounded-xl p-6 shadow-2xl border-2 border-red-500 cursor-pointer hover:scale-105 transition-all"
              onClick={() => setDrillDownModal({ title: 'High Risk Patients', patients: riskStratification.highRiskPatients, metric: 'highRisk' })}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-red-100 text-sm font-semibold uppercase tracking-wide">High Risk</div>
                  <div className="text-5xl font-black text-white mt-2">{riskStratification.high}</div>
                  <div className="text-red-100 text-sm mt-2">Require intensive monitoring</div>
                </div>
                <div className="text-6xl opacity-30">🚨</div>
              </div>
              <div className="mt-4 pt-4 border-t border-red-400/30">
                <div className="text-red-100 text-xs space-y-1">
                  <div>• ELBW/VLBW patients</div>
                  <div>• Age {'<'} 24 hours</div>
                  <div>• Critical diagnoses</div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-600 to-amber-600 rounded-xl p-6 shadow-2xl border-2 border-orange-500 cursor-pointer hover:scale-105 transition-all"
              onClick={() => setDrillDownModal({
                title: 'Medium Risk Patients', patients: patients.filter(p =>
                  p.outcome === 'In Progress' && (
                    (p.weight && p.weight >= 1.5 && p.weight < 2.5) ||
                    (p.ageUnit === 'days' && p.age >= 1 && p.age < 7)
                  ) && !riskStratification.highRiskPatients.includes(p)
                ), metric: 'mediumRisk'
              })}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-orange-100 text-sm font-semibold uppercase tracking-wide">Medium Risk</div>
                  <div className="text-5xl font-black text-white mt-2">{riskStratification.medium}</div>
                  <div className="text-orange-100 text-sm mt-2">Need close observation</div>
                </div>
                <div className="text-6xl opacity-30">⚠️</div>
              </div>
              <div className="mt-4 pt-4 border-t border-orange-400/30">
                <div className="text-orange-100 text-xs space-y-1">
                  <div>• LBW patients (1.5-2.5kg)</div>
                  <div>• Early neonatal period</div>
                  <div>• Moderate conditions</div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl p-6 shadow-2xl border-2 border-green-500 cursor-pointer hover:scale-105 transition-all"
              onClick={() => setDrillDownModal({
                title: 'Low Risk Patients', patients: patients.filter(p =>
                  p.outcome === 'In Progress' &&
                  !riskStratification.highRiskPatients.includes(p) &&
                  !(
                    (p.weight && p.weight >= 1.5 && p.weight < 2.5) ||
                    (p.ageUnit === 'days' && p.age >= 1 && p.age < 7)
                  )
                ), metric: 'lowRisk'
              })}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-green-100 text-sm font-semibold uppercase tracking-wide">Low Risk</div>
                  <div className="text-5xl font-black text-white mt-2">{riskStratification.low}</div>
                  <div className="text-green-100 text-sm mt-2">Stable condition</div>
                </div>
                <div className="text-6xl opacity-30">✅</div>
              </div>
              <div className="mt-4 pt-4 border-t border-green-400/30">
                <div className="text-green-100 text-xs space-y-1">
                  <div>• Normal birth weight</div>
                  <div>• Stable vitals</div>
                  <div>• Routine care needed</div>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Distribution Chart */}
          <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-xl">📊</span> Current Risk Distribution (Active Patients Only)
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'High Risk', value: riskStratification.high, fill: '#ef4444' },
                    { name: 'Medium Risk', value: riskStratification.medium, fill: '#f59e0b' },
                    { name: 'Low Risk', value: riskStratification.low, fill: '#10b981' },
                  ].filter(item => item.value > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent, value }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={120}
                  dataKey="value"
                />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Critical Patients Alert */}
          {riskStratification.high > 0 && (
            <div className="bg-red-900/30 border-2 border-red-500 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="text-4xl">🚨</div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-red-400 mb-2">Critical Patient Alert</h3>
                  <p className="text-red-200 mb-4">
                    There are currently <strong>{riskStratification.high}</strong> high-risk patients requiring intensive monitoring and care.
                  </p>
                  <button
                    onClick={() => setDrillDownModal({ title: 'High Risk Patients - Urgent Attention Required', patients: riskStratification.highRiskPatients, metric: 'critical' })}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all"
                  >
                    View Critical Patients →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline Analysis View */}
      {activeView === 'timeline' && (
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-xl">⏱️</span> Length of Stay Timeline Analysis
              </h3>
              <NeolinkAIButton
                chartTitle="Length of Stay Analysis"
                chartType="bar chart with metrics"
                dataPoints={[
                  { label: 'Average LOS', value: `${metrics.avgLOS} days` },
                  { label: 'Median LOS', value: `${metrics.medianLOS} days` },
                  { label: 'Min LOS', value: `${metrics.minLOS} days` },
                  { label: 'Max LOS', value: `${metrics.maxLOS} days` },
                  ...losDistribution.map(d => ({ label: d.name, value: d.count }))
                ]}
                context={`${selectedUnit} length of stay distribution and statistics`}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg p-4">
                <div className="text-blue-100 text-xs uppercase tracking-wide mb-1">Average LOS</div>
                <div className="text-3xl font-black text-white">{metrics.avgLOS}</div>
                <div className="text-blue-100 text-sm">days</div>
              </div>
              <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg p-4">
                <div className="text-purple-100 text-xs uppercase tracking-wide mb-1">Median LOS</div>
                <div className="text-3xl font-black text-white">{metrics.medianLOS}</div>
                <div className="text-purple-100 text-sm">days (50th %ile)</div>
              </div>
              <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg p-4">
                <div className="text-green-100 text-xs uppercase tracking-wide mb-1">Minimum LOS</div>
                <div className="text-3xl font-black text-white">{metrics.minLOS}</div>
                <div className="text-green-100 text-sm">days</div>
              </div>
              <div className="bg-gradient-to-br from-red-600 to-rose-600 rounded-lg p-4">
                <div className="text-red-100 text-xs uppercase tracking-wide mb-1">Maximum LOS</div>
                <div className="text-3xl font-black text-white">{metrics.maxLOS}</div>
                <div className="text-red-100 text-sm">days</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={losDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} label={{ value: 'Number of Patients', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} label={{ position: 'top', fill: '#fff' }}>
                  {losDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Performance View */}
      {activeView === 'performance' && (
        <div className="space-y-6">
          {/* Performance Indicators Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-bold text-lg">Successful Outcomes</h4>
                <span className="text-4xl">✅</span>
              </div>
              <div className="text-4xl font-black text-white mb-2">
                {metrics.discharged + metrics.stepDown}
              </div>
              <div className="text-green-100 text-sm">
                {metrics.successRate}% success rate (Discharged + Step Down)
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-bold text-lg">Bed Turnover</h4>
                <span className="text-4xl">🔄</span>
              </div>
              <div className="text-4xl font-black text-white mb-2">
                {(metrics.discharged + metrics.referred + metrics.deceased + metrics.stepDown)}
              </div>
              <div className="text-blue-100 text-sm">
                Completed cases (excluding active)
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-bold text-lg">Quality Score</h4>
                <span className="text-4xl">⭐</span>
              </div>
              <div className="text-4xl font-black text-white mb-2">
                {(100 - metrics.mortalityRate).toFixed(0)}
              </div>
              <div className="text-purple-100 text-sm">
                Based on survival rate percentage
              </div>
            </div>
          </div>

          {/* Efficiency Metrics */}
          <div className="bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-xl">⚡</span> Operational Efficiency Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-slate-300 font-semibold mb-4">Length of Stay Efficiency</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                    <span className="text-slate-300">Average LOS</span>
                    <span className="text-xl font-bold text-white">{metrics.avgLOS} days</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                    <span className="text-slate-300">Median LOS</span>
                    <span className="text-xl font-bold text-white">{metrics.medianLOS} days</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                    <span className="text-slate-300">LOS Range</span>
                    <span className="text-xl font-bold text-white">{metrics.minLOS} - {metrics.maxLOS} days</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-slate-300 font-semibold mb-4">Throughput Metrics</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                    <span className="text-slate-300">Total Admissions</span>
                    <span className="text-xl font-bold text-blue-400">{metrics.total}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                    <span className="text-slate-300">Total Discharges</span>
                    <span className="text-xl font-bold text-green-400">{metrics.discharged}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                    <span className="text-slate-300">Avg Daily Admissions</span>
                    <span className="text-xl font-bold text-cyan-400">{metrics.avgAdmissionsPerDay}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drill-down Modal */}
      <DrillDownModalComponent />
    </div>
  );
};

export default AdvancedAnalytics;
