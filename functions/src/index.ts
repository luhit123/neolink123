import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import { enforceUserRateLimit } from './rateLimit';

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
} from './auth';
// SECURITY: `autoFixPasswords` and `syncUsersToFirebaseAuth` were unauthenticated
// onRequest endpoints that could set/reset credentials for any account (including
// SuperAdmins) — a full account-takeover vector. They have been removed. One-off
// migrations must be run locally via the Admin SDK, never exposed as a deployed HTTP endpoint.

// Export Scalable User Lookup Functions & Triggers
export {
  migrateAllUsersToLookup,
  onOfficialWrite,
  onApprovedUserWrite,
  onInstitutionWrite,
  onDistrictAdminWrite,
  onSuperAdminWrite,
} from './userLookup';

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const MEDASR_ENDPOINT_ID = process.env.MEDASR_ENDPOINT_ID || 'tiv2evbbzqxdkg';
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
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to use transcription'
    );
  }

  // Limit paid transcription calls per user (cost-DoS protection).
  await enforceUserRateLimit(context.auth.uid, { action: 'medAsrTranscribe', max: 60, windowMs: 60_000 });

  const { audio } = data;

  if (!audio || typeof audio !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Audio data is required'
    );
  }

  // ~35 MB of base64 ≈ 25 MB of audio.
  if (audio.length > 35 * 1024 * 1024) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Audio payload too large'
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
  // SECURITY: do not disclose whether secrets are configured or any internal state
  // to unauthenticated callers.
  res.json({ status: 'ok' });
});

/**
 * Authentication System Status
 * Lightweight liveness probe. Previously this UNAUTHENTICATED endpoint leaked
 * internal config (bcrypt rounds, rate-limit thresholds, lookup-table size, and
 * the timestamp of the last auth activity) to anyone on the internet — useful
 * reconnaissance for an attacker. It now returns only liveness.
 */
export const authSystemStatus = functions.region(FUNCTION_REGION).https.onRequest(async (req, res) => {
  res.json({ status: 'ok' });
});

// Export AI Proxy Functions
export { geminiProxy, openaiProxy } from './aiProxy';

// Export STT Proxy Functions
export {
  deepgramTranscribe,
  elevenLabsTranscribe,
  getDeepgramStreamKey,
  getElevenLabsStreamKey,
} from './sttProxy';

/**
 * Verify Authentication Mode (Callable)
 * Can be called from client to verify enterprise auth is working
 */
export const verifyAuthMode = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
  // SECURITY: only reflect the CALLER's own claims; require authentication and do
  // not disclose lookup-table size or other internal counts to arbitrary callers.
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  return {
    authMode: 'ENTERPRISE',
    authenticated: true,
    user: {
      uid: context.auth.uid,
      email: context.auth.token.email,
      role: context.auth.token.role || null,
      customClaims: {
        role: context.auth.token.role || null,
        institutionId: context.auth.token.institutionId || null,
        userID: context.auth.token.userID || null,
      },
    },
  };
});
