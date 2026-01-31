import React, { useState, useMemo, useRef } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Patient, Unit } from '../types';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  IconArrowLeft,
  IconDownload,
  IconLoader2,
  IconCalendar,
  IconChartBar,
  IconPrinter,
  IconFileAnalytics,
  IconBabyCarriage,
  IconHeartbeat,
  IconActivity,
  IconUsers,
  IconClipboardList,
  IconReportMedical,
  IconUserPlus,
  IconSkull,
  IconTransfer,
  IconArrowDown,
  IconGenderMale,
  IconGenderFemale,
  IconFileSpreadsheet,
  IconChevronRight,
  IconStethoscope,
  IconBed,
  IconTrendingUp,
  IconAlertTriangle,
  IconCheck
} from '@tabler/icons-react';

interface AIReportsPageProps {
  institutionId: string;
  institutionName?: string;
  selectedUnit: Unit;
  onSelectUnit: (unit: Unit) => void;
  enabledFacilities: Unit[];
  onBack: () => void;
}

type ReportPeriod = 'monthly' | 'quarterly' | 'yearly' | 'custom';

type ReportCategory =
  | 'comprehensive'
  | 'admissions'
  | 'deaths'
  | 'referred'
  | 'stepdown'
  | 'mortality'
  | 'gender'
  | 'discharge';

interface ReportTypeInfo {
  id: ReportCategory;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

// Report type definitions
const REPORT_TYPES: ReportTypeInfo[] = [
  {
    id: 'comprehensive',
    title: 'Comprehensive Report',
    subtitle: 'Complete overview with all metrics',
    icon: <IconFileAnalytics size={28} />,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30'
  },
  {
    id: 'admissions',
    title: 'Admissions Report',
    subtitle: 'Detailed admission statistics & trends',
    icon: <IconUserPlus size={28} />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30'
  },
  {
    id: 'deaths',
    title: 'Death Analysis Report',
    subtitle: 'Mortality patterns & cause analysis',
    icon: <IconSkull size={28} />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30'
  },
  {
    id: 'referred',
    title: 'Referral Report',
    subtitle: 'Patient referrals & transfer analysis',
    icon: <IconTransfer size={28} />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30'
  },
  {
    id: 'stepdown',
    title: 'Step Down Report',
    subtitle: 'ICU to ward step-down tracking',
    icon: <IconArrowDown size={28} />,
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/30'
  },
  {
    id: 'mortality',
    title: 'Mortality Analysis',
    subtitle: 'In-depth mortality metrics & benchmarks',
    icon: <IconReportMedical size={28} />,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30'
  },
  {
    id: 'gender',
    title: 'Gender Analysis Report',
    subtitle: 'Gender-wise statistics & outcomes',
    icon: <IconUsers size={28} />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30'
  },
  {
    id: 'discharge',
    title: 'Discharge Report',
    subtitle: 'Discharge outcomes & statistics',
    icon: <IconCheck size={28} />,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30'
  }
];

// Helper functions
const getGestationalAgeCategory = (ga: number | undefined): string => {
  if (!ga) return 'Unknown';
  if (ga < 28) return 'Extremely Preterm (<28 weeks)';
  if (ga < 32) return 'Very Preterm (28-31 weeks)';
  if (ga < 37) return 'Moderate/Late Preterm (32-36 weeks)';
  return 'Term (≥37 weeks)';
};

const getBirthWeightCategory = (weight: number | undefined): string => {
  if (!weight) return 'Unknown';
  const grams = weight < 10 ? weight * 1000 : weight; // Convert kg to g if needed
  if (grams < 1000) return 'ELBW (<1000g)';
  if (grams < 1500) return 'VLBW (1000-1499g)';
  if (grams < 2500) return 'LBW (1500-2499g)';
  return 'Normal (≥2500g)';
};

const getDaysBetween = (start: string, end: string): number => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
};

const getHoursBetween = (start: string, end: string): number => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60));
};

const formatDuration = (hours: number): string => {
  if (hours < 24) return `${hours} hours`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days} days`;
};

const AIReportsPage: React.FC<AIReportsPageProps> = ({
  institutionId,
  institutionName,
  selectedUnit,
  onSelectUnit,
  enabledFacilities,
  onBack
}) => {
  // State
  const [step, setStep] = useState<'select' | 'configure' | 'preview'>('select');
  const [selectedReportType, setSelectedReportType] = useState<ReportCategory>('comprehensive');
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedQuarter, setSelectedQuarter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedUnits, setSelectedUnits] = useState<Unit[]>([selectedUnit]);
  const [nicuFilter, setNicuFilter] = useState<'all' | 'inborn' | 'outborn'>('all');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [generating, setGenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Load patients from Firestore
  const loadPatients = async () => {
    if (!institutionId) return [];
    const patientsRef = collection(db, 'patients');
    const q = query(patientsRef, where('institutionId', '==', institutionId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Patient));
  };

  // Get date range based on report period
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date, endDate: Date;

    if (reportPeriod === 'monthly') {
      const [year, month] = selectedMonth.split('-').map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0);
    } else if (reportPeriod === 'quarterly') {
      const [year, q] = selectedQuarter.split('-Q');
      const quarter = parseInt(q);
      startDate = new Date(parseInt(year), (quarter - 1) * 3, 1);
      endDate = new Date(parseInt(year), quarter * 3, 0);
    } else if (reportPeriod === 'yearly') {
      startDate = new Date(selectedYear, 0, 1);
      endDate = new Date(selectedYear, 11, 31);
    } else {
      startDate = customStartDate ? new Date(customStartDate) : new Date(now.getFullYear(), 0, 1);
      endDate = customEndDate ? new Date(customEndDate) : now;
    }
    return { startDate, endDate };
  };

  // Filter patients
  const filteredPatients = useMemo(() => {
    const { startDate, endDate } = getDateRange();
    return patients.filter(p => {
      const admissionDate = new Date(p.admissionDate);
      const inDateRange = admissionDate >= startDate && admissionDate <= endDate;
      const inSelectedUnits = selectedUnits.length === 0 || selectedUnits.includes(p.unit);

      let passesNicuFilter = true;
      if (nicuFilter !== 'all' && (selectedUnits.includes(Unit.NICU) || selectedUnits.includes(Unit.SNCU))) {
        const isInborn = p.admissionType === 'Inborn';
        passesNicuFilter = nicuFilter === 'inborn' ? isInborn : !isInborn;
      }

      return inDateRange && inSelectedUnits && passesNicuFilter;
    });
  }, [patients, reportPeriod, selectedMonth, selectedQuarter, selectedYear, customStartDate, customEndDate, selectedUnits, nicuFilter]);

  // Comprehensive statistics
  const stats = useMemo(() => {
    const total = filteredPatients.length;
    const discharged = filteredPatients.filter(p => p.outcome === 'Discharged').length;
    const deceased = filteredPatients.filter(p => p.outcome === 'Deceased').length;
    const referred = filteredPatients.filter(p => p.outcome === 'Referred').length;
    const active = filteredPatients.filter(p => !p.outcome || p.outcome === 'In Progress').length;
    const stepDown = filteredPatients.filter(p => p.outcome === 'Step Down' || p.isStepDown).length;
    const lama = filteredPatients.filter(p => (p.outcome as string) === 'LAMA').length;

    // Gender statistics
    const males = filteredPatients.filter(p => p.gender === 'Male').length;
    const females = filteredPatients.filter(p => p.gender === 'Female').length;
    const ambiguous = filteredPatients.filter(p => p.gender === 'Ambiguous' || p.gender === 'Other').length;

    // Inborn/Outborn
    const inborn = filteredPatients.filter(p => p.admissionType === 'Inborn').length;
    const outborn = filteredPatients.filter(p => p.admissionType && p.admissionType !== 'Inborn').length;

    // Gestational age distribution
    const gaDistribution: Record<string, number> = {};
    filteredPatients.forEach(p => {
      const category = getGestationalAgeCategory(p.gestationalAgeWeeks);
      gaDistribution[category] = (gaDistribution[category] || 0) + 1;
    });

    // Birth weight distribution
    const bwDistribution: Record<string, number> = {};
    filteredPatients.forEach(p => {
      const category = getBirthWeightCategory(p.birthWeight);
      bwDistribution[category] = (bwDistribution[category] || 0) + 1;
    });

    // Unit-wise distribution
    const unitDistribution: Record<string, number> = {};
    filteredPatients.forEach(p => {
      const unit = p.unit || 'Unknown';
      unitDistribution[unit] = (unitDistribution[unit] || 0) + 1;
    });

    // Diagnosis distribution
    const diagnosisDistribution: Record<string, number> = {};
    filteredPatients.forEach(p => {
      const diagnosis = p.diagnosis || 'Not Specified';
      const primaryDiagnosis = diagnosis.split(',')[0].trim();
      diagnosisDistribution[primaryDiagnosis] = (diagnosisDistribution[primaryDiagnosis] || 0) + 1;
    });

    // Morbidity statistics
    const morbidities = {
      sepsis: filteredPatients.filter(p => p.diagnosis?.toLowerCase().includes('sepsis')).length,
      rds: filteredPatients.filter(p => p.diagnosis?.toLowerCase().includes('rds') || p.diagnosis?.toLowerCase().includes('respiratory distress')).length,
      nec: filteredPatients.filter(p => p.diagnosis?.toLowerCase().includes('nec') || p.diagnosis?.toLowerCase().includes('necrotizing enterocolitis')).length,
      jaundice: filteredPatients.filter(p => p.diagnosis?.toLowerCase().includes('jaundice') || p.diagnosis?.toLowerCase().includes('hyperbilirubinemia')).length,
      birthAsphyxia: filteredPatients.filter(p => p.diagnosis?.toLowerCase().includes('asphyxia') || p.diagnosis?.toLowerCase().includes('hie')).length,
      pneumonia: filteredPatients.filter(p => p.diagnosis?.toLowerCase().includes('pneumonia')).length,
      meningitis: filteredPatients.filter(p => p.diagnosis?.toLowerCase().includes('meningitis')).length,
      prematurity: filteredPatients.filter(p => p.diagnosis?.toLowerCase().includes('preterm') || p.diagnosis?.toLowerCase().includes('prematurity') || p.diagnosis?.toLowerCase().includes('lbw')).length,
    };

    // Length of Stay
    const losData = filteredPatients
      .filter(p => p.dischargeDateTime && p.admissionDate)
      .map(p => getDaysBetween(p.admissionDate, p.dischargeDateTime!));
    const avgLOS = losData.length > 0 ? (losData.reduce((a, b) => a + b, 0) / losData.length).toFixed(1) : '0';
    const maxLOS = losData.length > 0 ? Math.max(...losData) : 0;
    const minLOS = losData.length > 0 ? Math.min(...losData) : 0;

    // Mortality by categories
    const deceasedPatients = filteredPatients.filter(p => p.outcome === 'Deceased');
    const mortalityByGA: Record<string, { total: number; deceased: number }> = {};
    const mortalityByBW: Record<string, { total: number; deceased: number }> = {};

    filteredPatients.forEach(p => {
      const gaCategory = getGestationalAgeCategory(p.gestationalAgeWeeks);
      const bwCategory = getBirthWeightCategory(p.birthWeight);

      if (!mortalityByGA[gaCategory]) mortalityByGA[gaCategory] = { total: 0, deceased: 0 };
      if (!mortalityByBW[bwCategory]) mortalityByBW[bwCategory] = { total: 0, deceased: 0 };

      mortalityByGA[gaCategory].total++;
      mortalityByBW[bwCategory].total++;

      if (p.outcome === 'Deceased') {
        mortalityByGA[gaCategory].deceased++;
        mortalityByBW[bwCategory].deceased++;
      }
    });

    // Mode of delivery
    const deliveryMode: Record<string, number> = {};
    filteredPatients.forEach(p => {
      const mode = p.modeOfDelivery || 'Not Specified';
      deliveryMode[mode] = (deliveryMode[mode] || 0) + 1;
    });

    // Calculate rates
    const mortalityRate = total > 0 ? ((deceased / total) * 100).toFixed(2) : '0';
    const dischargeRate = total > 0 ? ((discharged / total) * 100).toFixed(2) : '0';
    const survivalRate = total > 0 ? (((total - deceased) / total) * 100).toFixed(2) : '0';
    const referralRate = total > 0 ? ((referred / total) * 100).toFixed(2) : '0';
    const stepDownRate = total > 0 ? ((stepDown / total) * 100).toFixed(2) : '0';

    // Gender-wise outcomes
    const maleDeceased = filteredPatients.filter(p => p.gender === 'Male' && p.outcome === 'Deceased').length;
    const femaleDeceased = filteredPatients.filter(p => p.gender === 'Female' && p.outcome === 'Deceased').length;
    const maleDischarged = filteredPatients.filter(p => p.gender === 'Male' && p.outcome === 'Discharged').length;
    const femaleDischarged = filteredPatients.filter(p => p.gender === 'Female' && p.outcome === 'Discharged').length;

    // Inborn/Outborn mortality
    const inbornDeceased = deceasedPatients.filter(p => p.admissionType === 'Inborn').length;
    const outbornDeceased = deceasedPatients.filter(p => p.admissionType && p.admissionType !== 'Inborn').length;
    const inbornMortality = inborn > 0 ? ((inbornDeceased / inborn) * 100).toFixed(2) : '0';
    const outbornMortality = outborn > 0 ? ((outbornDeceased / outborn) * 100).toFixed(2) : '0';

    // Age at death distribution
    const ageAtDeathDist: Record<string, number> = {
      'Early Neonatal (0-6 days)': 0,
      'Late Neonatal (7-28 days)': 0,
      'Post Neonatal (>28 days)': 0
    };
    deceasedPatients.forEach(p => {
      if (p.dateOfDeath && p.dateOfBirth) {
        const ageInDays = getDaysBetween(p.dateOfBirth, p.dateOfDeath);
        if (ageInDays <= 6) ageAtDeathDist['Early Neonatal (0-6 days)']++;
        else if (ageInDays <= 28) ageAtDeathDist['Late Neonatal (7-28 days)']++;
        else ageAtDeathDist['Post Neonatal (>28 days)']++;
      }
    });

    // Time to death (hours from admission)
    const timeToDeathData = deceasedPatients
      .filter(p => p.dateOfDeath && p.admissionDate)
      .map(p => getHoursBetween(p.admissionDate, p.dateOfDeath!));
    const avgTimeToDeathHours = timeToDeathData.length > 0
      ? Math.round(timeToDeathData.reduce((a, b) => a + b, 0) / timeToDeathData.length)
      : 0;

    // Step down statistics
    const stepDownPatients = filteredPatients.filter(p => p.isStepDown || p.outcome === 'Step Down');
    const stepDownLocations: Record<string, number> = {};
    stepDownPatients.forEach(p => {
      const location = p.stepDownLocation || 'Not Specified';
      stepDownLocations[location] = (stepDownLocations[location] || 0) + 1;
    });

    // Referred patients analysis
    const referredPatients = filteredPatients.filter(p => p.outcome === 'Referred');
    const referralDestinations: Record<string, number> = {};
    referredPatients.forEach(p => {
      const dest = p.referredTo || 'Not Specified';
      referralDestinations[dest] = (referralDestinations[dest] || 0) + 1;
    });

    // Daily admission trend (for the period)
    const dailyAdmissions: Record<string, number> = {};
    filteredPatients.forEach(p => {
      const date = p.admissionDate.split('T')[0];
      dailyAdmissions[date] = (dailyAdmissions[date] || 0) + 1;
    });

    return {
      total, discharged, deceased, referred, active, stepDown, lama,
      males, females, ambiguous, inborn, outborn,
      gaDistribution, bwDistribution, unitDistribution, diagnosisDistribution,
      morbidities, avgLOS, maxLOS, minLOS,
      mortalityByGA, mortalityByBW, deliveryMode,
      mortalityRate, dischargeRate, survivalRate, referralRate, stepDownRate,
      maleDeceased, femaleDeceased, maleDischarged, femaleDischarged,
      inbornMortality, outbornMortality, inbornDeceased, outbornDeceased,
      ageAtDeathDist, avgTimeToDeathHours, timeToDeathData,
      stepDownPatients, stepDownLocations,
      referredPatients, referralDestinations,
      dailyAdmissions, deceasedPatients
    };
  }, [filteredPatients]);

  // Generate report
  const generateReport = async () => {
    setGenerating(true);
    try {
      const loadedPatients = await loadPatients();
      setPatients(loadedPatients);
      setStep('preview');
    } finally {
      setGenerating(false);
    }
  };

  // Download as PDF
  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      const { startDate, endDate } = getDateRange();
      const reportTypeName = REPORT_TYPES.find(r => r.id === selectedReportType)?.title || 'Report';
      const fileName = `${reportTypeName.replace(/\s+/g, '_')}_${institutionName?.replace(/\s+/g, '_') || 'Hospital'}_${startDate.toLocaleDateString().replace(/\//g, '-')}.pdf`;
      pdf.save(fileName);
    } finally {
      setGenerating(false);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    let csvContent = '';
    const { startDate, endDate } = getDateRange();

    // Header
    csvContent += `Report Type,${REPORT_TYPES.find(r => r.id === selectedReportType)?.title}\n`;
    csvContent += `Institution,${institutionName}\n`;
    csvContent += `Period,${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n`;
    csvContent += `Generated,${new Date().toLocaleString()}\n\n`;

    // Patient data
    csvContent += 'NTID,Name,Gender,DOB,Admission Date,Unit,Diagnosis,Outcome,GA Weeks,Birth Weight\n';
    filteredPatients.forEach(p => {
      csvContent += `${p.ntid || ''},${p.name},${p.gender},${p.dateOfBirth || ''},${p.admissionDate},${p.unit},${p.diagnosis?.replace(/,/g, ';') || ''},${p.outcome || 'Active'},${p.gestationalAgeWeeks || ''},${p.birthWeight || ''}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Patient_Data_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Options for dropdowns
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  }, []);

  const quarterOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    for (let year = currentYear; year >= currentYear - 2; year--) {
      for (let q = 4; q >= 1; q--) {
        if (year === currentYear && q > Math.ceil((now.getMonth() + 1) / 3)) continue;
        options.push({ value: `${year}-Q${q}`, label: `Q${q} ${year}` });
      }
    }
    return options;
  }, []);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, []);

  const toggleUnit = (unit: Unit) => {
    setSelectedUnits(prev => prev.includes(unit) ? prev.filter(u => u !== unit) : [...prev, unit]);
  };

  const { startDate, endDate } = getDateRange();
  const dateRangeLabel = `${startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} - ${endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const showNicuFilter = selectedUnits.includes(Unit.NICU) || selectedUnits.includes(Unit.SNCU);
  const currentReportInfo = REPORT_TYPES.find(r => r.id === selectedReportType)!;

  // Render report type selector
  const renderReportTypeSelector = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Select Report Type</h2>
        <p className="text-slate-400">Choose the type of report you want to generate</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {REPORT_TYPES.map(report => (
          <button
            key={report.id}
            onClick={() => { setSelectedReportType(report.id); setStep('configure'); }}
            className={`p-5 rounded-2xl border-2 transition-all duration-300 hover:scale-[1.02] text-left group ${report.bgColor} ${report.borderColor} hover:border-opacity-60`}
          >
            <div className={`${report.color} mb-3`}>{report.icon}</div>
            <h3 className="text-white font-bold text-lg mb-1">{report.title}</h3>
            <p className="text-slate-400 text-sm">{report.subtitle}</p>
            <div className="mt-4 flex items-center gap-1 text-slate-500 group-hover:text-white transition-colors">
              <span className="text-xs">Generate</span>
              <IconChevronRight size={14} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  // Render configuration step
  const renderConfiguration = () => (
    <div className="space-y-6">
      {/* Selected Report Type Badge */}
      <div className={`p-4 rounded-xl ${currentReportInfo.bgColor} border ${currentReportInfo.borderColor} flex items-center gap-3`}>
        <div className={currentReportInfo.color}>{currentReportInfo.icon}</div>
        <div>
          <h3 className="text-white font-bold">{currentReportInfo.title}</h3>
          <p className="text-slate-400 text-sm">{currentReportInfo.subtitle}</p>
        </div>
        <button onClick={() => setStep('select')} className="ml-auto text-slate-400 hover:text-white text-sm">
          Change Report Type
        </button>
      </div>

      {/* Report Period Selection */}
      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
          <IconCalendar size={20} className="text-blue-400" />
          Report Period
        </h3>

        <div className="flex flex-wrap gap-2 mb-6">
          {(['monthly', 'quarterly', 'yearly', 'custom'] as const).map(type => (
            <button
              key={type}
              onClick={() => setReportPeriod(type)}
              className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                reportPeriod === type ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {reportPeriod === 'monthly' && (
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full md:w-72 px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white">
            {monthOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        )}

        {reportPeriod === 'quarterly' && (
          <select value={selectedQuarter} onChange={(e) => setSelectedQuarter(e.target.value)}
            className="w-full md:w-72 px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white">
            {quarterOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        )}

        {reportPeriod === 'yearly' && (
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="w-full md:w-72 px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white">
            {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        )}

        {reportPeriod === 'custom' && (
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm text-slate-400 block mb-2">Start Date</label>
              <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white" />
            </div>
            <div className="flex-1">
              <label className="text-sm text-slate-400 block mb-2">End Date</label>
              <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Unit Selection */}
      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
          <IconBed size={20} className="text-pink-400" />
          Select Units
        </h3>
        <div className="flex flex-wrap gap-3">
          {enabledFacilities.map(unit => (
            <button key={unit} onClick={() => toggleUnit(unit)}
              className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                selectedUnits.includes(unit) ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}>
              {unit}
            </button>
          ))}
          <button onClick={() => setSelectedUnits(enabledFacilities)}
            className="px-5 py-3 rounded-xl text-sm font-medium bg-slate-600 text-slate-300 hover:bg-slate-500">
            Select All
          </button>
        </div>

        {showNicuFilter && (
          <div className="mt-6 pt-4 border-t border-slate-600">
            <label className="text-sm font-medium text-slate-300 mb-3 block flex items-center gap-2">
              <IconHeartbeat size={18} className="text-pink-400" />
              Admission Type Filter (NICU/SNCU)
            </label>
            <div className="flex flex-wrap gap-2">
              {(['all', 'inborn', 'outborn'] as const).map(value => (
                <button key={value} onClick={() => setNicuFilter(value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    nicuFilter === value ? 'bg-pink-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}>
                  {value === 'all' ? 'All Patients' : value === 'inborn' ? 'Inborn Only' : 'Outborn Only'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <button onClick={generateReport} disabled={generating || selectedUnits.length === 0}
        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-2xl text-lg font-bold flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl text-white">
        {generating ? (
          <><IconLoader2 size={24} className="animate-spin" /> Generating Report...</>
        ) : (
          <><IconChartBar size={24} /> Generate {currentReportInfo.title}</>
        )}
      </button>
    </div>
  );

  // Render specific report content based on type
  const renderReportContent = () => {
    switch (selectedReportType) {
      case 'admissions':
        return renderAdmissionsReport();
      case 'deaths':
        return renderDeathsReport();
      case 'referred':
        return renderReferredReport();
      case 'stepdown':
        return renderStepDownReport();
      case 'mortality':
        return renderMortalityReport();
      case 'gender':
        return renderGenderReport();
      case 'discharge':
        return renderDischargeReport();
      default:
        return renderComprehensiveReport();
    }
  };

  // Admissions Report
  const renderAdmissionsReport = () => (
    <div className="space-y-8">
      {/* Summary Cards */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-blue-500 flex items-center gap-2">
          <IconUserPlus size={22} className="text-blue-600" /> Admission Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-xs text-slate-600 mt-1">Total Admissions</div>
          </div>
          <div className="bg-cyan-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-cyan-600">{stats.inborn}</div>
            <div className="text-xs text-slate-600 mt-1">Inborn</div>
          </div>
          <div className="bg-indigo-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-indigo-600">{stats.outborn}</div>
            <div className="text-xs text-slate-600 mt-1">Outborn</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{stats.active}</div>
            <div className="text-xs text-slate-600 mt-1">Currently Active</div>
          </div>
        </div>
      </section>

      {/* Unit-wise Distribution */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-green-500 flex items-center gap-2">
          <IconBed size={22} className="text-green-600" /> Unit-wise Distribution
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(stats.unitDistribution).map(([unit, count]) => (
            <div key={unit} className="bg-slate-50 rounded-xl p-4">
              <div className="text-2xl font-bold text-slate-700">{count}</div>
              <div className="text-sm text-slate-600">{unit}</div>
              <div className="text-xs text-slate-500">{stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : 0}%</div>
            </div>
          ))}
        </div>
      </section>

      {/* Gender Distribution */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-500 flex items-center gap-2">
          <IconUsers size={22} className="text-purple-600" /> Gender Distribution
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3">
            <IconGenderMale size={32} className="text-blue-500" />
            <div>
              <div className="text-2xl font-bold text-blue-600">{stats.males}</div>
              <div className="text-xs text-slate-600">Male ({stats.total > 0 ? ((stats.males / stats.total) * 100).toFixed(1) : 0}%)</div>
            </div>
          </div>
          <div className="bg-pink-50 rounded-xl p-4 flex items-center gap-3">
            <IconGenderFemale size={32} className="text-pink-500" />
            <div>
              <div className="text-2xl font-bold text-pink-600">{stats.females}</div>
              <div className="text-xs text-slate-600">Female ({stats.total > 0 ? ((stats.females / stats.total) * 100).toFixed(1) : 0}%)</div>
            </div>
          </div>
          <div className="bg-slate-100 rounded-xl p-4">
            <div className="text-2xl font-bold text-slate-600">{stats.ambiguous}</div>
            <div className="text-xs text-slate-600">Ambiguous/Other</div>
          </div>
        </div>
      </section>

      {/* Birth Weight & Gestational Age */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-bold text-slate-700 mb-3">Birth Weight Distribution</h4>
          <div className="space-y-2">
            {Object.entries(stats.bwDistribution).map(([cat, count]) => (
              <div key={cat} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="text-sm text-slate-600">{cat}</span>
                <span className="font-semibold text-slate-700">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-bold text-slate-700 mb-3">Gestational Age Distribution</h4>
          <div className="space-y-2">
            {Object.entries(stats.gaDistribution).map(([cat, count]) => (
              <div key={cat} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="text-sm text-slate-600">{cat}</span>
                <span className="font-semibold text-slate-700">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Top Admission Diagnoses */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-amber-500 flex items-center gap-2">
          <IconClipboardList size={22} className="text-amber-600" /> Top Admission Diagnoses
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left p-3 font-semibold">Rank</th>
                <th className="text-left p-3 font-semibold">Diagnosis</th>
                <th className="text-center p-3 font-semibold">Count</th>
                <th className="text-center p-3 font-semibold">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.diagnosisDistribution)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 15)
                .map(([diagnosis, count], index) => (
                  <tr key={diagnosis} className="border-b border-slate-200">
                    <td className="p-3">{index + 1}</td>
                    <td className="p-3 font-medium">{diagnosis}</td>
                    <td className="p-3 text-center">{count}</td>
                    <td className="p-3 text-center">{stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Patient List */}
      {renderPatientRegistry('Admitted Patients', filteredPatients)}
    </div>
  );

  // Deaths Report
  const renderDeathsReport = () => (
    <div className="space-y-8">
      {/* Death Summary */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-red-500 flex items-center gap-2">
          <IconSkull size={22} className="text-red-600" /> Death Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{stats.deceased}</div>
            <div className="text-xs text-slate-600 mt-1">Total Deaths</div>
          </div>
          <div className="bg-rose-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-rose-600">{stats.mortalityRate}%</div>
            <div className="text-xs text-slate-600 mt-1">Mortality Rate</div>
          </div>
          <div className="bg-orange-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-orange-600">{formatDuration(stats.avgTimeToDeathHours)}</div>
            <div className="text-xs text-slate-600 mt-1">Avg. Time to Death</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.survivalRate}%</div>
            <div className="text-xs text-slate-600 mt-1">Survival Rate</div>
          </div>
        </div>
      </section>

      {/* Age at Death Distribution */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-amber-500 flex items-center gap-2">
          <IconActivity size={22} className="text-amber-600" /> Age at Death Distribution
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(stats.ageAtDeathDist).map(([period, count]) => (
            <div key={period} className="bg-slate-50 rounded-xl p-5">
              <div className="text-3xl font-bold text-slate-700">{count}</div>
              <div className="text-sm text-slate-600 mt-1">{period}</div>
              <div className="text-xs text-slate-500">
                {stats.deceased > 0 ? ((count / stats.deceased) * 100).toFixed(1) : 0}% of deaths
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Inborn vs Outborn Mortality */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-500 flex items-center gap-2">
          <IconHeartbeat size={22} className="text-purple-600" /> Inborn vs Outborn Mortality
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 rounded-xl p-5">
            <h4 className="font-semibold text-blue-800 mb-2">Inborn Deaths</h4>
            <div className="text-4xl font-bold text-blue-600">{stats.inbornDeceased}</div>
            <div className="text-sm text-slate-600 mt-2">
              Mortality Rate: <span className="font-bold text-red-600">{stats.inbornMortality}%</span>
            </div>
            <div className="text-xs text-slate-500">Out of {stats.inborn} inborn admissions</div>
          </div>
          <div className="bg-indigo-50 rounded-xl p-5">
            <h4 className="font-semibold text-indigo-800 mb-2">Outborn Deaths</h4>
            <div className="text-4xl font-bold text-indigo-600">{stats.outbornDeceased}</div>
            <div className="text-sm text-slate-600 mt-2">
              Mortality Rate: <span className="font-bold text-red-600">{stats.outbornMortality}%</span>
            </div>
            <div className="text-xs text-slate-500">Out of {stats.outborn} outborn admissions</div>
          </div>
        </div>
      </section>

      {/* Cause of Death Analysis */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-red-500 flex items-center gap-2">
          <IconStethoscope size={22} className="text-red-600" /> Primary Diagnoses of Deceased Patients
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-red-50">
                <th className="text-left p-3 font-semibold">Diagnosis</th>
                <th className="text-center p-3 font-semibold">Deaths</th>
                <th className="text-center p-3 font-semibold">% of Deaths</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const deathDiagnoses: Record<string, number> = {};
                stats.deceasedPatients.forEach(p => {
                  const diag = p.diagnosis?.split(',')[0].trim() || 'Not Specified';
                  deathDiagnoses[diag] = (deathDiagnoses[diag] || 0) + 1;
                });
                return Object.entries(deathDiagnoses)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                  .map(([diag, count]) => (
                    <tr key={diag} className="border-b border-slate-200">
                      <td className="p-3 font-medium">{diag}</td>
                      <td className="p-3 text-center">{count}</td>
                      <td className="p-3 text-center">{stats.deceased > 0 ? ((count / stats.deceased) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ));
              })()}
            </tbody>
          </table>
        </div>
      </section>

      {/* Deceased Patient List */}
      {renderPatientRegistry('Deceased Patients', stats.deceasedPatients)}
    </div>
  );

  // Referred Report
  const renderReferredReport = () => (
    <div className="space-y-8">
      {/* Referral Summary */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-amber-500 flex items-center gap-2">
          <IconTransfer size={22} className="text-amber-600" /> Referral Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-amber-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{stats.referred}</div>
            <div className="text-xs text-slate-600 mt-1">Total Referrals Out</div>
          </div>
          <div className="bg-orange-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-orange-600">{stats.referralRate}%</div>
            <div className="text-xs text-slate-600 mt-1">Referral Rate</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-xs text-slate-600 mt-1">Total Admissions</div>
          </div>
        </div>
      </section>

      {/* Referral Destinations */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-blue-500 flex items-center gap-2">
          <IconBed size={22} className="text-blue-600" /> Referral Destinations
        </h3>
        {Object.keys(stats.referralDestinations).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(stats.referralDestinations)
              .sort((a, b) => b[1] - a[1])
              .map(([dest, count]) => (
                <div key={dest} className="flex justify-between items-center bg-slate-50 p-4 rounded-lg">
                  <span className="font-medium text-slate-700">{dest}</span>
                  <div className="text-right">
                    <span className="font-bold text-amber-600">{count}</span>
                    <span className="text-slate-500 text-sm ml-2">
                      ({stats.referred > 0 ? ((count / stats.referred) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-slate-500 italic">No referral destination data available</p>
        )}
      </section>

      {/* Referred Patients List */}
      {renderPatientRegistry('Referred Patients', stats.referredPatients)}
    </div>
  );

  // Step Down Report
  const renderStepDownReport = () => (
    <div className="space-y-8">
      {/* Step Down Summary */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-teal-500 flex items-center gap-2">
          <IconArrowDown size={22} className="text-teal-600" /> Step Down Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-teal-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-teal-600">{stats.stepDown}</div>
            <div className="text-xs text-slate-600 mt-1">Total Step Downs</div>
          </div>
          <div className="bg-cyan-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-cyan-600">{stats.stepDownRate}%</div>
            <div className="text-xs text-slate-600 mt-1">Step Down Rate</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-xs text-slate-600 mt-1">Total Admissions</div>
          </div>
        </div>
      </section>

      {/* Step Down Locations */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-green-500 flex items-center gap-2">
          <IconBed size={22} className="text-green-600" /> Step Down Locations
        </h3>
        {Object.keys(stats.stepDownLocations).length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(stats.stepDownLocations).map(([location, count]) => (
              <div key={location} className="bg-slate-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-slate-700">{count}</div>
                <div className="text-sm text-slate-600">{location}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 italic">No step down data available</p>
        )}
      </section>

      {/* Step Down Patients List */}
      {renderPatientRegistry('Step Down Patients', stats.stepDownPatients)}
    </div>
  );

  // Mortality Analysis Report
  const renderMortalityReport = () => (
    <div className="space-y-8">
      {/* Key Mortality Indicators */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-rose-500 flex items-center gap-2">
          <IconTrendingUp size={22} className="text-rose-600" /> Key Mortality Indicators
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{stats.mortalityRate}%</div>
            <div className="text-xs text-slate-600 mt-1">Overall Mortality Rate</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.inbornMortality}%</div>
            <div className="text-xs text-slate-600 mt-1">Inborn Mortality</div>
          </div>
          <div className="bg-indigo-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-indigo-600">{stats.outbornMortality}%</div>
            <div className="text-xs text-slate-600 mt-1">Outborn Mortality</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.survivalRate}%</div>
            <div className="text-xs text-slate-600 mt-1">Survival Rate</div>
          </div>
        </div>
      </section>

      {/* Mortality by Birth Weight */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-500 flex items-center gap-2">
          <IconActivity size={22} className="text-purple-600" /> Mortality by Birth Weight Category
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left p-3 font-semibold">Category</th>
                <th className="text-center p-3 font-semibold">Total</th>
                <th className="text-center p-3 font-semibold">Deaths</th>
                <th className="text-center p-3 font-semibold">Mortality Rate</th>
              </tr>
            </thead>
            <tbody>
              {['ELBW (<1000g)', 'VLBW (1000-1499g)', 'LBW (1500-2499g)', 'Normal (≥2500g)', 'Unknown'].map(cat => {
                const data = stats.mortalityByBW[cat] || { total: 0, deceased: 0 };
                const mortRate = data.total > 0 ? ((data.deceased / data.total) * 100).toFixed(1) : '0';
                return (
                  <tr key={cat} className="border-b border-slate-200">
                    <td className="p-3 font-medium">{cat}</td>
                    <td className="p-3 text-center">{data.total}</td>
                    <td className="p-3 text-center text-red-600">{data.deceased}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        parseFloat(mortRate) > 30 ? 'bg-red-100 text-red-700' :
                        parseFloat(mortRate) > 15 ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>{mortRate}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mortality by Gestational Age */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-blue-500 flex items-center gap-2">
          <IconBabyCarriage size={22} className="text-blue-600" /> Mortality by Gestational Age
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left p-3 font-semibold">Category</th>
                <th className="text-center p-3 font-semibold">Total</th>
                <th className="text-center p-3 font-semibold">Deaths</th>
                <th className="text-center p-3 font-semibold">Mortality Rate</th>
              </tr>
            </thead>
            <tbody>
              {['Extremely Preterm (<28 weeks)', 'Very Preterm (28-31 weeks)', 'Moderate/Late Preterm (32-36 weeks)', 'Term (≥37 weeks)', 'Unknown'].map(cat => {
                const data = stats.mortalityByGA[cat] || { total: 0, deceased: 0 };
                const mortRate = data.total > 0 ? ((data.deceased / data.total) * 100).toFixed(1) : '0';
                return (
                  <tr key={cat} className="border-b border-slate-200">
                    <td className="p-3 font-medium">{cat}</td>
                    <td className="p-3 text-center">{data.total}</td>
                    <td className="p-3 text-center text-red-600">{data.deceased}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        parseFloat(mortRate) > 40 ? 'bg-red-100 text-red-700' :
                        parseFloat(mortRate) > 20 ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>{mortRate}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gender-wise Mortality */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-pink-500 flex items-center gap-2">
          <IconUsers size={22} className="text-pink-600" /> Gender-wise Mortality
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 rounded-xl p-5 flex items-center gap-4">
            <IconGenderMale size={40} className="text-blue-500" />
            <div>
              <div className="text-3xl font-bold text-blue-600">{stats.maleDeceased}</div>
              <div className="text-sm text-slate-600">Male Deaths</div>
              <div className="text-xs text-slate-500">
                Mortality: {stats.males > 0 ? ((stats.maleDeceased / stats.males) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
          <div className="bg-pink-50 rounded-xl p-5 flex items-center gap-4">
            <IconGenderFemale size={40} className="text-pink-500" />
            <div>
              <div className="text-3xl font-bold text-pink-600">{stats.femaleDeceased}</div>
              <div className="text-sm text-slate-600">Female Deaths</div>
              <div className="text-xs text-slate-500">
                Mortality: {stats.females > 0 ? ((stats.femaleDeceased / stats.females) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  // Gender Analysis Report
  const renderGenderReport = () => (
    <div className="space-y-8">
      {/* Gender Summary */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-500 flex items-center gap-2">
          <IconUsers size={22} className="text-purple-600" /> Gender Distribution Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 rounded-xl p-6 flex items-center gap-4">
            <IconGenderMale size={48} className="text-blue-500" />
            <div>
              <div className="text-4xl font-bold text-blue-600">{stats.males}</div>
              <div className="text-sm text-slate-600">Male Patients</div>
              <div className="text-lg font-semibold text-blue-500">
                {stats.total > 0 ? ((stats.males / stats.total) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
          <div className="bg-pink-50 rounded-xl p-6 flex items-center gap-4">
            <IconGenderFemale size={48} className="text-pink-500" />
            <div>
              <div className="text-4xl font-bold text-pink-600">{stats.females}</div>
              <div className="text-sm text-slate-600">Female Patients</div>
              <div className="text-lg font-semibold text-pink-500">
                {stats.total > 0 ? ((stats.females / stats.total) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
          <div className="bg-slate-100 rounded-xl p-6">
            <div className="text-4xl font-bold text-slate-600">{stats.ambiguous}</div>
            <div className="text-sm text-slate-600">Ambiguous/Other</div>
            <div className="text-lg font-semibold text-slate-500">
              {stats.total > 0 ? ((stats.ambiguous / stats.total) * 100).toFixed(1) : 0}%
            </div>
          </div>
        </div>
      </section>

      {/* Gender Ratio */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-indigo-500 flex items-center gap-2">
          <IconChartBar size={22} className="text-indigo-600" /> Gender Ratio Analysis
        </h3>
        <div className="bg-slate-50 rounded-xl p-6">
          <div className="text-center mb-4">
            <span className="text-2xl font-bold text-slate-700">
              Male : Female Ratio = {stats.females > 0 ? (stats.males / stats.females).toFixed(2) : 'N/A'} : 1
            </span>
          </div>
          <div className="flex h-8 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 flex items-center justify-center text-white text-xs font-bold"
              style={{ width: `${stats.total > 0 ? (stats.males / stats.total) * 100 : 0}%` }}
            >
              {stats.males}
            </div>
            <div
              className="bg-pink-500 flex items-center justify-center text-white text-xs font-bold"
              style={{ width: `${stats.total > 0 ? (stats.females / stats.total) * 100 : 0}%` }}
            >
              {stats.females}
            </div>
            {stats.ambiguous > 0 && (
              <div
                className="bg-slate-400 flex items-center justify-center text-white text-xs font-bold"
                style={{ width: `${(stats.ambiguous / stats.total) * 100}%` }}
              >
                {stats.ambiguous}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Outcomes by Gender */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-green-500 flex items-center gap-2">
          <IconActivity size={22} className="text-green-600" /> Outcomes by Gender
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left p-3 font-semibold">Outcome</th>
                <th className="text-center p-3 font-semibold">Male</th>
                <th className="text-center p-3 font-semibold">Female</th>
                <th className="text-center p-3 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {[
                { outcome: 'Discharged', male: stats.maleDischarged, female: stats.femaleDischarged },
                { outcome: 'Deceased', male: stats.maleDeceased, female: stats.femaleDeceased },
                {
                  outcome: 'Referred',
                  male: filteredPatients.filter(p => p.gender === 'Male' && p.outcome === 'Referred').length,
                  female: filteredPatients.filter(p => p.gender === 'Female' && p.outcome === 'Referred').length
                },
                {
                  outcome: 'Active/In Progress',
                  male: filteredPatients.filter(p => p.gender === 'Male' && (!p.outcome || p.outcome === 'In Progress')).length,
                  female: filteredPatients.filter(p => p.gender === 'Female' && (!p.outcome || p.outcome === 'In Progress')).length
                }
              ].map(row => (
                <tr key={row.outcome} className="border-b border-slate-200">
                  <td className="p-3 font-medium">{row.outcome}</td>
                  <td className="p-3 text-center text-blue-600">{row.male}</td>
                  <td className="p-3 text-center text-pink-600">{row.female}</td>
                  <td className="p-3 text-center font-bold">{row.male + row.female}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gender-wise Mortality Comparison */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-red-500 flex items-center gap-2">
          <IconAlertTriangle size={22} className="text-red-600" /> Gender-wise Mortality Rates
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 rounded-xl p-5 border-2 border-blue-200">
            <div className="flex items-center gap-3 mb-3">
              <IconGenderMale size={28} className="text-blue-500" />
              <h4 className="font-bold text-blue-800">Male Mortality</h4>
            </div>
            <div className="text-3xl font-bold text-red-600 mb-2">
              {stats.males > 0 ? ((stats.maleDeceased / stats.males) * 100).toFixed(2) : 0}%
            </div>
            <div className="text-sm text-slate-600">
              {stats.maleDeceased} deaths out of {stats.males} male admissions
            </div>
          </div>
          <div className="bg-pink-50 rounded-xl p-5 border-2 border-pink-200">
            <div className="flex items-center gap-3 mb-3">
              <IconGenderFemale size={28} className="text-pink-500" />
              <h4 className="font-bold text-pink-800">Female Mortality</h4>
            </div>
            <div className="text-3xl font-bold text-red-600 mb-2">
              {stats.females > 0 ? ((stats.femaleDeceased / stats.females) * 100).toFixed(2) : 0}%
            </div>
            <div className="text-sm text-slate-600">
              {stats.femaleDeceased} deaths out of {stats.females} female admissions
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  // Discharge Report
  const renderDischargeReport = () => {
    const dischargedPatients = filteredPatients.filter(p => p.outcome === 'Discharged');

    return (
      <div className="space-y-8">
        {/* Discharge Summary */}
        <section>
          <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-green-500 flex items-center gap-2">
            <IconCheck size={22} className="text-green-600" /> Discharge Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{stats.discharged}</div>
              <div className="text-xs text-slate-600 mt-1">Total Discharged</div>
            </div>
            <div className="bg-teal-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-teal-600">{stats.dischargeRate}%</div>
              <div className="text-xs text-slate-600 mt-1">Discharge Rate</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.avgLOS} days</div>
              <div className="text-xs text-slate-600 mt-1">Avg Length of Stay</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-amber-600">{stats.lama}</div>
              <div className="text-xs text-slate-600 mt-1">LAMA Cases</div>
            </div>
          </div>
        </section>

        {/* Length of Stay Statistics */}
        <section>
          <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-blue-500 flex items-center gap-2">
            <IconBed size={22} className="text-blue-600" /> Length of Stay Analysis
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-slate-700">{stats.minLOS}</div>
              <div className="text-xs text-slate-600">Minimum (days)</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.avgLOS}</div>
              <div className="text-xs text-slate-600">Average (days)</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-slate-700">{stats.maxLOS}</div>
              <div className="text-xs text-slate-600">Maximum (days)</div>
            </div>
          </div>
        </section>

        {/* Discharge Outcomes Breakdown */}
        <section>
          <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-500 flex items-center gap-2">
            <IconChartBar size={22} className="text-purple-600" /> Outcome Distribution
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Discharged', count: stats.discharged, color: 'green' },
              { label: 'Active', count: stats.active, color: 'blue' },
              { label: 'Deceased', count: stats.deceased, color: 'red' },
              { label: 'Referred', count: stats.referred, color: 'amber' },
              { label: 'Step Down', count: stats.stepDown, color: 'teal' }
            ].map(item => (
              <div key={item.label} className={`bg-${item.color}-50 rounded-xl p-4 text-center`}>
                <div className={`text-2xl font-bold text-${item.color}-600`}>{item.count}</div>
                <div className="text-xs text-slate-600">{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Discharged Patients List */}
        {renderPatientRegistry('Discharged Patients', dischargedPatients)}
      </div>
    );
  };

  // Comprehensive Report (existing)
  const renderComprehensiveReport = () => (
    <div className="space-y-8">
      {/* Executive Summary */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-blue-500 flex items-center gap-2">
          <IconChartBar size={22} className="text-blue-600" /> Executive Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-xs text-slate-600 mt-1">Total Admissions</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.discharged}</div>
            <div className="text-xs text-slate-600 mt-1">Discharged</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-amber-600">{stats.active}</div>
            <div className="text-xs text-slate-600 mt-1">Currently Active</div>
          </div>
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{stats.deceased}</div>
            <div className="text-xs text-slate-600 mt-1">Deceased</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-purple-600">{stats.referred}</div>
            <div className="text-xs text-slate-600 mt-1">Referred Out</div>
          </div>
          <div className="bg-teal-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-teal-600">{stats.stepDown}</div>
            <div className="text-xs text-slate-600 mt-1">Step Down</div>
          </div>
        </div>

        {/* Key Rates */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-slate-100 rounded-lg p-3">
            <div className="text-lg font-bold text-green-600">{stats.survivalRate}%</div>
            <div className="text-xs text-slate-600">Survival Rate</div>
          </div>
          <div className="bg-slate-100 rounded-lg p-3">
            <div className="text-lg font-bold text-red-600">{stats.mortalityRate}%</div>
            <div className="text-xs text-slate-600">Mortality Rate</div>
          </div>
          <div className="bg-slate-100 rounded-lg p-3">
            <div className="text-lg font-bold text-blue-600">{stats.avgLOS} days</div>
            <div className="text-xs text-slate-600">Avg. Length of Stay</div>
          </div>
          <div className="bg-slate-100 rounded-lg p-3">
            <div className="text-lg font-bold text-amber-600">{stats.referralRate}%</div>
            <div className="text-xs text-slate-600">Referral Rate</div>
          </div>
        </div>
      </section>

      {/* Inborn vs Outborn */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-pink-500 flex items-center gap-2">
          <IconHeartbeat size={22} className="text-pink-600" /> Inborn vs Outborn Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-blue-50 rounded-xl p-5">
            <h4 className="font-semibold text-blue-800 mb-3">Inborn Admissions</h4>
            <div className="text-4xl font-bold text-blue-600">{stats.inborn}</div>
            <div className="text-sm text-slate-600 mt-1">
              {stats.total > 0 ? ((stats.inborn / stats.total) * 100).toFixed(1) : 0}% of total
            </div>
            <div className="mt-3 pt-3 border-t border-blue-200">
              <span className="text-sm">Mortality Rate: </span>
              <span className="font-semibold text-red-600">{stats.inbornMortality}%</span>
            </div>
          </div>
          <div className="bg-indigo-50 rounded-xl p-5">
            <h4 className="font-semibold text-indigo-800 mb-3">Outborn Admissions</h4>
            <div className="text-4xl font-bold text-indigo-600">{stats.outborn}</div>
            <div className="text-sm text-slate-600 mt-1">
              {stats.total > 0 ? ((stats.outborn / stats.total) * 100).toFixed(1) : 0}% of total
            </div>
            <div className="mt-3 pt-3 border-t border-indigo-200">
              <span className="text-sm">Mortality Rate: </span>
              <span className="font-semibold text-red-600">{stats.outbornMortality}%</span>
            </div>
          </div>
        </div>
      </section>

      {/* Birth Weight & GA Distribution */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <IconActivity size={20} className="text-green-600" /> Birth Weight Distribution
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left p-2 font-semibold">Category</th>
                  <th className="text-center p-2 font-semibold">Count</th>
                  <th className="text-center p-2 font-semibold">Mortality</th>
                </tr>
              </thead>
              <tbody>
                {['ELBW (<1000g)', 'VLBW (1000-1499g)', 'LBW (1500-2499g)', 'Normal (≥2500g)'].map(cat => {
                  const data = stats.mortalityByBW[cat] || { total: 0, deceased: 0 };
                  const mortRate = data.total > 0 ? ((data.deceased / data.total) * 100).toFixed(1) : '0';
                  return (
                    <tr key={cat} className="border-b border-slate-200">
                      <td className="p-2 font-medium text-xs">{cat}</td>
                      <td className="p-2 text-center">{data.total}</td>
                      <td className="p-2 text-center text-red-600">{mortRate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <IconBabyCarriage size={20} className="text-purple-600" /> Gestational Age Distribution
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left p-2 font-semibold">Category</th>
                  <th className="text-center p-2 font-semibold">Count</th>
                  <th className="text-center p-2 font-semibold">Mortality</th>
                </tr>
              </thead>
              <tbody>
                {['Extremely Preterm (<28 weeks)', 'Very Preterm (28-31 weeks)', 'Moderate/Late Preterm (32-36 weeks)', 'Term (≥37 weeks)'].map(cat => {
                  const data = stats.mortalityByGA[cat] || { total: 0, deceased: 0 };
                  const mortRate = data.total > 0 ? ((data.deceased / data.total) * 100).toFixed(1) : '0';
                  return (
                    <tr key={cat} className="border-b border-slate-200">
                      <td className="p-2 font-medium text-xs">{cat}</td>
                      <td className="p-2 text-center">{data.total}</td>
                      <td className="p-2 text-center text-red-600">{mortRate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Morbidity Profile */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-red-500 flex items-center gap-2">
          <IconActivity size={22} className="text-red-600" /> Morbidity Profile
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Sepsis', value: stats.morbidities.sepsis, color: 'red' },
            { label: 'RDS', value: stats.morbidities.rds, color: 'blue' },
            { label: 'Birth Asphyxia', value: stats.morbidities.birthAsphyxia, color: 'purple' },
            { label: 'Jaundice', value: stats.morbidities.jaundice, color: 'amber' },
            { label: 'Prematurity', value: stats.morbidities.prematurity, color: 'pink' },
            { label: 'NEC', value: stats.morbidities.nec, color: 'orange' },
            { label: 'Pneumonia', value: stats.morbidities.pneumonia, color: 'cyan' },
            { label: 'Meningitis', value: stats.morbidities.meningitis, color: 'indigo' },
          ].map(item => (
            <div key={item.label} className={`bg-${item.color}-50 rounded-xl p-4`}>
              <div className={`text-2xl font-bold text-${item.color}-600`}>{item.value}</div>
              <div className="text-xs text-slate-600 mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Patient Registry */}
      {renderPatientRegistry('Patient Registry', filteredPatients.slice(0, 30))}
      {filteredPatients.length > 30 && (
        <p className="text-xs text-slate-500 text-center italic">
          Showing 30 of {filteredPatients.length} patients. Export to CSV for full list.
        </p>
      )}
    </div>
  );

  // Reusable Patient Registry component
  const renderPatientRegistry = (title: string, patients: Patient[]) => (
    <section>
      <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-slate-400 flex items-center gap-2">
        <IconClipboardList size={22} className="text-slate-600" /> {title} ({patients.length})
      </h3>
      {patients.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left p-2 font-semibold">S.No</th>
                <th className="text-left p-2 font-semibold">NTID</th>
                <th className="text-left p-2 font-semibold">Name</th>
                <th className="text-left p-2 font-semibold">Gender</th>
                <th className="text-left p-2 font-semibold">GA</th>
                <th className="text-left p-2 font-semibold">BW</th>
                <th className="text-left p-2 font-semibold">Admission</th>
                <th className="text-left p-2 font-semibold">Diagnosis</th>
                <th className="text-left p-2 font-semibold">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {patients.slice(0, 50).map((patient, index) => (
                <tr key={patient.id} className="border-b border-slate-200">
                  <td className="p-2">{index + 1}</td>
                  <td className="p-2 font-mono text-xs">{patient.ntid || '-'}</td>
                  <td className="p-2 font-medium">{patient.name}</td>
                  <td className="p-2">{patient.gender?.charAt(0) || '-'}</td>
                  <td className="p-2">{patient.gestationalAgeWeeks ? `${patient.gestationalAgeWeeks}w` : '-'}</td>
                  <td className="p-2">{patient.birthWeight ? `${patient.birthWeight < 10 ? (patient.birthWeight * 1000).toFixed(0) : patient.birthWeight}g` : '-'}</td>
                  <td className="p-2">{new Date(patient.admissionDate).toLocaleDateString('en-IN')}</td>
                  <td className="p-2 max-w-[150px] truncate">{patient.diagnosis || '-'}</td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      patient.outcome === 'Discharged' ? 'bg-green-100 text-green-700' :
                      patient.outcome === 'Deceased' ? 'bg-red-100 text-red-700' :
                      patient.outcome === 'Referred' ? 'bg-amber-100 text-amber-700' :
                      patient.outcome === 'Step Down' ? 'bg-teal-100 text-teal-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {patient.outcome || 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {patients.length > 50 && (
            <p className="text-xs text-slate-500 mt-2 text-center italic">
              Showing 50 of {patients.length} patients. Export to CSV for full list.
            </p>
          )}
        </div>
      ) : (
        <p className="text-slate-500 italic text-center py-8">No patients found for the selected criteria</p>
      )}
    </section>
  );

  // Render preview
  const renderPreview = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setStep('configure')}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium flex items-center gap-2 text-white">
          <IconArrowLeft size={18} /> Back to Settings
        </button>
        <div className="flex gap-2">
          <button onClick={exportToCSV} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium flex items-center gap-2 text-white">
            <IconFileSpreadsheet size={18} /> Export CSV
          </button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium flex items-center gap-2 text-white">
            <IconPrinter size={18} /> Print
          </button>
          <button onClick={downloadPDF} disabled={generating} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium flex items-center gap-2 text-white disabled:opacity-50">
            {generating ? <IconLoader2 size={18} className="animate-spin" /> : <IconDownload size={18} />}
            Download PDF
          </button>
        </div>
      </div>

      <div ref={reportRef} className="bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden print:shadow-none">
        {/* Report Header */}
        <div className={`${
          selectedReportType === 'deaths' || selectedReportType === 'mortality' ? 'bg-gradient-to-r from-red-700 to-rose-700' :
          selectedReportType === 'admissions' ? 'bg-gradient-to-r from-blue-700 to-cyan-700' :
          selectedReportType === 'referred' ? 'bg-gradient-to-r from-amber-600 to-orange-600' :
          selectedReportType === 'stepdown' ? 'bg-gradient-to-r from-teal-600 to-cyan-600' :
          selectedReportType === 'gender' ? 'bg-gradient-to-r from-purple-600 to-pink-600' :
          selectedReportType === 'discharge' ? 'bg-gradient-to-r from-green-600 to-emerald-600' :
          'bg-gradient-to-r from-blue-700 to-indigo-700'
        } text-white p-8`}>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">{institutionName}</h1>
              <h2 className="text-xl mt-1 opacity-90">{currentReportInfo.title}</h2>
              <p className="text-white/80 mt-2">{dateRangeLabel}</p>
              <p className="text-white/70 text-sm mt-1">Units: {selectedUnits.join(', ')}</p>
              {nicuFilter !== 'all' && <p className="text-white/70 text-sm">Filter: {nicuFilter === 'inborn' ? 'Inborn Only' : 'Outborn Only'}</p>}
            </div>
            <div className="text-right text-sm text-white/70">
              <p>Generated: {new Date().toLocaleDateString('en-IN')}</p>
              <p>{new Date().toLocaleTimeString('en-IN')}</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          {renderReportContent()}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t-2 border-slate-200 text-center text-sm text-slate-500">
            <p className="font-medium">Report generated on {new Date().toLocaleString('en-IN')}</p>
            <p className="mt-1">Powered by NeoLink Advanced Healthcare Analytics</p>
            <p className="text-xs mt-2 italic">
              Data based on Vermont Oxford Network (VON) and National Neonatology Forum (NNF) India standards
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-xl transition-colors">
                <IconArrowLeft size={22} />
              </button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <IconFileAnalytics size={24} className="text-indigo-400" />
                  Report Generator
                </h1>
                <p className="text-xs text-slate-400">{institutionName} - Advanced Healthcare Analytics</p>
              </div>
            </div>
            {step !== 'select' && (
              <div className="text-sm text-slate-400">
                Step {step === 'configure' ? '2' : '3'} of 3: {step === 'configure' ? 'Configure Report' : 'Preview & Export'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {step === 'select' && renderReportTypeSelector()}
        {step === 'configure' && renderConfiguration()}
        {step === 'preview' && renderPreview()}
      </div>
    </div>
  );
};

export default AIReportsPage;
