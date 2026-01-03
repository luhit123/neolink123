import React, { useState, useMemo } from 'react';
import { Patient, Unit, UserRole } from '../types';
import CollapsiblePatientCard from './CollapsiblePatientCard';
import DateFilter, { DateFilterValue } from './DateFilter';
import PatientFilters, { OutcomeFilter } from './PatientFilters';
import NicuViewSelection from './NicuViewSelection';

interface PatientDetailsPageProps {
  patients: Patient[];
  selectedUnit: Unit;
  onBack: () => void;
  onViewDetails: (patient: Patient) => void;
  onEdit: (patient: Patient) => void;
  userRole: UserRole;
  allRoles?: UserRole[];
}

const PatientDetailsPage: React.FC<PatientDetailsPageProps> = ({
  patients,
  selectedUnit,
  onBack,
  onViewDetails,
  onEdit,
  userRole,
  allRoles
}) => {
  // Helper function to check if user has a specific role
  const hasRole = (role: UserRole) => {
    return userRole === role || (allRoles && allRoles.includes(role));
  };

  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ period: 'This Month' });
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('All');
  const [nicuView, setNicuView] = useState<'All' | 'Inborn' | 'Outborn'>('All');

  // Filter patients by unit, date, and NICU view
  const unitPatients = useMemo(() => {
    let baseFiltered = patients.filter(p => p.unit === selectedUnit);

    if ((selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) && nicuView !== 'All') {
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
      endDate = new Date(year, month, 0);
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
          firstDayOfWeek.setDate(now.getDate() - now.getDay());
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

      // For In Progress patients: show if they were admitted before/during the period
      // AND are still in progress (not discharged or discharged after the period starts)
      if (p.outcome === 'In Progress') {
        const isAdmittedBeforeOrDuringPeriod = admissionDate <= endDate;
        const releaseDate = p.releaseDate || p.finalDischargeDate;
        const stillInProgressDuringPeriod = !releaseDate || new Date(releaseDate) >= startDate;
        return isAdmittedBeforeOrDuringPeriod && stillInProgressDuringPeriod;
      }

      // For Referred patients: filter by release date if available, otherwise admission date
      if (p.outcome === 'Referred') {
        if (p.releaseDate) {
          const referralDate = new Date(p.releaseDate);
          return referralDate >= startDate && referralDate <= endDate;
        }
        // If no release date, fall back to admission date
        return admissionDate >= startDate && admissionDate <= endDate;
      }

      // For Deceased patients: filter by release date if available, otherwise admission date
      if (p.outcome === 'Deceased') {
        if (p.releaseDate) {
          const deathDate = new Date(p.releaseDate);
          return deathDate >= startDate && deathDate <= endDate;
        }
        // If no release date, fall back to admission date
        return admissionDate >= startDate && admissionDate <= endDate;
      }

      // Default: filter by admission date
      return admissionDate >= startDate && admissionDate <= endDate;
    });
  }, [patients, selectedUnit, nicuView, dateFilter]);

  // Apply outcome filter
  const filteredPatients = useMemo(() => {
    if (outcomeFilter === 'All') return unitPatients;
    return unitPatients.filter(p => p.outcome === outcomeFilter);
  }, [unitPatients, outcomeFilter]);

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

  // Permission check
  const canEdit = hasRole(UserRole.Doctor);

  return (
    <div className="min-h-screen bg-sky-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg sticky top-0 z-30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-all duration-200 backdrop-blur-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-semibold">Back to Dashboard</span>
            </button>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold">Patient Details</h1>
              <p className="text-sky-100 text-sm md:text-base">{selectedUnit} Unit - View and manage all patients</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Date Filter */}
        <div className="bg-white rounded-xl shadow-md border border-sky-200 p-6 transition-all duration-200 hover:shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h2 className="text-lg font-bold text-sky-900">Date Range Filter</h2>
          </div>
          <DateFilter onFilterChange={setDateFilter} />
        </div>

        {/* Status Filter */}
        <div className="bg-white rounded-xl shadow-md border border-sky-200 p-6 transition-all duration-200 hover:shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <h2 className="text-lg font-bold text-sky-900">Patient Status Filter</h2>
          </div>
          <PatientFilters
            selectedOutcome={outcomeFilter}
            onOutcomeChange={setOutcomeFilter}
            counts={stats}
          />
        </div>

        {/* NICU/SNCU View Selection (conditional) */}
        {(selectedUnit === Unit.NICU || selectedUnit === Unit.SNCU) && (
          <div className="bg-white rounded-xl shadow-md border border-sky-200 p-6 transition-all duration-200 hover:shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h2 className="text-lg font-bold text-sky-900">{selectedUnit} Admission Type</h2>
            </div>
            <NicuViewSelection nicuView={nicuView} setNicuView={setNicuView} />
          </div>
        )}

        {/* Patient Count Summary */}
        <div className="bg-gradient-to-r from-sky-500 to-blue-500 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <div>
                <h3 className="text-sm opacity-90">Showing Patients</h3>
                <p className="text-3xl font-bold">{filteredPatients.length}</p>
              </div>
            </div>
            {outcomeFilter !== 'All' && (
              <button
                onClick={() => setOutcomeFilter('All')}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-all duration-200 backdrop-blur-sm text-sm font-semibold"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

        {/* Patient Cards */}
        {filteredPatients.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-sky-900 flex items-center gap-2">
              <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Patient Records
            </h2>
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
              {filteredPatients.map((patient) => (
                <div key={patient.id} className="transform transition-all duration-200 hover:scale-[1.01]">
                  <CollapsiblePatientCard
                    patient={patient}
                    onView={onViewDetails}
                    onEdit={onEdit}
                    canEdit={canEdit}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="bg-white rounded-xl shadow-md border-2 border-dashed border-sky-300 p-12 text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-sky-100 p-6 rounded-full">
                <svg className="w-16 h-16 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-sky-900 mb-2">No Patients Found</h3>
            <p className="text-sky-600 mb-6">
              {outcomeFilter !== 'All'
                ? `No patients match the selected status filter: ${outcomeFilter}`
                : dateFilter.period !== 'All Time'
                  ? `No patients found for the selected date range: ${dateFilter.period}`
                  : 'No patient records available in this unit.'}
            </p>
            {(outcomeFilter !== 'All' || dateFilter.period !== 'All Time') && (
              <button
                onClick={() => {
                  setOutcomeFilter('All');
                  setDateFilter({ period: 'All Time' });
                }}
                className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-lg transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientDetailsPage;
