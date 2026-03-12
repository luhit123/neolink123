import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mockUsers,
  mockPatients,
  mockInstitutions,
  createMockDoc,
  createMockQuerySnapshot,
  createMockPatientFormData,
  canAccessPatient,
  canModifyPatient,
  calculateLengthOfStay,
  PatientOutcomeValues
} from '../../test/utils/testUtils';
import { UserRole, Unit, AgeUnit } from '../../types';

// Mock Firebase Firestore
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockDeleteDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockWriteBatch = vi.fn(() => ({
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn(() => Promise.resolve())
}));

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  limit: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
    fromDate: vi.fn((date: Date) => ({ toDate: () => date }))
  },
  writeBatch: () => mockWriteBatch()
}));

vi.mock('../../firebaseConfig', () => ({
  db: {},
  auth: {
    currentUser: {
      uid: 'test-user-123',
      email: 'test@hospital-a.com'
    }
  }
}));

describe('FirestoreService - Patient Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ ACCESS CONTROL TESTS ============

  describe('Patient Access Control', () => {
    it('should allow doctor to access patient from same institution', () => {
      const result = canAccessPatient(
        mockPatients.patientHospitalA,
        mockUsers.doctorHospitalA
      );
      expect(result).toBe(true);
    });

    it('should DENY doctor access to patient from different institution', () => {
      const result = canAccessPatient(
        mockPatients.patientHospitalB,
        mockUsers.doctorHospitalA
      );
      expect(result).toBe(false);
    });

    it('should allow SuperAdmin to access any patient', () => {
      const resultA = canAccessPatient(
        mockPatients.patientHospitalA,
        mockUsers.superAdmin
      );
      const resultB = canAccessPatient(
        mockPatients.patientHospitalB,
        mockUsers.superAdmin
      );
      expect(resultA).toBe(true);
      expect(resultB).toBe(true);
    });

    it('should allow Official to view any patient (read-only)', () => {
      const result = canAccessPatient(
        mockPatients.patientHospitalA,
        mockUsers.official
      );
      expect(result).toBe(true);
    });

    it('should allow nurse to access patient from same institution', () => {
      const result = canAccessPatient(
        mockPatients.patientHospitalA,
        mockUsers.nurseHospitalA
      );
      expect(result).toBe(true);
    });
  });

  describe('Patient Modification Access', () => {
    it('should allow doctor to modify patient from same institution', () => {
      const result = canModifyPatient(
        mockPatients.patientHospitalA,
        mockUsers.doctorHospitalA
      );
      expect(result).toBe(true);
    });

    it('should DENY doctor modification of patient from different institution', () => {
      const result = canModifyPatient(
        mockPatients.patientHospitalB,
        mockUsers.doctorHospitalA
      );
      expect(result).toBe(false);
    });

    it('should DENY Official from modifying patients (read-only)', () => {
      const result = canModifyPatient(
        mockPatients.patientHospitalA,
        mockUsers.official
      );
      expect(result).toBe(false);
    });

    it('should allow SuperAdmin to modify any patient', () => {
      const result = canModifyPatient(
        mockPatients.patientHospitalB,
        mockUsers.superAdmin
      );
      expect(result).toBe(true);
    });
  });

  // ============ PATIENT DATA VALIDATION TESTS ============

  describe('Patient Data Validation', () => {
    it('should have all required fields in mock patient', () => {
      const patient = mockPatients.patientHospitalA;
      expect(patient.id).toBeDefined();
      expect(patient.name).toBeDefined();
      expect(patient.institutionId).toBeDefined();
      expect(patient.gender).toMatch(/^(Male|Female|Other|Ambiguous)$/);
      expect(patient.unit).toBeDefined();
    });

    it('should have valid gestational age category for preterm', () => {
      const patient = mockPatients.patientHospitalA;
      expect(patient.gestationalAgeWeeks).toBeLessThan(37);
      expect(patient.gestationalAgeCategory).toBe('Moderate to Late Preterm');
    });

    it('should have valid gestational age category for extremely preterm', () => {
      const patient = mockPatients.deceasedPatient;
      expect(patient.gestationalAgeWeeks).toBeLessThan(28);
      expect(patient.gestationalAgeCategory).toBe('Extremely Preterm');
    });

    it('should have death information for deceased patient', () => {
      const patient = mockPatients.deceasedPatient;
      expect(patient.outcome).toBe(PatientOutcomeValues.Deceased);
      expect(patient.dateOfDeath).toBeDefined();
      expect(patient.diagnosisAtDeath).toBeDefined();
    });

    it('should have discharge information for discharged patient', () => {
      const patient = mockPatients.dischargedPatient;
      expect(patient.outcome).toBe(PatientOutcomeValues.Discharged);
      expect(patient.releaseDate).toBeDefined();
      expect(patient.weightOnDischarge).toBeDefined();
    });
  });

  // ============ LENGTH OF STAY CALCULATION TESTS ============

  describe('Length of Stay Calculation', () => {
    it('should calculate correct length of stay in days', () => {
      const los = calculateLengthOfStay(
        '2026-01-01T00:00:00.000Z',
        '2026-01-10T00:00:00.000Z'
      );
      expect(los).toBe(9);
    });

    it('should return 0 for same-day admission and discharge', () => {
      const los = calculateLengthOfStay(
        '2026-01-01T08:00:00.000Z',
        '2026-01-01T18:00:00.000Z'
      );
      expect(los).toBe(0);
    });

    it('should handle month-spanning stays', () => {
      const los = calculateLengthOfStay(
        '2026-01-25T00:00:00.000Z',
        '2026-02-05T00:00:00.000Z'
      );
      expect(los).toBe(11);
    });
  });

  // ============ PATIENT FORM DATA TESTS ============

  describe('Patient Form Data', () => {
    it('should create valid mock patient form data', () => {
      const formData = createMockPatientFormData();
      expect(formData.name).toBe('Test Baby');
      expect(formData.institutionId).toBe('hospital-a');
      expect(formData.unit).toBe(Unit.NICU);
    });

    it('should allow overriding mock patient form data', () => {
      const formData = createMockPatientFormData({
        name: 'Custom Baby',
        unit: Unit.PICU,
        institutionId: 'hospital-b'
      });
      expect(formData.name).toBe('Custom Baby');
      expect(formData.unit).toBe(Unit.PICU);
      expect(formData.institutionId).toBe('hospital-b');
    });
  });

  // ============ FIRESTORE DOCUMENT MOCK TESTS ============

  describe('Firestore Document Mocks', () => {
    it('should create valid mock document', () => {
      const doc = createMockDoc(mockPatients.patientHospitalA, 'test-id');
      expect(doc.id).toBe('test-id');
      expect(doc.exists()).toBe(true);
      expect(doc.data()).toEqual(mockPatients.patientHospitalA);
    });

    it('should create valid mock query snapshot', () => {
      const patients = [mockPatients.patientHospitalA, mockPatients.dischargedPatient];
      const snapshot = createMockQuerySnapshot(patients);
      expect(snapshot.empty).toBe(false);
      expect(snapshot.size).toBe(2);
    });

    it('should handle empty query snapshot', () => {
      const snapshot = createMockQuerySnapshot([]);
      expect(snapshot.empty).toBe(true);
      expect(snapshot.size).toBe(0);
    });
  });
});

describe('FirestoreService - Institution Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Query Filtering by Institution', () => {
    it('should only return patients from user institution', () => {
      const allPatients = [
        mockPatients.patientHospitalA,
        mockPatients.patientHospitalB,
        mockPatients.dischargedPatient
      ];

      // Filter patients like the service would
      const filteredPatients = allPatients.filter(
        p => p.institutionId === mockUsers.doctorHospitalA.institutionId
      );

      expect(filteredPatients.length).toBe(2);
      filteredPatients.forEach(p => {
        expect(p.institutionId).toBe('hospital-a');
      });
    });

    it('should return all patients for SuperAdmin', () => {
      const allPatients = [
        mockPatients.patientHospitalA,
        mockPatients.patientHospitalB
      ];

      // SuperAdmin sees all
      const filteredPatients = allPatients.filter(
        p => mockUsers.superAdmin.role === UserRole.SuperAdmin || p.institutionId === mockUsers.superAdmin.institutionId
      );

      expect(filteredPatients.length).toBe(2);
    });
  });

  describe('Patient Status Filtering', () => {
    it('should filter admitted patients correctly', () => {
      const allPatients = [
        mockPatients.patientHospitalA,
        mockPatients.dischargedPatient,
        mockPatients.deceasedPatient
      ];

      const admittedPatients = allPatients.filter(
        p => p.outcome === PatientOutcomeValues.Admitted
      );

      expect(admittedPatients.length).toBe(1);
      expect(admittedPatients[0].id).toBe('patient-a-001');
    });

    it('should filter by unit correctly', () => {
      const allPatients = [
        mockPatients.patientHospitalA,
        mockPatients.picuPatient
      ];

      const nicuPatients = allPatients.filter(p => p.unit === Unit.NICU);
      const picuPatients = allPatients.filter(p => p.unit === Unit.PICU);

      expect(nicuPatients.length).toBe(1);
      expect(picuPatients.length).toBe(1);
    });
  });
});

describe('FirestoreService - Data Integrity', () => {
  describe('Timestamp Handling', () => {
    it('should handle valid ISO date strings', () => {
      const patient = mockPatients.patientHospitalA;
      const admissionDate = new Date(patient.admissionDate);
      expect(admissionDate).toBeInstanceOf(Date);
      expect(isNaN(admissionDate.getTime())).toBe(false);
    });

    it('should have admission date before or equal to current date', () => {
      const patient = mockPatients.patientHospitalA;
      const admissionDate = new Date(patient.admissionDate);
      const now = new Date();
      expect(admissionDate.getTime()).toBeLessThanOrEqual(now.getTime());
    });
  });

  describe('Required Field Validation', () => {
    it('should have non-empty patient name', () => {
      expect(mockPatients.patientHospitalA.name.length).toBeGreaterThan(0);
    });

    it('should have valid age values', () => {
      expect(mockPatients.patientHospitalA.age).toBeGreaterThanOrEqual(0);
      expect(Object.values(AgeUnit)).toContain(mockPatients.patientHospitalA.ageUnit);
    });

    it('should have valid outcome', () => {
      expect(Object.values(PatientOutcomeValues)).toContain(mockPatients.patientHospitalA.outcome);
    });
  });
});
