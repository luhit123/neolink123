/**
 * Clinical Note AI Service
 * Supports both Google Gemini and OpenAI GPT-4o for clinical note generation
 * Provider can be configured by super admin (no automatic fallback)
 */

import { GoogleGenAI } from '@google/genai';
import { db } from '../firebaseConfig';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

// AI Provider types
export type ClinicalNoteAIProvider = 'gemini' | 'gpt4o';

export interface ClinicalNoteAIConfig {
  provider: ClinicalNoteAIProvider;
  updatedAt: string;
  updatedBy: string;
}

// Default configuration
const DEFAULT_CONFIG: ClinicalNoteAIConfig = {
  provider: 'gpt4o', // GPT-4o as default
  updatedAt: new Date().toISOString(),
  updatedBy: 'system'
};

// Cached configuration
let cachedConfig: ClinicalNoteAIConfig = { ...DEFAULT_CONFIG };
let configListenerUnsubscribe: (() => void) | null = null;

// API Keys
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// Debug: Log API key availability on load
console.log('🔑 Clinical Note AI Service loaded');
console.log('🔑 OpenAI API Key available:', !!OPENAI_API_KEY);
console.log('🔑 Gemini API Key available:', !!GEMINI_API_KEY);

// Gemini instance
let geminiAI: GoogleGenAI | null = null;
if (GEMINI_API_KEY) {
  geminiAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

/**
 * Initialize the config listener
 */
export const initClinicalNoteAIConfig = () => {
  if (configListenerUnsubscribe) return; // Already initialized

  const configRef = doc(db, 'globalConfig', 'clinicalNoteAI');

  configListenerUnsubscribe = onSnapshot(configRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data() as ClinicalNoteAIConfig;
      console.log('📥 Firestore config loaded:', JSON.stringify(data));
      cachedConfig = data;
      console.log('📥 Cached config now:', cachedConfig.provider);
    } else {
      // Create default config if it doesn't exist
      console.log('📥 No Firestore config found, creating default with GPT-4o');
      setDoc(configRef, DEFAULT_CONFIG).catch(console.error);
      cachedConfig = { ...DEFAULT_CONFIG };
    }
  }, (error) => {
    console.error('Error listening to clinical note AI config:', error);
  });
};

/**
 * Get current AI provider configuration
 */
export const getClinicalNoteAIConfig = async (): Promise<ClinicalNoteAIConfig> => {
  try {
    const configRef = doc(db, 'globalConfig', 'clinicalNoteAI');
    const docSnap = await getDoc(configRef);

    if (docSnap.exists()) {
      return docSnap.data() as ClinicalNoteAIConfig;
    }

    // Create default config if it doesn't exist
    await setDoc(configRef, DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  } catch (error) {
    console.error('Error getting clinical note AI config:', error);
    return cachedConfig;
  }
};

/**
 * Update AI provider configuration (Super Admin only)
 */
export const updateClinicalNoteAIConfig = async (
  provider: ClinicalNoteAIProvider,
  updatedBy: string
): Promise<void> => {
  const configRef = doc(db, 'globalConfig', 'clinicalNoteAI');
  const config: ClinicalNoteAIConfig = {
    provider,
    updatedAt: new Date().toISOString(),
    updatedBy
  };

  await setDoc(configRef, config);
  cachedConfig = config;
  console.log(`Clinical Note AI provider updated to: ${provider} by ${updatedBy}`);
};

/**
 * Get current cached provider
 */
export const getCurrentProvider = (): ClinicalNoteAIProvider => {
  return cachedConfig.provider;
};

/**
 * Generate clinical note using the configured AI provider
 */
export const generateClinicalNote = async (prompt: string): Promise<string> => {
  const provider = cachedConfig.provider;

  console.log('🤖 ========== CLINICAL NOTE AI ==========');
  console.log('🤖 Current cached provider:', provider);
  console.log('🤖 Full cached config:', JSON.stringify(cachedConfig));

  if (provider === 'gpt4o') {
    console.log('🤖 Using GPT-5.2 for generation');
    return generateWithGPT4o(prompt);
  } else {
    console.log('🤖 Using Gemini for generation');
    return generateWithGemini(prompt);
  }
};

/**
 * Generate clinical note using OpenAI GPT-5.2
 */
const generateWithGPT4o = async (prompt: string): Promise<string> => {
  console.log('🟢 GPT-5.2: Starting generation...');
  console.log('🟢 GPT-5.2: API Key exists:', !!OPENAI_API_KEY);

  if (!OPENAI_API_KEY) {
    console.error('🔴 GPT-5.2: API key not configured!');
    throw new Error('OpenAI API key not configured');
  }

  console.log('🟢 GPT-5.2: Making API request to OpenAI...');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'system',
          content: 'You are an expert NICU/PICU intensivist creating clinical documentation. Follow the exact format and instructions provided. Do not use markdown formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_completion_tokens: 4000
    })
  });

  console.log('🟢 GPT-5.2: Response status:', response.status);

  if (!response.ok) {
    const error = await response.json();
    console.error('🔴 GPT-5.2 API error:', error);
    throw new Error(error.error?.message || 'GPT-5.2 API request failed');
  }

  const data = await response.json();
  console.log('🟢 GPT-5.2: Response received, model used:', data.model);
  console.log('🟢 GPT-5.2: Tokens used:', data.usage);

  const noteText = data.choices?.[0]?.message?.content?.trim();

  if (!noteText) {
    throw new Error('Empty response from GPT-5.2');
  }

  console.log('🟢 GPT-5.2: Generated note length:', noteText.length, 'characters');
  return noteText;
};

/**
 * Generate clinical note using Google Gemini
 */
const generateWithGemini = async (prompt: string): Promise<string> => {
  if (!geminiAI) {
    throw new Error('Gemini AI not initialized - API key missing');
  }

  const response = await geminiAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });
  const noteText = response.text?.trim();

  if (!noteText) {
    throw new Error('Empty response from Gemini');
  }

  console.log('Gemini generated note, length:', noteText.length);
  return noteText;
};

/**
 * Check if AI providers are available
 */
export const checkAIProviderAvailability = (): { gemini: boolean; gpt4o: boolean } => {
  return {
    gemini: !!GEMINI_API_KEY,
    gpt4o: !!OPENAI_API_KEY
  };
};

// Initialize on import
initClinicalNoteAIConfig();

export default {
  initConfig: initClinicalNoteAIConfig,
  getConfig: getClinicalNoteAIConfig,
  updateConfig: updateClinicalNoteAIConfig,
  getCurrentProvider,
  generateNote: generateClinicalNote,
  checkAvailability: checkAIProviderAvailability
};
