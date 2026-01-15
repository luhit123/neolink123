"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = exports.medAsrTranscribe = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const node_fetch_1 = require("node-fetch");
admin.initializeApp();
const RUNPOD_API_KEY = ((_a = functions.config().runpod) === null || _a === void 0 ? void 0 : _a.api_key) || process.env.RUNPOD_API_KEY;
const MEDASR_ENDPOINT_ID = ((_b = functions.config().runpod) === null || _b === void 0 ? void 0 : _b.medasr_endpoint) || process.env.MEDASR_ENDPOINT_ID || 'tiv2evbbzqxdkg';
const RUNPOD_BASE_URL = 'https://api.runpod.io/v2';
/**
 * MedASR Transcription - Submit audio for transcription
 */
exports.medAsrTranscribe = functions.https.onCall(async (data, context) => {
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
exports.healthCheck = functions.https.onRequest((req, res) => {
    res.json({
        status: 'ok',
        service: 'MedASR Proxy',
        configured: !!RUNPOD_API_KEY
    });
});
//# sourceMappingURL=index.js.map