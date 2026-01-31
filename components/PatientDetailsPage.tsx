import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Patient, Unit, UserRole, ObservationPatient, ObservationOutcome, ProgressNote, PatientOutcome } from '../types';
import VirtualizedPatientList from './VirtualizedPatientList';
import DateFilter, { DateFilterValue } from './DateFilter';
import ShiftFilter, { ShiftFilterConfigs } from './ShiftFilter';
import { OutcomeFilter } from './PatientFilters';
import NicuViewSelection from './NicuViewSelection';
import DischargeSummaryModal from './DischargeSummaryModal';
import DeathCertificateModal from './DeathCertificateModal';
import { downloadDischargeSummaryPDF, previewDischargeSummaryPDF } from '../services/dischargeSummaryService';
import { db } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { deleteMultiplePatients } from '../services/firestoreService';
import { syncPatientToSupabase } from '../services/supabaseSyncService';
import { X, Filter, Search, ChevronLeft, Users, Calendar, Clock, Stethoscope, TrendingUp, AlertCircle, Mic, Activity, ArrowDownCircle, Send, CheckCircle, UserX } from 'lucide-react';
import { showToast } from '../utils/toast';
import ProgressNoteForm from './ProgressNoteFormEnhanced';
import { useBackgroundSave } from '../contexts/BackgroundSaveContext';
import ReferralForm from './ReferralForm';

interface PatientDetailsPageProps {
  patients: Patient[];
  selectedUnit: Unit;
  onBack: () => void;
  onViewDetails: (patient: Patient) => void;
  onEdit: (patient: Patient) => void;
  userRole: UserRole;
  allRoles?: UserRole[];
  observationPatients?: ObservationPatient[];
  completedObservationPatients?: ObservationPatient[]; // History of completed observations
  onLoadObservationHistory?: () => void; // Load history on demand
  loadingObservationHistory?: boolean;
  observationHistoryLoaded?: boolean;
  onConvertObservationToAdmission?: (observationPatient: ObservationPatient) => void;
  onHandoverObservation?: (observationPatient: ObservationPatient) => void;
  isLazyLoaded?: boolean;
  onLoadAllPatients?: () => void;
  institutionId?: string;
  onPatientsDeleted?: () => void;
  userEmail?: string;
  userName?: string;
  onPatientUpdate?: (patient: Patient) => void;
  doctors?: string[]; // List of doctors for dropdown selection
  onShowReferrals?: () => void; // Navigate to Referral Network
}

const PatientDetailsPage: React.FC<PatientDetailsPageProps> = ({
  patients,
  selectedUnit,
  onBack,
  onViewDetails,
  onEdit,
  userRole,
  allRoles,
  observationPatients = [],
  completedObservationPatients = [],
  onLoadObservationHistory,
  loadingObservationHistory = false,
  observationHistoryLoaded = false,
  onConvertObservationToAdmission,
  onHandoverObservation,
  isLazyLoaded = true,
  onLoadAllPatients,
  institutionId,
  onPatientsDeleted,
  userEmail = '',
  userName = '',
  onPatientUpdate,
  doctors = [],
  onShowReferrals
}) => {
  const hasRole = (role: UserRole) => {
    return userRole === role || (allRoles && allRoles.includes(role));
  };

  // Helper function to calculate observation duration
  const calculateObservationDuration = (dateOfObservation: string) => {
    const start = new Date(dateOfObservation);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  };

  // Format observation start time
  const formatObservationTime = (dateOfObservation: string) => {
    const date = new Date(dateOfObservation);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // State
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ period: 'All Time' });
  const [shiftFilter, setShiftFilter] = useState<ShiftFilterConfigs>({
    enabled: false,
    startTime: '08:00',
    endTime: '20:00'
  });
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('In Progress');
  const [nicuView, setNicuView] = useState<'All' | 'Inborn' | 'Outborn'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [quickRecordPatient, setQuickRecordPatient] = useState<Patient | null>(null);
  const [showObservationSection, setShowObservationSection] = useState(true);
  const [observationView, setObservationView] = useState<'active' | 'history'>('active');

  // Action modal states
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [dischargePatient, setDischargePatient] = useState<Patient | null>(null);
  const [dischargeViewMode, setDischargeViewMode] = useState(false); // true when viewing existing certificate
  const [showDeathCertificateModal, setShowDeathCertificateModal] = useState(false);
  const [deathCertificatePatient, setDeathCertificatePatient] = useState<Patient | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusPatient, setStatusPatient] = useState<Patient | null>(null);
  const [pendingStatus, setPendingStatus] = useState<PatientOutcome | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showStepDownModal, setShowStepDownModal] = useState(false);
  const [stepDownPatient, setStepDownPatient] = useState<Patient | null>(null);
  const [stepDownLocation, setStepDownLocation] = useState('');
  const [showReferModal, setShowReferModal] = useState(false);
  const [referPatient, setReferPatient] = useState<Patient | null>(null);

  // Get institution name from localStorage
  const institutionName = localStorage.getItem('collegeName') || 'Medical Institution';

  // Background save context
  const { addSavingNote, startProcessing, updateNoteStatus, updateNoteContent, setOnViewPatient, setOnViewDischarge } = useBackgroundSave();

  // Register the "Click to view" handler for saved notes
  React.useEffect(() => {
    const handleViewSavedNote = (patientId: string, noteId?: string) => {
      console.log('📋 Click to view - Patient:', patientId, 'Note:', noteId);
      // Find the patient and navigate to their details
      const patient = patients.find(p => p.id === patientId);
      if (patient) {
        onViewDetails(patient);
        // The noteId can be used to scroll to/highlight the specific note
        // For now, just opening patient details shows all notes
      }
    };

    const handleViewDischarge = (patientId: string) => {
      console.log('📄 Click to view discharge - Patient:', patientId);
      const patient = patients.find(p => p.id === patientId);
      if (patient) {
        setDischargeViewMode(true); // View mode - auto shows preview
        setDischargePatient(patient);
        setShowDischargeModal(true);
      }
    };

    setOnViewPatient(handleViewSavedNote);
    setOnViewDischarge(handleViewDischarge);

    // Cleanup on unmount
    return () => {
      setOnViewPatient(undefined);
      setOnViewDischarge(undefined);
    };
  }, [patients, onViewDetails, setOnViewPatient, setOnViewDischarge]);

  const isAdmin = hasRole(UserRole.Admin);
  const canEdit = hasRole(UserRole.Doctor) || hasRole(UserRole.Admin) || hasRole(UserRole.Nurse);

  // Status filter options with colors and icons
  const statusOptions: Array<{ value: OutcomeFilter; label: string; color: string; bgColor: string; icon: string }> = [
    { value: 'All', label: 'All', color: 'text-slate-700', bgColor: 'bg-slate-100 border-slate-300', icon: '📊' },
    { value: 'Observation', label: 'Observation', color: 'text-orange-700', bgColor: 'bg-orange-100 border-orange-300', icon: '👁️' },
    { value: 'Admission', label: 'New Admission', color: 'text-cyan-700', bgColor: 'bg-cyan-100 border-cyan-300', icon: '🏥' },
    { value: 'In Progress', label: 'Active', color: 'text-blue-700', bgColor: 'bg-blue-100 border-blue-300', icon: '🔵' },
    { value: 'Discharged', label: 'Discharged', color: 'text-green-700', bgColor: 'bg-green-100 border-green-300', icon: '✅' },
    { value: 'Deceased', label: 'Deceased', color: 'text-red-700', bgColor: 'bg-red-100 border-red-300', icon: '💔' },
    { value: 'Referred', label: 'Referred', color: 'text-purple-700', bgColor: 'bg-purple-100 border-purple-300', icon: '🔀' },
    { value: 'Step Down', label: 'Step Down', color: 'text-amber-700', bgColor: 'bg-amber-100 border-amber-300', icon: '⬇️' },
  ];

  // Filter patients logic (same as before)
  const unitPatients = useMemo(() => {
    let baseFiltered = patients.filter(p => p.unit === selectedUnit);

    if ((selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) && nicuView !== 'All') {
      baseFiltered = baseFiltered.filter(p => p.admissionType === nicuView);
    }

    let filtered = baseFiltered;

    if (dateFilter.period !== 'All Time') {
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
        // keep filtered as is
      } else {
        filtered = filtered.filter(p => {
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
      }
    }

    if (shiftFilter.enabled && shiftFilter.startTime && shiftFilter.endTime) {
      filtered = filtered.filter(p => {
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
          eventDate = new Date(p.admissionDate);
        }

        const eventTime = eventDate.getHours() * 60 + eventDate.getMinutes();
        const [startHour, startMinute] = shiftFilter.startTime.split(':').map(Number);
        const [endHour, endMinute] = shiftFilter.endTime.split(':').map(Number);
        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;

        if (startTime <= endTime) {
          return eventTime >= startTime && eventTime <= endTime;
        } else {
          return eventTime >= startTime || eventTime <= endTime;
        }
      });
    }

    return filtered;
  }, [patients, selectedUnit, nicuView, dateFilter, shiftFilter]);

  const filteredPatients = useMemo(() => {
    let filtered = unitPatients;

    if (outcomeFilter !== 'All') {
      if (outcomeFilter === 'Admission') {
        // Filter for new admissions (within last 24 hours)
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        filtered = filtered.filter(p => {
          const admissionDate = new Date(p.admissionDate);
          return admissionDate >= twentyFourHoursAgo && p.outcome === 'In Progress';
        });
      } else {
        filtered = filtered.filter(p => p.outcome === outcomeFilter);
      }
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.diagnosis?.toLowerCase().includes(query) ||
        p.id?.toLowerCase().includes(query) ||
        p.ntid?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [unitPatients, outcomeFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = unitPatients.length;
    const deceased = unitPatients.filter(p => p.outcome === 'Deceased').length;
    const discharged = unitPatients.filter(p => p.outcome === 'Discharged').length;
    const referred = unitPatients.filter(p => p.outcome === 'Referred').length;
    const inProgress = unitPatients.filter(p => p.outcome === 'In Progress').length;
    const stepDown = unitPatients.filter(p => p.outcome === 'Step Down').length;

    // Count new admissions (admitted within last 24 hours)
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const admission = unitPatients.filter(p => {
      const admissionDate = new Date(p.admissionDate);
      return admissionDate >= twentyFourHoursAgo && p.outcome === 'In Progress';
    }).length;

    return {
      all: total,
      total,
      deceased,
      discharged,
      referred,
      inProgress,
      stepDown,
      admission
    };
  }, [unitPatients]);

  // Filter observation history based on date and shift filters
  const filteredObservationHistory = useMemo(() => {
    let filtered = completedObservationPatients;

    // Apply date filter
    if (dateFilter.period !== 'All Time') {
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
        // keep filtered as is
      } else {
        filtered = filtered.filter(obs => {
          // Use dischargedAt for completed observations, or dateOfObservation as fallback
          const eventDate = obs.dischargedAt
            ? new Date(obs.dischargedAt)
            : new Date(obs.dateOfObservation);
          return eventDate >= startDate && eventDate <= endDate;
        });
      }
    }

    // Apply shift filter
    if (shiftFilter.enabled && shiftFilter.startTime && shiftFilter.endTime) {
      filtered = filtered.filter(obs => {
        const eventDate = obs.dischargedAt
          ? new Date(obs.dischargedAt)
          : new Date(obs.dateOfObservation);

        const eventTime = eventDate.getHours() * 60 + eventDate.getMinutes();
        const [startHour, startMinute] = shiftFilter.startTime.split(':').map(Number);
        const [endHour, endMinute] = shiftFilter.endTime.split(':').map(Number);
        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;

        if (startTime <= endTime) {
          return eventTime >= startTime && eventTime <= endTime;
        } else {
          return eventTime >= startTime || eventTime <= endTime;
        }
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(obs =>
        obs.babyName.toLowerCase().includes(query) ||
        obs.motherName.toLowerCase().includes(query) ||
        obs.reasonForObservation?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [completedObservationPatients, dateFilter, shiftFilter, searchQuery]);

  // Filter active observations based on date, shift, and search filters
  const filteredActiveObservations = useMemo(() => {
    let filtered = observationPatients;

    // Apply date filter
    if (dateFilter.period !== 'All Time') {
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
        // keep filtered as is
      } else {
        filtered = filtered.filter(obs => {
          const eventDate = new Date(obs.dateOfObservation);
          return eventDate >= startDate && eventDate <= endDate;
        });
      }
    }

    // Apply shift filter
    if (shiftFilter.enabled && shiftFilter.startTime && shiftFilter.endTime) {
      filtered = filtered.filter(obs => {
        const eventDate = new Date(obs.dateOfObservation);

        const eventTime = eventDate.getHours() * 60 + eventDate.getMinutes();
        const [startHour, startMinute] = shiftFilter.startTime.split(':').map(Number);
        const [endHour, endMinute] = shiftFilter.endTime.split(':').map(Number);
        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;

        if (startTime <= endTime) {
          return eventTime >= startTime && eventTime <= endTime;
        } else {
          return eventTime >= startTime || eventTime <= endTime;
        }
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(obs =>
        obs.babyName.toLowerCase().includes(query) ||
        obs.motherName.toLowerCase().includes(query) ||
        obs.reasonForObservation?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [observationPatients, dateFilter, shiftFilter, searchQuery]);

  // Quick record handlers
  const handleQuickRecord = useCallback((patient: Patient) => {
    setQuickRecordPatient(patient);
  }, []);

  const handleQuickRecordSave = useCallback((note: ProgressNote) => {
    if (!quickRecordPatient) return;

    const updatedNotes = [...(quickRecordPatient.progressNotes || []), note];
    const updatedPatient = { ...quickRecordPatient, progressNotes: updatedNotes };

    if (onPatientUpdate) {
      onPatientUpdate(updatedPatient);
    }
    setQuickRecordPatient(null);
  }, [quickRecordPatient, onPatientUpdate]);

  const handleQuickRecordBackgroundSave = useCallback(async (patientId: string, note: ProgressNote) => {
    if (!quickRecordPatient) return;

    const saveId = addSavingNote(patientId, quickRecordPatient.name, note);

    // Close modal immediately
    setQuickRecordPatient(null);

    try {
      const updatedNotes = [...(quickRecordPatient.progressNotes || []), note];
      const updatedPatient = { ...quickRecordPatient, progressNotes: updatedNotes };

      if (onPatientUpdate) {
        await onPatientUpdate(updatedPatient);
      }
      updateNoteStatus(saveId, 'saved');
    } catch (err) {
      console.error('Background save failed:', err);
      updateNoteStatus(saveId, 'error', (err as Error).message);
    }
  }, [quickRecordPatient, addSavingNote, updateNoteStatus, onPatientUpdate]);

  // Handler for immediate indicator when Done is clicked (before Gemini processing)
  const handleProcessingStart = useCallback((patientId: string, patientName: string): string => {
    console.log('📤 Processing started for:', patientName);
    // This shows indicator immediately when Done is clicked
    // Modal close is handled by VoiceClinicalNote via onCancel()
    const saveId = startProcessing(patientId, patientName);
    return saveId;
  }, [startProcessing]);

  // Handler for when Gemini processing completes
  const handleProcessingComplete = useCallback(async (saveId: string, patientId: string, note: ProgressNote) => {
    console.log('✅ Processing complete, saving note for patient:', patientId);

    // Update indicator to "saving" status
    updateNoteStatus(saveId, 'saving');
    updateNoteContent(saveId, note);

    try {
      // Find the patient from the list
      const patientToUpdate = patients.find(p => p.id === patientId);

      if (patientToUpdate) {
        // Add note to patient's progressNotes
        const updatedNotes = [...(patientToUpdate.progressNotes || []), note];

        // Build update object - always include progressNotes
        const updateData: any = { progressNotes: updatedNotes };

        // If note has medications, merge them with existing medications
        if (note.medications && note.medications.length > 0) {
          const existingMeds = patientToUpdate.medications || [];

          // Add new medications (avoid duplicates by checking name)
          const newMeds = note.medications.filter(newMed =>
            !existingMeds.some(existing =>
              existing.name.toLowerCase() === newMed.name.toLowerCase() &&
              existing.isActive !== false
            )
          );

          if (newMeds.length > 0) {
            updateData.medications = [...existingMeds, ...newMeds];
            console.log(`💊 Adding ${newMeds.length} new medications from note`);
          }
        }

        const updatedPatient = {
          ...patientToUpdate,
          progressNotes: updatedNotes,
          ...(updateData.medications && { medications: updateData.medications })
        };

        // Save to Firestore
        const patientRef = doc(db, 'patients', patientId);
        await updateDoc(patientRef, updateData);

        // Sync to Supabase (background, non-blocking)
        if (institutionId) {
          syncPatientToSupabase(patientId, updatedPatient as Patient, institutionId)
            .catch(err => console.warn('⚠️ Supabase sync failed (non-critical):', err));
        }

        // Update local state
        if (onPatientUpdate) {
          await onPatientUpdate(updatedPatient);
        }

        // Show appropriate success message
        const medCount = note.medications?.length || 0;
        if (medCount > 0) {
          showToast('success', `✅ Note saved with ${medCount} medication(s)!`);
        } else {
          showToast('success', '✅ Clinical note saved!');
        }
      }

      updateNoteStatus(saveId, 'saved');
    } catch (err) {
      console.error('Save failed:', err);
      updateNoteStatus(saveId, 'error', (err as Error).message);
    }
  }, [updateNoteStatus, updateNoteContent, patients, onPatientUpdate]);

  // Handler for processing errors
  const handleProcessingError = useCallback((saveId: string, error: string) => {
    console.error('❌ Processing failed:', error);
    updateNoteStatus(saveId, 'error', error);
  }, [updateNoteStatus]);

  const togglePatientSelection = (patientId: string) => {
    setSelectedPatientIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(patientId)) {
        newSet.delete(patientId);
      } else {
        newSet.add(patientId);
      }
      return newSet;
    });
  };

  const selectAllFiltered = () => {
    const allIds = new Set(filteredPatients.map(p => p.id));
    setSelectedPatientIds(allIds);
  };

  const clearSelection = () => {
    setSelectedPatientIds(new Set());
  };

  const handleDeleteSelected = async () => {
    if (!institutionId || selectedPatientIds.size === 0) return;

    setIsDeleting(true);
    try {
      const result = await deleteMultiplePatients(institutionId, Array.from(selectedPatientIds));

      if (result.failed > 0) {
        alert(`Deleted ${result.success} patients. Failed to delete ${result.failed} patients.`);
      } else {
        alert(`Successfully deleted ${result.success} patients.`);
      }

      setSelectedPatientIds(new Set());
      setSelectionMode(false);
      setShowDeleteConfirm(false);

      if (onPatientsDeleted) {
        onPatientsDeleted();
      }
    } catch (error) {
      console.error('Error deleting patients:', error);
      alert('Failed to delete patients. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const hasActiveFilters = dateFilter.period !== 'All Time' || shiftFilter.enabled || nicuView !== 'All';

  // Action Menu Handlers
  const handleUpdateStatus = useCallback(async (patient: Patient, status: PatientOutcome) => {
    // CHECK: If patient is currently Discharged and trying to revert to In Progress
    // Only allow within 24 hours of discharge
    if (patient.outcome === 'Discharged' && status === 'In Progress') {
      const dischargeDate = patient.releaseDate || patient.finalDischargeDate;
      if (dischargeDate) {
        const dischargTime = new Date(dischargeDate).getTime();
        const now = Date.now();
        const hoursSinceDischarge = (now - dischargTime) / (1000 * 60 * 60);

        if (hoursSinceDischarge > 24) {
          showToast('error', 'Cannot revert discharge after 24 hours. Please create a new admission if needed.');
          return;
        }
      }
    }

    // CHECK: If patient is Deceased, cannot change status
    if (patient.outcome === 'Deceased') {
      showToast('error', 'Cannot change status of a deceased patient.');
      return;
    }

    // For Discharged or Deceased - show polite confirmation modal
    // (Discharged status now also goes through the modal for confirmation)
    setStatusPatient(patient);
    setPendingStatus(status);
    setShowStatusModal(true);
  }, [onPatientUpdate, startProcessing, updateNoteStatus]);

  const confirmStatusUpdate = useCallback(async () => {
    if (!statusPatient || !pendingStatus) return;

    setIsUpdatingStatus(true);
    try {
      const now = new Date().toISOString();
      const updateData: Partial<Patient> = { outcome: pendingStatus };

      // Set release date for Discharged, Deceased, and Referred
      if (['Discharged', 'Deceased', 'Referred'].includes(pendingStatus)) {
        updateData.releaseDate = now;
      }

      // Set final discharge date for Discharged
      if (pendingStatus === 'Discharged') {
        updateData.finalDischargeDate = now;
      }

      // Set step down date
      if (pendingStatus === 'Step Down') {
        updateData.stepDownDate = now;
      }

      // Set death date for Deceased
      if (pendingStatus === 'Deceased') {
        updateData.dateOfDeath = now;
      }

      const patientRef = doc(db, 'patients', statusPatient.id);
      await updateDoc(patientRef, updateData);

      const updatedPatient = { ...statusPatient, ...updateData };

      // Sync to Supabase (background, non-blocking)
      if (institutionId) {
        syncPatientToSupabase(statusPatient.id, updatedPatient as Patient, institutionId)
          .catch(err => console.warn('⚠️ Supabase sync failed (non-critical):', err));
      }

      if (onPatientUpdate) {
        onPatientUpdate(updatedPatient);
      }

      setShowStatusModal(false);

      // For Discharged - open discharge certificate modal
      if (pendingStatus === 'Discharged') {
        showToast('success', 'Patient marked as discharged. Please complete the discharge summary.');
        setDischargeViewMode(false);
        setDischargePatient(updatedPatient);
        setShowDischargeModal(true);
      }
      // For Deceased - open death certificate modal
      else if (pendingStatus === 'Deceased') {
        showToast('success', 'Patient marked as deceased. Please complete the death certificate.');
        setDeathCertificatePatient(updatedPatient);
        setShowDeathCertificateModal(true);
      }
      // For Referred - open referral form to create proper referral document
      else if (pendingStatus === 'Referred') {
        showToast('info', 'Please complete the referral form to send this patient.');
        // Revert the status temporarily - ReferralForm will set it properly
        await updateDoc(patientRef, { outcome: statusPatient.outcome, releaseDate: null });
        setReferPatient(statusPatient);
        setShowReferModal(true);
      }
      else {
        showToast('success', `Patient status updated to ${pendingStatus}`);
      }

      setStatusPatient(null);
      setPendingStatus(null);
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('error', 'Failed to update patient status');
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [statusPatient, pendingStatus, onPatientUpdate]);

  // For active patients - generate discharge summary (called when status is changed to Discharged)
  const handleGenerateDischarge = useCallback((patient: Patient) => {
    setDischargeViewMode(false);
    setDischargePatient(patient);
    setShowDischargeModal(true);
  }, []);

  // For already discharged patients - view/download existing certificate
  const handleViewDischargeCertificate = useCallback((patient: Patient) => {
    setDischargeViewMode(true); // View mode - auto shows preview
    setDischargePatient(patient);
    setShowDischargeModal(true);
  }, []);

  // Direct preview for discharged patients with saved discharge
  const handlePreviewDischarge = useCallback(async (patient: Patient) => {
    if (!patient.savedDischargeSummary) {
      showToast('warning', 'No saved discharge summary found');
      return;
    }

    try {
      const url = await previewDischargeSummaryPDF(patient.savedDischargeSummary, patient);
      // Open in new tab for preview
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error previewing discharge:', error);
      showToast('error', 'Failed to preview discharge certificate');
    }
  }, []);

  // Direct download for discharged patients with saved discharge
  const handleDownloadDischarge = useCallback(async (patient: Patient) => {
    if (!patient.savedDischargeSummary) {
      showToast('warning', 'No saved discharge summary found');
      return;
    }

    try {
      await downloadDischargeSummaryPDF(patient.savedDischargeSummary, patient);
      showToast('success', 'Discharge certificate downloaded');
    } catch (error) {
      console.error('Error downloading discharge:', error);
      showToast('error', 'Failed to download discharge certificate');
    }
  }, []);

  const handleStepDown = useCallback((patient: Patient) => {
    setStepDownPatient(patient);
    setStepDownLocation('');
    setShowStepDownModal(true);
  }, []);

  const confirmStepDown = useCallback(async () => {
    if (!stepDownPatient) return;

    setIsUpdatingStatus(true);
    try {
      const now = new Date().toISOString();
      const updateData: Partial<Patient> = {
        outcome: 'Step Down',
        stepDownDate: now,
        stepDownLocation: stepDownLocation || undefined
      };

      const patientRef = doc(db, 'patients', stepDownPatient.id);
      await updateDoc(patientRef, updateData);

      const updatedPatient = { ...stepDownPatient, ...updateData };

      // Sync to Supabase (background, non-blocking)
      if (institutionId) {
        syncPatientToSupabase(stepDownPatient.id, updatedPatient as Patient, institutionId)
          .catch(err => console.warn('⚠️ Supabase sync failed (non-critical):', err));
      }

      if (onPatientUpdate) {
        onPatientUpdate(updatedPatient);
      }

      showToast('success', 'Patient stepped down successfully');
      setShowStepDownModal(false);
      setStepDownPatient(null);
      setStepDownLocation('');
    } catch (error) {
      console.error('Error stepping down patient:', error);
      showToast('error', 'Failed to step down patient');
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [stepDownPatient, stepDownLocation, onPatientUpdate]);

  const handleRefer = useCallback((patient: Patient) => {
    setReferPatient(patient);
    setShowReferModal(true);
  }, []);

  const handleReferralSuccess = useCallback(() => {
    // Reload patients or update the list
    if (onPatientUpdate && referPatient) {
      // The patient status will be updated by ReferralForm
      const updatedPatient = { ...referPatient, outcome: 'Referred' as PatientOutcome };
      onPatientUpdate(updatedPatient);
    }
    setShowReferModal(false);
    setReferPatient(null);
    showToast('success', 'Patient referral sent successfully');
  }, [referPatient, onPatientUpdate]);

  const handleDeathCertificate = useCallback((patient: Patient) => {
    setDeathCertificatePatient(patient);
    setShowDeathCertificateModal(true);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm w-full overflow-hidden">
        <div className="px-4 py-3 w-full max-w-full overflow-hidden">
          <div className="flex items-center justify-between w-full overflow-hidden">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                onClick={onBack}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-slate-700"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-900">Patient Registry</h1>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">{selectedUnit}</span>
                </div>
                <p className="text-sm text-slate-500">
                  {filteredPatients.length} of {unitPatients.length} patients
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Filter Button */}
              <button
                onClick={() => setShowFilterDrawer(true)}
                className={`lg:hidden relative p-2 rounded-lg transition-all ${
                  hasActiveFilters
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Filter className="w-5 h-5" />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>

              {/* Admin Delete */}
              {isAdmin && institutionId && !selectionMode && (
                <button
                  onClick={() => setSelectionMode(true)}
                  className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  title="Bulk Delete"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Selection Mode Toolbar */}
      <AnimatePresence>
        {selectionMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-shrink-0 bg-red-500 text-white shadow-md"
          >
            <div className="px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setSelectionMode(false);
                      clearSelection();
                    }}
                    className="p-1.5 hover:bg-red-600 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <span className="font-bold text-lg">{selectedPatientIds.size} selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllFiltered}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Select All ({filteredPatients.length})
                  </button>
                  {selectedPatientIds.size > 0 && (
                    <>
                      <button
                        onClick={clearSelection}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-1.5 bg-white text-red-600 hover:bg-red-50 rounded-lg text-sm font-bold transition-colors"
                      >
                        Delete Selected
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 w-full max-w-full">
        {/* Left Sidebar - Desktop Filters */}
        <aside className="hidden lg:flex lg:flex-col w-72 xl:w-80 flex-shrink-0 bg-white border-r border-slate-200 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">
            {/* Stats Summary */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 text-white">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Patient Overview</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-slate-400">Total</p>
                </div>
                <div className="bg-blue-500/20 rounded-lg p-3">
                  <p className="text-2xl font-bold text-blue-400">{stats.inProgress}</p>
                  <p className="text-xs text-blue-300">Active</p>
                </div>
                <div className="bg-green-500/20 rounded-lg p-3">
                  <p className="text-2xl font-bold text-green-400">{stats.discharged}</p>
                  <p className="text-xs text-green-300">Discharged</p>
                </div>
                <div className="bg-red-500/20 rounded-lg p-3">
                  <p className="text-2xl font-bold text-red-400">{stats.deceased}</p>
                  <p className="text-xs text-red-300">Deceased</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-purple-500/20 rounded-lg p-3">
                  <p className="text-xl font-bold text-purple-400">{stats.referred}</p>
                  <p className="text-xs text-purple-300">Referred</p>
                </div>
                <div className="bg-amber-500/20 rounded-lg p-3">
                  <p className="text-xl font-bold text-amber-400">{stats.stepDown}</p>
                  <p className="text-xs text-amber-300">Step Down</p>
                </div>
              </div>
              {/* Observation Patients */}
              {observationPatients.length > 0 && (
                <div className="mt-3 bg-orange-500/20 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xl font-bold text-orange-400">{observationPatients.length}</p>
                      <p className="text-xs text-orange-300">Under Observation</p>
                    </div>
                    <Clock className="w-6 h-6 text-orange-400 opacity-60" />
                  </div>
                </div>
              )}
            </div>

            {/* Date Filter */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-blue-500" />
                <h3 className="font-bold text-slate-900">Date Range</h3>
              </div>
              <DateFilter onFilterChange={setDateFilter} />
            </div>

            {/* Shift Filter */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-blue-500" />
                <h3 className="font-bold text-slate-900">Shift Filter</h3>
              </div>
              <ShiftFilter onFilterChange={setShiftFilter} />
            </div>

            {/* NICU View */}
            {(selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Stethoscope className="w-4 h-4 text-blue-500" />
                  <h3 className="font-bold text-slate-900">Admission Type</h3>
                </div>
                <NicuViewSelection selectedView={nicuView} onSelectView={setNicuView} />
              </div>
            )}

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setDateFilter({ period: 'All Time' });
                  setShiftFilter({ enabled: false, startTime: '08:00', endTime: '20:00' });
                  setNicuView('All');
                }}
                className="w-full py-2 text-red-600 hover:text-red-700 text-sm font-semibold border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Clear All Filters
              </button>
            )}
          </div>
        </aside>

        {/* Main Patient List Area */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
          {/* Search and Filter Bar */}
          <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-3">
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              )}
            </div>

            {/* Status Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {statusOptions.map((status) => {
                const getCount = () => {
                  switch (status.value) {
                    case 'All': return stats.all;
                    case 'Observation': return observationPatients.length;
                    case 'Admission': return stats.admission;
                    case 'In Progress': return stats.inProgress;
                    case 'Discharged': return stats.discharged;
                    case 'Deceased': return stats.deceased;
                    case 'Referred': return stats.referred;
                    case 'Step Down': return stats.stepDown;
                    default: return 0;
                  }
                };
                const count = getCount();
                const isActiveStatus = outcomeFilter === status.value;

                return (
                  <button
                    key={status.value}
                    onClick={() => setOutcomeFilter(status.value)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActiveStatus
                        ? `${status.bgColor} ${status.color} shadow-sm`
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{status.icon}</span>
                    <span className="hidden sm:inline">{status.label}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                      isActiveStatus ? 'bg-white/50' : 'bg-slate-100'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lazy Load Banner */}
          {isLazyLoaded && onLoadAllPatients && (
            <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Showing recent {patients.length} patients for faster loading</span>
              </div>
              <button
                onClick={onLoadAllPatients}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-colors"
              >
                Load All Patients
              </button>
            </div>
          )}

          {/* Patient List / Observation Content */}
          <div className="flex-1 min-h-0 overflow-x-hidden">
            {outcomeFilter === 'Observation' ? (
              // Observation Patients View
              <div className="h-full flex flex-col">
                {/* Active/History Sub-tabs */}
                <div className="flex-shrink-0 px-4 py-3 bg-white border-b border-slate-200">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setObservationView('active')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                        observationView === 'active'
                          ? 'bg-orange-500 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      Active
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        observationView === 'active' ? 'bg-white/30' : 'bg-slate-200'
                      }`}>
                        {filteredActiveObservations.length}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setObservationView('history');
                        if (!observationHistoryLoaded && onLoadObservationHistory) {
                          onLoadObservationHistory();
                        }
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                        observationView === 'history'
                          ? 'bg-slate-700 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      History
                    </button>
                  </div>
                </div>

                {/* Observation Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {observationView === 'active' ? (
                    // Active Observations
                    filteredActiveObservations.length > 0 ? (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredActiveObservations.map((obs) => (
                          <motion.div
                            key={obs.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-xl border-2 border-orange-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
                          >
                            {/* Card Header */}
                            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-white">
                              <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-bold truncate">{obs.babyName}</h4>
                                  <p className="text-xs text-orange-100">Mother: {obs.motherName}</p>
                                </div>
                                <div className="flex-shrink-0 ml-2">
                                  <div className="bg-white/20 rounded-lg px-2 py-1">
                                    <div className="text-xs text-orange-100">Duration</div>
                                    <div className="font-bold text-sm">{calculateObservationDuration(obs.dateOfObservation)}</div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-4 space-y-3">
                              {/* Info Grid */}
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-slate-500 text-xs">DOB</span>
                                  <p className="font-medium text-slate-700">
                                    {new Date(obs.dateOfBirth).toLocaleDateString()}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-slate-500 text-xs">Started</span>
                                  <p className="font-medium text-slate-700">
                                    {formatObservationTime(obs.dateOfObservation)}
                                  </p>
                                </div>
                                {obs.gender && (
                                  <div>
                                    <span className="text-slate-500 text-xs">Gender</span>
                                    <p className="font-medium text-slate-700">{obs.gender}</p>
                                  </div>
                                )}
                                {obs.birthWeight && (
                                  <div>
                                    <span className="text-slate-500 text-xs">Weight</span>
                                    <p className="font-medium text-slate-700">{obs.birthWeight}g</p>
                                  </div>
                                )}
                              </div>

                              {/* Reason */}
                              <div className="bg-orange-50 rounded-lg p-2">
                                <span className="text-xs text-orange-600 font-medium">Reason</span>
                                <p className="text-sm text-slate-700 mt-0.5 line-clamp-2">{obs.reasonForObservation}</p>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex gap-2 pt-2">
                                <button
                                  onClick={() => onConvertObservationToAdmission?.(obs)}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-sm transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                  </svg>
                                  Admit
                                </button>
                                <button
                                  onClick={() => onHandoverObservation?.(obs)}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium text-sm transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                  </svg>
                                  Handover
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center max-w-md">
                          <div className="flex justify-center mb-6">
                            <div className="p-6 bg-orange-100 rounded-3xl">
                              <Clock className="w-16 h-16 text-orange-400" />
                            </div>
                          </div>
                          <h3 className="text-2xl font-bold text-slate-900 mb-3">No Active Observations</h3>
                          <p className="text-slate-500 mb-4">
                            {searchQuery
                              ? `No results matching "${searchQuery}"`
                              : hasActiveFilters
                              ? 'No active observations match the current filters'
                              : 'No babies are currently under observation in this unit.'}
                          </p>
                          {(searchQuery || hasActiveFilters) && (
                            <button
                              onClick={() => {
                                setSearchQuery('');
                                setDateFilter({ period: 'All Time' });
                                setShiftFilter({ enabled: false, startTime: '08:00', endTime: '20:00' });
                              }}
                              className="px-4 py-2 bg-orange-200 hover:bg-orange-300 text-orange-700 rounded-lg font-medium text-sm transition-colors"
                            >
                              Clear Filters
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  ) : (
                    // Observation History
                    loadingObservationHistory ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
                          <p className="text-slate-500">Loading observation history...</p>
                        </div>
                      </div>
                    ) : filteredObservationHistory.length > 0 ? (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredObservationHistory.map((obs) => (
                          <motion.div
                            key={obs.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                          >
                            {/* Card Header */}
                            <div className={`px-4 py-3 text-white ${
                              obs.outcome === ObservationOutcome.HandedOverToMother
                                ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                                : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-bold truncate">{obs.babyName}</h4>
                                  <p className="text-xs opacity-80">Mother: {obs.motherName}</p>
                                </div>
                                <div className="flex-shrink-0 ml-2">
                                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                    obs.outcome === ObservationOutcome.HandedOverToMother
                                      ? 'bg-white/20'
                                      : 'bg-white/20'
                                  }`}>
                                    {obs.outcome === ObservationOutcome.HandedOverToMother ? 'Handed Over' : 'Admitted'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-4 space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-500">Duration</span>
                                <span className="font-medium text-slate-700">
                                  {obs.observationDurationHours ? `${obs.observationDurationHours}h ` : ''}
                                  {obs.observationDurationMinutes ? `${obs.observationDurationMinutes}m` : '< 1m'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Observation Date</span>
                                <span className="font-medium text-slate-700">
                                  {new Date(obs.dateOfObservation).toLocaleDateString()}
                                </span>
                              </div>
                              {obs.dischargedAt && (
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Completed</span>
                                  <span className="font-medium text-slate-700">
                                    {new Date(obs.dischargedAt).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center max-w-md">
                          <div className="flex justify-center mb-6">
                            <div className="p-6 bg-slate-100 rounded-3xl">
                              <svg className="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          </div>
                          <h3 className="text-2xl font-bold text-slate-900 mb-3">No Observation History</h3>
                          <p className="text-slate-500 mb-4">
                            {searchQuery
                              ? `No results matching "${searchQuery}"`
                              : hasActiveFilters
                              ? 'No completed observations match the current filters'
                              : 'No completed observation records found.'}
                          </p>
                          {(searchQuery || hasActiveFilters) && (
                            <button
                              onClick={() => {
                                setSearchQuery('');
                                setDateFilter({ period: 'All Time' });
                                setShiftFilter({ enabled: false, startTime: '08:00', endTime: '20:00' });
                              }}
                              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium text-sm transition-colors"
                            >
                              Clear Filters
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : filteredPatients.length > 0 ? (
              <VirtualizedPatientList
                  patients={filteredPatients}
                  onView={onViewDetails}
                  onEdit={onEdit}
                  canEdit={canEdit}
                  onQuickRecord={canEdit ? handleQuickRecord : undefined}
                  onUpdateStatus={canEdit ? handleUpdateStatus : undefined}
                  onGenerateDischarge={canEdit ? handleGenerateDischarge : undefined}
                  onViewDischargeCertificate={handleViewDischargeCertificate}
                  onPreviewDischarge={handlePreviewDischarge}
                  onDownloadDischarge={handleDownloadDischarge}
                  onDeathCertificate={canEdit ? handleDeathCertificate : undefined}
                  onStepDown={canEdit ? handleStepDown : undefined}
                  onRefer={canEdit ? handleRefer : undefined}
                  selectionMode={selectionMode}
                  selectedIds={selectedPatientIds}
                  onToggleSelection={togglePatientSelection}
                />
            ) : (
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                  <div className="flex justify-center mb-6">
                    <div className="p-6 bg-slate-100 rounded-3xl">
                      <Users className="w-16 h-16 text-slate-400" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">No Patients Found</h3>
                  <p className="text-slate-500 mb-6">
                    {searchQuery
                      ? `No results matching "${searchQuery}"`
                      : outcomeFilter !== 'All'
                      ? `No patients with "${outcomeFilter}" status`
                      : 'No patients available in this unit'}
                  </p>
                  {(outcomeFilter !== 'In Progress' || searchQuery || hasActiveFilters) && (
                    <button
                      onClick={() => {
                        setOutcomeFilter('In Progress');
                        setSearchQuery('');
                        setDateFilter({ period: 'All Time' });
                        setShiftFilter({ enabled: false, startTime: '08:00', endTime: '20:00' });
                        setNicuView('All');
                      }}
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors"
                    >
                      Reset All Filters
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Filter Drawer - Slide from Right */}
      <AnimatePresence>
        {showFilterDrawer && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilterDrawer(false)}
              className="fixed inset-0 bg-black/40 z-[60]"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-[61] flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  <h2 className="text-lg font-bold">Filters</h2>
                </div>
                <button
                  onClick={() => setShowFilterDrawer(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Drawer Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Stats Summary */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 text-white">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Overview</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white/10 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold">{stats.total}</p>
                      <p className="text-[10px] text-slate-400">Total</p>
                    </div>
                    <div className="bg-blue-500/20 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-blue-400">{stats.inProgress}</p>
                      <p className="text-[10px] text-blue-300">Active</p>
                    </div>
                    <div className="bg-green-500/20 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-green-400">{stats.discharged}</p>
                      <p className="text-[10px] text-green-300">Discharged</p>
                    </div>
                  </div>
                  {observationPatients.length > 0 && (
                    <div className="mt-2 bg-orange-500/20 rounded-lg p-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-orange-400" />
                        <p className="text-[10px] text-orange-300">Observation</p>
                      </div>
                      <p className="text-lg font-bold text-orange-400">{observationPatients.length}</p>
                    </div>
                  )}
                </div>

                {/* Date Filter */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <h3 className="font-bold text-slate-900">Date Range</h3>
                  </div>
                  <DateFilter onFilterChange={setDateFilter} />
                </div>

                {/* Shift Filter */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <h3 className="font-bold text-slate-900">Shift Filter</h3>
                  </div>
                  <ShiftFilter onFilterChange={setShiftFilter} />
                </div>

                {/* NICU View */}
                {(selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Stethoscope className="w-4 h-4 text-blue-500" />
                      <h3 className="font-bold text-slate-900">Admission Type</h3>
                    </div>
                    <NicuViewSelection selectedView={nicuView} onSelectView={setNicuView} />
                  </div>
                )}
              </div>

              {/* Fixed Footer Buttons */}
              <div className="flex-shrink-0 p-4 border-t border-slate-200 bg-white space-y-2">
                <button
                  onClick={() => setShowFilterDrawer(false)}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-bold shadow-lg transition-all"
                >
                  Apply Filters
                </button>

                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      setDateFilter({ period: 'All Time' });
                      setShiftFilter({ enabled: false, startTime: '08:00', endTime: '20:00' });
                      setNicuView('All');
                      setShowFilterDrawer(false);
                    }}
                    className="w-full py-2 text-red-600 hover:text-red-700 text-sm font-semibold hover:bg-red-50 rounded-xl transition-colors"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Confirm Deletion</h3>
                  <p className="text-sm text-slate-500">This action cannot be undone</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-800 font-medium text-sm">
                  You are about to permanently delete <span className="font-bold">{selectedPatientIds.size}</span> patient record{selectedPatientIds.size !== 1 ? 's' : ''}.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    `Delete ${selectedPatientIds.size}`
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Record Modal */}
      <AnimatePresence>
        {quickRecordPatient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-0 md:p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25 }}
              className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-4xl h-full md:h-auto md:max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-teal-500 to-emerald-600 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Mic className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Quick Voice Note</h3>
                    <p className="text-xs text-white/80">{quickRecordPatient.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setQuickRecordPatient(null)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto h-[calc(100vh-60px)] md:max-h-[calc(90vh-80px)] p-2 md:p-4">
                <ProgressNoteForm
                  onSave={handleQuickRecordSave}
                  onCancel={() => setQuickRecordPatient(null)}
                  onBackgroundSave={handleQuickRecordBackgroundSave}
                  onProcessingStart={handleProcessingStart}
                  onProcessingComplete={handleProcessingComplete}
                  onProcessingError={handleProcessingError}
                  onUpdatePatient={(updatedPatient) => {
                    // Only update parent - don't call setQuickRecordPatient here
                    // as it causes the modal to reopen after saving
                    if (onPatientUpdate) {
                      onPatientUpdate(updatedPatient);
                    }
                  }}
                  userEmail={userEmail}
                  userName={userName}
                  patient={quickRecordPatient}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Update Confirmation Modal */}
      <AnimatePresence>
        {showStatusModal && statusPatient && pendingStatus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => !isUpdatingStatus && setShowStatusModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-full ${
                  pendingStatus === 'Deceased' ? 'bg-red-100' :
                  pendingStatus === 'Discharged' ? 'bg-green-100' :
                  pendingStatus === 'Step Down' ? 'bg-amber-100' :
                  pendingStatus === 'Referred' ? 'bg-purple-100' : 'bg-blue-100'
                }`}>
                  {pendingStatus === 'Deceased' ? <UserX className="w-6 h-6 text-red-600" /> :
                   pendingStatus === 'Discharged' ? <CheckCircle className="w-6 h-6 text-green-600" /> :
                   pendingStatus === 'Step Down' ? <ArrowDownCircle className="w-6 h-6 text-amber-600" /> :
                   pendingStatus === 'Referred' ? <Send className="w-6 h-6 text-purple-600" /> :
                   <Activity className="w-6 h-6 text-blue-600" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Update Patient Status</h3>
                  <p className="text-sm text-slate-500">{statusPatient.name}</p>
                </div>
              </div>

              <div className={`rounded-lg p-4 mb-6 ${
                pendingStatus === 'Deceased' ? 'bg-red-50 border border-red-200' :
                pendingStatus === 'Discharged' ? 'bg-green-50 border border-green-200' :
                pendingStatus === 'Step Down' ? 'bg-amber-50 border border-amber-200' :
                pendingStatus === 'Referred' ? 'bg-purple-50 border border-purple-200' : 'bg-blue-50 border border-blue-200'
              }`}>
                {pendingStatus === 'Discharged' ? (
                  <div className="space-y-2">
                    <p className="font-medium text-sm text-green-800">
                      Are you sure you want to discharge <span className="font-bold">{statusPatient.name}</span>?
                    </p>
                    <p className="text-xs text-green-700">
                      This will mark the baby as discharged and you will be asked to complete the discharge summary.
                    </p>
                  </div>
                ) : pendingStatus === 'Deceased' ? (
                  <div className="space-y-2">
                    <p className="font-medium text-sm text-red-800">
                      We are sorry to hear this. Are you confirming that <span className="font-bold">{statusPatient.name}</span> has passed away?
                    </p>
                    <p className="text-xs text-red-700">
                      You will be asked to complete the death certificate (MCCD Form 4).
                    </p>
                  </div>
                ) : (
                  <p className={`font-medium text-sm ${
                    pendingStatus === 'Step Down' ? 'text-amber-800' :
                    pendingStatus === 'Referred' ? 'text-purple-800' : 'text-blue-800'
                  }`}>
                    Change status from <span className="font-bold">{statusPatient.outcome}</span> to <span className="font-bold">{pendingStatus}</span>?
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowStatusModal(false)}
                  disabled={isUpdatingStatus}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStatusUpdate}
                  disabled={isUpdatingStatus}
                  className={`flex-1 px-4 py-2 text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 ${
                    pendingStatus === 'Deceased' ? 'bg-red-600 hover:bg-red-700' :
                    pendingStatus === 'Discharged' ? 'bg-green-600 hover:bg-green-700' :
                    pendingStatus === 'Step Down' ? 'bg-amber-600 hover:bg-amber-700' :
                    pendingStatus === 'Referred' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isUpdatingStatus ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Confirm'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step Down Modal */}
      <AnimatePresence>
        {showStepDownModal && stepDownPatient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => !isUpdatingStatus && setShowStepDownModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-amber-100 rounded-full">
                  <ArrowDownCircle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Step Down Care</h3>
                  <p className="text-sm text-slate-500">{stepDownPatient.name}</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Step Down Location (Optional)</label>
                  <input
                    type="text"
                    value={stepDownLocation}
                    onChange={(e) => setStepDownLocation(e.target.value)}
                    placeholder="e.g., Mother Side, Ward, etc."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowStepDownModal(false)}
                  disabled={isUpdatingStatus}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmStepDown}
                  disabled={isUpdatingStatus}
                  className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUpdatingStatus ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Confirm Step Down'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Refer Patient Modal - Using Full Referral Form */}
      {showReferModal && referPatient && institutionId && (
        <ReferralForm
          patient={referPatient}
          currentInstitutionId={institutionId}
          currentInstitutionName={institutionName}
          userEmail={userEmail}
          userRole={userRole}
          userName={userName}
          onClose={() => {
            setShowReferModal(false);
            setReferPatient(null);
          }}
          onSuccess={handleReferralSuccess}
          onShowReferrals={onShowReferrals}
        />
      )}

      {/* Discharge Summary Modal */}
      {showDischargeModal && dischargePatient && (
        <DischargeSummaryModal
          patient={dischargePatient}
          onClose={() => {
            setShowDischargeModal(false);
            setDischargePatient(null);
            setDischargeViewMode(false);
          }}
          onPatientUpdate={onPatientUpdate}
          userName={userName}
          userRole={userRole}
          viewMode={dischargeViewMode}
        />
      )}

      {/* Death Certificate Modal (MCCD Form 4) */}
      {showDeathCertificateModal && deathCertificatePatient && (
        <DeathCertificateModal
          patient={deathCertificatePatient}
          onClose={() => {
            setShowDeathCertificateModal(false);
            setDeathCertificatePatient(null);
          }}
          onPatientUpdate={onPatientUpdate}
          userName={userName}
          userDesignation={userRole}
          institutionName={deathCertificatePatient.institutionName}
          doctors={doctors}
          viewMode={!!deathCertificatePatient.savedDeathCertificate}
        />
      )}
    </div>
  );
};

export default PatientDetailsPage;
