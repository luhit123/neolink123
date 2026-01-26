/**
 * ElevenLabs Speech-to-Text Service
 *
 * Uses ElevenLabs Scribe API for medical speech transcription
 * Supports both batch and real-time transcription
 *
 * API Documentation: https://elevenlabs.io/docs/api-reference/speech-to-text
 */

// ElevenLabs API configuration
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/speech-to-text';

/**
 * Get ElevenLabs API key from environment
 */
const getElevenLabsApiKey = (): string => {
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured. Please set VITE_ELEVENLABS_API_KEY in .env file');
  }
  return apiKey;
};

/**
 * Check if ElevenLabs is configured
 */
export const isElevenLabsConfigured = (): boolean => {
  return !!import.meta.env.VITE_ELEVENLABS_API_KEY;
};

/**
 * Medical keyterms to improve transcription accuracy
 */
const MEDICAL_KEYTERMS = [
  'adrenaline', 'epinephrine', 'noradrenaline', 'dopamine', 'dobutamine',
  'vancomycin', 'ampicillin', 'gentamicin', 'meropenem', 'cefotaxime',
  'phenobarbital', 'phenobarbitone', 'midazolam', 'fentanyl', 'morphine',
  'furosemide', 'lasix', 'spironolactone', 'caffeine', 'aminophylline',
  'surfactant', 'CPAP', 'PEEP', 'FiO2', 'ventilator', 'intubation',
  'tachycardia', 'bradycardia', 'desaturation', 'apnea', 'cyanosis',
  'fontanelle', 'hypotonia', 'hypertonia', 'seizures', 'lethargy',
  'hepatomegaly', 'splenomegaly', 'distension', 'bowel sounds',
  'jaundice', 'phototherapy', 'bilirubin', 'sepsis', 'meningitis',
  'RDS', 'TTN', 'MAS', 'NEC', 'PDA', 'IVH', 'BPD', 'HIE',
  'NICU', 'PICU', 'neonate', 'preterm', 'term', 'gestational age',
  'SpO2', 'saturation', 'oxygen', 'respiratory rate', 'heart rate',
  'blood pressure', 'temperature', 'weight', 'feeding', 'TPN',
  'umbilical catheter', 'UVC', 'UAC', 'PICC', 'peripheral IV',
  'chest x-ray', 'CXR', 'ABG', 'CBC', 'CRP', 'blood culture',
  'lumbar puncture', 'CSF', 'electrolytes', 'glucose', 'calcium'
];

/**
 * Convert audio blob to WAV format for better compatibility
 */
const convertToWav = async (audioBlob: Blob): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const audioContext = new AudioContext();
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Convert to WAV
        const wavBuffer = audioBufferToWav(audioBuffer);
        const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

        audioContext.close();
        resolve(wavBlob);
      } catch (err) {
        audioContext.close();
        reject(err);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(audioBlob);
  });
};

/**
 * Convert AudioBuffer to WAV format
 */
const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const samples = buffer.length;
  const dataSize = samples * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write audio data
  const offset = 44;
  const channelData: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channelData.push(buffer.getChannelData(i));
  }

  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset + (i * blockAlign) + (ch * bytesPerSample), intSample, true);
    }
  }

  return arrayBuffer;
};

/**
 * Transcribe audio using ElevenLabs API (batch/synchronous)
 * @param audioBlob - Audio blob to transcribe
 * @param onProgress - Optional callback for progress updates
 * @returns Transcribed text
 */
export const transcribeWithElevenLabs = async (
  audioBlob: Blob,
  onProgress?: (status: string) => void
): Promise<string> => {
  try {
    onProgress?.('Initializing ElevenLabs transcription...');
    console.log('🎤 Sending audio to ElevenLabs for transcription...');

    const apiKey = getElevenLabsApiKey();

    // Convert webm to WAV for better compatibility
    onProgress?.('Converting audio format...');
    let audioToSend: Blob;
    let filename: string;

    try {
      audioToSend = await convertToWav(audioBlob);
      filename = 'recording.wav';
      console.log('✅ Converted to WAV:', audioToSend.size, 'bytes');
    } catch (conversionError) {
      console.warn('WAV conversion failed, using original format:', conversionError);
      audioToSend = audioBlob;
      filename = 'recording.webm';
    }

    onProgress?.('Uploading audio...');

    // Create form data
    const formData = new FormData();
    formData.append('file', audioToSend, filename);
    formData.append('model_id', 'scribe_v1');  // Use Scribe v1 model
    formData.append('language_code', 'en');
    formData.append('diarize', 'false');
    formData.append('tag_audio_events', 'false');
    formData.append('timestamps_granularity', 'none');

    onProgress?.('Transcribing with ElevenLabs Scribe...');

    const response = await fetch(ELEVENLABS_API_URL, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', errorText);
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('📤 ElevenLabs response:', result);

    // Extract transcript from response
    let transcript = '';

    if (result.text) {
      transcript = result.text;
    } else if (result.transcription) {
      transcript = result.transcription;
    } else if (result.chunks && Array.isArray(result.chunks)) {
      transcript = result.chunks.map((chunk: any) => chunk.text || '').join(' ');
    }

    if (!transcript) {
      console.warn('No transcript in response:', result);
      throw new Error('No transcript returned from ElevenLabs');
    }

    console.log('✅ ElevenLabs transcription complete:', transcript);
    onProgress?.('Transcription complete');

    return transcript.trim();

  } catch (error: any) {
    console.error('❌ ElevenLabs transcription error:', error);

    if (error.message.includes('401') || error.message.includes('403')) {
      throw new Error('ElevenLabs authentication failed. Please check your API key.');
    } else if (error.message.includes('429')) {
      throw new Error('ElevenLabs rate limit exceeded. Please wait and try again.');
    } else if (error.message.includes('network') || error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }

    throw new Error(`ElevenLabs transcription failed: ${error.message}`);
  }
};

// Live transcription state
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let mediaStream: MediaStream | null = null;
let websocket: WebSocket | null = null;
let audioContext: AudioContext | null = null;
let scriptProcessor: ScriptProcessorNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;

// WebSocket streaming endpoint (Scribe v2 Realtime)
const ELEVENLABS_WS_URL = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime';

/**
 * Convert Float32Array to Int16Array for streaming
 */
const float32ToInt16 = (float32Array: Float32Array): Int16Array => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16Array;
};

/**
 * Start REAL-TIME streaming transcription with ElevenLabs WebSocket
 * Audio is sent live as you speak, transcription appears instantly
 *
 * @param onTranscript - Callback for real-time transcript updates
 * @param onError - Callback for errors
 * @param onReady - Callback when ready to record
 * @returns Promise with the MediaStream (for visualization)
 */
export const startLiveTranscription = async (
  onTranscript: (text: string, isFinal: boolean) => void,
  onError?: (error: string) => void,
  onReady?: () => void
): Promise<MediaStream> => {
  // Reset state
  recordedChunks = [];

  const apiKey = getElevenLabsApiKey();

  // Get microphone
  console.log('🎤 Requesting microphone access...');
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 16000
    }
  });
  console.log('✅ Microphone access granted');

  // Also start MediaRecorder as fallback
  mediaRecorder = new MediaRecorder(mediaStream, {
    mimeType: 'audio/webm;codecs=opus'
  });
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };
  mediaRecorder.start();

  // Setup WebSocket for real-time streaming
  console.log('🔌 Connecting to ElevenLabs Realtime WebSocket...');

  try {
    // Connect with API key as query parameter (for browser-side auth)
    const wsUrl = `${ELEVENLABS_WS_URL}?xi-api-key=${apiKey}`;
    websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('✅ WebSocket connected to ElevenLabs Realtime');
      // Start audio processing immediately - no config message needed
      setupAudioProcessing(onTranscript, onError);
      onReady?.();
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📥 WebSocket message:', data.message_type);

        if (data.message_type === 'session_started') {
          console.log('✅ Session started:', data.session_id);
        } else if (data.message_type === 'partial_transcript') {
          // Real-time partial results as user speaks
          const text = data.text || '';
          if (text) {
            console.log(`📝 Partial: ${text}`);
            onTranscript(text, false);
          }
        } else if (data.message_type === 'committed_transcript' || data.message_type === 'committed_transcript_with_timestamps') {
          // Final committed transcript
          const text = data.text || '';
          if (text) {
            console.log(`📝 Final: ${text}`);
            onTranscript(text, true);
          }
        } else if (data.message_type === 'error' || data.message_type?.includes('error')) {
          console.error('❌ WebSocket error from server:', data);
          onError?.(data.message || data.error || 'Transcription error');
        }
      } catch (e) {
        console.log('📥 WebSocket non-JSON message:', event.data);
      }
    };

    websocket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      onError?.('WebSocket connection error');
    };

    websocket.onclose = (event) => {
      console.log('🔌 WebSocket closed:', event.code, event.reason);
    };

  } catch (wsError) {
    console.error('❌ Failed to create WebSocket:', wsError);
    // Fall back to batch mode - still return stream for recording
    onReady?.();
  }

  return mediaStream;
};

/**
 * Setup audio processing to stream audio chunks to WebSocket
 */
const setupAudioProcessing = (
  onTranscript: (text: string, isFinal: boolean) => void,
  onError?: (error: string) => void
) => {
  if (!mediaStream || !websocket) return;

  try {
    audioContext = new AudioContext({ sampleRate: 16000 });
    sourceNode = audioContext.createMediaStreamSource(mediaStream);

    // Use ScriptProcessorNode for audio processing (deprecated but widely supported)
    // Buffer size of 4096 at 16kHz = 256ms chunks
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

    scriptProcessor.onaudioprocess = (event) => {
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        const inputData = event.inputBuffer.getChannelData(0);
        const pcmData = float32ToInt16(inputData);

        // Send audio chunk in ElevenLabs Realtime format
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));

        const audioMessage = {
          message_type: 'input_audio_chunk',
          audio_base_64: base64Audio,
          sample_rate: 16000
        };

        websocket.send(JSON.stringify(audioMessage));
      }
    };

    sourceNode.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    console.log('🎙️ Real-time audio streaming started');

  } catch (error) {
    console.error('❌ Audio processing setup failed:', error);
    onError?.('Failed to setup audio processing');
  }
};

/**
 * Stop real-time transcription and cleanup
 * @returns Promise<Blob | null> - Returns audio blob as fallback
 */
export const stopLiveTranscription = async (): Promise<Blob | null> => {
  return new Promise((resolve) => {
    try {
      // Close WebSocket
      if (websocket) {
        if (websocket.readyState === WebSocket.OPEN) {
          // Send final commit signal to get remaining transcript
          websocket.send(JSON.stringify({
            message_type: 'input_audio_chunk',
            audio_base_64: '',
            commit: true
          }));
        }
        // Give a moment for final response, then close
        setTimeout(() => {
          websocket?.close();
          websocket = null;
          console.log('🔌 WebSocket closed');
        }, 500);
      }

      // Cleanup audio processing
      if (scriptProcessor) {
        scriptProcessor.disconnect();
        scriptProcessor = null;
      }
      if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
      }
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }

      // Stop MediaRecorder
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        console.log('No active recording to stop');
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
          mediaStream = null;
        }
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        // Create fallback audio blob
        const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
        console.log(`📦 Recording complete: ${recordedChunks.length} chunks, total size: ${audioBlob.size} bytes`);

        // Stop all tracks
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
          mediaStream = null;
        }

        mediaRecorder = null;
        recordedChunks = [];

        resolve(audioBlob);
      };

      mediaRecorder.stop();
      console.log('🎤 Stopping recording...');

    } catch (error) {
      console.error('Error stopping recording:', error);
      if (websocket) {
        websocket.close();
        websocket = null;
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
      }
      mediaRecorder = null;
      recordedChunks = [];
      resolve(null);
    }
  });
};

/**
 * Check if recording is active
 */
export const isLiveTranscriptionReady = (): boolean => {
  return mediaRecorder !== null && mediaRecorder.state === 'recording';
};

/**
 * Test ElevenLabs connection
 */
export const testElevenLabsConnection = async (): Promise<boolean> => {
  try {
    const apiKey = getElevenLabsApiKey();

    // Test with a simple API call
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey
      }
    });

    return response.ok;
  } catch (error) {
    console.error('ElevenLabs connection test failed:', error);
    return false;
  }
};

export default {
  transcribe: transcribeWithElevenLabs,
  isConfigured: isElevenLabsConfigured,
  testConnection: testElevenLabsConnection,
  startLive: startLiveTranscription,
  stopLive: stopLiveTranscription,
  isLiveReady: isLiveTranscriptionReady
};
