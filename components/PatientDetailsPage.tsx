import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Patient, Unit, UserRole, ObservationPatient, ObservationOutcome } from '../types';
import VirtualizedPatientList from './VirtualizedPatientList';
import DateFilter, { DateFilterValue } from './DateFilter';
import ShiftFilter, { ShiftFilterConfigs } from './ShiftFilter';
import { OutcomeFilter } from './PatientFilters';
import NicuViewSelection from './NicuViewSelection';
import { db } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { deleteMultiplePatients } from '../services/firestoreService';
import { X, Filter, Search, ChevronLeft, Users, Calendar, Clock, Stethoscope, TrendingUp, AlertCircle } from 'lucide-react';

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

  const isAdmin = hasRole(UserRole.Admin);
  const canEdit = hasRole(UserRole.Doctor);

  // Status filter options with colors and icons
  const statusOptions: Array<{ value: OutcomeFilter; label: string; color: string; bgColor: string; icon: string }> = [
    { value: 'All', label: 'All', color: 'text-slate-700', bgColor: 'bg-slate-100 border-slate-300', icon: '📊' },
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
      filtered = filtered.filter(p => p.outcome === outcomeFilter);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/30">
      {/* Compact Top Header - Fixed */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onBack}
                className="flex-shrink-0 p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-700" />
              </motion.button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">All Patients</h1>
                <p className="text-xs text-slate-500 truncate">{selectedUnit} Unit</p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Filter Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowFilterDrawer(true)}
                className={`relative p-2 rounded-lg transition-all ${
                  hasActiveFilters
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Filter className="w-5 h-5" />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </motion.button>

              {/* Admin Delete */}
              {isAdmin && institutionId && !selectionMode && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectionMode(true)}
                  className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </motion.button>
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
            className="sticky top-[57px] z-30 bg-red-500 text-white shadow-md"
          >
            <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectionMode(false);
                      clearSelection();
                    }}
                    className="p-1 hover:bg-red-600 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <span className="font-semibold">{selectedPatientIds.size} selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllFiltered}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-medium"
                  >
                    All ({filteredPatients.length})
                  </button>
                  {selectedPatientIds.size > 0 && (
                    <>
                      <button
                        onClick={clearSelection}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-medium"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-2 py-1 bg-white text-red-600 hover:bg-red-50 rounded text-xs font-bold"
                      >
                        Delete
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
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 space-y-3">
        {/* Compact Search */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, diagnosis, NTID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </motion.div>

        {/* Quick Status Chips - Horizontal Scroll */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {statusOptions.map((status) => {
            const count = status.value === 'All' ? stats.all : stats[status.value.toLowerCase().replace(' ', '') as keyof typeof stats] || 0;
            const isActive = outcomeFilter === status.value;

            return (
              <motion.button
                key={status.value}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setOutcomeFilter(status.value)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                  isActive
                    ? `${status.bgColor} ${status.color} shadow-md`
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="mr-1">{status.icon}</span>
                {status.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white/50' : 'bg-slate-100'
                }`}>
                  {count}
                </span>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Stats Bar - Compact */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl shadow-lg p-3 text-white"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <div>
                <p className="text-xs opacity-90">Showing</p>
                <p className="text-2xl font-bold">{filteredPatients.length}</p>
              </div>
            </div>
            {(outcomeFilter !== 'In Progress' || searchQuery || hasActiveFilters) && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setOutcomeFilter('In Progress');
                  setSearchQuery('');
                  setDateFilter({ period: 'All Time' });
                  setShiftFilter({ enabled: false, startTime: '08:00', endTime: '20:00' });
                  setNicuView('All');
                }}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors"
              >
                Reset
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Patient List */}
        {filteredPatients.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden"
          >
            {isLazyLoaded && onLoadAllPatients && (
              <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-amber-700">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Showing recent {patients.length} patients</span>
                </div>
                <button
                  onClick={onLoadAllPatients}
                  className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-medium"
                >
                  Load All
                </button>
              </div>
            )}
            <div style={{ height: '560px' }}>
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
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-xl shadow-lg border-2 border-dashed border-slate-300 p-8 text-center"
          >
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-slate-100 rounded-2xl">
                <Users className="w-12 h-12 text-slate-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Patients Found</h3>
            <p className="text-slate-500 text-sm mb-4">
              {searchQuery
                ? `No results for "${searchQuery}"`
                : outcomeFilter !== 'All'
                ? `No ${outcomeFilter} patients`
                : 'No patients available'}
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
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold"
              >
                Reset Filters
              </button>
            )}
          </motion.div>
        )}
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
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-white shadow-2xl z-50 overflow-y-auto"
            >
              {/* Drawer Header */}
              <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-4 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  <h2 className="text-lg font-bold">Filters</h2>
                </div>
                <button
                  onClick={() => setShowFilterDrawer(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="p-4 space-y-6">
                {/* Date Filter */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <h3 className="font-bold text-slate-900">Date Range</h3>
                  </div>
                  <DateFilter value={dateFilter} onChange={setDateFilter} />
                </div>

                {/* Shift Filter */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <h3 className="font-bold text-slate-900">Shift Filter</h3>
                  </div>
                  <ShiftFilter value={shiftFilter} onChange={setShiftFilter} />
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

                {/* Apply Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowFilterDrawer(false)}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-bold shadow-lg"
                >
                  Apply Filters
                </motion.button>

                {/* Reset Button */}
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      setDateFilter({ period: 'All Time' });
                      setShiftFilter({ enabled: false, startTime: '08:00', endTime: '20:00' });
                      setNicuView('All');
                      setShowFilterDrawer(false);
                    }}
                    className="w-full py-2 text-slate-600 hover:text-slate-900 text-sm font-semibold"
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
    </div>
  );
};

export default PatientDetailsPage;
