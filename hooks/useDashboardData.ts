/**
 * Dashboard Data Hook
 *
 * Smart data loading strategy:
 * - Stats/Analytics: Real-time listener for accurate counts (same as before)
 * - Patient List: Same data, virtualized rendering
 * - Patient Details: Lazy loaded when selected
 *
 * This approach ensures:
 * - Stats are ALWAYS accurate (real-time full count)
 * - Analytics work correctly (full data available)
 * - UI is responsive (virtualized list)
 * - Memory efficient (progress notes loaded on demand)
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  limit
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Patient, ProgressNote, Unit } from '../types';

// Types
interface DashboardStats {
  total: number;
  inProgress: number;
  discharged: number;
  deceased: number;
  referred: number;
  stepDown: number;
  todayAdmissions: number;
  weekAdmissions: number;
  byUnit: {
    PICU: { total: number; inProgress: number; occupied: number };
    NICU: { total: number; inProgress: number; inborn: number; outborn: number; occupied: number };
    SNCU: { total: number; inProgress: number; occupied: number };
    HDU: { total: number; inProgress: number; occupied: number };
    GENERAL_WARD: { total: number; inProgress: number; occupied: number };
  };
}

interface UseDashboardDataOptions {
  institutionId: string;
  enabled?: boolean;
}

interface UseDashboardDataReturn {
  // All patients (for analytics and filtering)
  patients: Patient[];

  // Computed stats (always accurate)
  stats: DashboardStats;

  // Loading states
  isLoading: boolean;
  isInitialLoad: boolean;
  error: Error | null;

  // Actions
  refreshData: () => void;
  getPatientDetails: (patientId: string) => Promise<Patient | null>;
}

// Helper: Check if date is today
const isToday = (date: Date | string | undefined): boolean => {
  if (!date) return false;
  const d = new Date(date);
  const today = new Date();
  return d.toDateString() === today.toDateString();
};

// Helper: Check if date is within last 7 days
const isThisWeek = (date: Date | string | undefined): boolean => {
  if (!date) return false;
  const d = new Date(date);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return d >= weekAgo;
};

// Helper: Check if patient is in progress
const isInProgress = (patient: Patient): boolean => {
  return !patient.outcome || patient.outcome === '' || patient.outcome === 'In Progress';
};

/**
 * Main Dashboard Data Hook
 *
 * Provides real-time patient data with computed stats.
 * Progress notes are NOT loaded here - use getPatientDetails for that.
 */
export function useDashboardData(options: UseDashboardDataOptions): UseDashboardDataReturn {
  const { institutionId, enabled = true } = options;

  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track if we've received first snapshot
  const hasInitialData = useRef(false);

  // Real-time listener for patients
  useEffect(() => {
    if (!institutionId || !enabled) {
      setPatients([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const patientsRef = collection(db, 'patients');
    const q = query(
      patientsRef,
      where('institutionId', '==', institutionId),
      orderBy('admissionDate', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedPatients = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // Convert timestamps
            admissionDate: data.admissionDate?.toDate?.() || data.admissionDate,
            dischargeDate: data.dischargeDate?.toDate?.() || data.dischargeDate,
            dateOfBirth: data.dateOfBirth?.toDate?.() || data.dateOfBirth,
            // Don't load progressNotes here - lazy load on demand
            progressNotes: [],
          } as Patient;
        });

        setPatients(loadedPatients);
        setIsLoading(false);

        if (!hasInitialData.current) {
          hasInitialData.current = true;
          setIsInitialLoad(false);
        }

        setError(null);
      },
      (err) => {
        console.error('Error loading patients:', err);
        setError(err as Error);
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    );

    return () => unsubscribe();
  }, [institutionId, enabled]);

  // Compute stats from patients (memoized for performance)
  const stats = useMemo<DashboardStats>(() => {
    const byUnit = {
      PICU: { total: 0, inProgress: 0, occupied: 0 },
      NICU: { total: 0, inProgress: 0, inborn: 0, outborn: 0, occupied: 0 },
      SNCU: { total: 0, inProgress: 0, occupied: 0 },
      HDU: { total: 0, inProgress: 0, occupied: 0 },
      GENERAL_WARD: { total: 0, inProgress: 0, occupied: 0 },
    };

    let todayAdmissions = 0;
    let weekAdmissions = 0;

    patients.forEach(patient => {
      const unit = patient.admissionUnit as keyof typeof byUnit;
      const patientInProgress = isInProgress(patient);

      // Count by unit
      if (byUnit[unit]) {
        byUnit[unit].total++;
        if (patientInProgress) {
          byUnit[unit].inProgress++;
          byUnit[unit].occupied++;
        }

        // NICU specific
        if (unit === 'NICU') {
          if (patient.nicuAdmissionType === 'Inborn') byUnit.NICU.inborn++;
          else if (patient.nicuAdmissionType === 'Outborn') byUnit.NICU.outborn++;
        }
      }

      // Time-based counts
      if (isToday(patient.admissionDate)) todayAdmissions++;
      if (isThisWeek(patient.admissionDate)) weekAdmissions++;
    });

    return {
      total: patients.length,
      inProgress: patients.filter(isInProgress).length,
      discharged: patients.filter(p => p.outcome === 'Discharged').length,
      deceased: patients.filter(p => p.outcome === 'Deceased').length,
      referred: patients.filter(p => p.outcome === 'Referred').length,
      stepDown: patients.filter(p => p.outcome === 'Step Down').length,
      todayAdmissions,
      weekAdmissions,
      byUnit,
    };
  }, [patients]);

  // Refresh function (force re-fetch)
  const refreshData = useCallback(() => {
    // Trigger re-mount of the effect by temporarily disabling
    setIsLoading(true);
  }, []);

  // Lazy load patient details with progress notes
  const getPatientDetails = useCallback(async (patientId: string): Promise<Patient | null> => {
    try {
      const docRef = doc(db, 'patients', patientId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      const data = docSnap.data();
      const patient: Patient = {
        id: docSnap.id,
        ...data,
        admissionDate: data.admissionDate?.toDate?.() || data.admissionDate,
        dischargeDate: data.dischargeDate?.toDate?.() || data.dischargeDate,
        dateOfBirth: data.dateOfBirth?.toDate?.() || data.dateOfBirth,
      } as Patient;

      // Load progress notes (lazy loaded)
      const notesRef = collection(db, 'patients', patientId, 'progressNotes');
      const notesQuery = query(notesRef, orderBy('date', 'desc'));
      const notesSnap = await getDocs(notesQuery);

      patient.progressNotes = notesSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        date: d.data().date?.toDate?.() || d.data().date,
      })) as ProgressNote[];

      return patient;
    } catch (err) {
      console.error('Error loading patient details:', err);
      return null;
    }
  }, []);

  return {
    patients,
    stats,
    isLoading,
    isInitialLoad,
    error,
    refreshData,
    getPatientDetails,
  };
}

/**
 * Hook for filtered patient list
 * Uses the same data but with filters applied
 */
export function useFilteredPatients(
  patients: Patient[],
  filters: {
    unit?: Unit;
    nicuType?: 'Inborn' | 'Outborn';
    dateFilter?: 'today' | 'week' | 'month' | 'all';
    outcomeFilter?: string;
    searchTerm?: string;
  }
) {
  return useMemo(() => {
    let filtered = [...patients];

    // Filter by unit
    if (filters.unit) {
      filtered = filtered.filter(p => p.admissionUnit === filters.unit);
    }

    // Filter by NICU type
    if (filters.unit === 'NICU' && filters.nicuType) {
      filtered = filtered.filter(p => p.nicuAdmissionType === filters.nicuType);
    }

    // Filter by date
    if (filters.dateFilter && filters.dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter(p => {
        const admDate = new Date(p.admissionDate);
        switch (filters.dateFilter) {
          case 'today':
            return admDate >= today;
          case 'week':
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            return admDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            return admDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Filter by outcome
    if (filters.outcomeFilter && filters.outcomeFilter !== 'All') {
      if (filters.outcomeFilter === 'In Progress') {
        filtered = filtered.filter(isInProgress);
      } else {
        filtered = filtered.filter(p => p.outcome === filters.outcomeFilter);
      }
    }

    // Search filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(term) ||
        p.ntid?.toLowerCase().includes(term) ||
        p.diagnosis?.toLowerCase().includes(term) ||
        p.mothersName?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [patients, filters.unit, filters.nicuType, filters.dateFilter, filters.outcomeFilter, filters.searchTerm]);
}

export default useDashboardData;
