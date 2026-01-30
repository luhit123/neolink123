/**
 * Hook for automatic Supabase sync
 *
 * This hook provides functions to sync patient data to Supabase
 * when patients are created, updated, or deleted in Firebase.
 */

import { useCallback } from 'react';
import { Patient, DischargeSummary } from '../types';
import { isSupabaseConfigured } from '../services/supabaseConfig';
import {
  syncPatientToSupabase,
  syncDischargeSummaryToSupabase,
  syncDeathRecordToSupabase,
  deletePatientSync
} from '../services/supabaseSyncService';

interface SyncResult {
  success: boolean;
  supabaseId?: string | null;
  error?: string;
}

export const useSupabaseSync = (institutionFirebaseId: string) => {
  /**
   * Sync a patient to Supabase after creating/updating in Firebase
   */
  const syncPatient = useCallback(async (
    firebasePatientId: string,
    patient: Patient
  ): Promise<SyncResult> => {
    if (!isSupabaseConfigured()) {
      return { success: true, supabaseId: null };
    }

    try {
      const supabaseId = await syncPatientToSupabase(
        firebasePatientId,
        patient,
        institutionFirebaseId
      );

      return {
        success: !!supabaseId,
        supabaseId,
        error: supabaseId ? undefined : 'Sync returned null'
      };
    } catch (error) {
      console.error('Error syncing patient to Supabase:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, [institutionFirebaseId]);

  /**
   * Sync discharge summary when a patient is discharged
   */
  const syncDischargeSummary = useCallback(async (
    firebasePatientId: string,
    summary: DischargeSummary
  ): Promise<SyncResult> => {
    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    try {
      // Pass Firebase patient ID directly - the sync function handles the lookup
      const summaryId = await syncDischargeSummaryToSupabase(firebasePatientId, summary);

      return {
        success: !!summaryId,
        supabaseId: summaryId,
        error: summaryId ? undefined : 'Patient may not be synced to Supabase yet'
      };
    } catch (error) {
      console.error('Error syncing discharge summary to Supabase:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, []);

  /**
   * Sync death record when a patient is marked as deceased
   */
  const syncDeathRecord = useCallback(async (
    firebasePatientId: string,
    patient: Patient
  ): Promise<SyncResult> => {
    if (!isSupabaseConfigured() || patient.outcome !== 'Deceased') {
      return { success: true };
    }

    try {
      // Pass Firebase patient ID directly - the sync function handles the lookup
      const recordId = await syncDeathRecordToSupabase(firebasePatientId, patient);

      return {
        success: !!recordId,
        supabaseId: recordId,
        error: recordId ? undefined : 'Patient may not be synced to Supabase yet'
      };
    } catch (error) {
      console.error('Error syncing death record to Supabase:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, []);

  /**
   * Delete patient from Supabase when deleted from Firebase
   */
  const deletePatient = useCallback(async (
    firebasePatientId: string
  ): Promise<SyncResult> => {
    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    try {
      const success = await deletePatientSync(firebasePatientId);

      return {
        success,
        error: success ? undefined : 'Delete failed'
      };
    } catch (error) {
      console.error('Error deleting patient from Supabase:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, []);

  /**
   * Full sync: sync patient and related data (discharge summary, death record if applicable)
   */
  const fullSync = useCallback(async (
    firebasePatientId: string,
    patient: Patient
  ): Promise<SyncResult> => {
    // First sync the patient
    const patientResult = await syncPatient(firebasePatientId, patient);

    if (!patientResult.success) {
      return patientResult;
    }

    // If patient has discharge summary, sync it
    if (patient.savedDischargeSummary) {
      await syncDischargeSummary(firebasePatientId, patient.savedDischargeSummary);
    }

    // If patient is deceased, sync death record
    if (patient.outcome === 'Deceased') {
      await syncDeathRecord(firebasePatientId, patient);
    }

    return patientResult;
  }, [syncPatient, syncDischargeSummary, syncDeathRecord]);

  return {
    syncPatient,
    syncDischargeSummary,
    syncDeathRecord,
    deletePatient,
    fullSync,
    isConfigured: isSupabaseConfigured()
  };
};

export default useSupabaseSync;
