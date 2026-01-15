/**
 * OpenAI Whisper Service for Speech-to-Text
 *
 * Uses Whisper API for accurate medical transcription
 */

const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

export interface WhisperResponse {
  text: string;
  language?: string;
  duration?: number;
}

/**
 * Transcribe audio using OpenAI Whisper
 * @param audioBlob - Audio blob to transcribe
 * @param language - Language hint (optional, default: en)
 * @returns Transcribed text
 */
export const transcribeWithWhisper = async (
  audioBlob: Blob,
  language: string = 'en'
): Promise<string> => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Add VITE_OPENAI_API_KEY to .env');
  }

  // Create form data with audio file
  const formData = new FormData();

  // Convert blob to file with proper extension
  const audioFile = new File([audioBlob], 'audio.webm', {
    type: audioBlob.type || 'audio/webm'
  });

  formData.append('file', audioFile);
  formData.append('model', 'whisper-1');
  formData.append('language', language);
  formData.append('response_format', 'json');

  // Medical terminology prompt for better accuracy
  formData.append('prompt',
    'Medical clinical note transcription. Common terms: temperature, heart rate, respiratory rate, ' +
    'SpO2, blood pressure, CRT, CNS, CVS, chest, per abdomen, bilateral, air entry, bowel sounds, ' +
    'retractions, grunting, fontanelle, hepatomegaly, splenomegaly, crepitations, wheeze, murmur, ' +
    'tachycardia, bradycardia, hypotonia, hypertonia, seizures, apnea, cyanosis, jaundice, ' +
    'NICU, PICU, preterm, newborn, neonate, sepsis, RDS, NEC, HIE, IVH, PDA'
  );

  console.log('🎤 Sending audio to Whisper API...');

  try {
    const response = await fetch(WHISPER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Whisper API error: ${response.status}`);
    }

    const data: WhisperResponse = await response.json();
    console.log('✅ Whisper transcription:', data.text);

    return data.text;

  } catch (error: any) {
    console.error('❌ Whisper transcription error:', error);
    throw new Error(`Transcription failed: ${error.message}`);
  }
};

/**
 * Check if Whisper API is configured
 */
export const isWhisperConfigured = (): boolean => {
  return !!import.meta.env.VITE_OPENAI_API_KEY;
};

export default {
  transcribe: transcribeWithWhisper,
  isConfigured: isWhisperConfigured
};
