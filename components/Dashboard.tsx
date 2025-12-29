import React, { useState, useMemo, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Patient, Unit, UserRole, AdmissionType } from '../types';
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
  const [selectedUnit, setSelectedUnit] = useState<Unit>(Unit.NICU);
  const [nicuView, setNicuView] = useState<'All' | 'Inborn' | 'Outborn'>('All');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ period: 'This Month' });
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('All');
  const [showSummary, setShowSummary] = useState(false);
  const [showDeathsAnalysis, setShowDeathsAnalysis] = useState(false);
  const [showRiskMonitoring, setShowRiskMonitoring] = useState(false);
  const [showSmartHandoff, setShowSmartHandoff] = useState(false);
  const [showAIReportGenerator, setShowAIReportGenerator] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null);
  const [patientToView, setPatientToView] = useState<Patient | null>(null);
  const [selectedPatientForAI, setSelectedPatientForAI] = useState<Patient | null>(null);

  // Load patients from Firestore
  useEffect(() => {
    loadPatients();
  }, [institutionId]);

  const loadPatients = async () => {
    if (!institutionId) {
      // SuperAdmin without institution - show no patients
      setPatients([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('📊 Loading patients for institution:', institutionId);

      // Query top-level patients collection filtered by institutionId
      const patientsRef = collection(db, 'patients');
      const q = query(
        patientsRef,
        where('institutionId', '==', institutionId)
      );

      const snapshot = await getDocs(q);
      const allPatients = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      } as Patient));

      setPatients(allPatients);
      console.log('✅ Loaded patients:', allPatients.length);
    } catch (error: any) {
      console.error('❌ Error loading patients:', error);
      console.error('Failed to load patient data:', error.message);
      setPatients([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const unitPatients = useMemo(() => {
    // Filter by institution first (if user is not SuperAdmin)
    let baseFiltered = institutionId
      ? patients.filter(p => p.institutionId === institutionId && p.unit === selectedUnit)
      : patients.filter(p => p.unit === selectedUnit);

    if (selectedUnit === Unit.NICU && nicuView !== 'All') {
      baseFiltered = baseFiltered.filter(p => p.admissionType === nicuView);
    }

    if (dateFilter.period === 'All Time') {
      return baseFiltered;
    }

    let startDate: Date;
    let endDate: Date;

    const periodIsMonth = /\d{4}-\d{2}/.test(dateFilter.period);

    if (periodIsMonth) {
      const [year, month] = dateFilter.period.split('-').map(Number);
      startDate = new Date(year, month - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(year, month, 0); // Last day of the given month
      endDate.setHours(23, 59, 59, 999);
    } else {
      const now = new Date();
      switch (dateFilter.period) {
        case 'Today':
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date();
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'This Week':
          const firstDayOfWeek = new Date(now);
          firstDayOfWeek.setDate(now.getDate() - now.getDay()); // Assuming Sunday is the first day
          startDate = new Date(firstDayOfWeek);
          startDate.setHours(0, 0, 0, 0);

          const lastDayOfWeek = new Date(firstDayOfWeek);
          lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
          endDate = new Date(lastDayOfWeek);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'This Month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'Custom':
          if (!dateFilter.startDate || !dateFilter.endDate) return baseFiltered; // Don't filter if range is incomplete
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
      return admissionDate >= startDate && admissionDate <= endDate;
    });
  }, [patients, selectedUnit, nicuView, dateFilter, institutionId]);

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
    try {
      if (!institutionId) {
        alert('Institution ID is required to save patient data');
        return;
      }

      if (patientToEdit) {
        // Update existing patient in top-level patients collection
        const patientRef = doc(db, 'patients', patientToEdit.id);
        await updateDoc(patientRef, { ...patientData });
        console.log('✅ Patient updated in Firestore:', patientData.id);
      } else {
        // Add new patient to top-level patients collection
        const patientsRef = collection(db, 'patients');
        const docRef = await addDoc(patientsRef, patientData);
        console.log('✅ Patient added to Firestore:', docRef.id);
      }

      // Reload patients from Firestore
      await loadPatients();
      setIsFormOpen(false);
      setPatientToEdit(null);
    } catch (error: any) {
      console.error('❌ Error saving patient:', error);
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

      // Reload patients from Firestore
      await loadPatients();
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

      // Reload patients from Firestore
      await loadPatients();
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

      // Reload patients from Firestore
      await loadPatients();
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

  // Show loading state
  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto mb-4"></div>
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
            <button onClick={() => setShowAIReportGenerator(true)} className="flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-semibold text-sm sm:text-base min-h-[44px]">
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
            <button onClick={() => setShowSuperAdminPanel(true)} className="flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-semibold">
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
        <StatCard title={`Step Down ${getPeriodTitle(dateFilter.period)}`} value={stats.stepDown} icon={<ArrowUpIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />} color="bg-purple-500/90" />
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Mortality vs Admissions Bar Chart */}
          <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg transition-colors duration-200">
            <h4 className="text-sm md:text-base font-semibold text-slate-700 dark:text-slate-300 mb-3">Mortality vs Total Admissions</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={[
                { name: 'Total Admissions', value: stats.total, fill: '#3b82f6' },
                { name: 'Deceased', value: stats.deceased, fill: '#ef4444' },
                { name: 'Survived', value: stats.total - stats.deceased, fill: '#10b981' }
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
              Mortality Rate: <span className="text-red-400 font-bold">{stats.mortalityRate}</span> ({stats.deceased}/{stats.total})
            </div>
          </div>

          {/* Outcome Breakdown Pie Chart */}
          <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg transition-colors duration-200">
            <h4 className="text-sm md:text-base font-semibold text-slate-700 dark:text-slate-300 mb-3">Patient Outcomes Distribution</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'In Progress', value: stats.inProgress, fill: '#3b82f6' },
                    { name: 'Step Down', value: stats.stepDown, fill: '#a855f7' },
                    { name: 'Discharged', value: stats.discharged, fill: '#10b981' },
                    { name: 'Referred', value: stats.referred, fill: '#f59e0b' },
                    { name: 'Deceased', value: stats.deceased, fill: '#ef4444' }
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
              Total Patients: <span className="text-cyan-400 font-bold">{stats.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* NICU Specific Mortality Breakdown */}
      {selectedUnit === Unit.NICU && (
        <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 transition-colors duration-200">
          <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">🏥</span>
            NICU Mortality: Inborn vs Outborn Analysis
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Inborn vs Outborn Admissions & Deaths */}
            <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg transition-colors duration-200">
              <h4 className="text-sm md:text-base font-semibold text-slate-700 dark:text-slate-300 mb-3">Admissions & Mortality Comparison</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[
                  {
                    name: 'Inborn',
                    admissions: unitPatients.filter(p => p.admissionType === 'Inborn').length,
                    deaths: stats.inbornDeaths ?? 0
                  },
                  {
                    name: 'Outborn',
                    admissions: unitPatients.filter(p => p.admissionType === 'Outborn').length,
                    deaths: stats.outbornDeaths ?? 0
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
              <h4 className="text-sm md:text-base font-semibold text-slate-700 dark:text-slate-300 mb-3">Mortality Rate by Type</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[
                  {
                    name: 'Inborn',
                    rate: unitPatients.filter(p => p.admissionType === 'Inborn').length > 0
                      ? ((stats.inbornDeaths ?? 0) / unitPatients.filter(p => p.admissionType === 'Inborn').length * 100).toFixed(1)
                      : 0
                  },
                  {
                    name: 'Outborn',
                    rate: unitPatients.filter(p => p.admissionType === 'Outborn').length > 0
                      ? ((stats.outbornDeaths ?? 0) / unitPatients.filter(p => p.admissionType === 'Outborn').length * 100).toFixed(1)
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
            <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded-lg">
              <div className="text-xs text-purple-300">Inborn Admissions</div>
              <div className="text-xl md:text-2xl font-bold text-purple-400">{unitPatients.filter(p => p.admissionType === 'Inborn').length}</div>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded-lg">
              <div className="text-xs text-purple-300">Inborn Deaths</div>
              <div className="text-xl md:text-2xl font-bold text-red-400">{stats.inbornDeaths ?? 0}</div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-lg">
              <div className="text-xs text-orange-300">Outborn Admissions</div>
              <div className="text-xl md:text-2xl font-bold text-orange-400">{unitPatients.filter(p => p.admissionType === 'Outborn').length}</div>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-lg">
              <div className="text-xs text-orange-300">Outborn Deaths</div>
              <div className="text-xl md:text-2xl font-bold text-red-400">{stats.outbornDeaths ?? 0}</div>
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
                <div className="flex justify-between items-center p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <span className="text-sm text-purple-300">Under-5 Mortality Rate</span>
                  <span className="text-2xl font-bold text-purple-400">{stats.under5MortalityRate}</span>
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
            <div className="bg-purple-500/10 border border-purple-500/30 p-3 rounded-lg">
              <div className="text-xs text-purple-300">Age Groups</div>
              <div className="text-sm md:text-base font-bold text-purple-400">Days, Weeks, Months, Years &lt;5</div>
              <div className="text-xs text-purple-300/70 mt-1">All included</div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      <div className="space-y-6">
        <BedOccupancy patients={unitPatients} />
        <TimeBasedAnalytics patients={unitPatients} />
      </div>

      {/* Status Filter - Right before Patient Records */}
      <PatientFilters
        selectedOutcome={outcomeFilter}
        onOutcomeChange={setOutcomeFilter}
        counts={{
          all: unitPatients.length,
          inProgress: stats.inProgress,
          discharged: stats.discharged,
          referred: stats.referred,
          deceased: stats.deceased,
          stepDown: stats.stepDown
        }}
      />

      {/* Patient Cards Section */}
      <div className="bg-white/50 dark:bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-200 dark:border-slate-700/50 transition-colors duration-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Patient Records</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Showing {filteredPatients.length} of {unitPatients.length} patients
              {outcomeFilter !== 'All' && ` • Filtered by: ${outcomeFilter}`}
            </p>
          </div>
        </div>

        {filteredPatients.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">No patients found</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {outcomeFilter !== 'All'
                ? `No patients with status "${outcomeFilter}" in the selected period`
                : 'No patients match the current filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPatients.map(patient => (
              <CollapsiblePatientCard
                key={patient.id}
                patient={patient}
                onEdit={handleEditPatient}
                onView={handleViewDetails}
                canEdit={hasRole(UserRole.Doctor)}
              >
                <div className="flex items-center space-x-4 mt-2">
                  <button
                    onClick={() => handleViewDetails(patient)} // Re-using handleViewDetails for consistency
                    className="text-cyan-600 hover:text-cyan-900 dark:text-cyan-400 dark:hover:text-cyan-300 font-medium"
                  >
                    View Details
                  </button>
                  {(hasRole(UserRole.Doctor) || hasRole(UserRole.Admin)) && (
                    <button
                      onClick={() => setSelectedPatientForAI(patient)}
                      className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 font-medium flex items-center gap-1"
                      title="AI Clinical Assistant"
                    >
                      <SparklesIcon className="w-4 h-4" />
                      AI Assistant
                    </button>
                  )}
                </div>
              </CollapsiblePatientCard>
            ))}
          </div>
        )}
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