/**
 * Medical Speech-to-Text Service
 *
 * Uses Google Gemini for medical transcription
 * Optimized for clinical terminology and medical dictation
 */

import { callGeminiProxy } from './aiProxyClient';

/**
 * Check if transcription service is configured
 */
export const isMedAsrConfigured = (): boolean => true;

/**
 * Transcribe audio using Gemini with medical terminology optimization
 * @param audioBase64 - Base64 encoded audio data
 * @param onProgress - Optional callback for progress updates
 * @returns Transcribed text
 */
export const transcribeWithMedAsr = async (
  audioBase64: string,
  onProgress?: (status: string) => void
): Promise<string> => {
  const PROMPT = `You are an expert medical transcriptionist specialized in NICU/PICU clinical documentation. Transcribe this clinical dictation with 100% accuracy.

MEDICAL VOCABULARY TO RECOGNIZE:

VITALS & MEASUREMENTS:
- Temperature (temp), Heart Rate (HR), Respiratory Rate (RR), SpO2, saturation
- Blood Pressure (BP), systolic, diastolic, MAP, Mean Arterial Pressure
- CRT (Capillary Refill Time), Weight, Head circumference, Length

RESPIRATORY:
- CPAP, PEEP, FiO2, PIP, MAP (in ventilation context)
- SIMV, IPPV, HFOV, HFNC, High Flow, nasal prongs
- Ventilator, intubated, extubated, self-ventilating
- Air entry (AE), bilateral (B/L), breath sounds, crepitations, wheeze, rhonchi
- Retractions (subcostal, intercostal, suprasternal), grunting, nasal flaring
- Tachypnea, apnea, desaturation

CNS:
- Alert, active, lethargic, irritable, encephalopathic
- Tone (normal, hypotonia, hypertonia), reflexes (Moro, suck, grasp)
- Fontanelle (AF - anterior fontanelle), bulging, flat, sunken
- Seizures, jitteriness, tremors

CVS:
- S1, S2, heart sounds, murmur (grade, systolic, diastolic)
- Pulses (femoral, brachial, peripheral), perfusion
- Tachycardia, bradycardia, cyanosis (central, peripheral)

ABDOMEN (P/A - Per Abdomen):
- Soft, distended, scaphoid, tender
- Bowel sounds (BS), present, absent, sluggish
- Hepatomegaly, splenomegaly, organomegaly
- Umbilicus, granuloma, omphalitis

INOTROPES/VASOPRESSORS:
- Dopamine, Dobutamine, Adrenaline, Noradrenaline, Epinephrine, Norepinephrine
- mcg/kg/min, titrate, wean

FLUIDS & FEEDS:
- TPN, Lipids, IV fluids, maintenance fluids, DNS, NS, RL
- EBM, formula, NEC feeds, trophic feeds, breast milk
- ml/kg/day, ml/hr, bolus

COMMON PHRASES:
- All normal, within normal limits (WNL), no abnormality detected (NAD)
- Stable, improving, deteriorating, guarded
- Continue current treatment, same treatment, plan to wean

RULES:
1. Transcribe EXACTLY what is spoken
2. Preserve all numbers and measurements precisely
3. Use standard medical abbreviations where spoken
4. Do NOT add any interpretation or formatting
5. Return ONLY the transcribed text`;

  try {
    onProgress?.('Initializing transcription...');
    console.log('🎤 Sending audio to Gemini for medical transcription...');

    onProgress?.('Processing audio...');

    const response = await callGeminiProxy({
      model: 'gemini-2.5-pro',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'audio/webm', data: audioBase64 } },
          { text: PROMPT }
        ]
      }]
    });

    const transcription = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    console.log('✅ Transcription complete:', transcription);
    onProgress?.('Transcription complete');

    return transcription;

  } catch (error: any) {
    console.error('❌ Transcription error:', error);
    throw new Error(`Transcription failed: ${error.message}`);
  }
};

/**
 * Transcribe audio blob
 * @param audioBlob - Audio blob to transcribe
 * @param onProgress - Optional callback for progress updates
 * @returns Transcribed text
 */
export const transcribeAudioBlob = async (
  audioBlob: Blob,
  onProgress?: (status: string) => void
): Promise<string> => {
  // Convert blob to base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix if present
      const base64Data = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });

  return transcribeWithMedAsr(base64, onProgress);
};

export default {
  transcribe: transcribeWithMedAsr,
  transcribeBlob: transcribeAudioBlob,
  isConfigured: isMedAsrConfigured
};
