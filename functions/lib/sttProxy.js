"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getElevenLabsStreamKey = exports.getDeepgramStreamKey = exports.elevenLabsTranscribe = exports.deepgramTranscribe = void 0;
const functions = require("firebase-functions");
const node_fetch_1 = require("node-fetch");
const FormData = require("form-data");
const rateLimit_1 = require("./rateLimit");
const FUNCTION_REGION = 'asia-southeast1';
// ~35 MB of base64 ≈ 25 MB of audio; reject anything larger up front.
const MAX_AUDIO_BASE64_LEN = 35 * 1024 * 1024;
const getDeepgramKey = () => process.env.DEEPGRAM_API_KEY;
const getElevenLabsKey = () => process.env.ELEVENLABS_API_KEY;
/**
 * Deepgram Batch Transcription Proxy
 */
exports.deepgramTranscribe = functions
    .region(FUNCTION_REGION)
    .runWith({ timeoutSeconds: 120, memory: '256MB' })
    .https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    await (0, rateLimit_1.enforceUserRateLimit)(context.auth.uid, { action: 'deepgramTranscribe', max: 120, windowMs: 60000 });
    const apiKey = getDeepgramKey();
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Deepgram API key not configured on server');
    }
    if (!data.audioBase64 || typeof data.audioBase64 !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'audioBase64 is required');
    }
    if (data.audioBase64.length > MAX_AUDIO_BASE64_LEN) {
        throw new functions.https.HttpsError('invalid-argument', 'Audio payload too large');
    }
    const audioBuffer = Buffer.from(data.audioBase64, 'base64');
    const mimeType = data.mimeType || 'audio/webm';
    // SECURITY: client-supplied keywords are interpolated into the upstream request
    // URL. Filter to a safe charset and URL-encode each value to prevent query/param
    // injection into the Deepgram API call.
    const kw = (data.keywords || [])
        .filter((k) => typeof k === 'string')
        .map((k) => k.replace(/[^\w \-]/g, '').trim())
        .filter((k) => k.length > 0 && k.length <= 50)
        .slice(0, 100);
    const params = new URLSearchParams({
        model: 'nova-2-medical',
        smart_format: 'true',
        punctuate: 'true',
        numerals: 'true',
        language: 'en',
    });
    for (const k of kw)
        params.append('keywords', k);
    const url = `https://api.deepgram.com/v1/listen?${params.toString()}`;
    try {
        const response = await (0, node_fetch_1.default)(url, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${apiKey}`,
                'Content-Type': mimeType,
            },
            body: audioBuffer,
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Deepgram error ${response.status}: ${errText}`);
        }
        const result = await response.json();
        const transcript = ((_e = (_d = (_c = (_b = (_a = result.results) === null || _a === void 0 ? void 0 : _a.channels) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.alternatives) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.transcript) || '';
        return { transcript };
    }
    catch (err) {
        throw new functions.https.HttpsError('internal', err.message);
    }
});
/**
 * ElevenLabs Batch Transcription Proxy
 */
exports.elevenLabsTranscribe = functions
    .region(FUNCTION_REGION)
    .runWith({ timeoutSeconds: 120, memory: '256MB' })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    await (0, rateLimit_1.enforceUserRateLimit)(context.auth.uid, { action: 'elevenLabsTranscribe', max: 120, windowMs: 60000 });
    const apiKey = getElevenLabsKey();
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'ElevenLabs API key not configured on server');
    }
    if (!data.audioBase64 || typeof data.audioBase64 !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'audioBase64 is required');
    }
    if (data.audioBase64.length > MAX_AUDIO_BASE64_LEN) {
        throw new functions.https.HttpsError('invalid-argument', 'Audio payload too large');
    }
    const audioBuffer = Buffer.from(data.audioBase64, 'base64');
    const mimeType = data.mimeType || 'audio/webm';
    const filename = mimeType.includes('wav') ? 'recording.wav' : 'recording.webm';
    const formData = new FormData();
    formData.append('file', audioBuffer, { filename, contentType: mimeType });
    formData.append('model_id', 'scribe_v1');
    formData.append('language_code', 'en');
    formData.append('diarize', 'false');
    formData.append('tag_audio_events', 'false');
    formData.append('timestamps_granularity', 'none');
    try {
        const response = await (0, node_fetch_1.default)('https://api.elevenlabs.io/v1/speech-to-text', {
            method: 'POST',
            headers: Object.assign({ 'xi-api-key': apiKey }, formData.getHeaders()),
            body: formData,
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`ElevenLabs error ${response.status}: ${errText}`);
        }
        const result = await response.json();
        const transcript = result.text ||
            result.transcription ||
            (result.chunks || []).map((c) => c.text || '').join(' ') ||
            '';
        return { transcript };
    }
    catch (err) {
        throw new functions.https.HttpsError('internal', err.message);
    }
});
/**
 * Get Deepgram streaming key (for live WebSocket connections)
 * The key is fetched server-side so it is never bundled in the client.
 */
exports.getDeepgramStreamKey = functions
    .region(FUNCTION_REGION)
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const apiKey = getDeepgramKey();
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Deepgram API key not configured on server');
    }
    return { key: apiKey, expiresAt: Date.now() + 3600000 };
});
/**
 * Get ElevenLabs streaming key (for live WebSocket connections)
 */
exports.getElevenLabsStreamKey = functions
    .region(FUNCTION_REGION)
    .https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const apiKey = getElevenLabsKey();
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'ElevenLabs API key not configured on server');
    }
    return { key: apiKey, expiresAt: Date.now() + 3600000 };
});
//# sourceMappingURL=sttProxy.js.map