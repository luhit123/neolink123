/**
 * Migration Script: Firebase to Supabase
 *
 * This script migrates existing patient data from Firebase to Supabase.
 * It should be run once after setting up the Supabase database.
 *
 * Usage:
 * 1. Set up Supabase tables using the SQL schema (see supabaseSchema.sql)
 * 2. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 * 3. Run this migration from a component or admin page
 *
 * Note: This is designed to be run from the browser, not Node.js,
 * because it uses Vite's environment variables.
 */

import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { firestoreToPatient } from '../services/firestoreService';
import { syncPatientToSupabase } from '../services/supabaseSyncService';
import { isSupabaseConfigured } from '../services/supabaseConfig';
import type { Patient } from '../types';

interface MigrationResult {
  totalPatients: number;
  synced: number;
  failed: number;
  errors: Array<{ patientId: string; patientName: string; error: string }>;
}

interface MigrationProgress {
  current: number;
  total: number;
  status: string;
  currentPatient?: string;
}

/**
 * Migrate all patients from a specific institution
 */
export const migrateInstitutionPatients = async (
  institutionId: string,
  onProgress?: (progress: MigrationProgress) => void
): Promise<MigrationResult> => {
  const result: MigrationResult = {
    totalPatients: 0,
    synced: 0,
    failed: 0,
    errors: []
  };

  if (!isSupabaseConfigured()) {
    console.error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    return result;
  }

  try {
    // 1. Fetch all patients from Firebase
    onProgress?.({ current: 0, total: 0, status: 'Fetching patients from Firebase...' });

    const patientsRef = collection(db, 'colleges', institutionId, 'patients');
    const q = query(patientsRef, orderBy('admissionDate', 'desc'));
    const snapshot = await getDocs(q);

    const patients: Array<{ id: string; data: Patient }> = [];

    for (const docSnap of snapshot.docs) {
      const patient = firestoreToPatient(docSnap.data());
      patient.id = docSnap.id;

      // Load progress notes
      const notesRef = collection(db, 'colleges', institutionId, 'patients', docSnap.id, 'progressNotes');
      const notesSnapshot = await getDocs(query(notesRef, orderBy('date', 'asc')));

      patient.progressNotes = notesSnapshot.docs.map(noteDoc => {
        const data = noteDoc.data();
        return {
          id: noteDoc.id,
          date: data.date?.toDate?.().toISOString() || new Date().toISOString(),
          note: data.note,
          vitals: data.vitals,
          examination: data.examination,
          medications: data.medications,
          addedBy: data.addedBy,
          addedByEmail: data.addedByEmail,
          icd10Codes: data.icd10Codes
        };
      });

      patients.push({ id: docSnap.id, data: patient });
    }

    result.totalPatients = patients.length;
    onProgress?.({ current: 0, total: patients.length, status: `Found ${patients.length} patients to migrate` });

    // 2. Sync each patient to Supabase
    for (let i = 0; i < patients.length; i++) {
      const { id, data: patient } = patients[i];

      onProgress?.({
        current: i + 1,
        total: patients.length,
        status: 'Syncing...',
        currentPatient: patient.name
      });

      try {
        const supabaseId = await syncPatientToSupabase(id, patient, institutionId);

        if (supabaseId) {
          result.synced++;

          // Update Firebase document with Supabase ID
          const patientRef = doc(db, 'colleges', institutionId, 'patients', id);
          await updateDoc(patientRef, {
            supabaseId: supabaseId,
            admissionYearMonth: getYearMonth(patient.admissionDate),
            dischargeYearMonth: getYearMonth(patient.releaseDate)
          });
        } else {
          result.failed++;
          result.errors.push({
            patientId: id,
            patientName: patient.name,
            error: 'Sync returned null'
          });
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          patientId: id,
          patientName: patient.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Small delay to avoid rate limiting
      if (i < patients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    onProgress?.({
      current: patients.length,
      total: patients.length,
      status: `Migration complete: ${result.synced} synced, ${result.failed} failed`
    });

    return result;
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
};

/**
 * Migrate patients from all institutions
 */
export const migrateAllInstitutions = async (
  institutionIds: string[],
  onProgress?: (progress: MigrationProgress & { institutionIndex: number; totalInstitutions: number }) => void
): Promise<{ [institutionId: string]: MigrationResult }> => {
  const results: { [institutionId: string]: MigrationResult } = {};

  for (let i = 0; i < institutionIds.length; i++) {
    const institutionId = institutionIds[i];

    onProgress?.({
      current: 0,
      total: 0,
      status: `Starting institution ${i + 1} of ${institutionIds.length}`,
      institutionIndex: i,
      totalInstitutions: institutionIds.length
    });

    results[institutionId] = await migrateInstitutionPatients(institutionId, (progress) => {
      onProgress?.({
        ...progress,
        institutionIndex: i,
        totalInstitutions: institutionIds.length
      });
    });
  }

  return results;
};

/**
 * Verify migration by comparing counts
 */
export const verifyMigration = async (institutionId: string): Promise<{
  firebaseCount: number;
  supabaseCount: number;
  match: boolean;
}> => {
  // Count in Firebase
  const patientsRef = collection(db, 'colleges', institutionId, 'patients');
  const snapshot = await getDocs(patientsRef);
  const firebaseCount = snapshot.size;

  // Count in Supabase - this would need to be implemented via supabaseService
  // For now, we'll just return the Firebase count
  // TODO: Add Supabase count verification

  return {
    firebaseCount,
    supabaseCount: 0, // Would need to query Supabase
    match: false
  };
};

// Helper function
const getYearMonth = (isoString?: string): string | null => {
  if (!isoString) return null;
  const date = new Date(isoString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export default {
  migrateInstitutionPatients,
  migrateAllInstitutions,
  verifyMigration
};
