import React, { useState, useEffect } from 'react';
import { Patient, Unit } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeDeathDiagnosisPatterns } from '../services/geminiService';
import MortalityChartsPanel from './MortalityChartsPanel';
import IndividualMortalityViewer from './IndividualMortalityViewer';
import CustomizableExportModal from './CustomizableExportModal';
import AdvancedMortalityCharts from './analytics/cards/AdvancedMortalityCharts';
import RiskFactorAnalysis from './analytics/cards/RiskFactorAnalysis';
import KeyMetricsDashboard from './analytics/cards/KeyMetricsDashboard';

interface DeathDiagnosisAnalyticsProps {
  patients: Patient[];
  allPatients?: Patient[];
  institutionName: string;
  totalAdmissions?: number;
  timeRangeLabel?: string;
  unitFilter?: string;
  birthTypeFilter?: string;
  startDate?: string;
  endDate?: string;
}

interface CauseOfDeath {
  cause: string;
  count: number;
  percentage: number;
  ageGroups: { [key: string]: number };
  units: { [key: string]: number };
}

const DeathDiagnosisAnalytics: React.FC<DeathDiagnosisAnalyticsProps> = ({
  patients,
  allPatients = [],
  institutionName,
  totalAdmissions,
  timeRangeLabel = 'All Time',
  unitFilter = 'All Units',
  birthTypeFilter = 'all',
  startDate = '',
  endDate = ''
}) => {
  const [deceasedPatients, setDeceasedPatients] = useState<Patient[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [causeStats, setCauseStats] = useState<CauseOfDeath[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [filteredExportData, setFilteredExportData] = useState<{
    patients: Patient[];
    filterName: string;
    analysisData?: any;
    timeRange?: string;
    startDate?: string;
    endDate?: string;
  } | null>(null);

  useEffect(() => {
    const deceased = patients.filter(p => p.outcome === 'Deceased');
    setDeceasedPatients(deceased);

    // Extract and categorize causes
    const causesMap = new Map<string, CauseOfDeath>();

    deceased.forEach(patient => {
      let diagnosis = patient.aiInterpretedDeathDiagnosis || patient.diagnosisAtDeath || 'Unknown';

      // Remove "Primary Cause:" prefix if present
      diagnosis = diagnosis.replace(/^(Primary\s*Cause\s*[:\-]\s*)/i, '').trim();

      // Simple cause extraction (first sentence or first major phrase)
      const primaryCause = diagnosis.split('.')[0].split(',')[0].trim();

      if (!causesMap.has(primaryCause)) {
        causesMap.set(primaryCause, {
          cause: primaryCause,
          count: 0,
          percentage: 0,
          ageGroups: {},
          units: {}
        });
      }

      const causeData = causesMap.get(primaryCause)!;
      causeData.count++;

      // Track age groups
      const ageGroup = patient.ageUnit === 'days' ? 'Neonates (0-28 days)' :
                       patient.ageUnit === 'weeks' ? 'Infants (weeks)' :
                       patient.ageUnit === 'months' ? 'Infants (months)' :
                       'Children (years)';
      causeData.ageGroups[ageGroup] = (causeData.ageGroups[ageGroup] || 0) + 1;

      // Track units
      causeData.units[patient.unit] = (causeData.units[patient.unit] || 0) + 1;
    });

    // Calculate percentages and sort
    const total = deceased.length;
    const causesArray = Array.from(causesMap.values())
      .map(cause => ({
        ...cause,
        percentage: total > 0 ? (cause.count / total) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 causes

    setCauseStats(causesArray);
  }, [patients]);

  const handleGenerateAnalysis = async () => {
    if (deceasedPatients.length === 0) {
      setAiAnalysis('No deceased patient data available for analysis.');
      return;
    }

    setIsLoadingAnalysis(true);
    try {
      const analysis = await analyzeDeathDiagnosisPatterns(deceasedPatients);
      setAiAnalysis(analysis);
      setShowFullAnalysis(true);
    } catch (error) {
      console.error('Error generating AI analysis:', error);
      setAiAnalysis('Failed to generate AI analysis. Please try again.');
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const unitDistribution = deceasedPatients.reduce((acc, patient) => {
    acc[patient.unit] = (acc[patient.unit] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  // Advanced Analytics Calculations
  const birthWeightDistribution = deceasedPatients.reduce((acc, patient) => {
    if (!patient.birthWeight) {
      acc['Unknown'] = (acc['Unknown'] || 0) + 1;
      return acc;
    }
    const weight = parseFloat(patient.birthWeight.toString());
    let category = '';
    if (weight < 1) category = 'Extremely Low (<1 kg)';
    else if (weight < 1.5) category = 'Very Low (1-1.5 kg)';
    else if (weight < 2) category = 'Low (1.5-2 kg)';
    else if (weight < 2.5) category = 'Moderately Low (2-2.5 kg)';
    else category = 'Normal (≥2.5 kg)';

    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  const durationOfStayDistribution = deceasedPatients.reduce((acc, patient) => {
    if (!patient.dateOfDeath || !patient.admissionDate) {
      acc['Unknown'] = (acc['Unknown'] || 0) + 1;
      return acc;
    }
    const days = Math.ceil((new Date(patient.dateOfDeath).getTime() - new Date(patient.admissionDate).getTime()) / (1000 * 60 * 60 * 24));
    let category = '';
    if (days < 1) category = '<24 hours';
    else if (days <= 3) category = '1-3 days';
    else if (days <= 7) category = '3-7 days';
    else if (days <= 14) category = '1-2 weeks';
    else if (days <= 28) category = '2-4 weeks';
    else category = '>1 month';

    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  const birthToAdmissionGap = deceasedPatients.reduce((acc, patient) => {
    if (!patient.dateOfBirth || !patient.admissionDate) {
      acc['Unknown'] = (acc['Unknown'] || 0) + 1;
      return acc;
    }
    const hours = (new Date(patient.admissionDate).getTime() - new Date(patient.dateOfBirth).getTime()) / (1000 * 60 * 60);
    let category = '';
    if (hours < 6) category = '<6 hours (Inborn)';
    else if (hours <= 24) category = '6-24 hours';
    else if (hours <= 72) category = '1-3 days';
    else if (hours <= 168) category = '3-7 days';
    else category = '>7 days';

    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  const referralSourceDistribution = deceasedPatients.reduce((acc, patient) => {
    const source = patient.referredFrom || patient.birthType || 'Unknown';
    if (source.toLowerCase().includes('inborn') || source.toLowerCase().includes('same')) {
      acc['Inborn'] = (acc['Inborn'] || 0) + 1;
    } else if (source.toLowerCase().includes('outborn') || source.toLowerCase().includes('referred')) {
      acc['Outborn/Referred'] = (acc['Outborn/Referred'] || 0) + 1;
    } else {
      acc[source] = (acc[source] || 0) + 1;
    }
    return acc;
  }, {} as { [key: string]: number });

  const formatMarkdown = (text: string) => {
    return text
      .replace(/## (.*?)$/gm, '<h3 class="text-lg font-bold text-slate-900 mt-6 mb-3">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
      .replace(/- (.*?)$/gm, '<li class="ml-4 text-slate-700">$1</li>')
      .replace(/\n/g, '<br/>');
  };

  const handleAnalyticsExport = (analysisType: string) => {
    // This will export comprehensive analysis report with all categories
    let analysisData: any = {};
    let filterName = '';

    if (analysisType === 'birthWeight') {
      analysisData = {
        type: 'birthWeight',
        distribution: birthWeightDistribution,
        allPatients,
        title: 'Death Analysis as per Birth Weight'
      };
      filterName = 'Death Analysis as per Birth Weight';
    } else if (analysisType === 'durationOfStay') {
      analysisData = {
        type: 'durationOfStay',
        distribution: durationOfStayDistribution,
        allPatients,
        title: 'Death Analysis as per Duration of Stay'
      };
      filterName = 'Death Analysis as per Duration of Stay';
    } else if (analysisType === 'birthToAdmission') {
      analysisData = {
        type: 'birthToAdmission',
        distribution: birthToAdmissionGap,
        allPatients,
        title: 'Death Analysis as per Birth to Admission Gap'
      };
      filterName = 'Death Analysis as per Birth to Admission Gap';
    } else if (analysisType === 'referralSource') {
      analysisData = {
        type: 'referralSource',
        distribution: referralSourceDistribution,
        allPatients,
        title: 'Death Analysis as per Referral Source'
      };
      filterName = 'Death Analysis as per Referral Source';
    } else if (analysisType === 'diagnosis') {
      analysisData = {
        type: 'diagnosis',
        distribution: causeStats.reduce((acc, stat) => {
          acc[stat.cause] = stat.count;
          return acc;
        }, {} as { [key: string]: number }),
        allPatients,
        title: 'Death Analysis as per Diagnosis'
      };
      filterName = 'Death Analysis as per Diagnosis';
    } else if (analysisType === 'gender') {
      const genderDist = deceasedPatients.reduce((acc, p) => {
        acc[p.gender] = (acc[p.gender] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });
      analysisData = {
        type: 'gender',
        distribution: genderDist,
        allPatients,
        title: 'Death Analysis as per Gender'
      };
      filterName = 'Death Analysis as per Gender';
    }

    // Store analysis data for PDF generation
    setFilteredExportData({
      patients: deceasedPatients,
      filterName,
      analysisData,
      timeRange: timeRangeLabel,
      startDate,
      endDate
    });
    setShowExportModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header - Mobile Optimized */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-xl rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-bold text-white">Death Diagnosis Analytics</h2>
              <p className="text-blue-100 text-xs sm:text-sm truncate">AI-Powered Analysis • {institutionName}</p>
            </div>
          </div>
          {/* Stats & Export - Always visible */}
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
            <div className="text-left sm:text-right">
              <div className="text-2xl sm:text-4xl font-bold text-white">{deceasedPatients.length}</div>
              <div className="text-blue-100 text-xs sm:text-sm">Deceased</div>
            </div>
            <button
              onClick={() => setShowExportModal(true)}
              className="px-3 py-2 sm:px-6 sm:py-3 bg-white/20 hover:bg-white/30 backdrop-blur-xl text-white rounded-lg sm:rounded-xl font-bold flex items-center gap-1.5 sm:gap-2 transition-all shadow-lg border border-white/30 text-xs sm:text-base"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats - Mobile: 2 columns */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-6 border border-slate-200 shadow-lg"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className="w-7 h-7 sm:w-10 sm:h-10 bg-sky-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 sm:w-6 sm:h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-700 text-xs sm:text-base">Unit Distribution</h3>
          </div>
          <div className="space-y-1 sm:space-y-2">
            {Object.entries(unitDistribution).map(([unit, count]) => (
              <div key={unit} className="flex justify-between items-center">
                <span className="text-xs sm:text-sm text-slate-600">{unit}</span>
                <span className="text-xs sm:text-sm font-bold text-slate-900">{count}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-6 border border-slate-200 shadow-lg"
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
            <div className="w-7 h-7 sm:w-10 sm:h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-700 text-xs sm:text-base">Data Quality</h3>
          </div>
          <div className="space-y-1 sm:space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-slate-600">AI</span>
              <span className="text-xs sm:text-sm font-bold text-green-600">
                {deceasedPatients.filter(p => p.aiInterpretedDeathDiagnosis).length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-slate-600">Manual</span>
              <span className="text-xs sm:text-sm font-bold text-slate-900">
                {deceasedPatients.filter(p => !p.aiInterpretedDeathDiagnosis && p.diagnosisAtDeath).length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs sm:text-sm text-slate-600">Missing</span>
              <span className="text-xs sm:text-sm font-bold text-red-600">
                {deceasedPatients.filter(p => !p.diagnosisAtDeath).length}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Advanced Mortality Analytics */}
      <div className="bg-gradient-to-br from-sky-50 to-purple-50 rounded-xl sm:rounded-2xl p-3 sm:p-6 border border-sky-200">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="w-9 h-9 sm:w-12 sm:h-12 bg-gradient-to-br from-sky-500 to-purple-600 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base sm:text-xl font-bold text-slate-900">Advanced Analytics</h3>
            <p className="text-slate-600 text-[10px] sm:text-sm">Clinical parameter breakdowns</p>
          </div>
        </div>

        {/* Mobile: 2 columns, Tablet: 2 columns, Desktop: 3 columns */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
          {/* Birth Weight Distribution */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg sm:rounded-xl p-2.5 sm:p-5 border border-sky-200 shadow-lg"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-purple-100 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                </div>
                <h4 className="font-bold text-slate-900 text-[11px] sm:text-base">Birth Weight</h4>
              </div>
              <button
                onClick={() => handleAnalyticsExport('birthWeight')}
                className="p-1 sm:px-3 sm:py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded sm:rounded-lg text-[10px] sm:text-xs font-semibold transition-all flex items-center gap-0.5 sm:gap-1"
                title="Export"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              {Object.entries(birthWeightDistribution)
                .sort((a, b) => b[1] - a[1])
                .map(([category, count]) => {
                  const percentage = ((count / deceasedPatients.length) * 100).toFixed(1);
                  // Shorten category names for mobile
                  const shortCategory = category.replace('Extremely Low', 'Ext. Low').replace('Moderately Low', 'Mod. Low').replace('Very Low', 'V. Low');
                  return (
                    <div key={category} className="space-y-0.5 sm:space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] sm:text-xs text-slate-600 truncate mr-1">{shortCategory}</span>
                        <span className="text-[9px] sm:text-xs font-bold text-purple-700 whitespace-nowrap">{count}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 sm:h-2">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-purple-600 h-1.5 sm:h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>

          {/* Duration of Stay Distribution */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-lg sm:rounded-xl p-2.5 sm:p-5 border border-sky-200 shadow-lg"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="font-bold text-slate-900 text-[11px] sm:text-base">Duration</h4>
              </div>
              <button
                onClick={() => handleAnalyticsExport('durationOfStay')}
                className="p-1 sm:px-3 sm:py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded sm:rounded-lg text-[10px] sm:text-xs font-semibold transition-all flex items-center gap-0.5 sm:gap-1"
                title="Export"
              >
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              {Object.entries(durationOfStayDistribution)
                .sort((a, b) => {
                  const order = ['<24 hours', '1-3 days', '3-7 days', '1-2 weeks', '2-4 weeks', '>1 month', 'Unknown'];
                  return order.indexOf(a[0]) - order.indexOf(b[0]);
                })
                .map(([category, count]) => {
                  const percentage = ((count / deceasedPatients.length) * 100).toFixed(1);
                  const shortCategory = category.replace(' hours', 'h').replace(' days', 'd').replace(' weeks', 'w').replace(' month', 'mo');
                  return (
                    <div key={category} className="space-y-0.5 sm:space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] sm:text-xs text-slate-600">{shortCategory}</span>
                        <span className="text-[9px] sm:text-xs font-bold text-blue-700">{count}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 sm:h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-1.5 sm:h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>

          {/* Birth to Admission Gap */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg sm:rounded-xl p-2.5 sm:p-5 border border-sky-200 shadow-lg"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-4">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-emerald-100 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h4 className="font-bold text-slate-900 text-[11px] sm:text-base">Birth→Admit</h4>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              {Object.entries(birthToAdmissionGap)
                .sort((a, b) => {
                  const order = ['<6 hours (Inborn)', '6-24 hours', '1-3 days', '3-7 days', '>7 days', 'Unknown'];
                  return order.indexOf(a[0]) - order.indexOf(b[0]);
                })
                .map(([category, count]) => {
                  const percentage = ((count / deceasedPatients.length) * 100).toFixed(1);
                  const shortCat = category.replace(' hours', 'h').replace(' days', 'd').replace(' (Inborn)', '');
                  return (
                    <div key={category} className="space-y-0.5 sm:space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] sm:text-xs text-slate-600">{shortCat}</span>
                        <span className="text-[9px] sm:text-xs font-bold text-emerald-700">{count}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 sm:h-2">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-1.5 sm:h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>

          {/* Referral Source Distribution */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-lg sm:rounded-xl p-2.5 sm:p-5 border border-sky-200 shadow-lg"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-4">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-amber-100 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h4 className="font-bold text-slate-900 text-[11px] sm:text-base">Referral</h4>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              {Object.entries(referralSourceDistribution)
                .sort((a, b) => b[1] - a[1])
                .map(([source, count]) => {
                  const percentage = ((count / deceasedPatients.length) * 100).toFixed(1);
                  return (
                    <div key={source} className="space-y-0.5 sm:space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] sm:text-xs text-slate-600 truncate mr-1">{source}</span>
                        <span className="text-[9px] sm:text-xs font-bold text-amber-700">{count}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 sm:h-2">
                        <div
                          className="bg-gradient-to-r from-amber-500 to-amber-600 h-1.5 sm:h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>

          {/* Top Diagnoses at Death */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-lg sm:rounded-xl p-2.5 sm:p-5 border border-sky-200 shadow-lg"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-4">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-rose-100 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="font-bold text-slate-900 text-[11px] sm:text-base">Diagnoses</h4>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              {causeStats.slice(0, 5).map((stat, index) => {
                const percentage = ((stat.count / deceasedPatients.length) * 100).toFixed(1);
                return (
                  <div key={index} className="space-y-0.5 sm:space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] sm:text-xs text-slate-600 line-clamp-1 mr-1">{stat.cause}</span>
                      <span className="text-[9px] sm:text-xs font-bold text-rose-700">{stat.count}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 sm:h-2">
                      <div
                        className="bg-gradient-to-r from-rose-500 to-rose-600 h-1.5 sm:h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Gender Distribution */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-lg sm:rounded-xl p-2.5 sm:p-5 border border-sky-200 shadow-lg"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-4">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-indigo-100 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h4 className="font-bold text-slate-900 text-[11px] sm:text-base">Gender</h4>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              {Object.entries(deceasedPatients.reduce((acc, p) => {
                acc[p.gender] = (acc[p.gender] || 0) + 1;
                return acc;
              }, {} as { [key: string]: number }))
                .sort((a, b) => b[1] - a[1])
                .map(([gender, count]) => {
                  const percentage = ((count / deceasedPatients.length) * 100).toFixed(1);
                  return (
                    <div key={gender} className="space-y-0.5 sm:space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] sm:text-xs text-slate-600">{gender}</span>
                        <span className="text-[9px] sm:text-xs font-bold text-indigo-700">{count}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 sm:h-2">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-1.5 sm:h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Key Metrics Dashboard */}
      <KeyMetricsDashboard
        deceasedPatients={deceasedPatients}
        allPatients={allPatients}
        timeRangeLabel={timeRangeLabel}
      />

      {/* Advanced Mortality Analytics - Time Patterns */}
      <AdvancedMortalityCharts
        deceasedPatients={deceasedPatients}
        allPatients={allPatients}
      />

      {/* Risk Factor Analysis */}
      <RiskFactorAnalysis
        deceasedPatients={deceasedPatients}
        allPatients={allPatients}
      />

      {/* Advanced Charts */}
      <MortalityChartsPanel patients={deceasedPatients} />

      {/* Top Causes of Death */}
      {causeStats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-lg"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Top Causes of Death</h3>
              <p className="text-sm text-slate-600">Ranked by frequency</p>
            </div>
          </div>

          <div className="space-y-4">
            {causeStats.map((cause, index) => (
              <div key={index} className="border-l-4 border-blue-400 bg-blue-50 rounded-r-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 mb-1">{cause.cause}</h4>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        <span><strong>{cause.count}</strong> cases</span>
                        <span><strong>{cause.percentage.toFixed(1)}%</strong> of total</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex gap-6 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700">Age Groups:</span>
                    <div className="mt-1 space-y-1">
                      {Object.entries(cause.ageGroups).map(([age, count]) => (
                        <div key={age} className="text-slate-600">{age}: {count}</div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Units:</span>
                    <div className="mt-1 space-y-1">
                      {Object.entries(cause.units).map(([unit, count]) => (
                        <div key={unit} className="text-slate-600">{unit}: {count}</div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${cause.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* AI Analysis Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gradient-to-br from-sky-50 to-purple-50 rounded-xl p-6 border-2 border-sky-300 shadow-lg"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-purple-600 rounded-xl flex items-center justify-center">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900">AI-Powered Pattern Analysis</h3>
            <p className="text-sm text-slate-600">Comprehensive mortality trends and quality improvement insights</p>
          </div>
        </div>

        {!aiAnalysis && !isLoadingAnalysis && (
          <button
            onClick={handleGenerateAnalysis}
            className="w-full bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-600 hover:to-purple-700 text-white px-6 py-4 rounded-xl transition-all font-bold text-lg shadow-lg flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Generate AI Analysis
          </button>
        )}

        {isLoadingAnalysis && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-600 font-semibold">AI is analyzing mortality patterns...</p>
              <p className="text-sm text-slate-500 mt-2">This may take a few moments</p>
            </div>
          </div>
        )}

        {aiAnalysis && (
          <div className="bg-white rounded-xl p-6 shadow-inner">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: formatMarkdown(aiAnalysis) }}
            />

            <button
              onClick={() => setAiAnalysis('')}
              className="mt-6 w-full bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg transition-all font-semibold text-sm"
            >
              Close Analysis
            </button>
          </div>
        )}
      </motion.div>

      {/* Recent Deaths */}
      {deceasedPatients.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-lg"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Recent Cases</h3>
              <p className="text-sm text-slate-600">Last 10 deceased patients</p>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {deceasedPatients.slice(0, 10).map((patient, index) => (
              <div
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
                className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                        {patient.name}
                      </h4>
                      <svg className="w-4 h-4 text-slate-400 group-hover:text-sky-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-600">
                      {patient.age} {patient.ageUnit} • {patient.unit}
                    </p>
                  </div>
                  {patient.dateOfDeath && (
                    <div className="text-xs text-slate-500 text-right">
                      <div>{new Date(patient.dateOfDeath).toLocaleDateString()}</div>
                      <div>{new Date(patient.dateOfDeath).toLocaleTimeString()}</div>
                    </div>
                  )}
                </div>

                {patient.aiInterpretedDeathDiagnosis ? (
                  <div className="bg-sky-50 border-l-4 border-sky-400 p-3 rounded-r">
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-sky-700">AI Summary:</span> {patient.aiInterpretedDeathDiagnosis}
                    </p>
                  </div>
                ) : patient.diagnosisAtDeath ? (
                  <div className="bg-slate-50 border-l-4 border-slate-400 p-3 rounded-r">
                    <p className="text-sm text-slate-700">{patient.diagnosisAtDeath.slice(0, 150)}...</p>
                  </div>
                ) : (
                  <p className="text-sm text-red-600 italic">No diagnosis recorded</p>
                )}

                <div className="mt-3 text-xs text-slate-500 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Click to view detailed mortality analysis
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Individual Patient Mortality Viewer */}
      <AnimatePresence>
        {selectedPatient && (
          <IndividualMortalityViewer
            patient={selectedPatient}
            institutionName={institutionName}
            onClose={() => setSelectedPatient(null)}
          />
        )}
      </AnimatePresence>

      {/* Customizable Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <CustomizableExportModal
            patients={filteredExportData?.patients || deceasedPatients}
            institutionName={institutionName}
            totalAdmissions={totalAdmissions}
            timeRange={filteredExportData?.timeRange || timeRangeLabel}
            unit={unitFilter}
            birthType={birthTypeFilter}
            startDate={filteredExportData?.startDate || startDate}
            endDate={filteredExportData?.endDate || endDate}
            analysisType={filteredExportData?.filterName}
            analysisData={filteredExportData?.analysisData}
            onClose={() => {
              setShowExportModal(false);
              setFilteredExportData(null);
            }}
            aiAnalysis={aiAnalysis}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default DeathDiagnosisAnalytics;
