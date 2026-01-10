import { GoogleGenAI } from '@google/genai';
import { voiceInput } from '../utils/voiceInput';
import { ProgressNote, VitalSigns, ClinicalExamination, Medication } from '../types';

/**
 * Structured clinical data extracted from voice
 */
export interface StructuredClinicalData {
  vitals?: Partial<VitalSigns>;
  examination?: Partial<ClinicalExamination>;
  medications?: Medication[];
  note?: string;
  suggestedDiagnosis?: string[];
  confidence?: number;
}

/**
 * VoiceScribeService - AI-powered voice-to-structured-note conversion
 *
 * This service enables hands-free clinical documentation by:
 * 1. Continuously recording voice input with Web Speech API
 * 2. Real-time transcription with interim results
 * 3. AI-powered structuring using Gemini 2.5-flash
 * 4. Extraction of vitals, examination findings, medications, and clinical notes
 *
 * Usage:
 * ```typescript
 * const scribe = new VoiceScribeService();
 * scribe.startScribe(
 *   (data) => console.log('Structured data:', data),
 *   (error) => console.error('Error:', error)
 * );
 * ```
 */
export class VoiceScribeService {
  private transcript: string = '';
  private isListening: boolean = false;
  private ai: GoogleGenAI;
  private processingTimeout?: NodeJS.Timeout;

  constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Start voice scribe with continuous listening
   * @param onUpdate - Callback for real-time updates with structured data
   * @param onError - Callback for errors
   * @param language - Language code (default: 'en-US')
   */
  async startScribe(
    onUpdate: (data: Partial<ProgressNote> & { rawTranscript?: string }) => void,
    onError: (error: string) => void,
    language: string = 'en-US'
  ): Promise<void> {
    if (!voiceInput.isSupported()) {
      onError('Voice recognition is not supported in your browser');
      return;
    }

    this.transcript = '';
    this.isListening = true;

    voiceInput.start(
      (result) => {
        if (result.isFinal) {
          // Final result - add to transcript and process with AI
          this.transcript += result.transcript + ' ';

          // Debounced AI processing (wait 1s after final result)
          if (this.processingTimeout) {
            clearTimeout(this.processingTimeout);
          }
          this.processingTimeout = setTimeout(() => {
            this.processTranscriptWithAI(onUpdate, onError);
          }, 1000);
        } else {
          // Interim result - show real-time transcript
          onUpdate({
            note: this.transcript + result.transcript,
            rawTranscript: this.transcript + result.transcript,
          });
        }
      },
      onError,
      {
        continuous: true,
        interimResults: true,
        lang: language,
      }
    );
  }

  /**
   * Process transcript with AI to extract structured clinical data
   */
  private async processTranscriptWithAI(
    onUpdate: (data: Partial<ProgressNote> & { rawTranscript?: string }) => void,
    onError: (error: string) => void
  ): Promise<void> {
    if (!this.transcript.trim()) {
      return;
    }

    try {
      const prompt = `
You are an expert medical scribe AI specializing in NICU/PICU documentation.

Extract clinical information from this voice transcript and structure it into standardized medical documentation format.

TRANSCRIPT:
"${this.transcript}"

INSTRUCTIONS:
1. Extract vital signs (temperature, heart rate, respiratory rate, BP, SpO2, CRT, weight)
2. Extract examination findings organized by system (CNS, CVS, Chest, Per Abdomen, Other)
3. Extract medications with proper dosing (name, dose, route, frequency)
4. Generate a structured clinical note in SOAP format if possible
5. Suggest possible diagnoses based on the clinical presentation
6. Provide a confidence score (0-1) for the extraction quality

Return ONLY valid JSON (no markdown, no code blocks):
{
  "vitals": {
    "temperature": "37.2",
    "hr": "145",
    "rr": "45",
    "bp": "85/50",
    "spo2": "96",
    "crt": "<2",
    "weight": "2.8"
  },
  "examination": {
    "cns": "Alert, active movements, good tone",
    "cvs": "S1S2 normal, no murmur, good perfusion",
    "chest": "Bilateral air entry equal, mild retractions",
    "perAbdomen": "Soft, non-tender, no distension",
    "otherFindings": "Pink, well perfused"
  },
  "medications": [
    {
      "name": "Ampicillin",
      "dose": "50mg/kg",
      "route": "IV",
      "frequency": "BD"
    }
  ],
  "note": "Structured clinical note in SOAP format or narrative format",
  "suggestedDiagnosis": ["Neonatal Sepsis", "Respiratory Distress"],
  "confidence": 0.92
}

MEDICAL CONTEXT:
- This is a NICU/PICU setting
- Use standard medical abbreviations
- Be precise with vital sign units
- Common medication routes: IV, PO, IM, SC, Topical, Inhalation
- Common frequencies: STAT, OD, BD, TID, QID, Q4H, Q6H, Q8H, PRN
- Leave fields empty if not mentioned in transcript
- If transcript is unclear or insufficient, set confidence <0.5

IMPORTANT:
- Return ONLY the JSON object
- No markdown formatting
- No code blocks
- No explanatory text
- Valid JSON syntax only
      `;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      let responseText = response.text.trim();

      // Remove markdown code blocks if present
      responseText = responseText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '');

      const structured: StructuredClinicalData = JSON.parse(responseText);

      // Build ProgressNote from structured data
      const progressNote: Partial<ProgressNote> & { rawTranscript?: string; confidence?: number } = {
        vitals: structured.vitals && Object.keys(structured.vitals).length > 0 ? (structured.vitals as VitalSigns) : undefined,
        examination:
          structured.examination && Object.keys(structured.examination).length > 0
            ? (structured.examination as ClinicalExamination)
            : undefined,
        medications: structured.medications && structured.medications.length > 0 ? structured.medications : undefined,
        note: structured.note || this.transcript,
        rawTranscript: this.transcript,
        confidence: structured.confidence,
      };

      onUpdate(progressNote);
    } catch (error) {
      console.error('AI processing error:', error);

      // Fallback: return raw transcript
      onUpdate({
        note: this.transcript,
        rawTranscript: this.transcript,
        confidence: 0,
      });

      onError(`AI processing failed. Raw transcript preserved: ${(error as Error).message}`);
    }
  }

  /**
   * Stop voice scribe
   */
  stop(): void {
    voiceInput.stop();
    this.isListening = false;

    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
    }
  }

  /**
   * Get current listening status
   */
  getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * Get current transcript
   */
  getCurrentTranscript(): string {
    return this.transcript;
  }

  /**
   * Clear transcript (useful for starting fresh)
   */
  clearTranscript(): void {
    this.transcript = '';
  }

  /**
   * Manually process current transcript (useful for testing)
   */
  async manualProcess(
    onUpdate: (data: Partial<ProgressNote> & { rawTranscript?: string }) => void,
    onError: (error: string) => void
  ): Promise<void> {
    await this.processTranscriptWithAI(onUpdate, onError);
  }

  /**
   * Enhanced: Process with patient context for better accuracy
   */
  async processWithContext(
    patientAge: number,
    patientUnit: string,
    onUpdate: (data: Partial<ProgressNote> & { rawTranscript?: string }) => void,
    onError: (error: string) => void
  ): Promise<void> {
    if (!this.transcript.trim()) {
      return;
    }

    try {
      const contextualPrompt = `
You are an expert medical scribe AI specializing in ${patientUnit} documentation.

PATIENT CONTEXT:
- Age: ${patientAge} days/months old
- Unit: ${patientUnit}

TRANSCRIPT:
"${this.transcript}"

Extract and structure clinical information appropriate for a ${patientAge}-day-old patient in ${patientUnit}.

Return ONLY valid JSON (no markdown):
{
  "vitals": {...},
  "examination": {...},
  "medications": [...],
  "note": "...",
  "suggestedDiagnosis": [...],
  "confidence": 0.95
}
      `;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contextualPrompt,
      });

      let responseText = response.text.trim();
      responseText = responseText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '');

      const structured: StructuredClinicalData = JSON.parse(responseText);

      const progressNote: Partial<ProgressNote> & { rawTranscript?: string; confidence?: number } = {
        vitals: structured.vitals && Object.keys(structured.vitals).length > 0 ? (structured.vitals as VitalSigns) : undefined,
        examination:
          structured.examination && Object.keys(structured.examination).length > 0
            ? (structured.examination as ClinicalExamination)
            : undefined,
        medications: structured.medications && structured.medications.length > 0 ? structured.medications : undefined,
        note: structured.note || this.transcript,
        rawTranscript: this.transcript,
        confidence: structured.confidence,
      };

      onUpdate(progressNote);
    } catch (error) {
      console.error('AI processing error:', error);
      onUpdate({
        note: this.transcript,
        rawTranscript: this.transcript,
        confidence: 0,
      });
      onError(`AI processing failed: ${(error as Error).message}`);
    }
  }
}

// Singleton instance
let voiceScribeInstance: VoiceScribeService | null = null;

/**
 * Get singleton instance of VoiceScribeService
 */
export const getVoiceScribeService = (): VoiceScribeService => {
  if (!voiceScribeInstance) {
    voiceScribeInstance = new VoiceScribeService();
  }
  return voiceScribeInstance;
};

export default VoiceScribeService;
