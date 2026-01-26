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

export enum BloodGroup {
  APositive = "A+",
  ANegative = "A-",
  BPositive = "B+",
  BNegative = "B-",
  ABPositive = "AB+",
  ABNegative = "AB-",
  OPositive = "O+",
  ONegative = "O-",
  Unknown = "Unknown"
}

export enum MaternalRiskFactor {
  GDM = "Gestational Diabetes (GDM)",
  PIH = "Pregnancy Induced Hypertension (PIH)",
  Preeclampsia = "Pre-eclampsia",
  Eclampsia = "Eclampsia",
  Hypothyroidism = "Hypothyroidism",
  Hyperthyroidism = "Hyperthyroidism",
  PROM = "Premature Rupture of Membranes (PROM)",
  PPROM = "Preterm PROM (PPROM)",
  Oligohydramnios = "Oligohydramnios",
  Polyhydramnios = "Polyhydramnios",
  APH = "Antepartum Hemorrhage (APH)",
  Chorioamnionitis = "Chorioamnionitis / Maternal Fever",
  MultipleGestation = "Multiple Gestation (Twins/Triplets)",
  Anemia = "Maternal Anemia",
  UTI = "Urinary Tract Infection",
  HeartDisease = "Heart Disease",
  RhNegative = "Rh Negative Mother",
  PreviousCSection = "Previous C-Section",
  BadObstetricHistory = "Bad Obstetric History (BOH)"
}

export interface MaternalHistory {
  // Obstetric Formula (G_P_A_L)
  gravida?: number; // Total pregnancies
  para?: number; // Deliveries after 20 weeks
  abortion?: number; // Pregnancies lost before 20 weeks
  living?: number; // Currently living children

  // LMP & EDD (Critical for Gestational Age)
  lmp?: string; // Last Menstrual Period - ISO date string
  edd?: string; // Expected Date of Delivery - ISO date string (auto-calculated or manual)
  menstrualCycleLength?: number; // Cycle length in days (default 28)

  // Maternal Blood Group
  bloodGroup?: BloodGroup;

  // Maternal Age
  maternalAge?: number; // Mother's age in years

  // Antenatal Care
  ancReceived?: boolean; // Whether ANC was received
  ancVisits?: number; // Number of ANC visits
  ancPlace?: string; // Where ANC was received

  // Antenatal Steroid Coverage (Critical for preterm)
  antenatalSteroidsGiven?: boolean;
  steroidDoses?: number; // Number of doses (typically 1-2)
  lastSteroidToDeliveryHours?: number; // Hours between last dose and delivery

  // Risk Factors (multiple can be selected)
  riskFactors?: MaternalRiskFactor[];
  otherRiskFactors?: string; // Free text for other conditions

  // Intrapartum Risk Factors
  prolongedRupture?: boolean; // PROM > 18 hours
  ruptureToDeliveryHours?: number; // Hours from rupture to delivery
  meconiumStainedLiquor?: boolean; // MSL present
  fetalDistress?: boolean; // Signs of fetal distress
  maternalFever?: boolean; // Fever during labor (>100.4°F / 38°C)

  // Previous Pregnancy Outcomes
  previousNICUAdmissions?: number;
  previousNeonatalDeaths?: number;
  previousStillbirths?: number;
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

  // Gestational Age at Birth (calculated from LMP and DOB)
  gestationalAgeWeeks?: number; // Completed weeks at birth
  gestationalAgeDays?: number; // Remaining days after completed weeks
  gestationalAgeCategory?: 'Extremely Preterm' | 'Very Preterm' | 'Moderate to Late Preterm' | 'Early Term' | 'Full Term' | 'Late Term' | 'Post Term';

  // Maternal History
  maternalHistory?: MaternalHistory;

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
  stepDownLocation?: string; // Where the patient was stepped down to (e.g., Mother Side, Ward)
  isStepDown?: boolean; // Currently in step down status
  readmissionFromStepDown?: boolean; // Was readmitted from step down
  finalDischargeDate?: string; // For step down patients who are finally discharged
  // Referral information
  referralReason?: string; // Reason for referring patient to another facility
  referredTo?: string; // Name of facility patient was referred to

  // Saved Discharge Summary (stored when discharge is finalized)
  savedDischargeSummary?: DischargeSummary; // The complete discharge summary saved to patient record
  dischargeSavedAt?: string; // ISO string when discharge was saved
  dischargeSavedBy?: string; // Name of who saved the discharge

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

// ==================== DISCHARGE SUMMARY TYPES ====================

export enum DischargeType {
  Normal = "Normal Discharge",
  DOR = "Discharge on Request",
  DAMA = "Discharge Against Medical Advice",
  LAMA = "Left Against Medical Advice",
  Referred = "Referred to Higher Center",
  Expired = "Expired"
}

export enum FeedingType {
  ExclusiveBreastfeeding = "Exclusive Breastfeeding",
  ExpressedBreastMilk = "Expressed Breast Milk (EBM)",
  Formula = "Formula Feeding",
  Mixed = "Mixed Feeding",
  NGTube = "NG Tube Feeding",
  OGTube = "OG Tube Feeding",
  Spoon = "Spoon Feeding",
  Paladai = "Paladai/Katori Feeding"
}

export enum VaccinationType {
  BCG = "BCG",
  OPV0 = "OPV-0 (Birth dose)",
  HepB0 = "Hepatitis B-0 (Birth dose)",
  VitaminK = "Vitamin K Injection"
}

export enum ScreeningStatus {
  Passed = "Passed",
  Referred = "Referred for further evaluation",
  NotDone = "Not Done",
  Pending = "Pending"
}

export interface DischargeScreenings {
  // Hearing Screen
  hearingScreenDone?: boolean;
  hearingScreenResult?: ScreeningStatus;
  hearingScreenDate?: string;
  hearingScreenNotes?: string;

  // Metabolic/Newborn Screen
  metabolicScreenDone?: boolean;
  metabolicScreenResult?: ScreeningStatus;
  metabolicScreenDate?: string;
  metabolicScreenNotes?: string;

  // ROP Screening (Retinopathy of Prematurity)
  ropScreeningDone?: boolean;
  ropScreeningResult?: string;
  ropScreeningDate?: string;
  nextRopScreeningDate?: string;

  // Car Seat Test (for preterm)
  carSeatTestDone?: boolean;
  carSeatTestResult?: ScreeningStatus;
}

export interface DischargeVitals {
  weight: number; // in kg
  length?: number; // in cm
  headCircumference?: number; // in cm
  temperature?: string;
  heartRate?: string;
  respiratoryRate?: string;
  spo2?: string;
  bloodPressure?: string;
}

export interface DischargeFeeding {
  feedingType: FeedingType;
  feedingVolume?: string; // e.g., "60ml"
  feedingFrequency?: string; // e.g., "3 hourly"
  calories?: string; // e.g., "24 kcal/oz"
  specialInstructions?: string;
}

export interface DischargeMedication {
  name: string;
  frequency: string;
  duration?: string; // e.g., "7 days", "until follow-up", "Up to 1 year of age"
  instructions?: string;
}

// NHM Follow-up Schedule for NICU/SNCU discharged babies
export interface NHMFollowUpSchedule {
  // Home visits by ASHA (HBNC Program)
  homeVisits: {
    day3: boolean;
    day7: boolean;
    day14: boolean;
    day21: boolean;
    day28: boolean;
    day42: boolean;
  };
  // Facility follow-up visits
  facilityVisits: {
    month3: boolean;
    month6: boolean;
    month9: boolean;
    year1: boolean;
  };
  // Additional notes
  specialFollowUp?: string; // For ROP, hearing, etc.
  additionalInstructions?: string;
}

// Legacy - kept for backward compatibility
export interface FollowUpAppointment {
  specialty: string;
  doctorName?: string;
  hospital?: string;
  date?: string;
  instructions?: string;
}

export interface DischargeSummary {
  // Patient Identification
  patientId: string;
  patientName: string;
  ntid?: string;
  hospitalName: string;
  hospitalAddress?: string;

  // Patient Address
  patientAddress?: string;
  patientVillage?: string;
  patientDistrict?: string;
  patientState?: string;
  patientPinCode?: string;

  // Admission Type
  admissionType?: 'Inborn' | 'Outborn';

  // Discharge Type
  dischargeType?: DischargeType;
  damaReason?: string; // Reason given by patient party for DAMA/DOR
  damaWitnessName?: string; // Witness for DAMA
  damaAcknowledgement?: boolean; // Patient party acknowledged risks

  // Admission & Discharge Dates
  admissionDate: string;
  admissionTime?: string;
  dischargeDate: string;
  dischargeTime?: string;
  totalStayDays: number;

  // Demographics
  dateOfBirth?: string;
  gender: string;
  birthWeight?: number;
  gestationalAge?: string; // e.g., "32+4 weeks"
  gestationalAgeCategory?: string;

  // Maternal History (for NICU/SNCU)
  motherName?: string;
  fatherName?: string;
  maternalAge?: number;
  bloodGroup?: string;
  modeOfDelivery?: string;
  placeOfDelivery?: string;
  apgarScore?: string; // e.g., "7/9"
  resuscitationRequired?: boolean;
  resuscitationDetails?: string;

  // Diagnoses
  primaryDiagnosis: string; // Initial/admission diagnosis
  finalDiagnosis?: string; // AI-generated or manually entered final diagnosis at discharge
  secondaryDiagnoses?: string[];
  icd10Codes?: string[];

  // Condition at Admission
  conditionAtAdmission?: string;
  indicationsForAdmission?: string[];

  // Clinical Course Summary
  clinicalCourseSummary: string; // AI-generated or manual
  significantEvents?: string[];
  proceduresPerformed?: string[];
  investigationsResults?: string;

  // Discharge Vitals & Anthropometry
  dischargeVitals: DischargeVitals;
  weightGain?: number; // Total weight gain during stay

  // Condition at Discharge
  conditionAtDischarge: 'Stable' | 'Improved' | 'Guarded' | 'Critical';
  generalCondition?: string;
  activity?: string; // e.g., "Active, Alert"
  suckingReflex?: 'Good' | 'Fair' | 'Poor';

  // Feeding at Discharge
  dischargeFeeding: DischargeFeeding;

  // Treatment Received During Hospital Stay
  treatmentReceived?: string[]; // List of treatments/medications given during stay

  // Follow-up Medications (to take home)
  dischargeMedications: DischargeMedication[];

  // Vaccinations
  vaccinationsGiven: VaccinationType[];
  vaccinationDates?: Record<VaccinationType, string>;
  pendingVaccinations?: string[];

  // Screenings
  screenings: DischargeScreenings;

  // Follow-up Plan (NHM Schedule)
  nhmFollowUpSchedule?: NHMFollowUpSchedule;
  followUpAppointments?: FollowUpAppointment[]; // Legacy - for specialist referrals
  nextImmunizationDue?: string;
  nextImmunizationDate?: string;

  // Parent Education & Counseling
  parentEducationTopics?: string[];
  warningSignsCounseled?: boolean;
  feedingDemonstrated?: boolean;
  medicationDemonstrated?: boolean;
  emergencyContactProvided?: boolean;

  // Equipment Needs
  homeEquipment?: string[]; // e.g., ["Oxygen concentrator", "Pulse oximeter"]
  equipmentInstructions?: string;

  // Special Instructions
  dischargeAdvice: string[];
  dietaryRestrictions?: string;
  activityRestrictions?: string;
  warningSignsToWatch: string[];

  // Contact Information
  emergencyContact?: string;
  hospitalHelpline?: string;
  primaryCarePhysician?: string;

  // Document Metadata
  preparedBy: string;
  preparedByRole: string;
  verifiedBy?: string;
  verifiedByRole?: string;
  generatedAt: string;

  // For PICU specific
  isPICU?: boolean;
}
