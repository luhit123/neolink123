import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fetch from 'node-fetch';

// Initialize Firebase Admin
admin.initializeApp();

// ============================================================================
// REGION CONFIGURATION - MUST MATCH CLIENT (firebaseConfig.ts)
// ============================================================================
const FUNCTION_REGION = 'asia-southeast1'; // Singapore - matches database region

// Export Enterprise Authentication Functions
export {
  createSecureUser,
  authenticateUser,
  migrateUserPassword,
  bulkMigratePasswords,
  changePassword,
  getAuthAuditLogs,
  initializeUserPassword,
  autoFixPasswords,
} from './auth';

// Export Scalable User Lookup Functions & Triggers
export {
  migrateAllUsersToLookup,
  onOfficialWrite,
  onApprovedUserWrite,
  onInstitutionWrite,
  onDistrictAdminWrite,
  onSuperAdminWrite,
} from './userLookup';

const RUNPOD_API_KEY = functions.config().runpod?.api_key || process.env.RUNPOD_API_KEY;
const MEDASR_ENDPOINT_ID = functions.config().runpod?.medasr_endpoint || process.env.MEDASR_ENDPOINT_ID || 'tiv2evbbzqxdkg';
const RUNPOD_BASE_URL = 'https://api.runpod.io/v2';

interface RunPodJobResponse {
  id: string;
  status: string;
}

interface RunPodStatusResponse {
  id: string;
  status: string;
  output?: {
    transcription?: string;
    text?: string;
    transcript?: string;
  };
  error?: string;
}

/**
 * MedASR Transcription - Submit audio for transcription
 */
export const medAsrTranscribe = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
  // Verify authentication (optional but recommended)
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to use transcription'
    );
  }

  const { audio } = data;

  if (!audio) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Audio data is required'
    );
  }

  if (!RUNPOD_API_KEY) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'RunPod API key not configured'
    );
  }

  try {
    // Submit job to RunPod
    const submitResponse = await fetch(`${RUNPOD_BASE_URL}/${MEDASR_ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          audio: audio,
          language: 'en',
          task: 'transcribe'
        }
      })
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`RunPod submit failed: ${submitResponse.status} - ${errorText}`);
    }

    const jobData: RunPodJobResponse = await submitResponse.json() as RunPodJobResponse;
    const jobId = jobData.id;

    console.log(`MedASR job submitted: ${jobId}`);

    // Poll for completion (max 2 minutes)
    const maxWaitMs = 120000;
    const pollIntervalMs = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const statusResponse = await fetch(`${RUNPOD_BASE_URL}/${MEDASR_ENDPOINT_ID}/status/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${RUNPOD_API_KEY}`,
        }
      });

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const statusData: RunPodStatusResponse = await statusResponse.json() as RunPodStatusResponse;

      if (statusData.status === 'COMPLETED') {
        const output = statusData.output;
        if (output) {
          const transcription = output.transcription || output.text || output.transcript || '';
          console.log(`MedASR completed: ${transcription.substring(0, 100)}...`);
          return { transcription, jobId };
        }
        throw new Error('No transcription in response');
      }

      if (statusData.status === 'FAILED') {
        throw new Error(statusData.error || 'Transcription job failed');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('Transcription timeout - job took too long');

  } catch (error: any) {
    console.error('MedASR error:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Transcription failed: ${error.message}`
    );
  }
});

/**
 * Health check endpoint
 */
export const healthCheck = functions.region(FUNCTION_REGION).https.onRequest((req, res) => {
  res.json({
    status: 'ok',
    service: 'MedASR Proxy',
    configured: !!RUNPOD_API_KEY
  });
});

/**
 * Authentication System Status
 * Returns information about which authentication mode is active
 */
export const authSystemStatus = functions.region(FUNCTION_REGION).https.onRequest(async (req, res) => {
  const db = getFirestore('neolink');

  // Check if userLookup collection exists and has data
  const lookupSnapshot = await db.collection('userLookup').limit(1).get();
  const hasLookupTable = !lookupSnapshot.empty;

  // Count entries in lookup table
  const lookupCount = hasLookupTable
    ? (await db.collection('userLookup').count().get()).data().count
    : 0;

  // Check audit logs for recent activity
  const recentAuditLogs = await db.collection('authAuditLogs')
    .orderBy('timestamp', 'desc')
    .limit(5)
    .get();

  res.json({
    status: 'ok',
    authSystem: 'ENTERPRISE_GRADE',
    version: '2.0.0',
    features: {
      bcryptHashing: true,
      bcryptRounds: 12,
      rateLimiting: {
        enabled: true,
        maxAttempts: 5,
        windowMinutes: 15,
      },
      accountLockout: {
        enabled: true,
        lockoutMinutes: 30,
      },
      auditLogging: true,
      customClaims: true,
      serverSideAuth: true,
    },
    scalability: {
      lookupTableEnabled: hasLookupTable,
      lookupTableEntries: lookupCount,
      lookupComplexity: 'O(1)',
      autoSyncTriggers: [
        'onOfficialWrite',
        'onApprovedUserWrite',
        'onInstitutionWrite',
        'onDistrictAdminWrite',
        'onSuperAdminWrite',
      ],
    },
    recentActivity: {
      auditLogsCount: recentAuditLogs.size,
      lastActivity: recentAuditLogs.docs[0]?.data()?.timestamp || null,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * Verify Authentication Mode (Callable)
 * Can be called from client to verify enterprise auth is working
 */
export const verifyAuthMode = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
  const db = getFirestore('neolink');

  // Check lookup table status
  const lookupCount = (await db.collection('userLookup').count().get()).data().count;

  // If authenticated, return user info
  let userInfo = null;
  if (context.auth) {
    userInfo = {
      uid: context.auth.uid,
      email: context.auth.token.email,
      role: context.auth.token.role,
      customClaims: {
        role: context.auth.token.role || null,
        institutionId: context.auth.token.institutionId || null,
        userID: context.auth.token.userID || null,
      },
    };
  }

  return {
    authMode: 'ENTERPRISE',
    serverSideValidation: true,
    passwordStorage: 'bcrypt_hashed',
    lookupTableStatus: lookupCount > 0 ? 'active' : 'pending_migration',
    lookupTableEntries: lookupCount,
    authenticated: !!context.auth,
    user: userInfo,
    securityFeatures: [
      'bcrypt_password_hashing',
      'server_side_authentication',
      'rate_limiting',
      'account_lockout',
      'audit_logging',
      'custom_claims_rbac',
      'o1_user_lookup',
    ],
    timestamp: new Date().toISOString(),
  };
});
