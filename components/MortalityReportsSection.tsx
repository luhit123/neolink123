import React, { useState, useMemo } from 'react';
import { Patient, Unit } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Download, TrendingUp, TrendingDown, PieChart, BarChart3,
  Calendar, Users, Activity, AlertTriangle, CheckCircle2, Clock,
  Table, File, ChevronRight, Target, Zap, Shield, Baby, Heart,
  Stethoscope, Scale, MapPin, Timer, Clipboard, Brain, Database
} from 'lucide-react';
import { downloadMortalityReportPDF, downloadMortalityReportCSV, ReportType, ReportConfig } from '../services/mortalityReportService';

interface MortalityReportsSectionProps {
  patients: Patient[];
  deceasedPatients: Patient[];
  institutionName: string;
  selectedTimeRange: 'all' | 'month' | 'year' | 'custom';
  selectedMonth: string;
  selectedYear: string;
  customStartDate: string;
  customEndDate: string;
  selectedUnitFilter: Unit | 'all';
  birthTypeFilter: 'all' | 'inborn' | 'outborn';
  timeRangeLabel: string;
}

interface ReportTemplate {
  id: ReportType;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  metrics: string[];
  recommended?: boolean;
}

interface DataCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  selected: boolean;
}

const MortalityReportsSection: React.FC<MortalityReportsSectionProps> = ({
  patients,
  deceasedPatients,
  institutionName,
  selectedTimeRange,
  selectedMonth,
  selectedYear,
  customStartDate,
  customEndDate,
  selectedUnitFilter,
  birthTypeFilter,
  timeRangeLabel
}) => {
  const [selectedReportType, setSelectedReportType] = useState<ReportType | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [selectedDataCategories, setSelectedDataCategories] = useState<string[]>([
    'summary', 'causes', 'demographics', 'clinical'
  ]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Data categories for comprehensive reports
  const dataCategories: DataCategory[] = [
    { id: 'summary', name: 'Summary Statistics', icon: <BarChart3 className="w-4 h-4" />, description: 'Mortality rates, survival rates, totals', selected: true },
    { id: 'causes', name: 'Cause Analysis', icon: <Stethoscope className="w-4 h-4" />, description: 'ICD-10 codes, NHM categories, top causes', selected: true },
    { id: 'demographics', name: 'Demographics', icon: <Users className="w-4 h-4" />, description: 'Age, gender, birth type distribution', selected: true },
    { id: 'clinical', name: 'Clinical Parameters', icon: <Heart className="w-4 h-4" />, description: 'Birth weight, gestational age, APGAR', selected: true },
    { id: 'timeline', name: 'Timeline Analysis', icon: <Timer className="w-4 h-4" />, description: 'Duration of stay, early deaths, trends', selected: false },
    { id: 'referral', name: 'Referral Analysis', icon: <MapPin className="w-4 h-4" />, description: 'Source, delay, transport conditions', selected: false },
    { id: 'documentation', name: 'Documentation Quality', icon: <Clipboard className="w-4 h-4" />, description: 'MCCD completion, AI analysis coverage', selected: false },
    { id: 'individual', name: 'Individual Cases', icon: <Database className="w-4 h-4" />, description: 'Detailed patient-wise mortality data', selected: false },
  ];

  // Calculate comprehensive statistics
  const stats = useMemo(() => {
    const total = patients.length;
    const deaths = deceasedPatients.length;
    const mortalityRate = total > 0 ? ((deaths / total) * 100) : 0;
    const survived = total - deaths;
    const survivalRate = total > 0 ? ((survived / total) * 100) : 0;

    // By unit
    const byUnit = deceasedPatients.reduce((acc, p) => {
      acc[p.unit] = (acc[p.unit] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // MCCD completion
    const withMCCD = deceasedPatients.filter(p => p.savedDeathCertificate).length;
    const mccdCompletionRate = deaths > 0 ? ((withMCCD / deaths) * 100) : 0;

    // AI analyzed
    const aiAnalyzed = deceasedPatients.filter(p => p.aiInterpretedDeathDiagnosis).length;
    const withICD10 = deceasedPatients.filter(p =>
      p.savedDeathCertificate?.causeOfDeathPartI?.immediateCauseICD10
    ).length;

    // Early deaths (within 24 hours)
    const earlyDeaths = deceasedPatients.filter(p => {
      if (!p.admissionDate || !p.dateOfDeath) return false;
      const hours = (new Date(p.dateOfDeath).getTime() - new Date(p.admissionDate).getTime()) / (1000 * 60 * 60);
      return hours < 24;
    }).length;

    // Birth weight categories
    const birthWeightDist = deceasedPatients.reduce((acc, p) => {
      if (!p.birthWeight) { acc['Unknown'] = (acc['Unknown'] || 0) + 1; return acc; }
      const w = parseFloat(p.birthWeight.toString());
      if (w < 1) acc['<1 kg'] = (acc['<1 kg'] || 0) + 1;
      else if (w < 1.5) acc['1-1.5 kg'] = (acc['1-1.5 kg'] || 0) + 1;
      else if (w < 2) acc['1.5-2 kg'] = (acc['1.5-2 kg'] || 0) + 1;
      else if (w < 2.5) acc['2-2.5 kg'] = (acc['2-2.5 kg'] || 0) + 1;
      else acc['≥2.5 kg'] = (acc['≥2.5 kg'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Gender distribution
    const genderDist = deceasedPatients.reduce((acc, p) => {
      acc[p.gender || 'Unknown'] = (acc[p.gender || 'Unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Duration of stay
    const durationDist = deceasedPatients.reduce((acc, p) => {
      if (!p.admissionDate || !p.dateOfDeath) { acc['Unknown'] = (acc['Unknown'] || 0) + 1; return acc; }
      const days = Math.ceil((new Date(p.dateOfDeath).getTime() - new Date(p.admissionDate).getTime()) / (1000 * 60 * 60 * 24));
      if (days < 1) acc['<24h'] = (acc['<24h'] || 0) + 1;
      else if (days <= 3) acc['1-3 days'] = (acc['1-3 days'] || 0) + 1;
      else if (days <= 7) acc['3-7 days'] = (acc['3-7 days'] || 0) + 1;
      else if (days <= 14) acc['1-2 weeks'] = (acc['1-2 weeks'] || 0) + 1;
      else acc['>2 weeks'] = (acc['>2 weeks'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Referral source
    const referralDist = deceasedPatients.reduce((acc, p) => {
      const type = p.admissionType?.toLowerCase() || '';
      if (type.includes('inborn')) acc['Inborn'] = (acc['Inborn'] || 0) + 1;
      else if (type.includes('outborn')) acc['Outborn'] = (acc['Outborn'] || 0) + 1;
      else acc['Other'] = (acc['Other'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Top causes
    const causeMap = new Map<string, { count: number; icd10?: string }>();
    deceasedPatients.forEach(p => {
      const cause = p.savedDeathCertificate?.causeOfDeathPartI?.immediateCause ||
        p.aiInterpretedDeathDiagnosis ||
        p.diagnosisAtDeath ||
        'Unknown';
      const icd10 = p.savedDeathCertificate?.causeOfDeathPartI?.immediateCauseICD10;
      const simplifiedCause = cause.split('.')[0].split(',')[0].trim().slice(0, 50);
      if (!causeMap.has(simplifiedCause)) {
        causeMap.set(simplifiedCause, { count: 0, icd10 });
      }
      const existing = causeMap.get(simplifiedCause)!;
      existing.count++;
    });
    const topCauses = Array.from(causeMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([cause, data]) => ({
        cause,
        count: data.count,
        icd10: data.icd10 || '-',
        percentage: deaths > 0 ? (data.count / deaths) * 100 : 0
      }));

    // NHM categories
    const nhmDist = deceasedPatients.reduce((acc, p) => {
      const category = p.savedDeathCertificate?.nhmDeathCategory || 'Not Classified';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      deaths,
      survived,
      mortalityRate,
      survivalRate,
      byUnit,
      withMCCD,
      mccdCompletionRate,
      aiAnalyzed,
      withICD10,
      earlyDeaths,
      birthWeightDist,
      genderDist,
      durationDist,
      referralDist,
      topCauses,
      nhmDist
    };
  }, [patients, deceasedPatients]);

  // Report templates
  const reportTemplates: ReportTemplate[] = [
    {
      id: 'mortality_overview',
      name: 'Complete Mortality Report',
      description: 'Comprehensive analysis with all metrics, causes, and demographics',
      icon: <FileText className="w-5 h-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      metrics: ['Mortality Rate', 'Survival Rate', 'Unit Distribution', 'Demographics', 'Top Causes'],
      recommended: true
    },
    {
      id: 'cause_analysis',
      name: 'Cause of Death Report',
      description: 'Detailed ICD-10 codes, NHM categories, and cause distribution',
      icon: <Stethoscope className="w-5 h-5" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      metrics: ['ICD-10 Codes', 'NHM Categories', 'Underlying Causes', 'Contributing Factors']
    },
    {
      id: 'risk_factor',
      name: 'Risk Factor Report',
      description: 'Birth weight, gestational age, and clinical risk analysis',
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
      metrics: ['Birth Weight', 'Gestational Age', 'APGAR', 'Referral Delays']
    },
    {
      id: 'trend_analysis',
      name: 'Trend & Timeline Report',
      description: 'Monthly trends, duration of stay, and temporal patterns',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      metrics: ['Monthly Trends', 'Early Deaths', 'Duration Analysis', 'Seasonal Patterns']
    },
    {
      id: 'quality_metrics',
      name: 'Quality Metrics Report',
      description: 'Documentation quality, MCCD completion, and compliance',
      icon: <Target className="w-5 h-5" />,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-100',
      metrics: ['MCCD Completion', 'ICD-10 Coverage', 'AI Analysis Rate', 'Documentation Score']
    },
    {
      id: 'comparative',
      name: 'Comparative Analysis',
      description: 'Cross-unit and cross-category mortality comparison',
      icon: <Activity className="w-5 h-5" />,
      color: 'text-rose-600',
      bgColor: 'bg-rose-100',
      metrics: ['Unit Comparison', 'Inborn vs Outborn', 'Gender Analysis', 'Age Group Analysis']
    }
  ];

  const toggleDataCategory = (id: string) => {
    setSelectedDataCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleGenerateReport = () => {
    if (!selectedReportType) {
      alert('Please select a report type');
      return;
    }

    if (deceasedPatients.length === 0) {
      alert('No deceased patients found for the selected filters.');
      return;
    }

    setIsGenerating(true);

    // Use setTimeout to allow UI to update before heavy PDF generation
    setTimeout(() => {
      try {
        const config: ReportConfig = {
          reportType: selectedReportType,
          institutionName,
          timeRange: timeRangeLabel,
          unit: selectedUnitFilter === 'all' ? 'All Units' : selectedUnitFilter,
          birthType: birthTypeFilter,
          includeRecommendations,
          includeCharts,
          exportFormat,
          dataCategories: selectedDataCategories
        };

        console.log('=== MORTALITY REPORT GENERATION ===');
        console.log('Config:', JSON.stringify(config, null, 2));
        console.log('Patients count:', patients.length);
        console.log('Deceased patients count:', deceasedPatients.length);

        if (exportFormat === 'pdf') {
          console.log('Starting PDF download...');
          downloadMortalityReportPDF(patients, deceasedPatients, config);
          console.log('PDF download completed');
        } else {
          console.log('Starting CSV download...');
          downloadMortalityReportCSV(patients, deceasedPatients, config);
          console.log('CSV download completed');
        }
      } catch (error) {
        console.error('=== REPORT GENERATION ERROR ===');
        console.error('Error:', error);
        console.error('Stack:', (error as Error)?.stack);
        alert(`Failed to generate report: ${(error as Error)?.message || 'Unknown error'}`);
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
        <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            <span className="text-[11px] sm:text-xs text-slate-500 uppercase font-semibold">Admissions</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-800">{stats.total}</div>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-4 border border-red-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
            <span className="text-[11px] sm:text-xs text-slate-500 uppercase font-semibold">Deaths</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-red-600">{stats.deaths}</div>
          <div className="text-xs sm:text-sm text-red-500 font-semibold">{stats.mortalityRate.toFixed(1)}%</div>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-4 border border-emerald-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
            <span className="text-[11px] sm:text-xs text-slate-500 uppercase font-semibold">Survived</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-600">{stats.survived}</div>
          <div className="text-xs sm:text-sm text-emerald-500 font-semibold">{stats.survivalRate.toFixed(1)}%</div>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-4 border border-purple-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
            <span className="text-[11px] sm:text-xs text-slate-500 uppercase font-semibold">MCCD</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-purple-600">{stats.withMCCD}</div>
          <div className="text-xs sm:text-sm text-purple-500 font-semibold">{stats.mccdCompletionRate.toFixed(0)}%</div>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-4 border border-cyan-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-500" />
            <span className="text-[11px] sm:text-xs text-slate-500 uppercase font-semibold">AI Analyzed</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-cyan-600">{stats.aiAnalyzed}</div>
        </div>

        <div className="bg-white rounded-xl p-3 sm:p-4 border border-amber-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
            <span className="text-[11px] sm:text-xs text-slate-500 uppercase font-semibold">Early Death</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-600">{stats.earlyDeaths}</div>
          <div className="text-xs sm:text-sm text-amber-500 font-semibold">&lt;24h</div>
        </div>
      </div>

      {/* Report Generator Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Generate Reports</h2>
                <p className="text-xs text-slate-300">Select report type and customize data</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <Calendar className="w-4 h-4" />
              {timeRangeLabel}
            </div>
          </div>
        </div>

        {/* Report Type Selection */}
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700 mb-3">Select Report Type</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {reportTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedReportType(
                  selectedReportType === template.id ? null : template.id
                )}
                className={`relative text-left p-3 sm:p-4 rounded-xl border-2 transition-all ${selectedReportType === template.id
                    ? 'border-slate-800 bg-slate-50 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
              >
                {template.recommended && (
                  <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                    Best
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg ${template.bgColor} flex items-center justify-center ${template.color} flex-shrink-0`}>
                    {template.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 text-sm">{template.name}</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{template.description}</p>
                  </div>
                </div>
                {selectedReportType === template.id && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Data Categories Selection */}
        <AnimatePresence>
          {selectedReportType && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b border-slate-100"
            >
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-700">Include Data Categories</h3>
                  <button
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                    className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                  >
                    {showAdvancedOptions ? 'Less options' : 'More options'}
                    <ChevronRight className={`w-4 h-4 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {dataCategories.slice(0, showAdvancedOptions ? undefined : 4).map((category) => (
                    <button
                      key={category.id}
                      onClick={() => toggleDataCategory(category.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg text-left transition-all ${selectedDataCategories.includes(category.id)
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                      {category.icon}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{category.name}</div>
                      </div>
                      {selectedDataCategories.includes(category.id) && (
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Export Options */}
        <AnimatePresence>
          {selectedReportType && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-slate-50"
            >
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Export Format */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1.5">Format</label>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setExportFormat('pdf')}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${exportFormat === 'pdf'
                          ? 'bg-red-500 text-white'
                          : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                      >
                        <File className="w-3.5 h-3.5" />
                        PDF
                      </button>
                      <button
                        onClick={() => setExportFormat('excel')}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${exportFormat === 'excel'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                      >
                        <Table className="w-3.5 h-3.5" />
                        Excel
                      </button>
                    </div>
                  </div>

                  {/* AI Recommendations */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1.5">AI Insights</label>
                    <button
                      onClick={() => setIncludeRecommendations(!includeRecommendations)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${includeRecommendations
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                    >
                      <span>Include</span>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${includeRecommendations ? 'bg-emerald-500 text-white' : 'bg-slate-200'
                        }`}>
                        {includeRecommendations && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                    </button>
                  </div>

                  {/* Charts */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1.5">Charts</label>
                    <button
                      onClick={() => setIncludeCharts(!includeCharts)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${includeCharts
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                    >
                      <span>Include</span>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${includeCharts ? 'bg-blue-500 text-white' : 'bg-slate-200'
                        }`}>
                        {includeCharts && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                    </button>
                  </div>

                  {/* Generate Button */}
                  <div className="flex items-end">
                    <button
                      onClick={handleGenerateReport}
                      disabled={isGenerating || selectedDataCategories.length === 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-lg font-bold text-xs hover:from-slate-700 hover:to-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGenerating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Download
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Data Preview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Causes */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Top Causes of Death</h3>
              <p className="text-[10px] text-slate-500">{stats.deaths} cases analyzed</p>
            </div>
          </div>
          <div className="space-y-2">
            {stats.topCauses.slice(0, 5).map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white ${idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : idx === 2 ? 'bg-amber-500' : 'bg-slate-400'
                  }`}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-700 truncate pr-2">{item.cause}</span>
                    <span className="text-xs font-bold text-slate-800 flex-shrink-0">{item.count}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1 mt-1">
                    <div
                      className={`h-1 rounded-full ${idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : idx === 2 ? 'bg-amber-500' : 'bg-slate-400'}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
                {item.icd10 !== '-' && (
                  <span className="text-[9px] bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                    {item.icd10}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Demographics */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Demographics & Distribution</h3>
              <p className="text-[10px] text-slate-500">Patient characteristics</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Gender */}
            <div>
              <div className="text-[10px] text-slate-500 font-semibold mb-1.5">GENDER</div>
              <div className="space-y-1">
                {Object.entries(stats.genderDist).map(([gender, count]) => (
                  <div key={gender} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{gender}</span>
                    <span className="font-bold text-slate-800">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Referral */}
            <div>
              <div className="text-[10px] text-slate-500 font-semibold mb-1.5">ADMISSION TYPE</div>
              <div className="space-y-1">
                {Object.entries(stats.referralDist).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{type}</span>
                    <span className="font-bold text-slate-800">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Birth Weight */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="text-[10px] text-slate-500 font-semibold mb-2">BIRTH WEIGHT</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(stats.birthWeightDist).map(([weight, count]) => (
                <div key={weight} className="bg-slate-100 rounded px-2 py-1 text-[10px]">
                  <span className="text-slate-600">{weight}:</span>
                  <span className="font-bold text-slate-800 ml-1">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Unit Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <PieChart className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Unit Distribution</h3>
              <p className="text-[10px] text-slate-500">Deaths by care unit</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(stats.byUnit).map(([unit, count]) => {
              const percentage = stats.deaths > 0 ? ((count / stats.deaths) * 100) : 0;
              const colors: Record<string, string> = {
                NICU: 'from-sky-500 to-sky-600',
                PICU: 'from-purple-500 to-purple-600',
                HDU: 'from-amber-500 to-amber-600'
              };
              return (
                <div key={unit} className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <div className={`w-8 h-8 mx-auto rounded-lg bg-gradient-to-br ${colors[unit] || 'from-slate-500 to-slate-600'} flex items-center justify-center text-white text-xs font-bold mb-1`}>
                    {unit.charAt(0)}
                  </div>
                  <div className="text-lg font-bold text-slate-800">{count}</div>
                  <div className="text-[10px] text-slate-500">{unit}</div>
                  <div className="text-[10px] font-semibold text-slate-600">{percentage.toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Duration of Stay */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Timer className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Duration of Stay</h3>
              <p className="text-[10px] text-slate-500">Time from admission to death</p>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(stats.durationDist).map(([duration, count]) => {
              const percentage = stats.deaths > 0 ? ((count / stats.deaths) * 100) : 0;
              return (
                <div key={duration} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{duration}</span>
                    <span className="font-bold text-slate-800">{count} ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quality Insights */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold">Quality Improvement Insights</h3>
            <p className="text-xs text-slate-300">Data-driven recommendations</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`bg-white/10 backdrop-blur rounded-xl p-3 border ${stats.mccdCompletionRate < 80 ? 'border-red-400/50' : 'border-emerald-400/50'
            }`}>
            <div className="flex items-center gap-2 mb-2">
              <FileText className={`w-4 h-4 ${stats.mccdCompletionRate < 80 ? 'text-red-400' : 'text-emerald-400'}`} />
              <span className={`text-xs font-semibold ${stats.mccdCompletionRate < 80 ? 'text-red-400' : 'text-emerald-400'}`}>
                MCCD Status
              </span>
            </div>
            <div className="text-2xl font-bold">{stats.mccdCompletionRate.toFixed(0)}%</div>
            <p className="text-[10px] text-slate-300">{stats.deaths - stats.withMCCD} pending certificates</p>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-cyan-400/30">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-cyan-400">ICD-10 Coverage</span>
            </div>
            <div className="text-2xl font-bold">{stats.withICD10}</div>
            <p className="text-[10px] text-slate-300">
              {stats.deaths > 0 ? ((stats.withICD10 / stats.deaths) * 100).toFixed(0) : 0}% with codes
            </p>
          </div>

          <div className={`bg-white/10 backdrop-blur rounded-xl p-3 border ${stats.earlyDeaths > stats.deaths * 0.3 ? 'border-amber-400/50' : 'border-slate-400/30'
            }`}>
            <div className="flex items-center gap-2 mb-2">
              <Clock className={`w-4 h-4 ${stats.earlyDeaths > stats.deaths * 0.3 ? 'text-amber-400' : 'text-slate-400'}`} />
              <span className={`text-xs font-semibold ${stats.earlyDeaths > stats.deaths * 0.3 ? 'text-amber-400' : 'text-slate-400'}`}>
                Early Deaths
              </span>
            </div>
            <div className="text-2xl font-bold">{stats.earlyDeaths}</div>
            <p className="text-[10px] text-slate-300">
              {stats.deaths > 0 ? ((stats.earlyDeaths / stats.deaths) * 100).toFixed(0) : 0}% within 24h
            </p>
          </div>
        </div>

        {/* Recommendations */}
        <div className="mt-4 space-y-2">
          {stats.mccdCompletionRate < 100 && (
            <div className="flex items-start gap-2 text-xs text-slate-300">
              <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>Complete {stats.deaths - stats.withMCCD} pending death certificates for 100% MCCD compliance.</span>
            </div>
          )}
          {stats.earlyDeaths > 0 && stats.deaths > 0 && (stats.earlyDeaths / stats.deaths) > 0.3 && (
            <div className="flex items-start gap-2 text-xs text-slate-300">
              <ChevronRight className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>High early mortality rate. Review initial stabilization protocols.</span>
            </div>
          )}
          {stats.mortalityRate > 10 && (
            <div className="flex items-start gap-2 text-xs text-slate-300">
              <ChevronRight className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>Consider regular mortality audit meetings for quality improvement.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MortalityReportsSection;
