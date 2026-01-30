// Supabase Database Types
// Generated based on the hybrid architecture plan

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      institutions: {
        Row: {
          id: string;
          firebase_id: string | null;
          name: string;
          code: string | null;
          address: string | null;
          district: string | null;
          state: string | null;
          pin_code: string | null;
          institution_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          firebase_id?: string | null;
          name: string;
          code?: string | null;
          address?: string | null;
          district?: string | null;
          state?: string | null;
          pin_code?: string | null;
          institution_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          firebase_id?: string | null;
          name?: string;
          code?: string | null;
          address?: string | null;
          district?: string | null;
          state?: string | null;
          pin_code?: string | null;
          institution_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      units: {
        Row: {
          id: string;
          institution_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          name?: string;
          created_at?: string;
        };
      };
      monthly_records: {
        Row: {
          id: string;
          institution_id: string;
          year: number;
          month: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          institution_id: string;
          year: number;
          month: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          institution_id?: string;
          year?: number;
          month?: number;
          created_at?: string;
        };
      };
      patients: {
        Row: {
          id: string;
          firebase_id: string | null;
          institution_id: string;
          admission_unit_id: string | null;
          current_unit_id: string | null;
          monthly_record_id: string | null;
          ntid: string | null;
          name: string;
          ip_number: string | null;
          date_of_birth: string | null;
          gender: string | null;
          admission_date: string | null;
          discharge_date: string | null;
          admission_year_month: string | null;
          discharge_year_month: string | null;
          outcome: string | null;
          admission_diagnosis: string | null;
          final_diagnosis: string | null;
          age: number | null;
          age_unit: string | null;
          birth_weight: number | null;
          weight_on_admission: number | null;
          weight_on_discharge: number | null;
          admission_type: string | null;
          place_of_delivery: string | null;
          referring_hospital: string | null;
          referring_district: string | null;
          mother_name: string | null;
          father_name: string | null;
          address: string | null;
          village: string | null;
          district: string | null;
          state: string | null;
          pin_code: string | null;
          contact_no: string | null;
          gestational_age_weeks: number | null;
          gestational_age_days: number | null;
          is_step_down: boolean;
          step_down_date: string | null;
          step_down_from: string | null;
          is_draft: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          firebase_id?: string | null;
          institution_id: string;
          admission_unit_id?: string | null;
          current_unit_id?: string | null;
          monthly_record_id?: string | null;
          ntid?: string | null;
          name: string;
          ip_number?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          admission_date?: string | null;
          discharge_date?: string | null;
          admission_year_month?: string | null;
          discharge_year_month?: string | null;
          outcome?: string | null;
          admission_diagnosis?: string | null;
          final_diagnosis?: string | null;
          age?: number | null;
          age_unit?: string | null;
          birth_weight?: number | null;
          weight_on_admission?: number | null;
          weight_on_discharge?: number | null;
          admission_type?: string | null;
          place_of_delivery?: string | null;
          referring_hospital?: string | null;
          referring_district?: string | null;
          mother_name?: string | null;
          father_name?: string | null;
          address?: string | null;
          village?: string | null;
          district?: string | null;
          state?: string | null;
          pin_code?: string | null;
          contact_no?: string | null;
          gestational_age_weeks?: number | null;
          gestational_age_days?: number | null;
          is_step_down?: boolean;
          step_down_date?: string | null;
          step_down_from?: string | null;
          is_draft?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          firebase_id?: string | null;
          institution_id?: string;
          admission_unit_id?: string | null;
          current_unit_id?: string | null;
          monthly_record_id?: string | null;
          ntid?: string | null;
          name?: string;
          ip_number?: string | null;
          date_of_birth?: string | null;
          gender?: string | null;
          admission_date?: string | null;
          discharge_date?: string | null;
          admission_year_month?: string | null;
          discharge_year_month?: string | null;
          outcome?: string | null;
          admission_diagnosis?: string | null;
          final_diagnosis?: string | null;
          age?: number | null;
          age_unit?: string | null;
          birth_weight?: number | null;
          weight_on_admission?: number | null;
          weight_on_discharge?: number | null;
          admission_type?: string | null;
          place_of_delivery?: string | null;
          referring_hospital?: string | null;
          referring_district?: string | null;
          mother_name?: string | null;
          father_name?: string | null;
          address?: string | null;
          village?: string | null;
          district?: string | null;
          state?: string | null;
          pin_code?: string | null;
          contact_no?: string | null;
          gestational_age_weeks?: number | null;
          gestational_age_days?: number | null;
          is_step_down?: boolean;
          step_down_date?: string | null;
          step_down_from?: string | null;
          is_draft?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      progress_notes: {
        Row: {
          id: string;
          patient_id: string;
          firebase_id: string | null;
          date: string;
          year_month: string | null;
          temperature: number | null;
          heart_rate: number | null;
          respiratory_rate: number | null;
          spo2: number | null;
          blood_pressure: string | null;
          weight: number | null;
          examination: Json | null;
          assessment: string | null;
          plan: string | null;
          note: string | null;
          medications: Json | null;
          icd10_codes: string | null;
          added_by: string | null;
          added_by_email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          firebase_id?: string | null;
          date: string;
          year_month?: string | null;
          temperature?: number | null;
          heart_rate?: number | null;
          respiratory_rate?: number | null;
          spo2?: number | null;
          blood_pressure?: string | null;
          weight?: number | null;
          examination?: Json | null;
          assessment?: string | null;
          plan?: string | null;
          note?: string | null;
          medications?: Json | null;
          icd10_codes?: string | null;
          added_by?: string | null;
          added_by_email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          firebase_id?: string | null;
          date?: string;
          year_month?: string | null;
          temperature?: number | null;
          heart_rate?: number | null;
          respiratory_rate?: number | null;
          spo2?: number | null;
          blood_pressure?: string | null;
          weight?: number | null;
          examination?: Json | null;
          assessment?: string | null;
          plan?: string | null;
          note?: string | null;
          medications?: Json | null;
          icd10_codes?: string | null;
          added_by?: string | null;
          added_by_email?: string | null;
          created_at?: string;
        };
      };
      clinical_notes: {
        Row: {
          id: string;
          patient_id: string;
          firebase_id: string | null;
          type: string | null;
          content: string | null;
          author_email: string | null;
          author_name: string | null;
          year_month: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          firebase_id?: string | null;
          type?: string | null;
          content?: string | null;
          author_email?: string | null;
          author_name?: string | null;
          year_month?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          firebase_id?: string | null;
          type?: string | null;
          content?: string | null;
          author_email?: string | null;
          author_name?: string | null;
          year_month?: string | null;
          created_at?: string;
        };
      };
      discharge_summaries: {
        Row: {
          id: string;
          patient_id: string;
          firebase_id: string | null;
          summary_data: Json | null;
          discharge_type: string | null;
          discharge_date: string | null;
          prepared_by: string | null;
          verified_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          firebase_id?: string | null;
          summary_data?: Json | null;
          discharge_type?: string | null;
          discharge_date?: string | null;
          prepared_by?: string | null;
          verified_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          firebase_id?: string | null;
          summary_data?: Json | null;
          discharge_type?: string | null;
          discharge_date?: string | null;
          prepared_by?: string | null;
          verified_by?: string | null;
          created_at?: string;
        };
      };
      death_records: {
        Row: {
          id: string;
          patient_id: string;
          date_of_death: string | null;
          cause_of_death: string | null;
          diagnosis_at_death: string | null;
          ai_interpreted_diagnosis: string | null;
          ai_analysis: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          date_of_death?: string | null;
          cause_of_death?: string | null;
          diagnosis_at_death?: string | null;
          ai_interpreted_diagnosis?: string | null;
          ai_analysis?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          date_of_death?: string | null;
          cause_of_death?: string | null;
          diagnosis_at_death?: string | null;
          ai_interpreted_diagnosis?: string | null;
          ai_analysis?: Json | null;
          created_at?: string;
        };
      };
    };
    Views: {
      monthly_patient_summary: {
        Row: {
          institution_name: string | null;
          admission_year_month: string | null;
          unit_name: string | null;
          total_patients: number | null;
          discharged: number | null;
          deceased: number | null;
          in_progress: number | null;
        };
      };
      patient_hierarchy: {
        Row: {
          institution: string | null;
          month: string | null;
          unit: string | null;
          patient_name: string | null;
          ip_number: string | null;
          outcome: string | null;
          admission_date: string | null;
          discharge_date: string | null;
          note_count: number | null;
          clinical_note_count: number | null;
        };
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Helper types for easier usage
export type Institution = Database['public']['Tables']['institutions']['Row'];
export type InsertInstitution = Database['public']['Tables']['institutions']['Insert'];
export type UpdateInstitution = Database['public']['Tables']['institutions']['Update'];

export type Unit = Database['public']['Tables']['units']['Row'];
export type InsertUnit = Database['public']['Tables']['units']['Insert'];
export type UpdateUnit = Database['public']['Tables']['units']['Update'];

export type SupabasePatient = Database['public']['Tables']['patients']['Row'];
export type InsertPatient = Database['public']['Tables']['patients']['Insert'];
export type UpdatePatient = Database['public']['Tables']['patients']['Update'];

export type ProgressNote = Database['public']['Tables']['progress_notes']['Row'];
export type InsertProgressNote = Database['public']['Tables']['progress_notes']['Insert'];
export type UpdateProgressNote = Database['public']['Tables']['progress_notes']['Update'];

export type ClinicalNote = Database['public']['Tables']['clinical_notes']['Row'];
export type InsertClinicalNote = Database['public']['Tables']['clinical_notes']['Insert'];
export type UpdateClinicalNote = Database['public']['Tables']['clinical_notes']['Update'];

export type DischargeSummary = Database['public']['Tables']['discharge_summaries']['Row'];
export type InsertDischargeSummary = Database['public']['Tables']['discharge_summaries']['Insert'];
export type UpdateDischargeSummary = Database['public']['Tables']['discharge_summaries']['Update'];

export type DeathRecord = Database['public']['Tables']['death_records']['Row'];
export type InsertDeathRecord = Database['public']['Tables']['death_records']['Insert'];
export type UpdateDeathRecord = Database['public']['Tables']['death_records']['Update'];

export type MonthlyPatientSummary = Database['public']['Views']['monthly_patient_summary']['Row'];
export type PatientHierarchy = Database['public']['Views']['patient_hierarchy']['Row'];
