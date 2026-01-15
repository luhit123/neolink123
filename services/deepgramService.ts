/**
 * Deepgram Speech-to-Text Service
 *
 * Uses Deepgram API for medical speech transcription
 * Optimized for clinical terminology and medical dictation
 *
 * Model: Nova-3 (Latest and most accurate Deepgram model)
 * Features: Punctuation, numerals, smart formatting, real-time streaming
 *
 * Supports:
 * - Live streaming transcription (real-time)
 * - Pre-recorded transcription (batch)
 */

/**
 * Check if Deepgram is configured
 */
export const isDeepgramConfigured = (): boolean => {
  return !!import.meta.env.VITE_DEEPGRAM_API_KEY;
};

/**
 * Live streaming transcription connection
 */
let liveConnection: WebSocket | null = null;
let mediaRecorder: MediaRecorder | null = null;

/**
 * Get Deepgram API key from environment
 */
const getDeepgramApiKey = (): string => {
  const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error('Deepgram API key not configured. Please set VITE_DEEPGRAM_API_KEY in .env file');
  }
  return apiKey;
};

/**
 * Medical keywords and phrases to enhance transcription accuracy
 */
const MEDICAL_KEYWORDS = [
  // Vitals
  'temperature', 'heart rate', 'respiratory rate', 'SpO2', 'blood pressure', 'oxygen saturation',
  'capillary refill time', 'CRT', 'weight', 'temp', 'HR', 'RR', 'BP',

  // Respiratory
  'CPAP', 'PEEP', 'FiO2', 'PIP', 'MAP', 'SIMV', 'IPPV', 'HFOV', 'HFNC',
  'ventilator', 'intubated', 'extubated', 'air entry', 'bilateral', 'breath sounds',
  'retractions', 'subcostal', 'intercostal', 'grunting', 'nasal flaring',
  'tachypnea', 'apnea', 'desaturation', 'crepitations', 'wheeze',

  // CNS
  'alert', 'active', 'lethargic', 'irritable', 'encephalopathic',
  'fontanelle', 'bulging', 'seizures', 'tone', 'hypotonia', 'hypertonia',
  'Moro reflex', 'suck reflex', 'grasp reflex',

  // CVS
  'S1', 'S2', 'heart sounds', 'murmur', 'tachycardia', 'bradycardia',
  'cyanosis', 'perfusion', 'pulses', 'femoral', 'brachial',

  // Abdomen
  'soft', 'distended', 'tender', 'bowel sounds', 'hepatomegaly', 'splenomegaly',

  // Medications
  'vancomycin', 'ampicillin', 'gentamicin', 'phenobarbitone', 'phenobarbital',
  'dopamine', 'dobutamine', 'adrenaline', 'epinephrine', 'surfactant',
  'inj', 'injection', 'tablet', 'syrup', 'milligram', 'microgram',

  // Diagnoses
  'RDS', 'respiratory distress syndrome', 'sepsis', 'pneumonia', 'meconium aspiration',
  'HIE', 'hypoxic ischemic encephalopathy', 'NEC', 'necrotizing enterocolitis',
  'prematurity', 'jaundice', 'hyperbilirubinemia',

  // Common phrases
  'within normal limits', 'WNL', 'no abnormality detected', 'NAD'
];

/**
 * Transcribe audio using Deepgram API
 * @param audioBlob - Audio blob to transcribe
 * @param onProgress - Optional callback for progress updates
 * @returns Transcribed text
 */
export const transcribeWithDeepgram = async (
  audioBlob: Blob,
  onProgress?: (status: string) => void
): Promise<string> => {
  try {
    onProgress?.('Initializing Deepgram transcription...');
    console.log('🎤 Sending audio to Deepgram for medical transcription...');

    const apiKey = getDeepgramApiKey();

    onProgress?.('Processing audio...');

    // Deepgram API endpoint for pre-recorded audio
    const url = 'https://api.deepgram.com/v1/listen';

    // Build query parameters
    const params = new URLSearchParams({
      model: 'nova-3', // Latest Nova-3 model with superior accuracy
      punctuate: 'true', // Add punctuation
      numerals: 'true', // Convert numbers to digits
      profanity_filter: 'false', // Don't filter medical terms
      diarize: 'false', // Single speaker
      smart_format: 'true', // Smart formatting for better readability
      utterances: 'false', // Don't split by utterances
      language: 'en-US' // English (US)
    });

    // Add medical keywords if supported
    if (MEDICAL_KEYWORDS.length > 0) {
      params.append('keywords', MEDICAL_KEYWORDS.slice(0, 100).join(','));
    }

    // Make request to Deepgram
    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': audioBlob.type || 'audio/webm'
      },
      body: audioBlob
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Deepgram API error:', errorText);
      throw new Error(`Deepgram API error: ${response.status} ${response.statusText}`);
    }

    onProgress?.('Parsing transcription...');

    const result = await response.json();

    // Extract transcript from Deepgram response
    const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    if (!transcript) {
      throw new Error('No transcription returned from Deepgram');
    }

    console.log('✅ Deepgram transcription complete:', transcript);
    onProgress?.('Transcription complete');

    return transcript.trim();

  } catch (error: any) {
    console.error('❌ Deepgram transcription error:', error);

    // Provide helpful error messages
    if (error.message.includes('401')) {
      throw new Error('Deepgram authentication failed. Please check your API key.');
    } else if (error.message.includes('429')) {
      throw new Error('Deepgram rate limit exceeded. Please wait and try again.');
    } else if (error.message.includes('network')) {
      throw new Error('Network error. Please check your internet connection.');
    }

    throw new Error(`Deepgram transcription failed: ${error.message}`);
  }
};

/**
 * Transcribe audio from base64 data
 * @param audioBase64 - Base64 encoded audio data
 * @param onProgress - Optional callback for progress updates
 * @returns Transcribed text
 */
export const transcribeBase64 = async (
  audioBase64: string,
  onProgress?: (status: string) => void
): Promise<string> => {
  // Convert base64 to blob
  const byteCharacters = atob(audioBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const audioBlob = new Blob([byteArray], { type: 'audio/webm' });

  return transcribeWithDeepgram(audioBlob, onProgress);
};

/**
 * Test Deepgram connection
 */
export const testDeepgramConnection = async (): Promise<boolean> => {
  try {
    const apiKey = getDeepgramApiKey();

    // Test with Deepgram's balance endpoint
    const response = await fetch('https://api.deepgram.com/v1/projects', {
      method: 'GET',
      headers: {
        'Authorization': `Token ${apiKey}`
      }
    });

    return response.ok;
  } catch (error) {
    console.error('Deepgram connection test failed:', error);
    return false;
  }
};

/**
 * Start live streaming transcription
 * @param onTranscript - Callback for real-time transcript updates
 * @param onError - Callback for errors
 * @returns Promise<void>
 */
export const startLiveTranscription = async (
  onTranscript: (text: string, isFinal: boolean) => void,
  onError?: (error: string) => void
): Promise<void> => {
  try {
    const apiKey = getDeepgramApiKey();

    // Build WebSocket URL for live streaming
    const params = new URLSearchParams({
      model: 'nova-3', // Latest Nova-3 model with superior accuracy
      punctuate: 'true',
      interim_results: 'true', // Get interim results for real-time display
      smart_format: 'true',
      language: 'en-US'
      // encoding and sample_rate not needed for WebM/Opus
    });

    const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

    // Create WebSocket connection
    liveConnection = new WebSocket(wsUrl, ['token', apiKey]);

    // Wait for WebSocket to open before starting audio streaming
    await new Promise<void>((resolve, reject) => {
      liveConnection!.onopen = () => {
        console.log('✅ Deepgram WebSocket connection opened successfully');
        console.log('🎤 Ready to stream audio...');
        resolve();
      };

      liveConnection!.onerror = (error) => {
        console.error('Deepgram WebSocket error:', error);
        reject(new Error('Failed to connect to Deepgram'));
      };

      // Timeout after 10 seconds
      setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
    });

    // Set up message handlers after connection is open
    liveConnection.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);
        const transcript = data?.channel?.alternatives?.[0]?.transcript;
        const isFinal = data?.is_final || false;

        if (transcript && transcript.trim()) {
          onTranscript(transcript, isFinal);
        }
      } catch (err) {
        console.error('Error parsing Deepgram message:', err);
      }
    };

    liveConnection.onerror = (error) => {
      console.error('Deepgram WebSocket error:', error);
      onError?.('Connection error occurred');
    };

    liveConnection.onclose = () => {
      console.log('🎤 Deepgram live connection closed');
      liveConnection = null;
    };

    // Get user media and start streaming
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    // Create MediaRecorder to capture audio
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    let chunkCount = 0;
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && liveConnection?.readyState === WebSocket.OPEN) {
        chunkCount++;
        if (chunkCount === 1 || chunkCount % 10 === 0) {
          console.log(`📤 Sending audio chunk #${chunkCount} (${event.data.size} bytes)`);
        }
        liveConnection.send(event.data);
      } else if (event.data.size > 0) {
        console.warn('⚠️ WebSocket not ready, cannot send audio data');
      }
    };

    // Start recording with small time slices for real-time streaming
    mediaRecorder.start(250); // Send data every 250ms
    console.log('🎙️ MediaRecorder started, streaming audio chunks every 250ms');

  } catch (error: any) {
    console.error('❌ Failed to start live transcription:', error);
    onError?.(`Failed to start: ${error.message}`);
    throw error;
  }
};

/**
 * Stop live streaming transcription
 */
export const stopLiveTranscription = (): void => {
  try {
    // Stop media recorder
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();

      // Stop all tracks
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      mediaRecorder = null;
    }

    // Close WebSocket connection
    if (liveConnection && liveConnection.readyState === WebSocket.OPEN) {
      // Send close message
      liveConnection.send(JSON.stringify({ type: 'CloseStream' }));
      liveConnection.close();
      liveConnection = null;
    }

    console.log('🎤 Live transcription stopped');
  } catch (error) {
    console.error('Error stopping live transcription:', error);
  }
};

export default {
  transcribe: transcribeWithDeepgram,
  transcribeBase64,
  isConfigured: isDeepgramConfigured,
  testConnection: testDeepgramConnection,
  startLive: startLiveTranscription,
  stopLive: stopLiveTranscription
};
