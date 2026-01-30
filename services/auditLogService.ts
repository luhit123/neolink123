/**
 * HIPAA-Compliant Audit Logging Service
 *
 * This service tracks all access to Protected Health Information (PHI)
 * as required by HIPAA Security Rule § 164.312(b)
 *
 * Audit logs are IMMUTABLE once created - they cannot be modified or deleted
 */

import { db, auth } from '../firebaseConfig';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  limit
} from 'firebase/firestore';
import { maskName, maskEmail, maskPHI } from '../utils/security';

// ==================== TYPES ====================

export enum AuditAction {
  // Authentication
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  SESSION_TIMEOUT = 'SESSION_TIMEOUT',

  // Patient Records (PHI)
  PATIENT_VIEW = 'PATIENT_VIEW',
  PATIENT_CREATE = 'PATIENT_CREATE',
  PATIENT_UPDATE = 'PATIENT_UPDATE',
  PATIENT_DELETE = 'PATIENT_DELETE',
  PATIENT_SEARCH = 'PATIENT_SEARCH',
  PATIENT_EXPORT = 'PATIENT_EXPORT',
  PATIENT_PRINT = 'PATIENT_PRINT',

  // Clinical Notes
  CLINICAL_NOTE_VIEW = 'CLINICAL_NOTE_VIEW',
  CLINICAL_NOTE_CREATE = 'CLINICAL_NOTE_CREATE',
  CLINICAL_NOTE_UPDATE = 'CLINICAL_NOTE_UPDATE',
  CLINICAL_NOTE_DELETE = 'CLINICAL_NOTE_DELETE',

  // Progress Notes
  PROGRESS_NOTE_VIEW = 'PROGRESS_NOTE_VIEW',
  PROGRESS_NOTE_CREATE = 'PROGRESS_NOTE_CREATE',
  PROGRESS_NOTE_UPDATE = 'PROGRESS_NOTE_UPDATE',
  PROGRESS_NOTE_DELETE = 'PROGRESS_NOTE_DELETE',

  // Medical Documents
  DISCHARGE_SUMMARY_VIEW = 'DISCHARGE_SUMMARY_VIEW',
  DISCHARGE_SUMMARY_CREATE = 'DISCHARGE_SUMMARY_CREATE',
  DISCHARGE_SUMMARY_DOWNLOAD = 'DISCHARGE_SUMMARY_DOWNLOAD',
  DEATH_CERTIFICATE_VIEW = 'DEATH_CERTIFICATE_VIEW',
  DEATH_CERTIFICATE_CREATE = 'DEATH_CERTIFICATE_CREATE',
  DEATH_CERTIFICATE_DOWNLOAD = 'DEATH_CERTIFICATE_DOWNLOAD',

  // Referrals
  REFERRAL_VIEW = 'REFERRAL_VIEW',
  REFERRAL_CREATE = 'REFERRAL_CREATE',
  REFERRAL_UPDATE = 'REFERRAL_UPDATE',
  REFERRAL_ACCEPT = 'REFERRAL_ACCEPT',
  REFERRAL_REJECT = 'REFERRAL_REJECT',

  // AI Features
  AI_ANALYSIS_REQUEST = 'AI_ANALYSIS_REQUEST',
  AI_TRANSCRIPTION_REQUEST = 'AI_TRANSCRIPTION_REQUEST',

  // Admin Actions
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  ROLE_CHANGE = 'ROLE_CHANGE',
  SETTINGS_CHANGE = 'SETTINGS_CHANGE',

  // Security Events
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  DATA_BREACH_DETECTED = 'DATA_BREACH_DETECTED'
}

export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

export interface AuditLogEntry {
  id?: string;
  timestamp: Date;
  action: AuditAction;
  severity: AuditSeverity;

  // User Information
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  institutionId: string;
  institutionName: string;

  // Request Context
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;

  // Resource Information
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;

  // Action Details
  description: string;
  oldValue?: string;
  newValue?: string;
  fieldsAccessed?: string[];
  fieldsModified?: string[];

  // Additional Metadata
  metadata?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
}

// ==================== AUDIT LOG SERVICE ====================

const AUDIT_COLLECTION = 'auditLogs';

/**
 * Get current user context for audit logging
 */
const getCurrentUserContext = (): Partial<AuditLogEntry> => {
  const user = auth.currentUser;

  if (!user) {
    return {
      userId: 'ANONYMOUS',
      userEmail: 'unknown',
      userName: 'Unknown User',
      userRole: 'none',
      institutionId: 'unknown',
      institutionName: 'Unknown'
    };
  }

  // Get user data from localStorage or session (populated during login)
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');

  return {
    userId: user.uid,
    userEmail: maskEmail(user.email || 'unknown'),
    userName: maskName(userData.name || user.displayName || 'Unknown'),
    userRole: userData.role || 'user',
    institutionId: userData.institutionId || 'unknown',
    institutionName: userData.institutionName || 'Unknown'
  };
};

/**
 * Get client context (IP, User Agent, etc.)
 */
const getClientContext = (): Partial<AuditLogEntry> => {
  return {
    userAgent: navigator.userAgent,
    sessionId: sessionStorage.getItem('sessionId') || undefined
  };
};

/**
 * Create an audit log entry
 * This is the core function - all audit logging goes through here
 */
export const createAuditLog = async (
  action: AuditAction,
  details: Partial<AuditLogEntry>
): Promise<string | null> => {
  try {
    const userContext = getCurrentUserContext();
    const clientContext = getClientContext();

    // Determine severity based on action type
    let severity = AuditSeverity.INFO;
    if (action.includes('DELETE') || action.includes('FAILED') || action === AuditAction.ROLE_CHANGE) {
      severity = AuditSeverity.WARNING;
    }
    if (action.includes('UNAUTHORIZED') || action.includes('BREACH') || action.includes('SUSPICIOUS')) {
      severity = AuditSeverity.CRITICAL;
    }

    const logEntry: Omit<AuditLogEntry, 'id'> = {
      timestamp: new Date(),
      action,
      severity: details.severity || severity,
      ...userContext,
      ...clientContext,
      ...details,
      description: details.description || `${action} performed`,
      success: details.success !== false
    };

    // Add to Firestore (immutable - cannot be updated or deleted per security rules)
    const docRef = await addDoc(collection(db, AUDIT_COLLECTION), {
      ...logEntry,
      timestamp: Timestamp.fromDate(logEntry.timestamp)
    });

    // Also log to console in development (without sensitive data)
    if (import.meta.env.DEV) {
      console.log(`[AUDIT] ${action}:`, {
        severity: logEntry.severity,
        resourceType: logEntry.resourceType,
        resourceId: logEntry.resourceId ? maskPHI(logEntry.resourceId) : undefined,
        success: logEntry.success
      });
    }

    return docRef.id;
  } catch (error) {
    // Audit logging failures should not crash the application
    // but should be reported to monitoring
    console.error('[AUDIT ERROR] Failed to create audit log:', error);
    return null;
  }
};

// ==================== CONVENIENCE FUNCTIONS ====================

/**
 * Log patient record access
 */
export const logPatientAccess = async (
  patientId: string,
  patientName: string,
  action: AuditAction = AuditAction.PATIENT_VIEW,
  fieldsAccessed?: string[]
): Promise<void> => {
  await createAuditLog(action, {
    resourceType: 'patient',
    resourceId: patientId,
    resourceName: maskName(patientName),
    fieldsAccessed,
    description: `Patient record ${action.toLowerCase().replace('patient_', '')}`
  });
};

/**
 * Log authentication events
 */
export const logAuthEvent = async (
  action: AuditAction,
  success: boolean,
  email?: string,
  errorMessage?: string
): Promise<void> => {
  await createAuditLog(action, {
    resourceType: 'authentication',
    success,
    userEmail: email ? maskEmail(email) : undefined,
    errorMessage,
    description: success
      ? `Successful ${action.toLowerCase().replace('_', ' ')}`
      : `Failed ${action.toLowerCase().replace('_', ' ')}`
  });
};

/**
 * Log document generation/download
 */
export const logDocumentAction = async (
  action: AuditAction,
  documentType: string,
  patientId: string,
  patientName: string
): Promise<void> => {
  await createAuditLog(action, {
    resourceType: documentType,
    resourceId: patientId,
    resourceName: maskName(patientName),
    description: `${documentType} ${action.includes('DOWNLOAD') ? 'downloaded' : action.includes('VIEW') ? 'viewed' : 'generated'}`
  });
};

/**
 * Log clinical note access
 */
export const logClinicalNoteAccess = async (
  noteId: string,
  patientId: string,
  action: AuditAction,
  noteType?: string
): Promise<void> => {
  await createAuditLog(action, {
    resourceType: noteType || 'clinical_note',
    resourceId: noteId,
    metadata: { patientId: maskPHI(patientId) },
    description: `Clinical note ${action.toLowerCase().replace('clinical_note_', '')}`
  });
};

/**
 * Log referral actions
 */
export const logReferralAction = async (
  referralId: string,
  action: AuditAction,
  fromInstitution: string,
  toInstitution: string
): Promise<void> => {
  await createAuditLog(action, {
    resourceType: 'referral',
    resourceId: referralId,
    metadata: { fromInstitution, toInstitution },
    description: `Referral ${action.toLowerCase().replace('referral_', '')}`
  });
};

/**
 * Log AI feature usage
 */
export const logAIUsage = async (
  action: AuditAction,
  featureType: string,
  patientId?: string
): Promise<void> => {
  await createAuditLog(action, {
    resourceType: 'ai_feature',
    resourceId: patientId,
    metadata: { featureType },
    description: `AI ${featureType} requested`
  });
};

/**
 * Log admin/settings changes
 */
export const logAdminAction = async (
  action: AuditAction,
  targetUserId?: string,
  changes?: { oldValue?: string; newValue?: string }
): Promise<void> => {
  await createAuditLog(action, {
    resourceType: 'admin',
    resourceId: targetUserId,
    oldValue: changes?.oldValue,
    newValue: changes?.newValue,
    severity: AuditSeverity.WARNING,
    description: `Admin action: ${action.toLowerCase().replace('_', ' ')}`
  });
};

/**
 * Log security events
 */
export const logSecurityEvent = async (
  action: AuditAction,
  description: string,
  metadata?: Record<string, unknown>
): Promise<void> => {
  await createAuditLog(action, {
    resourceType: 'security',
    severity: AuditSeverity.CRITICAL,
    description,
    metadata
  });
};

/**
 * Log data export
 */
export const logDataExport = async (
  exportType: string,
  recordCount: number,
  dateRange?: { start: string; end: string }
): Promise<void> => {
  await createAuditLog(AuditAction.PATIENT_EXPORT, {
    resourceType: 'export',
    description: `Exported ${recordCount} ${exportType} records`,
    metadata: { exportType, recordCount, dateRange }
  });
};

// ==================== AUDIT LOG QUERIES ====================

/**
 * Get audit logs for a specific patient (for audit trail)
 */
export const getPatientAuditLogs = async (
  patientId: string,
  limitCount: number = 100
): Promise<AuditLogEntry[]> => {
  try {
    const q = query(
      collection(db, AUDIT_COLLECTION),
      where('resourceId', '==', patientId),
      where('resourceType', '==', 'patient'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate()
    })) as AuditLogEntry[];
  } catch (error) {
    console.error('Error fetching patient audit logs:', error);
    return [];
  }
};

/**
 * Get audit logs for an institution (admin view)
 */
export const getInstitutionAuditLogs = async (
  institutionId: string,
  startDate: Date,
  endDate: Date,
  limitCount: number = 500
): Promise<AuditLogEntry[]> => {
  try {
    const q = query(
      collection(db, AUDIT_COLLECTION),
      where('institutionId', '==', institutionId),
      where('timestamp', '>=', Timestamp.fromDate(startDate)),
      where('timestamp', '<=', Timestamp.fromDate(endDate)),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate()
    })) as AuditLogEntry[];
  } catch (error) {
    console.error('Error fetching institution audit logs:', error);
    return [];
  }
};

/**
 * Get security-related audit logs
 */
export const getSecurityAuditLogs = async (
  limitCount: number = 100
): Promise<AuditLogEntry[]> => {
  try {
    const q = query(
      collection(db, AUDIT_COLLECTION),
      where('severity', '==', AuditSeverity.CRITICAL),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate()
    })) as AuditLogEntry[];
  } catch (error) {
    console.error('Error fetching security audit logs:', error);
    return [];
  }
};

/**
 * Get user's own audit trail
 */
export const getUserAuditLogs = async (
  userId: string,
  limitCount: number = 100
): Promise<AuditLogEntry[]> => {
  try {
    const q = query(
      collection(db, AUDIT_COLLECTION),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate()
    })) as AuditLogEntry[];
  } catch (error) {
    console.error('Error fetching user audit logs:', error);
    return [];
  }
};

// ==================== SESSION INITIALIZATION ====================

/**
 * Initialize session for audit logging
 * Call this after successful login
 */
export const initializeAuditSession = (userData: {
  name: string;
  role: string;
  institutionId: string;
  institutionName: string;
}): void => {
  // Store user data for audit context
  localStorage.setItem('userData', JSON.stringify(userData));

  // Generate unique session ID
  const sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  sessionStorage.setItem('sessionId', sessionId);
};

/**
 * Clear audit session on logout
 */
export const clearAuditSession = (): void => {
  localStorage.removeItem('userData');
  sessionStorage.removeItem('sessionId');
};

export default {
  createAuditLog,
  logPatientAccess,
  logAuthEvent,
  logDocumentAction,
  logClinicalNoteAccess,
  logReferralAction,
  logAIUsage,
  logAdminAction,
  logSecurityEvent,
  logDataExport,
  getPatientAuditLogs,
  getInstitutionAuditLogs,
  getSecurityAuditLogs,
  getUserAuditLogs,
  initializeAuditSession,
  clearAuditSession,
  AuditAction,
  AuditSeverity
};
