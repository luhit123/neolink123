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
  OutbornHealthFacility = "Outborn (Health Facility Referred)",
  OutbornCommunity = "Outborn (Community Referred)"
}

export enum Category {
  General = "General",
  OBC = "OBC",
  SC = "SC",
  ST = "ST"
}

export enum PlaceOfDelivery {
  Home = "Home",
  Ambulance = "Ambulance",
  PrivateHospital = "Private Hospital",
  GovernmentHospital = "Government Hospital"
}

export enum ModeOfTransport {
  SelfArranged = "Self Arranged",
  GovernmentProvided = "Government Provided"
}

export enum ModeOfDelivery {
  Normal = "Normal Vaginal Delivery",
  Cesarean = "Cesarean Section (C-Section)",
  Forceps = "Forceps Assisted",
  Vacuum = "Vacuum Assisted",
  VBAC = "VBAC (Vaginal Birth After Cesarean)"
}

export interface AdmissionIndication {
  id: string;
  name: string;
  applicableUnits: Unit[]; // Which units this indication applies to
  isActive: boolean;
  order: number; // For sorting
  createdAt: string;
  createdBy: string; // SuperAdmin email
  lastModifiedAt?: string;
  lastModifiedBy?: string;
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
  frequency?: string; // TID, QID, BD, Continuous Infusion, etc.
  startDate?: string; // ISO date when medication was started
  stopDate?: string; // ISO date when medication was stopped
  isActive?: boolean; // Whether medication is currently running (default: true)
  isCustom?: boolean; // Whether medication is custom (not from database)
  // Audit tracking
  addedBy?: string; // Name of person who added
  addedAt?: string; // ISO date when added
  stoppedBy?: string; // Name of person who stopped
  stoppedAt?: string; // ISO date when stopped
  lastUpdatedBy?: string; // Name of person who last updated
  lastUpdatedAt?: string; // ISO date when last updated
}

// Medication Database - Managed by SuperAdmin
export interface MedicationDatabase {
  id: string;
  name: string; // Generic name (e.g., "Ampicillin")
  brandNames?: string[]; // Alternative brand names
  category: MedicationCategory; // Antibiotic, Analgesic, etc.
  commonDoses: string[]; // Common dosage options (e.g., ["50mg/kg", "100mg/kg"])
  routes: string[]; // Available routes (IV, PO, IM, etc.)
  frequencies: string[]; // Common frequencies (BD, TID, QID, etc.)
  indication: string; // Primary indication/usage
  applicableUnits: Unit[]; // Which units commonly use this (NICU, PICU, etc.)
  ageGroups?: string[]; // Age groups this is commonly used for
  warnings?: string; // Important warnings or contraindications
  isActive: boolean; // Can be deactivated by SuperAdmin
  createdAt: string; // ISO string
  createdBy: string; // SuperAdmin email
  lastModifiedAt?: string; // ISO string
  lastModifiedBy?: string; // SuperAdmin email
  searchTerms?: string[]; // Additional search terms for better autocomplete
}

export enum MedicationCategory {
  Antibiotic = "Antibiotic",
  Analgesic = "Analgesic / Pain Relief",
  Antipyretic = "Antipyretic / Fever Reducer",
  Respiratory = "Respiratory Support",
  Cardiovascular = "Cardiovascular",
  Gastrointestinal = "Gastrointestinal",
  Neurological = "Neurological",
  Vitamin = "Vitamin / Supplement",
  Anticonvulsant = "Anticonvulsant",
  Sedative = "Sedative / Analgesic",
  Inotrope = "Inotrope / Vasopressor",
  Diuretic = "Diuretic",
  Anticoagulant = "Anticoagulant",
  Steroid = "Steroid / Corticosteroid",
  Surfactant = "Surfactant",
  Fluid = "IV Fluid / Electrolyte",
  Other = "Other"
}

export interface ProgressNote {
  id?: string; // Unique identifier for the note
  date: string; // ISO string
  note?: string; // General clinical note (optional now)

  // Vital Signs
  vitals?: VitalSigns;

  // Clinical Examination
  examination?: ClinicalExamination;

  // Medications
  medications?: Medication[];

  // ICD-10 Codes
  icd10Codes?: string; // Formatted ICD-10 codes string

  // Legacy support
  addedBy?: string; // User name who added the note
  addedByEmail?: string; // User email for documentation
  timestamp?: string; // Timestamp for sorting

  // Author tracking (for voice notes)
  authorEmail?: string; // Author's email
  authorName?: string; // Author's name
}

export interface EditHistory {
  timestamp: string; // ISO string
  editedBy: string; // User name or role
  editedByEmail: string; // User email for documentation
  changes: string; // Description of changes
}

export interface Patient {
  id: string;
  ntid?: string; // Neolink Tracking ID - unique ID for each child (format: ABC202501xxxx)
  name: string;
  age: number;
  ageUnit: AgeUnit;
  gender: 'Male' | 'Female' | 'Other' | 'Ambiguous';
  admissionDate: string; // ISO string
  releaseDate?: string; // ISO string
  diagnosis: string;
  progressNotes: ProgressNote[];
  outcome: 'In Progress' | 'Discharged' | 'Referred' | 'Deceased' | 'Step Down';
  unit: Unit;
  // Institution tracking
  institutionId: string; // Which institution this patient belongs to
  institutionName: string; // Institution name for display

  // SNCU/NICU Administrative & Demographic Information
  sncuRegNo?: string; // SNCU Registration Number
  mctsNo?: string; // Mother and Child Tracking System Number
  doctorInCharge?: string; // Doctor responsible for the patient
  motherName?: string; // Baby of (Mother's Name)
  fatherName?: string; // Father's Name
  category?: Category; // General/OBC/SC/ST
  address?: string; // Complete Address with Village Name/Ward No.
  village?: string; // Village/Ward Name
  postOffice?: string; // Post Office Name
  pinCode?: string; // 6-digit PIN code
  district?: string; // District Name
  state?: string; // State Name
  contactNo1?: string; // Primary contact number
  contactRelation1?: string; // Relation of primary contact
  contactNo2?: string; // Secondary contact number
  contactRelation2?: string; // Relation of secondary contact

  // Birth Details
  dateOfBirth?: string; // ISO string with time
  birthWeight?: number; // Birth Weight in Kg
  modeOfDelivery?: ModeOfDelivery; // How the baby was delivered

  // Admission Details
  admissionDateTime?: string; // ISO string with time
  ageOnAdmission?: number; // Age on admission
  ageOnAdmissionUnit?: AgeUnit; // Unit for age on admission
  weightOnAdmission?: number; // Weight on Admission in Kg
  admissionType?: AdmissionType;
  placeOfDelivery?: PlaceOfDelivery; // Home/Ambulance/Pvt Hospital/Govt Hospital
  placeOfDeliveryName?: string; // Name of hospital if delivery place is hospital
  referringHospital?: string; // Referred From
  referringDistrict?: string;
  modeOfTransport?: ModeOfTransport; // Self Arranged / Govt. Provided

  // Discharge Details
  dischargeDateTime?: string; // ISO string with time
  ageOnDischarge?: number; // Age on discharge
  ageOnDischargeUnit?: AgeUnit; // Unit for age on discharge
  weightOnDischarge?: number; // Weight on Discharge in Kg

  // Clinical - Admission Indications (NICU/SNCU/PICU specific)
  indicationsForAdmission?: string[]; // Array of indication IDs or names
  customIndication?: string; // Custom indication if not in the list

  // PICU Step Down functionality
  stepDownDate?: string; // ISO string when stepped down
  stepDownFrom?: Unit; // Which unit they were stepped down from
  isStepDown?: boolean; // Currently in step down status
  readmissionFromStepDown?: boolean; // Was readmitted from step down
  finalDischargeDate?: string; // For step down patients who are finally discharged
  // Referral information
  referralReason?: string; // Reason for referring patient to another facility
  referredTo?: string; // Name of facility patient was referred to

  // Death Information (Mandatory when outcome is Deceased)
  diagnosisAtDeath?: string; // Full diagnosis written by doctor at time of death
  aiInterpretedDeathDiagnosis?: string; // AI-generated concise diagnosis
  dateOfDeath?: string; // ISO string when patient died
  // Status tracking
  isDraft?: boolean; // True if nurse saved basic info, waiting for doctor
  createdBy?: UserRole; // Who created the record
  createdByEmail?: string; // Email of who created
  createdByName?: string; // Display name of who created
  createdAt?: string; // ISO string when record was created
  lastUpdatedBy?: UserRole; // Who last updated
  lastUpdatedByEmail?: string; // Email of who last updated
  lastUpdatedByName?: string; // Display name of who last updated
  // Edit tracking
  editHistory?: EditHistory[]; // Track all edits
  lastEditedAt?: string; // ISO string of last edit

  // Medications - Master medication list for the patient
  medications?: Medication[]; // All medications for this patient (active + stopped)
}

export interface MonthlyAdmission {
  month: string;
  admissions: number;
  discharges: number;
}

export interface BedCapacity {
  PICU: number;
  NICU: number; // Legacy - kept for backward compatibility
  NICU_INBORN?: number; // Separate inborn beds for NICU
  NICU_OUTBORN?: number; // Separate outborn beds for NICU
  SNCU?: number;
  HDU?: number;
  GENERAL_WARD?: number;
}

export enum ObservationOutcome {
  InObservation = 'In Observation',
  HandedOverToMother = 'Handed Over to Mother',
  ConvertedToAdmission = 'Converted to Admission'
}

export interface ObservationPatient {
  id: string;
  babyName: string;
  motherName: string;
  dateOfBirth: string;
  reasonForObservation: string;
  unit: Unit;
  admissionType?: 'Inborn' | 'Outborn';
  dateOfObservation: string; // When observation started
  outcome: ObservationOutcome;
  convertedToPatientId?: string; // If converted to admission, reference to Patient ID
  dischargedAt?: string; // When handed over to mother
  institutionId: string;
  createdBy: string; // Doctor/Nurse email
  createdAt: string;
  updatedAt?: string;
}

export interface Institution {
  id: string;
  name: string;
  adminEmail: string; // Admin email for this institution

  // UserID-based authentication
  userID?: string; // Unique UserID (e.g., "GUW001", "DIB002")
  password?: string; // Admin password (set by SuperAdmin)

  createdAt: string;
  createdBy: string; // SuperAdmin email who created it
  bedCapacity?: BedCapacity; // Bed capacity for each unit
  facilities?: Unit[]; // Enabled facilities (NICU, PICU, SNCU)

  // Address information
  address?: string; // Full address
  village?: string; // Village/Ward name
  postOffice?: string; // Post Office
  pinCode?: string; // PIN code
  district?: string; // District name
  state?: string; // State name

  institutionType?: string; // Type of institution (Medical College, PHC, etc.)
}

// Password Reset Request
export interface PasswordResetRequest {
  id: string;
  institutionId: string;
  institutionName: string;
  userID: string;
  userEmail: string; // Email of user requesting reset
  userName?: string; // Display name of user
  userRole?: UserRole; // Role of user (Admin, Doctor, Nurse, etc.)
  requestedAt: string;
  requestedBy: string; // Email of person who requested
  status: 'pending' | 'approved' | 'rejected';
  newPassword?: string; // Set by SuperAdmin when approved
  approvedAt?: string;
  approvedBy?: string; // SuperAdmin email who approved
}

export interface InstitutionUser {
  uid: string; // Firebase user ID
  email: string;
  phoneNumber?: string; // Phone number for OTP login
  displayName: string;
  role: UserRole; // Admin, Doctor, Nurse, or DistrictAdmin (not SuperAdmin)
  institutionId: string;
  institutionName: string;
  addedBy: string; // Admin email who added this user
  addedAt: string;
  enabled: boolean; // Can be disabled by Admin
  assignedDistrict?: string; // For DistrictAdmin role
  userID?: string; // Unique UserID for login (e.g., "GUW001", "GUW002")
  password?: string; // Password set by SuperAdmin/Admin
  allowedDashboards?: Unit[]; // Dashboards user can access (PICU, NICU, SNCU, HDU, GENERAL_WARD)
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
  patientAdmissionDate: string; // Original admission date at referring institution

  // Referring Institution Information
  fromInstitutionId: string;
  fromInstitutionName: string;
  fromUnit: Unit;
  referredBy: string; // Doctor/user name
  referredByEmail: string;
  referredByRole: UserRole;
  referralDate: string; // ISO string when referral was created

  // Receiving Institution Information
  toInstitutionId: string;
  toInstitutionName: string;
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
  responseNotes?: string; // Notes from receiving institution

  // Patient tracking at receiving institution
  receivingInstitutionPatientId?: string; // Patient ID at receiving institution if admitted

  // Metadata
  createdAt: string;
  lastUpdatedAt: string;
  isRead?: boolean; // Has receiving institution seen this referral
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
}
