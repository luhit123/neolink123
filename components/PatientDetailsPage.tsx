import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Patient, Unit, UserRole, ObservationPatient, ObservationOutcome } from '../types';
import CollapsiblePatientCard from './CollapsiblePatientCard';
import VirtualizedPatientList from './VirtualizedPatientList';
import DateFilter, { DateFilterValue } from './DateFilter';
import ShiftFilter, { ShiftFilterConfigs } from './ShiftFilter';
import PatientFilters, { OutcomeFilter } from './PatientFilters';
import NicuViewSelection from './NicuViewSelection';
import ObservationManagement from './ObservationManagement';
import { glassmorphism } from '../theme/glassmorphism';
import { db } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { deleteMultiplePatients } from '../services/firestoreService';

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
  // Lazy loading props
  isLazyLoaded?: boolean;
  onLoadAllPatients?: () => void;
  // Admin delete props
  institutionId?: string;
  onPatientsDeleted?: () => void;
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
  onPatientsDeleted
}) => {
  // Helper function to check if user has a specific role
  const hasRole = (role: UserRole) => {
    return userRole === role || (allRoles && allRoles.includes(role));
  };

  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ period: 'All Time' });
  const [shiftFilter, setShiftFilter] = useState<ShiftFilterConfigs>({
    enabled: false,
    startTime: '08:00',
    endTime: '20:00'
  });
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('In Progress');
  const [nicuView, setNicuView] = useState<'All' | 'Inborn' | 'Outborn'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Admin multi-select delete state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = hasRole(UserRole.Admin);

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

      // Clear selection and exit selection mode
      setSelectedPatientIds(new Set());
      setSelectionMode(false);
      setShowDeleteConfirm(false);

      // Notify parent to refresh patients
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

  // Filter patients by unit, date, and NICU view
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

          // For discharged patients, filter by discharge date
          if (p.outcome === 'Discharged' && (p.releaseDate || p.finalDischargeDate)) {
            const dischargeDate = new Date(p.finalDischargeDate || p.releaseDate!);
            return dischargeDate >= startDate && dischargeDate <= endDate;
          }

          // For step down patients, filter by step down date
          if (p.outcome === 'Step Down' && p.stepDownDate) {
            const stepDownDate = new Date(p.stepDownDate);
            return stepDownDate >= startDate && stepDownDate <= endDate;
          }

          // For In Progress patients
          if (p.outcome === 'In Progress') {
            const isAdmittedBeforeOrDuringPeriod = admissionDate <= endDate;
            const releaseDate = p.releaseDate || p.finalDischargeDate;
            const stillInProgressDuringPeriod = !releaseDate || new Date(releaseDate) >= startDate;
            return isAdmittedBeforeOrDuringPeriod && stillInProgressDuringPeriod;
          }

          // For Referred patients
          if (p.outcome === 'Referred') {
            if (p.releaseDate) {
              const referralDate = new Date(p.releaseDate);
              return referralDate >= startDate && referralDate <= endDate;
            }
            return admissionDate >= startDate && admissionDate <= endDate;
          }

          // For Deceased patients
          if (p.outcome === 'Deceased') {
            if (p.releaseDate) {
              const deathDate = new Date(p.releaseDate);
              return deathDate >= startDate && deathDate <= endDate;
            }
            return admissionDate >= startDate && admissionDate <= endDate;
          }

          // Default
          return admissionDate >= startDate && admissionDate <= endDate;
        });
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

    return filtered;
  }, [patients, selectedUnit, nicuView, dateFilter, shiftFilter]);

  // Apply outcome filter and search
  const filteredPatients = useMemo(() => {
    let filtered = unitPatients;

    // Apply outcome filter
    if (outcomeFilter !== 'All') {
      filtered = filtered.filter(p => p.outcome === outcomeFilter);
    }

    // Apply search filter
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

  // Calculate stats for filter counts
  const stats = useMemo(() => {
    const total = unitPatients.length;
    const deceased = unitPatients.filter(p => p.outcome === 'Deceased').length;
    const discharged = unitPatients.filter(p => p.outcome === 'Discharged').length;
    const referred = unitPatients.filter(p => p.outcome === 'Referred').length;
    const inProgress = unitPatients.filter(p => p.outcome === 'In Progress').length;
    const stepDown = unitPatients.filter(p => p.outcome === 'Step Down').length;

    return {
      all: total,
      total,
      deceased,
      discharged,
      referred,
      inProgress,
      stepDown
    };
  }, [unitPatients]);

  // Filter observation patients by unit
  const unitObservationPatients = useMemo(() => {
    return observationPatients.filter(p =>
      p.unit === selectedUnit &&
      p.outcome === ObservationOutcome.InObservation
    );
  }, [observationPatients, selectedUnit]);

  // Handle handover to mother
  const handleHandoverToMother = async (patient: ObservationPatient) => {
    if (!confirm(`Hand over ${patient.babyName} to mother?`)) return;

    try {
      await updateDoc(doc(db, 'observationPatients', patient.id), {
        outcome: ObservationOutcome.HandedOverToMother,
        dischargedAt: new Date().toISOString()
      });
      alert('Patient handed over to mother successfully!');
    } catch (error) {
      console.error('Error handing over patient:', error);
      alert('Failed to hand over patient');
    }
  };

  // Handle convert to admission
  const handleConvertToAdmission = async (patient: ObservationPatient) => {
    try {
      // Mark observation as converted
      await updateDoc(doc(db, 'observationPatients', patient.id), {
        outcome: ObservationOutcome.ConvertedToAdmission,
        convertedAt: new Date().toISOString()
      });

      // Call parent's onConvertObservationToAdmission to open the patient form
      if (onConvertObservationToAdmission) {
        onConvertObservationToAdmission(patient);
      }
    } catch (error) {
      console.error('Error converting to admission:', error);
      alert('Failed to convert to admission');
    }
  };

  // Permission check
  const canEdit = hasRole(UserRole.Doctor);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50">
      {/* Premium Header with Glassmorphism */}
      <div className="sticky top-0 z-30 backdrop-blur-2xl bg-white/80 border-b-2 border-sky-200/50 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white px-4 py-2 rounded-xl shadow-md transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-semibold hidden sm:inline">Back</span>
            </motion.button>
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">
                All Patients
              </h1>
              <p className="text-sky-600 text-xs md:text-sm font-medium">{selectedUnit} Unit</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl shadow-md transition-all duration-200 ${
                showFilters
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white'
                  : 'bg-white border-2 border-sky-200 text-sky-600 hover:border-sky-400'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="font-semibold hidden sm:inline">Filters</span>
            </motion.button>

            {/* Admin Delete Button */}
            {isAdmin && institutionId && !selectionMode && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectionMode(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl shadow-md transition-all duration-200 bg-red-500 hover:bg-red-600 text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="font-semibold hidden sm:inline">Delete</span>
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Selection Mode Toolbar */}
      <AnimatePresence>
        {selectionMode && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="sticky top-[72px] z-20 bg-red-500 text-white shadow-lg"
          >
            <div className="container mx-auto px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setSelectionMode(false);
                      clearSelection();
                    }}
                    className="p-2 hover:bg-red-600 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <span className="font-semibold">
                    {selectedPatientIds.size} patient{selectedPatientIds.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllFiltered}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    Select All ({filteredPatients.length})
                  </button>
                  {selectedPatientIds.size > 0 && (
                    <button
                      onClick={clearSelection}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={selectedPatientIds.size === 0}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                      selectedPatientIds.size > 0
                        ? 'bg-white text-red-600 hover:bg-red-50'
                        : 'bg-red-400 text-red-200 cursor-not-allowed'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Selected
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
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
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Confirm Deletion</h3>
                  <p className="text-sm text-slate-500">This action cannot be undone</p>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-800 font-medium">
                  You are about to permanently delete <span className="font-bold">{selectedPatientIds.size}</span> patient record{selectedPatientIds.size !== 1 ? 's' : ''}.
                </p>
                <p className="text-red-600 text-sm mt-2">
                  All associated data including progress notes, vitals, and clinical records will be permanently removed from the database.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete {selectedPatientIds.size} Patient{selectedPatientIds.size !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-4 space-y-4">
        {/* Premium Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="backdrop-blur-xl bg-white/90 rounded-2xl shadow-lg border-2 border-sky-200/50 p-4"
        >
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-sky-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search patients by name, diagnosis, or NTID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border-2 border-sky-200 rounded-xl text-slate-800 placeholder-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-sky-400 hover:text-sky-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </motion.div>

        {/* Quick Status Filter Pills */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="backdrop-blur-xl bg-white/90 rounded-2xl shadow-lg border-2 border-sky-200/50 p-4"
        >
          <PatientFilters
            selectedOutcome={outcomeFilter}
            onOutcomeChange={setOutcomeFilter}
            counts={stats}
          />
        </motion.div>

        {/* Collapsible Advanced Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4 overflow-hidden"
            >
              {/* Date & Shift Filter */}
              <div className="backdrop-blur-xl bg-white/90 rounded-2xl shadow-lg border-2 border-sky-200/50 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-br from-sky-400 to-blue-600 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-sky-900">Date & Shift Filters</h2>
                </div>

                {/* Month and Year Selectors */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-sky-700 mb-2">Select Month</label>
                    <select
                      value={dateFilter.period.match(/^\d{4}-\d{2}$/) ? dateFilter.period.split('-')[1] : ''}
                      onChange={(e) => {
                        const currentYear = dateFilter.period.match(/^\d{4}-\d{2}$/)
                          ? dateFilter.period.split('-')[0]
                          : new Date().getFullYear().toString();
                        if (e.target.value) {
                          setDateFilter({ period: `${currentYear}-${e.target.value}` });
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border-2 border-sky-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                    >
                      <option value="">All Months</option>
                      <option value="01">January</option>
                      <option value="02">February</option>
                      <option value="03">March</option>
                      <option value="04">April</option>
                      <option value="05">May</option>
                      <option value="06">June</option>
                      <option value="07">July</option>
                      <option value="08">August</option>
                      <option value="09">September</option>
                      <option value="10">October</option>
                      <option value="11">November</option>
                      <option value="12">December</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-sky-700 mb-2">Select Year</label>
                    <select
                      value={dateFilter.period.match(/^\d{4}-\d{2}$/) ? dateFilter.period.split('-')[0] : ''}
                      onChange={(e) => {
                        const currentMonth = dateFilter.period.match(/^\d{4}-\d{2}$/)
                          ? dateFilter.period.split('-')[1]
                          : String(new Date().getMonth() + 1).padStart(2, '0');
                        if (e.target.value) {
                          setDateFilter({ period: `${e.target.value}-${currentMonth}` });
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border-2 border-sky-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                    >
                      <option value="">All Years</option>
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-sky-700 mb-2">Quick Filters</label>
                    <select
                      value={dateFilter.period.match(/^\d{4}-\d{2}$/) ? '' : dateFilter.period}
                      onChange={(e) => setDateFilter({ period: e.target.value as any })}
                      className="w-full px-3 py-2 bg-white border-2 border-sky-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
                    >
                      <option value="All Time">All Time</option>
                      <option value="Today">Today</option>
                      <option value="This Week">This Week</option>
                      <option value="This Month">This Month</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                  <ShiftFilter onFilterChange={setShiftFilter} />
                </div>
              </div>

              {/* NICU/SNCU View Selection (conditional) */}
              {(selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) && (
                <div className="backdrop-blur-xl bg-white/90 rounded-2xl shadow-lg border-2 border-sky-200/50 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-gradient-to-br from-sky-400 to-blue-600 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-bold text-sky-900">{selectedUnit} Admission Type</h2>
                  </div>
                  <NicuViewSelection selectedView={nicuView} onSelectView={setNicuView} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Patient Count Summary - Premium Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="backdrop-blur-xl bg-gradient-to-r from-sky-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white border-2 border-white/20"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-lg rounded-xl">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm opacity-90 font-medium">Showing Patients</h3>
                <p className="text-4xl font-bold">{filteredPatients.length}</p>
                <p className="text-xs opacity-80 mt-1">
                  {outcomeFilter !== 'All' ? outcomeFilter : 'All Status'} {searchQuery && '• Search Active'}
                </p>
              </div>
            </div>
            {(outcomeFilter !== 'All' || searchQuery || dateFilter.period !== 'All Time') && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setOutcomeFilter('In Progress');
                  setSearchQuery('');
                  setDateFilter({ period: 'All Time' });
                }}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-lg px-4 py-2 rounded-xl transition-all duration-200 text-sm font-semibold border-2 border-white/30"
              >
                Reset Filters
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Patient List - Premium Virtual Scrolling */}
        {filteredPatients.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="backdrop-blur-xl bg-white/90 rounded-2xl shadow-xl border-2 border-sky-200/50 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-4 flex items-center gap-3">
              <div className="p-2 bg-white/20 backdrop-blur-lg rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">Patient Records</h2>
            </div>
            {/* Lazy Loading Banner */}
            {isLazyLoaded && onLoadAllPatients && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs text-amber-800">Showing recent {patients.length} patients for faster loading</span>
                </div>
                <button
                  onClick={onLoadAllPatients}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Load All
                </button>
              </div>
            )}
            <div style={{ height: isLazyLoaded && onLoadAllPatients ? '560px' : '600px' }} className="bg-gradient-to-br from-sky-50/50 to-blue-50/50">
              <VirtualizedPatientList
                patients={filteredPatients}
                onView={onViewDetails}
                onEdit={onEdit}
                canEdit={canEdit}
                selectionMode={selectionMode}
                selectedIds={selectedPatientIds}
                onToggleSelection={togglePatientSelection}
              />
            </div>
          </motion.div>
        ) : (
          /* Premium Empty State */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="backdrop-blur-xl bg-white/90 rounded-2xl shadow-xl border-2 border-dashed border-sky-300 p-12 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="flex justify-center mb-6"
            >
              <div className="p-8 bg-gradient-to-br from-sky-100 to-blue-100 rounded-3xl shadow-lg">
                <svg className="w-20 h-20 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </motion.div>
            <h3 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent mb-3">
              No Patients Found
            </h3>
            <p className="text-sky-600 text-lg mb-6 max-w-md mx-auto">
              {searchQuery
                ? `No patients match "${searchQuery}"`
                : outcomeFilter !== 'All'
                ? `No ${outcomeFilter} patients found`
                : dateFilter.period !== 'All Time'
                  ? `No patients for ${dateFilter.period}`
                  : 'No patient records available'}
            </p>
            {(outcomeFilter !== 'In Progress' || searchQuery || dateFilter.period !== 'All Time') && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setOutcomeFilter('In Progress');
                  setSearchQuery('');
                  setDateFilter({ period: 'All Time' });
                }}
                className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white px-8 py-3 rounded-xl transition-all duration-200 font-bold shadow-lg hover:shadow-xl"
              >
                Reset to Defaults
              </motion.button>
            )}
          </motion.div>
        )}

        {/* Observation Patients Section - Show Prominently at Top */}
        {unitObservationPatients.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="backdrop-blur-xl bg-gradient-to-br from-amber-50/95 to-orange-50/95 rounded-2xl shadow-2xl border-2 border-amber-300/50 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 backdrop-blur-lg rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">🔍 Observation Patients</h2>
                  <p className="text-amber-100 text-sm">{unitObservationPatients.length} patient{unitObservationPatients.length !== 1 ? 's' : ''} under observation in {selectedUnit}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {unitObservationPatients.map((patient, index) => (
                <motion.div
                  key={patient.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                  className="bg-white/90 backdrop-blur-sm rounded-xl p-5 border-2 border-amber-200 hover:border-amber-400 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-900">{patient.babyName}</h3>
                      <p className="text-sm text-slate-600">Mother: {patient.motherName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-amber-500 text-white text-xs font-semibold rounded-full">
                        {patient.unit}
                      </span>
                      {patient.admissionType && (
                        <span className="px-3 py-1 bg-orange-500 text-white text-xs font-semibold rounded-full">
                          {patient.admissionType}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Date & Time of Birth</p>
                      <p className="text-sm text-slate-900 font-semibold">{new Date(patient.dateOfBirth).toLocaleDateString()}</p>
                      <p className="text-xs text-slate-600">{new Date(patient.dateOfBirth).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Started Observation</p>
                      <p className="text-sm text-slate-900 font-semibold">{new Date(patient.dateOfObservation).toLocaleDateString()}</p>
                      <p className="text-xs text-slate-600">{new Date(patient.dateOfObservation).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-slate-500 font-semibold mb-1">Reason for Observation</p>
                    <p className="text-sm text-slate-900">{patient.reasonForObservation}</p>
                  </div>

                  {/* Action Buttons */}
                  {canEdit && (
                    <div className="flex gap-2 pt-3 border-t border-amber-200">
                      <button
                        onClick={() => handleConvertToAdmission(patient)}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Convert to Admission
                      </button>
                      <button
                        onClick={() => handleHandoverToMother(patient)}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Hand Over to Mother
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PatientDetailsPage;
