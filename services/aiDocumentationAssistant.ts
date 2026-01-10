import { GoogleGenAI } from '@google/genai';
import { VitalSigns, ClinicalExamination, Medication } from '../types';
import { calculateMedicationDosage } from './geminiService';

/**
 * AI Suggestion Types
 */
export interface AISuggestion {
  id: string;
  type: 'medication' | 'examination' | 'diagnosis' | 'vital' | 'general';
  field?: string;
  text: string;
  rationale: string;
  confidence: number;
  priority?: 'high' | 'medium' | 'low';
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestedValue?: string;
}

export interface DosageRecommendation {
  medication: string;
  standardDose: string;
  calculatedDose: string;
  route: string;
  frequency: string;
  warnings?: string[];
  contraindications?: string[];
}

/**
 * AIDocumentationAssistant - Intelligent clinical documentation helper
 *
 * Provides real-time AI assistance for clinical documentation including:
 * - Smart suggestions based on diagnosis and patient context
 * - Vital sign validation with age-appropriate ranges
 * - Medication dosage calculations
 * - Differential diagnosis generation
 * - Auto-complete for common clinical phrases
 *
 * @example
 * const assistant = new AIDocumentationAssistant();
 * const suggestions = await assistant.getSuggestions({
 *   diagnosis: 'Neonatal RDS',
 *   patientAge: 3,
 *   unit: 'NICU'
 * });
 */
export class AIDocumentationAssistant {
  private ai: GoogleGenAI;
  private cache: Map<string, { data: any; timestamp: number }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }
    this.ai = new GoogleGenAI({ apiKey });
    this.cache = new Map();
  }

  /**
   * Get cached result or null if expired
   */
  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Set cache with timestamp
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Get real-time clinical suggestions based on context
   */
  async getSuggestions(context: {
    diagnosis?: string;
    vitals?: Partial<VitalSigns>;
    examination?: Partial<ClinicalExamination>;
    patientAge: number;
    patientWeight?: number;
    unit: string;
  }): Promise<AISuggestion[]> {
    const cacheKey = `suggestions-${context.diagnosis}-${context.unit}`;
    const cached = this.getCached<AISuggestion[]>(cacheKey);
    if (cached) return cached;

    if (!context.diagnosis || context.diagnosis.length < 3) {
      return [];
    }

    try {
      const prompt = `
You are a pediatric/neonatal clinical decision support AI.

PATIENT CONTEXT:
- Age: ${context.patientAge} days old
- Unit: ${context.unit}
- Weight: ${context.patientWeight || 'unknown'} kg
- Current diagnosis/impression: ${context.diagnosis}
${context.vitals ? `- Current vitals: ${JSON.stringify(context.vitals)}` : ''}

Generate evidence-based clinical documentation suggestions for this patient.

Return ONLY valid JSON array (no markdown):
[
  {
    "id": "suggestion-1",
    "type": "medication",
    "field": "medications",
    "text": "Ampicillin 50mg/kg IV BD",
    "rationale": "First-line antibiotic for neonatal sepsis, covers Group B Strep and E. coli",
    "confidence": 0.95,
    "priority": "high"
  },
  {
    "type": "examination",
    "field": "chest",
    "text": "Subcostal retractions, grunting, decreased air entry",
    "rationale": "Common examination findings in RDS",
    "confidence": 0.88,
    "priority": "medium"
  },
  {
    "type": "vital",
    "field": "spo2",
    "text": "Target SpO2: 88-95%",
    "rationale": "Recommended oxygen saturation for preterm neonates to prevent ROP",
    "confidence": 0.92,
    "priority": "high"
  }
]

GUIDELINES:
- Provide 3-6 most relevant suggestions
- Focus on actionable, evidence-based recommendations
- Include medications with standard dosing for age/weight
- Suggest relevant examination findings to document
- Indicate target vital sign ranges
- Prioritize by clinical importance (high/medium/low)
- Confidence score: how confident the suggestion applies (0-1)
      `;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      let responseText = response.text.trim();
      responseText = responseText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '');

      const suggestions: AISuggestion[] = JSON.parse(responseText);

      // Add unique IDs if missing
      suggestions.forEach((s, i) => {
        if (!s.id) s.id = `suggestion-${Date.now()}-${i}`;
      });

      this.setCache(cacheKey, suggestions);
      return suggestions;
    } catch (error) {
      console.error('AI suggestions error:', error);
      return [];
    }
  }

  /**
   * Validate vital signs against age-appropriate normal ranges
   */
  validateVitals(vitals: Partial<VitalSigns>, patientAge: number): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Age-specific ranges (days)
    const isNeonate = patientAge <= 28;
    const isInfant = patientAge > 28 && patientAge <= 365;

    // Heart Rate validation
    if (vitals.hr) {
      const hr = parseInt(vitals.hr);
      if (!isNaN(hr)) {
        if (isNeonate) {
          if (hr < 100) {
            warnings.push({
              field: 'hr',
              message: 'Heart rate low for neonate (normal: 120-160 bpm)',
              severity: 'warning',
              suggestedValue: '120-160',
            });
          } else if (hr > 180) {
            warnings.push({
              field: 'hr',
              message: 'Heart rate elevated for neonate (normal: 120-160 bpm). Consider sepsis, pain, fever.',
              severity: 'warning',
              suggestedValue: '120-160',
            });
          }
        } else if (isInfant) {
          if (hr < 100 || hr > 160) {
            warnings.push({
              field: 'hr',
              message: 'Heart rate outside normal range for infant (normal: 100-160 bpm)',
              severity: 'warning',
              suggestedValue: '100-160',
            });
          }
        }
      }
    }

    // Respiratory Rate validation
    if (vitals.rr) {
      const rr = parseInt(vitals.rr);
      if (!isNaN(rr)) {
        if (isNeonate) {
          if (rr < 30 || rr > 60) {
            warnings.push({
              field: 'rr',
              message: 'Respiratory rate outside normal range for neonate (normal: 30-60/min)',
              severity: 'warning',
              suggestedValue: '30-60',
            });
          }
        } else if (isInfant) {
          if (rr < 25 || rr > 50) {
            warnings.push({
              field: 'rr',
              message: 'Respiratory rate outside normal range for infant (normal: 25-50/min)',
              severity: 'warning',
              suggestedValue: '25-50',
            });
          }
        }
      }
    }

    // Temperature validation
    if (vitals.temperature) {
      const temp = parseFloat(vitals.temperature);
      if (!isNaN(temp)) {
        if (temp < 36.0) {
          warnings.push({
            field: 'temperature',
            message: 'Hypothermia detected (temp < 36°C). Ensure thermal neutral environment.',
            severity: 'error',
            suggestedValue: '36.5-37.5',
          });
        } else if (temp > 38.0) {
          warnings.push({
            field: 'temperature',
            message: 'Fever detected (temp > 38°C). Consider infection workup.',
            severity: 'warning',
            suggestedValue: '36.5-37.5',
          });
        }
      }
    }

    // SpO2 validation
    if (vitals.spo2) {
      const spo2 = parseInt(vitals.spo2);
      if (!isNaN(spo2)) {
        if (spo2 < 85) {
          warnings.push({
            field: 'spo2',
            message: 'Severe hypoxemia (SpO2 < 85%). Increase oxygen support urgently.',
            severity: 'error',
          });
        } else if (isNeonate && spo2 > 95) {
          warnings.push({
            field: 'spo2',
            message: 'SpO2 may be too high for preterm neonate (target: 88-95% to prevent ROP).',
            severity: 'info',
            suggestedValue: '88-95',
          });
        }
      }
    }

    // Blood Pressure validation (basic)
    if (vitals.bp) {
      const bpMatch = vitals.bp.match(/(\d+)\/(\d+)/);
      if (bpMatch) {
        const systolic = parseInt(bpMatch[1]);
        if (isNeonate && systolic < 50) {
          warnings.push({
            field: 'bp',
            message: 'Hypotension in neonate (systolic < 50 mmHg). Consider fluid bolus/inotropes.',
            severity: 'error',
          });
        }
      }
    }

    return warnings;
  }

  /**
   * Calculate medication dosage based on weight and age
   */
  async calculateDosage(
    medication: string,
    weight: number,
    age: number
  ): Promise<DosageRecommendation | null> {
    const cacheKey = `dosage-${medication}-${weight}-${age}`;
    const cached = this.getCached<DosageRecommendation>(cacheKey);
    if (cached) return cached;

    try {
      // Use existing geminiService function
      const result = await calculateMedicationDosage(medication, weight, age);

      // Parse the result (it returns a string)
      // For now, create a structured recommendation
      const recommendation: DosageRecommendation = {
        medication,
        standardDose: result || 'Not found',
        calculatedDose: result || 'Not found',
        route: 'IV', // Default, should be parsed from result
        frequency: 'BD', // Default, should be parsed from result
      };

      this.setCache(cacheKey, recommendation);
      return recommendation;
    } catch (error) {
      console.error('Dosage calculation error:', error);
      return null;
    }
  }

  /**
   * Generate differential diagnosis based on symptoms/presentation
   */
  async getDifferentialDiagnosis(
    symptoms: string[],
    patientAge: number,
    unit: string
  ): Promise<{ diagnosis: string; probability: string; keyFeatures: string[] }[]> {
    const cacheKey = `ddx-${symptoms.join(',')}-${patientAge}-${unit}`;
    const cached = this.getCached<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const prompt = `
You are a pediatric/neonatal diagnostician.

PATIENT:
- Age: ${patientAge} days old
- Unit: ${unit}
- Presenting symptoms: ${symptoms.join(', ')}

Generate a differential diagnosis list with top 5 most likely diagnoses.

Return ONLY valid JSON array:
[
  {
    "diagnosis": "Neonatal Sepsis",
    "probability": "High",
    "keyFeatures": [
      "Fever/hypothermia",
      "Poor feeding",
      "Lethargy",
      "Respiratory distress"
    ]
  }
]

Rank by probability (High/Medium/Low) based on clinical presentation.
      `;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      let responseText = response.text.trim();
      responseText = responseText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '');

      const ddx = JSON.parse(responseText);
      this.setCache(cacheKey, ddx);
      return ddx;
    } catch (error) {
      console.error('Differential diagnosis error:', error);
      return [];
    }
  }

  /**
   * Auto-complete clinical phrases
   */
  async getAutoComplete(
    partialText: string,
    field: 'examination' | 'note' | 'diagnosis'
  ): Promise<string[]> {
    if (partialText.length < 3) return [];

    const cacheKey = `autocomplete-${field}-${partialText}`;
    const cached = this.getCached<string[]>(cacheKey);
    if (cached) return cached;

    try {
      const prompt = `
Complete this ${field} documentation phrase:
"${partialText}"

Return ONLY valid JSON array of 3-5 completion suggestions:
["completion 1", "completion 2", "completion 3"]

Context: NICU/PICU clinical documentation
Make suggestions specific, clinically accurate, and commonly used.
      `;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      let responseText = response.text.trim();
      responseText = responseText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '');

      const completions: string[] = JSON.parse(responseText);
      this.setCache(cacheKey, completions);
      return completions;
    } catch (error) {
      console.error('Auto-complete error:', error);
      return [];
    }
  }

  /**
   * Suggest next steps in documentation workflow
   */
  async suggestNextSteps(
    currentData: {
      vitals?: Partial<VitalSigns>;
      examination?: Partial<ClinicalExamination>;
      medications?: Medication[];
      note?: string;
    }
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Check completeness
    if (!currentData.vitals || Object.keys(currentData.vitals).length === 0) {
      suggestions.push('📊 Add vital signs (temperature, HR, RR, SpO2)');
    }

    if (!currentData.examination || Object.keys(currentData.examination).length === 0) {
      suggestions.push('🩺 Document physical examination findings');
    }

    if (!currentData.medications || currentData.medications.length === 0) {
      suggestions.push('💊 Add current medications');
    }

    if (!currentData.note || currentData.note.length < 50) {
      suggestions.push('📝 Add clinical assessment and plan');
    }

    // If everything is complete
    if (suggestions.length === 0) {
      suggestions.push('✅ Documentation looks complete! Review and save.');
    }

    return suggestions;
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
let assistantInstance: AIDocumentationAssistant | null = null;

/**
 * Get singleton instance of AIDocumentationAssistant
 */
export const getAIDocumentationAssistant = (): AIDocumentationAssistant => {
  if (!assistantInstance) {
    assistantInstance = new AIDocumentationAssistant();
  }
  return assistantInstance;
};

export default AIDocumentationAssistant;
