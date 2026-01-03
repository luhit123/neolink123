export enum Unit {
  NICU = "Neonatal Intensive Care Unit",
  PICU = "Pediatric Intensive Care Unit",
  SNCU = "Special New Born Care Unit",
  HDU = "High Dependency Unit",
  GENERAL_WARD = "General Ward"
}

export enum UserRole {
  SuperAdmin = "SuperAdmin",
  Admin = "Admin",
  Doctor = "Doctor",
  Nurse = "Nurse",
  DistrictAdmin = "District Admin"
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

export interface VitalSigns {
  temperature?: string; // Temperature in °C or °F
  hr?: string; // Heart Rate (bpm)
  rr?: string; // Respiratory Rate (breaths/min)
  bp?: string; // Blood Pressure (mmHg)
  spo2?: string; // Oxygen Saturation (%)
  crt?: string; // Capillary Refill Time (seconds)
  weight?: string; // Weight (kg/g)
  [key: string]: string | undefined; // Allow additional vitals
}

export interface ClinicalExamination {
  cns?: string; // Central Nervous System
  cvs?: string; // Cardiovascular System
  chest?: string; // Chest/Respiratory examination
  perAbdomen?: string; // Per Abdomen examination
  otherFindings?: string; // Other significant findings
}

export interface Medication {
  name: string;
  dose: string;
  route?: string; // IV, PO, IM, etc.
  frequency?: string; // TID, QID, BD, etc.
}

export interface ProgressNote {
  date: string; // ISO string
  note?: string; // General clinical note (optional now)

  // Vital Signs
  vitals?: VitalSigns;

  // Clinical Examination
  examination?: ClinicalExamination;

  // Medications
  medications?: Medication[];

  // Legacy support
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

export interface BedCapacity {
  PICU: number;
  NICU: number;
  SNCU?: number;
  HDU?: number;
  GENERAL_WARD?: number;
}

export interface Institution {
  id: string;
  name: string;
  adminEmail: string; // Admin email for this institution
  createdAt: string;
  createdBy: string; // SuperAdmin email who created it
  bedCapacity?: BedCapacity; // Bed capacity for each unit
  facilities?: Unit[]; // Enabled facilities (NICU, PICU, SNCU)
  district?: string; // District name
  institutionType?: string; // Type of institution (Medical College, PHC, etc.)
}

export interface InstitutionUser {
  uid: string; // Firebase user ID
  email: string;
  displayName: string;
  role: UserRole; // Admin, Doctor, Nurse, or DistrictAdmin (not SuperAdmin)
  institutionId: string;
  institutionName: string;
  addedBy: string; // Admin email who added this user
  addedAt: string;
  enabled: boolean; // Can be disabled by Admin
  assignedDistrict?: string; // For DistrictAdmin role
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

export interface Hospital {
  id: string;
  name: string;
  address: string;
  contactNumber: string;
  email: string;
  district?: string;
  state?: string;
  pincode?: string;
  facilities: Unit[]; // Available units/facilities
  createdAt: string;
  createdBy: string; // SuperAdmin who created it
  isActive: boolean;
  bedCapacity?: BedCapacity; // Bed capacity for each unit
  institutionType?: string; // Type (Medical College, District Hospital, CHC, PHC, etc.)
}

export interface ReferralDetails {
  reasonForReferral: string;
  diagnosisAtReferral: string;
  conditionAtReferral: string;
  treatmentsProvided: string[]; // List of treatments given before referral
  vitalSignsAtReferral?: VitalSigns;
  investigationsPerformed?: string; // Lab reports, imaging, etc.
  recommendedTreatment?: string; // Suggested treatment at receiving hospital
  clinicalSummary?: string; // Brief clinical summary
}

export interface ReferralStatusUpdate {
  timestamp: string; // ISO string
  updatedBy: string; // User name
  updatedByEmail: string;
  updatedByRole: UserRole;
  status: string; // Status description
  condition?: string; // Patient condition at this update
  notes?: string; // Additional notes
  vitalSigns?: VitalSigns; // Vital signs at update
}

export interface Referral {
  id: string;

  // Patient Information
  patientId: string;
  patientName: string;
  patientAge: number;
  patientAgeUnit: AgeUnit;
  patientGender: 'Male' | 'Female' | 'Other';
  patientAdmissionDate: string; // Original admission date at referring hospital

  // Referring Hospital Information
  fromHospitalId: string;
  fromHospitalName: string;
  fromUnit: Unit;
  referredBy: string; // Doctor/user name
  referredByEmail: string;
  referredByRole: UserRole;
  referralDate: string; // ISO string when referral was created

  // Receiving Hospital Information
  toHospitalId: string;
  toHospitalName: string;
  toUnit?: Unit; // Suggested unit for admission

  // Referral Details
  referralDetails: ReferralDetails;
  referralLetter?: string; // AI-generated referral letter

  // Status Tracking
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Patient Admitted' | 'Patient Discharged' | 'Patient Deceased';
  statusUpdates: ReferralStatusUpdate[];

  // Response Information
  acceptedBy?: string; // Name of person who accepted
  acceptedByEmail?: string;
  acceptedAt?: string; // ISO string
  responseNotes?: string; // Notes from receiving hospital

  // Patient tracking at receiving hospital
  receivingHospitalPatientId?: string; // Patient ID at receiving hospital if admitted

  // Metadata
  createdAt: string;
  lastUpdatedAt: string;
  isRead?: boolean; // Has receiving hospital seen this referral
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
}
