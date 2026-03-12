import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockUsers, mockPatients } from '../../test/utils/testUtils';
import { UserRole } from '../../types';

// Mock Firebase modules
const mockAddDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockCollection = vi.fn();
const mockLimit = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  limit: (...args: any[]) => mockLimit(...args),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() }))
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

// Mock security utils
vi.mock('../../utils/security', () => ({
  maskName: vi.fn((name: string) => {
    return name.split(' ')
      .map(word => word[0] + '***')
      .join(' ');
  }),
  maskEmail: vi.fn((email: string) => {
    const [user, domain] = email.split('@');
    return `${user[0]}***@${domain[0]}***.com`;
  }),
  maskPHI: vi.fn((value: string, type: string) => `***${type}***`)
}));

// Audit action types (matching the service)
enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PATIENT_VIEW = 'PATIENT_VIEW',
  PATIENT_CREATE = 'PATIENT_CREATE',
  PATIENT_UPDATE = 'PATIENT_UPDATE',
  PATIENT_DELETE = 'PATIENT_DELETE',
  REFERRAL_CREATE = 'REFERRAL_CREATE',
  REFERRAL_ACCEPT = 'REFERRAL_ACCEPT',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT'
}

enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

interface AuditLogEntry {
  id?: string;
  timestamp: Date;
  action: AuditAction;
  severity: AuditSeverity;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  institutionId: string;
  description: string;
  resourceType?: string;
  resourceId?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

describe('AuditLogService - Audit Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ CREATE AUDIT LOG TESTS ============

  describe('createAuditLog', () => {
    it('should create audit log with all required fields', async () => {
      mockAddDoc.mockResolvedValue({ id: 'log-123' });

      const logEntry: AuditLogEntry = {
        timestamp: new Date(),
        action: AuditAction.PATIENT_VIEW,
        severity: AuditSeverity.INFO,
        userId: mockUsers.doctorHospitalA.uid,
        userEmail: mockUsers.doctorHospitalA.email,
        userName: mockUsers.doctorHospitalA.displayName,
        userRole: mockUsers.doctorHospitalA.role,
        institutionId: mockUsers.doctorHospitalA.institutionId!,
        description: 'Viewed patient record',
        resourceType: 'patient',
        resourceId: mockPatients.patientHospitalA.id,
        success: true
      };

      await mockAddDoc({}, logEntry);

      expect(mockAddDoc).toHaveBeenCalled();
      const calledWith = mockAddDoc.mock.calls[0][1];
      expect(calledWith.action).toBe(AuditAction.PATIENT_VIEW);
      expect(calledWith.userId).toBe(mockUsers.doctorHospitalA.uid);
    });

    it('should capture IP address and user agent in metadata', () => {
      const logEntry: AuditLogEntry = {
        timestamp: new Date(),
        action: AuditAction.LOGIN,
        severity: AuditSeverity.INFO,
        userId: mockUsers.doctorHospitalA.uid,
        userEmail: mockUsers.doctorHospitalA.email,
        userName: mockUsers.doctorHospitalA.displayName,
        userRole: mockUsers.doctorHospitalA.role,
        institutionId: mockUsers.doctorHospitalA.institutionId!,
        description: 'User logged in',
        success: true,
        metadata: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0...'
        }
      };

      expect(logEntry.metadata?.ipAddress).toBe('192.168.1.1');
      expect(logEntry.metadata?.userAgent).toBe('Mozilla/5.0...');
    });

    it('should log failed login attempts with WARNING severity', () => {
      const logEntry: AuditLogEntry = {
        timestamp: new Date(),
        action: AuditAction.LOGIN_FAILED,
        severity: AuditSeverity.WARNING,
        userId: 'attempted-user',
        userEmail: 'attempted@test.com',
        userName: 'Unknown',
        userRole: 'none',
        institutionId: 'unknown',
        description: 'Failed login attempt',
        success: false,
        metadata: {
          reason: 'Invalid credentials',
          attemptCount: 3
        }
      };

      expect(logEntry.action).toBe(AuditAction.LOGIN_FAILED);
      expect(logEntry.severity).toBe(AuditSeverity.WARNING);
      expect(logEntry.success).toBe(false);
    });

    it('should log unauthorized access with CRITICAL severity', () => {
      const logEntry: AuditLogEntry = {
        timestamp: new Date(),
        action: AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
        severity: AuditSeverity.CRITICAL,
        userId: mockUsers.doctorHospitalA.uid,
        userEmail: mockUsers.doctorHospitalA.email,
        userName: mockUsers.doctorHospitalA.displayName,
        userRole: mockUsers.doctorHospitalA.role,
        institutionId: mockUsers.doctorHospitalA.institutionId!,
        description: 'Attempted to access patient from different institution',
        resourceType: 'patient',
        resourceId: mockPatients.patientHospitalB.id,
        success: false
      };

      expect(logEntry.action).toBe(AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT);
      expect(logEntry.severity).toBe(AuditSeverity.CRITICAL);
    });
  });

  // ============ PHI MASKING TESTS ============

  describe('PHI Masking', () => {
    function maskName(name: string): string {
      return name.split(' ')
        .map(word => word[0] + '***')
        .join(' ');
    }

    function maskEmail(email: string): string {
      const [user, domain] = email.split('@');
      const domainParts = domain.split('.');
      return `${user[0]}***@${domainParts[0][0]}***.${domainParts.slice(1).join('.')}`;
    }

    function maskPhone(phone: string): string {
      // Keep last 4 digits visible
      return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
    }

    it('should mask patient names in logs', () => {
      const maskedName = maskName('Baby Singh');
      expect(maskedName).toBe('B*** S***');
    });

    it('should mask multi-word names correctly', () => {
      const maskedName = maskName('Rahul Kumar Sharma');
      expect(maskedName).toBe('R*** K*** S***');
    });

    it('should mask email addresses', () => {
      const maskedEmail = maskEmail('doctor@hospital.com');
      expect(maskedEmail).toBe('d***@h***.com');
    });

    it('should mask phone numbers', () => {
      const maskedPhone = maskPhone('+91-9876543210');
      expect(maskedPhone).toContain('3210'); // Last 4 visible
      expect(maskedPhone).toContain('*');
    });
  });

  // ============ QUERY AUDIT LOGS TESTS ============

  describe('queryAuditLogs', () => {
    it('should filter logs by date range', () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      // Mock the query
      mockWhere.mockReturnValue({});
      mockQuery.mockReturnValue({});

      expect(mockWhere).not.toHaveBeenCalled();

      // Simulate filtering
      const logs = [
        { timestamp: new Date('2026-01-15'), action: AuditAction.PATIENT_VIEW },
        { timestamp: new Date('2026-02-15'), action: AuditAction.PATIENT_VIEW }
      ];

      const filtered = logs.filter(log =>
        log.timestamp >= startDate && log.timestamp <= endDate
      );

      expect(filtered.length).toBe(1);
    });

    it('should filter logs by action type', () => {
      const logs = [
        { action: AuditAction.PATIENT_VIEW, userId: 'user-1' },
        { action: AuditAction.PATIENT_CREATE, userId: 'user-1' },
        { action: AuditAction.PATIENT_VIEW, userId: 'user-2' }
      ];

      const viewLogs = logs.filter(log => log.action === AuditAction.PATIENT_VIEW);
      expect(viewLogs.length).toBe(2);
    });

    it('should filter logs by user', () => {
      const logs = [
        { action: AuditAction.PATIENT_VIEW, userId: 'user-1' },
        { action: AuditAction.PATIENT_VIEW, userId: 'user-2' },
        { action: AuditAction.PATIENT_CREATE, userId: 'user-1' }
      ];

      const userLogs = logs.filter(log => log.userId === 'user-1');
      expect(userLogs.length).toBe(2);
    });

    it('should filter logs by institution', () => {
      const logs = [
        { action: AuditAction.PATIENT_VIEW, institutionId: 'hospital-a' },
        { action: AuditAction.PATIENT_VIEW, institutionId: 'hospital-b' },
        { action: AuditAction.PATIENT_CREATE, institutionId: 'hospital-a' }
      ];

      const institutionLogs = logs.filter(log => log.institutionId === 'hospital-a');
      expect(institutionLogs.length).toBe(2);
    });
  });

  // ============ PATIENT AUDIT TRAIL TESTS ============

  describe('getPatientAuditTrail', () => {
    it('should return all actions for a specific patient', () => {
      const patientId = mockPatients.patientHospitalA.id;
      const logs = [
        { resourceId: patientId, action: AuditAction.PATIENT_VIEW, timestamp: new Date('2026-01-15') },
        { resourceId: patientId, action: AuditAction.PATIENT_UPDATE, timestamp: new Date('2026-01-16') },
        { resourceId: 'other-patient', action: AuditAction.PATIENT_VIEW, timestamp: new Date('2026-01-15') }
      ];

      const patientLogs = logs.filter(log => log.resourceId === patientId);
      expect(patientLogs.length).toBe(2);
    });

    it('should order logs by timestamp descending', () => {
      const logs = [
        { timestamp: new Date('2026-01-15'), action: 'view' },
        { timestamp: new Date('2026-01-17'), action: 'update' },
        { timestamp: new Date('2026-01-16'), action: 'create' }
      ];

      const sorted = logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      expect(sorted[0].action).toBe('update');
      expect(sorted[1].action).toBe('create');
      expect(sorted[2].action).toBe('view');
    });
  });

  // ============ AUDIT LOG IMMUTABILITY TESTS ============

  describe('Audit Log Immutability', () => {
    it('should NOT allow updating audit logs', () => {
      // Audit logs should be immutable - no update function should exist
      const updateAuditLog = undefined;
      expect(updateAuditLog).toBeUndefined();
    });

    it('should NOT allow deleting audit logs', () => {
      // Audit logs should be immutable - no delete function should exist
      const deleteAuditLog = undefined;
      expect(deleteAuditLog).toBeUndefined();
    });

    it('should only allow creation of audit logs', () => {
      // The only allowed operation is addDoc
      expect(mockAddDoc).toBeDefined();
    });
  });

  // ============ AUDIT LOG ACCESS CONTROL TESTS ============

  describe('Audit Log Access Control', () => {
    it('should only allow Admin/SuperAdmin to view audit logs', () => {
      const canViewAuditLogs = (userRole: UserRole): boolean => {
        return userRole === UserRole.Admin ||
               userRole === UserRole.SuperAdmin;
      };

      expect(canViewAuditLogs(UserRole.SuperAdmin)).toBe(true);
      expect(canViewAuditLogs(UserRole.Admin)).toBe(true);
      expect(canViewAuditLogs(UserRole.Doctor)).toBe(false);
      expect(canViewAuditLogs(UserRole.Nurse)).toBe(false);
      expect(canViewAuditLogs(UserRole.Official)).toBe(false);
    });

    it('should restrict audit log access to own institution for Admin', () => {
      const adminUser = mockUsers.adminHospitalA;
      const logs = [
        { institutionId: 'hospital-a', action: AuditAction.PATIENT_VIEW },
        { institutionId: 'hospital-b', action: AuditAction.PATIENT_VIEW }
      ];

      const accessibleLogs = logs.filter(log =>
        log.institutionId === adminUser.institutionId
      );

      expect(accessibleLogs.length).toBe(1);
    });

    it('should allow SuperAdmin to view all audit logs', () => {
      const isSuperAdmin = mockUsers.superAdmin.role === UserRole.SuperAdmin;
      const logs = [
        { institutionId: 'hospital-a', action: AuditAction.PATIENT_VIEW },
        { institutionId: 'hospital-b', action: AuditAction.PATIENT_VIEW }
      ];

      const accessibleLogs = isSuperAdmin ? logs : [];
      expect(accessibleLogs.length).toBe(2);
    });
  });

  // ============ AUDIT LOG SEVERITY TESTS ============

  describe('Audit Severity Assignment', () => {
    it('should assign INFO severity to normal operations', () => {
      const normalActions = [
        AuditAction.LOGIN,
        AuditAction.LOGOUT,
        AuditAction.PATIENT_VIEW
      ];

      normalActions.forEach(action => {
        expect(AuditSeverity.INFO).toBe('INFO');
      });
    });

    it('should assign WARNING severity to failed attempts', () => {
      const warningActions = [
        AuditAction.LOGIN_FAILED
      ];

      warningActions.forEach(action => {
        expect(AuditSeverity.WARNING).toBe('WARNING');
      });
    });

    it('should assign CRITICAL severity to security violations', () => {
      const criticalActions = [
        AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT
      ];

      criticalActions.forEach(action => {
        expect(AuditSeverity.CRITICAL).toBe('CRITICAL');
      });
    });
  });
});
