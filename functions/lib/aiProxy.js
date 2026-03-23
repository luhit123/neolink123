"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openaiProxy = exports.geminiProxy = void 0;
const functions = require("firebase-functions");
const node_fetch_1 = require("node-fetch");
const FUNCTION_REGION = 'asia-southeast1';
const getGeminiKey = () => process.env.GEMINI_API_KEY;
const getOpenAIKey = () => process.env.OPENAI_API_KEY;
/**
 * Gemini AI Proxy
 * Accepts the same payload as the Gemini REST API generateContent endpoint.
 */
exports.geminiProxy = functions
    .region(FUNCTION_REGION)
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const apiKey = getGeminiKey();
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Gemini API key not configured on server');
    }
    const model = data.model || 'gemini-2.0-flash';
    try {
        const response = await (0, node_fetch_1.default)(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: data.contents, generationConfig: data.generationConfig }),
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API error ${response.status}: ${errText}`);
        }
        return await response.json();
    }
    catch (err) {
        throw new functions.https.HttpsError('internal', err.message);
    }
});
/**
 * OpenAI Proxy
 * Accepts messages array and returns the assistant text.
 */
exports.openaiProxy = functions
    .region(FUNCTION_REGION)
    .https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const apiKey = getOpenAIKey();
    if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'OpenAI API key not configured on server');
    }
    const model = data.model || 'gpt-4o';
    const isNewerModel = model.startsWith('gpt-5') || model.startsWith('o1') || model.startsWith('o3');
    const tokenParam = isNewerModel ? 'max_completion_tokens' : 'max_tokens';
    const body = {
        model,
        messages: data.messages,
        temperature: (_a = data.temperature) !== null && _a !== void 0 ? _a : 0.3,
        [tokenParam]: (_b = data.maxTokens) !== null && _b !== void 0 ? _b : 2000,
    };
    if (data.jsonMode)
        body.response_format = { type: 'json_object' };
    try {
        const response = await (0, node_fetch_1.default)('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(((_c = err === null || err === void 0 ? void 0 : err.error) === null || _c === void 0 ? void 0 : _c.message) || `OpenAI error ${response.status}`);
        }
        const result = await response.json();
        const text = ((_g = (_f = (_e = (_d = result.choices) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.message) === null || _f === void 0 ? void 0 : _f.content) === null || _g === void 0 ? void 0 : _g.trim()) || '';
        return { text, usage: result.usage };
    }
    catch (err) {
        throw new functions.https.HttpsError('internal', err.message);
    }
});
//# sourceMappingURL=aiProxy.js.map