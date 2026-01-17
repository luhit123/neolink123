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
let audioChunkBuffer: Blob[] = []; // Buffer to hold audio chunks while WebSocket connects
let isWebSocketReady = false; // Track WebSocket ready state
let connectionRetryCount = 0;
const MAX_RETRY_COUNT = 3;

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
 * Send buffered audio chunks once WebSocket is ready
 */
const flushAudioBuffer = () => {
  if (liveConnection?.readyState === WebSocket.OPEN && audioChunkBuffer.length > 0) {
    console.log(`📤 Flushing ${audioChunkBuffer.length} buffered audio chunks...`);
    audioChunkBuffer.forEach((chunk, index) => {
      liveConnection!.send(chunk);
      if (index === 0 || (index + 1) % 5 === 0) {
        console.log(`📤 Sent buffered chunk ${index + 1}/${audioChunkBuffer.length}`);
      }
    });
    audioChunkBuffer = [];
  }
};

/**
 * Start live streaming transcription
 * @param onTranscript - Callback for real-time transcript updates
 * @param onError - Callback for errors
 * @param onReady - Callback when WebSocket is ready (optional)
 * @returns Promise with the MediaStream (for visualization)
 */
export const startLiveTranscription = async (
  onTranscript: (text: string, isFinal: boolean) => void,
  onError?: (error: string) => void,
  onReady?: () => void
): Promise<MediaStream> => {
  const apiKey = getDeepgramApiKey();

  // Reset state
  audioChunkBuffer = [];
  isWebSocketReady = false;
  connectionRetryCount = 0;

  // Get microphone FIRST
  console.log('🎤 Requesting microphone access...');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });
  console.log('✅ Microphone access granted');

  // Build WebSocket URL for live streaming
  const params = new URLSearchParams({
    model: 'nova-2', // Use nova-2 for better compatibility
    punctuate: 'true',
    interim_results: 'true',
    smart_format: 'true',
    language: 'en-US'
  });

  const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
  console.log('🔌 Connecting to Deepgram WebSocket...');

  // Create WebSocket connection with API key in subprotocol
  liveConnection = new WebSocket(wsUrl, ['token', apiKey]);

  // Set up all handlers before waiting
  liveConnection.onmessage = (message) => {
    try {
      const data = JSON.parse(message.data);
      const transcript = data?.channel?.alternatives?.[0]?.transcript;
      const isFinal = data?.is_final || false;

      if (transcript && transcript.trim()) {
        console.log(`📝 Transcript (${isFinal ? 'final' : 'interim'}): ${transcript}`);
        onTranscript(transcript, isFinal);
      }
    } catch (err) {
      console.error('Error parsing Deepgram message:', err);
    }
  };

  liveConnection.onerror = (error) => {
    console.error('❌ Deepgram WebSocket error:', error);
    isWebSocketReady = false;
    onError?.('Connection error occurred');
  };

  liveConnection.onclose = (event) => {
    console.log(`🔌 WebSocket closed: code=${event.code}, reason=${event.reason}`);
    isWebSocketReady = false;
    liveConnection = null;
  };

  // Wait for WebSocket to open
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('WebSocket connection timeout'));
    }, 10000);

    liveConnection!.onopen = () => {
      clearTimeout(timeout);
      isWebSocketReady = true;
      console.log('✅ Deepgram WebSocket connected!');
      flushAudioBuffer();
      onReady?.();
      resolve();
    };

    // Also handle error during connection
    const originalOnError = liveConnection!.onerror;
    liveConnection!.onerror = (error) => {
      clearTimeout(timeout);
      originalOnError?.(error as Event);
      reject(new Error('WebSocket connection failed'));
    };
  });

  // Create MediaRecorder AFTER WebSocket is ready
  mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus'
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0 && liveConnection?.readyState === WebSocket.OPEN) {
      liveConnection.send(event.data);
    }
  };

  // Start streaming audio
  mediaRecorder.start(250);
  console.log('🎙️ Recording started - streaming to Deepgram');

  return stream;
};

/**
 * Stop live streaming transcription
 */
export const stopLiveTranscription = (): void => {
  try {
    // Clear state
    isWebSocketReady = false;
    audioChunkBuffer = [];
    connectionRetryCount = 0;

    // Stop media recorder
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();

      // Stop all tracks
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      mediaRecorder = null;
    }

    // Close WebSocket connection
    if (liveConnection) {
      if (liveConnection.readyState === WebSocket.OPEN) {
        // Send close message
        try {
          liveConnection.send(JSON.stringify({ type: 'CloseStream' }));
        } catch (e) {
          // Ignore send errors on close
        }
      }
      liveConnection.close();
      liveConnection = null;
    }

    console.log('🎤 Live transcription stopped');
  } catch (error) {
    console.error('Error stopping live transcription:', error);
    // Force cleanup
    liveConnection = null;
    mediaRecorder = null;
    isWebSocketReady = false;
    audioChunkBuffer = [];
  }
};

/**
 * Check if live transcription WebSocket is ready
 */
export const isLiveTranscriptionReady = (): boolean => {
  return isWebSocketReady && liveConnection?.readyState === WebSocket.OPEN;
};

export default {
  transcribe: transcribeWithDeepgram,
  transcribeBase64,
  isConfigured: isDeepgramConfigured,
  testConnection: testDeepgramConnection,
  startLive: startLiveTranscription,
  stopLive: stopLiveTranscription,
  isLiveReady: isLiveTranscriptionReady
};
