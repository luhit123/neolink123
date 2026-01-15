/**
 * AI Provider Service
 * Unified AI provider that intelligently routes between MedGemma and Gemini
 * Provides automatic fallback when primary provider is unavailable
 */

import {
  MedicalAnalysisResult,
  ClinicalEntity,
  DifferentialDiagnosis,
  AICodeSuggestion,
  AIClinicalAlert,
  PatientContext,
  ProcessingOptions,
  ModelInfo
} from '../types/medgemma';
import { VitalSigns, Medication, Patient } from '../types';
import medGemmaService from './medGemmaService';
import {
  structureProgressNote,
  getClinicalInsights,
  predictRisk,
  checkDrugInteractions as geminiCheckDrugInteractions,
  generateDifferentialDiagnosis as geminiDifferentialDiagnosis
} from './geminiService';

// Provider preference
type AIProvider = 'medgemma' | 'gemini' | 'auto';

interface AIProviderConfig {
  preferredProvider: AIProvider;
  enableFallback: boolean;
  logProviderUsage: boolean;
}

const defaultConfig: AIProviderConfig = {
  preferredProvider: 'auto', // Auto will try MedGemma first for medical tasks
  enableFallback: true,
  logProviderUsage: true
};

let currentConfig = { ...defaultConfig };

// Provider usage statistics
interface ProviderStats {
  medgemmaRequests: number;
  medgemmaSuccesses: number;
  medgemmaFailures: number;
  geminiRequests: number;
  geminiSuccesses: number;
  geminiFailures: number;
  fallbackCount: number;
}

const stats: ProviderStats = {
  medgemmaRequests: 0,
  medgemmaSuccesses: 0,
  medgemmaFailures: 0,
  geminiRequests: 0,
  geminiSuccesses: 0,
  geminiFailures: 0,
  fallbackCount: 0
};

// Log provider usage
const logUsage = (provider: 'medgemma' | 'gemini', success: boolean, fallback: boolean = false) => {
  if (!currentConfig.logProviderUsage) return;

  if (provider === 'medgemma') {
    stats.medgemmaRequests++;
    if (success) stats.medgemmaSuccesses++;
    else stats.medgemmaFailures++;
  } else {
    stats.geminiRequests++;
    if (success) stats.geminiSuccesses++;
    else stats.geminiFailures++;
  }

  if (fallback) stats.fallbackCount++;
};

/**
 * Configure the AI provider service
 */
export const configureAIProvider = (config: Partial<AIProviderConfig>): void => {
  currentConfig = { ...currentConfig, ...config };
  console.log('AI Provider configured:', currentConfig);
};

/**
 * Get current provider statistics
 */
export const getProviderStats = (): ProviderStats => ({ ...stats });

/**
 * Get information about available AI models
 */
export const getAvailableModels = async (): Promise<ModelInfo[]> => {
  const models: ModelInfo[] = [];

  // Check MedGemma
  try {
    const medGemmaInfo = await medGemmaService.getModelInfo();
    models.push(medGemmaInfo);
  } catch (error) {
    models.push({
      name: 'MedGemma 1.5',
      version: '4B-IT',
      provider: 'medgemma',
      isAvailable: false,
      lastChecked: new Date().toISOString()
    });
  }

  // Gemini is always available if API key exists
  models.push({
    name: 'Gemini 2.5 Flash',
    version: 'flash',
    provider: 'gemini',
    isAvailable: !!import.meta.env.VITE_GEMINI_API_KEY,
    lastChecked: new Date().toISOString()
  });

  return models;
};

/**
 * Analyze clinical text with automatic provider selection
 */
export const analyzeClinicalText = async (
  text: string,
  context?: PatientContext,
  options?: ProcessingOptions
): Promise<MedicalAnalysisResult> => {
  const shouldUseMedGemma = currentConfig.preferredProvider === 'medgemma' ||
    (currentConfig.preferredProvider === 'auto' && await medGemmaService.isAvailable());

  // Try MedGemma first for medical tasks
  if (shouldUseMedGemma) {
    try {
      const result = await medGemmaService.analyzeClinicalText(text, context, options);
      logUsage('medgemma', true);
      return result;
    } catch (error) {
      console.warn('MedGemma failed, falling back to Gemini:', error);
      logUsage('medgemma', false);

      if (!currentConfig.enableFallback) throw error;
    }
  }

  // Fallback to Gemini
  try {
    const geminiResult = await structureProgressNote(text);
    logUsage('gemini', true, shouldUseMedGemma);

    return {
      extractedEntities: [],
      structuredData: {},
      clinicalSummary: geminiResult,
      confidence: 0.7,
      processingTime: 0,
      model: 'gemini'
    };
  } catch (error) {
    logUsage('gemini', false);
    throw new Error('Both AI providers failed. Please try again later.');
  }
};

/**
 * Extract clinical entities from text
 */
export const extractClinicalEntities = async (text: string): Promise<ClinicalEntity[]> => {
  const shouldUseMedGemma = currentConfig.preferredProvider !== 'gemini' &&
    await medGemmaService.isAvailable();

  if (shouldUseMedGemma) {
    try {
      const result = await medGemmaService.extractClinicalEntities(text);
      logUsage('medgemma', true);
      return result;
    } catch (error) {
      console.warn('MedGemma entity extraction failed:', error);
      logUsage('medgemma', false);
      if (!currentConfig.enableFallback) throw error;
    }
  }

  // No direct Gemini equivalent, return empty
  return [];
};

/**
 * Suggest differential diagnoses
 */
export const suggestDifferentialDiagnosis = async (
  symptoms: string,
  context: PatientContext
): Promise<DifferentialDiagnosis[]> => {
  const shouldUseMedGemma = currentConfig.preferredProvider !== 'gemini' &&
    await medGemmaService.isAvailable();

  if (shouldUseMedGemma) {
    try {
      const result = await medGemmaService.suggestDifferentialDiagnosis(symptoms, context);
      logUsage('medgemma', true);
      return result;
    } catch (error) {
      console.warn('MedGemma differential diagnosis failed:', error);
      logUsage('medgemma', false);
      if (!currentConfig.enableFallback) throw error;
    }
  }

  // Fallback to Gemini
  try {
    const geminiResult = await geminiDifferentialDiagnosis(
      symptoms,
      context.age,
      context.ageUnit,
      context.unit
    );
    logUsage('gemini', true, shouldUseMedGemma);

    // Parse Gemini response into our format
    return [{
      diagnosis: geminiResult.split('\n')[0] || 'Unable to determine',
      probability: 'medium',
      confidence: 0.6,
      supportingFindings: [symptoms],
      suggestedTests: []
    }];
  } catch (error) {
    logUsage('gemini', false);
    return [];
  }
};

/**
 * Suggest ICD-10 codes from clinical documentation
 */
export const suggestICD10Codes = async (
  clinicalText: string,
  context?: PatientContext
): Promise<AICodeSuggestion[]> => {
  const shouldUseMedGemma = currentConfig.preferredProvider !== 'gemini' &&
    await medGemmaService.isAvailable();

  if (shouldUseMedGemma) {
    try {
      const result = await medGemmaService.suggestICD10Codes(clinicalText, context);
      logUsage('medgemma', true);
      return result;
    } catch (error) {
      console.warn('MedGemma ICD-10 suggestion failed:', error);
      logUsage('medgemma', false);
    }
  }

  // No direct Gemini fallback for ICD-10
  return [];
};

/**
 * Detect clinical alerts from vitals and patient context
 */
export const detectClinicalAlerts = async (
  vitals: VitalSigns,
  context: PatientContext
): Promise<AIClinicalAlert[]> => {
  const shouldUseMedGemma = currentConfig.preferredProvider !== 'gemini' &&
    await medGemmaService.isAvailable();

  if (shouldUseMedGemma) {
    try {
      const result = await medGemmaService.detectClinicalAlerts(vitals, context);
      logUsage('medgemma', true);
      return result;
    } catch (error) {
      console.warn('MedGemma alert detection failed:', error);
      logUsage('medgemma', false);
      if (!currentConfig.enableFallback) throw error;
    }
  }

  // Fallback to Gemini
  try {
    const patient = {
      age: context.age,
      ageUnit: context.ageUnit,
      gender: context.gender,
      diagnosis: context.diagnosis || '',
      unit: context.unit
    } as Patient;

    const riskResult = await predictRisk(patient);
    logUsage('gemini', true, shouldUseMedGemma);

    // Convert Gemini risk assessment to alert format
    if (riskResult.riskLevel === 'High') {
      return [{
        type: 'deterioration',
        severity: 'warning',
        title: 'Risk Assessment Alert',
        message: riskResult.justification,
        confidence: 0.6
      }];
    }

    return [];
  } catch (error) {
    logUsage('gemini', false);
    return [];
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

  const shouldUseMedGemma = currentConfig.preferredProvider !== 'gemini' &&
    await medGemmaService.isAvailable();

  if (shouldUseMedGemma) {
    try {
      const result = await medGemmaService.checkMedicationInteractions(medications, context);
      logUsage('medgemma', true);
      return result;
    } catch (error) {
      console.warn('MedGemma drug interaction check failed:', error);
      logUsage('medgemma', false);
      if (!currentConfig.enableFallback) throw error;
    }
  }

  // Fallback to Gemini
  try {
    const medNames = medications.map(m => m.name);
    const geminiResult = await geminiCheckDrugInteractions(medNames, [context.diagnosis || '']);
    logUsage('gemini', true, shouldUseMedGemma);

    if (geminiResult && !geminiResult.includes('No significant')) {
      return [{
        type: 'drug_interaction',
        severity: 'warning',
        title: 'Potential Drug Interaction',
        message: geminiResult,
        relatedMedications: medNames,
        confidence: 0.6
      }];
    }

    return [];
  } catch (error) {
    logUsage('gemini', false);
    return [];
  }
};

/**
 * Structure voice transcript into clinical note
 */
export const structureVoiceTranscript = async (
  transcript: string,
  context: PatientContext
): Promise<MedicalAnalysisResult> => {
  const shouldUseMedGemma = currentConfig.preferredProvider !== 'gemini' &&
    await medGemmaService.isAvailable();

  if (shouldUseMedGemma) {
    try {
      const result = await medGemmaService.structureVoiceTranscript(transcript, context);
      logUsage('medgemma', true);
      return result;
    } catch (error) {
      console.warn('MedGemma voice structuring failed:', error);
      logUsage('medgemma', false);
      if (!currentConfig.enableFallback) throw error;
    }
  }

  // Fallback to Gemini
  try {
    const geminiResult = await structureProgressNote(transcript);
    logUsage('gemini', true, shouldUseMedGemma);

    return {
      extractedEntities: [],
      structuredData: {},
      clinicalSummary: geminiResult,
      confidence: 0.6,
      processingTime: 0,
      model: 'gemini'
    };
  } catch (error) {
    logUsage('gemini', false);
    throw new Error('Voice processing failed. Please try again.');
  }
};

/**
 * Get clinical insights for a patient
 */
export const getClinicalInsightsForPatient = async (patient: Patient): Promise<string> => {
  // Use Gemini for general insights (it's better for this)
  try {
    const result = await getClinicalInsights(patient);
    logUsage('gemini', true);
    return result;
  } catch (error) {
    logUsage('gemini', false);
    throw error;
  }
};

// Export as a unified service object
export const aiProvider = {
  configure: configureAIProvider,
  getStats: getProviderStats,
  getAvailableModels,
  analyzeClinicalText,
  extractClinicalEntities,
  suggestDifferentialDiagnosis,
  suggestICD10Codes,
  detectClinicalAlerts,
  checkMedicationInteractions,
  structureVoiceTranscript,
  getClinicalInsights: getClinicalInsightsForPatient
};

export default aiProvider;
