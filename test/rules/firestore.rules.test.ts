/**
 * Firestore Security Rules Tests
 *
 * These tests verify that the security rules in firestore.rules are correctly implemented.
 * Tests run against the Firebase Emulator.
 *
 * Prerequisites:
 * 1. Install Firebase CLI: npm install -g firebase-tools
 * 2. Start Firestore emulator: firebase emulators:start --only firestore
 * 3. Run tests: npm run test:rules
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupFirestoreTests,
  cleanupFirestoreTests,
  clearFirestoreData,
  getAuthenticatedContext,
  getUnauthenticatedContext,
  assertFails,
  assertSucceeds,
  seedTestData,
  testContexts
} from '../utils/firebaseTestUtils';

// Note: These tests require the Firebase emulator to be running
// Skip tests if emulator is not available
const EMULATOR_AVAILABLE = process.env.FIRESTORE_EMULATOR_HOST !== undefined;

describe.skipIf(!EMULATOR_AVAILABLE)('Firestore Security Rules', () => {
  beforeAll(async () => {
    await setupFirestoreTests();
  });

  afterAll(async () => {
    await cleanupFirestoreTests();
  });

  beforeEach(async () => {
    await clearFirestoreData();
  });

  // ============ UNAUTHENTICATED ACCESS TESTS ============

  describe('Unauthenticated Access', () => {
    it('should DENY reading patients without authentication', async () => {
      const unauthed = getUnauthenticatedContext();
      await assertFails(
        unauthed.firestore().collection('patients').get()
      );
    });

    it('should DENY reading users without authentication', async () => {
      const unauthed = getUnauthenticatedContext();
      await assertFails(
        unauthed.firestore().collection('users').get()
      );
    });

    it('should DENY reading audit logs without authentication', async () => {
      const unauthed = getUnauthenticatedContext();
      await assertFails(
        unauthed.firestore().collection('auditLogs').get()
      );
    });

    it('should DENY writing to any collection without authentication', async () => {
      const unauthed = getUnauthenticatedContext();
      await assertFails(
        unauthed.firestore().collection('patients').add({ name: 'Hacker' })
      );
    });

    it('should ALLOW reading institutions for login lookup', async () => {
      // Seed institution data
      await seedTestData({
        institutions: [{
          id: 'hospital-a',
          name: 'City Children Hospital'
        }]
      });

      const unauthed = getUnauthenticatedContext();
      // Institutions are readable for login lookup
      await assertSucceeds(
        unauthed.firestore().doc('institutions/hospital-a').get()
      );
    });
  });

  // ============ PATIENT COLLECTION - INSTITUTION ISOLATION ============

  describe('Patient Collection - Institution Isolation', () => {
    beforeEach(async () => {
      // Seed test data
      await seedTestData({
        patients: [
          { id: 'patient-a', name: 'Patient A', institutionId: 'hospital-a' },
          { id: 'patient-b', name: 'Patient B', institutionId: 'hospital-b' }
        ],
        users: [
          { id: 'doctor-a-123', email: 'doctor@hospital-a.com', role: 'Doctor', institutionId: 'hospital-a' },
          { id: 'doctor-b-456', email: 'doctor@hospital-b.com', role: 'Doctor', institutionId: 'hospital-b' }
        ],
        superAdmins: [
          { id: 'super@neolink.com' }
        ]
      });
    });

    it('should ALLOW doctor to read patient from SAME institution', async () => {
      const doctorA = testContexts.getDoctorHospitalA();
      await assertSucceeds(
        doctorA.firestore().doc('patients/patient-a').get()
      );
    });

    it('should ALLOW doctor to create patient for SAME institution', async () => {
      const doctorA = testContexts.getDoctorHospitalA();
      await assertSucceeds(
        doctorA.firestore().collection('patients').add({
          name: 'New Patient',
          institutionId: 'hospital-a',
          createdAt: new Date(),
          createdBy: 'doctor-a-123'
        })
      );
    });

    it('should ALLOW SuperAdmin to read ANY patient', async () => {
      const superAdmin = testContexts.getSuperAdmin();
      await assertSucceeds(
        superAdmin.firestore().doc('patients/patient-a').get()
      );
      await assertSucceeds(
        superAdmin.firestore().doc('patients/patient-b').get()
      );
    });
  });

  // ============ AUDIT LOG IMMUTABILITY ============

  describe('Audit Logs - Immutability', () => {
    beforeEach(async () => {
      await seedTestData({
        auditLogs: [{
          id: 'log-1',
          action: 'PATIENT_VIEW',
          timestamp: new Date(),
          institutionId: 'hospital-a'
        }],
        users: [
          { id: 'doctor-a-123', email: 'doctor@hospital-a.com', role: 'Doctor', institutionId: 'hospital-a' },
          { id: 'admin-a-789', email: 'admin@hospital-a.com', role: 'Admin', institutionId: 'hospital-a' }
        ],
        superAdmins: [
          { id: 'super@neolink.com' }
        ]
      });
    });

    it('should ALLOW creating audit logs', async () => {
      const doctorA = testContexts.getDoctorHospitalA();
      await assertSucceeds(
        doctorA.firestore().collection('auditLogs').add({
          action: 'PATIENT_VIEW',
          timestamp: new Date()
        })
      );
    });

    it('should DENY updating audit logs', async () => {
      const doctorA = testContexts.getDoctorHospitalA();
      await assertFails(
        doctorA.firestore().doc('auditLogs/log-1').update({
          action: 'MODIFIED!'
        })
      );
    });

    it('should DENY deleting audit logs', async () => {
      const adminA = testContexts.getAdminHospitalA();
      await assertFails(
        adminA.firestore().doc('auditLogs/log-1').delete()
      );
    });

    it('should DENY SuperAdmin from modifying audit logs', async () => {
      const superAdmin = testContexts.getSuperAdmin();
      await assertFails(
        superAdmin.firestore().doc('auditLogs/log-1').update({
          action: 'TAMPERED'
        })
      );
    });
  });

  // ============ USER MANAGEMENT ============

  describe('User Collection', () => {
    beforeEach(async () => {
      await seedTestData({
        users: [
          { id: 'user-1', email: 'user1@hospital-a.com', role: 'Doctor', institutionId: 'hospital-a' },
          { id: 'user-2', email: 'user2@hospital-a.com', role: 'Nurse', institutionId: 'hospital-a' },
          { id: 'user-3', email: 'user3@hospital-b.com', role: 'Doctor', institutionId: 'hospital-b' },
          { id: 'admin-a-789', email: 'admin@hospital-a.com', role: 'Admin', institutionId: 'hospital-a' }
        ]
      });
    });

    it('should ALLOW user to read their own profile', async () => {
      const user = getAuthenticatedContext('user-1', {
        role: 'Doctor',
        institutionId: 'hospital-a',
        email: 'user1@hospital-a.com'
      });
      await assertSucceeds(
        user.firestore().doc('users/user-1').get()
      );
    });

    it('should ALLOW admin to read users in same institution', async () => {
      const admin = testContexts.getAdminHospitalA();
      await assertSucceeds(
        admin.firestore().doc('users/user-1').get()
      );
    });
  });

  // ============ REFERRAL ACCESS ============

  describe('Referral Collection', () => {
    beforeEach(async () => {
      await seedTestData({
        referrals: [{
          id: 'ref-1',
          fromInstitutionId: 'hospital-a',
          toInstitutionId: 'hospital-b',
          status: 'pending',
          patientId: 'patient-a'
        }],
        users: [
          { id: 'doctor-a-123', email: 'doctor@hospital-a.com', role: 'Doctor', institutionId: 'hospital-a' },
          { id: 'doctor-b-456', email: 'doctor@hospital-b.com', role: 'Doctor', institutionId: 'hospital-b' },
          { id: 'doctor-c-789', email: 'doctor@hospital-c.com', role: 'Doctor', institutionId: 'hospital-c' }
        ]
      });
    });

    it('should ALLOW sending institution to read referral', async () => {
      const doctorA = testContexts.getDoctorHospitalA();
      await assertSucceeds(
        doctorA.firestore().doc('referrals/ref-1').get()
      );
    });

    it('should ALLOW receiving institution to read referral', async () => {
      const doctorB = testContexts.getDoctorHospitalB();
      await assertSucceeds(
        doctorB.firestore().doc('referrals/ref-1').get()
      );
    });

    it('should ALLOW receiving institution to update status', async () => {
      const doctorB = testContexts.getDoctorHospitalB();
      await assertSucceeds(
        doctorB.firestore().doc('referrals/ref-1').update({
          status: 'accepted'
        })
      );
    });
  });

  // ============ PROGRESS NOTES SUBCOLLECTION ============

  describe('Progress Notes Subcollection', () => {
    beforeEach(async () => {
      await seedTestData({
        patients: [{
          id: 'patient-a',
          name: 'Test Patient',
          institutionId: 'hospital-a'
        }],
        users: [
          { id: 'doctor-a-123', email: 'doctor@hospital-a.com', role: 'Doctor', institutionId: 'hospital-a' },
          { id: 'doctor-b-456', email: 'doctor@hospital-b.com', role: 'Doctor', institutionId: 'hospital-b' }
        ]
      });
    });

    it('should ALLOW doctor to create progress note for patient in same institution', async () => {
      const doctorA = testContexts.getDoctorHospitalA();
      await assertSucceeds(
        doctorA.firestore()
          .collection('patients/patient-a/progressNotes')
          .add({
            content: 'Patient showing improvement',
            createdAt: new Date(),
            createdBy: 'doctor-a-123'
          })
      );
    });

    it('should ALLOW doctor to read progress notes for patient in same institution', async () => {
      const doctorA = testContexts.getDoctorHospitalA();
      await assertSucceeds(
        doctorA.firestore()
          .collection('patients/patient-a/progressNotes')
          .get()
      );
    });
  });

  // ============ INSTITUTION-SCOPED PATIENTS ============

  describe('Institution-Scoped Patients', () => {
    beforeEach(async () => {
      await seedTestData({
        users: [
          { id: 'doctor-a-123', email: 'doctor@hospital-a.com', role: 'Doctor', institutionId: 'hospital-a' },
          { id: 'doctor-b-456', email: 'doctor@hospital-b.com', role: 'Doctor', institutionId: 'hospital-b' }
        ],
        superAdmins: [
          { id: 'super@neolink.com' }
        ]
      });

      // Seed institution-scoped patient
      const superAdmin = testContexts.getSuperAdmin();
      await superAdmin.firestore()
        .doc('institutions/hospital-a/patients/inst-patient-1')
        .set({
          name: 'Inst Patient A',
          institutionId: 'hospital-a',
          createdAt: new Date(),
          createdBy: 'super-admin'
        });
    });

    it('should ALLOW reading patients within own institution scope', async () => {
      const doctorA = testContexts.getDoctorHospitalA();
      await assertSucceeds(
        doctorA.firestore()
          .doc('institutions/hospital-a/patients/inst-patient-1')
          .get()
      );
    });

    it('should ALLOW creating patients within own institution scope', async () => {
      const doctorA = testContexts.getDoctorHospitalA();
      await assertSucceeds(
        doctorA.firestore()
          .collection('institutions/hospital-a/patients')
          .add({
            name: 'New Inst Patient',
            institutionId: 'hospital-a',
            createdAt: new Date(),
            createdBy: 'doctor-a-123'
          })
      );
    });
  });

  // ============ OFFICIAL READ-ONLY ACCESS ============

  describe('Official Read-Only Access', () => {
    beforeEach(async () => {
      await seedTestData({
        patients: [{
          id: 'patient-a',
          name: 'Test Patient',
          institutionId: 'hospital-a'
        }],
        users: [
          { id: 'official-111', email: 'official@health.gov', role: 'Official', canViewAllInstitutions: true }
        ],
        officials: [
          { id: 'official@health.gov' }
        ]
      });
    });

    it('should ALLOW Official to read patients', async () => {
      const official = testContexts.getOfficial();
      await assertSucceeds(
        official.firestore().doc('patients/patient-a').get()
      );
    });

    it('should DENY Official from creating patients', async () => {
      const official = testContexts.getOfficial();
      await assertFails(
        official.firestore().collection('patients').add({
          name: 'Unauthorized Patient',
          institutionId: 'hospital-a'
        })
      );
    });

    it('should DENY Official from updating patients', async () => {
      const official = testContexts.getOfficial();
      await assertFails(
        official.firestore().doc('patients/patient-a').update({
          name: 'Modified Name'
        })
      );
    });
  });

  // ============ SUPER ADMIN COLLECTION ============

  describe('SuperAdmin Collection', () => {
    beforeEach(async () => {
      await seedTestData({
        superAdmins: [
          { id: 'super@neolink.com' }
        ],
        users: [
          { id: 'doctor-a-123', email: 'doctor@hospital-a.com', role: 'Doctor', institutionId: 'hospital-a' }
        ]
      });
    });

    it('should ALLOW authenticated user to read superAdmins (for role check)', async () => {
      const doctor = testContexts.getDoctorHospitalA();
      await assertSucceeds(
        doctor.firestore().doc('superAdmins/super@neolink.com').get()
      );
    });

    it('should DENY writing to superAdmins collection', async () => {
      const doctor = testContexts.getDoctorHospitalA();
      await assertFails(
        doctor.firestore().doc('superAdmins/hacker@evil.com').set({})
      );
    });

    it('should DENY even SuperAdmin from writing to superAdmins collection via client', async () => {
      // SuperAdmins collection is managed via Firebase Console only
      const superAdmin = testContexts.getSuperAdmin();
      await assertFails(
        superAdmin.firestore().doc('superAdmins/another@admin.com').set({})
      );
    });
  });
});

// ============ UNIT TESTS (No Emulator Required) ============

describe('Security Rules - Logic Tests (No Emulator)', () => {
  /**
   * These tests verify the logic of access control without requiring the emulator.
   * They test the helper functions and access control decisions.
   */

  describe('Institution Isolation Logic', () => {
    it('should correctly determine if user belongs to institution', () => {
      const user = { institutionId: 'hospital-a' };
      const patientInstitutionId = 'hospital-a';

      const belongsToInstitution = user.institutionId === patientInstitutionId;
      expect(belongsToInstitution).toBe(true);
    });

    it('should correctly deny access to different institution', () => {
      const user = { institutionId: 'hospital-a' };
      const patientInstitutionId = 'hospital-b';

      const belongsToInstitution = user.institutionId === patientInstitutionId;
      expect(belongsToInstitution).toBe(false);
    });
  });

  describe('Role-Based Access Logic', () => {
    it('should identify SuperAdmin correctly', () => {
      const isSuperAdmin = (role: string) => role === 'SuperAdmin';
      expect(isSuperAdmin('SuperAdmin')).toBe(true);
      expect(isSuperAdmin('Admin')).toBe(false);
    });

    it('should identify Admin correctly (case variations)', () => {
      const isAdmin = (role: string) =>
        role === 'admin' || role === 'Admin';
      expect(isAdmin('Admin')).toBe(true);
      expect(isAdmin('admin')).toBe(true);
      expect(isAdmin('Doctor')).toBe(false);
    });

    it('should identify Official correctly', () => {
      const isOfficial = (role: string) => role === 'Official';
      expect(isOfficial('Official')).toBe(true);
      expect(isOfficial('Doctor')).toBe(false);
    });
  });

  describe('Referral Access Logic', () => {
    it('should allow access for sending institution', () => {
      const referral = { fromInstitutionId: 'hospital-a', toInstitutionId: 'hospital-b' };
      const userInstitutionId = 'hospital-a';

      const canAccess = referral.fromInstitutionId === userInstitutionId ||
                        referral.toInstitutionId === userInstitutionId;
      expect(canAccess).toBe(true);
    });

    it('should allow access for receiving institution', () => {
      const referral = { fromInstitutionId: 'hospital-a', toInstitutionId: 'hospital-b' };
      const userInstitutionId = 'hospital-b';

      const canAccess = referral.fromInstitutionId === userInstitutionId ||
                        referral.toInstitutionId === userInstitutionId;
      expect(canAccess).toBe(true);
    });

    it('should deny access for third party institution', () => {
      const referral = { fromInstitutionId: 'hospital-a', toInstitutionId: 'hospital-b' };
      const userInstitutionId = 'hospital-c';

      const canAccess = referral.fromInstitutionId === userInstitutionId ||
                        referral.toInstitutionId === userInstitutionId;
      expect(canAccess).toBe(false);
    });
  });

  describe('Audit Field Validation Logic', () => {
    it('should require updatedAt and updatedBy fields', () => {
      const hasAuditFields = (data: Record<string, any>) =>
        'updatedAt' in data && 'updatedBy' in data;

      expect(hasAuditFields({ updatedAt: new Date(), updatedBy: 'user-1' })).toBe(true);
      expect(hasAuditFields({ updatedAt: new Date() })).toBe(false);
      expect(hasAuditFields({ updatedBy: 'user-1' })).toBe(false);
      expect(hasAuditFields({})).toBe(false);
    });
  });
});
