/**
 * Professional Patient Data Hooks with React Query
 *
 * Features:
 * - Paginated data loading (not all at once)
 * - Smart caching with background refresh
 * - Optimistic updates
 * - Skeleton states
 * - Real-time sync only for current view
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  doc,
  onSnapshot,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Patient, ProgressNote } from '../types';
import { useEffect, useState, useCallback, useRef } from 'react';

// Constants
const PATIENTS_PER_PAGE = 20;
const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const CACHE_TIME = 30 * 60 * 1000; // 30 minutes

// Types
interface PatientsQueryParams {
  institutionId: string;
  unit?: 'PICU' | 'NICU' | 'SNCU' | 'HDU' | 'GENERAL_WARD';
  nicuType?: 'Inborn' | 'Outborn';
  dateFilter?: 'today' | 'week' | 'month' | 'all';
  outcomeFilter?: string;
  searchTerm?: string;
}

interface PaginatedPatientsResult {
  patients: Patient[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  totalCount?: number;
}

// Helper: Convert Firestore doc to Patient
const docToPatient = (doc: QueryDocumentSnapshot<DocumentData>): Patient => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    // Convert Firestore timestamps
    admissionDate: data.admissionDate?.toDate?.() || data.admissionDate,
    dischargeDate: data.dischargeDate?.toDate?.() || data.dischargeDate,
    dateOfBirth: data.dateOfBirth?.toDate?.() || data.dateOfBirth,
  } as Patient;
};

// Helper: Get date range for filter
const getDateRange = (filter: string): { start: Date; end: Date } | null => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
    case 'today':
      return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
    case 'week':
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: weekAgo, end: new Date() };
    case 'month':
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start: monthAgo, end: new Date() };
    default:
      return null;
  }
};

/**
 * Fetch paginated patients from Firestore
 */
async function fetchPaginatedPatients(
  params: PatientsQueryParams,
  pageParam?: QueryDocumentSnapshot<DocumentData>
): Promise<PaginatedPatientsResult> {
  const { institutionId, unit, nicuType, dateFilter, outcomeFilter, searchTerm } = params;

  // Build base query
  const patientsRef = collection(db, 'patients');
  let constraints: any[] = [
    where('institutionId', '==', institutionId),
    orderBy('admissionDate', 'desc'),
    limit(PATIENTS_PER_PAGE + 1) // Fetch one extra to check if there's more
  ];

  // Add unit filter if specified
  if (unit) {
    constraints.splice(1, 0, where('admissionUnit', '==', unit));
  }

  // Add outcome filter if specified and not 'All'
  if (outcomeFilter && outcomeFilter !== 'All' && outcomeFilter !== 'In Progress') {
    constraints.splice(1, 0, where('outcome', '==', outcomeFilter));
  }

  // Add pagination cursor
  if (pageParam) {
    constraints.push(startAfter(pageParam));
  }

  const q = query(patientsRef, ...constraints);
  const snapshot = await getDocs(q);

  let patients = snapshot.docs.map(docToPatient);

  // Check if there are more results
  const hasMore = patients.length > PATIENTS_PER_PAGE;
  if (hasMore) {
    patients = patients.slice(0, PATIENTS_PER_PAGE);
  }

  // Client-side filtering for complex filters that can't be done in Firestore
  if (nicuType && unit === 'NICU') {
    patients = patients.filter(p => p.nicuAdmissionType === nicuType);
  }

  if (dateFilter && dateFilter !== 'all') {
    const range = getDateRange(dateFilter);
    if (range) {
      patients = patients.filter(p => {
        const admDate = new Date(p.admissionDate);
        return admDate >= range.start && admDate <= range.end;
      });
    }
  }

  if (outcomeFilter === 'In Progress') {
    patients = patients.filter(p => !p.outcome || p.outcome === '' || p.outcome === 'In Progress');
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    patients = patients.filter(p =>
      p.name?.toLowerCase().includes(term) ||
      p.ntid?.toLowerCase().includes(term) ||
      p.diagnosis?.toLowerCase().includes(term) ||
      p.mothersName?.toLowerCase().includes(term)
    );
  }

  const lastDoc = snapshot.docs.length > 0
    ? snapshot.docs[Math.min(snapshot.docs.length - 1, PATIENTS_PER_PAGE - 1)]
    : null;

  return {
    patients,
    lastDoc,
    hasMore: hasMore && patients.length >= PATIENTS_PER_PAGE
  };
}

/**
 * Hook: Fetch initial patients (first page only)
 * Use this for quick initial load
 */
export function useInitialPatients(params: PatientsQueryParams) {
  return useQuery({
    queryKey: ['patients', 'initial', params],
    queryFn: () => fetchPaginatedPatients(params),
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    enabled: !!params.institutionId,
  });
}

/**
 * Hook: Infinite scroll patients
 * Loads more patients as user scrolls
 */
export function useInfinitePatients(params: PatientsQueryParams) {
  return useInfiniteQuery({
    queryKey: ['patients', 'infinite', params],
    queryFn: ({ pageParam }) => fetchPaginatedPatients(params, pageParam),
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.lastDoc : undefined,
    initialPageParam: undefined as QueryDocumentSnapshot<DocumentData> | undefined,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    enabled: !!params.institutionId,
  });
}

/**
 * Hook: Get single patient with full details
 * Only fetches when patient is selected
 */
export function usePatientDetails(patientId: string | null) {
  return useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      if (!patientId) return null;

      const docRef = doc(db, 'patients', patientId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      const patient = docToPatient(docSnap as any);

      // Load progress notes separately
      const notesRef = collection(db, 'patients', patientId, 'progressNotes');
      const notesQuery = query(notesRef, orderBy('date', 'desc'), limit(50));
      const notesSnap = await getDocs(notesQuery);

      patient.progressNotes = notesSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as ProgressNote[];

      return patient;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for individual patient
    gcTime: 10 * 60 * 1000,
    enabled: !!patientId,
  });
}

/**
 * Hook: Real-time patient count by status
 * Lightweight query for dashboard stats - loads ALL patients for accurate counts
 * This is separate from the paginated list loading
 */
export function usePatientStats(institutionId: string) {
  const [stats, setStats] = useState({
    total: 0,
    inProgress: 0,
    discharged: 0,
    deceased: 0,
    referred: 0,
    stepDown: 0,
    byUnit: {
      PICU: { total: 0, inProgress: 0 },
      NICU: { total: 0, inProgress: 0, inborn: 0, outborn: 0 },
      SNCU: { total: 0, inProgress: 0 },
      HDU: { total: 0, inProgress: 0 },
      GENERAL_WARD: { total: 0, inProgress: 0 }
    },
    loading: true
  });

  useEffect(() => {
    if (!institutionId) return;

    const patientsRef = collection(db, 'patients');
    const q = query(
      patientsRef,
      where('institutionId', '==', institutionId)
    );

    // Real-time listener for accurate stats
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const patients = snapshot.docs.map(d => d.data());

      const byUnit = {
        PICU: { total: 0, inProgress: 0 },
        NICU: { total: 0, inProgress: 0, inborn: 0, outborn: 0 },
        SNCU: { total: 0, inProgress: 0 },
        HDU: { total: 0, inProgress: 0 },
        GENERAL_WARD: { total: 0, inProgress: 0 }
      };

      patients.forEach(p => {
        const unit = p.admissionUnit as keyof typeof byUnit;
        const isInProgress = !p.outcome || p.outcome === '' || p.outcome === 'In Progress';

        if (byUnit[unit]) {
          byUnit[unit].total++;
          if (isInProgress) byUnit[unit].inProgress++;

          // NICU specific
          if (unit === 'NICU') {
            if (p.nicuAdmissionType === 'Inborn') byUnit.NICU.inborn++;
            else if (p.nicuAdmissionType === 'Outborn') byUnit.NICU.outborn++;
          }
        }
      });

      setStats({
        total: patients.length,
        inProgress: patients.filter(p => !p.outcome || p.outcome === '' || p.outcome === 'In Progress').length,
        discharged: patients.filter(p => p.outcome === 'Discharged').length,
        deceased: patients.filter(p => p.outcome === 'Deceased').length,
        referred: patients.filter(p => p.outcome === 'Referred Out').length,
        stepDown: patients.filter(p => p.outcome === 'Step Down').length,
        byUnit,
        loading: false
      });
    }, (error) => {
      console.error('Error fetching patient stats:', error);
      setStats(prev => ({ ...prev, loading: false }));
    });

    return () => unsubscribe();
  }, [institutionId]);

  return stats;
}

/**
 * Hook: Full analytics data with real-time updates
 * Loads all patients for analytics/charts but with minimal processing
 * This ensures analytics show accurate data across all patients
 */
export function useAnalyticsData(institutionId: string) {
  const [data, setData] = useState<{
    patients: Patient[];
    loading: boolean;
    error: Error | null;
  }>({
    patients: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    if (!institutionId) return;

    const patientsRef = collection(db, 'patients');
    const q = query(
      patientsRef,
      where('institutionId', '==', institutionId),
      orderBy('admissionDate', 'desc')
    );

    // Real-time listener for analytics data
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const patients = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert timestamps for analytics
        admissionDate: doc.data().admissionDate?.toDate?.() || doc.data().admissionDate,
        dischargeDate: doc.data().dischargeDate?.toDate?.() || doc.data().dischargeDate,
        dateOfBirth: doc.data().dateOfBirth?.toDate?.() || doc.data().dateOfBirth,
      })) as Patient[];

      setData({
        patients,
        loading: false,
        error: null
      });
    }, (error) => {
      console.error('Error fetching analytics data:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error as Error
      }));
    });

    return () => unsubscribe();
  }, [institutionId]);

  return data;
}

/**
 * Hook: Real-time updates for visible patients only
 * Subscribe to changes only for currently displayed patients
 */
export function usePatientRealtime(patientIds: string[]) {
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    // Clean up previous listeners
    unsubscribeRef.current.forEach(unsub => unsub());
    unsubscribeRef.current = [];

    if (patientIds.length === 0) return;

    // Subscribe to each visible patient (limit to avoid too many listeners)
    const idsToWatch = patientIds.slice(0, 20);

    idsToWatch.forEach(id => {
      const docRef = doc(db, 'patients', id);
      const unsub = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const updatedPatient = docToPatient(snapshot as any);

          // Update the patient in all relevant queries
          queryClient.setQueryData(['patient', id], updatedPatient);

          // Also update in the infinite query cache
          queryClient.setQueriesData(
            { queryKey: ['patients', 'infinite'] },
            (oldData: any) => {
              if (!oldData?.pages) return oldData;

              return {
                ...oldData,
                pages: oldData.pages.map((page: any) => ({
                  ...page,
                  patients: page.patients.map((p: Patient) =>
                    p.id === id ? updatedPatient : p
                  )
                }))
              };
            }
          );
        }
      });

      unsubscribeRef.current.push(unsub);
    });

    return () => {
      unsubscribeRef.current.forEach(unsub => unsub());
      unsubscribeRef.current = [];
    };
  }, [patientIds.join(','), queryClient]);
}

/**
 * Hook: Prefetch patient details on hover
 */
export function usePrefetchPatient() {
  const queryClient = useQueryClient();

  return useCallback((patientId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['patient', patientId],
      queryFn: async () => {
        const docRef = doc(db, 'patients', patientId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return docToPatient(docSnap as any);
      },
      staleTime: 2 * 60 * 1000,
    });
  }, [queryClient]);
}

/**
 * Hook: Invalidate and refetch patients
 */
export function useRefreshPatients() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['patients'] });
  }, [queryClient]);
}
