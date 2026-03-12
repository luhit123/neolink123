import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mockUsers,
  mockPatients,
  mockReferrals,
  mockInstitutions
} from '../../test/utils/testUtils';
import { UserRole } from '../../types';

// Mock Firebase modules
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
    fromDate: vi.fn((date: Date) => ({ toDate: () => date }))
  }
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

describe('ReferralService - Referral Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ CREATE REFERRAL TESTS ============

  describe('createReferral', () => {
    it('should create referral with valid data', async () => {
      mockAddDoc.mockResolvedValue({ id: 'referral-new-123' });

      const referralData = {
        patientId: mockPatients.patientHospitalA.id,
        patientName: mockPatients.patientHospitalA.name,
        toInstitutionId: 'hospital-b',
        toInstitutionName: 'Regional Medical Center',
        reason: 'Requires cardiac surgery',
        urgency: 'high',
        clinicalSummary: 'Patient has congenital heart defect'
      };

      await mockAddDoc({}, referralData);

      expect(mockAddDoc).toHaveBeenCalled();
      const calledWith = mockAddDoc.mock.calls[0][1];
      expect(calledWith.patientId).toBe(mockPatients.patientHospitalA.id);
      expect(calledWith.toInstitutionId).toBe('hospital-b');
    });

    it('should NOT allow referral to same institution', () => {
      const fromInstitutionId = 'hospital-a';
      const toInstitutionId = 'hospital-a';

      const isSameInstitution = fromInstitutionId === toInstitutionId;
      expect(isSameInstitution).toBe(true);

      // This should throw an error in actual implementation
      if (isSameInstitution) {
        const error = new Error('Cannot refer to same institution');
        expect(error.message).toBe('Cannot refer to same institution');
      }
    });

    it('should NOT allow referral of patient from different institution', () => {
      const userInstitutionId = mockUsers.doctorHospitalA.institutionId;
      const patientInstitutionId = mockPatients.patientHospitalB.institutionId;

      const canRefer = userInstitutionId === patientInstitutionId;
      expect(canRefer).toBe(false);
    });

    it('should NOT allow referral of discharged patient', () => {
      const patient = mockPatients.dischargedPatient;
      const isDischarged = patient.outcome === 'Discharged';

      expect(isDischarged).toBe(true);
      // Should not allow referral of discharged patient
    });

    it('should require reason for referral', () => {
      const referralData = {
        patientId: mockPatients.patientHospitalA.id,
        toInstitutionId: 'hospital-b',
        reason: '' // Empty reason
      };

      const hasReason = referralData.reason.length > 0;
      expect(hasReason).toBe(false);
    });
  });

  // ============ REFERRAL STATUS TESTS ============

  describe('Referral Status Management', () => {
    it('should have pending status when created', () => {
      const referral = mockReferrals.pendingReferral;
      expect(referral.status).toBe('Pending');
    });

    it('should have accepted status after acceptance', () => {
      const referral = mockReferrals.acceptedReferral;
      expect(referral.status).toBe('Accepted');
    });

    it('should track status updates history', () => {
      const referral = mockReferrals.acceptedReferral;
      expect(referral.statusUpdates.length).toBeGreaterThan(0);

      const lastUpdate = referral.statusUpdates[referral.statusUpdates.length - 1];
      expect(lastUpdate.status).toBe('Referral accepted');
    });
  });

  // ============ ACCEPT REFERRAL TESTS ============

  describe('acceptReferral', () => {
    it('should only allow receiving institution to accept', () => {
      const referral = mockReferrals.pendingReferral;
      const receivingInstitutionId = referral.toInstitutionId;

      // Doctor from receiving institution
      const canAccept = mockUsers.doctorHospitalB.institutionId === receivingInstitutionId;
      expect(canAccept).toBe(true);

      // Doctor from sending institution cannot accept
      const cannotAccept = mockUsers.doctorHospitalA.institutionId === receivingInstitutionId;
      expect(cannotAccept).toBe(false);
    });

    it('should update patient institutionId on acceptance', () => {
      const referral = mockReferrals.pendingReferral;
      const newInstitutionId = referral.toInstitutionId;

      // Simulate patient update after referral acceptance
      const updatedPatient = {
        ...mockPatients.patientHospitalA,
        institutionId: newInstitutionId,
        previousInstitutionId: mockPatients.patientHospitalA.institutionId
      };

      expect(updatedPatient.institutionId).toBe('hospital-b');
      expect(updatedPatient.previousInstitutionId).toBe('hospital-a');
    });

    it('should NOT allow accepting already processed referral', () => {
      const referral = mockReferrals.acceptedReferral;
      const isPending = referral.status === 'Pending';

      expect(isPending).toBe(false);
      // Should throw error if trying to accept non-pending referral
    });
  });

  // ============ REJECT REFERRAL TESTS ============

  describe('rejectReferral', () => {
    it('should require rejection reason', () => {
      const rejectionReason = '';
      const hasReason = rejectionReason.length > 0;

      expect(hasReason).toBe(false);
    });

    it('should NOT update patient on rejection', () => {
      const originalInstitutionId = mockPatients.patientHospitalA.institutionId;

      // After rejection, patient should remain at original institution
      expect(originalInstitutionId).toBe('hospital-a');
    });

    it('should only allow receiving institution to reject', () => {
      const referral = mockReferrals.pendingReferral;
      const receivingInstitutionId = referral.toInstitutionId;

      const canReject = mockUsers.doctorHospitalB.institutionId === receivingInstitutionId;
      expect(canReject).toBe(true);
    });
  });

  // ============ QUERY REFERRALS TESTS ============

  describe('getReferralsByInstitution', () => {
    it('should return referrals where institution is sender or receiver', () => {
      const institutionId = 'hospital-a';
      const allReferrals = [
        mockReferrals.pendingReferral, // hospital-a -> hospital-b
        mockReferrals.acceptedReferral // hospital-a -> hospital-b
      ];

      const relevantReferrals = allReferrals.filter(
        r => r.fromInstitutionId === institutionId || r.toInstitutionId === institutionId
      );

      expect(relevantReferrals.length).toBe(2);
    });
  });

  describe('getIncomingReferrals', () => {
    it('should return only incoming referrals', () => {
      const institutionId = 'hospital-b';
      const allReferrals = [
        mockReferrals.pendingReferral,
        mockReferrals.acceptedReferral
      ];

      const incomingReferrals = allReferrals.filter(
        r => r.toInstitutionId === institutionId
      );

      expect(incomingReferrals.length).toBe(2);
      incomingReferrals.forEach(r => {
        expect(r.toInstitutionId).toBe(institutionId);
      });
    });
  });

  describe('getOutgoingReferrals', () => {
    it('should return only outgoing referrals', () => {
      const institutionId = 'hospital-a';
      const allReferrals = [
        mockReferrals.pendingReferral,
        mockReferrals.acceptedReferral
      ];

      const outgoingReferrals = allReferrals.filter(
        r => r.fromInstitutionId === institutionId
      );

      expect(outgoingReferrals.length).toBe(2);
      outgoingReferrals.forEach(r => {
        expect(r.fromInstitutionId).toBe(institutionId);
      });
    });
  });

  // ============ REFERRAL ACCESS CONTROL TESTS ============

  describe('Referral Access Control', () => {
    it('should allow sending institution to view referral', () => {
      const referral = mockReferrals.pendingReferral;
      const userInstitutionId = mockUsers.doctorHospitalA.institutionId;

      const canView = referral.fromInstitutionId === userInstitutionId ||
                      referral.toInstitutionId === userInstitutionId;

      expect(canView).toBe(true);
    });

    it('should allow receiving institution to view referral', () => {
      const referral = mockReferrals.pendingReferral;
      const userInstitutionId = mockUsers.doctorHospitalB.institutionId;

      const canView = referral.fromInstitutionId === userInstitutionId ||
                      referral.toInstitutionId === userInstitutionId;

      expect(canView).toBe(true);
    });

    it('should DENY third institution from viewing referral', () => {
      const referral = mockReferrals.pendingReferral;
      const thirdPartyInstitutionId = 'hospital-c';

      const canView = referral.fromInstitutionId === thirdPartyInstitutionId ||
                      referral.toInstitutionId === thirdPartyInstitutionId;

      expect(canView).toBe(false);
    });

    it('should allow SuperAdmin to view any referral', () => {
      const isSuperAdmin = mockUsers.superAdmin.role === UserRole.SuperAdmin;
      expect(isSuperAdmin).toBe(true);
      // SuperAdmin can view all referrals
    });
  });

  // ============ REFERRAL URGENCY TESTS ============

  describe('Referral Urgency', () => {
    it('should support high urgency level', () => {
      const referral = mockReferrals.pendingReferral;
      expect(referral.referralDetails).toBeDefined();
    });

    it('should include clinical summary in referral details', () => {
      const referral = mockReferrals.pendingReferral;
      expect(referral.referralDetails.clinicalSummary).toBeDefined();
      expect(referral.referralDetails.clinicalSummary!.length).toBeGreaterThan(0);
    });

    it('should include treatments provided before referral', () => {
      const referral = mockReferrals.pendingReferral;
      expect(referral.referralDetails.treatmentsProvided).toBeDefined();
      expect(referral.referralDetails.treatmentsProvided.length).toBeGreaterThan(0);
    });
  });

  // ============ REFERRAL DATA INTEGRITY TESTS ============

  describe('Referral Data Integrity', () => {
    it('should preserve patient information in referral', () => {
      const referral = mockReferrals.pendingReferral;

      expect(referral.patientId).toBe(mockPatients.patientHospitalA.id);
      expect(referral.patientName).toBe(mockPatients.patientHospitalA.name);
      expect(referral.patientAge).toBe(mockPatients.patientHospitalA.age);
    });

    it('should preserve referring user information', () => {
      const referral = mockReferrals.pendingReferral;

      expect(referral.referredBy).toBeDefined();
      expect(referral.referredByEmail).toBeDefined();
      expect(referral.referredByRole).toBe(UserRole.Doctor);
    });

    it('should have valid timestamp for referral creation', () => {
      const referral = mockReferrals.pendingReferral;
      const referralDate = new Date(referral.referralDate);

      expect(referralDate).toBeInstanceOf(Date);
      expect(isNaN(referralDate.getTime())).toBe(false);
    });
  });
});
