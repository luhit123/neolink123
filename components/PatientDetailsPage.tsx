import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Patient, Unit, UserRole, ObservationPatient, ObservationOutcome, ProgressNote } from '../types';
import VirtualizedPatientList from './VirtualizedPatientList';
import DateFilter, { DateFilterValue } from './DateFilter';
import ShiftFilter, { ShiftFilterConfigs } from './ShiftFilter';
import { OutcomeFilter } from './PatientFilters';
import NicuViewSelection from './NicuViewSelection';
import DischargeSummaryModal from './DischargeSummaryModal';
import { downloadDischargeSummaryPDF, previewDischargeSummaryPDF } from '../services/dischargeSummaryService';
import { db } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { deleteMultiplePatients } from '../services/firestoreService';
import { X, Filter, Search, ChevronLeft, Users, Calendar, Clock, Stethoscope, TrendingUp, AlertCircle, Mic, Activity, ArrowDownCircle, Send, CheckCircle, UserX } from 'lucide-react';
import { showToast } from '../utils/toast';
import ProgressNoteForm from './ProgressNoteFormEnhanced';
import { useBackgroundSave } from '../contexts/BackgroundSaveContext';

interface PatientDetailsPageProps {
  patients: Patient[];
  selectedUnit: Unit;
  onBack: () => void;
  onViewDetails: (patient: Patient) => void;
  onEdit: (patient: Patient) => void;
  userRole: UserRole;
  allRoles?: UserRole[];
  observationPatients?: ObservationPatient[];
  onConvertObservationToAdmission?: (observationPatient: ObservationPatient) => void;
  isLazyLoaded?: boolean;
  onLoadAllPatients?: () => void;
  institutionId?: string;
  onPatientsDeleted?: () => void;
  userEmail?: string;
  userName?: string;
  onPatientUpdate?: (patient: Patient) => void;
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
  onConvertObservationToAdmission,
  isLazyLoaded = true,
  onLoadAllPatients,
  institutionId,
  onPatientsDeleted,
  userEmail = '',
  userName = '',
  onPatientUpdate
}) => {
  const hasRole = (role: UserRole) => {
    return userRole === role || (allRoles && allRoles.includes(role));
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

  // Action modal states
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [dischargePatient, setDischargePatient] = useState<Patient | null>(null);
  const [dischargeViewMode, setDischargeViewMode] = useState(false); // true when viewing existing certificate
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusPatient, setStatusPatient] = useState<Patient | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ObservationOutcome | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showStepDownModal, setShowStepDownModal] = useState(false);
  const [stepDownPatient, setStepDownPatient] = useState<Patient | null>(null);
  const [stepDownLocation, setStepDownLocation] = useState('');
  const [showReferModal, setShowReferModal] = useState(false);
  const [referPatient, setReferPatient] = useState<Patient | null>(null);
  const [referLocation, setReferLocation] = useState('');
  const [referReason, setReferReason] = useState('');

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
  const canEdit = hasRole(UserRole.Doctor);

  // Status filter options with colors and icons
  const statusOptions: Array<{ value: OutcomeFilter; label: string; color: string; bgColor: string; icon: string }> = [
    { value: 'All', label: 'All', color: 'text-slate-700', bgColor: 'bg-slate-100 border-slate-300', icon: '📊' },
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
  const handleUpdateStatus = useCallback(async (patient: Patient, status: ObservationOutcome) => {
    // If marking as Discharged, update status and open discharge modal with notification
    if (status === 'Discharged') {
      const saveId = startProcessing(patient.id, patient.name, 'discharge', 'Discharged');

      try {
        const now = new Date().toISOString();
        const updateData: Partial<Patient> = {
          outcome: 'Discharged',
          releaseDate: now,
          finalDischargeDate: now
        };

        // Update Firebase
        const patientRef = doc(db, 'patients', patient.id);
        await updateDoc(patientRef, updateData);

        // Update local state
        const updatedPatient = { ...patient, ...updateData };
        if (onPatientUpdate) {
          onPatientUpdate(updatedPatient);
        }

        // Update notification to ready and open modal
        updateNoteStatus(saveId, 'saved');
        setDischargeViewMode(false); // Not viewing existing, generating new
        setDischargePatient(updatedPatient);
        setShowDischargeModal(true);
      } catch (error) {
        console.error('Error updating status:', error);
        updateNoteStatus(saveId, 'error', 'Failed to update status');
        showToast('error', 'Failed to discharge patient');
      }
      return;
    }

    // For Deceased, we may want to prompt for date/time later
    // For now, show confirmation modal for other statuses
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

      // Set release date for terminal outcomes
      if (['Deceased', 'Referred'].includes(pendingStatus)) {
        updateData.releaseDate = now;
      }

      // Set step down date
      if (pendingStatus === 'Step Down') {
        updateData.stepDownDate = now;
      }

      const patientRef = doc(db, 'patients', statusPatient.id);
      await updateDoc(patientRef, updateData);

      const updatedPatient = { ...statusPatient, ...updateData };
      if (onPatientUpdate) {
        onPatientUpdate(updatedPatient);
      }

      showToast('success', `Patient status updated to ${pendingStatus}`);
      setShowStatusModal(false);
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
  const handlePreviewDischarge = useCallback((patient: Patient) => {
    if (!patient.savedDischargeSummary) {
      showToast('warning', 'No saved discharge summary found');
      return;
    }

    try {
      const url = previewDischargeSummaryPDF(patient.savedDischargeSummary, patient);
      // Open in new tab for preview
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error previewing discharge:', error);
      showToast('error', 'Failed to preview discharge certificate');
    }
  }, []);

  // Direct download for discharged patients with saved discharge
  const handleDownloadDischarge = useCallback((patient: Patient) => {
    if (!patient.savedDischargeSummary) {
      showToast('warning', 'No saved discharge summary found');
      return;
    }

    try {
      downloadDischargeSummaryPDF(patient.savedDischargeSummary, patient);
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
    setReferLocation('');
    setReferReason('');
    setShowReferModal(true);
  }, []);

  const confirmRefer = useCallback(async () => {
    if (!referPatient) return;

    setIsUpdatingStatus(true);
    try {
      const now = new Date().toISOString();
      const updateData: Partial<Patient> = {
        outcome: 'Referred',
        releaseDate: now,
        referredTo: referLocation || undefined,
        referralReason: referReason || undefined
      };

      const patientRef = doc(db, 'patients', referPatient.id);
      await updateDoc(patientRef, updateData);

      const updatedPatient = { ...referPatient, ...updateData };
      if (onPatientUpdate) {
        onPatientUpdate(updatedPatient);
      }

      showToast('success', 'Patient referred successfully');
      setShowReferModal(false);
      setReferPatient(null);
      setReferLocation('');
      setReferReason('');
    } catch (error) {
      console.error('Error referring patient:', error);
      showToast('error', 'Failed to refer patient');
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [referPatient, referLocation, referReason, onPatientUpdate]);

  const handleDeathCertificate = useCallback((patient: Patient) => {
    // For now, just show a toast - death certificate feature will be implemented later
    showToast('info', 'Death certificate feature coming soon');
    // TODO: Implement death certificate modal/PDF generation
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-3">
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
            <div className="flex items-center gap-2">
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
      </div>

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
      <div className="flex-1 flex lg:flex-row overflow-hidden">
        {/* Left Sidebar - Desktop Filters */}
        <aside className="hidden lg:flex lg:flex-col w-72 xl:w-80 bg-white border-r border-slate-200">
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
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
        <main className="flex-1 flex flex-col overflow-hidden">
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

          {/* Patient List */}
          <div className="flex-1 overflow-hidden">
            {filteredPatients.length > 0 ? (
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
                    // Update medications in local state and parent
                    setQuickRecordPatient(updatedPatient);
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
                <p className={`font-medium text-sm ${
                  pendingStatus === 'Deceased' ? 'text-red-800' :
                  pendingStatus === 'Discharged' ? 'text-green-800' :
                  pendingStatus === 'Step Down' ? 'text-amber-800' :
                  pendingStatus === 'Referred' ? 'text-purple-800' : 'text-blue-800'
                }`}>
                  Change status from <span className="font-bold">{statusPatient.outcome}</span> to <span className="font-bold">{pendingStatus}</span>?
                </p>
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

      {/* Refer Patient Modal */}
      <AnimatePresence>
        {showReferModal && referPatient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => !isUpdatingStatus && setShowReferModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-purple-100 rounded-full">
                  <Send className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Refer Patient</h3>
                  <p className="text-sm text-slate-500">{referPatient.name}</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Referred To</label>
                  <input
                    type="text"
                    value={referLocation}
                    onChange={(e) => setReferLocation(e.target.value)}
                    placeholder="Hospital/Facility name"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Referral</label>
                  <textarea
                    value={referReason}
                    onChange={(e) => setReferReason(e.target.value)}
                    placeholder="Briefly describe the reason for referral..."
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowReferModal(false)}
                  disabled={isUpdatingStatus}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRefer}
                  disabled={isUpdatingStatus}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isUpdatingStatus ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Confirm Referral'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </div>
  );
};

export default PatientDetailsPage;
