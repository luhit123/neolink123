import React, { useState, useMemo, useRef, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Patient, Unit, ObservationPatient, ObservationOutcome } from '../types';
import {
  getCanonicalAdmissionType,
  getCanonicalOutcome,
  getPatientAdmissionDate,
  isPatientAdmittedWithinRange,
  matchesAdmissionTypeFilter,
  parseAnalyticsDate,
  toAnalyticsPatients,
} from '../utils/analytics';
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
  IconCheck,
  IconCopy,
  IconClipboard,
  IconSun,
  IconClock
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
  | 'dailyUpdate'
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
    id: 'dailyUpdate',
    title: 'Daily Update',
    subtitle: 'Quick copyable summary for WhatsApp/SMS',
    icon: <IconSun size={28} />,
    color: 'text-amber-400',
    bgColor: 'bg-gradient-to-br from-amber-500/20 to-orange-500/20',
    borderColor: 'border-amber-500/50'
  },
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

const PDF_UNIT_LABEL = 'Neonatal Intensive Care Unit';
const PDF_INSTITUTION_LABEL = 'Nalbari Medical College and Hospital';

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

// Comprehensive helper for parsing dates safely from various formats
const parseSafeDate = (dateStr: any): Date | null => {
  return parseAnalyticsDate(dateStr);
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
  const [observationPatients, setObservationPatients] = useState<ObservationPatient[]>([]);
  const [generating, setGenerating] = useState(false);
  const [shiftStartTime, setShiftStartTime] = useState<string | null>(null); // Start as null to detect loading
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Daily Update Multi-Step Flow
  const [dailyUpdateStep, setDailyUpdateStep] = useState<'type' | 'shift' | 'report'>('type');
  const [dailyUpdateType, setDailyUpdateType] = useState<'inborn' | 'outborn' | 'all'>('all');
  const [dailyUpdateShift, setDailyUpdateShift] = useState<'morning' | 'afternoon' | 'night' | 'current' | 'full24'>('current');
  const [showPatientDetails, setShowPatientDetails] = useState<boolean>(false); // Toggle for patient-level details in reports - default OFF

  // Shift time configurations (can be customized by admin in future)
  const SHIFT_OPTIONS = [
    { id: 'morning', label: 'Morning Shift', time: '8:00 AM - 2:00 PM', icon: '🌅', startHour: 8, endHour: 14, color: 'from-amber-400 to-orange-500' },
    { id: 'afternoon', label: 'Afternoon Shift', time: '2:00 PM - 8:00 PM', icon: '☀️', startHour: 14, endHour: 20, color: 'from-blue-400 to-cyan-500' },
    { id: 'night', label: 'Night Shift', time: '8:00 PM - 8:00 AM', icon: '🌙', startHour: 20, endHour: 8, color: 'from-indigo-500 to-purple-600' },
    { id: 'current', label: 'Current Shift', time: 'Based on current time', icon: '⏰', startHour: -1, endHour: -1, color: 'from-emerald-400 to-teal-500' },
    { id: 'full24', label: 'Full 24 Hours', time: 'Last 24 hours', icon: '📅', startHour: -2, endHour: -2, color: 'from-slate-500 to-slate-700' },
  ] as const;

  // Load institution shift start time
  useEffect(() => {
    const loadShiftTime = async () => {
      if (!institutionId) return;
      try {
        const institutionDoc = await getDoc(doc(db, 'institutions', institutionId));
        if (institutionDoc.exists()) {
          const data = institutionDoc.data();
          if (data.shiftStartTime) {
            setShiftStartTime(data.shiftStartTime);
          } else {
            setShiftStartTime('08:00'); // Fallback
          }
        } else {
          setShiftStartTime('08:00'); // Fallback
        }
      } catch (err) {
        console.error('Error loading shift time:', err);
      }
    };
    loadShiftTime();
  }, [institutionId]);

  // Load patients from Firestore
  const loadPatients = async () => {
    if (!institutionId) return [];
    const patientsRef = collection(db, 'patients');
    const q = query(patientsRef, where('institutionId', '==', institutionId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Patient));
  };

  // Load observation patients from Firestore
  const loadObservationPatients = async () => {
    if (!institutionId) return [];
    const obsRef = collection(db, 'observationPatients');
    const q = query(obsRef, where('institutionId', '==', institutionId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ObservationPatient));
  };

  // Get date range based on report period
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date, endDate: Date;

    if (reportPeriod === 'monthly') {
      const [year, month] = selectedMonth.split('-').map(Number);
      startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    } else if (reportPeriod === 'quarterly') {
      const [year, q] = selectedQuarter.split('-Q');
      const quarter = parseInt(q);
      startDate = new Date(parseInt(year), (quarter - 1) * 3, 1, 0, 0, 0, 0);
      endDate = new Date(parseInt(year), quarter * 3, 0, 23, 59, 59, 999);
    } else if (reportPeriod === 'yearly') {
      startDate = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
      endDate = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
    } else {
      startDate = customStartDate
        ? new Date(new Date(customStartDate).setHours(0, 0, 0, 0))
        : new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      endDate = customEndDate
        ? new Date(new Date(customEndDate).setHours(23, 59, 59, 999))
        : now;
    }
    return { startDate, endDate };
  };

  const normalizedPatients = useMemo(() => toAnalyticsPatients(patients), [patients]);

  const isKnownNicuAdmissionRecord = (record: { unit?: Unit; admissionType?: any; nicuAdmissionType?: any }) => {
    if (record.unit !== Unit.NICU && record.unit !== Unit.SNCU) return true;
    return getCanonicalAdmissionType(record as any) !== 'Unknown';
  };

  // Filter patients
  const filteredPatients = useMemo(() => {
    const { startDate, endDate } = getDateRange();
    const dateRange = { startDate, endDate };

    return normalizedPatients.filter(p => {
      const inDateRange = isPatientAdmittedWithinRange(p, dateRange);
      const inSelectedUnits = selectedUnits.length === 0 || selectedUnits.includes(p.unit);

      let passesNicuFilter = true;
      if (p.unit === Unit.NICU || p.unit === Unit.SNCU) {
        if (nicuFilter === 'all') {
          // Keep AI report totals consistent with dashboard/registry:
          // NICU/SNCU "All" includes only known Inborn/Outborn records.
          passesNicuFilter = isKnownNicuAdmissionRecord(p);
        } else {
          passesNicuFilter = matchesAdmissionTypeFilter(p, nicuFilter);
        }
      }

      return inDateRange && inSelectedUnits && passesNicuFilter;
    });
  }, [normalizedPatients, reportPeriod, selectedMonth, selectedQuarter, selectedYear, customStartDate, customEndDate, selectedUnits, nicuFilter]);

  // Comprehensive statistics
  const stats = useMemo(() => {
    const outcomeOf = (patient: Patient) => getCanonicalOutcome(patient);
    const admissionTypeOf = (patient: Patient) => getCanonicalAdmissionType(patient);

    const total = filteredPatients.length;
    const discharged = filteredPatients.filter(p => outcomeOf(p) === 'Discharged').length;
    const deceased = filteredPatients.filter(p => outcomeOf(p) === 'Deceased').length;
    const referred = filteredPatients.filter(p => outcomeOf(p) === 'Referred').length;
    const active = filteredPatients.filter(p => outcomeOf(p) === 'In Progress').length;
    // Count ALL patients who were ever stepped down (including those now discharged/other outcome)
    const stepDown = filteredPatients.filter(p => p.stepDownDate || outcomeOf(p) === 'Step Down' || p.isStepDown).length;
    const lama = filteredPatients.filter(p => (p.outcome as string) === 'LAMA').length;

    // Gender statistics
    const males = filteredPatients.filter(p => p.gender === 'Male').length;
    const females = filteredPatients.filter(p => p.gender === 'Female').length;
    const ambiguous = filteredPatients.filter(p => p.gender === 'Ambiguous' || p.gender === 'Other').length;

    // Inborn/Outborn
    const inborn = filteredPatients.filter(p => admissionTypeOf(p) === 'Inborn').length;
    const outborn = filteredPatients.filter(p => admissionTypeOf(p) === 'Outborn').length;

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

    // Length of Stay - check both dischargeDateTime and releaseDate for compatibility
    const losData = filteredPatients
      .filter(p => (p.dischargeDateTime || p.releaseDate) && p.admissionDate)
      .map(p => getDaysBetween(p.admissionDate, (p.dischargeDateTime || p.releaseDate)!));
    const avgLOS = losData.length > 0 ? (losData.reduce((a, b) => a + b, 0) / losData.length).toFixed(1) : '0';
    const maxLOS = losData.length > 0 ? Math.max(...losData) : 0;
    const minLOS = losData.length > 0 ? Math.min(...losData) : 0;

    // Mortality by categories
    const deceasedPatients = filteredPatients.filter(p => outcomeOf(p) === 'Deceased');
    const mortalityByGA: Record<string, { total: number; deceased: number }> = {};
    const mortalityByBW: Record<string, { total: number; deceased: number }> = {};

    filteredPatients.forEach(p => {
      const gaCategory = getGestationalAgeCategory(p.gestationalAgeWeeks);
      const bwCategory = getBirthWeightCategory(p.birthWeight);

      if (!mortalityByGA[gaCategory]) mortalityByGA[gaCategory] = { total: 0, deceased: 0 };
      if (!mortalityByBW[bwCategory]) mortalityByBW[bwCategory] = { total: 0, deceased: 0 };

      mortalityByGA[gaCategory].total++;
      mortalityByBW[bwCategory].total++;

      if (outcomeOf(p) === 'Deceased') {
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
    const maleDeceased = filteredPatients.filter(p => p.gender === 'Male' && outcomeOf(p) === 'Deceased').length;
    const femaleDeceased = filteredPatients.filter(p => p.gender === 'Female' && outcomeOf(p) === 'Deceased').length;
    const maleDischarged = filteredPatients.filter(p => p.gender === 'Male' && outcomeOf(p) === 'Discharged').length;
    const femaleDischarged = filteredPatients.filter(p => p.gender === 'Female' && outcomeOf(p) === 'Discharged').length;

    // Inborn/Outborn mortality
    const inbornDeceased = deceasedPatients.filter(p => admissionTypeOf(p) === 'Inborn').length;
    const outbornDeceased = deceasedPatients.filter(p => admissionTypeOf(p) === 'Outborn').length;
    const inbornMortality = inborn > 0 ? ((inbornDeceased / inborn) * 100).toFixed(2) : '0';
    const outbornMortality = outborn > 0 ? ((outbornDeceased / outborn) * 100).toFixed(2) : '0';

    // Inborn/Outborn discharge statistics
    const inbornPatients = filteredPatients.filter(p => admissionTypeOf(p) === 'Inborn');
    const outbornPatients = filteredPatients.filter(p => admissionTypeOf(p) === 'Outborn');
    const inbornDischarged = inbornPatients.filter(p => outcomeOf(p) === 'Discharged').length;
    const outbornDischarged = outbornPatients.filter(p => outcomeOf(p) === 'Discharged').length;
    const inbornDischargeRate = inborn > 0 ? ((inbornDischarged / inborn) * 100).toFixed(2) : '0';
    const outbornDischargeRate = outborn > 0 ? ((outbornDischarged / outborn) * 100).toFixed(2) : '0';

    // Inborn/Outborn referred
    const inbornReferred = inbornPatients.filter(p => outcomeOf(p) === 'Referred').length;
    const outbornReferred = outbornPatients.filter(p => outcomeOf(p) === 'Referred').length;
    const inbornReferralRate = inborn > 0 ? ((inbornReferred / inborn) * 100).toFixed(2) : '0';
    const outbornReferralRate = outborn > 0 ? ((outbornReferred / outborn) * 100).toFixed(2) : '0';

    // Inborn/Outborn step down
    const inbornStepDown = inbornPatients.filter(p => p.stepDownDate || outcomeOf(p) === 'Step Down' || p.isStepDown).length;
    const outbornStepDown = outbornPatients.filter(p => p.stepDownDate || outcomeOf(p) === 'Step Down' || p.isStepDown).length;

    // Inborn/Outborn active
    const inbornActive = inbornPatients.filter(p => outcomeOf(p) === 'In Progress').length;
    const outbornActive = outbornPatients.filter(p => outcomeOf(p) === 'In Progress').length;

    // LOS by Inborn/Outborn - check both dischargeDateTime and releaseDate
    const inbornLosData = inbornPatients
      .filter(p => (p.dischargeDateTime || p.releaseDate) && p.admissionDate)
      .map(p => getDaysBetween(p.admissionDate, (p.dischargeDateTime || p.releaseDate)!));
    const outbornLosData = outbornPatients
      .filter(p => (p.dischargeDateTime || p.releaseDate) && p.admissionDate)
      .map(p => getDaysBetween(p.admissionDate, (p.dischargeDateTime || p.releaseDate)!));
    const avgLosInborn = inbornLosData.length > 0 ? (inbornLosData.reduce((a, b) => a + b, 0) / inbornLosData.length).toFixed(1) : '0';
    const avgLosOutborn = outbornLosData.length > 0 ? (outbornLosData.reduce((a, b) => a + b, 0) / outbornLosData.length).toFixed(1) : '0';

    // LOS Distribution buckets
    const losDistribution = {
      lessThan24hrs: losData.filter(d => d < 1).length,
      oneToThreeDays: losData.filter(d => d >= 1 && d <= 3).length,
      threeToSevenDays: losData.filter(d => d > 3 && d <= 7).length,
      oneToTwoWeeks: losData.filter(d => d > 7 && d <= 14).length,
      moreThanTwoWeeks: losData.filter(d => d > 14).length,
    };

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

    // Early vs Late Mortality (time from admission to death)
    const earlyMortality = {
      within6Hours: timeToDeathData.filter(h => h <= 6).length,
      sixTo24Hours: timeToDeathData.filter(h => h > 6 && h <= 24).length,
      oneToSevenDays: timeToDeathData.filter(h => h > 24 && h <= 168).length,
      afterSevenDays: timeToDeathData.filter(h => h > 168).length,
    };

    // Step down statistics - include ALL patients who were ever stepped down (historical + current)
    const stepDownPatients = filteredPatients.filter(p => p.stepDownDate || p.isStepDown || outcomeOf(p) === 'Step Down');
    const stepDownLocations: Record<string, number> = {};
    stepDownPatients.forEach(p => {
      const location = p.stepDownLocation || 'Not Specified';
      stepDownLocations[location] = (stepDownLocations[location] || 0) + 1;
    });

    // Referred patients analysis
    const referredPatients = filteredPatients.filter(p => outcomeOf(p) === 'Referred');
    const referralDestinations: Record<string, number> = {};
    referredPatients.forEach(p => {
      const dest = p.referredTo || 'Not Specified';
      referralDestinations[dest] = (referralDestinations[dest] || 0) + 1;
    });

    // Daily admission trend (for the period)
    const dailyAdmissions: Record<string, number> = {};
    filteredPatients.forEach(p => {
      const admissionDate = getPatientAdmissionDate(p);
      if (!admissionDate) return;
      const date = admissionDate.toISOString().split('T')[0];
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
      dailyAdmissions, deceasedPatients,
      // New: Inborn/Outborn specific statistics
      inbornPatients, outbornPatients,
      inbornDischarged, outbornDischarged,
      inbornDischargeRate, outbornDischargeRate,
      inbornReferred, outbornReferred,
      inbornReferralRate, outbornReferralRate,
      inbornStepDown, outbornStepDown,
      inbornActive, outbornActive,
      avgLosInborn, avgLosOutborn,
      losDistribution, earlyMortality
    };
  }, [filteredPatients]);

  // Generate report
  const generateReport = async () => {
    setGenerating(true);
    try {
      const [loadedPatients, loadedObsPatients] = await Promise.all([
        loadPatients(),
        loadObservationPatients()
      ]);
      setPatients(loadedPatients);
      setObservationPatients(loadedObsPatients);
      setStep('preview');
    } finally {
      setGenerating(false);
    }
  };

  // Download as PDF
  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setGenerating(true);
    const saveStructuredFallbackPdf = () => {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const headerBand = 14;
      const footerBand = 10;
      const contentTop = margin + headerBand;
      const contentBottom = pageHeight - margin - footerBand;
      const contentWidth = pageWidth - margin * 2;
      const reportTitle = REPORT_TYPES.find(r => r.id === selectedReportType)?.title || 'Clinical Report';
      const { startDate, endDate } = getDateRange();
      const generatedAt = new Date();
      const s: any = stats;
      let y = contentTop + 2;

      const ensureSpace = (requiredHeight: number) => {
        if (y + requiredHeight <= contentBottom) return;
        pdf.addPage();
        y = contentTop + 2;
      };

      const addSectionTitle = (title: string) => {
        ensureSpace(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.setTextColor(30, 64, 175);
        pdf.text(title, margin, y);
        y += 2;
        pdf.setDrawColor(191, 219, 254);
        pdf.setLineWidth(0.3);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 5;
      };

      const addParagraph = (text: string, fontSize = 9) => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(fontSize);
        pdf.setTextColor(51, 65, 85);
        const lines = pdf.splitTextToSize(text, contentWidth);
        lines.forEach((line: string) => {
          ensureSpace(4.4);
          pdf.text(line, margin, y);
          y += 4.4;
        });
      };

      const addKeyValue = (label: string, value: string | number) => {
        ensureSpace(4.8);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(15, 23, 42);
        pdf.text(`${label}:`, margin, y);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(71, 85, 105);
        pdf.text(String(value), margin + 42, y);
        y += 4.8;
      };

      const addMetricCards = (items: Array<{ label: string; value: string | number }>) => {
        const cardGap = 4;
        const cardHeight = 16;
        const cardWidth = (contentWidth - cardGap) / 2;

        for (let i = 0; i < items.length; i += 2) {
          ensureSpace(cardHeight + 2);
          const rowItems = items.slice(i, i + 2);
          rowItems.forEach((item, colIndex) => {
            const x = margin + colIndex * (cardWidth + cardGap);
            pdf.setFillColor(248, 250, 252);
            pdf.setDrawColor(203, 213, 225);
            pdf.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(12);
            pdf.setTextColor(15, 23, 42);
            pdf.text(String(item.value), x + 3, y + 7);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(100, 116, 139);
            const labelLines = pdf.splitTextToSize(item.label, cardWidth - 6);
            const label = Array.isArray(labelLines) ? labelLines[0] : String(labelLines);
            pdf.text(label, x + 3, y + 12.5);
          });
          y += cardHeight + 2;
        }
      };

      const addTable = (
        title: string,
        headers: string[],
        rows: Array<Array<string | number>>,
        colRatios: number[],
        maxCellLines = 4
      ) => {
        if (rows.length === 0) return;
        addSectionTitle(title);

        const ratioSum = colRatios.reduce((sum, value) => sum + value, 0);
        const colWidths = colRatios.map(r => (contentWidth * r) / ratioSum);

        const drawRow = (cells: Array<string | number>, isHeader: boolean) => {
          const linesPerCell = cells.map((cell, index) => {
            const raw = String(cell ?? '');
            const width = Math.max(12, colWidths[index] - 2);
            const lines = pdf.splitTextToSize(raw, width) as string[];
            if (lines.length > maxCellLines) {
              const clipped = lines.slice(0, maxCellLines);
              const tail = clipped[maxCellLines - 1];
              clipped[maxCellLines - 1] = `${tail.slice(0, Math.max(0, tail.length - 1))}…`;
              return clipped;
            }
            return lines;
          });

          const maxLines = Math.max(...linesPerCell.map(lines => lines.length), 1);
          const rowHeight = Math.max(6, maxLines * 3.6 + 1.5);
          ensureSpace(rowHeight);

          let x = margin;
          cells.forEach((_, index) => {
            const width = colWidths[index];
            pdf.setDrawColor(203, 213, 225);
            if (isHeader) {
              pdf.setFillColor(241, 245, 249);
              pdf.rect(x, y, width, rowHeight, 'FD');
            } else {
              pdf.rect(x, y, width, rowHeight);
            }

            const lines = linesPerCell[index];
            pdf.setFont('helvetica', isHeader ? 'bold' : 'normal');
            pdf.setFontSize(isHeader ? 8.5 : 8);
            pdf.setTextColor(isHeader ? 15 : 51, isHeader ? 23 : 65, isHeader ? 42 : 85);

            lines.forEach((line, lineIndex) => {
              const textY = y + 3.8 + lineIndex * 3.6;
              if (textY <= y + rowHeight - 1) {
                pdf.text(line, x + 1, textY);
              }
            });

            x += width;
          });

          y += rowHeight;
        };

        drawRow(headers, true);
        rows.forEach((row) => drawRow(row, false));
        y += 3;
      };

      const formatDate = (value: any): string => {
        const parsed = parseSafeDate(value);
        if (!parsed) return '-';
        return parsed.toLocaleDateString('en-IN');
      };

      const formatPercent = (value: unknown, digits = 1): string => `${Number(value ?? 0).toFixed(digits)}%`;

      const outcomeOf = (patient: Patient) => getCanonicalOutcome(patient);

      const addDistributionTable = (
        title: string,
        source: Record<string, number>,
        firstHeader: string,
        limit = 10
      ) => {
        const rows = Object.entries(source || {})
          .sort(([, a], [, b]) => b - a)
          .slice(0, limit)
          .map(([label, count]) => [label || 'Unspecified', count]);

        if (rows.length > 0) {
          addTable(title, [firstHeader, 'Count'], rows, [4, 1]);
        }
      };

      const addPatientLineList = (title: string, patientList: Patient[], limit = 120) => {
        if (!showPatientDetails || patientList.length === 0) return;

        const patientRows = [...patientList]
          .sort((a, b) => {
            const aTime = parseSafeDate(a.admissionDateTime || a.admissionDate)?.getTime() || 0;
            const bTime = parseSafeDate(b.admissionDateTime || b.admissionDate)?.getTime() || 0;
            return bTime - aTime;
          })
          .slice(0, limit)
          .map((patient) => [
            patient.ntid || '-',
            patient.name || '-',
            patient.unit || '-',
            getCanonicalAdmissionType(patient),
            formatDate(patient.admissionDateTime || patient.admissionDate),
            outcomeOf(patient),
            patient.gender || '-'
          ]);

        addTable(
          `${title} (Latest ${Math.min(limit, patientList.length)})`,
          ['NTID', 'Name', 'Unit', 'Admission Type', 'Admission Date', 'Outcome', 'Gender'],
          patientRows,
          [1.1, 2.3, 0.9, 1.2, 1.2, 1.3, 0.8]
        );
      };

      const addComprehensiveSummary = () => {
        addSectionTitle('Executive Summary');
        addMetricCards([
          { label: 'Total Admissions', value: Number(s.total ?? filteredPatients.length) },
          { label: 'Active Patients', value: Number(s.active ?? 0) },
          { label: 'Discharged', value: Number(s.discharged ?? 0) },
          { label: 'Referred', value: Number(s.referred ?? 0) },
          { label: 'Deceased', value: Number(s.deceased ?? 0) },
          { label: 'Step Down', value: Number(s.stepDown ?? 0) },
        ]);

        addKeyValue('Mortality Rate', formatPercent(s.mortalityRate));
        addKeyValue('Discharge Rate', formatPercent(s.dischargeRate));
        addKeyValue('Survival Rate', formatPercent(s.survivalRate));
        y += 2;

        addTable(
          'Outcome Breakdown',
          ['Outcome', 'Count', 'Rate'],
          [
            ['Active (In Progress)', Number(s.active ?? 0), `${Number(s.total ?? 0) > 0 ? ((Number(s.active ?? 0) / Number(s.total ?? 1)) * 100).toFixed(1) : '0.0'}%`],
            ['Discharged', Number(s.discharged ?? 0), formatPercent(s.dischargeRate)],
            ['Referred', Number(s.referred ?? 0), formatPercent(s.referralRate)],
            ['Step Down', Number(s.stepDown ?? 0), formatPercent(s.stepDownRate)],
            ['Deceased', Number(s.deceased ?? 0), formatPercent(s.mortalityRate)],
          ],
          [2.5, 1, 1]
        );

        addTable(
          'Gender Distribution',
          ['Gender', 'Count'],
          [
            ['Male', Number(s.males ?? 0)],
            ['Female', Number(s.females ?? 0)],
            ['Ambiguous/Other', Number(s.ambiguous ?? 0)],
          ],
          [2.5, 1]
        );

        addDistributionTable('Top Diagnoses', (s.diagnosisDistribution || {}) as Record<string, number>, 'Diagnosis');
        addPatientLineList('Patient Line List', filteredPatients);
      };

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(15, 23, 42);
      pdf.text(reportTitle, margin, y);
      y += 7;

      addParagraph(`${PDF_UNIT_LABEL}, ${PDF_INSTITUTION_LABEL}`);
      addParagraph(`Admission Type Scope: ${admissionTypeScopeLabel}`);
      addParagraph(`${startDate.toLocaleDateString('en-IN')} - ${endDate.toLocaleDateString('en-IN')}`);
      addParagraph(`Generated on ${generatedAt.toLocaleDateString('en-IN')} at ${generatedAt.toLocaleTimeString('en-IN')}`);
      y += 2;

      switch (selectedReportType) {
        case 'admissions': {
          addSectionTitle('Admission Summary');
          addMetricCards([
            { label: 'Total Admissions', value: Number(s.total ?? 0) },
            { label: 'Inborn', value: Number(s.inborn ?? 0) },
            { label: 'Outborn', value: Number(s.outborn ?? 0) },
            { label: 'Currently Active', value: Number(s.active ?? 0) },
          ]);
          addDistributionTable('Unit-wise Distribution', (s.unitDistribution || {}) as Record<string, number>, 'Unit');
          addTable(
            'Gender Distribution',
            ['Gender', 'Count'],
            [
              ['Male', Number(s.males ?? 0)],
              ['Female', Number(s.females ?? 0)],
              ['Ambiguous/Other', Number(s.ambiguous ?? 0)],
            ],
            [2.5, 1]
          );
          addDistributionTable('Birth Weight Distribution', (s.bwDistribution || {}) as Record<string, number>, 'Category');
          addDistributionTable('Gestational Age Distribution', (s.gaDistribution || {}) as Record<string, number>, 'Category');
          addDistributionTable('Top Admission Diagnoses', (s.diagnosisDistribution || {}) as Record<string, number>, 'Diagnosis', 15);
          addPatientLineList('Admitted Patients', filteredPatients);
          break;
        }

        case 'deaths': {
          addSectionTitle('Death Summary');
          addMetricCards([
            { label: 'Total Deaths', value: Number(s.deceased ?? 0) },
            { label: 'Mortality Rate', value: formatPercent(s.mortalityRate) },
            { label: 'Avg Time to Death', value: `${Number(s.avgTimeToDeathHours ?? 0)}h` },
            { label: 'Survival Rate', value: formatPercent(s.survivalRate) },
          ]);
          addTable(
            'Age at Death Distribution',
            ['Age Band', 'Count'],
            Object.entries((s.ageAtDeathDist || {}) as Record<string, number>).map(([label, count]) => [label, count]),
            [3.5, 1]
          );

          const deathDiagnoses: Record<string, number> = {};
          ((s.deceasedPatients || []) as Patient[]).forEach((patient: Patient) => {
            const diagnosis = patient.diagnosis?.split(',')[0].trim() || 'Not Specified';
            deathDiagnoses[diagnosis] = (deathDiagnoses[diagnosis] || 0) + 1;
          });
          addDistributionTable('Primary Diagnoses of Deceased Patients', deathDiagnoses, 'Diagnosis');
          addPatientLineList('Deceased Patients', (s.deceasedPatients || []) as Patient[]);
          break;
        }

        case 'referred': {
          addSectionTitle('Referral Summary');
          addMetricCards([
            { label: 'Total Referrals Out', value: Number(s.referred ?? 0) },
            { label: 'Referral Rate', value: formatPercent(s.referralRate) },
            { label: 'Total Admissions', value: Number(s.total ?? 0) },
          ]);
          addDistributionTable('Referral Destinations', (s.referralDestinations || {}) as Record<string, number>, 'Destination', 20);
          addPatientLineList('Referred Patients', (s.referredPatients || []) as Patient[]);
          break;
        }

        case 'stepdown': {
          const stepDownPatients = ((s.stepDownPatients || []) as Patient[]);
          const currentStepDownPatients = stepDownPatients.filter((patient) => outcomeOf(patient) === 'Step Down');
          const dischargedFromStepDown = stepDownPatients.filter((patient) => patient.stepDownDate && outcomeOf(patient) === 'Discharged').length;
          const readmittedFromStepDown = stepDownPatients.filter((patient) => patient.readmissionFromStepDown).length;
          const deceasedAfterStepDown = stepDownPatients.filter((patient) => patient.stepDownDate && outcomeOf(patient) === 'Deceased').length;
          const otherOutcomeAfterStepDown = Math.max(0, Number(s.stepDown ?? 0) - currentStepDownPatients.length - dischargedFromStepDown - deceasedAfterStepDown);

          addSectionTitle('Step Down Summary');
          addMetricCards([
            { label: 'Total Step Downs', value: Number(s.stepDown ?? 0) },
            { label: 'Step Down Rate', value: formatPercent(s.stepDownRate) },
            { label: 'Total Admissions', value: Number(s.total ?? 0) },
          ]);
          addTable(
            'Current Status of Step Down Patients',
            ['Status', 'Count'],
            [
              ['Currently in Step Down', currentStepDownPatients.length],
              ['Discharged', dischargedFromStepDown],
              ['Readmitted to ICU', readmittedFromStepDown],
              ['Deceased', deceasedAfterStepDown],
              ['Other Outcome', otherOutcomeAfterStepDown],
            ],
            [3, 1]
          );
          addDistributionTable('Step Down Locations', (s.stepDownLocations || {}) as Record<string, number>, 'Location', 20);
          addPatientLineList('Current Step Down Patients', currentStepDownPatients);
          break;
        }

        case 'mortality': {
          addSectionTitle('Key Mortality Indicators');
          addMetricCards([
            { label: 'Overall Mortality Rate', value: formatPercent(s.mortalityRate) },
            { label: 'Inborn Mortality', value: formatPercent(s.inbornMortality) },
            { label: 'Outborn Mortality', value: formatPercent(s.outbornMortality) },
            { label: 'Survival Rate', value: formatPercent(s.survivalRate) },
          ]);
          addKeyValue('Average Time to Death', `${Number(s.avgTimeToDeathHours ?? 0)} hours`);
          addTable(
            'Mortality by Birth Weight Category',
            ['Category', 'Total', 'Deaths', 'Mortality Rate'],
            ['ELBW (<1000g)', 'VLBW (1000-1499g)', 'LBW (1500-2499g)', 'Normal (≥2500g)', 'Unknown'].map((category) => {
              const data = ((s.mortalityByBW || {}) as Record<string, { total: number; deceased: number }>)[category] || { total: 0, deceased: 0 };
              const rate = data.total > 0 ? ((data.deceased / data.total) * 100).toFixed(1) : '0.0';
              return [category, data.total, data.deceased, `${rate}%`];
            }),
            [2.5, 1, 1, 1.2]
          );
          addTable(
            'Mortality by Gestational Age',
            ['Category', 'Total', 'Deaths', 'Mortality Rate'],
            ['Extremely Preterm (<28 weeks)', 'Very Preterm (28-31 weeks)', 'Moderate/Late Preterm (32-36 weeks)', 'Term (≥37 weeks)', 'Unknown'].map((category) => {
              const data = ((s.mortalityByGA || {}) as Record<string, { total: number; deceased: number }>)[category] || { total: 0, deceased: 0 };
              const rate = data.total > 0 ? ((data.deceased / data.total) * 100).toFixed(1) : '0.0';
              return [category, data.total, data.deceased, `${rate}%`];
            }),
            [2.8, 1, 1, 1.2]
          );
          addTable(
            'Gender-wise Mortality',
            ['Gender', 'Deaths', 'Total', 'Mortality Rate'],
            [
              ['Male', Number(s.maleDeceased ?? 0), Number(s.males ?? 0), `${Number(s.males ?? 0) > 0 ? ((Number(s.maleDeceased ?? 0) / Number(s.males ?? 1)) * 100).toFixed(1) : '0.0'}%`],
              ['Female', Number(s.femaleDeceased ?? 0), Number(s.females ?? 0), `${Number(s.females ?? 0) > 0 ? ((Number(s.femaleDeceased ?? 0) / Number(s.females ?? 1)) * 100).toFixed(1) : '0.0'}%`],
            ],
            [2, 1, 1, 1.2]
          );
          addTable(
            'Mortality Timing Analysis',
            ['Interval from Admission', 'Deaths'],
            [
              ['Within 6 Hours', Number(s.earlyMortality?.within6Hours ?? 0)],
              ['6-24 Hours', Number(s.earlyMortality?.sixTo24Hours ?? 0)],
              ['1-7 Days', Number(s.earlyMortality?.oneToSevenDays ?? 0)],
              ['After 7 Days', Number(s.earlyMortality?.afterSevenDays ?? 0)],
            ],
            [3, 1]
          );
          break;
        }

        case 'gender': {
          addSectionTitle('Gender Distribution Summary');
          addMetricCards([
            { label: 'Male Patients', value: Number(s.males ?? 0) },
            { label: 'Female Patients', value: Number(s.females ?? 0) },
            { label: 'Ambiguous/Other', value: Number(s.ambiguous ?? 0) },
          ]);
          addKeyValue('Male Percentage', `${Number(s.total ?? 0) > 0 ? ((Number(s.males ?? 0) / Number(s.total ?? 1)) * 100).toFixed(1) : '0.0'}%`);
          addKeyValue('Female Percentage', `${Number(s.total ?? 0) > 0 ? ((Number(s.females ?? 0) / Number(s.total ?? 1)) * 100).toFixed(1) : '0.0'}%`);
          addTable(
            'Outcomes by Gender',
            ['Outcome', 'Male', 'Female', 'Total'],
            [
              ['Discharged', Number(s.maleDischarged ?? 0), Number(s.femaleDischarged ?? 0), Number(s.maleDischarged ?? 0) + Number(s.femaleDischarged ?? 0)],
              ['Deceased', Number(s.maleDeceased ?? 0), Number(s.femaleDeceased ?? 0), Number(s.maleDeceased ?? 0) + Number(s.femaleDeceased ?? 0)],
              [
                'Referred',
                filteredPatients.filter(patient => patient.gender === 'Male' && outcomeOf(patient) === 'Referred').length,
                filteredPatients.filter(patient => patient.gender === 'Female' && outcomeOf(patient) === 'Referred').length,
                filteredPatients.filter(patient => outcomeOf(patient) === 'Referred').length
              ],
              [
                'Active/In Progress',
                filteredPatients.filter(patient => patient.gender === 'Male' && outcomeOf(patient) === 'In Progress').length,
                filteredPatients.filter(patient => patient.gender === 'Female' && outcomeOf(patient) === 'In Progress').length,
                filteredPatients.filter(patient => outcomeOf(patient) === 'In Progress').length
              ],
            ],
            [2.5, 1, 1, 1]
          );
          addTable(
            'Gender-wise Mortality Rates',
            ['Gender', 'Deaths', 'Total', 'Mortality Rate'],
            [
              ['Male', Number(s.maleDeceased ?? 0), Number(s.males ?? 0), `${Number(s.males ?? 0) > 0 ? ((Number(s.maleDeceased ?? 0) / Number(s.males ?? 1)) * 100).toFixed(1) : '0.0'}%`],
              ['Female', Number(s.femaleDeceased ?? 0), Number(s.females ?? 0), `${Number(s.females ?? 0) > 0 ? ((Number(s.femaleDeceased ?? 0) / Number(s.females ?? 1)) * 100).toFixed(1) : '0.0'}%`],
            ],
            [2, 1, 1, 1.2]
          );
          addPatientLineList('Patient Registry', filteredPatients);
          break;
        }

        case 'discharge': {
          const dischargedPatients = filteredPatients.filter((patient) => outcomeOf(patient) === 'Discharged');
          addSectionTitle('Discharge Summary');
          addMetricCards([
            { label: 'Total Discharged', value: Number(s.discharged ?? 0) },
            { label: 'Discharge Rate', value: formatPercent(s.dischargeRate) },
            { label: 'Average LOS', value: `${s.avgLOS || '0'} days` },
            { label: 'LAMA Cases', value: Number(s.lama ?? 0) },
          ]);
          addTable(
            'Length of Stay Distribution',
            ['LOS Bucket', 'Count'],
            [
              ['< 24 hours', Number(s.losDistribution?.lessThan24hrs ?? 0)],
              ['1-3 days', Number(s.losDistribution?.oneToThreeDays ?? 0)],
              ['3-7 days', Number(s.losDistribution?.threeToSevenDays ?? 0)],
              ['1-2 weeks', Number(s.losDistribution?.oneToTwoWeeks ?? 0)],
              ['> 2 weeks', Number(s.losDistribution?.moreThanTwoWeeks ?? 0)],
            ],
            [3, 1]
          );
          addTable(
            'Inborn vs Outborn Discharge Analysis',
            ['Group', 'Total', 'Discharged', 'Discharge Rate', 'Avg LOS'],
            [
              ['Inborn', Number(s.inborn ?? 0), Number(s.inbornDischarged ?? 0), formatPercent(s.inbornDischargeRate), `${s.avgLosInborn || '0'} days`],
              ['Outborn', Number(s.outborn ?? 0), Number(s.outbornDischarged ?? 0), formatPercent(s.outbornDischargeRate), `${s.avgLosOutborn || '0'} days`],
            ],
            [2, 1, 1, 1.2, 1.2]
          );
          addPatientLineList('Discharged Patients', dischargedPatients);
          break;
        }

        case 'dailyUpdate': {
          addSectionTitle('Daily Update Summary');
          addParagraph('This PDF was generated from the daily update flow. Use the on-screen copy action for the WhatsApp-ready text version.');
          addMetricCards([
            { label: 'Total Admissions', value: Number(s.total ?? 0) },
            { label: 'Active Patients', value: Number(s.active ?? 0) },
            { label: 'Discharged', value: Number(s.discharged ?? 0) },
            { label: 'Deceased', value: Number(s.deceased ?? 0) },
          ]);
          break;
        }

        default:
          addComprehensiveSummary();
          break;
      }

      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setDrawColor(203, 213, 225);
        pdf.setLineWidth(0.2);
        pdf.line(margin, margin + 7, pageWidth - margin, margin + 7);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.setTextColor(30, 41, 59);
        pdf.text(reportTitle, margin, margin + 4.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(71, 85, 105);
        pdf.text(`${PDF_UNIT_LABEL} | ${PDF_INSTITUTION_LABEL}`, pageWidth - margin, margin + 4.5, { align: 'right' });

        pdf.setDrawColor(226, 232, 240);
        pdf.line(margin, pageHeight - margin - 5, pageWidth - margin, pageHeight - margin - 5);
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Generated ${generatedAt.toLocaleDateString('en-IN')} ${generatedAt.toLocaleTimeString('en-IN')}`, margin, pageHeight - margin - 1.8);
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - margin - 1.8, { align: 'right' });
      }

      const reportTypeName = REPORT_TYPES.find(r => r.id === selectedReportType)?.title || 'Report';
      const fileName = `${reportTypeName.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}_${PDF_INSTITUTION_LABEL.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}_${startDate.toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    };
    try {
      saveStructuredFallbackPdf();
    } catch (error) {
      console.error('Structured PDF generation failed:', error);
      alert('PDF generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const escapeCSV = (value: unknown) => {
      const stringValue = value === null || value === undefined ? '' : String(value);
      if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    let csvContent = '';
    const { startDate, endDate } = getDateRange();

    // Header
    csvContent += `Report Type,${escapeCSV(REPORT_TYPES.find(r => r.id === selectedReportType)?.title || '')}\n`;
    csvContent += `Institution,${escapeCSV(institutionName || '')}\n`;
    csvContent += `Period,${escapeCSV(`${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`)}\n`;
    csvContent += `Generated,${escapeCSV(new Date().toLocaleString())}\n\n`;

    // Patient-level data should only be exported when explicitly enabled
    if (showPatientDetails) {
      csvContent += 'NTID,Name,Gender,DOB,Admission Date,Unit,Diagnosis,Outcome,GA Weeks,Birth Weight\n';
      filteredPatients.forEach(p => {
        csvContent += [
          p.ntid || '',
          p.name || '',
          p.gender || '',
          p.dateOfBirth || '',
          p.admissionDate || '',
          p.unit || '',
          p.diagnosis || '',
          p.outcome || 'Active',
          p.gestationalAgeWeeks || '',
          p.birthWeight || '',
        ].map(escapeCSV).join(',') + '\n';
      });
    } else {
      csvContent += 'Metric,Value\n';
      const summaryRows: Array<[string, string | number]> = [
        ['Total Admissions', stats.total],
        ['Currently Active', stats.active],
        ['Discharged', stats.discharged],
        ['Deceased', stats.deceased],
        ['Referred', stats.referred],
        ['Step Down', stats.stepDown],
        ['Mortality Rate (%)', stats.mortalityRate],
        ['Survival Rate (%)', stats.survivalRate],
        ['Referral Rate (%)', stats.referralRate],
      ];
      summaryRows.forEach(([label, value]) => {
        csvContent += `${escapeCSV(label)},${escapeCSV(value)}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${showPatientDetails ? 'Patient_Details' : 'Report_Summary'}_${new Date().toISOString().split('T')[0]}.csv`;
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
  const admissionTypeScopeLabel = nicuFilter === 'inborn'
    ? 'Inborn'
    : nicuFilter === 'outborn'
      ? 'Outborn'
      : 'Inborn + Outborn';

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
            onClick={async () => {
              setSelectedReportType(report.id);
              if (report.id === 'dailyUpdate') {
                // For daily update, show the multi-step selection flow
                setDailyUpdateStep('type');
                setDailyUpdateType('all');
                setDailyUpdateShift('current');
                setSelectedUnits(enabledFacilities);
                setStep('preview'); // Go to preview which will show the multi-step UI
              } else {
                setStep('configure');
              }
            }}
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
              className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all ${reportPeriod === type ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
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
              className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all ${selectedUnits.includes(unit) ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
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
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${nicuFilter === value ? 'bg-pink-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}>
                  {value === 'all' ? 'All Patients' : value === 'inborn' ? 'Inborn Only' : 'Outborn Only'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Report Options */}
      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
          <IconClipboardList size={20} className="text-cyan-400" />
          Report Options
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconUsers size={18} className="text-slate-400" />
            <div>
              <p className="text-white font-medium">Show Patient Details</p>
              <p className="text-slate-400 text-sm">Enable patient-level tables and detailed CSV export</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowPatientDetails(prev => !prev)}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              showPatientDetails ? 'bg-green-500' : 'bg-slate-600'
            }`}
            aria-pressed={showPatientDetails}
            role="switch"
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                showPatientDetails ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
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
      case 'dailyUpdate':
        return renderDailyUpdateReport();
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

  // Daily Update Report - State-of-the-art Mobile-First UI
  const renderDailyUpdateReport = () => {
    const now = new Date();
    const formattedDateTime = now.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Calculate shift range based on selection
    const getShiftRange = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const selectedShiftOption = SHIFT_OPTIONS.find(s => s.id === dailyUpdateShift);

      if (dailyUpdateShift === 'current') {
        // Determine current shift based on time - create fresh date objects
        if (currentHour >= 8 && currentHour < 14) {
          // Morning Shift: 8 AM - 2 PM today
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0);
          const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0, 0);
          return { start, end, label: 'Morning Shift (8 AM - 2 PM)' };
        } else if (currentHour >= 14 && currentHour < 20) {
          // Afternoon Shift: 2 PM - 8 PM today
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0, 0);
          const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0, 0);
          return { start, end, label: 'Afternoon Shift (2 PM - 8 PM)' };
        } else {
          // Night Shift: 8 PM - 8 AM (spans two days)
          let start: Date, end: Date;
          if (currentHour >= 20) {
            // After 8 PM today - shift started today at 8 PM, ends tomorrow 8 AM
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 0, 0, 0);
          } else {
            // Before 8 AM today - shift started yesterday at 8 PM, ends today 8 AM
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 20, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0);
          }
          return { start, end, label: 'Night Shift (8 PM - 8 AM)' };
        }
      } else if (dailyUpdateShift === 'full24') {
        const end = new Date();
        const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        return { start, end, label: 'Last 24 Hours' };
      } else if (selectedShiftOption) {
        // Specific shift selection - use today's date with shift hours
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), selectedShiftOption.startHour, 0, 0, 0);
        let end: Date;
        if (selectedShiftOption.endHour < selectedShiftOption.startHour) {
          // Night shift spans to next day
          end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, selectedShiftOption.endHour, 0, 0, 0);
        } else {
          end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), selectedShiftOption.endHour, 0, 0, 0);
        }
        return { start, end, label: selectedShiftOption.label };
      }
      return { start: new Date(), end: new Date(), label: 'Current' };
    };

    const { start: shiftStart, end: shiftEnd, label: shiftLabel } = getShiftRange();

    // Helper to check if datetime is within shift range (for fields with time)
    const isWithinShift = (dateStr: string | undefined) => {
      if (!dateStr) return false;
      const date = parseSafeDate(dateStr);
      if (!date) return false;
      return date >= shiftStart && date <= shiftEnd;
    };

    // Helper to check if a datestring has time component (contains 'T' in ISO format)
    const hasTimeComponent = (dateStr: string | undefined) => {
      if (!dateStr) return false;
      return dateStr.includes('T');
    };

    // Smart check: uses precise time if available, otherwise falls back to day check
    // This handles both datetime fields (with time) and date-only fields
    const isEventInShift = (dateStr: string | undefined) => {
      if (!dateStr) return false;
      const date = parseSafeDate(dateStr);
      if (!date) return false;

      if (hasTimeComponent(dateStr)) {
        // Has time - do precise check
        return date >= shiftStart && date <= shiftEnd;
      } else {
        // Date only - check if on same calendar day as shift
        const shiftStartDay = new Date(shiftStart.getFullYear(), shiftStart.getMonth(), shiftStart.getDate());
        const shiftEndDay = new Date(shiftEnd.getFullYear(), shiftEnd.getMonth(), shiftEnd.getDate());
        const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        return dateDay >= shiftStartDay && dateDay <= shiftEndDay;
      }
    };

    // Filter patients by type selection
    const getFilteredPatients = () => {
      const allPatients = toAnalyticsPatients(patients)
        .filter(p => selectedUnits.includes(p.unit))
        .filter(p => isKnownNicuAdmissionRecord(p));

      if (dailyUpdateType === 'inborn') {
        return allPatients.filter(p => {
          if (p.unit !== Unit.NICU && p.unit !== Unit.SNCU) return true;
          return matchesAdmissionTypeFilter(p, 'inborn');
        });
      }

      if (dailyUpdateType === 'outborn') {
        return allPatients.filter(p => {
          if (p.unit !== Unit.NICU && p.unit !== Unit.SNCU) return true;
          return matchesAdmissionTypeFilter(p, 'outborn');
        });
      }

      return allPatients;
    };

    const getFilteredObsPatients = () => {
      const allObs = observationPatients
        .filter(p => selectedUnits.includes(p.unit))
        .filter(p => isKnownNicuAdmissionRecord(p as any));

      if (dailyUpdateType === 'inborn') {
        return allObs.filter(p => {
          if (p.unit !== Unit.NICU && p.unit !== Unit.SNCU) return true;
          return matchesAdmissionTypeFilter(p as any, 'inborn');
        });
      }

      if (dailyUpdateType === 'outborn') {
        return allObs.filter(p => {
          if (p.unit !== Unit.NICU && p.unit !== Unit.SNCU) return true;
          return matchesAdmissionTypeFilter(p as any, 'outborn');
        });
      }

      return allObs;
    };

    // Filter observation patients by selected units
    const filteredObsPatients = getFilteredObsPatients();
    const allFilteredPatients = getFilteredPatients();
    const outcomeOf = (patient: Patient) => getCanonicalOutcome(patient);

    // Calculate comprehensive stats
    // Admitted patients (In Progress) - NOT including step down
    const admittedPatients = allFilteredPatients.filter(p => outcomeOf(p) === 'In Progress').length;
    // Observation patients (active)
    const observationPatients_count = filteredObsPatients.filter(p => p.outcome === ObservationOutcome.InObservation).length;
    // Currently in Step Down (with mother)
    const currentlyInStepDown = allFilteredPatients.filter(p => outcomeOf(p) === 'Step Down').length;

    const stats = {
      admitted: admittedPatients,
      inObservation: observationPatients_count,
      currentlyInStepDown: currentlyInStepDown,

      // Period activity
      steppedDownThisShift: allFilteredPatients.filter(p => {
        if (outcomeOf(p) !== 'Step Down') return false;
        return isEventInShift(p.stepDownDate);
      }).length,

      newAdmissions: allFilteredPatients.filter(p => {
        if (p.readmissionFromStepDown) return false;
        return isEventInShift(p.admissionDateTime) || isEventInShift(p.admissionDate);
      }).length,

      discharged: allFilteredPatients.filter(p => {
        if (outcomeOf(p) !== 'Discharged') return false;
        return isEventInShift(p.dischargeDateTime) ||
               isEventInShift(p.finalDischargeDate) ||
               isEventInShift(p.releaseDate);
      }).length,

      referred: allFilteredPatients.filter(p => {
        if (outcomeOf(p) !== 'Referred') return false;
        return isEventInShift(p.dischargeDateTime) || isEventInShift(p.releaseDate);
      }).length,

      deceased: allFilteredPatients.filter(p => {
        if (outcomeOf(p) !== 'Deceased') return false;
        return isEventInShift(p.dateOfDeath) || isEventInShift(p.releaseDate);
      }).length,

      readmitFromStepDown: allFilteredPatients.filter(p => {
        if (!p.readmissionFromStepDown) return false;
        if (p.readmissionDate) return isEventInShift(p.readmissionDate);
        if (p.lastEditedAt) return isEventInShift(p.lastEditedAt);
        return false;
      }).length,
    };

    const typeLabel = dailyUpdateType === 'inborn' ? 'Inborn' : dailyUpdateType === 'outborn' ? 'Outborn' : 'All Patients';
    const totalPatients = stats.admitted + stats.currentlyInStepDown + stats.inObservation;
    const summaryRows = [
      {
        label: 'Total Patients',
        value: totalPatients,
        suffix: stats.inObservation > 0 ? ` (Observation: ${stats.inObservation})` : ''
      },
      { label: 'Total Admissions', value: stats.newAdmissions },
      ...(stats.referred > 0 ? [{ label: 'Referred', value: stats.referred }] : []),
      { label: 'Discharged', value: stats.discharged },
      { label: 'Step Down', value: stats.steppedDownThisShift },
      ...(stats.readmitFromStepDown > 0 ? [{ label: 'Readmit from Step Down', value: stats.readmitFromStepDown }] : []),
      ...(stats.deceased > 0 ? [{ label: 'Deaths', value: stats.deceased }] : []),
      { label: 'Patients in Observation', value: stats.inObservation },
    ];

    // Generate report text
    const generateReportText = () => {
      const unitName = selectedUnits.join('/');
      return `${unitName} Daily Update
Date: ${formattedDateTime}
Period: ${shiftLabel}
Institution: ${institutionName || 'Hospital'}
Patient Type: ${typeLabel}

Summary
${summaryRows.map(row => `${row.label}: ${row.value}${row.suffix || ''}`).join('\n')}`;
    };

    const reportText = generateReportText();

    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(reportText);
        setCopyFeedback('✅ Report copied!');
        setTimeout(() => setCopyFeedback(null), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        const textArea = document.createElement('textarea');
        textArea.value = reportText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopyFeedback('✅ Report copied!');
        setTimeout(() => setCopyFeedback(null), 2000);
      }
    };

    // Load data when reaching report step
    const loadDataAndShowReport = async () => {
      setGenerating(true);
      try {
        const [loadedPatients, loadedObsPatients] = await Promise.all([
          loadPatients(),
          loadObservationPatients()
        ]);
        setPatients(loadedPatients);
        setObservationPatients(loadedObsPatients);
        setDailyUpdateStep('report');
      } finally {
        setGenerating(false);
      }
    };

    // STEP 1: Select Patient Type (Inborn/Outborn/All)
    if (dailyUpdateStep === 'type') {
      return (
        <div className="min-h-[50vh] flex flex-col p-4">
          <div className="w-full max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Daily Update Report</h2>
              <p className="text-slate-400 text-sm">Step 1 of 2 — Select patient category</p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {[
                { id: 'inborn', label: 'Inborn', desc: 'Babies born in this hospital' },
                { id: 'outborn', label: 'Outborn', desc: 'Babies referred from outside' },
                { id: 'all', label: 'All Patients', desc: 'Combined report for all patients' },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    setDailyUpdateType(option.id as 'inborn' | 'outborn' | 'all');
                    setDailyUpdateStep('shift');
                  }}
                  className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                >
                  <div className="text-left">
                    <div className="text-base font-semibold text-white">{option.label}</div>
                    <div className="text-slate-400 text-sm">{option.desc}</div>
                  </div>
                  <IconChevronRight size={20} className="text-slate-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // STEP 2: Select Shift
    if (dailyUpdateStep === 'shift') {
      return (
        <div className="min-h-[50vh] flex flex-col p-4">
          <div className="w-full max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <button
                onClick={() => setDailyUpdateStep('type')}
                className="inline-flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-3 transition-colors"
              >
                <IconArrowLeft size={16} />
                <span>Back</span>
              </button>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Select Time Period</h2>
              <p className="text-slate-400 text-sm">
                Step 2 of 2 — {dailyUpdateType === 'inborn' ? 'Inborn' : dailyUpdateType === 'outborn' ? 'Outborn' : 'All Patients'}
              </p>
            </div>

            {/* Shift Options */}
            <div className="space-y-3">
              {SHIFT_OPTIONS.map((shift) => (
                <button
                  key={shift.id}
                  onClick={() => {
                    setDailyUpdateShift(shift.id as any);
                    loadDataAndShowReport();
                  }}
                  disabled={generating}
                  className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  <div className="text-left">
                    <div className="text-base font-semibold text-white">{shift.label}</div>
                    <div className="text-slate-400 text-sm">{shift.time}</div>
                  </div>
                  {generating && dailyUpdateShift === shift.id ? (
                    <IconLoader2 size={20} className="text-slate-400 animate-spin" />
                  ) : (
                    <IconChevronRight size={20} className="text-slate-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // STEP 3: Show Report
    return (
      <div className="space-y-4 p-4 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setDailyUpdateStep('shift')}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <IconArrowLeft size={20} className="text-slate-400" />
          </button>
          <div className="flex-1">
            <h2 className="text-lg md:text-xl font-bold text-white">Daily Update Report</h2>
            <p className="text-slate-400 text-sm">{typeLabel} • {shiftLabel}</p>
          </div>
        </div>

        {/* Report Meta */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-slate-400">Institution</div>
              <div className="font-medium text-white">{institutionName || 'Hospital'}</div>
            </div>
            <div>
              <div className="text-slate-400">Units</div>
              <div className="font-medium text-white">{selectedUnits.join('/')}</div>
            </div>
            <div>
              <div className="text-slate-400">Patient Type</div>
              <div className="font-medium text-white">{typeLabel}</div>
            </div>
            <div>
              <div className="text-slate-400">Period</div>
              <div className="font-medium text-white">{shiftLabel}</div>
            </div>
            <div>
              <div className="text-slate-400">Generated</div>
              <div className="font-medium text-white">{formattedDateTime}</div>
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">Summary</h3>
          <div className="divide-y divide-slate-700 rounded-lg border border-slate-700 bg-slate-900">
            {summaryRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-slate-300">{row.label}</span>
                <span className="text-right text-lg font-semibold text-white">
                  {row.value}
                  {row.suffix ? <span className="text-sm font-medium text-slate-400">{row.suffix}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Copy Button */}
        <button
          onClick={copyToClipboard}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold text-white transition-colors"
        >
          <IconCopy size={20} />
          <span>Copy Report for WhatsApp</span>
        </button>
        {copyFeedback && (
          <div className="py-2 bg-green-600 rounded-lg text-center text-white text-sm font-medium">
            {copyFeedback}
          </div>
        )}

        {/* Preview */}
        <details className="bg-slate-800 rounded-lg border border-slate-700">
          <summary className="p-3 cursor-pointer text-slate-400 text-sm font-medium hover:text-white transition-colors">
            View Report Preview
          </summary>
          <div className="px-3 pb-3">
            <div className="bg-slate-900 rounded-lg p-3 text-slate-300 font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
              {reportText}
            </div>
          </div>
        </details>
      </div>
    );
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
      {renderPatientRegistry('Admitted Patients', filteredPatients, showPatientDetails)}
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
      {renderPatientRegistry('Deceased Patients', stats.deceasedPatients, showPatientDetails)}
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
      {renderPatientRegistry('Referred Patients', stats.referredPatients, showPatientDetails)}
    </div>
  );

  // Step Down Report
	  const renderStepDownReport = () => {
	    // Calculate step-down status breakdown
	    const currentStepDownPatients = stats.stepDownPatients.filter(p => getCanonicalOutcome(p) === 'Step Down');
	    const currentlyInStepDown = currentStepDownPatients.length;
	    const dischargedFromStepDown = stats.stepDownPatients.filter(p => p.stepDownDate && getCanonicalOutcome(p) === 'Discharged').length;
	    const readmittedFromStepDown = stats.stepDownPatients.filter(p => p.readmissionFromStepDown).length;
	    const deceasedAfterStepDown = stats.stepDownPatients.filter(p => p.stepDownDate && getCanonicalOutcome(p) === 'Deceased').length;
	    const otherOutcomeAfterStepDown = stats.stepDown - currentlyInStepDown - dischargedFromStepDown - deceasedAfterStepDown;

    return (
      <div className="space-y-8">
        {/* Step Down Summary */}
        <section>
          <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-teal-500 flex items-center gap-2">
            <IconArrowDown size={22} className="text-teal-600" /> Step Down Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-teal-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-teal-600">{stats.stepDown}</div>
              <div className="text-xs text-slate-600 mt-1">Total Step Downs (All Time)</div>
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

        {/* Step Down Status Breakdown */}
        <section>
          <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-purple-500 flex items-center gap-2">
            <IconChartBar size={22} className="text-purple-600" /> Current Status of Step Down Patients
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-teal-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-teal-600">{currentlyInStepDown}</div>
              <div className="text-xs text-slate-600 mt-1">Currently in Step Down</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{dischargedFromStepDown}</div>
              <div className="text-xs text-slate-600 mt-1">Discharged</div>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{readmittedFromStepDown}</div>
              <div className="text-xs text-slate-600 mt-1">Readmitted to ICU</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{deceasedAfterStepDown}</div>
              <div className="text-xs text-slate-600 mt-1">Deceased</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-slate-600">{otherOutcomeAfterStepDown > 0 ? otherOutcomeAfterStepDown : 0}</div>
              <div className="text-xs text-slate-600 mt-1">Other Outcome</div>
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
            <p className="text-slate-500 italic">No step down location data available</p>
          )}
        </section>

	        {/* Step Down Patients List - with enhanced info */}
	        {showPatientDetails && (
	          <section>
	            <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-indigo-500 flex items-center gap-2">
	              <IconClipboardList size={22} className="text-indigo-600" /> Step Down Patient Registry ({currentStepDownPatients.length})
	            </h3>
	            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
	              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-3 font-semibold text-slate-700">Patient</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Diagnosis</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Step Down Date</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Location</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Current Status</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Final Discharge</th>
                  </tr>
	                </thead>
	                <tbody className="divide-y divide-slate-100">
	                  {currentStepDownPatients.map((patient, idx) => {
	                    const canonicalOutcome = getCanonicalOutcome(patient);
	                    return (
	                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3">
                        <div className="font-medium text-slate-800">{patient.name}</div>
                      </td>
                      <td className="p-3 text-xs text-slate-600">
                        {patient.diagnosis?.substring(0, 40)}{patient.diagnosis && patient.diagnosis.length > 40 ? '...' : '-'}
                      </td>
                      <td className="p-3 text-slate-600">
                        {patient.stepDownDate ? new Date(patient.stepDownDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="p-3 text-slate-600">
                        {patient.stepDownLocation || 'Not Specified'}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          canonicalOutcome === 'Step Down' ? 'bg-teal-100 text-teal-700' :
                          canonicalOutcome === 'Discharged' ? 'bg-green-100 text-green-700' :
                          canonicalOutcome === 'Deceased' ? 'bg-red-100 text-red-700' :
                          patient.readmissionFromStepDown ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {patient.readmissionFromStepDown ? 'Readmitted' : canonicalOutcome}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">
                        {patient.finalDischargeDate ? new Date(patient.finalDischargeDate).toLocaleDateString() :
                         patient.releaseDate && canonicalOutcome === 'Discharged' ? new Date(patient.releaseDate).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    );
  };

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
                      <span className={`px-2 py-1 rounded text-xs font-medium ${parseFloat(mortRate) > 30 ? 'bg-red-100 text-red-700' :
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
                      <span className={`px-2 py-1 rounded text-xs font-medium ${parseFloat(mortRate) > 40 ? 'bg-red-100 text-red-700' :
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

      {/* Early vs Late Mortality (Time from Admission to Death) */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-orange-500 flex items-center gap-2">
          <IconClock size={22} className="text-orange-600" /> Mortality Timing Analysis
        </h3>
        <p className="text-sm text-slate-600 mb-4">Analysis of time from admission to death - helps identify early preventable deaths</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-red-50 rounded-xl p-4 text-center border-2 border-red-200">
            <div className="text-3xl font-bold text-red-600">{stats.earlyMortality.within6Hours}</div>
            <div className="text-xs text-slate-600 mt-1 font-medium">Within 6 Hours</div>
            <div className="text-xs text-red-500 mt-1">Critical Period</div>
          </div>
          <div className="bg-orange-50 rounded-xl p-4 text-center border-2 border-orange-200">
            <div className="text-3xl font-bold text-orange-600">{stats.earlyMortality.sixTo24Hours}</div>
            <div className="text-xs text-slate-600 mt-1 font-medium">6-24 Hours</div>
            <div className="text-xs text-orange-500 mt-1">Stabilization Period</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 text-center border-2 border-amber-200">
            <div className="text-3xl font-bold text-amber-600">{stats.earlyMortality.oneToSevenDays}</div>
            <div className="text-xs text-slate-600 mt-1 font-medium">1-7 Days</div>
            <div className="text-xs text-amber-500 mt-1">Early Neonatal</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-center border-2 border-slate-200">
            <div className="text-3xl font-bold text-slate-600">{stats.earlyMortality.afterSevenDays}</div>
            <div className="text-xs text-slate-600 mt-1 font-medium">&gt; 7 Days</div>
            <div className="text-xs text-slate-500 mt-1">Late Mortality</div>
          </div>
        </div>
        <div className="mt-4 bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
          <strong>Interpretation:</strong> High mortality within 6 hours suggests need for improved resuscitation and transport.
          Deaths in 6-24 hours may indicate inadequate stabilization. Deaths after 7 days often relate to chronic complications or nosocomial infections.
        </div>
      </section>

      {/* Inborn vs Outborn Mortality Comparison */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-indigo-500 flex items-center gap-2">
          <IconActivity size={22} className="text-indigo-600" /> Inborn vs Outborn Mortality
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-5 border border-blue-200">
            <h4 className="text-lg font-bold text-blue-800 mb-3 flex items-center gap-2">
              <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs">INBORN</span>
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-blue-600">{stats.inborn}</div>
                <div className="text-xs text-slate-600">Total</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-red-600">{stats.inbornDeceased}</div>
                <div className="text-xs text-slate-600">Deaths</div>
              </div>
            </div>
            <div className="mt-4 bg-white rounded-lg p-3 text-center">
              <div className="text-3xl font-bold text-red-600">{stats.inbornMortality}%</div>
              <div className="text-sm text-slate-600">Mortality Rate</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
            <h4 className="text-lg font-bold text-orange-800 mb-3 flex items-center gap-2">
              <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs">OUTBORN</span>
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-orange-600">{stats.outborn}</div>
                <div className="text-xs text-slate-600">Total</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-red-600">{stats.outbornDeceased}</div>
                <div className="text-xs text-slate-600">Deaths</div>
              </div>
            </div>
            <div className="mt-4 bg-white rounded-lg p-3 text-center">
              <div className="text-3xl font-bold text-red-600">{stats.outbornMortality}%</div>
              <div className="text-sm text-slate-600">Mortality Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Average Time to Death */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-slate-400 flex items-center gap-2">
          <IconClock size={22} className="text-slate-600" /> Time to Death Statistics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-slate-700">{stats.deceased}</div>
            <div className="text-xs text-slate-600 mt-1">Total Deaths</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-slate-700">{stats.avgTimeToDeathHours}h</div>
            <div className="text-xs text-slate-600 mt-1">Avg Hours to Death</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-slate-700">{(stats.avgTimeToDeathHours / 24).toFixed(1)}d</div>
            <div className="text-xs text-slate-600 mt-1">Avg Days to Death</div>
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
                  male: filteredPatients.filter(p => p.gender === 'Male' && outcomeOf(p) === 'Referred').length,
                  female: filteredPatients.filter(p => p.gender === 'Female' && outcomeOf(p) === 'Referred').length
                },
                {
                  outcome: 'Active/In Progress',
                  male: filteredPatients.filter(p => p.gender === 'Male' && outcomeOf(p) === 'In Progress').length,
                  female: filteredPatients.filter(p => p.gender === 'Female' && outcomeOf(p) === 'In Progress').length
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
    const dischargedPatients = filteredPatients.filter(p => outcomeOf(p) === 'Discharged');

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
              <div className="text-xs text-slate-600 mt-1">Overall Discharge Rate</div>
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

        {/* Inborn vs Outborn Discharge Rates */}
        <section>
          <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-indigo-500 flex items-center gap-2">
            <IconUsers size={22} className="text-indigo-600" /> Inborn vs Outborn Discharge Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Inborn Stats */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-5 border border-blue-200">
              <h4 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs">INBORN</span>
                Babies born in this facility
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <div className="text-2xl font-bold text-blue-600">{stats.inborn}</div>
                  <div className="text-xs text-slate-600">Total Inborn</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <div className="text-2xl font-bold text-green-600">{stats.inbornDischarged}</div>
                  <div className="text-xs text-slate-600">Discharged</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <div className="text-2xl font-bold text-emerald-600">{stats.inbornDischargeRate}%</div>
                  <div className="text-xs text-slate-600">Discharge Rate</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <div className="text-2xl font-bold text-cyan-600">{stats.avgLosInborn} days</div>
                  <div className="text-xs text-slate-600">Avg LOS</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/60 rounded p-2">
                  <div className="text-sm font-semibold text-red-600">{stats.inbornDeceased}</div>
                  <div className="text-xs text-slate-500">Deceased</div>
                </div>
                <div className="bg-white/60 rounded p-2">
                  <div className="text-sm font-semibold text-amber-600">{stats.inbornReferred}</div>
                  <div className="text-xs text-slate-500">Referred</div>
                </div>
                <div className="bg-white/60 rounded p-2">
                  <div className="text-sm font-semibold text-blue-600">{stats.inbornActive}</div>
                  <div className="text-xs text-slate-500">Active</div>
                </div>
              </div>
            </div>

            {/* Outborn Stats */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
              <h4 className="text-lg font-bold text-orange-800 mb-4 flex items-center gap-2">
                <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs">OUTBORN</span>
                Babies referred from outside
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <div className="text-2xl font-bold text-orange-600">{stats.outborn}</div>
                  <div className="text-xs text-slate-600">Total Outborn</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <div className="text-2xl font-bold text-green-600">{stats.outbornDischarged}</div>
                  <div className="text-xs text-slate-600">Discharged</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <div className="text-2xl font-bold text-emerald-600">{stats.outbornDischargeRate}%</div>
                  <div className="text-xs text-slate-600">Discharge Rate</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                  <div className="text-2xl font-bold text-amber-600">{stats.avgLosOutborn} days</div>
                  <div className="text-xs text-slate-600">Avg LOS</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/60 rounded p-2">
                  <div className="text-sm font-semibold text-red-600">{stats.outbornDeceased}</div>
                  <div className="text-xs text-slate-500">Deceased</div>
                </div>
                <div className="bg-white/60 rounded p-2">
                  <div className="text-sm font-semibold text-amber-600">{stats.outbornReferred}</div>
                  <div className="text-xs text-slate-500">Referred</div>
                </div>
                <div className="bg-white/60 rounded p-2">
                  <div className="text-sm font-semibold text-orange-600">{stats.outbornActive}</div>
                  <div className="text-xs text-slate-500">Active</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Length of Stay Statistics */}
        <section>
          <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-blue-500 flex items-center gap-2">
            <IconBed size={22} className="text-blue-600" /> Length of Stay Analysis
          </h3>
          <div className="grid grid-cols-3 gap-4 mb-6">
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

          {/* LOS Distribution */}
          <h4 className="text-md font-semibold text-slate-700 mb-3">Length of Stay Distribution</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
              <div className="text-xl font-bold text-green-600">{stats.losDistribution.lessThan24hrs}</div>
              <div className="text-xs text-slate-600">&lt; 24 hours</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
              <div className="text-xl font-bold text-blue-600">{stats.losDistribution.oneToThreeDays}</div>
              <div className="text-xs text-slate-600">1-3 days</div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-200">
              <div className="text-xl font-bold text-indigo-600">{stats.losDistribution.threeToSevenDays}</div>
              <div className="text-xs text-slate-600">3-7 days</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-200">
              <div className="text-xl font-bold text-purple-600">{stats.losDistribution.oneToTwoWeeks}</div>
              <div className="text-xs text-slate-600">1-2 weeks</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-200">
              <div className="text-xl font-bold text-amber-600">{stats.losDistribution.moreThanTwoWeeks}</div>
              <div className="text-xs text-slate-600">&gt; 2 weeks</div>
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
        {renderPatientRegistry('Discharged Patients', dischargedPatients, showPatientDetails)}
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

      {/* Inborn vs Outborn Comprehensive Analysis */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-pink-500 flex items-center gap-2">
          <IconHeartbeat size={22} className="text-pink-600" /> Inborn vs Outborn Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Inborn Card */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-5 border border-blue-200">
            <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
              <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs">INBORN</span>
              Babies born in this facility
            </h4>
            <div className="text-4xl font-bold text-blue-600">{stats.inborn}</div>
            <div className="text-sm text-slate-600 mt-1 mb-4">
              {stats.total > 0 ? ((stats.inborn / stats.total) * 100).toFixed(1) : 0}% of total admissions
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-xl font-bold text-green-600">{stats.inbornDischargeRate}%</div>
                <div className="text-xs text-slate-600">Discharge Rate</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-xl font-bold text-red-600">{stats.inbornMortality}%</div>
                <div className="text-xs text-slate-600">Mortality Rate</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-xl font-bold text-cyan-600">{stats.avgLosInborn}d</div>
                <div className="text-xs text-slate-600">Avg LOS</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-xl font-bold text-amber-600">{stats.inbornReferralRate}%</div>
                <div className="text-xs text-slate-600">Referral Rate</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-blue-200 grid grid-cols-4 gap-2 text-center text-xs">
              <div><span className="font-bold text-green-600">{stats.inbornDischarged}</span><br/>Dischgd</div>
              <div><span className="font-bold text-red-600">{stats.inbornDeceased}</span><br/>Deaths</div>
              <div><span className="font-bold text-amber-600">{stats.inbornReferred}</span><br/>Referred</div>
              <div><span className="font-bold text-blue-600">{stats.inbornActive}</span><br/>Active</div>
            </div>
          </div>

          {/* Outborn Card */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
            <h4 className="font-bold text-orange-800 mb-4 flex items-center gap-2">
              <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs">OUTBORN</span>
              Referred from outside
            </h4>
            <div className="text-4xl font-bold text-orange-600">{stats.outborn}</div>
            <div className="text-sm text-slate-600 mt-1 mb-4">
              {stats.total > 0 ? ((stats.outborn / stats.total) * 100).toFixed(1) : 0}% of total admissions
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-xl font-bold text-green-600">{stats.outbornDischargeRate}%</div>
                <div className="text-xs text-slate-600">Discharge Rate</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-xl font-bold text-red-600">{stats.outbornMortality}%</div>
                <div className="text-xs text-slate-600">Mortality Rate</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-xl font-bold text-amber-600">{stats.avgLosOutborn}d</div>
                <div className="text-xs text-slate-600">Avg LOS</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-xl font-bold text-purple-600">{stats.outbornReferralRate}%</div>
                <div className="text-xs text-slate-600">Referral Rate</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-orange-200 grid grid-cols-4 gap-2 text-center text-xs">
              <div><span className="font-bold text-green-600">{stats.outbornDischarged}</span><br/>Dischgd</div>
              <div><span className="font-bold text-red-600">{stats.outbornDeceased}</span><br/>Deaths</div>
              <div><span className="font-bold text-amber-600">{stats.outbornReferred}</span><br/>Referred</div>
              <div><span className="font-bold text-orange-600">{stats.outbornActive}</span><br/>Active</div>
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
      {renderPatientRegistry('Patient Registry', filteredPatients, showPatientDetails)}
    </div>
  );

  // Reusable Patient Registry component - showDetails passed explicitly to avoid closure issues
  const renderPatientRegistry = (title: string, patients: Patient[], showDetails: boolean = showPatientDetails) => {
    if (!showDetails) return null;

    return (
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
                  <th className="text-left p-2 font-semibold">Admission Type</th>
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
                    <td className="p-2">{getCanonicalAdmissionType(patient)}</td>
                    <td className="p-2">{patient.gender?.charAt(0) || '-'}</td>
                    <td className="p-2">{patient.gestationalAgeWeeks ? `${patient.gestationalAgeWeeks}w` : '-'}</td>
                    <td className="p-2">{patient.birthWeight ? `${patient.birthWeight < 10 ? (patient.birthWeight * 1000).toFixed(0) : patient.birthWeight}g` : '-'}</td>
                    <td className="p-2">{new Date(patient.admissionDate).toLocaleDateString('en-IN')}</td>
                    <td className="p-2 max-w-[150px] truncate">{patient.diagnosis || '-'}</td>
                    <td className="p-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${patient.outcome === 'Discharged' ? 'bg-green-100 text-green-700' :
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
  };

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
        <div className={`${selectedReportType === 'deaths' || selectedReportType === 'mortality' ? 'bg-gradient-to-r from-red-700 to-rose-700' :
          selectedReportType === 'admissions' ? 'bg-gradient-to-r from-blue-700 to-cyan-700' :
            selectedReportType === 'referred' ? 'bg-gradient-to-r from-amber-600 to-orange-600' :
              selectedReportType === 'stepdown' ? 'bg-gradient-to-r from-teal-600 to-cyan-600' :
                selectedReportType === 'gender' ? 'bg-gradient-to-r from-purple-600 to-pink-600' :
                  selectedReportType === 'discharge' ? 'bg-gradient-to-r from-green-600 to-emerald-600' :
                    'bg-gradient-to-r from-blue-700 to-indigo-700'
          } text-white p-8`}>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">{PDF_INSTITUTION_LABEL}</h1>
              <p className="text-white/90 text-sm mt-1 font-medium">{PDF_UNIT_LABEL}</p>
              <h2 className="text-xl mt-1 opacity-90">{currentReportInfo.title}</h2>
              <p className="text-white/80 mt-2">{dateRangeLabel}</p>
              <p className="text-white/70 text-sm mt-1">Units: {selectedUnits.join(', ')}</p>
              <p className="text-white/70 text-sm">Admission Type Scope: {admissionTypeScopeLabel}</p>
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

  // Special render for Daily Update - clean, simple UI
  if (selectedReportType === 'dailyUpdate' && step === 'preview') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        {/* Simple Header */}
        <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setStep('select');
                  setDailyUpdateStep('type');
                }}
                className="p-2 hover:bg-slate-700 rounded-xl transition-colors"
              >
                <IconArrowLeft size={22} />
              </button>
              <div>
                <h1 className="text-xl font-bold">Daily Update</h1>
                <p className="text-xs text-slate-400">{institutionName}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
          {renderDailyUpdateReport()}
        </div>
      </div>
    );
  }

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
