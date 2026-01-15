/**
 * MedGemma Service
 * Integrates with MedGemma 1.5 medical AI model via Runpod Serverless or Hugging Face
 * Provides medical-specialized text analysis, entity extraction, and clinical insights
 */

import {
  MedGemmaConfig,
  MedicalAnalysisResult,
  ClinicalEntity,
  DifferentialDiagnosis,
  AICodeSuggestion,
  AIClinicalAlert,
  PatientContext,
  ProcessingOptions,
  HuggingFaceResponse,
  ModelInfo,
  DEFAULT_MEDGEMMA_CONFIG
} from '../types/medgemma';
import { VitalSigns, ClinicalExamination, Medication } from '../types';

// Provider type
type AIProvider = 'runpod' | 'huggingface';

// Cache for API responses
interface CacheEntry {
  data: any;
  timestamp: number;
}
const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Runpod response types
interface RunpodResponse {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  output?: {
    text?: string;
    generated_text?: string;
    response?: string;
  };
  error?: string;
}

// Get configuration from environment
const getConfig = () => ({
  // Runpod settings (preferred)
  runpodApiKey: import.meta.env.VITE_RUNPOD_API_KEY || '',
  runpodEndpointId: import.meta.env.VITE_RUNPOD_ENDPOINT_ID || '',

  // Hugging Face settings (fallback)
  huggingFaceApiKey: import.meta.env.VITE_HUGGINGFACE_API_KEY || '',
  huggingFaceEndpoint: import.meta.env.VITE_MEDGEMMA_ENDPOINT || DEFAULT_MEDGEMMA_CONFIG.huggingFaceEndpoint,

  // General settings
  enableMedGemma: import.meta.env.VITE_ENABLE_MEDGEMMA !== 'false',
  timeout: 60000, // 60 seconds for Runpod
  maxTokens: 2048
});

// Determine which provider to use
const getProvider = (): AIProvider | null => {
  const config = getConfig();

  // Prefer Runpod if configured
  if (config.runpodApiKey && config.runpodEndpointId) {
    return 'runpod';
  }

  // Fall back to Hugging Face
  if (config.huggingFaceApiKey) {
    return 'huggingface';
  }

  return null;
};

// Check if MedGemma is available
let lastAvailabilityCheck: { available: boolean; provider: AIProvider | null; timestamp: number } | null = null;

export const isMedGemmaAvailable = async (): Promise<boolean> => {
  // Check cache (valid for 1 minute)
  if (lastAvailabilityCheck && Date.now() - lastAvailabilityCheck.timestamp < 60000) {
    return lastAvailabilityCheck.available;
  }

  const config = getConfig();
  if (!config.enableMedGemma) {
    lastAvailabilityCheck = { available: false, provider: null, timestamp: Date.now() };
    return false;
  }

  const provider = getProvider();
  if (!provider) {
    lastAvailabilityCheck = { available: false, provider: null, timestamp: Date.now() };
    return false;
  }

  try {
    if (provider === 'runpod') {
      // For Runpod, we just check if the endpoint exists by doing a health check
      const healthUrl = `https://api.runpod.ai/v2/${config.runpodEndpointId}/health`;
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.runpodApiKey}`
        }
      });

      const available = response.ok;
      lastAvailabilityCheck = { available, provider: 'runpod', timestamp: Date.now() };
      console.log('Runpod MedGemma health check:', available ? 'Available' : 'Unavailable');
      return available;
    } else {
      // Hugging Face check
      const response = await fetch(config.huggingFaceEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.huggingFaceApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: 'test', parameters: { max_new_tokens: 1 } })
      });

      const available = response.ok || response.status === 503;
      lastAvailabilityCheck = { available, provider: 'huggingface', timestamp: Date.now() };
      return available;
    }
  } catch (error) {
    console.warn('MedGemma availability check failed:', error);
    lastAvailabilityCheck = { available: false, provider: null, timestamp: Date.now() };
    return false;
  }
};

// Get model information
export const getModelInfo = async (): Promise<ModelInfo> => {
  const available = await isMedGemmaAvailable();
  const provider = getProvider();
  return {
    name: 'MedGemma 1.5',
    version: '4B-IT',
    provider: 'medgemma',
    isAvailable: available,
    lastChecked: new Date().toISOString(),
    endpoint: provider === 'runpod' ? 'Runpod Serverless' : 'Hugging Face'
  } as ModelInfo;
};

// Call Runpod serverless endpoint
const callRunpodAPI = async (prompt: string, maxTokens: number = 2048): Promise<string> => {
  const config = getConfig();
  const startTime = Date.now();

  // Check cache
  const cacheKey = `runpod_${hashString(prompt)}`;
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('MedGemma (Runpod): Using cached response');
    return cached.data;
  }

  if (!config.runpodApiKey || !config.runpodEndpointId) {
    throw new Error('Runpod API key or endpoint ID not configured');
  }

  const runUrl = `https://api.runpod.ai/v2/${config.runpodEndpointId}/runsync`;

  console.log('MedGemma (Runpod): Sending request...');

  const response = await fetch(runUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.runpodApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: {
        prompt: prompt,
        max_new_tokens: maxTokens,
        temperature: 0.3,
        top_p: 0.9,
        do_sample: true
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Runpod API error: ${response.status} - ${errorText}`);
  }

  const data: RunpodResponse = await response.json();

  if (data.status === 'FAILED') {
    throw new Error(`Runpod job failed: ${data.error || 'Unknown error'}`);
  }

  // Extract the result
  let result = '';
  if (data.output) {
    result = data.output.text || data.output.generated_text || data.output.response || '';
  }

  if (!result) {
    throw new Error('No response from Runpod MedGemma');
  }

  // Cache the response
  responseCache.set(cacheKey, { data: result, timestamp: Date.now() });

  console.log(`MedGemma (Runpod): Response received in ${Date.now() - startTime}ms`);
  return result;
};

// Call Hugging Face API
const callHuggingFaceAPI = async (prompt: string, maxTokens: number = 2048): Promise<string> => {
  const config = getConfig();
  const startTime = Date.now();

  // Check cache
  const cacheKey = `hf_${hashString(prompt)}`;
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('MedGemma (HF): Using cached response');
    return cached.data;
  }

  if (!config.huggingFaceApiKey) {
    throw new Error('Hugging Face API key not configured');
  }

  const response = await fetch(config.huggingFaceEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.huggingFaceApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: maxTokens,
        temperature: 0.3,
        top_p: 0.9,
        do_sample: true,
        return_full_text: false
      }
    })
  });

  if (!response.ok) {
    if (response.status === 503) {
      const data = await response.json();
      throw new Error(`Model loading. Estimated time: ${data.estimated_time || 'unknown'}s`);
    }
    throw new Error(`Hugging Face API error: ${response.status} ${response.statusText}`);
  }

  const data: HuggingFaceResponse[] | HuggingFaceResponse = await response.json();
  const result = Array.isArray(data) ? data[0]?.generated_text : data.generated_text;

  if (!result) {
    throw new Error('No response from Hugging Face MedGemma');
  }

  // Cache the response
  responseCache.set(cacheKey, { data: result, timestamp: Date.now() });

  console.log(`MedGemma (HF): Response received in ${Date.now() - startTime}ms`);
  return result;
};

// Main API call - routes to appropriate provider
const callMedGemmaAPI = async (prompt: string, maxTokens: number = 2048): Promise<string> => {
  const provider = getProvider();

  if (provider === 'runpod') {
    return callRunpodAPI(prompt, maxTokens);
  } else if (provider === 'huggingface') {
    return callHuggingFaceAPI(prompt, maxTokens);
  } else {
    throw new Error('No MedGemma provider configured. Set VITE_RUNPOD_API_KEY + VITE_RUNPOD_ENDPOINT_ID or VITE_HUGGINGFACE_API_KEY');
  }
};

// Simple hash function for cache keys
const hashString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
};

// Parse JSON from AI response (handles markdown code blocks)
const parseJSONResponse = (text: string): any => {
  // Remove markdown code blocks if present
  let cleaned = text
    .replace(/^```json?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // Find JSON object/array boundaries
  const jsonStart = cleaned.indexOf('{') !== -1 ? cleaned.indexOf('{') : cleaned.indexOf('[');
  const jsonEndObj = cleaned.lastIndexOf('}');
  const jsonEndArr = cleaned.lastIndexOf(']');
  const jsonEnd = Math.max(jsonEndObj, jsonEndArr);

  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }

  return JSON.parse(cleaned);
};

/**
 * Analyze clinical text and extract structured medical data
 */
export const analyzeClinicalText = async (
  text: string,
  context?: PatientContext,
  options?: ProcessingOptions
): Promise<MedicalAnalysisResult> => {
  const startTime = Date.now();

  const contextInfo = context
    ? `Patient: ${context.age} ${context.ageUnit} old ${context.gender}, ${context.unit}, Diagnosis: ${context.diagnosis || 'Not specified'}`
    : '';

  const prompt = `You are MedGemma, a medical AI assistant specialized in neonatal and pediatric care.

Analyze the following clinical text and extract structured medical information.
${contextInfo}

Clinical Text:
"""
${text}
"""

Extract and return a JSON object with the following structure:
{
  "extractedEntities": [
    {"text": "entity text", "type": "diagnosis|symptom|medication|procedure|anatomy|finding", "confidence": 0.0-1.0}
  ],
  "structuredData": {
    "vitals": {"temperature": "", "hr": "", "rr": "", "bp": "", "spo2": "", "crt": "", "weight": ""},
    "examination": {"cns": "", "cvs": "", "chest": "", "perAbdomen": "", "otherFindings": ""},
    "medications": [{"name": "", "dose": "", "route": "", "frequency": ""}],
    "diagnoses": [],
    "symptoms": []
  },
  "clinicalSummary": "Brief clinical summary",
  "confidence": 0.0-1.0
}

Only include fields that are mentioned in the text. Return valid JSON only.`;

  try {
    const response = await callMedGemmaAPI(prompt);
    const parsed = parseJSONResponse(response);

    return {
      ...parsed,
      processingTime: Date.now() - startTime,
      model: 'medgemma'
    };
  } catch (error) {
    console.error('MedGemma analysis failed:', error);
    throw error;
  }
};

/**
 * Extract clinical entities from text
 */
export const extractClinicalEntities = async (text: string): Promise<ClinicalEntity[]> => {
  const prompt = `Extract medical entities from this clinical text. Return JSON array only.

Text: "${text}"

Return format:
[
  {"text": "entity", "type": "diagnosis|symptom|medication|procedure|anatomy|finding", "confidence": 0.0-1.0, "normalizedTerm": "standardized term", "icd10Code": "if applicable"}
]`;

  try {
    const response = await callMedGemmaAPI(prompt, 1024);
    return parseJSONResponse(response);
  } catch (error) {
    console.error('Entity extraction failed:', error);
    return [];
  }
};

/**
 * Generate differential diagnosis suggestions
 */
export const suggestDifferentialDiagnosis = async (
  symptoms: string,
  context: PatientContext
): Promise<DifferentialDiagnosis[]> => {
  const prompt = `As a neonatal/pediatric specialist, provide differential diagnoses for:

Patient: ${context.age} ${context.ageUnit} old ${context.gender}
Unit: ${context.unit}
Current Diagnosis: ${context.diagnosis || 'Unknown'}
Presenting: ${symptoms}

Return JSON array of differential diagnoses ranked by probability:
[
  {
    "diagnosis": "Diagnosis name",
    "probability": "high|medium|low",
    "confidence": 0.0-1.0,
    "supportingFindings": ["finding1", "finding2"],
    "rulingOutFindings": ["finding1"],
    "suggestedTests": ["test1", "test2"],
    "icd10Code": "P00.0"
  }
]

Focus on neonatal/pediatric conditions. Return 3-5 most likely diagnoses.`;

  try {
    const response = await callMedGemmaAPI(prompt, 1500);
    return parseJSONResponse(response);
  } catch (error) {
    console.error('Differential diagnosis failed:', error);
    return [];
  }
};

/**
 * Suggest ICD-10 codes from clinical text
 */
export const suggestICD10Codes = async (
  clinicalText: string,
  context?: PatientContext
): Promise<AICodeSuggestion[]> => {
  const contextInfo = context
    ? `Patient: ${context.age} ${context.ageUnit}, ${context.unit}`
    : '';

  const prompt = `As a medical coding specialist, suggest ICD-10 codes for this clinical documentation.
${contextInfo}

Clinical Text:
"""
${clinicalText}
"""

Return JSON array of ICD-10 code suggestions:
[
  {
    "code": "P36.9",
    "description": "Bacterial sepsis of newborn, unspecified",
    "confidence": 0.0-1.0,
    "extractedFrom": "text that led to this code",
    "category": "Infections specific to perinatal period",
    "isPrimary": true/false
  }
]

Focus on neonatal/pediatric ICD-10 codes (P00-P96, Q00-Q99 primarily). Return up to 5 most relevant codes.`;

  try {
    const response = await callMedGemmaAPI(prompt, 1500);
    return parseJSONResponse(response);
  } catch (error) {
    console.error('ICD-10 suggestion failed:', error);
    return [];
  }
};

/**
 * Detect clinical alerts from vitals and context
 */
export const detectClinicalAlerts = async (
  vitals: VitalSigns,
  context: PatientContext
): Promise<AIClinicalAlert[]> => {
  const vitalsText = Object.entries(vitals)
    .filter(([_, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  const medicationsText = context.currentMedications?.length
    ? context.currentMedications.map(m => `${m.name} ${m.dose}`).join(', ')
    : 'None documented';

  const prompt = `As a clinical decision support system, analyze these vitals for a ${context.age} ${context.ageUnit} old ${context.gender} in ${context.unit}.

Current Vitals: ${vitalsText}
Current Diagnosis: ${context.diagnosis || 'Not specified'}
Current Medications: ${medicationsText}

Identify any clinical alerts or concerns. Return JSON array:
[
  {
    "type": "vital_abnormal|drug_interaction|deterioration|dosing_error|critical_finding|sepsis_risk|respiratory_distress",
    "severity": "info|warning|critical|emergency",
    "title": "Alert title",
    "message": "Detailed message",
    "recommendation": "Clinical recommendation",
    "affectedVitals": ["vital1"],
    "relatedMedications": ["med1"],
    "confidence": 0.0-1.0
  }
]

Use age-appropriate vital ranges. Only return genuine concerns. Return empty array if all normal.`;

  try {
    const response = await callMedGemmaAPI(prompt, 1500);
    const alerts = parseJSONResponse(response);
    return Array.isArray(alerts) ? alerts : [];
  } catch (error) {
    console.error('Alert detection failed:', error);
    return [];
  }
};

/**
 * Structure voice transcript into clinical note format
 */
export const structureVoiceTranscript = async (
  transcript: string,
  context: PatientContext
): Promise<MedicalAnalysisResult> => {
  const prompt = `Convert this voice transcript from a clinical encounter into structured clinical documentation.

Patient: ${context.age} ${context.ageUnit} old ${context.gender}, ${context.unit}
Diagnosis: ${context.diagnosis || 'Not specified'}

Voice Transcript:
"""
${transcript}
"""

Extract and return structured JSON:
{
  "structuredData": {
    "vitals": {"temperature": "", "hr": "", "rr": "", "bp": "", "spo2": "", "crt": "", "weight": ""},
    "examination": {
      "cns": "CNS findings",
      "cvs": "CVS findings",
      "chest": "Respiratory findings",
      "perAbdomen": "Abdominal findings",
      "otherFindings": "Other findings"
    },
    "medications": [{"name": "", "dose": "", "route": "", "frequency": ""}]
  },
  "clinicalSummary": "SOAP format clinical note",
  "confidence": 0.0-1.0
}

Parse numbers correctly. Use medical terminology. Only include mentioned findings.`;

  try {
    const response = await callMedGemmaAPI(prompt, 2048);
    const parsed = parseJSONResponse(response);

    return {
      extractedEntities: [],
      structuredData: parsed.structuredData || {},
      clinicalSummary: parsed.clinicalSummary,
      confidence: parsed.confidence || 0.7,
      processingTime: 0,
      model: 'medgemma'
    };
  } catch (error) {
    console.error('Voice structuring failed:', error);
    throw error;
  }
};

/**
 * Check medication interactions
 */
export const checkMedicationInteractions = async (
  medications: Medication[],
  context: PatientContext
): Promise<AIClinicalAlert[]> => {
  if (medications.length < 2) return [];

  const medList = medications.map(m => `${m.name} ${m.dose || ''} ${m.route || ''}`).join('\n');

  const prompt = `Check for drug interactions in this medication list for a ${context.age} ${context.ageUnit} old neonate/infant:

Medications:
${medList}

Current Diagnosis: ${context.diagnosis || 'Not specified'}
Weight: ${context.weight ? context.weight + ' kg' : 'Not specified'}

Return JSON array of any interactions found:
[
  {
    "type": "drug_interaction",
    "severity": "info|warning|critical",
    "title": "Drug Interaction Alert",
    "message": "Description of interaction",
    "recommendation": "Clinical recommendation",
    "relatedMedications": ["drug1", "drug2"],
    "confidence": 0.0-1.0
  }
]

Focus on neonatal-relevant interactions. Return empty array if no significant interactions.`;

  try {
    const response = await callMedGemmaAPI(prompt, 1500);
    const alerts = parseJSONResponse(response);
    return Array.isArray(alerts) ? alerts : [];
  } catch (error) {
    console.error('Medication interaction check failed:', error);
    return [];
  }
};

/**
 * Clear the response cache
 */
export const clearMedGemmaCache = (): void => {
  responseCache.clear();
  lastAvailabilityCheck = null;
  console.log('MedGemma cache cleared');
};

// Export service object for easier imports
export const medGemmaService = {
  isAvailable: isMedGemmaAvailable,
  getModelInfo,
  analyzeClinicalText,
  extractClinicalEntities,
  suggestDifferentialDiagnosis,
  suggestICD10Codes,
  detectClinicalAlerts,
  structureVoiceTranscript,
  checkMedicationInteractions,
  clearCache: clearMedGemmaCache,
  getProvider
};

export default medGemmaService;
