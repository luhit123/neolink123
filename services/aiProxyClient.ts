/**
 * AI Proxy Client
 *
 * All AI API calls go through Firebase Cloud Functions so that
 * API keys are never exposed in the client bundle.
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebaseConfig';

const FUNCTION_REGION = 'asia-southeast1';
let _fnInstance: ReturnType<typeof getFunctions> | null = null;

const getFnInstance = () => {
  if (!_fnInstance) {
    _fnInstance = getFunctions(app, FUNCTION_REGION);
  }
  return _fnInstance;
};

// ── Gemini ────────────────────────────────────────────────────────────────────
export const callGeminiProxy = async (payload: {
  model?: string;
  contents: unknown[];
  generationConfig?: unknown;
}): Promise<any> => {
  const fn = httpsCallable(getFnInstance(), 'geminiProxy');
  const result = await fn(payload);
  return result.data;
};

// ── OpenAI ────────────────────────────────────────────────────────────────────
export const callOpenAIProxy = async (payload: {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}): Promise<{ text: string; usage?: unknown }> => {
  const fn = httpsCallable(getFnInstance(), 'openaiProxy');
  const result = await fn(payload);
  return result.data as { text: string; usage?: unknown };
};

// ── Deepgram Batch ────────────────────────────────────────────────────────────
export const callDeepgramTranscribe = async (payload: {
  audioBase64: string;
  mimeType?: string;
  keywords?: string[];
}): Promise<{ transcript: string }> => {
  const fn = httpsCallable(getFnInstance(), 'deepgramTranscribe');
  const result = await fn(payload);
  return result.data as { transcript: string };
};

// ── ElevenLabs Batch ──────────────────────────────────────────────────────────
export const callElevenLabsTranscribe = async (payload: {
  audioBase64: string;
  mimeType?: string;
}): Promise<{ transcript: string }> => {
  const fn = httpsCallable(getFnInstance(), 'elevenLabsTranscribe');
  const result = await fn(payload);
  return result.data as { transcript: string };
};

// ── Streaming Tokens ──────────────────────────────────────────────────────────
export const getDeepgramStreamKey = async (): Promise<{ key: string; expiresAt: number }> => {
  const fn = httpsCallable(getFnInstance(), 'getDeepgramStreamKey');
  const result = await fn({});
  return result.data as { key: string; expiresAt: number };
};

export const getElevenLabsStreamKey = async (): Promise<{ key: string; expiresAt: number }> => {
  const fn = httpsCallable(getFnInstance(), 'getElevenLabsStreamKey');
  const result = await fn({});
  return result.data as { key: string; expiresAt: number };
};
