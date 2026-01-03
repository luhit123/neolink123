import React, { useState, useMemo, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Patient, Unit, UserRole, AdmissionType, BedCapacity } from '../types';
import StatCard from './StatCard';
import PatientList from './PatientList';
import UnitSelection from './UnitSelection';
import PatientForm from './PatientForm';
import PatientDetailModal from './PatientDetailModal';
import PatientFilters, { OutcomeFilter } from './PatientFilters';
import CollapsiblePatientCard from './CollapsiblePatientCard';
import TimeBasedAnalytics from './TimeBasedAnalytics';
import BedOccupancy from './BedOccupancy';
import AIClinicalAssistant from './AIClinicalAssistant';
import RiskMonitoringPanel from './RiskMonitoringPanel';
import SmartHandoff from './SmartHandoff';
import AIReportGenerator from './AIReportGenerator';
import { BedIcon, ArrowRightOnRectangleIcon, ChartBarIcon, PlusIcon, HomeIcon, ArrowUpOnSquareIcon, PresentationChartBarIcon, ArrowUpIcon, SparklesIcon } from './common/Icons';
import { ResponsiveContainer, Tooltip, Legend, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import NicuViewSelection from './NicuViewSelection';
import DateFilter, { DateFilterValue } from './DateFilter';
import ComprehensiveSummary from './ComprehensiveSummary';
import DeathsAnalysis from './DeathsAnalysis';
import PatientDetailsPage from './PatientDetailsPage';

interface DashboardProps {
  userRole: UserRole;
  institutionId?: string; // SuperAdmin doesn't have institutionId
  institutionName?: string; // SuperAdmin doesn't have institutionName
  userEmail?: string; // User email for tracking
  allRoles?: UserRole[]; // All roles the user has for multi-role support
  setShowSuperAdminPanel?: (show: boolean) => void; // For SuperAdmin dashboard access
  setShowAdminPanel?: (show: boolean) => void; // For Admin dashboard access
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const Dashboard: React.FC<DashboardProps> = ({ userRole, institutionId, institutionName, userEmail, allRoles, setShowSuperAdminPanel, setShowAdminPanel }) => {
  // Helper function to check if user has a specific role
  const hasRole = (role: UserRole) => {
    return userRole === role || (allRoles && allRoles.includes(role));
  };

  // Debug: Log user roles
  console.log('📋 Dashboard Roles:', {
    userRole,
    allRoles,
    hasAdmin: hasRole(UserRole.Admin),
    hasDoctor: hasRole(UserRole.Doctor),
    hasNurse: hasRole(UserRole.Nurse),
    canAddPatient: hasRole(UserRole.Doctor) || hasRole(UserRole.Nurse)
  });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [bedCapacity, setBedCapacity] = useState<BedCapacity | undefined>(undefined);
  const [selectedUnit, setSelectedUnit] = useState<Unit>(Unit.NICU);
  const [nicuView, setNicuView] = useState<'All' | 'Inborn' | 'Outborn'>('All');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ period: 'This Month' });
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('All');

  // Chart filter state
  type ChartTimeRange = 'today' | 'week' | 'month' | '3months' | '6months' | 'year' | 'all' | 'custom';
  const [chartTimeRange, setChartTimeRange] = useState<ChartTimeRange>('month');
  const [showChartCustomRange, setShowChartCustomRange] = useState(false);
  const [chartCustomStartDate, setChartCustomStartDate] = useState('');
  const [chartCustomEndDate, setChartCustomEndDate] = useState('');
  const [showChartMonthYearPicker, setShowChartMonthYearPicker] = useState(false);
  const [chartSelectedMonth, setChartSelectedMonth] = useState(new Date().getMonth());
  const [chartSelectedYear, setChartSelectedYear] = useState(new Date().getFullYear());
  const [showSummary, setShowSummary] = useState(false);
  const [showDeathsAnalysis, setShowDeathsAnalysis] = useState(false);
  const [showRiskMonitoring, setShowRiskMonitoring] = useState(false);
  const [showSmartHandoff, setShowSmartHandoff] = useState(false);
  const [showAIReportGenerator, setShowAIReportGenerator] = useState(false);
  const [showPatientDetailsPage, setShowPatientDetailsPage] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null);
  const [patientToView, setPatientToView] = useState<Patient | null>(null);
  const [selectedPatientForAI, setSelectedPatientForAI] = useState<Patient | null>(null);

  // Load patients and bed capacity from Firestore with real-time updates
  useEffect(() => {
    if (!institutionId) {
      setPatients([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Set up real-time listener for patients
    const patientsRef = collection(db, 'patients');
    const q = query(patientsRef, where('institutionId', '==', institutionId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allPatients = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
        } as Patient));

        setPatients(allPatients);
        setLoading(false);
        console.log('✅ Real-time update: Loaded', allPatients.length, 'patients');
      },
      (error) => {
        console.error('❌ Error loading patients:', error);
        setPatients([]);
        setLoading(false);
      }
    );

    // Load bed capacity (one-time load)
    loadBedCapacity();

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [institutionId]);


  const loadBedCapacity = async () => {
    if (!institutionId) {
      setBedCapacity(undefined);
      return;
    }

    try {
      const institutionDoc = await getDoc(doc(db, 'institutions', institutionId));
      if (institutionDoc.exists()) {
        const data = institutionDoc.data();
        if (data.bedCapacity) {
          setBedCapacity(data.bedCapacity);
          console.log('✅ Loaded bed capacity:', data.bedCapacity);
        } else {
          // Use defaults if not set
          setBedCapacity({ PICU: 10, NICU: 20 });
        }
      }
    } catch (error: any) {
      console.error('❌ Error loading bed capacity:', error);
      setBedCapacity({ PICU: 10, NICU: 20 }); // Fallback to defaults
    }
  };

  // Base patients filtered only by unit/institution (NO date filter) - used for charts
  const baseUnitPatients = useMemo(() => {
    let baseFiltered = institutionId
      ? patients.filter(p => p.institutionId === institutionId && p.unit === selectedUnit)
      : patients.filter(p => p.unit === selectedUnit);

    if (selectedUnit === Unit.NICU && nicuView !== 'All') {
      baseFiltered = baseFiltered.filter(p => p.admissionType === nicuView);
    }

    return baseFiltered;
  }, [patients, selectedUnit, nicuView, institutionId]);

 const unitPatients = useMemo(() => {
    const baseFiltered = baseUnitPatients;

    if (dateFilter.period === 'All Time') {
        return baseFiltered;
    }

    let startDate: Date;
    let endDate: Date;

    const periodIsMonth = /\d{4}-\d{2}/.test(dateFilter.period);

    if (periodIsMonth) {
        const [year, month] = dateFilter.period.split('-').map(Number);
        startDate = new Date(Date.UTC(year, month - 1, 1));
        endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    } else {
        const now = new Date();
        switch (dateFilter.period) {
            case 'Today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                break;
            case 'This Week':
                const firstDayOfWeek = new Date(now);
                firstDayOfWeek.setDate(now.getDate() - now.getDay());
                startDate = new Date(firstDayOfWeek.getFullYear(), firstDayOfWeek.getMonth(), firstDayOfWeek.getDate());
                
                const lastDayOfWeek = new Date(firstDayOfWeek);
                lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
                endDate = new Date(lastDayOfWeek.getFullYear(), lastDayOfWeek.getMonth(), lastDayOfWeek.getDate(), 23, 59, 59, 999);
                break;
            case 'This Month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
            case 'Custom':
                if (!dateFilter.startDate || !dateFilter.endDate) return baseFiltered;
                startDate = new Date(dateFilter.startDate);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(dateFilter.endDate);
                endDate.setHours(23, 59, 59, 999);
                break;
            default:
                return baseFiltered;
        }
    }

    return baseFiltered.filter(p => {
        const admissionDate = new Date(p.admissionDate);

        if (p.outcome === 'Discharged' && (p.releaseDate || p.finalDischargeDate)) {
            const dischargeDate = new Date(p.finalDischargeDate || p.releaseDate!);
            return dischargeDate >= startDate && dischargeDate <= endDate;
        }

        if (p.outcome === 'Step Down' && p.stepDownDate) {
            const stepDownDate = new Date(p.stepDownDate);
            return stepDownDate >= startDate && stepDownDate <= endDate;
        }

        if (p.outcome === 'In Progress') {
            const isAdmittedBeforeOrDuringPeriod = admissionDate <= endDate;
            const releaseDate = p.releaseDate || p.finalDischargeDate;
            const stillInProgressDuringPeriod = !releaseDate || new Date(releaseDate) >= startDate;
            return isAdmittedBeforeOrDuringPeriod && stillInProgressDuringPeriod;
        }

        if (p.outcome === 'Referred') {
            if (p.releaseDate) {
                const referralDate = new Date(p.releaseDate);
                return referralDate >= startDate && referralDate <= endDate;
            }
            return admissionDate >= startDate && admissionDate <= endDate;
        }

        if (p.outcome === 'Deceased') {
            if (p.releaseDate) {
                const deathDate = new Date(p.releaseDate);
                return deathDate >= startDate && deathDate <= endDate;
            }
            return admissionDate >= startDate && admissionDate <= endDate;
        }

        return admissionDate >= startDate && admissionDate <= endDate;
    });
}, [baseUnitPatients, dateFilter]);

  // Apply outcome filter
  const filteredPatients = useMemo(() => {
    if (outcomeFilter === 'All') return unitPatients;
    return unitPatients.filter(p => p.outcome === outcomeFilter);
  }, [unitPatients, outcomeFilter]);

  const stats = useMemo(() => {
    const total = unitPatients.length;
    const deceased = unitPatients.filter(p => p.outcome === 'Deceased').length;
    const discharged = unitPatients.filter(p => p.outcome === 'Discharged').length;
    const referred = unitPatients.filter(p => p.outcome === 'Referred').length;
    const inProgress = unitPatients.filter(p => p.outcome === 'In Progress').length;
    const stepDown = unitPatients.filter(p => p.outcome === 'Step Down').length;

    const mortalityRate = total > 0 ? ((deceased / total) * 100).toFixed(1) : '0';
    const mortalityPercentage = mortalityRate + '%';
    const dischargeRate = total > 0 ? ((discharged / total) * 100).toFixed(1) : '0';
    const dischargePercentage = dischargeRate + '%';
    const referralRate = total > 0 ? ((referred / total) * 100).toFixed(1) : '0';
    const referralPercentage = referralRate + '%';
    const inProgressRate = total > 0 ? ((inProgress / total) * 100).toFixed(1) : '0';
    const inProgressPercentage = inProgressRate + '%';
    const stepDownRate = total > 0 ? ((stepDown / total) * 100).toFixed(1) : '0';
    const stepDownPercentage = stepDownRate + '%';

    if (selectedUnit === Unit.NICU) {
      const inbornDeaths = unitPatients.filter(p => p.outcome === 'Deceased' && p.admissionType === 'Inborn').length;
      const outbornDeaths = unitPatients.filter(p => p.outcome === 'Deceased' && p.admissionType === 'Outborn').length;
      const inbornTotal = unitPatients.filter(p => p.admissionType === 'Inborn').length;
      const outbornTotal = unitPatients.filter(p => p.admissionType === 'Outborn').length;
      const inbornMortalityRate = inbornTotal > 0 ? ((inbornDeaths / inbornTotal) * 100).toFixed(1) + '%' : '0%';
      const outbornMortalityRate = outbornTotal > 0 ? ((outbornDeaths / outbornTotal) * 100).toFixed(1) + '%' : '0%';

      return {
        total, deceased, discharged, referred, inProgress, stepDown,
        mortalityRate: mortalityPercentage, dischargeRate: dischargePercentage, referralRate: referralPercentage,
        inProgressPercentage, stepDownPercentage,
        inbornDeaths, outbornDeaths, inbornMortalityRate, outbornMortalityRate
      };
    }

    if (selectedUnit === Unit.PICU) {
      // Calculate under-5 mortality for PICU
      const under5Patients = unitPatients.filter(p => {
        if (p.ageUnit === 'years' && p.age < 5) return true;
        if (p.ageUnit === 'months') return true;
        if (p.ageUnit === 'weeks') return true;
        if (p.ageUnit === 'days') return true;
        return false;
      });
      const under5Deaths = under5Patients.filter(p => p.outcome === 'Deceased').length;
      const under5Total = under5Patients.length;
      const under5MortalityRate = under5Total > 0 ? ((under5Deaths / under5Total) * 100).toFixed(1) + '%' : '0%';

      return {
        total, deceased, discharged, referred, inProgress, stepDown,
        mortalityRate: mortalityPercentage, dischargeRate: dischargePercentage, referralRate: referralPercentage,
        inProgressPercentage, stepDownPercentage,
        under5Deaths, under5Total, under5MortalityRate
      };
    }

    return {
      total, deceased, discharged, referred, inProgress, stepDown,
      mortalityRate: mortalityPercentage, dischargeRate: dischargePercentage, referralRate: referralPercentage,
      inProgressPercentage, stepDownPercentage
    };
  }, [unitPatients, selectedUnit]);

  const nicuMortalityBreakdown = useMemo(() => {
    if (selectedUnit !== Unit.NICU || !stats.inbornDeaths || !stats.outbornDeaths) return [];
    return [
      { name: 'Inborn', value: stats.inbornDeaths },
      { name: 'Outborn', value: stats.outbornDeaths }
    ].filter(item => item.value > 0);
  }, [selectedUnit, stats]);

  // Chart-filtered patients for analytics charts - uses baseUnitPatients (independent of main date filter)
  const chartFilteredPatients = useMemo(() => {
    if (chartTimeRange === 'all') return baseUnitPatients;

    let startDate: Date;
    let endDate: Date = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (chartTimeRange === 'custom' && chartCustomStartDate && chartCustomEndDate) {
      startDate = new Date(chartCustomStartDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(chartCustomEndDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const now = new Date();
      switch (chartTimeRange) {
        case 'today':
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate = new Date();
          startDate.setDate(now.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        case '3months':
          startDate = new Date();
          startDate.setMonth(now.getMonth() - 3);
          startDate.setHours(0, 0, 0, 0);
          break;
        case '6months':
          startDate = new Date();
          startDate.setMonth(now.getMonth() - 6);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        default:
          return baseUnitPatients;
      }
    }

    return baseUnitPatients.filter(p => {
      const admissionDate = new Date(p.admissionDate);
      return admissionDate >= startDate && admissionDate <= endDate;
    });
  }, [baseUnitPatients, chartTimeRange, chartCustomStartDate, chartCustomEndDate]);

  // Chart stats based on chart-filtered patients
  const chartStats = useMemo(() => {
    const total = chartFilteredPatients.length;
    const deceased = chartFilteredPatients.filter(p => p.outcome === 'Deceased').length;
    const discharged = chartFilteredPatients.filter(p => p.outcome === 'Discharged').length;
    const referred = chartFilteredPatients.filter(p => p.outcome === 'Referred').length;
    const inProgress = chartFilteredPatients.filter(p => p.outcome === 'In Progress').length;
    const stepDown = chartFilteredPatients.filter(p => p.outcome === 'Step Down').length;

    if (selectedUnit === Unit.NICU) {
      const inbornDeaths = chartFilteredPatients.filter(p => p.outcome === 'Deceased' && p.admissionType === 'Inborn').length;
      const outbornDeaths = chartFilteredPatients.filter(p => p.outcome === 'Deceased' && p.admissionType === 'Outborn').length;

      return {
        total, deceased, discharged, referred, inProgress, stepDown,
        inbornDeaths, outbornDeaths
      };
    }

    return {
      total, deceased, discharged, referred, inProgress, stepDown
    };
  }, [chartFilteredPatients, selectedUnit]);

  const handleChartTimeRangeClick = (range: ChartTimeRange) => {
    if (range === 'custom') {
      setShowChartCustomRange(!showChartCustomRange);
      setShowChartMonthYearPicker(false);
    } else {
      setShowChartCustomRange(false);
      setShowChartMonthYearPicker(false);
      setChartTimeRange(range);
    }
  };

  const handleChartCustomApply = () => {
    if (chartCustomStartDate && chartCustomEndDate) {
      setChartTimeRange('custom');
      setShowChartCustomRange(false);
    }
  };

  const handleChartMonthYearToggle = () => {
    setShowChartMonthYearPicker(!showChartMonthYearPicker);
    setShowChartCustomRange(false);
  };

  const handleChartMonthYearApply = () => {
    const startDate = new Date(chartSelectedYear, chartSelectedMonth, 1);
    const endDate = new Date(chartSelectedYear, chartSelectedMonth + 1, 0);

    setChartCustomStartDate(startDate.toISOString().split('T')[0]);
    setChartCustomEndDate(endDate.toISOString().split('T')[0]);
    setChartTimeRange('custom');
    setShowChartMonthYearPicker(false);
  };

  const chartMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const chartCurrentYear = new Date().getFullYear();
  const chartYears = Array.from({ length: 10 }, (_, i) => chartCurrentYear - i);

  // Helper function to get the chart period title for display
  const getChartPeriodTitle = () => {
    switch (chartTimeRange) {
      case 'today':
        return 'Today';
      case 'week':
        return 'This Week';
      case 'month':
        return new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
      case '3months':
        return 'Last 3 Months';
      case '6months':
        return 'Last 6 Months';
      case 'year':
        return `Year ${new Date().getFullYear()}`;
      case 'all':
        return 'All Time';
      case 'custom':
        if (chartCustomStartDate && chartCustomEndDate) {
          const start = new Date(chartCustomStartDate);
          const end = new Date(chartCustomEndDate);
          // Check if it's a full month (same month/year and covers full month)
          if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear() &&
            start.getDate() === 1 && end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()) {
            return start.toLocaleString('default', { month: 'long', year: 'numeric' });
          }
          // Otherwise show date range
          const formatDate = (d: Date) => d.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
          return `${formatDate(start)} - ${formatDate(end)}`;
        }
        return 'Custom Range';
      default:
        return '';
    }
  };

  const getDashboardTitle = () => {
    if (selectedUnit === Unit.NICU) {
      const viewTitle = nicuView === 'All' ? '' : `- ${nicuView} Patients`;
      return `NICU Dashboard ${viewTitle}`;
    }
    return 'PICU Dashboard';
  };

  const getPeriodTitle = (period: string) => {
    if (!period || period === 'All Time') return '';
    if (period === 'Custom') return '(Custom Range)';
    if (/\d{4}-\d{2}/.test(period)) {
      const [year, month] = period.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return `(${date.toLocaleString('default', { month: 'long', year: 'numeric' })})`;
    }
    return `(${period})`;
  };

  const handleAddPatient = () => {
    setPatientToEdit(null);
    setIsFormOpen(true);
  };

  const handleEditPatient = (patient: Patient) => {
    setPatientToEdit(patient);
    setIsFormOpen(true);
  };

  const handleSavePatient = async (patientData: Patient) => {
    console.log('📥 Dashboard handleSavePatient received - progressNotes:', JSON.stringify(patientData.progressNotes));
    console.log('📥 Dashboard handleSavePatient received - progressNotes length:', patientData.progressNotes?.length);
    try {
      if (!institutionId) {
        alert('Institution ID is required to save patient data');
        return;
      }

      // Clean the data: remove undefined values and ensure progress notes is always an array
      const cleanedData = {
        ...patientData,
        progressNotes: patientData.progressNotes || [],
      };

      // Remove undefined fields to prevent Firestore errors
      const sanitizedData = JSON.parse(JSON.stringify(cleanedData, (key, value) => {
        return value === undefined ? null : value;
      }));

      if (patientToEdit) {
        // Update existing patient in top-level patients collection
        const patientRef = doc(db, 'patients', patientToEdit.id);
        await updateDoc(patientRef, sanitizedData);
        console.log('✅ Patient updated in Firestore:', patientData.id);
      } else {
        // Add new patient to top-level patients collection
        const patientsRef = collection(db, 'patients');
        const docRef = await addDoc(patientsRef, sanitizedData);
        console.log('✅ Patient added to Firestore:', docRef.id);
      }

      // Real-time listener will automatically update the patient list
      setIsFormOpen(false);
      setPatientToEdit(null);
    } catch (error: any) {
      console.error('❌ Error saving patient:', error);
      console.error('Patient data that failed:', patientData);
      alert('Failed to save patient: ' + error.message);
    }
  };

  const handleDeletePatient = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this patient record?')) {
      return;
    }

    try {
      // Delete patient from top-level patients collection
      const patientRef = doc(db, 'patients', id);
      await deleteDoc(patientRef);
      console.log('✅ Patient deleted from Firestore:', id);

      // Real-time listener will automatically update the patient list
    } catch (error: any) {
      console.error('❌ Error deleting patient:', error);
      alert('Failed to delete patient: ' + error.message);
    }
  };

  const handleViewDetails = (patient: Patient) => {
    setPatientToView(patient);
    setIsDetailsOpen(true);
  };

  const handleStepDownDischarge = async (patient: Patient) => {
    if (!window.confirm(`Are you sure you want to discharge ${patient.name} from step down? This will be their final discharge from the hospital.`)) {
      return;
    }

    try {
      const updatedPatient: Patient = {
        ...patient,
        outcome: 'Discharged',
        finalDischargeDate: new Date().toISOString(),
        lastUpdatedBy: userRole,
        lastUpdatedByEmail: userEmail,
        lastEditedAt: new Date().toISOString()
      };

      // Update patient in top-level patients collection
      const patientRef = doc(db, 'patients', patient.id);
      await updateDoc(patientRef, { ...updatedPatient });
      console.log('✅ Patient discharged from step down:', patient.id);

      // Real-time listener will automatically update the patient list
    } catch (error: any) {
      console.error('❌ Error discharging patient:', error);
      alert('Failed to discharge patient: ' + error.message);
    }
  };

  const handleReadmitFromStepDown = async (patient: Patient) => {
    const originalUnit = patient.stepDownFrom || patient.unit;
    const unitName = originalUnit === Unit.NICU ? 'NICU' : 'PICU';

    if (!window.confirm(`Are you sure you want to readmit ${patient.name} back to ${unitName}?`)) {
      return;
    }

    try {
      const updatedPatient: Patient = {
        ...patient,
        outcome: 'In Progress',
        unit: originalUnit,
        isStepDown: false,
        readmissionFromStepDown: true,
        lastUpdatedBy: userRole,
        lastUpdatedByEmail: userEmail,
        lastEditedAt: new Date().toISOString()
      };

      // Update patient in top-level patients collection
      const patientRef = doc(db, 'patients', patient.id);
      await updateDoc(patientRef, { ...updatedPatient });
      console.log('✅ Patient readmitted from step down:', patient.id);

      // Real-time listener will automatically update the patient list
    } catch (error: any) {
      console.error('❌ Error readmitting patient:', error);
      alert('Failed to readmit patient: ' + error.message);
    }
  };

  const handleSelectUnit = (unit: Unit) => {
    setSelectedUnit(unit);
    setNicuView('All'); // Reset nicu view when switching main unit
  };

  if (showSummary) {
    return <ComprehensiveSummary patients={patients} onBack={() => setShowSummary(false)} />;
  }

  if (showDeathsAnalysis) {
    return <DeathsAnalysis patients={patients} onBack={() => setShowDeathsAnalysis(false)} />;
  }

  if (showPatientDetailsPage) {
    return (
      <>
        <PatientDetailsPage
          patients={patients}
          selectedUnit={selectedUnit}
          onBack={() => setShowPatientDetailsPage(false)}
          onViewDetails={handleViewDetails}
          onEdit={handleEditPatient}
          userRole={userRole}
          allRoles={allRoles}
        />

        {/* Modals */}
        {isFormOpen && institutionId && institutionName && userEmail && (
          <PatientForm
            patientToEdit={patientToEdit}
            onSave={handleSavePatient}
            onClose={() => setIsFormOpen(false)}
            userRole={userRole}
            defaultUnit={selectedUnit}
            institutionId={institutionId}
            institutionName={institutionName}
            userEmail={userEmail}
          />
        )}

        {isDetailsOpen && patientToView && (
          <PatientDetailModal
            patient={patientToView}
            onClose={() => setIsDetailsOpen(false)}
          />
        )}
      </>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-300 text-lg">Loading patient data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-stretch gap-4 w-full md:w-auto">
          <UnitSelection selectedUnit={selectedUnit} onSelectUnit={handleSelectUnit} />
          {hasRole(UserRole.Admin) && setShowAdminPanel && (
            <button onClick={() => setShowAdminPanel(true)} className="flex items-center justify-center gap-2 bg-medical-blue text-white px-4 py-2 rounded-lg hover:bg-medical-blue-light transition-colors font-semibold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>Admin Dashboard</span>
            </button>
          )}
          {hasRole(UserRole.Admin) && (
            <button onClick={() => setShowSummary(true)} className="flex items-center justify-center gap-2 bg-medical-teal text-white px-4 py-2 rounded-lg hover:bg-medical-teal-light transition-colors font-semibold">
              <PresentationChartBarIcon className="w-5 h-5" />
              <span>Summary</span>
            </button>
          )}
          {(hasRole(UserRole.Admin) || hasRole(UserRole.Doctor)) && (
            <button onClick={() => setShowDeathsAnalysis(true)} className="flex items-center justify-center gap-2 bg-medical-red text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-semibold text-sm sm:text-base min-h-[44px]">
              <ChartBarIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Deaths Analysis</span>
              <span className="sm:hidden">Deaths</span>
            </button>
          )}
          {(hasRole(UserRole.Admin) || hasRole(UserRole.Doctor)) && (
            <button onClick={() => setShowRiskMonitoring(true)} className="flex items-center justify-center gap-2 bg-medical-orange text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors font-semibold text-sm sm:text-base min-h-[44px]">
              <span className="text-lg">🎯</span>
              <span className="hidden sm:inline">AI Risk Monitor</span>
              <span className="sm:hidden">Risk</span>
            </button>
          )}
          {(hasRole(UserRole.Doctor) || hasRole(UserRole.Nurse)) && (
            <button onClick={() => setShowSmartHandoff(true)} className="flex items-center justify-center gap-2 bg-medical-teal text-white px-4 py-2 rounded-lg hover:bg-medical-teal-light transition-colors font-semibold text-sm sm:text-base min-h-[44px]">
              <span className="text-lg">📝</span>
              <span className="hidden sm:inline">Smart Handoff</span>
              <span className="sm:hidden">Handoff</span>
            </button>
          )}
          {hasRole(UserRole.Admin) && (
            <button onClick={() => setShowAIReportGenerator(true)} className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm sm:text-base min-h-[44px]">
              <span className="text-lg">📊</span>
              <span className="hidden sm:inline">AI Reports</span>
              <span className="sm:hidden">Reports</span>
            </button>
          )}
          {(hasRole(UserRole.Doctor) || hasRole(UserRole.Nurse)) && (
            <button onClick={handleAddPatient} className="flex items-center justify-center gap-2 bg-medical-teal text-white px-4 py-2 rounded-lg hover:bg-medical-teal-light transition-colors font-semibold text-sm sm:text-base min-h-[44px]">
              <PlusIcon className="w-5 h-5" />
              <span className="hidden sm:inline">{hasRole(UserRole.Nurse) && !hasRole(UserRole.Doctor) ? 'Add Patient (Draft)' : 'Add Patient'}</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}
          {userRole === UserRole.SuperAdmin && setShowSuperAdminPanel && (
            <button onClick={() => setShowSuperAdminPanel(true)} className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>SuperAdmin Dashboard</span>
            </button>
          )}
        </div>
      </div>

      {selectedUnit === Unit.NICU && (
        <NicuViewSelection selectedView={nicuView} onSelectView={setNicuView} />
      )}

      <DateFilter onFilterChange={setDateFilter} />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 md:gap-4">
        <StatCard title={`Total Patients ${getPeriodTitle(dateFilter.period)}`} value={stats.total} icon={<BedIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />} color="bg-medical-blue/90" />
        <StatCard title={`In Progress ${getPeriodTitle(dateFilter.period)}`} value={stats.inProgress} icon={<BedIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />} color="bg-medical-blue-light/90" />
        <StatCard title={`Step Down ${getPeriodTitle(dateFilter.period)}`} value={stats.stepDown} icon={<ArrowUpIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />} color="bg-blue-500/90" />
        <StatCard title={`Discharged ${getPeriodTitle(dateFilter.period)}`} value={stats.discharged} icon={<ArrowRightOnRectangleIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />} color="bg-medical-green/90" />
        <StatCard title={`Referred ${getPeriodTitle(dateFilter.period)}`} value={stats.referred} icon={<ArrowUpOnSquareIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />} color="bg-medical-orange/90" />
        <StatCard title={`Deceased ${getPeriodTitle(dateFilter.period)}`} value={stats.deceased} icon={<ChartBarIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />} color="bg-medical-red/90" />
        <StatCard title={`Mortality Rate ${getPeriodTitle(dateFilter.period)}`} value={stats.mortalityRate} icon={<ChartBarIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />} color="bg-medical-red" />
      </div>

      {/* Additional Rate Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 p-4 md:p-6 rounded-xl border border-green-500/30">
          <div className="text-xs md:text-sm text-green-300 font-medium mb-1">💚 Discharge Rate</div>
          <div className="text-2xl md:text-3xl font-bold text-green-400">{stats.dischargeRate}</div>
          <div className="text-xs text-green-300/70 mt-2">{stats.discharged} of {stats.total} patients successfully discharged</div>
        </div>
        <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 p-4 md:p-6 rounded-xl border border-orange-500/30">
          <div className="text-xs md:text-sm text-orange-300 font-medium mb-1">🔄 Referral Rate</div>
          <div className="text-2xl md:text-3xl font-bold text-orange-400">{stats.referralRate}</div>
          <div className="text-xs text-orange-300/70 mt-2">{stats.referred} of {stats.total} patients referred to other facilities</div>
        </div>
        <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 p-4 md:p-6 rounded-xl border border-red-500/30">
          <div className="text-xs md:text-sm text-red-300 font-medium mb-1">⚠️ Mortality Rate</div>
          <div className="text-2xl md:text-3xl font-bold text-red-400">{stats.mortalityRate}</div>
          <div className="text-xs text-red-300/70 mt-2">{stats.deceased} of {stats.total} patients</div>
        </div>
      </div>

      {/* Mortality Analysis Section */}
      <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 transition-colors duration-200">
        <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">📊</span>
          Mortality Analysis vs Total Admissions
        </h3>

        {/* Chart Time Range Filter */}
        <div className="bg-gradient-to-r from-sky-50 to-blue-50 border-2 border-sky-200 rounded-xl p-4 mb-6 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <h4 className="text-base font-bold text-sky-900">Filter Analytics Charts</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'today' as ChartTimeRange, label: 'Today', icon: '📅' },
              { value: 'week' as ChartTimeRange, label: 'This Week', icon: '📆' },
              { value: 'month' as ChartTimeRange, label: 'This Month', icon: '🗓️' },
              { value: '3months' as ChartTimeRange, label: 'Last 3 Months', icon: '📊' },
              { value: '6months' as ChartTimeRange, label: 'Last 6 Months', icon: '📈' },
              { value: 'year' as ChartTimeRange, label: 'This Year', icon: '🗂️' },
              { value: 'all' as ChartTimeRange, label: 'All Time', icon: '∞' },
            ].map((range) => (
              <button
                key={range.value}
                onClick={() => handleChartTimeRangeClick(range.value)}
                className={`
                  px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2
                  ${chartTimeRange === range.value && !showChartMonthYearPicker
                    ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg scale-105'
                    : 'bg-white text-sky-700 border-2 border-sky-200 hover:border-sky-400 hover:shadow-md'
                  }
                `}
              >
                <span>{range.icon}</span>
                <span>{range.label}</span>
              </button>
            ))}

            {/* Month/Year Selector Button */}
            <button
              onClick={handleChartMonthYearToggle}
              className={`
                px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2
                ${showChartMonthYearPicker
                  ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg scale-105'
                  : 'bg-white text-sky-700 border-2 border-sky-200 hover:border-sky-400 hover:shadow-md'
                }
              `}
            >
              <span>📆</span>
              <span>Select Month</span>
            </button>

            {/* Custom Range Button */}
            <button
              onClick={() => handleChartTimeRangeClick('custom')}
              className={`
                px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2
                ${showChartCustomRange
                  ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg scale-105'
                  : 'bg-white text-sky-700 border-2 border-sky-200 hover:border-sky-400 hover:shadow-md'
                }
              `}
            >
              <span>🎯</span>
              <span>Custom Range</span>
            </button>
          </div>

          {/* Month/Year Picker */}
          {showChartMonthYearPicker && (
            <div className="mt-4 bg-white border-2 border-sky-300 rounded-xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h4 className="font-bold text-sky-900 text-lg">Select Month & Year</h4>
              </div>

              <div className="space-y-4">
                {/* Year Selector */}
                <div>
                  <label className="text-sm font-bold text-sky-700 mb-2 block">Year</label>
                  <div className="grid grid-cols-5 gap-2">
                    {chartYears.map(year => (
                      <button
                        key={year}
                        onClick={() => setChartSelectedYear(year)}
                        className={`
                          px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200
                          ${chartSelectedYear === year
                            ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-md scale-105'
                            : 'bg-sky-50 text-sky-700 border-2 border-sky-200 hover:border-sky-400 hover:shadow-sm'
                          }
                        `}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Month Selector */}
                <div>
                  <label className="text-sm font-bold text-sky-700 mb-2 block">Month</label>
                  <div className="grid grid-cols-4 gap-2">
                    {chartMonths.map((month, index) => (
                      <button
                        key={month}
                        onClick={() => setChartSelectedMonth(index)}
                        className={`
                          px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200
                          ${chartSelectedMonth === index
                            ? 'bg-gradient-to-r from-blue-500 to-sky-500 text-white shadow-md scale-105'
                            : 'bg-sky-50 text-sky-700 border-2 border-sky-200 hover:border-sky-400 hover:shadow-sm'
                          }
                        `}
                      >
                        {month.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selected Display */}
                <div className="bg-gradient-to-r from-sky-50 to-blue-50 border-2 border-sky-200 rounded-lg p-4">
                  <div className="text-center">
                    <div className="text-xs text-sky-600 font-semibold mb-1">Selected Period</div>
                    <div className="text-xl font-bold text-sky-900">
                      {chartMonths[chartSelectedMonth]} {chartSelectedYear}
                    </div>
                  </div>
                </div>

                {/* Apply Button */}
                <button
                  onClick={handleChartMonthYearApply}
                  className="w-full bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white font-bold py-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Apply Selection
                </button>
              </div>
            </div>
          )}

          {/* Custom Date Range Picker */}
          {showChartCustomRange && (
            <div className="mt-4 bg-white border-2 border-sky-300 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h4 className="font-bold text-sky-900">Custom Date Range</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-sky-700 mb-1 block">Start Date</label>
                  <input
                    type="date"
                    value={chartCustomStartDate}
                    onChange={(e) => setChartCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-sky-200 rounded-lg focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-sky-700 mb-1 block">End Date</label>
                  <input
                    type="date"
                    value={chartCustomEndDate}
                    onChange={(e) => setChartCustomEndDate(e.target.value)}
                    min={chartCustomStartDate}
                    className="w-full px-3 py-2 border-2 border-sky-200 rounded-lg focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleChartCustomApply}
                disabled={!chartCustomStartDate || !chartCustomEndDate}
                className="w-full bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white font-bold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                Apply Custom Range
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Mortality vs Admissions Bar Chart */}
          <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg transition-colors duration-200">
            <h4 className="text-sm md:text-base font-semibold text-slate-700 dark:text-slate-300 mb-3">Mortality vs Total Admissions <span className="text-sky-500">({getChartPeriodTitle()})</span></h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={[
                { name: 'Total Admissions', value: chartStats.total, fill: '#3b82f6' },
                { name: 'Deceased', value: chartStats.deceased, fill: '#ef4444' },
                { name: 'Survived', value: chartStats.total - chartStats.deceased, fill: '#10b981' }
              ]}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '12px' }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {[{ fill: '#3b82f6' }, { fill: '#ef4444' }, { fill: '#10b981' }].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 text-center">
              Mortality Rate: <span className="text-red-400 font-bold">{chartStats.total > 0 ? ((chartStats.deceased / chartStats.total) * 100).toFixed(1) + '%' : '0%'}</span> ({chartStats.deceased}/{chartStats.total})
            </div>
          </div>

          {/* Outcome Breakdown Pie Chart */}
          <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg transition-colors duration-200">
            <h4 className="text-sm md:text-base font-semibold text-slate-700 dark:text-slate-300 mb-3">Patient Outcomes Distribution <span className="text-sky-500">({getChartPeriodTitle()})</span></h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'In Progress', value: chartStats.inProgress, fill: '#3b82f6' },
                    { name: 'Step Down', value: chartStats.stepDown, fill: '#a855f7' },
                    { name: 'Discharged', value: chartStats.discharged, fill: '#10b981' },
                    { name: 'Referred', value: chartStats.referred, fill: '#f59e0b' },
                    { name: 'Deceased', value: chartStats.deceased, fill: '#ef4444' }
                  ].filter(item => item.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {[{ fill: '#3b82f6' }, { fill: '#a855f7' }, { fill: '#10b981' }, { fill: '#f59e0b' }, { fill: '#ef4444' }].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 text-center">
              Total Patients: <span className="text-sky-400 font-bold">{chartStats.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* NICU Specific Mortality Breakdown */}
      {selectedUnit === Unit.NICU && (
        <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 transition-colors duration-200">
          <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">🏥</span>
            NICU Mortality: Inborn vs Outborn Analysis <span className="text-sky-500 text-base">({getChartPeriodTitle()})</span>
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Inborn vs Outborn Admissions & Deaths */}
            <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg transition-colors duration-200">
              <h4 className="text-sm md:text-base font-semibold text-slate-700 dark:text-slate-300 mb-3">Admissions & Mortality Comparison <span className="text-sky-500">({getChartPeriodTitle()})</span></h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[
                  {
                    name: 'Inborn',
                    admissions: chartFilteredPatients.filter(p => p.admissionType === 'Inborn').length,
                    deaths: chartStats.inbornDeaths ?? 0
                  },
                  {
                    name: 'Outborn',
                    admissions: chartFilteredPatients.filter(p => p.admissionType === 'Outborn').length,
                    deaths: chartStats.outbornDeaths ?? 0
                  }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="admissions" name="Total Admissions" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="deaths" name="Deaths" fill="#ef4444" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Mortality Rate Comparison */}
            <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg transition-colors duration-200">
              <h4 className="text-sm md:text-base font-semibold text-slate-700 dark:text-slate-300 mb-3">Mortality Rate by Type <span className="text-sky-500">({getChartPeriodTitle()})</span></h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[
                  {
                    name: 'Inborn',
                    rate: chartFilteredPatients.filter(p => p.admissionType === 'Inborn').length > 0
                      ? ((chartStats.inbornDeaths ?? 0) / chartFilteredPatients.filter(p => p.admissionType === 'Inborn').length * 100).toFixed(1)
                      : 0
                  },
                  {
                    name: 'Outborn',
                    rate: chartFilteredPatients.filter(p => p.admissionType === 'Outborn').length > 0
                      ? ((chartStats.outbornDeaths ?? 0) / chartFilteredPatients.filter(p => p.admissionType === 'Outborn').length * 100).toFixed(1)
                      : 0
                  }
                ]} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 10 }} label={{ value: 'Mortality Rate (%)', position: 'bottom', style: { fill: '#94a3b8', fontSize: '11px' } }} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '12px' }} formatter={(value) => `${value}%`} />
                  <Bar dataKey="rate" fill="#ef4444" radius={[0, 8, 8, 0]}>
                    {[{ fill: '#a855f7' }, { fill: '#f59e0b' }].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg">
              <div className="text-xs text-blue-300">Inborn Admissions</div>
              <div className="text-xl md:text-2xl font-bold text-blue-400">{chartFilteredPatients.filter(p => p.admissionType === 'Inborn').length}</div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg">
              <div className="text-xs text-blue-300">Inborn Deaths</div>
              <div className="text-xl md:text-2xl font-bold text-red-400">{chartStats.inbornDeaths ?? 0}</div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-lg">
              <div className="text-xs text-orange-300">Outborn Admissions</div>
              <div className="text-xl md:text-2xl font-bold text-orange-400">{chartFilteredPatients.filter(p => p.admissionType === 'Outborn').length}</div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-lg">
              <div className="text-xs text-orange-300">Outborn Deaths</div>
              <div className="text-xl md:text-2xl font-bold text-red-400">{chartStats.outbornDeaths ?? 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* PICU Specific Under-5 Mortality */}
      {selectedUnit === Unit.PICU && stats.under5Total !== undefined && (
        <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 transition-colors duration-200">
          <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">👶</span>
            PICU Under-5 Mortality Analysis
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Under-5 Statistics */}
            <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg transition-colors duration-200">
              <h4 className="text-sm md:text-base font-semibold text-slate-700 dark:text-slate-300 mb-3">Under-5 Years Patient Statistics</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <span className="text-sm text-blue-300">Total Under-5 Patients</span>
                  <span className="text-xl md:text-2xl font-bold text-blue-400">{stats.under5Total}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <span className="text-sm text-red-300">Under-5 Deaths</span>
                  <span className="text-xl md:text-2xl font-bold text-red-400">{stats.under5Deaths}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <span className="text-sm text-blue-300">Under-5 Mortality Rate</span>
                  <span className="text-2xl font-bold text-blue-400">{stats.under5MortalityRate}</span>
                </div>
              </div>
            </div>

            {/* Comparison Chart */}
            <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg transition-colors duration-200">
              <h4 className="text-sm md:text-base font-semibold text-slate-700 dark:text-slate-300 mb-3">Under-5 vs Overall Mortality</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[
                  {
                    name: 'Under-5',
                    patients: stats.under5Total,
                    deaths: stats.under5Deaths
                  },
                  {
                    name: 'Overall',
                    patients: stats.total,
                    deaths: stats.deceased
                  }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="patients" name="Total Patients" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="deaths" name="Deaths" fill="#ef4444" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 text-center">
                Under-5 represents {((stats.under5Total / stats.total) * 100).toFixed(1)}% of total PICU patients
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg">
              <div className="text-xs text-blue-300">Under-5 Patients</div>
              <div className="text-xl md:text-2xl font-bold text-blue-400">{stats.under5Total}</div>
              <div className="text-xs text-blue-300/70 mt-1">{((stats.under5Total / stats.total) * 100).toFixed(1)}% of total</div>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg">
              <div className="text-xs text-red-300">Under-5 Deaths</div>
              <div className="text-xl md:text-2xl font-bold text-red-400">{stats.under5Deaths}</div>
              <div className="text-xs text-red-300/70 mt-1">{stats.under5MortalityRate} mortality</div>
            </div>
            <div className="bg-green-500/10 border border-green-500/30 p-3 rounded-lg">
              <div className="text-xs text-green-300">Under-5 Survived</div>
              <div className="text-xl md:text-2xl font-bold text-green-400">{stats.under5Total - stats.under5Deaths}</div>
              <div className="text-xs text-green-300/70 mt-1">{(((stats.under5Total - stats.under5Deaths) / stats.under5Total) * 100).toFixed(1)}% survival</div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg">
              <div className="text-xs text-blue-300">Age Groups</div>
              <div className="text-sm md:text-base font-bold text-blue-400">Days, Weeks, Months, Years &lt;5</div>
              <div className="text-xs text-blue-300/70 mt-1">All included</div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      <div className="space-y-6">
        <BedOccupancy patients={unitPatients} bedCapacity={bedCapacity} />
        <TimeBasedAnalytics patients={unitPatients} />
      </div>

      {/* View All Patients Button */}
      <div className="flex justify-center my-8">
        <button
          onClick={() => setShowPatientDetailsPage(true)}
          className="flex items-center gap-3 bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white px-8 py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl text-lg font-semibold"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          View All Patients
        </button>
      </div>

      {selectedPatientForAI && (
        <AIClinicalAssistant
          patient={selectedPatientForAI}
          onClose={() => setSelectedPatientForAI(null)}
          allPatients={patients}
        />
      )}

      {isFormOpen && institutionId && institutionName && userEmail && (
        <PatientForm
          patientToEdit={patientToEdit}
          onSave={handleSavePatient}
          onClose={() => setIsFormOpen(false)}
          userRole={userRole}
          defaultUnit={selectedUnit}
          institutionId={institutionId}
          institutionName={institutionName}
          userEmail={userEmail}
        />
      )}

      {isDetailsOpen && patientToView && (
        <PatientDetailModal
          patient={patientToView}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}

      {showRiskMonitoring && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-6xl my-4">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowRiskMonitoring(false)}
                className="text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors"
              >
                ✕ Close
              </button>
            </div>
            <RiskMonitoringPanel patients={unitPatients} unit={selectedUnit} />
          </div>
        </div>
      )}

      {showSmartHandoff && institutionName && (
        <SmartHandoff
          patients={unitPatients}
          unit={selectedUnit}
          onClose={() => setShowSmartHandoff(false)}
        />
      )}

      {showAIReportGenerator && institutionName && (
        <AIReportGenerator
          patients={unitPatients}
          unit={selectedUnit}
          institutionName={institutionName}
          onClose={() => setShowAIReportGenerator(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;
