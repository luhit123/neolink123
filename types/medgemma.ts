/**
 * MedGemma Type Definitions
 * Types for MedGemma 1.5 medical AI integration
 */

import { VitalSigns, ClinicalExamination, Medication } from '../types';

// Configuration
export interface MedGemmaConfig {
  huggingFaceApiKey: string;
  huggingFaceEndpoint: string;
  enableFallback: boolean;
  fallbackToGemini: boolean;
  timeout: number;
  retryAttempts: number;
  maxTokens: number;
}

// Model Information
export interface ModelInfo {
  name: string;
  version: string;
  provider: 'medgemma' | 'gemini';
  isAvailable: boolean;
  lastChecked: string;
}

// Clinical Entity Extraction
export interface ClinicalEntity {
  text: string;
  type: 'diagnosis' | 'symptom' | 'medication' | 'procedure' | 'anatomy' | 'finding';
  confidence: number;
  startIndex?: number;
  endIndex?: number;
  normalizedTerm?: string;
  icd10Code?: string;
}

// Medical Analysis Result
export interface MedicalAnalysisResult {
  extractedEntities: ClinicalEntity[];
  structuredData: {
    vitals?: Partial<VitalSigns>;
    examination?: Partial<ClinicalExamination>;
    medications?: Partial<Medication>[];
    diagnoses?: string[];
    symptoms?: string[];
    procedures?: string[];
  };
  clinicalSummary?: string;
  confidence: number;
  processingTime: number;
  model: 'medgemma' | 'gemini';
}

// Differential Diagnosis
export interface DifferentialDiagnosis {
  diagnosis: string;
  probability: 'high' | 'medium' | 'low';
  confidence: number;
  supportingFindings: string[];
  rulingOutFindings?: string[];
  suggestedTests?: string[];
  icd10Code?: string;
}

// ICD-10 Suggestion from AI
export interface AICodeSuggestion {
  code: string;
  description: string;
  confidence: number;
  extractedFrom: string;
  category: string;
  isPrimary: boolean;
}

// Clinical Alert from AI
export interface AIClinicalAlert {
  type: 'vital_abnormal' | 'drug_interaction' | 'deterioration' | 'dosing_error' | 'critical_finding';
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  title: string;
  message: string;
  recommendation?: string;
  affectedVitals?: string[];
  relatedMedications?: string[];
  confidence: number;
}

// Patient Context for AI Processing
export interface PatientContext {
  age: number;
  ageUnit: string;
  gender: string;
  weight?: number;
  diagnosis?: string;
  unit: string;
  indications?: string[];
  currentMedications?: Medication[];
  recentVitals?: VitalSigns[];
}

// Voice Transcription Result
export interface TranscriptionResult {
  rawTranscript: string;
  cleanedTranscript: string;
  structuredData: MedicalAnalysisResult;
  segments: TranscriptSegment[];
  duration: number;
  language: string;
}

export interface TranscriptSegment {
  timestamp: number;
  text: string;
  speaker?: 'clinician' | 'patient' | 'unknown';
  confidence: number;
  isFinal: boolean;
}

// Ambient Scribe Session
export interface AmbientSession {
  id: string;
  patientId: string;
  startTime: string;
  endTime?: string;
  status: 'recording' | 'processing' | 'paused' | 'completed' | 'error';
  transcriptSegments: TranscriptSegment[];
  structuredData: Partial<MedicalAnalysisResult>;
  totalDuration: number;
  privacyMode: boolean;
}

// API Response Types
export interface HuggingFaceResponse {
  generated_text?: string;
  error?: string;
  estimated_time?: number;
}

export interface MedGemmaAPIResponse {
  success: boolean;
  data?: MedicalAnalysisResult;
  error?: string;
  model: 'medgemma' | 'gemini';
  latency: number;
}

// Processing Options
export interface ProcessingOptions {
  includeVitals: boolean;
  includeExamination: boolean;
  includeMedications: boolean;
  includeDiagnoses: boolean;
  includeICD10: boolean;
  patientContext?: PatientContext;
  language?: string;
  maxTokens?: number;
}

// Default configuration
export const DEFAULT_MEDGEMMA_CONFIG: MedGemmaConfig = {
  huggingFaceApiKey: '',
  huggingFaceEndpoint: 'https://api-inference.huggingface.co/models/google/medgemma-4b-it',
  enableFallback: true,
  fallbackToGemini: true,
  timeout: 30000,
  retryAttempts: 2,
  maxTokens: 2048
};
