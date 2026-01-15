/**
 * ICD-10 Coding Service
 * Provides automated ICD-10 code suggestions using AI and local database
 */

import {
  ICD10Code,
  ICD10Suggestion,
  PatientICD10,
  ICD10SearchResult,
  COMMON_DIAGNOSIS_MAPPINGS
} from '../types/icd10';
import { NEONATAL_ICD10_CODES, searchICD10Codes, getICD10Code } from '../data/icd10Neonatal';
import { aiProvider } from './aiProviderService';
import { PatientContext } from '../types/medgemma';
import { Patient } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Cache for recent suggestions
const suggestionCache = new Map<string, { suggestions: ICD10Suggestion[]; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Search ICD-10 codes with relevance scoring
 */
export const searchCodes = (query: string, limit: number = 20): ICD10SearchResult[] => {
  const results = searchICD10Codes(query);
  const lowerQuery = query.toLowerCase().trim();

  return results
    .map(code => {
      let relevanceScore = 0;
      let matchType: ICD10SearchResult['matchType'] = 'description';

      // Exact code match - highest priority
      if (code.code.toLowerCase() === lowerQuery) {
        relevanceScore = 100;
        matchType = 'exact';
      }
      // Code prefix match
      else if (code.code.toLowerCase().startsWith(lowerQuery)) {
        relevanceScore = 80;
        matchType = 'prefix';
      }
      // Alias match
      else if (code.commonAliases?.some(a => a.toLowerCase() === lowerQuery)) {
        relevanceScore = 75;
        matchType = 'alias';
      }
      // Short description match
      else if (code.shortDescription?.toLowerCase().includes(lowerQuery)) {
        relevanceScore = 60;
        matchType = 'description';
      }
      // Full description match
      else if (code.description.toLowerCase().includes(lowerQuery)) {
        relevanceScore = 50;
        matchType = 'description';
      }
      // Alias partial match
      else if (code.commonAliases?.some(a => a.toLowerCase().includes(lowerQuery))) {
        relevanceScore = 40;
        matchType = 'alias';
      }
      // Category match
      else if (code.category.toLowerCase().includes(lowerQuery)) {
        relevanceScore = 30;
        matchType = 'description';
      }

      return { code, relevanceScore, matchType };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
};

/**
 * Get ICD-10 suggestions based on patient diagnosis
 */
export const getSuggestionsFromDiagnosis = (diagnosis: string): ICD10Suggestion[] => {
  if (!diagnosis) return [];

  const lowerDiagnosis = diagnosis.toLowerCase();
  const suggestions: ICD10Suggestion[] = [];

  // Check common diagnosis mappings
  for (const mapping of COMMON_DIAGNOSIS_MAPPINGS) {
    const matches = mapping.keywords.some(keyword =>
      lowerDiagnosis.includes(keyword.toLowerCase())
    );

    if (matches) {
      // Add primary code
      const primaryCode = getICD10Code(mapping.primaryCode);
      if (primaryCode) {
        suggestions.push({
          code: primaryCode.code,
          description: primaryCode.description,
          confidence: 0.85,
          source: 'template',
          isPrimary: true,
          extractedFrom: diagnosis,
          category: primaryCode.category
        });
      }

      // Add secondary codes
      if (mapping.secondaryCodes) {
        for (const secondaryCode of mapping.secondaryCodes) {
          const code = getICD10Code(secondaryCode);
          if (code) {
            suggestions.push({
              code: code.code,
              description: code.description,
              confidence: 0.6,
              source: 'template',
              isPrimary: false,
              extractedFrom: diagnosis,
              category: code.category
            });
          }
        }
      }
    }
  }

  return suggestions;
};

/**
 * Get AI-powered ICD-10 suggestions from clinical text
 */
export const getAISuggestions = async (
  clinicalText: string,
  patient: Patient
): Promise<ICD10Suggestion[]> => {
  // Check cache
  const cacheKey = `${patient.id}_${clinicalText.slice(0, 100)}`;
  const cached = suggestionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.suggestions;
  }

  try {
    const context: PatientContext = {
      age: patient.age,
      ageUnit: patient.ageUnit,
      gender: patient.gender,
      weight: patient.birthWeight || patient.weightOnAdmission,
      diagnosis: patient.diagnosis,
      unit: patient.unit || 'NICU'
    };

    const aiSuggestions = await aiProvider.suggestICD10Codes(clinicalText, context);

    const suggestions: ICD10Suggestion[] = aiSuggestions.map((suggestion, index) => ({
      code: suggestion.code,
      description: suggestion.description,
      confidence: suggestion.confidence,
      source: 'ai' as const,
      isPrimary: index === 0 || suggestion.isPrimary,
      extractedFrom: suggestion.extractedFrom,
      category: suggestion.category
    }));

    // Cache the results
    suggestionCache.set(cacheKey, { suggestions, timestamp: Date.now() });

    return suggestions;
  } catch (error) {
    console.warn('AI ICD-10 suggestion failed:', error);
    return [];
  }
};

/**
 * Get comprehensive ICD-10 suggestions combining all sources
 */
export const getComprehensiveSuggestions = async (
  clinicalText: string,
  patient: Patient
): Promise<ICD10Suggestion[]> => {
  const allSuggestions: ICD10Suggestion[] = [];
  const seenCodes = new Set<string>();

  // 1. Get suggestions from patient diagnosis
  if (patient.diagnosis) {
    const diagnosisSuggestions = getSuggestionsFromDiagnosis(patient.diagnosis);
    for (const suggestion of diagnosisSuggestions) {
      if (!seenCodes.has(suggestion.code)) {
        allSuggestions.push(suggestion);
        seenCodes.add(suggestion.code);
      }
    }
  }

  // 2. Get AI suggestions from clinical text
  if (clinicalText) {
    try {
      const aiSuggestions = await getAISuggestions(clinicalText, patient);
      for (const suggestion of aiSuggestions) {
        if (!seenCodes.has(suggestion.code)) {
          allSuggestions.push(suggestion);
          seenCodes.add(suggestion.code);
        }
      }
    } catch (error) {
      console.warn('AI suggestions failed, using template-based only');
    }
  }

  // 3. Add suggestions based on clinical text keywords (fallback)
  if (clinicalText) {
    const keywordSuggestions = getSuggestionsFromDiagnosis(clinicalText);
    for (const suggestion of keywordSuggestions) {
      if (!seenCodes.has(suggestion.code)) {
        suggestion.confidence *= 0.8; // Lower confidence for keyword matches
        allSuggestions.push(suggestion);
        seenCodes.add(suggestion.code);
      }
    }
  }

  // Sort by confidence (primary codes first, then by confidence)
  return allSuggestions.sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return b.confidence - a.confidence;
  });
};

/**
 * Create a PatientICD10 record
 */
export const createPatientICD10 = (
  patientId: string,
  code: string,
  userId: string,
  userName: string,
  options: Partial<PatientICD10> = {}
): PatientICD10 | null => {
  const icd10Code = getICD10Code(code);
  if (!icd10Code) return null;

  return {
    id: uuidv4(),
    patientId,
    code: icd10Code.code,
    description: icd10Code.description,
    isPrimary: options.isPrimary || false,
    assignedAt: new Date().toISOString(),
    assignedBy: userId,
    assignedByName: userName,
    source: options.source || 'manual',
    aiConfidence: options.aiConfidence,
    notes: options.notes
  };
};

/**
 * Validate an ICD-10 code
 */
export const validateCode = (code: string): { valid: boolean; code?: ICD10Code; error?: string } => {
  const icd10Code = getICD10Code(code);

  if (!icd10Code) {
    // Try to search for it
    const searchResults = searchCodes(code, 1);
    if (searchResults.length > 0 && searchResults[0].matchType === 'exact') {
      return { valid: true, code: searchResults[0].code };
    }
    return { valid: false, error: `Invalid ICD-10 code: ${code}` };
  }

  return { valid: true, code: icd10Code };
};

/**
 * Get related codes for a given code
 */
export const getRelatedCodes = (code: string): ICD10Code[] => {
  const icd10Code = getICD10Code(code);
  if (!icd10Code) return [];

  // Get codes from same category
  return NEONATAL_ICD10_CODES.filter(c =>
    c.code !== code && c.category === icd10Code.category
  ).slice(0, 5);
};

/**
 * Get codes by category
 */
export const getCodesByCategory = (category: string): ICD10Code[] => {
  return NEONATAL_ICD10_CODES.filter(c =>
    c.category.toLowerCase() === category.toLowerCase()
  );
};

/**
 * Get common codes for quick selection
 */
export const getCommonCodes = (): ICD10Code[] => {
  const commonCodeIds = [
    'P07.30', // Preterm
    'P22.0',  // RDS
    'P36.9',  // Sepsis
    'P59.9',  // Jaundice
    'P91.60', // HIE
    'P77.9',  // NEC
    'P28.4',  // Apnea
    'Q25.0',  // PDA
    'P70.4',  // Hypoglycemia
    'P52.3',  // IVH
  ];

  return commonCodeIds
    .map(id => getICD10Code(id))
    .filter((code): code is ICD10Code => code !== undefined);
};

/**
 * Clear suggestion cache
 */
export const clearCache = (): void => {
  suggestionCache.clear();
};

// Export service object
export const icd10Service = {
  search: searchCodes,
  getSuggestionsFromDiagnosis,
  getAISuggestions,
  getComprehensiveSuggestions,
  createPatientICD10,
  validateCode,
  getRelatedCodes,
  getCodesByCategory,
  getCommonCodes,
  getCode: getICD10Code,
  clearCache
};

export default icd10Service;
