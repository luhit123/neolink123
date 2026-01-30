/**
 * Supabase Sync Service
 *
 * Handles background synchronization from Firebase to Supabase.
 * Firebase remains the primary data store for real-time functionality,
 * while Supabase is used for analytics, reporting, and data export.
 */

import { shouldSyncToSupabase } from './supabaseConfig';
import {
  getOrCreateInstitution,
  getOrCreateUnit,
  upsertPatient,
  syncProgressNotes,
  saveDischargeSummary,
  saveDeathRecord,
  deletePatientFromSupabase,
  getPatientByFirebaseId
} from './supabaseService';
import type { Patient, ProgressNote, DischargeSummary, Unit } from '../types';
import type { InsertPatient, InsertProgressNote, InsertDischargeSummary, InsertDeathRecord } from '../types/supabase';

// Helper to extract year-month from ISO date
const getYearMonth = (isoString?: string): string | null => {
  if (!isoString) return null;
  const date = new Date(isoString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

// Helper to convert Unit enum to string
const getUnitName = (unit: Unit): string => {
  switch (unit) {
    case 'Neonatal Intensive Care Unit': return 'NICU';
    case 'Pediatric Intensive Care Unit': return 'PICU';
    case 'Special New Born Care Unit': return 'SNCU';
    case 'High Dependency Unit': return 'HDU';
    case 'General Ward': return 'GENERAL_WARD';
    default: return unit;
  }
};

/**
 * Sync a patient from Firebase to Supabase
 * Returns the Supabase patient ID if successful
 */
export const syncPatientToSupabase = async (
  firebasePatientId: string,
  patient: Patient,
  institutionFirebaseId: string
): Promise<string | null> => {
  if (!shouldSyncToSupabase()) return null;

  try {
    // 1. Get or create institution in Supabase
    const institutionSupabaseId = await getOrCreateInstitution(
      institutionFirebaseId,
      patient.institutionName
    );

    if (!institutionSupabaseId) {
      console.error('Failed to get/create institution in Supabase');
      return null;
    }

    // 2. Get or create units
    const admissionUnitName = getUnitName(patient.unit);
    const admissionUnitId = await getOrCreateUnit(institutionSupabaseId, admissionUnitName);

    let currentUnitId = admissionUnitId;
    if (patient.currentUnit && patient.currentUnit !== patient.unit) {
      const currentUnitName = getUnitName(patient.currentUnit);
      currentUnitId = await getOrCreateUnit(institutionSupabaseId, currentUnitName);
    }

    // 3. Prepare patient data for Supabase
    const patientData: InsertPatient = {
      firebase_id: firebasePatientId,
      institution_id: institutionSupabaseId,
      admission_unit_id: admissionUnitId,
      current_unit_id: currentUnitId,
      ntid: patient.ntid,
      name: patient.name,
      date_of_birth: patient.dateOfBirth,
      gender: patient.gender,
      admission_date: patient.admissionDate,
      discharge_date: patient.releaseDate,
      admission_year_month: getYearMonth(patient.admissionDate),
      discharge_year_month: getYearMonth(patient.releaseDate),
      outcome: patient.outcome,
      admission_diagnosis: patient.diagnosis,
      age: patient.age,
      age_unit: patient.ageUnit,
      birth_weight: patient.birthWeight,
      weight_on_admission: patient.weightOnAdmission,
      weight_on_discharge: patient.weightOnDischarge,
      admission_type: patient.admissionType,
      place_of_delivery: patient.placeOfDelivery,
      referring_hospital: patient.referringHospital,
      referring_district: patient.referringDistrict,
      mother_name: patient.motherName,
      father_name: patient.fatherName,
      address: patient.address,
      village: patient.village,
      district: patient.district,
      state: patient.state,
      pin_code: patient.pinCode,
      contact_no: patient.contactNo1,
      gestational_age_weeks: patient.gestationalAgeWeeks,
      gestational_age_days: patient.gestationalAgeDays,
      is_step_down: patient.isStepDown || false,
      step_down_date: patient.stepDownDate,
      step_down_from: patient.stepDownFrom ? getUnitName(patient.stepDownFrom) : null,
      is_draft: patient.isDraft || false,
      created_by: patient.createdByEmail
    };

    // 4. Upsert patient
    const supabasePatientId = await upsertPatient(patientData);

    if (!supabasePatientId) {
      console.error('Failed to upsert patient in Supabase');
      return null;
    }

    // 5. Sync progress notes
    if (patient.progressNotes && patient.progressNotes.length > 0) {
      const progressNotesData: InsertProgressNote[] = patient.progressNotes.map(note => ({
        patient_id: supabasePatientId,
        date: note.date,
        year_month: getYearMonth(note.date),
        temperature: note.vitals?.temperature ? parseFloat(note.vitals.temperature) : null,
        heart_rate: note.vitals?.hr ? parseInt(note.vitals.hr) : null,
        respiratory_rate: note.vitals?.rr ? parseInt(note.vitals.rr) : null,
        spo2: note.vitals?.spo2 ? parseInt(note.vitals.spo2) : null,
        blood_pressure: note.vitals?.bp,
        weight: note.vitals?.weight ? parseFloat(note.vitals.weight) : null,
        examination: note.examination ? JSON.stringify(note.examination) : null,
        note: note.note,
        medications: note.medications ? JSON.stringify(note.medications) : null,
        icd10_codes: note.icd10Codes,
        added_by: note.addedBy,
        added_by_email: note.addedByEmail
      }));

      await syncProgressNotes(supabasePatientId, progressNotesData);
    }

    // 6. Sync discharge summary if exists
    if (patient.savedDischargeSummary) {
      // Pass Firebase patient ID - the function will look up the Supabase patient
      await syncDischargeSummaryToSupabase(firebasePatientId, patient.savedDischargeSummary, patient.name, institutionFirebaseId);
    }

    // 7. Sync death record if patient is deceased
    if (patient.outcome === 'Deceased' && patient.dateOfDeath) {
      // Pass Firebase patient ID - the function will look up the Supabase patient
      await syncDeathRecordToSupabase(firebasePatientId, patient);
    }

    console.log(`Patient ${patient.name} synced to Supabase with ID: ${supabasePatientId}`);
    return supabasePatientId;
  } catch (error) {
    console.error('Error syncing patient to Supabase:', error);
    return null;
  }
};

/**
 * Sync discharge summary to Supabase
 * Accepts Firebase patient ID and looks up Supabase UUID automatically
 */
export const syncDischargeSummaryToSupabase = async (
  firebasePatientId: string,
  summary: DischargeSummary,
  patientName?: string,
  institutionId?: string
): Promise<string | null> => {
  if (!shouldSyncToSupabase()) return null;

  try {
    // Look up the Supabase patient by Firebase ID
    let supabasePatient = await getPatientByFirebaseId(firebasePatientId);

    // If patient doesn't exist in Supabase yet, we can't sync the discharge summary
    // The patient should be synced first via syncPatientToSupabase
    if (!supabasePatient) {
      console.warn(`Patient ${patientName || firebasePatientId} not found in Supabase. Discharge summary sync skipped.`);
      return null;
    }

    const summaryData: InsertDischargeSummary = {
      patient_id: supabasePatient.id, // Use Supabase UUID, not Firebase ID
      summary_data: JSON.stringify(summary),
      discharge_type: summary.dischargeType,
      discharge_date: summary.dischargeDate,
      prepared_by: summary.preparedBy,
      verified_by: summary.verifiedBy
    };

    return await saveDischargeSummary(summaryData);
  } catch (error) {
    console.error('Error syncing discharge summary to Supabase:', error);
    return null;
  }
};

/**
 * Sync death record to Supabase
 * Accepts Firebase patient ID and looks up Supabase UUID automatically
 */
export const syncDeathRecordToSupabase = async (
  firebasePatientId: string,
  patient: Patient
): Promise<string | null> => {
  if (!shouldSyncToSupabase()) return null;

  try {
    // Look up the Supabase patient by Firebase ID
    const supabasePatient = await getPatientByFirebaseId(firebasePatientId);

    if (!supabasePatient) {
      console.warn(`Patient ${patient.name || firebasePatientId} not found in Supabase. Death record sync skipped.`);
      return null;
    }

    const deathRecord: InsertDeathRecord = {
      patient_id: supabasePatient.id, // Use Supabase UUID, not Firebase ID
      date_of_death: patient.dateOfDeath,
      diagnosis_at_death: patient.diagnosisAtDeath,
      ai_interpreted_diagnosis: patient.aiInterpretedDeathDiagnosis
    };

    return await saveDeathRecord(deathRecord);
  } catch (error) {
    console.error('Error syncing death record to Supabase:', error);
    return null;
  }
};

/**
 * Delete patient from Supabase when deleted from Firebase
 */
export const deletePatientSync = async (firebasePatientId: string): Promise<boolean> => {
  if (!shouldSyncToSupabase()) return true;

  try {
    return await deletePatientFromSupabase(firebasePatientId);
  } catch (error) {
    console.error('Error deleting patient from Supabase:', error);
    return false;
  }
};

/**
 * Batch sync multiple patients (useful for migration)
 */
export const batchSyncPatientsToSupabase = async (
  patients: Array<{ firebaseId: string; patient: Patient; institutionFirebaseId: string }>
): Promise<{ success: number; failed: number }> => {
  if (!shouldSyncToSupabase()) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;

  // Process in batches of 10 to avoid overwhelming the API
  const batchSize = 10;
  for (let i = 0; i < patients.length; i += batchSize) {
    const batch = patients.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async ({ firebaseId, patient, institutionFirebaseId }) => {
        try {
          const result = await syncPatientToSupabase(firebaseId, patient, institutionFirebaseId);
          if (result) {
            success++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`Failed to sync patient ${patient.name}:`, error);
          failed++;
        }
      })
    );

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < patients.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`Batch sync complete: ${success} success, ${failed} failed`);
  return { success, failed };
};

/**
 * Check if a patient is already synced to Supabase
 */
export const isPatientSynced = async (firebasePatientId: string): Promise<boolean> => {
  if (!shouldSyncToSupabase()) return false;

  try {
    const patient = await getPatientByFirebaseId(firebasePatientId);
    return patient !== null;
  } catch (error) {
    console.error('Error checking patient sync status:', error);
    return false;
  }
};

/**
 * Get Supabase patient ID for a Firebase patient
 */
export const getSupabasePatientId = async (firebasePatientId: string): Promise<string | null> => {
  if (!shouldSyncToSupabase()) return null;

  try {
    const patient = await getPatientByFirebaseId(firebasePatientId);
    return patient?.id || null;
  } catch (error) {
    console.error('Error getting Supabase patient ID:', error);
    return null;
  }
};
