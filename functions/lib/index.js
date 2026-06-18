"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuthMode = exports.getElevenLabsStreamKey = exports.getDeepgramStreamKey = exports.elevenLabsTranscribe = exports.deepgramTranscribe = exports.openaiProxy = exports.geminiProxy = exports.authSystemStatus = exports.healthCheck = exports.medAsrTranscribe = exports.onSuperAdminWrite = exports.onDistrictAdminWrite = exports.onInstitutionWrite = exports.onApprovedUserWrite = exports.onOfficialWrite = exports.migrateAllUsersToLookup = exports.initializeUserPassword = exports.getAuthAuditLogs = exports.changePassword = exports.bulkMigratePasswords = exports.migrateUserPassword = exports.authenticateUser = exports.createSecureUser = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const node_fetch_1 = require("node-fetch");
const rateLimit_1 = require("./rateLimit");
// Initialize Firebase Admin
admin.initializeApp();
// ============================================================================
// REGION CONFIGURATION - MUST MATCH CLIENT (firebaseConfig.ts)
// ============================================================================
const FUNCTION_REGION = 'asia-southeast1'; // Singapore - matches database region
// Export Enterprise Authentication Functions
var auth_1 = require("./auth");
Object.defineProperty(exports, "createSecureUser", { enumerable: true, get: function () { return auth_1.createSecureUser; } });
Object.defineProperty(exports, "authenticateUser", { enumerable: true, get: function () { return auth_1.authenticateUser; } });
Object.defineProperty(exports, "migrateUserPassword", { enumerable: true, get: function () { return auth_1.migrateUserPassword; } });
Object.defineProperty(exports, "bulkMigratePasswords", { enumerable: true, get: function () { return auth_1.bulkMigratePasswords; } });
Object.defineProperty(exports, "changePassword", { enumerable: true, get: function () { return auth_1.changePassword; } });
Object.defineProperty(exports, "getAuthAuditLogs", { enumerable: true, get: function () { return auth_1.getAuthAuditLogs; } });
Object.defineProperty(exports, "initializeUserPassword", { enumerable: true, get: function () { return auth_1.initializeUserPassword; } });
// SECURITY: `autoFixPasswords` and `syncUsersToFirebaseAuth` were unauthenticated
// onRequest endpoints that could set/reset credentials for any account (including
// SuperAdmins) — a full account-takeover vector. They have been removed. One-off
// migrations must be run locally via the Admin SDK, never exposed as a deployed HTTP endpoint.
// Export Scalable User Lookup Functions & Triggers
var userLookup_1 = require("./userLookup");
Object.defineProperty(exports, "migrateAllUsersToLookup", { enumerable: true, get: function () { return userLookup_1.migrateAllUsersToLookup; } });
Object.defineProperty(exports, "onOfficialWrite", { enumerable: true, get: function () { return userLookup_1.onOfficialWrite; } });
Object.defineProperty(exports, "onApprovedUserWrite", { enumerable: true, get: function () { return userLookup_1.onApprovedUserWrite; } });
Object.defineProperty(exports, "onInstitutionWrite", { enumerable: true, get: function () { return userLookup_1.onInstitutionWrite; } });
Object.defineProperty(exports, "onDistrictAdminWrite", { enumerable: true, get: function () { return userLookup_1.onDistrictAdminWrite; } });
Object.defineProperty(exports, "onSuperAdminWrite", { enumerable: true, get: function () { return userLookup_1.onSuperAdminWrite; } });
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const MEDASR_ENDPOINT_ID = process.env.MEDASR_ENDPOINT_ID || 'tiv2evbbzqxdkg';
const RUNPOD_BASE_URL = 'https://api.runpod.io/v2';
/**
 * MedASR Transcription - Submit audio for transcription
 */
exports.medAsrTranscribe = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to use transcription');
    }
    // Limit paid transcription calls per user (cost-DoS protection).
    await (0, rateLimit_1.enforceUserRateLimit)(context.auth.uid, { action: 'medAsrTranscribe', max: 60, windowMs: 60000 });
    const { audio } = data;
    if (!audio || typeof audio !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Audio data is required');
    }
    // ~35 MB of base64 ≈ 25 MB of audio.
    if (audio.length > 35 * 1024 * 1024) {
        throw new functions.https.HttpsError('invalid-argument', 'Audio payload too large');
    }
    if (!RUNPOD_API_KEY) {
        throw new functions.https.HttpsError('failed-precondition', 'RunPod API key not configured');
    }
    try {
        // Submit job to RunPod
        const submitResponse = await (0, node_fetch_1.default)(`${RUNPOD_BASE_URL}/${MEDASR_ENDPOINT_ID}/run`, {
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
        const jobData = await submitResponse.json();
        const jobId = jobData.id;
        console.log(`MedASR job submitted: ${jobId}`);
        // Poll for completion (max 2 minutes)
        const maxWaitMs = 120000;
        const pollIntervalMs = 2000;
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitMs) {
            const statusResponse = await (0, node_fetch_1.default)(`${RUNPOD_BASE_URL}/${MEDASR_ENDPOINT_ID}/status/${jobId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${RUNPOD_API_KEY}`,
                }
            });
            if (!statusResponse.ok) {
                throw new Error(`Status check failed: ${statusResponse.status}`);
            }
            const statusData = await statusResponse.json();
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
    }
    catch (error) {
        console.error('MedASR error:', error);
        throw new functions.https.HttpsError('internal', `Transcription failed: ${error.message}`);
    }
});
/**
 * Health check endpoint
 */
exports.healthCheck = functions.region(FUNCTION_REGION).https.onRequest((req, res) => {
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
exports.authSystemStatus = functions.region(FUNCTION_REGION).https.onRequest(async (req, res) => {
    res.json({ status: 'ok' });
});
// Export AI Proxy Functions
var aiProxy_1 = require("./aiProxy");
Object.defineProperty(exports, "geminiProxy", { enumerable: true, get: function () { return aiProxy_1.geminiProxy; } });
Object.defineProperty(exports, "openaiProxy", { enumerable: true, get: function () { return aiProxy_1.openaiProxy; } });
// Export STT Proxy Functions
var sttProxy_1 = require("./sttProxy");
Object.defineProperty(exports, "deepgramTranscribe", { enumerable: true, get: function () { return sttProxy_1.deepgramTranscribe; } });
Object.defineProperty(exports, "elevenLabsTranscribe", { enumerable: true, get: function () { return sttProxy_1.elevenLabsTranscribe; } });
Object.defineProperty(exports, "getDeepgramStreamKey", { enumerable: true, get: function () { return sttProxy_1.getDeepgramStreamKey; } });
Object.defineProperty(exports, "getElevenLabsStreamKey", { enumerable: true, get: function () { return sttProxy_1.getElevenLabsStreamKey; } });
/**
 * Verify Authentication Mode (Callable)
 * Can be called from client to verify enterprise auth is working
 */
exports.verifyAuthMode = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
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
//# sourceMappingURL=index.js.map