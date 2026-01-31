"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuthMode = exports.authSystemStatus = exports.healthCheck = exports.medAsrTranscribe = exports.onSuperAdminWrite = exports.onDistrictAdminWrite = exports.onInstitutionWrite = exports.onApprovedUserWrite = exports.onOfficialWrite = exports.migrateAllUsersToLookup = exports.autoFixPasswords = exports.initializeUserPassword = exports.getAuthAuditLogs = exports.changePassword = exports.bulkMigratePasswords = exports.migrateUserPassword = exports.authenticateUser = exports.createSecureUser = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const node_fetch_1 = require("node-fetch");
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
Object.defineProperty(exports, "autoFixPasswords", { enumerable: true, get: function () { return auth_1.autoFixPasswords; } });
// Export Scalable User Lookup Functions & Triggers
var userLookup_1 = require("./userLookup");
Object.defineProperty(exports, "migrateAllUsersToLookup", { enumerable: true, get: function () { return userLookup_1.migrateAllUsersToLookup; } });
Object.defineProperty(exports, "onOfficialWrite", { enumerable: true, get: function () { return userLookup_1.onOfficialWrite; } });
Object.defineProperty(exports, "onApprovedUserWrite", { enumerable: true, get: function () { return userLookup_1.onApprovedUserWrite; } });
Object.defineProperty(exports, "onInstitutionWrite", { enumerable: true, get: function () { return userLookup_1.onInstitutionWrite; } });
Object.defineProperty(exports, "onDistrictAdminWrite", { enumerable: true, get: function () { return userLookup_1.onDistrictAdminWrite; } });
Object.defineProperty(exports, "onSuperAdminWrite", { enumerable: true, get: function () { return userLookup_1.onSuperAdminWrite; } });
const RUNPOD_API_KEY = ((_a = functions.config().runpod) === null || _a === void 0 ? void 0 : _a.api_key) || process.env.RUNPOD_API_KEY;
const MEDASR_ENDPOINT_ID = ((_b = functions.config().runpod) === null || _b === void 0 ? void 0 : _b.medasr_endpoint) || process.env.MEDASR_ENDPOINT_ID || 'tiv2evbbzqxdkg';
const RUNPOD_BASE_URL = 'https://api.runpod.io/v2';
/**
 * MedASR Transcription - Submit audio for transcription
 */
exports.medAsrTranscribe = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
    // Verify authentication (optional but recommended)
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to use transcription');
    }
    const { audio } = data;
    if (!audio) {
        throw new functions.https.HttpsError('invalid-argument', 'Audio data is required');
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
exports.authSystemStatus = functions.region(FUNCTION_REGION).https.onRequest(async (req, res) => {
    var _a, _b;
    const db = (0, firestore_1.getFirestore)('neolink');
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
            lastActivity: ((_b = (_a = recentAuditLogs.docs[0]) === null || _a === void 0 ? void 0 : _a.data()) === null || _b === void 0 ? void 0 : _b.timestamp) || null,
        },
        timestamp: new Date().toISOString(),
    });
});
/**
 * Verify Authentication Mode (Callable)
 * Can be called from client to verify enterprise auth is working
 */
exports.verifyAuthMode = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
    const db = (0, firestore_1.getFirestore)('neolink');
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
//# sourceMappingURL=index.js.map