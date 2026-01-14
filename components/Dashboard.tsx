import React, { useState, useMemo, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { db } from '../firebaseConfig';
import { Patient, Unit, UserRole, AdmissionType, BedCapacity } from '../types';
import StatCard from './StatCard';
import PatientList from './PatientList';
import UnitSelection from './UnitSelection';
import PatientViewPage from './PatientViewPage';
import PatientFilters, { OutcomeFilter } from './PatientFilters';
import CollapsiblePatientCard from './CollapsiblePatientCard';
import TimeBasedAnalytics from './TimeBasedAnalytics';
import BedOccupancy from './BedOccupancy';
import AIClinicalAssistant from './AIClinicalAssistant';
import SmartHandoff from './SmartHandoff';
import AIReportGenerator from './AIReportGenerator';
import NeolinkAIButton from './NeolinkAIButton';
import { BedIcon, ArrowRightOnRectangleIcon, ChartBarIcon, PlusIcon, HomeIcon, ArrowUpOnSquareIcon, PresentationChartBarIcon, ArrowUpIcon, SparklesIcon } from './common/Icons';
import { ResponsiveContainer, Tooltip, Legend, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import NicuViewSelection from './NicuViewSelection';
import DateFilter, { DateFilterValue } from './DateFilter';
import ShiftFilter, { ShiftFilterConfigs } from './ShiftFilter';
import DeathsAnalysis from './DeathsAnalysis';
import DeathAnalyticsPage from './DeathAnalyticsPage';
import { MobileAnalyticsView } from './analytics';
import PatientDetailsPage from './PatientDetailsPage';
import ReferralInbox from './ReferralInbox';
import AdvancedAnalytics from './AdvancedAnalytics';

// Native Android Components
import PullToRefresh from './gestures/PullToRefresh';
import FAB from './material/FAB';
import BottomSheet from './material/BottomSheet';
import BottomNavigation, { NavItem } from './material/BottomNavigation';
import DashboardSkeleton from './skeletons/DashboardSkeleton';
import { haptics } from '../utils/haptics';
import { IconHome, IconChartBar, IconUsers, IconSettings, IconPlus } from '@tabler/icons-react';
import GlobalAIChatWidget from './GlobalAIChatWidget';
import { useChatContext } from '../contexts/ChatContext';
import AddPatientChoiceModal from './AddPatientChoiceModal';
import ObservationPatientForm from './ObservationPatientForm';
import { ObservationPatient, ObservationOutcome } from '../types';

interface DashboardProps {
  userRole: UserRole;
  institutionId?: string; // SuperAdmin doesn't have institutionId
  institutionName?: string; // SuperAdmin doesn't have institutionName
  userEmail?: string; // User email for tracking
  displayName?: string; // User's display name for welcome message
  allowedDashboards?: Unit[]; // Dashboards user can access (PICU, NICU, SNCU, HDU, GENERAL_WARD)
  allRoles?: UserRole[]; // All roles the user has for multi-role support
  setShowSuperAdminPanel?: (show: boolean) => void; // For SuperAdmin dashboard access
  setShowAdminPanel?: (show: boolean) => void; // For Admin dashboard access
  onShowReferrals?: () => void; // For switching to full Referral Management page
  onShowAddPatient?: (patient?: Patient | null, unit?: Unit) => void; // For navigating to Add Patient page
  showPatientList: boolean;
  setShowPatientList: (show: boolean) => void;
  triggerAnalyticsScroll?: number;
  triggerQuickActions?: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const Dashboard: React.FC<DashboardProps> = ({
  userRole,
  institutionId,
  institutionName,
  userEmail,
  displayName,
  allowedDashboards,
  allRoles,
  setShowSuperAdminPanel,
  setShowAdminPanel,
  onShowReferrals,
  onShowAddPatient,
  showPatientList,
  setShowPatientList,
  triggerAnalyticsScroll,
  triggerQuickActions
}) => {
  // Map props to internal names to avoid refactoring everything
  const showPatientDetailsPage = showPatientList;
  const setShowPatientDetailsPage = setShowPatientList;
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

  // State declarations FIRST (before using them in handlers)
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [bedCapacity, setBedCapacity] = useState<BedCapacity | undefined>(undefined);
  const [enabledFacilities, setEnabledFacilities] = useState<Unit[]>([Unit.NICU, Unit.PICU, Unit.SNCU]); // Default to all
  const [selectedUnit, setSelectedUnit] = useState<Unit>(Unit.NICU);
  const [nicuView, setNicuView] = useState<'All' | 'Inborn' | 'Outborn'>('All');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ period: 'Today' });
  const [shiftFilter, setShiftFilter] = useState<ShiftFilterConfigs>({
    enabled: false,
    startTime: '08:00',
    endTime: '20:00'
  });
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('All');

  // REMOVED separate chart filter - charts now use main dateFilter for consistency

  const [showDeathsAnalysis, setShowDeathsAnalysis] = useState(false);
  const [showMobileAnalytics, setShowMobileAnalytics] = useState(false);
  const [showSmartHandoff, setShowSmartHandoff] = useState(false);
  const [showAIReportGenerator, setShowAIReportGenerator] = useState(false);

  const [showReferralInbox, setShowReferralInbox] = useState(false);
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(true); // Enable by default for world-class UX
  const [unreadReferrals, setUnreadReferrals] = useState(0);

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null);
  const [patientToView, setPatientToView] = useState<Patient | null>(null);
  const [showPatientViewPage, setShowPatientViewPage] = useState(false);
  const [selectedPatientForAI, setSelectedPatientForAI] = useState<Patient | null>(null);

  // Native Android Features State
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState('dashboard');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add Patient Choice Modal
  const [showAddPatientChoice, setShowAddPatientChoice] = useState(false);
  const [showObservationForm, setShowObservationForm] = useState(false);

  // Observation Patients
  const [observationPatients, setObservationPatients] = useState<ObservationPatient[]>([]);

  // Chat context for AI widget
  const { updateContext } = useChatContext();

  // Handle back navigation from patient view page
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (showPatientViewPage) {
        setShowPatientViewPage(false);
        setPatientToView(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showPatientViewPage]);

  // Pull to Refresh Handler
  const handleRefresh = async () => {
    console.log('🔄 Refreshing data...');
    haptics.impact();
    setIsRefreshing(true);

    // Simulate refresh - in real app, this would refetch data
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Data is automatically refreshed via real-time listener
    setIsRefreshing(false);
    haptics.success();
  };

  // Bottom Navigation Items (after state is declared)
  const bottomNavItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <IconHome size={24} />,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <IconChartBar size={24} />,
    },
    {
      id: 'patients',
      label: 'Patients',
      icon: <IconUsers size={24} />,
    },
    {
      id: 'more',
      label: 'More',
      icon: <IconSettings size={24} />,
      badge: unreadReferrals > 0 ? unreadReferrals : undefined,
    },
  ];

  // Handle Bottom Navigation
  const handleNavItemClick = (id: string) => {
    setActiveNavItem(id);
    haptics.selection();

    switch (id) {
      case 'dashboard':
        setShowAdvancedAnalytics(false);
        setShowPatientDetailsPage(false);
        setShowQuickActions(false);
        break;
      case 'analytics':
        setShowAdvancedAnalytics(true);
        setShowPatientDetailsPage(false);
        setShowQuickActions(false);
        // Scroll to analytics section
        setTimeout(() => {
          const analyticsElement = document.querySelector('[data-analytics-section]');
          if (analyticsElement) {
            analyticsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
        break;
      case 'patients':
        setShowPatientDetailsPage(true);
        setShowAdvancedAnalytics(false);
        setShowQuickActions(false);
        break;
      case 'more':
        setShowQuickActions(true);
        break;
      default:
        setShowAdvancedAnalytics(false);
    }
  };

  // Scroll to analytics section when triggered from bottom nav
  useEffect(() => {
    if (triggerAnalyticsScroll && triggerAnalyticsScroll > 0) {
      setShowAdvancedAnalytics(true);
      setTimeout(() => {
        const analyticsSection = document.querySelector('[data-analytics-section]');
        if (analyticsSection) {
          analyticsSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [triggerAnalyticsScroll]);

  // Open Quick Actions when triggered from bottom nav
  useEffect(() => {
    console.log('🔘 Dashboard: triggerQuickActions effect changed:', triggerQuickActions);
    if (triggerQuickActions && triggerQuickActions > 0) {
      console.log('🔘 Dashboard: Opening Quick Actions');
      setShowQuickActions(true);
    }
  }, [triggerQuickActions]);

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
          setBedCapacity({ PICU: 10, NICU: 20, SNCU: 0 });
        }

        if (data.facilities && data.facilities.length > 0) {
          let facilitiesToEnable = data.facilities;

          // Filter by user's allowed dashboards if specified
          if (allowedDashboards && allowedDashboards.length > 0) {
            facilitiesToEnable = data.facilities.filter((facility: Unit) =>
              allowedDashboards.includes(facility)
            );
            console.log('🔒 Dashboard access restricted to:', allowedDashboards);
          }

          setEnabledFacilities(facilitiesToEnable);

          // Ensure selected unit is valid
          if (!facilitiesToEnable.includes(selectedUnit)) {
            setSelectedUnit(facilitiesToEnable[0] || Unit.NICU);
          }
          console.log('✅ Loaded facilities:', facilitiesToEnable);
        } else {
          // Default to NICU+PICU if not set (backward compatibility)
          let defaultFacilities = [Unit.NICU, Unit.PICU];

          // Filter defaults by allowedDashboards if specified
          if (allowedDashboards && allowedDashboards.length > 0) {
            defaultFacilities = defaultFacilities.filter(facility =>
              allowedDashboards.includes(facility)
            );
          }

          setEnabledFacilities(defaultFacilities);
        }
      }
    } catch (error: any) {
      console.error('❌ Error loading bed capacity:', error);
      setBedCapacity({ PICU: 10, NICU: 20 }); // Fallback to defaults
    }
  };

  // Load observation patients from Firestore with real-time updates
  useEffect(() => {
    if (!institutionId) {
      setObservationPatients([]);
      return;
    }

    const observationRef = collection(db, 'observationPatients');
    const q = query(observationRef, where('institutionId', '==', institutionId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allObservationPatients = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
        } as ObservationPatient));

        setObservationPatients(allObservationPatients);
        console.log('✅ Real-time update: Loaded', allObservationPatients.length, 'observation patients');
      },
      (error) => {
        console.error('❌ Error loading observation patients:', error);
        setObservationPatients([]);
      }
    );

    return () => unsubscribe();
  }, [institutionId]);

  // Real-time listener for unread referrals
  useEffect(() => {
    if (!institutionId) {
      setUnreadReferrals(0);
      return;
    }

    const q = query(
      collection(db, 'referrals'),
      where('toInstitutionId', '==', institutionId),
      where('isRead', '==', false),
      where('status', '==', 'Pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadReferrals(snapshot.size);
    });

    return () => unsubscribe();
  }, [institutionId]);

  // Update chat context when dashboard state changes
  useEffect(() => {
    updateContext({
      currentPage: 'dashboard',
      selectedUnit,
      activeFilters: {
        unit: selectedUnit,
        outcome: outcomeFilter !== 'All' ? outcomeFilter : undefined,
        dateRange: dateFilter.startDate && dateFilter.endDate
          ? { start: dateFilter.startDate, end: dateFilter.endDate }
          : undefined,
      },
      visibleData: {
        patientCount: patients.length,
      },
    });
  }, [selectedUnit, outcomeFilter, dateFilter, patients.length, updateContext]);

  // Base patients filtered only by unit/institution (NO date filter) - used for charts
  const baseUnitPatients = useMemo(() => {
    let baseFiltered = institutionId
      ? patients.filter(p => p.institutionId === institutionId && p.unit === selectedUnit)
      : patients.filter(p => p.unit === selectedUnit);

    if (selectedUnit === Unit.NICU && nicuView !== 'All') {
      if (nicuView === 'Outborn') {
        baseFiltered = baseFiltered.filter(p => p.admissionType?.includes('Outborn'));
      } else {
        baseFiltered = baseFiltered.filter(p => p.admissionType === nicuView);
      }
    }

    return baseFiltered;
  }, [patients, selectedUnit, nicuView, institutionId]);

  const unitPatients = useMemo(() => {
    console.log('🔍 ========================================');
    console.log('🔍 FILTERING PATIENTS');
    console.log('🔍 dateFilter.period:', dateFilter.period);
    console.log('🔍 dateFilter.startDate:', dateFilter.startDate);
    console.log('🔍 dateFilter.endDate:', dateFilter.endDate);
    console.log('🔍 dateFilter full object:', JSON.stringify(dateFilter));
    console.log('🔍 baseUnitPatients count:', baseUnitPatients.length);

    let filtered = baseUnitPatients;

    if (dateFilter.period !== 'All Time') {
      let startDate: Date;
      let endDate: Date;

      const periodIsMonth = /\d{4}-\d{2}/.test(dateFilter.period);
      console.log('🔍 periodIsMonth:', periodIsMonth, 'tested against:', dateFilter.period);

      if (periodIsMonth) {
        const [year, month] = dateFilter.period.split('-').map(Number);
        // Use local timezone, not UTC, to match patient date comparisons
        startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
        endDate = new Date(year, month, 0, 23, 59, 59, 999);
        console.log('🔍 MONTH FILTER:', dateFilter.period);
        console.log('🔍 Start Date:', startDate.toISOString(), '(local:', startDate.toString(), ')');
        console.log('🔍 End Date:', endDate.toISOString(), '(local:', endDate.toString(), ')');
      } else {
        console.log('🔍 Not a month filter, checking period type:', dateFilter.period);
        const now = new Date();
        switch (dateFilter.period) {
          case 'Today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            console.log('🔍 TODAY filter - Start:', startDate, 'End:', endDate);
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
            if (!dateFilter.startDate || !dateFilter.endDate) {
              startDate = new Date(0); // Should keep baseFiltered if invalid custom range? Actually just fail open or closed.
              // Logic below says "return baseFiltered" if invalid.
              // Let's just set a wide range or handle "return filtered" early.
            } else {
              startDate = new Date(dateFilter.startDate);
              startDate.setHours(0, 0, 0, 0);
              endDate = new Date(dateFilter.endDate);
              endDate.setHours(23, 59, 59, 999);
            }
            break;
          default:
            startDate = new Date(0);
            endDate = new Date(); // Just to satisfy TS
            break;
        }
      }

      if (dateFilter.period === 'Custom' && (!dateFilter.startDate || !dateFilter.endDate)) {
        console.log('🔍 Invalid custom range, keeping all patients');
        // Do nothing, filtered stays as baseFiltered
      } else {
        console.log('🔍 Applying date filter to', filtered.length, 'patients');
        console.log('🔍 Filter range: START=', startDate, 'END=', endDate);

        let includedCount = 0;
        let excludedCount = 0;

        filtered = filtered.filter(p => {
          const admissionDate = new Date(p.admissionDate);

          // Check if patient was active at ANY point during the selected period
          // A patient is considered active if:
          // 1. They were admitted before or during the period, AND
          // 2. They were either still in care OR discharged/referred/deceased during or after the period

          const wasAdmittedBeforeOrDuringPeriod = admissionDate <= endDate;

          // Get the outcome/release date
          let outcomeDate: Date | null = null;
          if (p.releaseDate) {
            outcomeDate = new Date(p.releaseDate);
          } else if (p.finalDischargeDate) {
            outcomeDate = new Date(p.finalDischargeDate);
          } else if (p.stepDownDate && p.outcome === 'Step Down') {
            outcomeDate = new Date(p.stepDownDate);
          }

          // Patient is active during period if:
          // - Admitted before/during period AND
          // - (Still in progress OR outcome happened during/after period start)
          const wasActiveDuringPeriod = wasAdmittedBeforeOrDuringPeriod &&
            (!outcomeDate || outcomeDate >= startDate);

          if (!wasActiveDuringPeriod) {
            excludedCount++;
            console.log('🔍 EXCLUDED:', p.name,
              'Admitted:', admissionDate.toISOString(),
              'Outcome:', outcomeDate ? outcomeDate.toISOString() : 'None',
              'Period:', startDate.toISOString(), 'to', endDate.toISOString());
          } else {
            includedCount++;
            console.log('✅ INCLUDED:', p.name,
              'Admitted:', admissionDate.toISOString(),
              'Outcome:', outcomeDate ? outcomeDate.toISOString() : 'In Progress');
          }

          return wasActiveDuringPeriod;
        });
        console.log('🔍 After date filter:', filtered.length, 'patients remain (included:', includedCount, ', excluded:', excludedCount, ')');
      }
    }

    // Apply Shift Filter if enabled
    if (shiftFilter.enabled && shiftFilter.startTime && shiftFilter.endTime) {
      filtered = filtered.filter(p => {
        // Determine the relevant date/time for the patient based on their outcome
        let eventDate: Date;

        if (p.outcome === 'Discharged' && (p.releaseDate || p.finalDischargeDate)) {
          eventDate = new Date(p.finalDischargeDate || p.releaseDate!);
        } else if (p.outcome === 'Step Down' && p.stepDownDate) {
          eventDate = new Date(p.stepDownDate);
        } else if (p.outcome === 'Referred' && p.releaseDate) {
          eventDate = new Date(p.releaseDate);
        } else if (p.outcome === 'Deceased' && p.releaseDate) {
          eventDate = new Date(p.releaseDate);
        } else {
          // Default to admission date for 'In Progress' or others
          eventDate = new Date(p.admissionDate);
        }

        const eventTime = eventDate.getHours() * 60 + eventDate.getMinutes();
        const [startHour, startMinute] = shiftFilter.startTime.split(':').map(Number);
        const [endHour, endMinute] = shiftFilter.endTime.split(':').map(Number);
        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;

        if (startTime <= endTime) {
          // Day shift (e.g. 08:00 to 20:00)
          return eventTime >= startTime && eventTime <= endTime;
        } else {
          // Night shift (e.g. 20:00 to 08:00) - spans midnight
          return eventTime >= startTime || eventTime <= endTime;
        }
      });
    }

    console.log('🔍 FINAL RESULT:', filtered.length, 'patients after all filters');
    console.log('🔍 ========================================');
    return filtered;
  }, [baseUnitPatients, dateFilter, shiftFilter]);

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

    // Calculate new admissions in this period
    const newAdmissions = unitPatients.filter(p => {
      // Filter logic already handles date range for unitPatients, so just check if admission date is within range if needed
      // But unitPatients is already filtered by the main period.
      return true;
    }).length; // This is same as total for unitPatients based on current filter logic, effectively.
    // Wait, unitPatients logic filters by *active* status during period, not just admission.
    // We want specifically NEW admissions during this period.

    const admissionsCount = unitPatients.filter(p => {
      if (dateFilter.period === 'All Time') return true;
      const admissionDate = new Date(p.admissionDate);
      let startDate: Date;
      let endDate: Date;

      // Re-calculate dates for specific admission check (since unitPatients includes active-but-admitted-earlier)
      // Ideally we should move the date calculation/parsing out to a helper
      // reusing the date filter logic roughly:
      const now = new Date();
      if (/\d{4}-\d{2}/.test(dateFilter.period)) {
        const [year, month] = dateFilter.period.split('-').map(Number);
        // Use local timezone, not UTC, to match patient date comparisons
        startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
        endDate = new Date(year, month, 0, 23, 59, 59, 999);
      } else if (dateFilter.period === 'Today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      } else if (dateFilter.period === 'This Week') {
        const firstDayOfWeek = new Date(now);
        firstDayOfWeek.setDate(now.getDate() - now.getDay());
        startDate = new Date(firstDayOfWeek.getFullYear(), firstDayOfWeek.getMonth(), firstDayOfWeek.getDate());
        const lastDayOfWeek = new Date(firstDayOfWeek);
        lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
        endDate = new Date(lastDayOfWeek.getFullYear(), lastDayOfWeek.getMonth(), lastDayOfWeek.getDate(), 23, 59, 59, 999);
      } else if (dateFilter.period === 'This Month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      } else if (dateFilter.period === 'Custom' && dateFilter.startDate && dateFilter.endDate) {
        startDate = new Date(dateFilter.startDate);
        endDate = new Date(dateFilter.endDate);
        endDate.setHours(23, 59, 59, 999);
      } else {
        return true;
      }
      return admissionDate >= startDate && admissionDate <= endDate;
    }).length;

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

    if (selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) {
      const inbornDeaths = unitPatients.filter(p => p.outcome === 'Deceased' && p.admissionType === 'Inborn').length;
      const outbornDeaths = unitPatients.filter(p => p.outcome === 'Deceased' && p.admissionType?.includes('Outborn')).length;
      const inbornTotal = unitPatients.filter(p => p.admissionType === 'Inborn').length;
      const outbornTotal = unitPatients.filter(p => p.admissionType?.includes('Outborn')).length;
      const inbornMortalityRate = inbornTotal > 0 ? ((inbornDeaths / inbornTotal) * 100).toFixed(1) + '%' : '0%';
      const outbornMortalityRate = outbornTotal > 0 ? ((outbornDeaths / outbornTotal) * 100).toFixed(1) + '%' : '0%';

      return {
        total, deceased, discharged, referred, inProgress, stepDown,
        mortalityRate: mortalityPercentage, dischargeRate: dischargePercentage, referralRate: referralPercentage,
        inProgressPercentage, stepDownPercentage,
        inbornDeaths, outbornDeaths, inbornMortalityRate, outbornMortalityRate, admissionsCount
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
        inProgressPercentage, stepDownPercentage, admissionsCount,
        under5Deaths, under5Total, under5MortalityRate
      };
    }

    return {
      total, deceased, discharged, referred, inProgress, stepDown, admissionsCount,
      mortalityRate: mortalityPercentage, dischargeRate: dischargePercentage, referralRate: referralPercentage,
      inProgressPercentage, stepDownPercentage
    };
  }, [unitPatients, selectedUnit]);

  // Active observation patients filtered by selected unit AND date filter
  const activeObservationPatients = useMemo(() => {
    let filtered = observationPatients.filter(p =>
      p.unit === selectedUnit &&
      p.outcome === ObservationOutcome.InObservation
    );

    // Apply date filter
    if (dateFilter.period !== 'All Time') {
      let startDate: Date;
      let endDate: Date;

      const periodIsMonth = /\d{4}-\d{2}/.test(dateFilter.period);

      if (periodIsMonth) {
        const [year, month] = dateFilter.period.split('-').map(Number);
        startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
        endDate = new Date(year, month, 0, 23, 59, 59, 999);
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
            if (!dateFilter.startDate || !dateFilter.endDate) {
              startDate = new Date(0);
              endDate = new Date();
            } else {
              startDate = new Date(dateFilter.startDate);
              startDate.setHours(0, 0, 0, 0);
              endDate = new Date(dateFilter.endDate);
              endDate.setHours(23, 59, 59, 999);
            }
            break;
          default:
            startDate = new Date(0);
            endDate = new Date();
            break;
        }
      }

      if (dateFilter.period === 'Custom' && (!dateFilter.startDate || !dateFilter.endDate)) {
        // Keep filtered as is
      } else {
        filtered = filtered.filter(p => {
          const observationDate = new Date(p.dateOfObservation);

          // Check if patient was in observation during the selected period
          const wasInObservationDuringPeriod = observationDate <= endDate;

          // Get the outcome/release date
          let outcomeDate: Date | null = null;
          if (p.dischargedAt) {
            outcomeDate = new Date(p.dischargedAt);
          }

          // Patient is active during period if:
          // - Started observation before/during period AND
          // - (Still in observation OR outcome happened during/after period start)
          const wasActiveDuringPeriod = wasInObservationDuringPeriod &&
            (!outcomeDate || outcomeDate >= startDate);

          return wasActiveDuringPeriod;
        });
      }
    }

    return filtered;
  }, [observationPatients, selectedUnit, dateFilter]);

  const nicuMortalityBreakdown = useMemo(() => {
    if ((selectedUnit !== Unit.NICU && selectedUnit !== Unit.SNCU) || !stats.inbornDeaths || !stats.outbornDeaths) return [];
    return [
      { name: 'Inborn', value: stats.inbornDeaths },
      { name: 'Outborn', value: stats.outbornDeaths }
    ].filter(item => item.value > 0);
  }, [selectedUnit, stats]);

  // Charts now use unitPatients (same as stats) for consistency - controlled by main dateFilter
  const chartFilteredPatients = unitPatients;

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
      const outbornDeaths = chartFilteredPatients.filter(p => p.outcome === 'Deceased' && p.admissionType?.includes('Outborn')).length;

      return {
        total, deceased, discharged, referred, inProgress, stepDown,
        inbornDeaths, outbornDeaths
      };
    }

    return {
      total, deceased, discharged, referred, inProgress, stepDown
    };
  }, [chartFilteredPatients, selectedUnit]);

  // Helper function to get the chart period title for display (uses main dateFilter)
  const getChartPeriodTitle = () => {
    return getPeriodTitle(dateFilter.period).replace(/[()]/g, '').trim() || 'All Time';
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
    if (onShowAddPatient) {
      onShowAddPatient(null, selectedUnit);
    }
  };

  const handleEditPatient = (patient: Patient) => {
    if (onShowAddPatient) {
      onShowAddPatient(patient);
    }
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
    setShowPatientViewPage(true);
    // Push state to handle back button
    window.history.pushState({ patientView: true }, '');
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



  // Mobile Analytics View (swipeable cards for mobile)
  if (showMobileAnalytics) {
    return (
      <MobileAnalyticsView
        patients={patients}
        allPatients={patients}
        institutionName={institutionName || 'Unknown Institution'}
        onClose={() => setShowMobileAnalytics(false)}
      />
    );
  }

  // Desktop Deaths Analysis Page
  if (showDeathsAnalysis) {
    return (
      <DeathAnalyticsPage
        patients={patients}
        institutionName={institutionName || 'Unknown Institution'}
        selectedUnit={selectedUnit}
        onClose={() => setShowDeathsAnalysis(false)}
        userRole={userRole}
      />
    );
  }

  // Show full-page patient view instead of modal (professional layout)
  // This must come BEFORE showPatientDetailsPage check
  if (showPatientViewPage && patientToView) {
    return (
      <PatientViewPage
        patient={patientToView}
        onBack={() => {
          setShowPatientViewPage(false);
          setPatientToView(null);
          window.history.back();
        }}
        onEdit={handleEditPatient}
        canEdit={hasRole(UserRole.Doctor) || hasRole(UserRole.Nurse)}
        userEmail={userEmail || ''}
        userName={displayName || userEmail?.split('@')[0] || 'User'}
        userRole={userRole}
        onPatientUpdate={async (updatedPatient) => {
          // Update patient in Firestore
          if (updatedPatient.id) {
            const patientRef = doc(db, 'patients', updatedPatient.id);
            await updateDoc(patientRef, { ...updatedPatient });
            // Update local state
            setPatientToView(updatedPatient);
          }
        }}
      />
    );
  }

  if (showPatientDetailsPage) {
    return (
      <PatientDetailsPage
        patients={patients}
        selectedUnit={selectedUnit}
        onBack={() => setShowPatientDetailsPage(false)}
        onViewDetails={handleViewDetails}
        onEdit={handleEditPatient}
        userRole={userRole}
        allRoles={allRoles}
        observationPatients={observationPatients}
        institutionId={institutionId}
        onPatientsDeleted={() => {
          // Real-time listener will automatically refresh patients
          console.log('✅ Patients deleted - real-time listener will update');
        }}
        onConvertObservationToAdmission={(observationPatient) => {
          // Open patient form pre-filled with observation data
          setShowPatientDetailsPage(false);
          if (onShowAddPatient) {
            const now = new Date().toISOString();
            const partialPatient: Partial<Patient> = {
              name: observationPatient.babyName,
              motherName: observationPatient.motherName,
              dateOfBirth: observationPatient.dateOfBirth,
              unit: observationPatient.unit,
              admissionType: observationPatient.admissionType || 'Inborn',
              institutionId: observationPatient.institutionId,
              admissionDate: now,
              admissionDateTime: now,
              outcome: 'In Progress',
            };
            onShowAddPatient(partialPatient as Patient, observationPatient.unit);
          }
        }}
      />
    );
  }

  // Show loading state with native skeleton
  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="container mx-auto px-0 sm:px-6 py-2 sm:py-6 space-y-4 sm:space-y-6 pb-24 md:pb-6">
          <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 px-2 sm:px-6 py-3 sm:py-4 border-b-2 border-slate-200 dark:border-slate-700 shadow-xl transition-all duration-200 mb-3 sm:mb-6 space-y-3 rounded-b-xl sm:rounded-b-2xl">

            {/* Welcome Message */}
            {displayName && (
              <motion.div
                className="text-center mb-2"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 25 }}
              >
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                  Welcome, <span className="text-medical-teal bg-gradient-to-r from-medical-teal to-blue-600 bg-clip-text text-transparent">{displayName}</span>!
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mt-1">
                  {institutionName || 'Healthcare Management'}
                </p>
              </motion.div>
            )}

            {/* Row 1: Unit Selection & Date Display Badge (Mobile) */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <UnitSelection
                selectedUnit={selectedUnit}
                onSelectUnit={setSelectedUnit}
                availableUnits={enabledFacilities}
              />
              {selectedUnit === Unit.NICU && (
                <>
                  <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 hidden sm:block"></div>
                  <NicuViewSelection selectedView={nicuView} onSelectView={setNicuView} />
                </>
              )}
              {/* Mobile Date Badge */}
              <div className="flex sm:hidden items-center gap-1 bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg text-[10px] font-semibold">
                <span>📅</span>
                <span>
                  {dateFilter.period === 'Custom' && dateFilter.startDate && dateFilter.endDate
                    ? `${new Date(dateFilter.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(dateFilter.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : dateFilter.period === 'Today'
                      ? new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                      : dateFilter.period === 'This Week'
                        ? 'This Week'
                        : dateFilter.period === 'This Month'
                          ? new Date().toLocaleDateString('en-US', { month: 'long' })
                          : 'All Time'}
                </span>
              </div>
            </div>

            {/* Row 2: Quick Actions - Hidden on mobile, visible on desktop */}
            {/* Mobile: Info message to use "More" menu */}
            <div className="flex md:hidden items-center justify-center">
              <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Tap ⚙️ More for all actions</span>
              </div>
            </div>

            {/* Desktop: Full action buttons grid */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-2">
              {/* Admin Dashboard - Only show for Admin role users */}
              {userRole === UserRole.Admin && setShowAdminPanel && (
                <button
                  onClick={() => {
                    haptics.tap();
                    setShowAdminPanel(true);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Admin
                </button>
              )}

              {(hasRole(UserRole.Admin) || hasRole(UserRole.Doctor)) && (
                <button
                  onClick={() => {
                    haptics.tap();
                    // Check if mobile (screen width < 768px)
                    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
                    if (isMobile) {
                      setShowMobileAnalytics(true);
                    } else {
                      setShowDeathsAnalysis(true);
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Mortality Analytics
                </button>
              )}

              {(hasRole(UserRole.Admin) || hasRole(UserRole.Doctor)) && (
                <button
                  onClick={() => {
                    haptics.tap();
                    setShowSmartHandoff(true);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Handoff
                </button>
              )}

              {(hasRole(UserRole.Admin) || hasRole(UserRole.Doctor)) && (
                <button
                  onClick={() => {
                    haptics.tap();
                    setShowAIReportGenerator(true);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Reports
                </button>
              )}

              <button
                onClick={() => {
                  haptics.tap();
                  if (onShowReferrals) {
                    onShowReferrals();
                  }
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold text-sm relative"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Referrals
                {unreadReferrals > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadReferrals}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  haptics.tap();
                  setShowPatientDetailsPage(true);
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg hover:from-slate-700 hover:to-slate-800 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                All Patients
              </button>

              <button
                onClick={() => {
                  haptics.tap();
                  setShowAddPatientChoice(true);
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Add Patient
              </button>

              <button
                onClick={() => {
                  haptics.tap();
                  setShowQuickActions(true);
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg hover:from-cyan-600 hover:to-cyan-700 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Filters & Settings
              </button>
            </div>

            {/* Row 3: Filters - Date & Shift */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <DateFilter onFilterChange={setDateFilter} />
              <ShiftFilter onFilterChange={setShiftFilter} />
            </div>

          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-2 sm:gap-3 md:gap-4 px-2 sm:px-0">
            <StatCard title={`Admissions ${getPeriodTitle(dateFilter.period)}`} value={stats.admissionsCount} icon={<PlusIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />} color="bg-indigo-500/90" />
            <StatCard title={`Total Patients ${getPeriodTitle(dateFilter.period)}`} value={stats.total} icon={<BedIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />} color="bg-medical-blue/90" />
            <StatCard title={`In Progress ${getPeriodTitle(dateFilter.period)}`} value={stats.inProgress} icon={<BedIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />} color="bg-medical-blue-light/90" />
            <StatCard title={`Step Down ${getPeriodTitle(dateFilter.period)}`} value={stats.stepDown} icon={<ArrowUpIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />} color="bg-blue-500/90" />
            <StatCard title={`Discharged ${getPeriodTitle(dateFilter.period)}`} value={stats.discharged} icon={<ArrowRightOnRectangleIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />} color="bg-medical-green/90" />
            <StatCard title={`Referred ${getPeriodTitle(dateFilter.period)}`} value={stats.referred} icon={<ArrowUpOnSquareIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />} color="bg-medical-orange/90" />
            <StatCard title={`Deceased ${getPeriodTitle(dateFilter.period)}`} value={stats.deceased} icon={<ChartBarIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />} color="bg-medical-red/90" />
            <StatCard title={`Mortality Rate ${getPeriodTitle(dateFilter.period)}`} value={stats.mortalityRate} icon={<ChartBarIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />} color="bg-medical-red" />
            <StatCard
              title="In Observation"
              value={activeObservationPatients.length}
              icon={
                <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              }
              color="bg-amber-500/90"
            />
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

          {/* Advanced Analytics Toggle & Section */}
          <div className="flex items-center justify-between mb-4" data-analytics-section>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <span className="text-3xl">📊</span>
              Analytics Dashboard
            </h2>
            <button
              onClick={() => setShowAdvancedAnalytics(!showAdvancedAnalytics)}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all duration-200 flex items-center gap-2 shadow-lg ${showAdvancedAnalytics
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600'
                : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600'
                }`}
            >
              {showAdvancedAnalytics ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Advanced View
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Basic View
                </>
              )}
            </button>
          </div>

          {showAdvancedAnalytics ? (
            /* World-Class Advanced Analytics */
            <AdvancedAnalytics
              patients={unitPatients}
              selectedUnit={selectedUnit}
              dateFilter={dateFilter}
            />
          ) : (
            /* Basic Analytics - Original Charts */
            <>
              <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 transition-colors duration-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="text-2xl">📊</span>
                    Mortality Analysis vs Total Admissions
                  </h3>
                  <NeolinkAIButton
                    chartTitle="Mortality Analysis vs Total Admissions"
                    chartType="bar chart"
                    dataPoints={[
                      { label: 'Total Admissions', value: chartStats.total },
                      { label: 'Deceased', value: chartStats.deceased },
                      { label: 'Survived', value: chartStats.total - chartStats.deceased },
                      { label: 'Mortality Rate', value: chartStats.total > 0 ? ((chartStats.deceased / chartStats.total) * 100).toFixed(1) + '%' : '0%' }
                    ]}
                    context={`${selectedUnit} mortality analysis for ${getChartPeriodTitle()}`}
                  />
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

              {/* NICU/SNCU Specific Mortality Breakdown */}
              {(selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) && (
                <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 transition-colors duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="text-2xl">🏥</span>
                      {selectedUnit} Mortality: Inborn vs Outborn Analysis <span className="text-sky-500 text-base">({getChartPeriodTitle()})</span>
                    </h3>
                    <NeolinkAIButton
                      chartTitle={`${selectedUnit} Inborn vs Outborn Mortality Analysis`}
                      chartType="comparison bar chart"
                      dataPoints={[
                        { label: 'Inborn Admissions', value: chartFilteredPatients.filter(p => p.admissionType === 'Inborn').length },
                        { label: 'Inborn Deaths', value: chartStats.inbornDeaths ?? 0 },
                        { label: 'Outborn Admissions', value: chartFilteredPatients.filter(p => p.admissionType === 'Outborn').length },
                        { label: 'Outborn Deaths', value: chartStats.outbornDeaths ?? 0 }
                      ]}
                      context={`Comparing inborn vs outborn mortality in ${selectedUnit} for ${getChartPeriodTitle()}`}
                    />
                  </div>

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
            </>
          )}

          {/* Analytics Tab - Always Show These */}
          <div className="space-y-6">
            <TimeBasedAnalytics
              patients={unitPatients}
              period={dateFilter.period}
              startDate={dateFilter.startDate}
              endDate={dateFilter.endDate}
            />
            <BedOccupancy patients={unitPatients} bedCapacity={bedCapacity} availableUnits={enabledFacilities} observationPatients={observationPatients} nicuView={nicuView} />
          </div>


          {/* View All Patients Button */}


          {selectedPatientForAI && (
            <AIClinicalAssistant
              patient={selectedPatientForAI}
              onClose={() => setSelectedPatientForAI(null)}
              allPatients={patients}
            />
          )}

          {/* Patient view is now handled by full-page PatientViewPage */}



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

          {showReferralInbox && institutionId && institutionName && userEmail && (
            <ReferralInbox
              institutionId={institutionId}
              institutionName={institutionName}
              userEmail={userEmail}
              userRole={userRole}
              userName={userEmail.split('@')[0] || 'User'}
              onBack={() => setShowReferralInbox(false)}
            />
          )}
        </div>
      </PullToRefresh>

      {/* Filter Bottom Sheet */}
      <BottomSheet
        isOpen={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        title="Filters & Options"
      >
        <div className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-slate-900 mb-2">Date Filter</h3>
            <DateFilter
              value={dateFilter}
              onChange={setDateFilter}
            />
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-2">Outcome Filter</h3>
            <PatientFilters
              value={outcomeFilter}
              onChange={setOutcomeFilter}
            />
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-2">Shift Filter</h3>
            <ShiftFilter
              value={shiftFilter}
              onChange={setShiftFilter}
            />
          </div>

          <button
            onClick={() => {
              setShowFilterSheet(false);
              haptics.success();
            }}
            className="w-full bg-medical-teal text-white py-3 rounded-lg font-semibold"
          >
            Apply Filters
          </button>
        </div>
      </BottomSheet>

      {/* Quick Actions Bottom Sheet - All actions in one place */}
      <BottomSheet
        isOpen={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        title="Quick Actions"
      >
        <div className="p-6 space-y-3">
          {/* Admin Dashboard - Only show for Admin role users */}
          {userRole === UserRole.Admin && setShowAdminPanel && (
            <button
              onClick={() => {
                setShowAdminPanel(true);
                setShowQuickActions(false);
                haptics.tap();
              }}
              className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg hover:bg-blue-600 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Admin Dashboard
            </button>
          )}

          {/* Deaths Analysis */}
          {(hasRole(UserRole.Admin) || hasRole(UserRole.Doctor)) && (
            <button
              onClick={() => {
                haptics.tap();
                setShowQuickActions(false);
                // Check if mobile (screen width < 768px)
                const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
                if (isMobile) {
                  setShowMobileAnalytics(true);
                } else {
                  setShowDeathsAnalysis(true);
                }
              }}
              className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg hover:bg-blue-600 transition-all"
            >
              <ChartBarIcon className="w-5 h-5" />
              Mortality Analytics
            </button>
          )}

          {/* Smart Handoff */}
          {(hasRole(UserRole.Doctor) || hasRole(UserRole.Nurse)) && (
            <button
              onClick={() => {
                setShowSmartHandoff(true);
                setShowQuickActions(false);
                haptics.tap();
              }}
              className="w-full bg-emerald-500 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg hover:bg-emerald-600 transition-all"
            >
              📝 Smart Handoff
            </button>
          )}

          {/* AI Report Generator */}
          {hasRole(UserRole.Admin) && (
            <button
              onClick={() => {
                setShowAIReportGenerator(true);
                setShowQuickActions(false);
                haptics.tap();
              }}
              className="w-full bg-violet-500 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg hover:bg-violet-600 transition-all"
            >
              📊 AI Reports
            </button>
          )}

          {/* Referrals */}
          {(hasRole(UserRole.Doctor) || hasRole(UserRole.Admin)) && (
            <button
              onClick={() => {
                onShowReferrals ? onShowReferrals() : setShowReferralInbox(true);
                setShowQuickActions(false);
                haptics.tap();
              }}
              className="w-full bg-cyan-500 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg hover:bg-cyan-600 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Referrals {unreadReferrals > 0 && `(${unreadReferrals})`}
            </button>
          )}

          {/* All Patients */}
          <button
            onClick={() => {
              setShowPatientDetailsPage(true);
              setShowQuickActions(false);
              haptics.tap();
            }}
            className="w-full bg-slate-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg hover:bg-slate-700 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            All Patients
          </button>

          {/* Filters & Settings */}
          <button
            onClick={() => {
              setShowFilterSheet(true);
              setShowQuickActions(false);
              haptics.tap();
            }}
            className="w-full bg-purple-500 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg hover:bg-purple-600 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters & Settings
          </button>
        </div>
      </BottomSheet>

      {/* Floating Action Button (Mobile Only) - Add Patient */}
      {(hasRole(UserRole.Doctor) || hasRole(UserRole.Nurse)) && (
        <FAB
          icon={<IconPlus size={24} />}
          label="Add Patient"
          onClick={() => {
            haptics.impact();
            setShowAddPatientChoice(true);
          }}
          extended={false}
          className="md:hidden !bottom-20"
        />
      )}

      {/* Global AI Chat Widget */}
      <GlobalAIChatWidget patients={filteredPatients} />

      {/* Add Patient Choice Modal */}
      <AddPatientChoiceModal
        isOpen={showAddPatientChoice}
        onClose={() => setShowAddPatientChoice(false)}
        onSelectAdmission={() => {
          setShowAddPatientChoice(false);
          if (onShowAddPatient) {
            onShowAddPatient(null, selectedUnit);
          }
        }}
        onSelectObservation={() => {
          setShowAddPatientChoice(false);
          setShowObservationForm(true);
        }}
        selectedUnit={selectedUnit}
      />

      {/* Observation Patient Form */}
      {showObservationForm && (
        <ObservationPatientForm
          onClose={() => setShowObservationForm(false)}
          onSuccess={() => {
            // Refresh data
            handleRefresh();
          }}
          selectedUnit={selectedUnit}
          institutionId={institutionId || ''}
          userEmail={userEmail || ''}
        />
      )}


      {/* Persistent Mobile Bottom App Bar - Removed, using SharedBottomNav in App.tsx */}
    </>
  );
};

export default Dashboard;
