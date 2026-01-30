import { supabase, shouldSyncToSupabase } from './supabaseConfig';
import type {
  InsertPatient,
  UpdatePatient,
  InsertProgressNote,
  InsertClinicalNote,
  InsertDischargeSummary,
  InsertDeathRecord,
  InsertInstitution,
  InsertUnit,
  MonthlyPatientSummary,
  PatientHierarchy,
  SupabasePatient
} from '../types/supabase';

// ==================== INSTITUTION OPERATIONS ====================

export const getOrCreateInstitution = async (
  firebaseId: string,
  name: string,
  code?: string
): Promise<string | null> => {
  if (!shouldSyncToSupabase()) return null;

  try {
    // First try to find existing institution
    const { data: existing } = await supabase
      .from('institutions')
      .select('id')
      .eq('firebase_id', firebaseId)
      .single();

    if (existing) return existing.id;

    // Create new institution
    const { data, error } = await supabase
      .from('institutions')
      .insert({
        firebase_id: firebaseId,
        name,
        code
      } as InsertInstitution)
      .select('id')
      .single();

    if (error) throw error;
    return data?.id || null;
  } catch (error) {
    console.error('Error getting/creating institution in Supabase:', error);
    return null;
  }
};

export const getOrCreateUnit = async (
  institutionId: string,
  unitName: string
): Promise<string | null> => {
  if (!shouldSyncToSupabase()) return null;

  try {
    // First try to find existing unit
    const { data: existing } = await supabase
      .from('units')
      .select('id')
      .eq('institution_id', institutionId)
      .eq('name', unitName)
      .single();

    if (existing) return existing.id;

    // Create new unit
    const { data, error } = await supabase
      .from('units')
      .insert({
        institution_id: institutionId,
        name: unitName
      } as InsertUnit)
      .select('id')
      .single();

    if (error) throw error;
    return data?.id || null;
  } catch (error) {
    console.error('Error getting/creating unit in Supabase:', error);
    return null;
  }
};

// ==================== PATIENT OPERATIONS ====================

export const upsertPatient = async (
  patientData: InsertPatient
): Promise<string | null> => {
  if (!shouldSyncToSupabase()) return null;

  try {
    // If we have a firebase_id, try to update existing record
    if (patientData.firebase_id) {
      const { data: existing } = await supabase
        .from('patients')
        .select('id')
        .eq('firebase_id', patientData.firebase_id)
        .single();

      if (existing) {
        // Update existing patient
        const { error } = await supabase
          .from('patients')
          .update({
            ...patientData,
            updated_at: new Date().toISOString()
          } as UpdatePatient)
          .eq('id', existing.id);

        if (error) throw error;
        return existing.id;
      }
    }

    // Insert new patient
    const { data, error } = await supabase
      .from('patients')
      .insert(patientData)
      .select('id')
      .single();

    if (error) throw error;
    return data?.id || null;
  } catch (error) {
    console.error('Error upserting patient in Supabase:', error);
    return null;
  }
};

export const deletePatientFromSupabase = async (firebaseId: string): Promise<boolean> => {
  if (!shouldSyncToSupabase()) return false;

  try {
    // Get the patient ID first
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('firebase_id', firebaseId)
      .single();

    if (!patient) return true; // Patient doesn't exist, nothing to delete

    // Delete related records first (cascading is handled by foreign key constraints)
    // But we do it explicitly for safety
    await supabase.from('progress_notes').delete().eq('patient_id', patient.id);
    await supabase.from('clinical_notes').delete().eq('patient_id', patient.id);
    await supabase.from('discharge_summaries').delete().eq('patient_id', patient.id);
    await supabase.from('death_records').delete().eq('patient_id', patient.id);

    // Delete the patient
    const { error } = await supabase
      .from('patients')
      .delete()
      .eq('id', patient.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting patient from Supabase:', error);
    return false;
  }
};

export const getPatientByFirebaseId = async (firebaseId: string): Promise<SupabasePatient | null> => {
  if (!shouldSyncToSupabase()) return null;

  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('firebase_id', firebaseId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows found
    return data;
  } catch (error) {
    console.error('Error getting patient from Supabase:', error);
    return null;
  }
};

// ==================== PROGRESS NOTES OPERATIONS ====================

export const syncProgressNotes = async (
  patientSupabaseId: string,
  notes: InsertProgressNote[]
): Promise<boolean> => {
  if (!shouldSyncToSupabase()) return false;

  try {
    // Delete existing notes for this patient
    await supabase
      .from('progress_notes')
      .delete()
      .eq('patient_id', patientSupabaseId);

    // Insert new notes
    if (notes.length > 0) {
      const notesWithPatientId = notes.map(note => ({
        ...note,
        patient_id: patientSupabaseId
      }));

      const { error } = await supabase
        .from('progress_notes')
        .insert(notesWithPatientId);

      if (error) throw error;
    }

    return true;
  } catch (error) {
    console.error('Error syncing progress notes to Supabase:', error);
    return false;
  }
};

// ==================== CLINICAL NOTES OPERATIONS ====================

export const addClinicalNote = async (
  note: InsertClinicalNote
): Promise<string | null> => {
  if (!shouldSyncToSupabase()) return null;

  try {
    const { data, error } = await supabase
      .from('clinical_notes')
      .insert(note)
      .select('id')
      .single();

    if (error) throw error;
    return data?.id || null;
  } catch (error) {
    console.error('Error adding clinical note to Supabase:', error);
    return null;
  }
};

// ==================== DISCHARGE SUMMARY OPERATIONS ====================

export const saveDischargeSummary = async (
  summary: InsertDischargeSummary
): Promise<string | null> => {
  if (!shouldSyncToSupabase()) return null;

  try {
    // Check if discharge summary already exists for this patient
    const { data: existing } = await supabase
      .from('discharge_summaries')
      .select('id')
      .eq('patient_id', summary.patient_id)
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('discharge_summaries')
        .update(summary)
        .eq('id', existing.id);

      if (error) throw error;
      return existing.id;
    }

    // Insert new
    const { data, error } = await supabase
      .from('discharge_summaries')
      .insert(summary)
      .select('id')
      .single();

    if (error) throw error;
    return data?.id || null;
  } catch (error) {
    console.error('Error saving discharge summary to Supabase:', error);
    return null;
  }
};

// ==================== DEATH RECORDS OPERATIONS ====================

export const saveDeathRecord = async (
  record: InsertDeathRecord
): Promise<string | null> => {
  if (!shouldSyncToSupabase()) return null;

  try {
    // Check if death record already exists for this patient
    const { data: existing } = await supabase
      .from('death_records')
      .select('id')
      .eq('patient_id', record.patient_id)
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('death_records')
        .update(record)
        .eq('id', existing.id);

      if (error) throw error;
      return existing.id;
    }

    // Insert new
    const { data, error } = await supabase
      .from('death_records')
      .insert(record)
      .select('id')
      .single();

    if (error) throw error;
    return data?.id || null;
  } catch (error) {
    console.error('Error saving death record to Supabase:', error);
    return null;
  }
};

// ==================== REPORTING & ANALYTICS QUERIES ====================

export const getMonthlyPatientSummary = async (
  institutionId?: string,
  yearMonth?: string
): Promise<MonthlyPatientSummary[]> => {
  if (!shouldSyncToSupabase()) return [];

  try {
    let query = supabase
      .from('monthly_patient_summary')
      .select('*');

    if (institutionId) {
      // Get institution name for filtering
      const { data: inst } = await supabase
        .from('institutions')
        .select('name')
        .eq('id', institutionId)
        .single();

      if (inst) {
        query = query.eq('institution_name', inst.name);
      }
    }

    if (yearMonth) {
      query = query.eq('admission_year_month', yearMonth);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting monthly patient summary:', error);
    return [];
  }
};

export const getPatientHierarchy = async (
  institutionId?: string,
  yearMonth?: string,
  unitName?: string
): Promise<PatientHierarchy[]> => {
  if (!shouldSyncToSupabase()) return [];

  try {
    let query = supabase
      .from('patient_hierarchy')
      .select('*');

    if (institutionId) {
      const { data: inst } = await supabase
        .from('institutions')
        .select('name')
        .eq('id', institutionId)
        .single();

      if (inst) {
        query = query.eq('institution', inst.name);
      }
    }

    if (yearMonth) {
      query = query.eq('month', yearMonth);
    }

    if (unitName) {
      query = query.eq('unit', unitName);
    }

    const { data, error } = await query.order('admission_date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting patient hierarchy:', error);
    return [];
  }
};

// Deep hierarchy query with all related data
export const getPatientWithDetails = async (
  institutionId: string,
  yearMonth?: string
) => {
  if (!shouldSyncToSupabase()) return [];

  try {
    let query = supabase
      .from('patients')
      .select(`
        id, name, ntid, ip_number, outcome, admission_date, discharge_date,
        admission_year_month, discharge_year_month,
        institutions!inner(name),
        units!admission_unit_id(name),
        progress_notes(date, examination, note, medications),
        clinical_notes(type, content, created_at),
        discharge_summaries(summary_data)
      `)
      .eq('institution_id', institutionId);

    if (yearMonth) {
      query = query.eq('admission_year_month', yearMonth);
    }

    const { data, error } = await query.order('admission_date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting patient details:', error);
    return [];
  }
};

// Get patients by month and unit for reporting
export const getPatientsByMonthAndUnit = async (
  institutionId: string,
  yearMonth: string,
  unitName?: string
) => {
  if (!shouldSyncToSupabase()) return [];

  try {
    // First get unit ID if unit name provided
    let unitId: string | null = null;
    if (unitName) {
      const { data: unit } = await supabase
        .from('units')
        .select('id')
        .eq('institution_id', institutionId)
        .eq('name', unitName)
        .single();
      unitId = unit?.id || null;
    }

    let query = supabase
      .from('patients')
      .select('*')
      .eq('institution_id', institutionId)
      .eq('admission_year_month', yearMonth);

    if (unitId) {
      query = query.eq('admission_unit_id', unitId);
    }

    const { data, error } = await query.order('admission_date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting patients by month and unit:', error);
    return [];
  }
};

// Get outcome statistics for a time period
export const getOutcomeStatistics = async (
  institutionId: string,
  startYearMonth: string,
  endYearMonth: string
) => {
  if (!shouldSyncToSupabase()) return null;

  try {
    const { data, error } = await supabase
      .from('patients')
      .select('outcome, admission_year_month')
      .eq('institution_id', institutionId)
      .gte('admission_year_month', startYearMonth)
      .lte('admission_year_month', endYearMonth);

    if (error) throw error;

    // Aggregate outcomes
    const stats = {
      total: data?.length || 0,
      inProgress: data?.filter(p => p.outcome === 'In Progress').length || 0,
      discharged: data?.filter(p => p.outcome === 'Discharged').length || 0,
      deceased: data?.filter(p => p.outcome === 'Deceased').length || 0,
      referred: data?.filter(p => p.outcome === 'Referred').length || 0,
      stepDown: data?.filter(p => p.outcome === 'Step Down').length || 0,
    };

    return stats;
  } catch (error) {
    console.error('Error getting outcome statistics:', error);
    return null;
  }
};

// Get death records for analytics
export const getDeathRecords = async (
  institutionId: string,
  startDate?: string,
  endDate?: string
) => {
  if (!shouldSyncToSupabase()) return [];

  try {
    // Get patient IDs for this institution
    const { data: patients } = await supabase
      .from('patients')
      .select('id')
      .eq('institution_id', institutionId);

    if (!patients || patients.length === 0) return [];

    const patientIds = patients.map(p => p.id);

    let query = supabase
      .from('death_records')
      .select(`
        *,
        patients!inner(name, ntid, institution_id)
      `)
      .in('patient_id', patientIds);

    if (startDate) {
      query = query.gte('date_of_death', startDate);
    }
    if (endDate) {
      query = query.lte('date_of_death', endDate);
    }

    const { data, error } = await query.order('date_of_death', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting death records:', error);
    return [];
  }
};

// ==================== EXPORT FUNCTIONS ====================

// Export patients as CSV-ready data
export const exportPatientsToCSV = async (
  institutionId: string,
  yearMonth?: string
): Promise<Record<string, unknown>[]> => {
  if (!shouldSyncToSupabase()) return [];

  try {
    let query = supabase
      .from('patients')
      .select(`
        name, ntid, ip_number, gender, date_of_birth,
        admission_date, discharge_date,
        admission_diagnosis, final_diagnosis, outcome,
        admission_type, referring_hospital,
        mother_name, father_name, address, district, state,
        birth_weight, weight_on_admission, weight_on_discharge,
        gestational_age_weeks, gestational_age_days,
        institutions!inner(name),
        units!admission_unit_id(name)
      `)
      .eq('institution_id', institutionId);

    if (yearMonth) {
      query = query.eq('admission_year_month', yearMonth);
    }

    const { data, error } = await query.order('admission_date', { ascending: false });

    if (error) throw error;

    // Flatten nested data for CSV export
    return (data || []).map((patient: Record<string, unknown>) => ({
      ...patient,
      institution_name: (patient.institutions as { name: string } | null)?.name,
      unit_name: (patient.units as { name: string } | null)?.name,
      institutions: undefined,
      units: undefined
    }));
  } catch (error) {
    console.error('Error exporting patients to CSV:', error);
    return [];
  }
};

// Export progress notes for a patient
export const exportProgressNotesForPatient = async (
  patientSupabaseId: string
) => {
  if (!shouldSyncToSupabase()) return [];

  try {
    const { data, error } = await supabase
      .from('progress_notes')
      .select('*')
      .eq('patient_id', patientSupabaseId)
      .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error exporting progress notes:', error);
    return [];
  }
};
