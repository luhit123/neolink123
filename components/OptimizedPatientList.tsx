/**
 * Optimized Patient List with Lazy Loading
 *
 * Features:
 * - Paginated data loading (20 patients at a time)
 * - Infinite scroll with "Load More" button
 * - Skeleton loading states
 * - Real-time updates only for visible patients
 * - Prefetch on hover
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { motion, AnimatePresence } from 'framer-motion';
import { useInfinitePatients, usePatientRealtime, usePrefetchPatient } from '../hooks/usePatients';
import { PatientCardSkeleton, PatientListSkeleton, LoadMoreButton, EmptyState } from './ui/Skeleton';
import { Patient } from '../types';

interface OptimizedPatientListProps {
  institutionId: string;
  unit?: 'PICU' | 'NICU' | 'SNCU' | 'HDU' | 'GENERAL_WARD';
  nicuType?: 'Inborn' | 'Outborn';
  dateFilter?: 'today' | 'week' | 'month' | 'all';
  outcomeFilter?: string;
  searchTerm?: string;
  onPatientSelect: (patient: Patient) => void;
  selectedPatientId?: string | null;
  compact?: boolean;
  renderPatientCard: (patient: Patient, isSelected: boolean) => React.ReactNode;
}

export const OptimizedPatientList: React.FC<OptimizedPatientListProps> = ({
  institutionId,
  unit,
  nicuType,
  dateFilter = 'all',
  outcomeFilter,
  searchTerm,
  onPatientSelect,
  selectedPatientId,
  compact = false,
  renderPatientCard
}) => {
  const [visiblePatientIds, setVisiblePatientIds] = useState<string[]>([]);

  // Fetch patients with infinite scrolling
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch
  } = useInfinitePatients({
    institutionId,
    unit,
    nicuType,
    dateFilter,
    outcomeFilter,
    searchTerm
  });

  // Real-time updates for visible patients only
  usePatientRealtime(visiblePatientIds);

  // Prefetch patient details on hover
  const prefetchPatient = usePrefetchPatient();

  // Flatten paginated data
  const patients = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.patients);
  }, [data]);

  // Track visible patient IDs for real-time updates
  const handleRangeChange = useCallback((range: { startIndex: number; endIndex: number }) => {
    const visibleIds = patients
      .slice(range.startIndex, range.endIndex + 1)
      .map(p => p.id);
    setVisiblePatientIds(visibleIds);
  }, [patients]);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Loading state - show skeleton
  if (isLoading) {
    return <PatientListSkeleton count={compact ? 8 : 5} compact={compact} />;
  }

  // Error state
  if (isError) {
    return (
      <EmptyState
        icon={
          <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }
        title="Error Loading Patients"
        description={error?.message || 'Something went wrong. Please try again.'}
        action={
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
          >
            Try Again
          </button>
        }
      />
    );
  }

  // Empty state
  if (patients.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        }
        title="No Patients Found"
        description={
          searchTerm
            ? `No patients match "${searchTerm}"`
            : 'No patients in this category yet.'
        }
      />
    );
  }

  // Render patient item
  const PatientItem = ({ index }: { index: number }) => {
    const patient = patients[index];
    if (!patient) return <PatientCardSkeleton compact={compact} />;

    const isSelected = patient.id === selectedPatientId;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.2) }}
        onMouseEnter={() => prefetchPatient(patient.id)}
        onClick={() => onPatientSelect(patient)}
        className="cursor-pointer"
      >
        {renderPatientCard(patient, isSelected)}
      </motion.div>
    );
  };

  // Footer component for load more
  const Footer = () => {
    if (!hasNextPage && patients.length > 0) {
      return (
        <p className="text-center text-slate-500 dark:text-slate-400 text-sm py-6">
          Showing all {patients.length} patients
        </p>
      );
    }

    return (
      <div className="py-4">
        <LoadMoreButton
          onClick={handleLoadMore}
          loading={isFetchingNextPage}
          hasMore={hasNextPage}
        />
      </div>
    );
  };

  return (
    <div className="h-full">
      <Virtuoso
        style={{ height: '100%' }}
        data={patients}
        rangeChanged={handleRangeChange}
        overscan={5}
        increaseViewportBy={{ top: 200, bottom: 200 }}
        itemContent={(index) => (
          <div className={compact ? 'py-1' : 'py-2'}>
            <PatientItem index={index} />
          </div>
        )}
        components={{
          Footer
        }}
      />
    </div>
  );
};

/**
 * Simple patient list without virtualization (for smaller lists)
 */
export const SimpleOptimizedPatientList: React.FC<OptimizedPatientListProps> = (props) => {
  const {
    institutionId,
    unit,
    nicuType,
    dateFilter = 'all',
    outcomeFilter,
    searchTerm,
    onPatientSelect,
    selectedPatientId,
    compact = false,
    renderPatientCard
  } = props;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch
  } = useInfinitePatients({
    institutionId,
    unit,
    nicuType,
    dateFilter,
    outcomeFilter,
    searchTerm
  });

  const prefetchPatient = usePrefetchPatient();

  const patients = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page.patients);
  }, [data]);

  // Real-time updates for all loaded patients
  const patientIds = useMemo(() => patients.map(p => p.id), [patients]);
  usePatientRealtime(patientIds.slice(0, 20));

  if (isLoading) {
    return <PatientListSkeleton count={compact ? 8 : 5} compact={compact} />;
  }

  if (isError) {
    return (
      <EmptyState
        icon={
          <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }
        title="Error Loading Patients"
        action={
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
          >
            Try Again
          </button>
        }
      />
    );
  }

  if (patients.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        }
        title="No Patients Found"
        description={searchTerm ? `No patients match "${searchTerm}"` : 'No patients in this category yet.'}
      />
    );
  }

  return (
    <div className={`space-y-${compact ? '2' : '3'}`}>
      <AnimatePresence mode="popLayout">
        {patients.map((patient, index) => (
          <motion.div
            key={patient.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
            onMouseEnter={() => prefetchPatient(patient.id)}
            onClick={() => onPatientSelect(patient)}
            className="cursor-pointer"
          >
            {renderPatientCard(patient, patient.id === selectedPatientId)}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Load More */}
      {(hasNextPage || isFetchingNextPage) && (
        <LoadMoreButton
          onClick={() => fetchNextPage()}
          loading={isFetchingNextPage}
          hasMore={hasNextPage}
        />
      )}

      {!hasNextPage && patients.length > 0 && (
        <p className="text-center text-slate-500 dark:text-slate-400 text-sm py-4">
          Showing all {patients.length} patients
        </p>
      )}
    </div>
  );
};

export default OptimizedPatientList;
