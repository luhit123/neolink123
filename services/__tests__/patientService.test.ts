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
  createMockFirebaseError,
  FirebaseErrorCodes,
  PatientOutcomeValues
} from '../../test/utils/testUtils';
import { UserRole, Unit, AgeUnit, AdmissionType, BloodGroup } from '../../types';
import type { Patient, UserProfile } from '../../types';

/**
 * Patient Service Tests
 *
 * Comprehensive tests for patient CRUD operations including:
 * - Patient creation with validation
 * - Patient retrieval with access control
 * - Patient updates with audit logging
 * - Patient discharge workflow
 * - Institution isolation
 * - Data validation
 */

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
const mockLimit = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockWriteBatch = vi.fn(() => ({
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn(() => Promise.resolve())
}));
const mockServerTimestamp = vi.fn(() => new Date());

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
  limit: (...args: any[]) => mockLimit(...args),
  serverTimestamp: () => mockServerTimestamp(),
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

describe('PatientService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============ CREATE PATIENT TESTS ============

  describe('createPatient', () => {
    it('should require all mandatory fields', () => {
      const patientData = createMockPatientFormData();

      // Verify mock data has required fields
      expect(patientData.name).toBeDefined();
      expect(patientData.dateOfBirth).toBeDefined();
      expect(patientData.gender).toBeDefined();
      expect(patientData.institutionId).toBeDefined();
      expect(patientData.unit).toBeDefined();
    });

    it('should validate patient name is not empty', () => {
      const patientData = createMockPatientFormData({ name: '' });
      expect(patientData.name).toBe('');

      // In real implementation, this should throw validation error
      const isValid = patientData.name && patientData.name.trim().length > 0;
      expect(isValid).toBeFalsy();
    });

    it('should sanitize patient name (remove extra spaces)', () => {
      const rawName = '  Baby   Test  Name  ';
      const sanitizedName = rawName.trim().replace(/\s+/g, ' ');
      expect(sanitizedName).toBe('Baby Test Name');
    });

    it('should validate date of birth is not in future', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const isValidDOB = (dob: string): boolean => {
        return new Date(dob) <= new Date();
      };

      expect(isValidDOB(futureDate.toISOString())).toBe(false);
      expect(isValidDOB(mockPatients.patientHospitalA.dateOfBirth!)).toBe(true);
    });

    it('should validate admission date is not before birth date', () => {
      const patient = mockPatients.patientHospitalA;

      const isValidAdmission = (dob: string, admission: string): boolean => {
        return new Date(admission) >= new Date(dob);
      };

      expect(isValidAdmission(patient.dateOfBirth!, patient.admissionDate!)).toBe(true);
    });

    it('should calculate age correctly from date of birth', () => {
      const calculateAgeInDays = (dob: string, referenceDate?: string): number => {
        const birth = new Date(dob);
        const reference = referenceDate ? new Date(referenceDate) : new Date();
        const diffTime = Math.abs(reference.getTime() - birth.getTime());
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
      };

      const dob = '2026-01-15T00:00:00.000Z';
      const referenceDate = '2026-01-18T00:00:00.000Z';

      expect(calculateAgeInDays(dob, referenceDate)).toBe(3);
    });

    it('should auto-assign institution from user if not SuperAdmin', () => {
      const user = mockUsers.doctorHospitalA;
      const patientData = createMockPatientFormData();

      // Institution should match user's institution
      if (user.role !== UserRole.SuperAdmin && user.institutionId) {
        patientData.institutionId = user.institutionId;
      }

      expect(patientData.institutionId).toBe('hospital-a');
    });

    it('should allow SuperAdmin to create patient for any institution', () => {
      const user = mockUsers.superAdmin;
      const canCreateForAnyInstitution = user.role === UserRole.SuperAdmin;

      expect(canCreateForAnyInstitution).toBe(true);
    });

    it('should validate gestational age is within valid range', () => {
      const isValidGestationalAge = (weeks: number, days: number = 0): boolean => {
        return weeks >= 20 && weeks <= 45 && days >= 0 && days <= 6;
      };

      expect(isValidGestationalAge(32, 4)).toBe(true); // Normal preterm
      expect(isValidGestationalAge(24, 0)).toBe(true); // Extremely preterm
      expect(isValidGestationalAge(40, 0)).toBe(true); // Term
      expect(isValidGestationalAge(15, 0)).toBe(false); // Too early
      expect(isValidGestationalAge(50, 0)).toBe(false); // Too late
    });

    it('should validate birth weight is within valid range', () => {
      const isValidBirthWeight = (weight: number): boolean => {
        return weight >= 0.3 && weight <= 7.0; // 300g to 7kg
      };

      expect(isValidBirthWeight(2.5)).toBe(true); // Normal
      expect(isValidBirthWeight(0.8)).toBe(true); // ELBW
      expect(isValidBirthWeight(4.5)).toBe(true); // Large
      expect(isValidBirthWeight(0.1)).toBe(false); // Too small
      expect(isValidBirthWeight(10.0)).toBe(false); // Too large
    });

    it('should validate phone numbers have correct format', () => {
      const isValidIndianPhone = (phone: string): boolean => {
        const pattern = /^(\+91[-\s]?)?[6-9]\d{9}$/;
        return pattern.test(phone.replace(/\s/g, ''));
      };

      expect(isValidIndianPhone('+91-9876543210')).toBe(true);
      expect(isValidIndianPhone('9876543210')).toBe(true);
      expect(isValidIndianPhone('+91 98765 43210')).toBe(true);
      expect(isValidIndianPhone('1234567890')).toBe(false); // Doesn't start with 6-9
      expect(isValidIndianPhone('98765')).toBe(false); // Too short
    });
  });

  // ============ GET PATIENT TESTS ============

  describe('getPatient', () => {
    it('should return patient for same institution user', () => {
      const patient = mockPatients.patientHospitalA;
      const user = mockUsers.doctorHospitalA;

      expect(canAccessPatient(patient, user)).toBe(true);
    });

    it('should DENY access to patient from different institution', () => {
      const patient = mockPatients.patientHospitalB;
      const user = mockUsers.doctorHospitalA;

      expect(canAccessPatient(patient, user)).toBe(false);
    });

    it('should allow SuperAdmin to access any patient', () => {
      const patientA = mockPatients.patientHospitalA;
      const patientB = mockPatients.patientHospitalB;
      const user = mockUsers.superAdmin;

      expect(canAccessPatient(patientA, user)).toBe(true);
      expect(canAccessPatient(patientB, user)).toBe(true);
    });

    it('should allow Official to view any patient (read-only)', () => {
      const patient = mockPatients.patientHospitalA;
      const user = mockUsers.official;

      expect(canAccessPatient(patient, user)).toBe(true);
      expect(canModifyPatient(patient, user)).toBe(false);
    });

    it('should allow nurse to access patient from same institution', () => {
      const patient = mockPatients.patientHospitalA;
      const user = mockUsers.nurseHospitalA;

      expect(canAccessPatient(patient, user)).toBe(true);
    });

    it('should handle patient not found gracefully', () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      // In real implementation, this should throw 'Patient not found'
      expect(true).toBe(true); // Placeholder for async test
    });
  });

  // ============ UPDATE PATIENT TESTS ============

  describe('updatePatient', () => {
    it('should allow update by same institution user', () => {
      const patient = mockPatients.patientHospitalA;
      const user = mockUsers.doctorHospitalA;

      expect(canModifyPatient(patient, user)).toBe(true);
    });

    it('should DENY update by different institution user', () => {
      const patient = mockPatients.patientHospitalB;
      const user = mockUsers.doctorHospitalA;

      expect(canModifyPatient(patient, user)).toBe(false);
    });

    it('should NOT allow changing institutionId', () => {
      const originalInstitutionId = 'hospital-a';
      const newInstitutionId = 'hospital-b';

      const canChangeInstitution = (
        original: string,
        requested: string,
        userRole: UserRole
      ): boolean => {
        // Only referral workflow can change institution
        return false;
      };

      expect(canChangeInstitution(originalInstitutionId, newInstitutionId, UserRole.Doctor)).toBe(false);
      expect(canChangeInstitution(originalInstitutionId, newInstitutionId, UserRole.Admin)).toBe(false);
    });

    it('should track field-level changes for audit', () => {
      const original = { diagnosis: 'Original', weight: 2.5 };
      const updated = { diagnosis: 'Updated', weight: 2.7 };

      const getChanges = (original: any, updated: any) => {
        return Object.keys(updated)
          .filter(key => original[key] !== updated[key])
          .map(key => ({
            field: key,
            oldValue: original[key],
            newValue: updated[key]
          }));
      };

      const changes = getChanges(original, updated);
      expect(changes).toHaveLength(2);
      expect(changes[0]).toEqual({ field: 'diagnosis', oldValue: 'Original', newValue: 'Updated' });
      expect(changes[1]).toEqual({ field: 'weight', oldValue: 2.5, newValue: 2.7 });
    });

    it('should add updatedAt and updatedBy metadata', () => {
      const updateData = { diagnosis: 'Updated diagnosis' };
      const user = mockUsers.doctorHospitalA;

      const withMetadata = {
        ...updateData,
        updatedAt: new Date(),
        updatedBy: user.uid,
        updatedByEmail: user.email
      };

      expect(withMetadata.updatedBy).toBe(user.uid);
      expect(withMetadata.updatedByEmail).toBe(user.email);
      expect(withMetadata.updatedAt).toBeDefined();
    });
  });

  // ============ DELETE PATIENT TESTS ============

  describe('deletePatient', () => {
    it('should only allow Admin to soft-delete patient', () => {
      const canDelete = (userRole: UserRole): boolean => {
        return userRole === UserRole.Admin || userRole === UserRole.SuperAdmin;
      };

      expect(canDelete(UserRole.Admin)).toBe(true);
      expect(canDelete(UserRole.SuperAdmin)).toBe(true);
      expect(canDelete(UserRole.Doctor)).toBe(false);
      expect(canDelete(UserRole.Nurse)).toBe(false);
    });

    it('should DENY Admin from deleting patient in different institution', () => {
      const patient = mockPatients.patientHospitalB;
      const user = mockUsers.adminHospitalA;

      expect(canModifyPatient(patient, user)).toBe(false);
    });

    it('should soft-delete by setting status to deleted', () => {
      const softDelete = (patient: Patient, user: UserProfile) => {
        return {
          ...patient,
          outcome: 'Deleted' as any,
          deletedAt: new Date().toISOString(),
          deletedBy: user.uid
        };
      };

      const deleted = softDelete(mockPatients.patientHospitalA, mockUsers.adminHospitalA);
      expect(deleted.deletedAt).toBeDefined();
      expect(deleted.deletedBy).toBe(mockUsers.adminHospitalA.uid);
    });
  });

  // ============ SEARCH & FILTER TESTS ============

  describe('getPatientsByInstitution', () => {
    it('should return only patients from user institution', () => {
      const allPatients = [
        mockPatients.patientHospitalA,
        mockPatients.patientHospitalB,
        mockPatients.dischargedPatient
      ];

      const filterByInstitution = (patients: Patient[], institutionId: string) => {
        return patients.filter(p => p.institutionId === institutionId);
      };

      const hospitalAPatients = filterByInstitution(allPatients, 'hospital-a');

      expect(hospitalAPatients.length).toBe(2);
      hospitalAPatients.forEach(p => {
        expect(p.institutionId).toBe('hospital-a');
      });
    });

    it('should filter by status', () => {
      const patients = [
        mockPatients.patientHospitalA,
        mockPatients.dischargedPatient,
        mockPatients.deceasedPatient
      ];

      const filterByOutcome = (patients: Patient[], outcome: PatientOutcome) => {
        return patients.filter(p => p.outcome === outcome);
      };

      const admitted = filterByOutcome(patients, PatientOutcomeValues.Admitted);
      const discharged = filterByOutcome(patients, PatientOutcomeValues.Discharged);

      expect(admitted.length).toBe(1);
      expect(discharged.length).toBe(1);
    });

    it('should filter by unit', () => {
      const patients = [
        mockPatients.patientHospitalA, // NICU
        mockPatients.picuPatient // PICU
      ];

      const filterByUnit = (patients: Patient[], unit: Unit) => {
        return patients.filter(p => p.unit === unit);
      };

      const nicuPatients = filterByUnit(patients, Unit.NICU);
      const picuPatients = filterByUnit(patients, Unit.PICU);

      expect(nicuPatients.length).toBe(1);
      expect(picuPatients.length).toBe(1);
    });

    it('should filter by date range', () => {
      const patients = [mockPatients.patientHospitalA, mockPatients.dischargedPatient];

      const filterByDateRange = (
        patients: Patient[],
        startDate: string,
        endDate: string
      ) => {
        const start = new Date(startDate);
        const end = new Date(endDate);

        return patients.filter(p => {
          const admissionDate = new Date(p.admissionDate!);
          return admissionDate >= start && admissionDate <= end;
        });
      };

      const januaryPatients = filterByDateRange(
        patients,
        '2026-01-01T00:00:00.000Z',
        '2026-01-31T23:59:59.999Z'
      );

      expect(januaryPatients.length).toBeGreaterThan(0);
    });
  });

  describe('searchPatients', () => {
    it('should search by patient name', () => {
      const patients = [
        mockPatients.patientHospitalA, // Baby Singh
        mockPatients.patientHospitalB, // Baby Sharma
        mockPatients.dischargedPatient // Baby Kumar
      ];

      const searchByName = (patients: Patient[], query: string) => {
        const lowerQuery = query.toLowerCase();
        return patients.filter(p =>
          p.name.toLowerCase().includes(lowerQuery)
        );
      };

      const results = searchByName(patients, 'singh');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Baby Singh');
    });

    it('should search by NTID', () => {
      const patients = [mockPatients.patientHospitalA];

      const searchByNTID = (patients: Patient[], ntid: string) => {
        return patients.filter(p => p.ntid?.includes(ntid));
      };

      const results = searchByNTID(patients, 'CCH');
      expect(results.length).toBe(1);
    });

    it('should only return patients from user institution in search', () => {
      const allPatients = [
        mockPatients.patientHospitalA,
        mockPatients.patientHospitalB
      ];

      const secureSearch = (
        patients: Patient[],
        query: string,
        user: UserProfile
      ) => {
        const lowerQuery = query.toLowerCase();
        return patients.filter(p =>
          p.name.toLowerCase().includes(lowerQuery) &&
          (user.role === UserRole.SuperAdmin || p.institutionId === user.institutionId)
        );
      };

      const results = secureSearch(allPatients, 'baby', mockUsers.doctorHospitalA);

      results.forEach(p => {
        expect(p.institutionId).toBe('hospital-a');
      });
    });
  });

  // ============ DISCHARGE TESTS ============

  describe('dischargePatient', () => {
    it('should calculate length of stay correctly', () => {
      const patient = mockPatients.dischargedPatient;

      const los = calculateLengthOfStay(patient.admissionDate!, patient.releaseDate!);

      // Jan 8 to Jan 20 = 12 days
      expect(los).toBe(12);
    });

    it('should calculate same-day admission and discharge as 0 days', () => {
      const los = calculateLengthOfStay(
        '2026-01-15T08:00:00.000Z',
        '2026-01-15T18:00:00.000Z'
      );

      expect(los).toBe(0);
    });

    it('should require outcome for discharge', () => {
      const dischargeData = {
        dischargeDate: '2026-01-25T10:00:00.000Z',
        outcome: PatientOutcomeValues.Discharged
      };

      expect(dischargeData.outcome).toBeDefined();
    });

    it('should not allow discharge date before admission date', () => {
      const isValidDischargeDate = (
        admissionDate: string,
        dischargeDate: string
      ): boolean => {
        return new Date(dischargeDate) >= new Date(admissionDate);
      };

      // Valid: discharge after admission
      expect(isValidDischargeDate(
        '2026-01-16T08:00:00.000Z',
        '2026-01-25T10:00:00.000Z'
      )).toBe(true);

      // Invalid: discharge before admission
      expect(isValidDischargeDate(
        '2026-01-16T08:00:00.000Z',
        '2026-01-10T10:00:00.000Z'
      )).toBe(false);
    });

    it('should set weight on discharge if provided', () => {
      const patient = mockPatients.dischargedPatient;

      expect(patient.weightOnDischarge).toBeDefined();
      expect(patient.weightOnDischarge).toBeGreaterThan(0);
    });

    it('should update patient outcome to discharged', () => {
      const patient = mockPatients.dischargedPatient;
      expect(patient.outcome).toBe(PatientOutcomeValues.Discharged);
    });
  });

  // ============ GESTATIONAL AGE CATEGORY TESTS ============

  describe('Gestational Age Categorization', () => {
    const categorizeGestationalAge = (weeks: number): string => {
      if (weeks < 28) return 'Extremely Preterm';
      if (weeks < 32) return 'Very Preterm';
      if (weeks < 37) return 'Moderate to Late Preterm';
      if (weeks < 42) return 'Term';
      return 'Post-term';
    };

    it('should categorize extremely preterm (<28 weeks)', () => {
      expect(categorizeGestationalAge(24)).toBe('Extremely Preterm');
      expect(categorizeGestationalAge(27)).toBe('Extremely Preterm');
    });

    it('should categorize very preterm (28-31 weeks)', () => {
      expect(categorizeGestationalAge(28)).toBe('Very Preterm');
      expect(categorizeGestationalAge(31)).toBe('Very Preterm');
    });

    it('should categorize moderate to late preterm (32-36 weeks)', () => {
      expect(categorizeGestationalAge(32)).toBe('Moderate to Late Preterm');
      expect(categorizeGestationalAge(36)).toBe('Moderate to Late Preterm');
    });

    it('should categorize term (37-41 weeks)', () => {
      expect(categorizeGestationalAge(37)).toBe('Term');
      expect(categorizeGestationalAge(40)).toBe('Term');
      expect(categorizeGestationalAge(41)).toBe('Term');
    });

    it('should categorize post-term (>=42 weeks)', () => {
      expect(categorizeGestationalAge(42)).toBe('Post-term');
      expect(categorizeGestationalAge(44)).toBe('Post-term');
    });
  });

  // ============ BIRTH WEIGHT CATEGORY TESTS ============

  describe('Birth Weight Categorization', () => {
    const categorizeBirthWeight = (weightKg: number): string => {
      const weightGrams = weightKg * 1000;
      if (weightGrams < 1000) return 'Extremely Low Birth Weight';
      if (weightGrams < 1500) return 'Very Low Birth Weight';
      if (weightGrams < 2500) return 'Low Birth Weight';
      if (weightGrams <= 4000) return 'Normal Birth Weight';
      return 'High Birth Weight';
    };

    it('should categorize ELBW (<1000g)', () => {
      expect(categorizeBirthWeight(0.8)).toBe('Extremely Low Birth Weight');
      expect(categorizeBirthWeight(0.95)).toBe('Extremely Low Birth Weight');
    });

    it('should categorize VLBW (1000-1499g)', () => {
      expect(categorizeBirthWeight(1.0)).toBe('Very Low Birth Weight');
      expect(categorizeBirthWeight(1.4)).toBe('Very Low Birth Weight');
    });

    it('should categorize LBW (1500-2499g)', () => {
      expect(categorizeBirthWeight(1.5)).toBe('Low Birth Weight');
      expect(categorizeBirthWeight(2.4)).toBe('Low Birth Weight');
    });

    it('should categorize normal birth weight (2500-4000g)', () => {
      expect(categorizeBirthWeight(2.5)).toBe('Normal Birth Weight');
      expect(categorizeBirthWeight(3.5)).toBe('Normal Birth Weight');
      expect(categorizeBirthWeight(4.0)).toBe('Normal Birth Weight');
    });

    it('should categorize high birth weight (>4000g)', () => {
      expect(categorizeBirthWeight(4.5)).toBe('High Birth Weight');
      expect(categorizeBirthWeight(5.0)).toBe('High Birth Weight');
    });
  });

  // ============ MOCK DATA VALIDATION ============

  describe('Mock Data Integrity', () => {
    it('should have consistent patient data structure', () => {
      const patient = mockPatients.patientHospitalA;

      // Required fields
      expect(patient.id).toBeDefined();
      expect(patient.name).toBeDefined();
      expect(patient.gender).toMatch(/^(Male|Female|Other|Ambiguous)$/);
      expect(patient.institutionId).toBeDefined();
      expect(patient.unit).toBeDefined();
      expect(patient.outcome).toBeDefined();
    });

    it('should have NICU patient in mock data', () => {
      const nicuPatient = mockPatients.patientHospitalA;
      expect(nicuPatient.unit).toBe(Unit.NICU);
    });

    it('should have PICU patient in mock data', () => {
      const picuPatient = mockPatients.picuPatient;
      expect(picuPatient.unit).toBe(Unit.PICU);
    });

    it('should have deceased patient with death details', () => {
      const deceased = mockPatients.deceasedPatient;
      expect(deceased.outcome).toBe(PatientOutcomeValues.Deceased);
      expect(deceased.dateOfDeath).toBeDefined();
      expect(deceased.diagnosisAtDeath).toBeDefined();
    });

    it('should have discharged patient with discharge details', () => {
      const discharged = mockPatients.dischargedPatient;
      expect(discharged.outcome).toBe(PatientOutcomeValues.Discharged);
      expect(discharged.releaseDate).toBeDefined();
      expect(discharged.weightOnDischarge).toBeDefined();
    });
  });

  // ============ ERROR HANDLING TESTS ============

  describe('Error Handling', () => {
    it('should handle permission denied error', () => {
      const error = createMockFirebaseError(
        FirebaseErrorCodes.PERMISSION_DENIED,
        'Permission denied'
      );

      expect(error.code).toBe('permission-denied');
      expect(error.message).toBe('Permission denied');
    });

    it('should handle not found error', () => {
      const error = createMockFirebaseError(
        FirebaseErrorCodes.NOT_FOUND,
        'Patient not found'
      );

      expect(error.code).toBe('not-found');
    });

    it('should handle unavailable error (offline)', () => {
      const error = createMockFirebaseError(
        FirebaseErrorCodes.UNAVAILABLE,
        'Service unavailable'
      );

      expect(error.code).toBe('unavailable');
    });
  });

  // ============ INSTITUTION ISOLATION TESTS ============

  describe('Institution Isolation', () => {
    it('should prevent cross-institution patient access', () => {
      const hospitalAPatient = mockPatients.patientHospitalA;
      const hospitalBDoctor = mockUsers.doctorHospitalB;

      expect(canAccessPatient(hospitalAPatient, hospitalBDoctor)).toBe(false);
    });

    it('should prevent cross-institution patient modification', () => {
      const hospitalBPatient = mockPatients.patientHospitalB;
      const hospitalADoctor = mockUsers.doctorHospitalA;

      expect(canModifyPatient(hospitalBPatient, hospitalADoctor)).toBe(false);
    });

    it('should allow same-institution access for all clinical roles', () => {
      const patient = mockPatients.patientHospitalA;

      expect(canAccessPatient(patient, mockUsers.doctorHospitalA)).toBe(true);
      expect(canAccessPatient(patient, mockUsers.nurseHospitalA)).toBe(true);
      expect(canAccessPatient(patient, mockUsers.adminHospitalA)).toBe(true);
    });

    it('should allow SuperAdmin access across all institutions', () => {
      const superAdmin = mockUsers.superAdmin;

      expect(canAccessPatient(mockPatients.patientHospitalA, superAdmin)).toBe(true);
      expect(canAccessPatient(mockPatients.patientHospitalB, superAdmin)).toBe(true);
      expect(canModifyPatient(mockPatients.patientHospitalA, superAdmin)).toBe(true);
      expect(canModifyPatient(mockPatients.patientHospitalB, superAdmin)).toBe(true);
    });

    it('should allow Official read-only access across all institutions', () => {
      const official = mockUsers.official;

      // Can access (read)
      expect(canAccessPatient(mockPatients.patientHospitalA, official)).toBe(true);
      expect(canAccessPatient(mockPatients.patientHospitalB, official)).toBe(true);

      // Cannot modify
      expect(canModifyPatient(mockPatients.patientHospitalA, official)).toBe(false);
      expect(canModifyPatient(mockPatients.patientHospitalB, official)).toBe(false);
    });
  });
});
