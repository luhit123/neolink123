import * as functions from 'firebase-functions';
import fetch from 'node-fetch';

const FUNCTION_REGION = 'asia-southeast1';

const getGeminiKey = (): string => process.env.GEMINI_API_KEY as string;
const getOpenAIKey = (): string => process.env.OPENAI_API_KEY as string;

/**
 * Gemini AI Proxy
 * Accepts the same payload as the Gemini REST API generateContent endpoint.
 */
export const geminiProxy = functions
  .region(FUNCTION_REGION)
  .https.onCall(async (data: {
    model?: string;
    contents: unknown[];
    generationConfig?: unknown;
  }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const apiKey = getGeminiKey();
    if (!apiKey) {
      throw new functions.https.HttpsError('failed-precondition', 'Gemini API key not configured on server');
    }

    const model = data.model || 'gemini-2.0-flash';

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: data.contents, generationConfig: data.generationConfig }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errText}`);
      }

      return await response.json();
    } catch (err: any) {
      throw new functions.https.HttpsError('internal', err.message);
    }
  });

/**
 * OpenAI Proxy
 * Accepts messages array and returns the assistant text.
 */
export const openaiProxy = functions
  .region(FUNCTION_REGION)
  .https.onCall(async (data: {
    model?: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  }, context) => {
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

    const body: Record<string, unknown> = {
      model,
      messages: data.messages,
      temperature: data.temperature ?? 0.3,
      [tokenParam]: data.maxTokens ?? 2000,
    };
    if (data.jsonMode) body.response_format = { type: 'json_object' };

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err: any = await response.json();
        throw new Error(err?.error?.message || `OpenAI error ${response.status}`);
      }

      const result: any = await response.json();
      const text: string = result.choices?.[0]?.message?.content?.trim() || '';
      return { text, usage: result.usage };
    } catch (err: any) {
      throw new functions.https.HttpsError('internal', err.message);
    }
  });
