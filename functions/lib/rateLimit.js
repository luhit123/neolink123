"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceUserRateLimit = void 0;
/**
 * Per-user rate limiting for callable Cloud Functions (AI/STT proxies, transcription).
 *
 * Without this, any authenticated account (including a self-registered one) could drive
 * the paid Gemini/OpenAI/Deepgram/RunPod APIs in a loop and run up an unbounded bill
 * (cost-DoS). This uses a simple fixed-window counter in the `rateLimits` collection.
 *
 * Design choice: it FAILS OPEN. If the limiter itself errors (e.g. transient Firestore
 * issue), we allow the request rather than block a clinician mid-task — availability of a
 * medical tool outranks perfect rate-limit enforcement.
 */
const functions = require("firebase-functions");
const firestore_1 = require("firebase-admin/firestore");
const db = (0, firestore_1.getFirestore)('neolink');
/**
 * Throws functions.https.HttpsError('resource-exhausted') when the caller has exceeded
 * `max` calls for `action` within `windowMs`. No-op (allows) on any internal error.
 */
const enforceUserRateLimit = async (uid, { action, max, windowMs }) => {
    try {
        const ref = db.collection('rateLimits').doc(`${action}_${uid}`);
        const now = Date.now();
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const data = snap.exists ? snap.data() : null;
            if (!data || !data.windowStart || now - data.windowStart > windowMs) {
                // New window
                tx.set(ref, { count: 1, windowStart: now });
                return;
            }
            if ((data.count || 0) >= max) {
                throw new functions.https.HttpsError('resource-exhausted', 'Rate limit exceeded. Please wait a moment and try again.');
            }
            tx.update(ref, { count: (data.count || 0) + 1 });
        });
    }
    catch (err) {
        // Re-throw our own rate-limit signal; swallow everything else (fail open).
        if (err instanceof functions.https.HttpsError && err.code === 'resource-exhausted') {
            throw err;
        }
        console.error(`[rateLimit] non-fatal error for ${action}/${uid}:`, err);
    }
};
exports.enforceUserRateLimit = enforceUserRateLimit;
//# sourceMappingURL=rateLimit.js.map