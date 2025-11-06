export enum Unit {
  NICU = "Neonatal Intensive Care Unit",
  PICU = "Pediatric Intensive Care Unit",
}

export enum UserRole {
  Admin = "Administrator",
  Doctor = "Doctor",
  Nurse = "Nurse",
}

export enum AgeUnit {
    Days = "days",
    Weeks = "weeks",
    Months = "months",
    Years = "years"
}

export enum AdmissionType {
    Inborn = "Inborn",
    Outborn = "Outborn"
}

export interface ProgressNote {
    date: string; // ISO string
    note: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  ageUnit: AgeUnit;
  gender: 'Male' | 'Female' | 'Other';
  admissionDate: string; // ISO string
  releaseDate?: string; // ISO string
  diagnosis: string;
  progressNotes: ProgressNote[];
  outcome: 'In Progress' | 'Discharged' | 'Referred' | 'Deceased';
  unit: Unit;
  // NICU specific
  admissionType?: AdmissionType;
  referringHospital?: string;
  referringDistrict?: string;
  // Status tracking
  isDraft?: boolean; // True if nurse saved basic info, waiting for doctor
  createdBy?: UserRole; // Who created the record
  lastUpdatedBy?: UserRole; // Who last updated
}

export interface MonthlyAdmission {
    month: string;
    admissions: number;
    discharges: number;
}
