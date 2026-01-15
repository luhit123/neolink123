import { GoogleGenAI } from '@google/genai';
import { audioRecorder } from '../utils/audioRecorder';
import { ProgressNote, VitalSigns, ClinicalExamination, Medication } from '../types';
import { PatientContext } from '../types/medgemma';

/**
 * Structured clinical data extracted from voice
 */
export interface StructuredClinicalData {
  vitals?: Partial<VitalSigns>;
  examination?: Partial<ClinicalExamination>;
  medications?: Medication[];
  note?: string;
  transcript?: string;
  suggestedDiagnosis?: string[];
  confidence?: number;
}

/**
 * Normal vital ranges by age group for NICU/PICU
 */
const NORMAL_VITAL_RANGES = {
  preterm: {
    temperature: '36.5-37.2',
    hr: '140-170',
    rr: '45-65',
    bp: '50-60/30-40',
    spo2: '90-96',
    crt: '<2-3'
  },
  newborn: {
    temperature: '36.5-37.5',
    hr: '120-160',
    rr: '40-60',
    bp: '60-70/35-45',
    spo2: '95-100',
    crt: '<2'
  },
  infant: {
    temperature: '36.5-37.5',
    hr: '100-150',
    rr: '30-50',
    bp: '70-90/40-60',
    spo2: '95-100',
    crt: '<2'
  },
  toddler: {
    temperature: '36.5-37.5',
    hr: '90-130',
    rr: '24-40',
    bp: '80-100/50-65',
    spo2: '95-100',
    crt: '<2'
  },
  child: {
    temperature: '36.5-37.5',
    hr: '70-110',
    rr: '18-30',
    bp: '90-110/60-75',
    spo2: '95-100',
    crt: '<2'
  }
};

/**
 * Normal examination findings templates
 */
const NORMAL_EXAMINATION = {
  cns: 'Alert, active, good cry, normal tone, normal reflexes, anterior fontanelle soft and flat, no seizures',
  cvs: 'S1S2 heard, no murmur, regular rhythm, CRT <2 seconds, peripheral pulses well felt, warm peripheries, no cyanosis',
  chest: 'Bilateral equal air entry, no added sounds, no retractions, no grunting, no nasal flaring, normal respiratory effort',
  perAbdomen: 'Soft, non-distended, non-tender, bowel sounds present, no organomegaly, umbilicus healthy, tolerating feeds well',
  otherFindings: 'Pink, well perfused, no rash, no edema, activity appropriate for age'
};

/**
 * VoiceScribeService - Smart Clinical Voice Documentation
 *
 * Understands medical shorthand:
 * - "All systems normal" → Expands to full normal exam
 * - "Vitals normal except HR 150" → Normal vitals with specific override
 * - "Baby stable" → Appropriate normal documentation
 */
export class VoiceScribeService {
  private ai: GoogleGenAI;
  private patientContext?: PatientContext;
  private isRecording: boolean = false;
  private onUpdateCallback?: (data: Partial<ProgressNote> & { rawTranscript?: string }) => void;
  private onErrorCallback?: (error: string) => void;

  constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  isSupported(): boolean {
    return audioRecorder.isSupported();
  }

  async startScribe(
    onUpdate: (data: Partial<ProgressNote> & { rawTranscript?: string }) => void,
    onError: (error: string) => void,
    patientContext?: PatientContext
  ): Promise<void> {
    if (!this.isSupported()) {
      onError('Audio recording is not supported in this browser');
      return;
    }

    if (this.isRecording) {
      return;
    }

    this.onUpdateCallback = onUpdate;
    this.onErrorCallback = onError;
    this.patientContext = patientContext;
    this.isRecording = true;

    onUpdate({
      rawTranscript: '🎙️ Recording... Speak your clinical findings.',
      note: ''
    });

    await audioRecorder.start({
      onError: (error) => {
        this.isRecording = false;
        onError(error);
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.isRecording) {
      return;
    }

    this.isRecording = false;

    this.onUpdateCallback?.({
      rawTranscript: '⏳ Processing with Gemini AI...',
      note: ''
    });

    try {
      const audioBlob = await audioRecorder.stop();

      if (!audioBlob || audioBlob.size < 1000) {
        this.onErrorCallback?.('Recording too short. Please speak for at least 3-5 seconds.');
        return;
      }

      const audioBase64 = await audioRecorder.blobToBase64(audioBlob);
      await this.processAudioWithSmartClinicalAI(audioBase64, audioBlob.type);

    } catch (error) {
      this.onErrorCallback?.(`Failed to process: ${(error as Error).message}`);
    }
  }

  /**
   * Smart Clinical AI Processing
   * Understands medical shorthand and expands to proper documentation
   */
  private async processAudioWithSmartClinicalAI(audioBase64: string, mimeType: string): Promise<void> {
    try {
      // Determine age group for normal values
      const ageGroup = this.getAgeGroup();
      const normalVitals = NORMAL_VITAL_RANGES[ageGroup];

      const prompt = `You are an expert NICU/PICU medical scribe AI that understands clinical shorthand.

=== PATIENT CONTEXT ===
${this.patientContext ? `
- Age: ${this.patientContext.age} ${this.patientContext.ageUnit || 'days'}
- Age Group: ${ageGroup}
- Gender: ${this.patientContext.gender || 'Unknown'}
- Unit: ${this.patientContext.unit || 'NICU'}
- Diagnosis: ${this.patientContext.diagnosis || 'Not specified'}
- Weight: ${this.patientContext.weight || 'Unknown'} kg
` : 'No patient context provided'}

=== NORMAL REFERENCE VALUES FOR ${ageGroup.toUpperCase()} ===
- Temperature: ${normalVitals.temperature}°C
- Heart Rate: ${normalVitals.hr} bpm
- Respiratory Rate: ${normalVitals.rr}/min
- Blood Pressure: ${normalVitals.bp} mmHg
- SpO2: ${normalVitals.spo2}%
- CRT: ${normalVitals.crt} seconds

=== NORMAL EXAMINATION FINDINGS ===
- CNS: ${NORMAL_EXAMINATION.cns}
- CVS: ${NORMAL_EXAMINATION.cvs}
- Chest: ${NORMAL_EXAMINATION.chest}
- Abdomen: ${NORMAL_EXAMINATION.perAbdomen}
- Other: ${NORMAL_EXAMINATION.otherFindings}

=== YOUR TASK ===
Listen to the audio and INTELLIGENTLY interpret clinical shorthand:

1. **"All vitals normal"** or **"vitals stable"** → Generate appropriate normal vitals for age group (pick mid-range values)
2. **"Vitals normal except HR 150"** → Normal vitals but use HR=150
3. **"Other vitals normal, temperature 38"** → Use temp=38, generate normal for others
4. **"All systems normal"** or **"systemic examination normal"** → Fill ALL examination fields with normal findings
5. **"CNS CVS Chest Abdomen - all normal"** → Normal findings for all systems
6. **"Baby stable"** or **"clinically stable"** → Normal vitals AND normal examination
7. **Specific findings override normal** → If they mention specific abnormalities, use those

=== INTERPRETATION RULES ===
- When "normal" is mentioned, USE the normal reference values above
- Pick realistic mid-range values (e.g., for HR 120-160, use 140)
- Any specifically mentioned value OVERRIDES the normal
- Understand Indian English medical terminology
- "All WNL" = Within Normal Limits = Normal
- "NAD" = No Abnormality Detected = Normal
- "Unremarkable" = Normal

=== OUTPUT FORMAT ===
Return ONLY valid JSON:
{
  "transcript": "Exact transcription of what was spoken",
  "interpretation": "How you interpreted the shorthand (e.g., 'Expanded all systems normal')",
  "vitals": {
    "temperature": "37.0",
    "hr": "140",
    "rr": "48",
    "bp": "65/40",
    "spo2": "97",
    "crt": "<2",
    "weight": ""
  },
  "examination": {
    "cns": "Alert, active, good cry, normal tone, normal reflexes, anterior fontanelle soft and flat",
    "cvs": "S1S2 heard, no murmur, regular rhythm, CRT <2s, peripheral pulses well felt, warm peripheries",
    "chest": "Bilateral equal air entry, no added sounds, no retractions, no grunting, normal effort",
    "perAbdomen": "Soft, non-distended, bowel sounds present, no organomegaly, tolerating feeds",
    "otherFindings": "Pink, well perfused, no rash, activity appropriate for age"
  },
  "medications": [],
  "note": "Clinical summary in proper format",
  "confidence": 0.95
}

=== EXAMPLES ===

Example 1: "Baby stable, all vitals normal, all systems normal"
→ Generate ALL normal vitals (mid-range for age) and ALL normal examination findings

Example 2: "Vitals - temperature 38.2, other vitals normal. Systemic examination - all WNL"
→ Temp=38.2, other vitals normal for age, all examination normal

Example 3: "HR 160, RR 55, saturation 94 on room air, other vitals normal. Baby active, chest has mild retractions, rest of exam normal"
→ Use mentioned vitals, normal for unmentioned. Chest shows retractions, other systems normal.

Example 4: "Baby irritable, temperature 38, heart rate 170, examination shows bulging fontanelle"
→ Use mentioned abnormal values, interpret CNS as abnormal with bulging fontanelle

IMPORTANT: Return ONLY the JSON object. No markdown, no explanations.`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType.includes('webm') ? 'audio/webm' : mimeType,
                  data: audioBase64
                }
              },
              { text: prompt }
            ]
          }
        ]
      });

      let responseText = response.text.trim();
      console.log('📝 Gemini response:', responseText);

      // Clean response
      responseText = responseText.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '');
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        responseText = jsonMatch[0];
      }

      const structured: StructuredClinicalData & { interpretation?: string } = JSON.parse(responseText);

      // Log interpretation for debugging
      if ((structured as any).interpretation) {
        console.log('🧠 AI Interpretation:', (structured as any).interpretation);
      }

      const progressNote: Partial<ProgressNote> & { rawTranscript?: string; confidence?: number } = {
        vitals: structured.vitals && Object.values(structured.vitals).some(v => v)
          ? (structured.vitals as VitalSigns)
          : undefined,
        examination: structured.examination && Object.values(structured.examination).some(v => v)
          ? (structured.examination as ClinicalExamination)
          : undefined,
        medications: structured.medications && structured.medications.length > 0
          ? structured.medications
          : undefined,
        note: structured.note || '',
        rawTranscript: structured.transcript || 'Audio processed',
        confidence: structured.confidence || 0.8,
      };

      this.onUpdateCallback?.(progressNote);

    } catch (error: any) {
      console.error('❌ Processing error:', error);
      this.onErrorCallback?.(`AI processing failed: ${error.message}`);
    }
  }

  /**
   * Determine age group based on patient context
   */
  private getAgeGroup(): keyof typeof NORMAL_VITAL_RANGES {
    if (!this.patientContext) return 'newborn';

    const age = this.patientContext.age;
    const unit = this.patientContext.ageUnit || 'days';

    // Convert to days for comparison
    let ageInDays = age;
    if (unit === 'weeks') ageInDays = age * 7;
    else if (unit === 'months') ageInDays = age * 30;
    else if (unit === 'years') ageInDays = age * 365;

    // Check diagnosis for preterm indicators
    const diagnosis = (this.patientContext.diagnosis || '').toLowerCase();
    if (diagnosis.includes('preterm') || diagnosis.includes('premature') || diagnosis.includes('vlbw') || diagnosis.includes('elbw')) {
      return 'preterm';
    }

    // Age-based classification
    if (ageInDays <= 28) return 'newborn';
    if (ageInDays <= 365) return 'infant';
    if (ageInDays <= 365 * 3) return 'toddler';
    return 'child';
  }

  getIsListening(): boolean {
    return this.isRecording;
  }

  abort(): void {
    audioRecorder.abort();
    this.isRecording = false;
  }

  setPatientContext(context: PatientContext): void {
    this.patientContext = context;
  }

  getCurrentTranscript(): string {
    return '';
  }

  clearTranscript(): void {}

  async manualProcess(): Promise<void> {}
}

// Singleton
let voiceScribeInstance: VoiceScribeService | null = null;

export const getVoiceScribeService = (): VoiceScribeService => {
  if (!voiceScribeInstance) {
    voiceScribeInstance = new VoiceScribeService();
  }
  return voiceScribeInstance;
};

export default VoiceScribeService;
