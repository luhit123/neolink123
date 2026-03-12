import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import {
  UserRole,
  Unit,
  AgeUnit,
  AdmissionType,
  BloodGroup
} from '../../types';
import type { PatientOutcome } from '../../types';

// Define PatientOutcome values as constants for use in tests
// These match the PatientOutcome type: 'In Progress' | 'Discharged' | 'Referred' | 'Deceased' | 'Step Down'
export const PatientOutcomeValues = {
  Admitted: 'In Progress' as PatientOutcome,
  Discharged: 'Discharged' as PatientOutcome,
  Referred: 'Referred' as PatientOutcome,
  Deceased: 'Deceased' as PatientOutcome,
  StepDown: 'Step Down' as PatientOutcome
};
import type { Patient, UserProfile, InstitutionUser, Referral } from '../../types';

// ============ MOCK USER DATA ============

/**
 * Mock users representing different roles and institutions
 * Use these in tests to simulate various access scenarios
 */
export const mockUsers = {
  doctorHospitalA: {
    uid: 'doctor-a-123',
    email: 'doctor@hospital-a.com',
    displayName: 'Dr. Sharma',
    role: UserRole.Doctor,
    institutionId: 'hospital-a',
    institutionName: 'City Children Hospital',
    createdAt: '2025-01-01T00:00:00.000Z'
  } as UserProfile,

  doctorHospitalB: {
    uid: 'doctor-b-456',
    email: 'doctor@hospital-b.com',
    displayName: 'Dr. Patel',
    role: UserRole.Doctor,
    institutionId: 'hospital-b',
    institutionName: 'Regional Medical Center',
    createdAt: '2025-01-01T00:00:00.000Z'
  } as UserProfile,

  nurseHospitalA: {
    uid: 'nurse-a-111',
    email: 'nurse@hospital-a.com',
    displayName: 'Nurse Singh',
    role: UserRole.Nurse,
    institutionId: 'hospital-a',
    institutionName: 'City Children Hospital',
    createdAt: '2025-01-01T00:00:00.000Z'
  } as UserProfile,

  adminHospitalA: {
    uid: 'admin-a-789',
    email: 'admin@hospital-a.com',
    displayName: 'Admin Kumar',
    role: UserRole.Admin,
    institutionId: 'hospital-a',
    institutionName: 'City Children Hospital',
    createdAt: '2025-01-01T00:00:00.000Z'
  } as UserProfile,

  superAdmin: {
    uid: 'super-admin-000',
    email: 'super@neolink.com',
    displayName: 'Super Admin',
    role: UserRole.SuperAdmin,
    createdAt: '2025-01-01T00:00:00.000Z'
  } as UserProfile,

  official: {
    uid: 'official-111',
    email: 'official@health.gov',
    displayName: 'Health Officer',
    role: UserRole.Official,
    createdAt: '2025-01-01T00:00:00.000Z'
  } as UserProfile,

  districtAdmin: {
    uid: 'district-admin-222',
    email: 'district@health.gov',
    displayName: 'District Admin',
    role: UserRole.DistrictAdmin,
    institutionId: 'district-guwahati',
    institutionName: 'Guwahati District',
    createdAt: '2025-01-01T00:00:00.000Z'
  } as UserProfile
};

// ============ MOCK PATIENT DATA ============

/**
 * Mock patients representing various clinical scenarios
 */
export const mockPatients = {
  patientHospitalA: {
    id: 'patient-a-001',
    ntid: 'CCH202501001',
    name: 'Baby Singh',
    age: 3,
    ageUnit: AgeUnit.Days,
    gender: 'Male',
    dateOfBirth: '2026-01-15T10:30:00.000Z',
    admissionDate: '2026-01-16T08:00:00.000Z',
    admissionDateTime: '2026-01-16T08:00:00.000Z',
    diagnosis: 'Respiratory Distress Syndrome',
    outcome: PatientOutcomeValues.Admitted,
    unit: Unit.NICU,
    institutionId: 'hospital-a',
    institutionName: 'City Children Hospital',
    progressNotes: [],
    birthWeight: 2.1,
    weightOnAdmission: 2.0,
    gestationalAgeWeeks: 32,
    gestationalAgeDays: 4,
    gestationalAgeCategory: 'Moderate to Late Preterm' as const,
    admissionType: AdmissionType.Inborn,
    indicationsForAdmission: ['Preterm', 'Low Birth Weight', 'Respiratory Distress'],
    motherName: 'Mrs. Singh',
    fatherName: 'Mr. Singh',
    contactNo1: '+91-9876543210',
    doctorInCharge: 'Dr. Sharma',
    createdBy: UserRole.Doctor,
    createdByEmail: 'doctor@hospital-a.com',
    createdAt: '2026-01-16T08:00:00.000Z'
  } as Patient,

  patientHospitalB: {
    id: 'patient-b-002',
    ntid: 'RMC202501001',
    name: 'Baby Sharma',
    age: 5,
    ageUnit: AgeUnit.Days,
    gender: 'Female',
    dateOfBirth: '2026-01-10T14:00:00.000Z',
    admissionDate: '2026-01-11T09:00:00.000Z',
    diagnosis: 'Neonatal Jaundice',
    outcome: PatientOutcomeValues.Admitted,
    unit: Unit.NICU,
    institutionId: 'hospital-b',
    institutionName: 'Regional Medical Center',
    progressNotes: [],
    birthWeight: 2.8,
    weightOnAdmission: 2.7,
    gestationalAgeWeeks: 38,
    gestationalAgeDays: 2,
    admissionType: AdmissionType.OutbornHealthFacility,
    indicationsForAdmission: ['Neonatal Jaundice', 'Hyperbilirubinemia'],
    motherName: 'Mrs. Sharma',
    fatherName: 'Mr. Sharma',
    contactNo1: '+91-9876543211',
    doctorInCharge: 'Dr. Patel',
    createdBy: UserRole.Doctor,
    createdByEmail: 'doctor@hospital-b.com',
    createdAt: '2026-01-11T09:00:00.000Z'
  } as Patient,

  dischargedPatient: {
    id: 'patient-a-003',
    ntid: 'CCH202501002',
    name: 'Baby Kumar',
    age: 12,
    ageUnit: AgeUnit.Days,
    gender: 'Male',
    dateOfBirth: '2026-01-08T06:00:00.000Z',
    admissionDate: '2026-01-08T08:00:00.000Z',
    diagnosis: 'Transient Tachypnea of Newborn',
    outcome: PatientOutcomeValues.Discharged,
    unit: Unit.NICU,
    institutionId: 'hospital-a',
    institutionName: 'City Children Hospital',
    progressNotes: [],
    releaseDate: '2026-01-20T10:00:00.000Z',
    dischargeDateTime: '2026-01-20T10:00:00.000Z',
    birthWeight: 3.0,
    weightOnAdmission: 2.9,
    weightOnDischarge: 3.2,
    gestationalAgeWeeks: 37,
    gestationalAgeDays: 0,
    admissionType: AdmissionType.Inborn,
    indicationsForAdmission: ['Respiratory Distress'],
    motherName: 'Mrs. Kumar',
    fatherName: 'Mr. Kumar',
    contactNo1: '+91-9876543212',
    doctorInCharge: 'Dr. Sharma',
    createdBy: UserRole.Doctor,
    createdByEmail: 'doctor@hospital-a.com',
    createdAt: '2026-01-08T08:00:00.000Z'
  } as Patient,

  deceasedPatient: {
    id: 'patient-a-004',
    ntid: 'CCH202501003',
    name: 'Baby Das',
    age: 1,
    ageUnit: AgeUnit.Days,
    gender: 'Female',
    dateOfBirth: '2026-01-05T02:00:00.000Z',
    admissionDate: '2026-01-05T02:30:00.000Z',
    diagnosis: 'Extreme Prematurity with Severe RDS',
    outcome: PatientOutcomeValues.Deceased,
    unit: Unit.NICU,
    institutionId: 'hospital-a',
    institutionName: 'City Children Hospital',
    progressNotes: [],
    dateOfDeath: '2026-01-05T18:00:00.000Z',
    diagnosisAtDeath: 'Respiratory failure secondary to extreme prematurity',
    birthWeight: 0.8,
    weightOnAdmission: 0.8,
    gestationalAgeWeeks: 24,
    gestationalAgeDays: 0,
    gestationalAgeCategory: 'Extremely Preterm' as const,
    admissionType: AdmissionType.Inborn,
    indicationsForAdmission: ['Extreme Prematurity', 'Severe Respiratory Distress'],
    motherName: 'Mrs. Das',
    fatherName: 'Mr. Das',
    contactNo1: '+91-9876543213',
    doctorInCharge: 'Dr. Sharma',
    createdBy: UserRole.Doctor,
    createdByEmail: 'doctor@hospital-a.com',
    createdAt: '2026-01-05T02:30:00.000Z'
  } as Patient,

  picuPatient: {
    id: 'patient-a-005',
    ntid: 'CCH202501004',
    name: 'Baby Bora',
    age: 2,
    ageUnit: AgeUnit.Years,
    gender: 'Male',
    dateOfBirth: '2024-01-20T00:00:00.000Z',
    admissionDate: '2026-01-22T14:00:00.000Z',
    diagnosis: 'Severe Pneumonia',
    outcome: PatientOutcomeValues.Admitted,
    unit: Unit.PICU,
    institutionId: 'hospital-a',
    institutionName: 'City Children Hospital',
    progressNotes: [],
    weightOnAdmission: 10.5,
    admissionType: AdmissionType.OutbornHealthFacility,
    referringHospital: 'Local Primary Health Center',
    indicationsForAdmission: ['Respiratory Failure', 'Severe Pneumonia', 'Oxygen Requirement'],
    motherName: 'Mrs. Bora',
    fatherName: 'Mr. Bora',
    contactNo1: '+91-9876543214',
    doctorInCharge: 'Dr. Sharma',
    createdBy: UserRole.Doctor,
    createdByEmail: 'doctor@hospital-a.com',
    createdAt: '2026-01-22T14:00:00.000Z'
  } as Patient
};

// ============ MOCK REFERRAL DATA ============

/**
 * Mock referrals for testing inter-hospital transfer workflows
 */
export const mockReferrals = {
  pendingReferral: {
    id: 'referral-001',
    patientId: mockPatients.patientHospitalA.id,
    patientName: mockPatients.patientHospitalA.name,
    patientAge: mockPatients.patientHospitalA.age,
    patientAgeUnit: mockPatients.patientHospitalA.ageUnit,
    patientGender: mockPatients.patientHospitalA.gender as 'Male' | 'Female' | 'Other',
    patientAdmissionDate: mockPatients.patientHospitalA.admissionDate,
    fromInstitutionId: 'hospital-a',
    fromInstitutionName: 'City Children Hospital',
    fromUnit: Unit.NICU,
    toInstitutionId: 'hospital-b',
    toInstitutionName: 'Regional Medical Center',
    toUnit: Unit.NICU,
    referredBy: 'Dr. Sharma',
    referredByEmail: 'doctor@hospital-a.com',
    referredByRole: UserRole.Doctor,
    referralDate: '2026-01-18T10:00:00.000Z',
    referralDetails: {
      reasonForReferral: 'Requires cardiac surgery not available at this facility',
      diagnosisAtReferral: 'Congenital Heart Defect - VSD',
      conditionAtReferral: 'Stable but requires surgical intervention',
      treatmentsProvided: ['Oxygen therapy', 'IV fluids', 'Antibiotics'],
      recommendedTreatment: 'Surgical repair of VSD',
      clinicalSummary: 'Preterm infant with large VSD causing heart failure symptoms'
    },
    status: 'Pending' as const,
    statusUpdates: [{
      timestamp: '2026-01-18T10:00:00.000Z',
      updatedBy: 'Dr. Sharma',
      updatedByEmail: 'doctor@hospital-a.com',
      updatedByRole: UserRole.Doctor,
      status: 'Referral initiated'
    }]
  } as Referral,

  acceptedReferral: {
    id: 'referral-002',
    patientId: 'patient-a-010',
    patientName: 'Baby Accepted',
    patientAge: 2,
    patientAgeUnit: AgeUnit.Days,
    patientGender: 'Female' as const,
    patientAdmissionDate: '2026-01-10T00:00:00.000Z',
    fromInstitutionId: 'hospital-a',
    fromInstitutionName: 'City Children Hospital',
    fromUnit: Unit.NICU,
    toInstitutionId: 'hospital-b',
    toInstitutionName: 'Regional Medical Center',
    referredBy: 'Dr. Sharma',
    referredByEmail: 'doctor@hospital-a.com',
    referredByRole: UserRole.Doctor,
    referralDate: '2026-01-12T10:00:00.000Z',
    referralDetails: {
      reasonForReferral: 'Requires ECMO support',
      diagnosisAtReferral: 'Persistent Pulmonary Hypertension',
      conditionAtReferral: 'Critical',
      treatmentsProvided: ['iNO therapy', 'Ventilator support'],
      clinicalSummary: 'Neonate with PPHN not responding to medical management'
    },
    status: 'Accepted' as const,
    statusUpdates: [
      {
        timestamp: '2026-01-12T10:00:00.000Z',
        updatedBy: 'Dr. Sharma',
        updatedByEmail: 'doctor@hospital-a.com',
        updatedByRole: UserRole.Doctor,
        status: 'Referral initiated'
      },
      {
        timestamp: '2026-01-12T11:00:00.000Z',
        updatedBy: 'Dr. Patel',
        updatedByEmail: 'doctor@hospital-b.com',
        updatedByRole: UserRole.Doctor,
        status: 'Referral accepted'
      }
    ]
  } as Referral
};

// ============ MOCK INSTITUTION DATA ============

export const mockInstitutions = {
  hospitalA: {
    id: 'hospital-a',
    name: 'City Children Hospital',
    code: 'CCH',
    type: 'Tertiary Care',
    state: 'Assam',
    district: 'Kamrup Metropolitan',
    address: '123 Medical Road, Guwahati',
    bedCapacity: {
      PICU: 20,
      NICU: 30,
      SNCU: 15,
      HDU: 10,
      GENERAL_WARD: 50
    },
    occupancy: {
      PICU: 15,
      NICU: 25,
      SNCU: 10,
      HDU: 8,
      GENERAL_WARD: 40
    }
  },
  hospitalB: {
    id: 'hospital-b',
    name: 'Regional Medical Center',
    code: 'RMC',
    type: 'Tertiary Care',
    state: 'Assam',
    district: 'Kamrup Metropolitan',
    address: '456 Health Avenue, Guwahati'
  }
};

// ============ RENDER UTILITIES ============

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  user?: UserProfile;
  route?: string;
  initialState?: Record<string, any>;
}

/**
 * Custom render function that wraps components with necessary providers
 *
 * @param ui - The React component to render
 * @param options - Custom options including mock user and route
 * @returns Render result plus utilities
 *
 * @example
 * const { getByText } = renderWithProviders(<PatientList />, {
 *   user: mockUsers.doctorHospitalA
 * });
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    user = mockUsers.doctorHospitalA,
    route = '/',
    initialState = {},
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  // Mock window history for routing
  window.history.pushState({}, 'Test page', route);

  // Simple wrapper - in a real app, you'd include your actual providers
  function Wrapper({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }

  return {
    user,
    ...render(ui, { wrapper: Wrapper, ...renderOptions })
  };
}

// ============ FIRESTORE MOCK UTILITIES ============

/**
 * Create a mock Firestore document snapshot
 */
export function createMockDoc<T extends Record<string, any>>(
  data: T,
  id: string = 'mock-id'
) {
  return {
    id,
    data: () => data,
    exists: () => true,
    ref: { id, path: `collection/${id}` },
    get: (field: keyof T) => data[field]
  };
}

/**
 * Create a mock Firestore query snapshot
 */
export function createMockQuerySnapshot<T extends Record<string, any>>(
  docs: (T & { id?: string })[]
) {
  const mockDocs = docs.map((doc, i) =>
    createMockDoc(doc, doc.id || `doc-${i}`)
  );

  return {
    docs: mockDocs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (callback: (doc: ReturnType<typeof createMockDoc>) => void) => {
      mockDocs.forEach(callback);
    }
  };
}

/**
 * Create a mock Firestore batch
 */
export function createMockBatch() {
  const operations: Array<{ type: string; ref: any; data?: any }> = [];

  return {
    set: vi.fn((ref: any, data: any) => {
      operations.push({ type: 'set', ref, data });
    }),
    update: vi.fn((ref: any, data: any) => {
      operations.push({ type: 'update', ref, data });
    }),
    delete: vi.fn((ref: any) => {
      operations.push({ type: 'delete', ref });
    }),
    commit: vi.fn(() => Promise.resolve()),
    _operations: operations
  };
}

// ============ ASYNC UTILITIES ============

/**
 * Wait for loading states to finish
 */
export async function waitForLoadingToFinish() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Wait for a specific amount of time
 */
export async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Flush all pending promises
 */
export async function flushPromises() {
  return new Promise(resolve => setImmediate(resolve));
}

// ============ ASSERTION UTILITIES ============

/**
 * Assert that a patient can be accessed by a user
 */
export function canAccessPatient(patient: Patient, user: UserProfile): boolean {
  // SuperAdmin can access all
  if (user.role === UserRole.SuperAdmin) return true;

  // Officials can view all (read-only)
  if (user.role === UserRole.Official) return true;

  // Other users must be from same institution
  return patient.institutionId === user.institutionId;
}

/**
 * Assert that a user can modify a patient
 */
export function canModifyPatient(patient: Patient, user: UserProfile): boolean {
  // Officials have read-only access
  if (user.role === UserRole.Official) return false;

  // SuperAdmin can modify all
  if (user.role === UserRole.SuperAdmin) return true;

  // Must be from same institution
  return patient.institutionId === user.institutionId;
}

// ============ DATE UTILITIES ============

/**
 * Create an ISO date string for testing
 */
export function createTestDate(
  daysFromNow: number = 0,
  hours: number = 0
): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
}

/**
 * Calculate length of stay in days
 */
export function calculateLengthOfStay(
  admissionDate: string,
  dischargeDate: string
): number {
  const admission = new Date(admissionDate);
  const discharge = new Date(dischargeDate);
  const diffTime = Math.abs(discharge.getTime() - admission.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// ============ FORM UTILITIES ============

/**
 * Create mock form values for patient admission
 */
export function createMockPatientFormData(overrides: Partial<Patient> = {}): Partial<Patient> {
  return {
    name: 'Test Baby',
    age: 1,
    ageUnit: AgeUnit.Days,
    gender: 'Male',
    dateOfBirth: createTestDate(-1),
    admissionDate: createTestDate(0),
    diagnosis: 'Test Diagnosis',
    unit: Unit.NICU,
    institutionId: 'hospital-a',
    institutionName: 'City Children Hospital',
    birthWeight: 2.5,
    weightOnAdmission: 2.4,
    admissionType: AdmissionType.Inborn,
    indicationsForAdmission: ['Test Indication'],
    motherName: 'Test Mother',
    fatherName: 'Test Father',
    contactNo1: '+91-9876543210',
    ...overrides
  };
}

// ============ ERROR UTILITIES ============

/**
 * Create a mock Firebase error
 */
export function createMockFirebaseError(
  code: string,
  message: string
) {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

/**
 * Common Firebase error codes for testing
 */
export const FirebaseErrorCodes = {
  PERMISSION_DENIED: 'permission-denied',
  NOT_FOUND: 'not-found',
  ALREADY_EXISTS: 'already-exists',
  UNAUTHENTICATED: 'unauthenticated',
  UNAVAILABLE: 'unavailable',
  CANCELLED: 'cancelled',
  INVALID_ARGUMENT: 'invalid-argument'
};
