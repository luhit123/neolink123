export enum Unit {
  NICU = "Neonatal Intensive Care Unit",
  PICU = "Pediatric Intensive Care Unit",
}

export enum UserRole {
  SuperAdmin = "SuperAdmin",
  Admin = "Admin",
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
    addedBy?: string; // User name who added the note
    addedByEmail?: string; // User email for documentation
}

export interface EditHistory {
    timestamp: string; // ISO string
    editedBy: string; // User name or role
    editedByEmail: string; // User email for documentation
    changes: string; // Description of changes
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
  outcome: 'In Progress' | 'Discharged' | 'Referred' | 'Deceased' | 'Step Down';
  unit: Unit;
  // Institution tracking
  institutionId: string; // Which institution this patient belongs to
  institutionName: string; // Institution name for display
  // NICU specific
  admissionType?: AdmissionType;
  referringHospital?: string;
  referringDistrict?: string;
  // PICU Step Down functionality
  stepDownDate?: string; // ISO string when stepped down
  stepDownFrom?: Unit; // Which unit they were stepped down from
  isStepDown?: boolean; // Currently in step down status
  readmissionFromStepDown?: boolean; // Was readmitted from step down
  finalDischargeDate?: string; // For step down patients who are finally discharged
  // Referral information
  referralReason?: string; // Reason for referring patient to another facility
  referredTo?: string; // Name of facility patient was referred to
  // Status tracking
  isDraft?: boolean; // True if nurse saved basic info, waiting for doctor
  createdBy?: UserRole; // Who created the record
  createdByEmail?: string; // Email of who created
  lastUpdatedBy?: UserRole; // Who last updated
  lastUpdatedByEmail?: string; // Email of who last updated
  // Edit tracking
  editHistory?: EditHistory[]; // Track all edits
  lastEditedAt?: string; // ISO string of last edit
}

export interface MonthlyAdmission {
    month: string;
    admissions: number;
    discharges: number;
}

export interface Institution {
  id: string;
  name: string;
  adminEmail: string; // Admin email for this institution
  createdAt: string;
  createdBy: string; // SuperAdmin email who created it
}

export interface InstitutionUser {
  uid: string; // Firebase user ID
  email: string;
  displayName: string;
  role: UserRole; // Admin, Doctor, or Nurse (not SuperAdmin)
  institutionId: string;
  institutionName: string;
  addedBy: string; // Email of who added this user
  addedAt: string;
  enabled: boolean; // Can be disabled by Admin
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  institutionId?: string; // Only for non-SuperAdmin users
  institutionName?: string; // Only for non-SuperAdmin users
  createdAt: string;
  lastLoginAt?: string;
  allRoles?: UserRole[]; // All roles the user has (for multi-role users)
}
