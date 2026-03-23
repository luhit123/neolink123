import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import NeolinkAIButton from './NeolinkAIButton';
import { BedIcon, ArrowRightOnRectangleIcon, ChartBarIcon, PlusIcon, HomeIcon, ArrowUpOnSquareIcon, PresentationChartBarIcon, ArrowUpIcon, SparklesIcon } from './common/Icons';
import { ResponsiveContainer, Tooltip, Legend, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import NicuViewSelection from './NicuViewSelection';
import DateFilter, { DateFilterValue } from './DateFilter';
import DeathsAnalysis from './DeathsAnalysis';
import DeathAnalyticsPage from './DeathAnalyticsPage';

import PatientDetailsPage from './PatientDetailsPage';
import ReferralInbox from './ReferralInbox';
import AdvancedAnalytics from './AdvancedAnalytics';

// Native Android Components
import BottomSheet from './material/BottomSheet';
import BottomNavigation, { NavItem } from './material/BottomNavigation';
import DashboardSkeleton from './skeletons/DashboardSkeleton';
import { haptics } from '../utils/haptics';
import { getFormattedAge } from '../utils/ageCalculator';
import { IconHome, IconChartBar, IconUsers, IconSettings, IconUserPlus } from '@tabler/icons-react';
import { useChatContext } from '../contexts/ChatContext';
import AddPatientChoiceModal from './AddPatientChoiceModal';
import AddPatientFAB from './AddPatientFAB';
import ObservationPatientForm from './ObservationPatientForm';
import { ObservationPatient, ObservationOutcome } from '../types';

// Supabase sync for hybrid architecture
import { syncPatientToSupabase, deletePatientSync } from '../services/supabaseSyncService';
import {
  getCanonicalAdmissionType,
  getCanonicalOutcome,
  isPatientActiveDuringRange,
  isPatientAdmittedWithinRange,
  matchesAdmissionTypeFilter,
} from '../utils/analytics';
import { getOperationalDateRange } from '../utils/dateRanges';

// Helper to convert Firestore Timestamp to ISO string
const timestampToISO = (value: any): string | undefined => {
  if (!value) return undefined;
  // Firestore Timestamp object
  if (value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  // Already a string
  if (typeof value === 'string') {
    return value;
  }
  // JavaScript Date object
  if (value instanceof Date) {
    return value.toISOString();
  }
  // Firestore Timestamp-like object with seconds/nanoseconds
  if (value && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }
  return undefined;
};

// Convert all date fields in a patient document from Firestore Timestamps to ISO strings
const convertPatientDates = (data: any): any => {
  return {
    ...data,
    admissionDate: timestampToISO(data.admissionDate) || data.admissionDate,
    admissionDateTime: timestampToISO(data.admissionDateTime) || data.admissionDateTime,
    releaseDate: timestampToISO(data.releaseDate),
    dischargeDateTime: timestampToISO(data.dischargeDateTime),
    dateOfBirth: timestampToISO(data.dateOfBirth),
    stepDownDate: timestampToISO(data.stepDownDate),
    finalDischargeDate: timestampToISO(data.finalDischargeDate),
    createdAt: timestampToISO(data.createdAt),
    lastEditedAt: timestampToISO(data.lastEditedAt),
  };
};

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
  onShowAnalytics?: () => void; // For navigating to dedicated analytics page
  onShowAIReports?: () => void; // For navigating to AI Reports page
  showPatientList: boolean;
  setShowPatientList: (show: boolean) => void;
  triggerAnalyticsScroll?: number;
  triggerQuickActions?: number;
  doctors?: string[]; // List of doctors for dropdown selection
  onUnitChange?: (unit: Unit) => void; // Callback when unit changes
  onFacilitiesLoaded?: (facilities: Unit[]) => void; // Callback when facilities are loaded
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
  onShowAnalytics,
  onShowAIReports,
  showPatientList,
  setShowPatientList,
  triggerAnalyticsScroll,
  triggerQuickActions,
  doctors = [],
  onUnitChange,
  onFacilitiesLoaded
}) => {
  // Map props to internal names to avoid refactoring everything
  const showPatientDetailsPage = showPatientList;
  const setShowPatientDetailsPage = setShowPatientList;
  // Helper function to check if user has a specific role
  const hasRole = (role: UserRole) => {
    return userRole === role || (allRoles && allRoles.includes(role));
  };

  // Debug logging disabled in production for performance
  // Enable only when debugging role issues by uncommenting below:
  // console.log('📋 Dashboard Roles:', { userRole, allRoles });

  // Robust date parsing helper that prioritize admissionDateTime and handles various formats
  const parseSafeDate = (dateVal: any, timeVal?: string): Date | null => {
    if (!dateVal) return null;
    try {
      // If it's already an ISO string with time (T00:00:00), new Date() handles it
      const date = new Date(dateVal);
      if (isNaN(date.getTime())) return null;

      // If we have a separate time value and the dateVal is just a date string
      if (timeVal && !dateVal.includes('T')) {
        const [hours, minutes] = timeVal.split(':').map(Number);
        date.setHours(hours, minutes, 0, 0);
      }
      return date;
    } catch (e) {
      return null;
    }
  };

  // Shared date-range logic used across dashboard and registry
  const getShiftAwareRange = (period: string, customDates?: { startDate?: string; endDate?: string }) =>
    getOperationalDateRange(period, institutionShiftStartTime, customDates);

  // State declarations FIRST (before using them in handlers)
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [bedCapacity, setBedCapacity] = useState<BedCapacity | undefined>(undefined);
  const [enabledFacilities, setEnabledFacilities] = useState<Unit[]>([Unit.NICU, Unit.PICU, Unit.SNCU]); // Default to all

  // Initialize selectedUnit from localStorage or default to NICU
  const [selectedUnit, setSelectedUnit] = useState<Unit>(() => {
    try {
      const savedUnit = localStorage.getItem('selectedUnit');
      if (savedUnit && Object.values(Unit).includes(savedUnit as Unit)) {
        return savedUnit as Unit;
      }
    } catch (error) {
      console.warn('Failed to read selectedUnit from localStorage:', error);
    }
    return Unit.NICU;
  });
  const [nicuView, setNicuView] = useState<'All' | 'Inborn' | 'Outborn'>('Inborn');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ period: 'Today' });
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('All');
  const [institutionShiftStartTime, setInstitutionShiftStartTime] = useState<string>('00:00');

  const selectedDateRange = useMemo(() => {
    if (dateFilter.period === 'All Time') return null;
    if (dateFilter.period === 'Custom' && (!dateFilter.startDate || !dateFilter.endDate)) return null;

    return getShiftAwareRange(dateFilter.period, {
      startDate: dateFilter.startDate,
      endDate: dateFilter.endDate
    });
  }, [dateFilter, institutionShiftStartTime]);

  // Time-based refresh trigger - updates every minute to recalculate time-sensitive stats
  // Also refreshes when user returns to the app/tab
  const [timeRefreshTrigger, setTimeRefreshTrigger] = useState(Date.now());
  useEffect(() => {
    // Periodic refresh every minute
    const interval = setInterval(() => {
      setTimeRefreshTrigger(Date.now());
    }, 60000);

    // Refresh when tab becomes visible again (user returns to app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeRefreshTrigger(Date.now());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // REMOVED separate chart filter - charts now use main dateFilter for consistency

  const [showDeathsAnalysis, setShowDeathsAnalysis] = useState(false);

  const [showSmartHandoff, setShowSmartHandoff] = useState(false);

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

  // Observation Patients - Active ones loaded by default, history loaded on demand
  const [observationPatients, setObservationPatients] = useState<ObservationPatient[]>([]);
  const [observationHistory, setObservationHistory] = useState<ObservationPatient[]>([]);
  const [loadingObservationHistory, setLoadingObservationHistory] = useState(false);
  const [observationHistoryLoaded, setObservationHistoryLoaded] = useState(false);

  // Chat context for AI widget
  const { updateContext } = useChatContext();

  // Handle back navigation from patient view page
  // Use a ref to track state for the event handler
  const showPatientViewPageRef = useRef(showPatientViewPage);
  useEffect(() => {
    showPatientViewPageRef.current = showPatientViewPage;
  }, [showPatientViewPage]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (showPatientViewPageRef.current) {
        console.log('Dashboard: Handling back from patient view -> patient list');
        event.stopImmediatePropagation();
        event.preventDefault();
        setShowPatientViewPage(false);
        setPatientToView(null);
        // Re-push history state for patient list so back button works correctly
        // This ensures: patientView -> patientList -> dashboard (not patientView -> dashboard)
        window.history.pushState({ page: 'patientList' }, '', window.location.pathname);
        // Mark that we handled this popstate so App.tsx doesn't also handle it
        (window as any).__patientViewBackHandled = true;
        setTimeout(() => {
          (window as any).__patientViewBackHandled = false;
        }, 100);
      }
    };

    // Use capture phase to run before App.tsx's handler
    window.addEventListener('popstate', handlePopState, true);
    return () => window.removeEventListener('popstate', handlePopState, true);
  }, []);

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
        window.history.pushState({ page: 'patientList' }, '', window.location.pathname);
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
        const allPatients = snapshot.docs.map(doc => {
          const data = doc.data();
          // Convert Firestore Timestamps to ISO strings for proper form handling
          const convertedData = convertPatientDates(data);
          return {
            ...convertedData,
            id: doc.id,
          } as Patient;
        });

        setPatients(allPatients);
        setLoading(false);
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
        if (data.shiftStartTime) {
          setInstitutionShiftStartTime(data.shiftStartTime);
        } else {
          setInstitutionShiftStartTime('00:00');
        }

        if (data.bedCapacity) {
          setBedCapacity(data.bedCapacity);
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
          }

          setEnabledFacilities(facilitiesToEnable);
          // Notify parent of facilities loaded
          if (onFacilitiesLoaded) {
            onFacilitiesLoaded(facilitiesToEnable);
          }

          // Ensure selected unit is valid
          if (!facilitiesToEnable.includes(selectedUnit)) {
            const newUnit = facilitiesToEnable[0] || Unit.NICU;
            setSelectedUnit(newUnit);
            if (onUnitChange) {
              onUnitChange(newUnit);
            }
            // Save to localStorage
            try {
              localStorage.setItem('selectedUnit', newUnit);
            } catch (error) {
              console.warn('Failed to save selectedUnit to localStorage:', error);
            }
          }
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
          // Notify parent of facilities loaded
          if (onFacilitiesLoaded) {
            onFacilitiesLoaded(defaultFacilities);
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Error loading bed capacity:', error);
      setBedCapacity({ PICU: 10, NICU: 20 }); // Fallback to defaults
    }
  };

  // Load ONLY active observation patients from Firestore (outcome = InObservation)
  useEffect(() => {
    if (!institutionId) {
      setObservationPatients([]);
      return;
    }

    const observationRef = collection(db, 'observationPatients');
    // Only query for active observations - completed ones are loaded on demand
    const q = query(
      observationRef,
      where('institutionId', '==', institutionId),
      where('outcome', '==', ObservationOutcome.InObservation)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const now = new Date();
        const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours
        const activeObservations: ObservationPatient[] = [];

        snapshot.docs.forEach(docSnap => {
          const data = { ...docSnap.data(), id: docSnap.id } as ObservationPatient;
          const observationDate = new Date(data.dateOfObservation);
          const ageMs = now.getTime() - observationDate.getTime();

          if (ageMs > STALE_THRESHOLD_MS) {
            // Auto-close stale observation patients (older than 48 hours)
            console.warn(`⚠️ Auto-closing stale observation patient: ${data.babyName} (${data.id}) - in observation for ${Math.round(ageMs / (1000 * 60 * 60))}h`);
            const obsRef = doc(db, 'observationPatients', data.id);
            deleteDoc(obsRef).catch(err => console.error('❌ Failed to auto-delete stale observation:', err));
          } else {
            activeObservations.push(data);
          }
        });

        setObservationPatients(activeObservations);
      },
      (error) => {
        console.error('❌ Error loading observation patients:', error);
        setObservationPatients([]);
      }
    );

    return () => unsubscribe();
  }, [institutionId]);

  // Function to load observation history on demand
  const loadObservationHistory = async () => {
    if (!institutionId || observationHistoryLoaded || loadingObservationHistory) return;

    setLoadingObservationHistory(true);
    try {
      const observationRef = collection(db, 'observationPatients');
      const q = query(
        observationRef,
        where('institutionId', '==', institutionId),
        where('outcome', 'in', [ObservationOutcome.HandedOverToMother, ObservationOutcome.ConvertedToAdmission])
      );

      const snapshot = await getDocs(q);
      const historyPatients = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      } as ObservationPatient));

      // Sort by most recent completion first
      historyPatients.sort((a, b) => {
        const dateA = a.dischargedAt ? new Date(a.dischargedAt).getTime() : 0;
        const dateB = b.dischargedAt ? new Date(b.dischargedAt).getTime() : 0;
        return dateB - dateA;
      });

      setObservationHistory(historyPatients);
      setObservationHistoryLoaded(true);
      console.log('✅ Loaded', historyPatients.length, 'observation history records');
    } catch (error) {
      console.error('❌ Error loading observation history:', error);
    } finally {
      setLoadingObservationHistory(false);
    }
  };

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

    // Apply Inborn/Outborn filter for NICU and SNCU.
    // In "All" mode, exclude unknown admission types so totals equal Inborn + Outborn.
    // EXCEPTION: Step Down patients are ALWAYS kept — they are no longer in the
    // unit but must remain visible in the Step Down panel regardless of admission type.
    if (selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) {
      if (nicuView !== 'All') {
        baseFiltered = baseFiltered.filter(p =>
          getCanonicalOutcome(p) === 'Step Down' || matchesAdmissionTypeFilter(p, nicuView)
        );
      } else {
        baseFiltered = baseFiltered.filter(p =>
          getCanonicalOutcome(p) === 'Step Down' || getCanonicalAdmissionType(p) !== 'Unknown'
        );
      }
    }

    return baseFiltered;
  }, [patients, selectedUnit, nicuView, institutionId]);

  const unitPatients = useMemo(() => {
    let filtered = baseUnitPatients;

    if (selectedDateRange) {
      const { startDate, endDate } = selectedDateRange;
      filtered = filtered.filter(p => {
        return isPatientActiveDuringRange(p, { startDate, endDate });
      });
    }

    return filtered;
  }, [baseUnitPatients, selectedDateRange]);

  const admissionCohortPatients = useMemo(() => {
    if (!selectedDateRange) return baseUnitPatients;
    return baseUnitPatients.filter(p => isPatientAdmittedWithinRange(p, selectedDateRange));
  }, [baseUnitPatients, selectedDateRange]);

  // Step Down patients — sourced from baseUnitPatients (NOT date-filtered unitPatients)
  // so that a baby stepped down 3 days ago remains visible even if the date
  // range picker is set to "Today".  Sorted most-recently-stepped-down first.
  const stepDownPatients = useMemo(() =>
    baseUnitPatients
      .filter(p => getCanonicalOutcome(p) === 'Step Down')
      .sort((a, b) => {
        const dateA = new Date(a.stepDownDate || a.admissionDate).getTime();
        const dateB = new Date(b.stepDownDate || b.admissionDate).getTime();
        return dateB - dateA;
      }),
    [baseUnitPatients]
  );

  // Apply outcome filter
  const filteredPatients = useMemo(() => {
    const outcomeOf = (patient: Patient) => getCanonicalOutcome(patient);

    if (outcomeFilter === 'All') return unitPatients;
    if (outcomeFilter === 'In Progress') {
      // In Progress includes patients with no outcome, empty outcome, or explicit 'In Progress'
      return unitPatients.filter(p => outcomeOf(p) === 'In Progress');
    }
    return unitPatients.filter(p => outcomeOf(p) === outcomeFilter);
  }, [unitPatients, outcomeFilter]);

  // Active observation patients filtered by selected unit AND date filter AND Inborn/Outborn view
  const activeObservationPatients = useMemo(() => {
    let filtered = observationPatients.filter(p =>
      p.unit === selectedUnit &&
      p.outcome === ObservationOutcome.InObservation
    );

    if ((selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) && nicuView !== 'All') {
      filtered = filtered.filter(p => matchesAdmissionTypeFilter(p as unknown as Partial<Patient>, nicuView));
    } else if (selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) {
      filtered = filtered.filter(p => {
        const normalized = String(p.admissionType || '').trim().toLowerCase();
        return normalized.includes('inborn') || normalized.includes('outborn');
      });
    }

    if (dateFilter.period !== 'All Time') {
      const { startDate, endDate } = getShiftAwareRange(dateFilter.period, {
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate
      });

      if (dateFilter.period !== 'Custom' || (dateFilter.startDate && dateFilter.endDate)) {
        filtered = filtered.filter(p => {
          const observationDate = new Date(p.dateOfObservation);
          const wasInObservationDuringPeriod = observationDate <= endDate;

          let outcomeDate: Date | null = null;
          if (p.dischargedAt) {
            outcomeDate = new Date(p.dischargedAt);
          }

          return wasInObservationDuringPeriod && (!outcomeDate || outcomeDate >= startDate);
        });
      }
    }

    return filtered;
  }, [observationPatients, selectedUnit, dateFilter, nicuView, institutionShiftStartTime]);

  const stats = useMemo(() => {
    const outcomeOf = (patient: Patient) => getCanonicalOutcome(patient);
    const admissionTypeOf = (patient: Patient) => getCanonicalAdmissionType(patient);

    const total = unitPatients.length;
    const deceased = unitPatients.filter(p => outcomeOf(p) === 'Deceased').length;
    const discharged = unitPatients.filter(p => outcomeOf(p) === 'Discharged').length;
    const referred = unitPatients.filter(p => outcomeOf(p) === 'Referred').length;
    // In Progress includes patients with no outcome, empty outcome, or explicit 'In Progress'
    const inProgress = unitPatients.filter(p => outcomeOf(p) === 'In Progress').length;
    const stepDown = unitPatients.filter(p => outcomeOf(p) === 'Step Down').length;

    const inObservation = activeObservationPatients.length;
    // Active card is an operational view: admitted in-progress + current observations.
    const patientsInCare = inProgress + inObservation;

    // "New Admissions" should follow the selected admission cohort, not the
    // active-during-period overlap set used for occupancy/outcome metrics.
    const todayNewAdmissions = baseUnitPatients.filter(p =>
      isPatientAdmittedWithinRange(p, getShiftAwareRange('Today'))
    ).length;
    const admissionsCount = selectedDateRange
      ? admissionCohortPatients.length
      : baseUnitPatients.length;


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
      const inbornDeaths = unitPatients.filter(p => outcomeOf(p) === 'Deceased' && admissionTypeOf(p) === 'Inborn').length;
      const outbornDeaths = unitPatients.filter(p => outcomeOf(p) === 'Deceased' && admissionTypeOf(p) === 'Outborn').length;
      const inbornTotal = unitPatients.filter(p => admissionTypeOf(p) === 'Inborn').length;
      const outbornTotal = unitPatients.filter(p => admissionTypeOf(p) === 'Outborn').length;
      const inbornMortalityRate = inbornTotal > 0 ? ((inbornDeaths / inbornTotal) * 100).toFixed(1) + '%' : '0%';
      const outbornMortalityRate = outbornTotal > 0 ? ((outbornDeaths / outbornTotal) * 100).toFixed(1) + '%' : '0%';

      return {
        total, deceased, discharged, referred, inProgress, stepDown, inObservation, patientsInCare,
        mortalityRate: mortalityPercentage, dischargeRate: dischargePercentage, referralRate: referralPercentage,
        inProgressPercentage, stepDownPercentage,
        inbornDeaths, outbornDeaths, inbornMortalityRate, outbornMortalityRate, admissionsCount, todayNewAdmissions
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
      const under5Deaths = under5Patients.filter(p => getCanonicalOutcome(p) === 'Deceased').length;
      const under5Total = under5Patients.length;
      const under5MortalityRate = under5Total > 0 ? ((under5Deaths / under5Total) * 100).toFixed(1) + '%' : '0%';

      return {
        total, deceased, discharged, referred, inProgress, stepDown, inObservation, patientsInCare,
        mortalityRate: mortalityPercentage, dischargeRate: dischargePercentage, referralRate: referralPercentage,
        inProgressPercentage, stepDownPercentage, admissionsCount, todayNewAdmissions,
        under5Deaths, under5Total, under5MortalityRate
      };
    }

    return {
      total, deceased, discharged, referred, inProgress, stepDown, inObservation, patientsInCare, admissionsCount, todayNewAdmissions,
      mortalityRate: mortalityPercentage, dischargeRate: dischargePercentage, referralRate: referralPercentage,
      inProgressPercentage, stepDownPercentage
    };
  }, [unitPatients, selectedUnit, activeObservationPatients, baseUnitPatients, admissionCohortPatients, selectedDateRange, dateFilter, institutionShiftStartTime, timeRefreshTrigger]);

  // Completed observation patients (handed over or converted to admission) - loaded on demand
  const completedObservationPatients = useMemo(() => {
    return observationHistory.filter(p => p.unit === selectedUnit);
  }, [observationHistory, selectedUnit]);

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
    const outcomeOf = (patient: Patient) => getCanonicalOutcome(patient);
    const admissionTypeOf = (patient: Patient) => getCanonicalAdmissionType(patient);

    const total = chartFilteredPatients.length;
    const deceased = chartFilteredPatients.filter(p => outcomeOf(p) === 'Deceased').length;
    const discharged = chartFilteredPatients.filter(p => outcomeOf(p) === 'Discharged').length;
    const referred = chartFilteredPatients.filter(p => outcomeOf(p) === 'Referred').length;
    // In Progress includes patients with no outcome, empty outcome, or explicit 'In Progress'
    const inProgress = chartFilteredPatients.filter(p => outcomeOf(p) === 'In Progress').length;
    const stepDown = chartFilteredPatients.filter(p => outcomeOf(p) === 'Step Down').length;

    if (selectedUnit === Unit.NICU) {
      const inbornDeaths = chartFilteredPatients.filter(p => outcomeOf(p) === 'Deceased' && admissionTypeOf(p) === 'Inborn').length;
      const outbornDeaths = chartFilteredPatients.filter(p => outcomeOf(p) === 'Deceased' && admissionTypeOf(p) === 'Outborn').length;

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
    if (selectedUnit === Unit.SNCU) {
      const viewTitle = nicuView === 'All' ? '' : `- ${nicuView} Patients`;
      return `SNCU Dashboard ${viewTitle}`;
    }
    if (selectedUnit === Unit.PICU) {
      return 'PICU Dashboard';
    }
    return `${selectedUnit} Dashboard`;
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

      const now = new Date().toISOString();

      // Clean the data: remove undefined values and ensure progress notes is always an array
      const cleanedData = {
        ...patientData,
        progressNotes: patientData.progressNotes || [],
        // Add required metadata fields for Firebase rules
        metadata: {
          ...(patientData as any).metadata,
          createdBy: userEmail || displayName || 'unknown',
          createdAt: patientToEdit ? ((patientData as any).metadata?.createdAt || now) : now,
          lastUpdatedBy: userEmail || displayName || 'unknown',
          lastUpdatedAt: now
        }
      };

      // Remove undefined fields to prevent Firestore errors
      const sanitizedData = JSON.parse(JSON.stringify(cleanedData, (key, value) => {
        return value === undefined ? null : value;
      }));

      let patientId: string;

      if (patientToEdit) {
        // Update existing patient in top-level patients collection
        const patientRef = doc(db, 'patients', patientToEdit.id);
        await updateDoc(patientRef, sanitizedData);
        patientId = patientToEdit.id;
        console.log('✅ Patient updated in Firestore:', patientData.id);
      } else {
        // Add new patient to top-level patients collection
        const patientsRef = collection(db, 'patients');
        const docRef = await addDoc(patientsRef, sanitizedData);
        patientId = docRef.id;
        console.log('✅ Patient added to Firestore:', docRef.id);
      }

      // Sync to Supabase (background, non-blocking)
      if (institutionId) {
        syncPatientToSupabase(patientId, patientData as Patient, institutionId)
          .then(supabaseId => {
            if (supabaseId) {
              console.log('✅ Patient synced to Supabase:', supabaseId);
            }
          })
          .catch(err => console.warn('⚠️ Supabase sync failed (non-critical):', err));
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

      // Also delete from Supabase (background, non-blocking)
      deletePatientSync(id)
        .then(success => {
          if (success) {
            console.log('✅ Patient deleted from Supabase:', id);
          }
        })
        .catch(err => console.warn('⚠️ Supabase delete failed (non-critical):', err));

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
      const dischargeTimestamp = new Date().toISOString();
      const updatedPatient: Patient = {
        ...patient,
        outcome: 'Discharged',
        isStepDown: false,
        finalDischargeDate: dischargeTimestamp,
        releaseDate: dischargeTimestamp,
        lastUpdatedBy: userRole,
        lastUpdatedByEmail: userEmail,
        lastEditedAt: dischargeTimestamp
      };

      // Update patient in top-level patients collection
      const patientRef = doc(db, 'patients', patient.id);
      await updateDoc(patientRef, { ...updatedPatient });
      console.log('✅ Patient discharged from step down:', patient.id);

      // Sync to Supabase (background, non-blocking)
      if (institutionId) {
        syncPatientToSupabase(patient.id, updatedPatient, institutionId)
          .then(supabaseId => {
            if (supabaseId) console.log('✅ Step-down discharge synced to Supabase');
          })
          .catch(err => console.warn('⚠️ Supabase sync failed (non-critical):', err));
      }

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
      const readmissionDateTime = new Date().toISOString();
      const updatedPatient: Patient = {
        ...patient,
        outcome: 'In Progress',
        unit: originalUnit,
        isStepDown: false,
        readmissionFromStepDown: true,
        readmissionDate: readmissionDateTime,
        lastUpdatedBy: userRole,
        lastUpdatedByEmail: userEmail,
        lastEditedAt: readmissionDateTime
      };

      // Update patient in top-level patients collection
      const patientRef = doc(db, 'patients', patient.id);
      await updateDoc(patientRef, { ...updatedPatient });
      console.log('✅ Patient readmitted from step down:', patient.id);

      // Sync to Supabase (background, non-blocking)
      if (institutionId) {
        syncPatientToSupabase(patient.id, updatedPatient, institutionId)
          .then(supabaseId => {
            if (supabaseId) console.log('✅ Readmission synced to Supabase');
          })
          .catch(err => console.warn('⚠️ Supabase sync failed (non-critical):', err));
      }

      // Real-time listener will automatically update the patient list
    } catch (error: any) {
      console.error('❌ Error readmitting patient:', error);
      alert('Failed to readmit patient: ' + error.message);
    }
  };

  const handleSelectUnit = (unit: Unit) => {
    setSelectedUnit(unit);
    // Reset to Inborn for NICU/SNCU, otherwise 'All' is fine (won't be shown anyway for other units)
    if (unit === Unit.NICU || unit === Unit.SNCU) {
      setNicuView('Inborn');
    }

    // Notify parent of unit change
    if (onUnitChange) {
      onUnitChange(unit);
    }

    // Save selected unit to localStorage for persistence
    try {
      localStorage.setItem('selectedUnit', unit);
    } catch (error) {
      console.warn('Failed to save selectedUnit to localStorage:', error);
    }
  };





  // Desktop Deaths Analysis Page
  if (showDeathsAnalysis) {
    return (
      <DeathAnalyticsPage
        patients={patients}
        institutionName={institutionName || 'Unknown Institution'}
        selectedUnit={selectedUnit}
        onBack={() => setShowDeathsAnalysis(false)}
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
          // Mark that we handled this locally so App.tsx doesn't close the patient list
          (window as any).__patientViewBackHandled = true;
          setShowPatientViewPage(false);
          setPatientToView(null);
          // Go back in history to remove the 'patientView' state
          window.history.back();
          // Reset flag after a delay to ensure popstate handler in App sees it
          setTimeout(() => {
            (window as any).__patientViewBackHandled = false;
          }, 300);
        }}
        onEdit={handleEditPatient}
        canEdit={hasRole(UserRole.Doctor) || hasRole(UserRole.Nurse) || hasRole(UserRole.Admin) || hasRole(UserRole.SuperAdmin)}
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
        onBack={() => window.history.back()}
        onViewDetails={handleViewDetails}
        onEdit={handleEditPatient}
        userRole={userRole}
        allRoles={allRoles}
        observationPatients={observationPatients}
        completedObservationPatients={completedObservationPatients}
        onLoadObservationHistory={loadObservationHistory}
        loadingObservationHistory={loadingObservationHistory}
        observationHistoryLoaded={observationHistoryLoaded}
        institutionId={institutionId}
        userEmail={userEmail || ''}
        userName={displayName || userEmail?.split('@')[0] || 'User'}
        shiftStartTime={institutionShiftStartTime}
        onPatientUpdate={async (updatedPatient) => {
          // Update patient in Firestore
          if (updatedPatient.id) {
            const patientRef = doc(db, 'patients', updatedPatient.id);
            await updateDoc(patientRef, { ...updatedPatient });
            // Update local state
            setPatients(prev => prev.map(p => p.id === updatedPatient.id ? updatedPatient : p));
          }
        }}
        onPatientsDeleted={() => {
          // Real-time listener will automatically refresh patients
          console.log('✅ Patients deleted - real-time listener will update');
        }}
        onShowReferrals={onShowReferrals}
        onConvertObservationToAdmission={(observationPatient) => {
          // Open patient form pre-filled with observation data
          setShowPatientDetailsPage(false);
          if (onShowAddPatient) {
            const now = new Date().toISOString();
            const partialPatient: Partial<Patient> & { _fromObservationId?: string } = {
              name: observationPatient.babyName,
              motherName: observationPatient.motherName,
              dateOfBirth: observationPatient.dateOfBirth,
              unit: observationPatient.unit,
              admissionType: (observationPatient.admissionType as AdmissionType) || AdmissionType.Inborn,
              institutionId: observationPatient.institutionId,
              admissionDate: now,
              admissionDateTime: now,
              outcome: 'In Progress',
              gender: observationPatient.gender,
              // Store the observation patient ID to update after admission
              _fromObservationId: observationPatient.id,
            };
            onShowAddPatient(partialPatient as Patient, observationPatient.unit);
          }
        }}
        onHandoverObservation={async (observationPatient) => {
          // Handover observation patient to mother - track the time
          try {
            const now = new Date().toISOString();
            const observationRef = doc(db, 'observationPatients', observationPatient.id);

            // Calculate observation duration for logging
            const startTime = new Date(observationPatient.dateOfObservation);
            const endTime = new Date(now);
            const durationMs = endTime.getTime() - startTime.getTime();
            const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
            const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

            await deleteDoc(observationRef);

            console.log(`✅ Observation patient ${observationPatient.babyName} handed over to mother after ${durationHours}h ${durationMinutes}m`);

            // Real-time listener will update the list automatically
          } catch (error) {
            console.error('❌ Error handing over observation patient:', error);
            alert('Failed to handover patient. Please try again.');
          }
        }}
        doctors={doctors}
      />
    );
  }

  // Show loading state with native skeleton
  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      <div className="container mx-auto px-0 sm:px-6 py-2 sm:py-6 space-y-4 sm:space-y-6 pb-24 md:pb-6">
        <div className="backdrop-blur-xl bg-white/65 dark:bg-slate-900/55 px-4 sm:px-6 py-4 sm:py-5 border border-white/30 dark:border-white/10 shadow-[0_20px_70px_-10px_rgba(236,72,153,0.18)] rounded-3xl transition-all duration-200 mb-4">

          {/* Clean Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                {selectedUnit} Dashboard
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                {institutionName || 'Healthcare Management'}
              </p>
            </div>
            {displayName && (
              <div className="text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400">Welcome back,</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{displayName}</p>
              </div>
            )}
          </div>

          {/* Row 1: Unit Selection & Date Display Badge (Mobile) */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <UnitSelection
              selectedUnit={selectedUnit}
              onSelectUnit={setSelectedUnit}
              availableUnits={enabledFacilities}
            />
            {(selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) && (
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
          {/* Mobile: Info message to use "More" menu - Hidden for Officials */}
          {userRole !== UserRole.Official && (
            <div className="flex md:hidden items-center justify-center">
              <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Tap ⚙️ More for all actions</span>
              </div>
            </div>
          )}

          {/* Desktop: Full action buttons grid - Hidden for Officials */}
          {userRole !== UserRole.Official && (
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
                    setShowDeathsAnalysis(true);
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

              {/* AI Reports - For Admin, Doctor, and Nurse roles */}
              {(userRole === UserRole.Admin || userRole === UserRole.Doctor || userRole === UserRole.Nurse) && onShowAIReports && (
                <button
                  onClick={() => {
                    haptics.tap();
                    onShowAIReports();
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold text-sm"
                >
                  <IconChartBar size={18} />
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
                  window.history.pushState({ page: 'patientList' }, '', window.location.pathname);
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
          )}

	          {/* Row 3: Date Filter */}
	          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
	            <DateFilter value={dateFilter} onChange={setDateFilter} />
	          </div>

        </div>

        {/* Key Metrics Cards - Clean Medical Grade Design */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {/* Active Patients - Primary Metric */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-500/25">
            <div className="flex items-center justify-between mb-2">
              <BedIcon className="w-6 h-6 opacity-80" />
              <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded-full">Active</span>
            </div>
            <p className="text-3xl font-bold">{stats.patientsInCare}</p>
            <p className="text-xs text-blue-100 mt-1">Active Patients</p>
          </div>

          {/* New Admissions - Shows based on selected date filter */}
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-4 text-white shadow-lg shadow-indigo-500/25">
            <div className="flex items-center justify-between mb-2">
              <PlusIcon className="w-6 h-6 opacity-80" />
              <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded-full">
                {dateFilter.period === 'Today' ? 'Today' :
                 dateFilter.period === 'Yesterday' ? 'Yesterday' :
                 dateFilter.period === 'This Week' ? 'This Week' :
                 dateFilter.period === 'Last Week' ? 'Last Week' :
                 dateFilter.period === 'This Month' ? 'This Month' :
                 dateFilter.period === 'Last Month' ? 'Last Month' :
                 dateFilter.period === 'Custom' ? 'Custom' :
                 dateFilter.period === 'All Time' ? 'All Time' : dateFilter.period}
              </span>
            </div>
            <p className="text-3xl font-bold">{stats.admissionsCount}</p>
            <p className="text-xs text-indigo-100 mt-1">New Admissions</p>
          </div>

          {/* Discharged */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white shadow-lg shadow-emerald-500/25">
            <div className="flex items-center justify-between mb-2">
              <ArrowRightOnRectangleIcon className="w-6 h-6 opacity-80" />
              <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded-full">Outcomes</span>
            </div>
            <p className="text-3xl font-bold">{stats.discharged}</p>
            <p className="text-xs text-emerald-100 mt-1">Discharged</p>
          </div>

          {/* Mortality Rate */}
          <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl p-4 text-white shadow-lg shadow-slate-600/25">
            <div className="flex items-center justify-between mb-2">
              <ChartBarIcon className="w-6 h-6 opacity-80" />
              <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded-full">Rate</span>
            </div>
            <p className="text-3xl font-bold">{stats.mortalityRate}</p>
            <p className="text-xs text-slate-300 mt-1">Mortality Rate</p>
          </div>
        </div>

        {/* Secondary Stats Row - More subtle */}
        <div className="grid grid-cols-3 gap-2 px-1">
          <div className="text-center py-2 px-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <p className="text-lg font-bold text-amber-600">{stats.referred}</p>
            <p className="text-[10px] text-slate-500">Referred</p>
          </div>
          <button
            className="text-center py-2 px-3 bg-white dark:bg-slate-800 rounded-xl border border-sky-200 dark:border-sky-700 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors w-full"
            onClick={() => {
              haptics.tap();
              setOutcomeFilter('Step Down');
              setShowPatientDetailsPage(true);
              window.history.pushState({ page: 'patientList' }, '', window.location.pathname);
            }}
          >
            <p className="text-lg font-bold text-sky-600">{stats.stepDown}</p>
            <p className="text-[10px] text-slate-500">Step Down</p>
          </button>
          <div className="text-center py-2 px-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <p className="text-lg font-bold text-purple-600">{activeObservationPatients.length}</p>
            <p className="text-[10px] text-slate-500">Observation</p>
          </div>
        </div>

        {/* Analytics Card - Prominent access to analytics dashboard */}
        {onShowAnalytics && (
          <button
            onClick={() => {
              haptics.tap();
              onShowAnalytics();
            }}
            className="w-full bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-4 text-white shadow-lg shadow-purple-500/25 flex items-center justify-between hover:from-violet-600 hover:to-purple-700 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <ChartBarIcon className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="font-bold text-lg">Analytics Dashboard</p>
                <p className="text-sm text-purple-100">Trends, charts & insights</p>
              </div>
            </div>
            <svg className="w-6 h-6 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Bed Occupancy - Keep this as it's useful for quick overview */}
        <BedOccupancy patients={unitPatients} bedCapacity={bedCapacity} availableUnits={enabledFacilities} observationPatients={activeObservationPatients} nicuView={nicuView} />

        {/* Active Patients Quick View - Hidden for Officials */}
        {userRole !== UserRole.Official && stats.inProgress > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                Active Patients
              </h3>
              <button
                onClick={() => {
                  haptics.tap();
                  setShowPatientDetailsPage(true);
                  window.history.pushState({ page: 'patientList' }, '', window.location.pathname);
                }}
                className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline flex items-center gap-1"
              >
                View All
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Active patients list - show first 5 */}
            <div className="space-y-2">
              {unitPatients
                .filter(p => getCanonicalOutcome(p) === 'In Progress')
                .slice(0, 5)
                .map((patient) => (
                  <div
                    key={patient.id}
                    onClick={() => handleViewDetails(patient)}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                        {patient.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{patient.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {getFormattedAge(patient.dateOfBirth, patient.age, patient.ageUnit)} | {patient.gender}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Admitted {new Date(patient.admissionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}

              {stats.inProgress > 5 && (
                <div className="text-center py-2">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    +{stats.inProgress - 5} more patients
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step Down Panel ─────────────────────────────────────────────── */}
        {/* Shows babies who are currently stepped down to postnatal/mother-side.
            NOT counted in active patients. Stays visible so staff can track
            the baby even days after the hand-over. */}
        {userRole !== UserRole.Official && stepDownPatients.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-sky-200 dark:border-sky-800 p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {/* Static sky indicator — these babies are NOT active in the unit */}
                <span className="w-2 h-2 bg-sky-400 rounded-full"></span>
                Step Down
                <span className="ml-1 text-sm font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/40 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-700">
                  {stepDownPatients.length}
                </span>
              </h3>
              <button
                onClick={() => {
                  haptics.tap();
                  setOutcomeFilter('Step Down');
                  setShowPatientDetailsPage(true);
                  window.history.pushState({ page: 'patientList' }, '', window.location.pathname);
                }}
                className="text-sky-600 dark:text-sky-400 text-sm font-medium hover:underline flex items-center gap-1"
              >
                View All
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 -mt-1">
              Babies moved out of {selectedUnit} to postnatal ward / mother side. Not counted in active beds.
            </p>

            {/* Step Down patient rows */}
            <div className="space-y-2">
              {stepDownPatients.slice(0, 5).map((patient) => {
                const stepDownDateStr = patient.stepDownDate
                  ? new Date(patient.stepDownDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '—';
                const daysSince = patient.stepDownDate
                  ? Math.floor((Date.now() - new Date(patient.stepDownDate).getTime()) / 86_400_000)
                  : null;

                return (
                  <div
                    key={patient.id}
                    onClick={() => handleViewDetails(patient)}
                    className="flex items-center justify-between p-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors cursor-pointer border border-sky-100 dark:border-sky-800"
                  >
                    <div className="flex items-center gap-3">
                      {/* Sky-blue avatar — visually distinct from emerald active patients */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {patient.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{patient.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {getFormattedAge(patient.dateOfBirth, patient.age, patient.ageUnit)} | {patient.gender}
                        </p>
                        {patient.stepDownLocation && (
                          <p className="text-xs text-sky-600 dark:text-sky-400 font-medium mt-0.5">
                            → {patient.stepDownLocation}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-medium text-sky-700 dark:text-sky-300">
                        {stepDownDateStr}
                      </p>
                      {daysSince !== null && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {daysSince === 0 ? 'Today' : daysSince === 1 ? '1 day ago' : `${daysSince} days ago`}
                        </p>
                      )}
                      <span className="inline-block mt-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/60 px-1.5 py-0.5 rounded-full">
                        Step Down
                      </span>
                    </div>
                  </div>
                );
              })}

              {stepDownPatients.length > 5 && (
                <div className="text-center py-2">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    +{stepDownPatients.length - 5} more · <button
                      className="text-sky-600 hover:underline"
                      onClick={() => {
                        haptics.tap();
                        setOutcomeFilter('Step Down');
                        setShowPatientDetailsPage(true);
                      }}
                    >View all</button>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions Section */}


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

          {/* Analytics Dashboard */}
          {onShowAnalytics && (
            <button
              onClick={() => {
                haptics.tap();
                setShowQuickActions(false);
                onShowAnalytics();
              }}
              className="w-full bg-gradient-to-r from-violet-500 to-purple-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg hover:from-violet-600 hover:to-purple-700 transition-all"
            >
              <ChartBarIcon className="w-5 h-5" />
              Analytics Dashboard
            </button>
          )}

          {/* Deaths Analysis */}
          {(hasRole(UserRole.Admin) || hasRole(UserRole.Doctor)) && (
            <button
              onClick={() => {
                haptics.tap();
                setShowQuickActions(false);
                setShowDeathsAnalysis(true);
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

          {/* AI Reports - For Admin, Doctor, and Nurse roles */}
          {(userRole === UserRole.Admin || userRole === UserRole.Doctor || userRole === UserRole.Nurse) && onShowAIReports && (
            <button
              onClick={() => {
                onShowAIReports();
                setShowQuickActions(false);
                haptics.tap();
              }}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 shadow-lg hover:from-indigo-600 hover:to-purple-700 transition-all"
            >
              <IconChartBar size={20} />
              AI Reports
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
              window.history.pushState({ page: 'patientList' }, '', window.location.pathname);
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

      {/* World-Class Add Patient FAB - Works on both Mobile and Web, Hidden for Officials */}
      {userRole !== UserRole.Official && (
        hasRole(UserRole.Doctor) ||
        hasRole(UserRole.Nurse) ||
        hasRole(UserRole.Admin) ||
        hasRole(UserRole.SuperAdmin) ||
        hasRole(UserRole.DistrictAdmin)
      ) && (
          <AddPatientFAB onClick={() => setShowAddPatientChoice(true)} />
        )}

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
