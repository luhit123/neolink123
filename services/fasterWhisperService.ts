/**
 * Faster Whisper Speech-to-Text Service (RunPod)
 *
 * Uses Faster Whisper 1.0.10 hosted on RunPod for medical speech transcription
 * Alternative STT provider to Deepgram
 *
 * RunPod Endpoint Configuration:
 * - Endpoint ID: zaksh05iky86bv
 * - Endpoint URL: https://api.runpod.ai/v2/zaksh05iky86bv/runsync
 */

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// RunPod configuration - Note: domain is api.runpod.AI (not .io)
const RUNPOD_ENDPOINT_ID = 'zaksh05iky86bv';

// RunPod API URL - api.runpod.ai (not .io)
const getRunPodBaseUrl = (): string => {
  // Try direct call - api.runpod.ai may support CORS
  return `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}`;
};

/**
 * Get RunPod API key from environment
 */
const getRunPodApiKey = (): string => {
  const apiKey = import.meta.env.VITE_RUNPOD_API_KEY;
  console.log('🔑 RunPod API Key loaded:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT FOUND');
  if (!apiKey) {
    throw new Error('RunPod API key not configured. Please set VITE_RUNPOD_API_KEY in .env file');
  }
  return apiKey;
};

/**
 * Check if Faster Whisper (RunPod) is configured
 */
export const isFasterWhisperConfigured = (): boolean => {
  return !!import.meta.env.VITE_RUNPOD_API_KEY;
};

/**
 * Upload audio to Firebase Storage and get public URL
 * RunPod Faster Whisper requires a public HTTPS URL for audio
 */
const uploadAudioToStorage = async (audioBlob: Blob): Promise<{ url: string; filePath: string }> => {
  const storage = getStorage();
  const fileName = `temp-audio/${Date.now()}-${Math.random().toString(36).substring(7)}.webm`;
  const storageRef = ref(storage, fileName);

  // Upload the blob
  await uploadBytes(storageRef, audioBlob, {
    contentType: audioBlob.type || 'audio/webm'
  });

  // Get public download URL
  const url = await getDownloadURL(storageRef);
  console.log('📤 Audio uploaded to Firebase Storage:', url);

  return { url, filePath: fileName };
};

/**
 * Delete temporary audio file from Firebase Storage
 */
const deleteAudioFromStorage = async (filePath: string): Promise<void> => {
  try {
    const storage = getStorage();
    const storageRef = ref(storage, filePath);
    await deleteObject(storageRef);
    console.log('🗑️ Temporary audio file deleted:', filePath);
  } catch (error) {
    console.warn('Could not delete temporary audio file:', error);
  }
};

/**
 * Poll for job completion
 */
const pollForResult = async (
  jobId: string,
  apiKey: string,
  maxAttempts: number = 60,
  intervalMs: number = 2000,
  onProgress?: (status: string) => void
): Promise<string> => {
  const statusUrl = `${getRunPodBaseUrl()}/status/${jobId}`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`📊 Job status (attempt ${attempt + 1}):`, result.status);

    if (result.status === 'COMPLETED') {
      // Extract transcript from the output
      const output = result.output;
      if (typeof output === 'string') {
        return output;
      }
      // Handle various output formats from Faster Whisper
      if (output?.text) {
        return output.text;
      }
      if (output?.transcription) {
        return output.transcription;
      }
      if (output?.segments) {
        // Combine segments into full transcript
        return output.segments.map((seg: any) => seg.text).join(' ').trim();
      }
      if (output?.result) {
        return typeof output.result === 'string' ? output.result : JSON.stringify(output.result);
      }
      console.warn('Unexpected output format:', output);
      return JSON.stringify(output);
    }

    if (result.status === 'FAILED') {
      const errorMsg = result.error || 'Transcription job failed';
      throw new Error(errorMsg);
    }

    if (result.status === 'CANCELLED') {
      throw new Error('Transcription job was cancelled');
    }

    onProgress?.(`Processing... (${result.status})`);

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Transcription timed out - job took too long to complete');
};

/**
 * Transcribe audio using Faster Whisper on RunPod
 * @param audioBlob - Audio blob to transcribe
 * @param onProgress - Optional callback for progress updates
 * @returns Transcribed text
 */
export const transcribeWithFasterWhisper = async (
  audioBlob: Blob,
  onProgress?: (status: string) => void
): Promise<string> => {
  let uploadedFilePath: string | null = null;

  try {
    onProgress?.('Initializing Faster Whisper transcription...');
    console.log('🎤 Sending audio to Faster Whisper (RunPod) for transcription...');

    const apiKey = getRunPodApiKey();

    // Step 1: Upload audio to Firebase Storage to get a public URL
    onProgress?.('Uploading audio...');
    const { url: audioUrl, filePath } = await uploadAudioToStorage(audioBlob);
    uploadedFilePath = filePath;

    onProgress?.('Submitting to RunPod...');

    // Step 2: Call RunPod with the audio URL (using runsync for immediate results)
    const runUrl = `${getRunPodBaseUrl()}/runsync`;
    console.log('📡 Calling RunPod URL:', runUrl);
    console.log('📎 Audio URL:', audioUrl);

    const requestBody = {
      input: {
        audio: audioUrl,  // Public HTTPS URL required
        task: 'transcribe',
        language: 'en',
        temperature: 0,
        beam_size: 5,
        best_of: 5,
        enable_vad: true,
        word_timestamps: false
      }
    };

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
    console.log('📤 Request headers:', { ...headers, Authorization: `Bearer ${apiKey.substring(0, 15)}...` });

    const response = await fetch(runUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('RunPod API error:', errorText);
      throw new Error(`RunPod API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('📤 RunPod FULL response:', JSON.stringify(result, null, 2));

    // Extract transcript from response - handle various formats
    let transcript = '';

    // Check all possible locations for the transcript
    if (result.output) {
      const output = result.output;
      console.log('📤 Output field:', JSON.stringify(output, null, 2));
      if (typeof output === 'string') {
        transcript = output;
      } else if (output.text) {
        transcript = output.text;
      } else if (output.transcription) {
        transcript = output.transcription;
      } else if (output.transcript) {
        transcript = output.transcript;
      } else if (output.segments) {
        transcript = output.segments.map((seg: any) => seg.text).join(' ').trim();
      } else if (output.result) {
        transcript = typeof output.result === 'string' ? output.result : output.result.text || '';
      }
    }

    // Some endpoints return transcript directly
    if (!transcript && result.text) {
      transcript = result.text;
    }
    if (!transcript && result.transcript) {
      transcript = result.transcript;
    }
    if (!transcript && result.transcription) {
      transcript = result.transcription;
    }

    if (!transcript) {
      console.warn('No transcript in response. Full response:', result);
      console.warn('Response keys:', Object.keys(result));
      throw new Error('No transcript returned from Faster Whisper. Check endpoint response format.');
    }

    console.log('✅ Faster Whisper transcription complete:', transcript);
    onProgress?.('Transcription complete');
    return transcript.trim();

  } catch (error: any) {
    console.error('❌ Faster Whisper transcription error:', error);

    // Provide helpful error messages
    if (error.message.includes('401') || error.message.includes('403')) {
      throw new Error('RunPod authentication failed. Please check your API key.');
    } else if (error.message.includes('429')) {
      throw new Error('RunPod rate limit exceeded. Please wait and try again.');
    } else if (error.message.includes('network') || error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    }

    throw new Error(`Faster Whisper transcription failed: ${error.message}`);
  } finally {
    // Clean up: Delete temporary audio file from storage
    if (uploadedFilePath) {
      deleteAudioFromStorage(uploadedFilePath);
    }
  }
};

/**
 * Transcribe audio from base64 data using Faster Whisper
 * @param audioBase64 - Base64 encoded audio data
 * @param onProgress - Optional callback for progress updates
 * @returns Transcribed text
 */
export const transcribeBase64WithFasterWhisper = async (
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

  return transcribeWithFasterWhisper(audioBlob, onProgress);
};

/**
 * Test RunPod connection
 * Note: We use the /runsync endpoint with a test URL
 */
export const testFasterWhisperConnection = async (): Promise<boolean> => {
  try {
    const apiKey = getRunPodApiKey();
    const testUrl = `${getRunPodBaseUrl()}/runsync`;
    console.log('🔍 Testing RunPod connection:', testUrl);

    // Test by sending a request with a sample audio URL
    // This tests both auth and endpoint availability
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: {
          audio: 'https://www.example.com/test.wav', // Dummy URL for connection test
          task: 'transcribe',
          language: 'en'
        }
      })
    });

    const responseText = await response.text();
    console.log('RunPod test response:', response.status, responseText);

    // 401/403 = bad API key
    if (response.status === 401 || response.status === 403) {
      console.error('RunPod authentication failed - check API key');
      return false;
    }

    // 404 = endpoint not found (might be sleeping or wrong ID)
    if (response.status === 404) {
      console.error('RunPod endpoint not found - check if endpoint is active');
      return false;
    }

    // Any 2xx or 4xx (except auth errors) means connection works
    // 400 = bad input but connection works
    return response.status < 500;
  } catch (error) {
    console.error('Faster Whisper connection test failed:', error);
    return false;
  }
};

// Live transcription state (simulated - Faster Whisper doesn't support WebSocket streaming)
let liveRecordingChunks: Blob[] = [];
let liveMediaRecorder: MediaRecorder | null = null;
let liveStream: MediaStream | null = null;

/**
 * Start "live" transcription (actually records and transcribes in batches)
 * Note: Faster Whisper doesn't support real-time streaming like Deepgram,
 * so we simulate it by recording in chunks and transcribing periodically
 *
 * @param onTranscript - Callback for transcript updates
 * @param onError - Callback for errors
 * @param onReady - Callback when ready to record
 * @returns Promise with the MediaStream (for visualization)
 */
export const startLiveFasterWhisper = async (
  onTranscript: (text: string, isFinal: boolean) => void,
  onError?: (error: string) => void,
  onReady?: () => void
): Promise<MediaStream> => {
  try {
    console.log('🎤 Starting Faster Whisper recording...');

    // Reset state
    liveRecordingChunks = [];

    // Get microphone access
    liveStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    console.log('✅ Microphone access granted');

    // Create MediaRecorder
    liveMediaRecorder = new MediaRecorder(liveStream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    liveMediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        liveRecordingChunks.push(event.data);
      }
    };

    // Start recording
    liveMediaRecorder.start(1000); // Collect chunks every second
    console.log('🎙️ Recording started with Faster Whisper');

    onReady?.();
    return liveStream;

  } catch (error: any) {
    console.error('❌ Failed to start Faster Whisper recording:', error);
    onError?.(error.message);
    throw error;
  }
};

/**
 * Stop live transcription and get final transcript
 * @param onTranscript - Callback for the final transcript
 * @param onProgress - Optional progress callback
 */
export const stopLiveFasterWhisper = async (
  onTranscript?: (text: string) => void,
  onProgress?: (status: string) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      if (!liveMediaRecorder || liveMediaRecorder.state === 'inactive') {
        console.log('No active recording to stop');
        resolve('');
        return;
      }

      liveMediaRecorder.onstop = async () => {
        try {
          // Combine all chunks
          const audioBlob = new Blob(liveRecordingChunks, { type: 'audio/webm' });
          console.log(`📦 Combined ${liveRecordingChunks.length} chunks, total size: ${audioBlob.size} bytes`);

          // Stop all tracks
          if (liveStream) {
            liveStream.getTracks().forEach(track => track.stop());
            liveStream = null;
          }

          // Clear chunks
          liveRecordingChunks = [];
          liveMediaRecorder = null;

          // Transcribe the combined audio
          if (audioBlob.size > 0) {
            onProgress?.('Transcribing audio...');
            const transcript = await transcribeWithFasterWhisper(audioBlob, onProgress);
            onTranscript?.(transcript);
            resolve(transcript);
          } else {
            resolve('');
          }
        } catch (error: any) {
          console.error('Error processing recorded audio:', error);
          reject(error);
        }
      };

      liveMediaRecorder.stop();
      console.log('🎤 Stopping Faster Whisper recording...');

    } catch (error: any) {
      console.error('Error stopping live transcription:', error);
      // Cleanup
      if (liveStream) {
        liveStream.getTracks().forEach(track => track.stop());
        liveStream = null;
      }
      liveRecordingChunks = [];
      liveMediaRecorder = null;
      reject(error);
    }
  });
};

/**
 * Cancel live recording without transcribing
 */
export const cancelLiveFasterWhisper = (): void => {
  try {
    if (liveMediaRecorder && liveMediaRecorder.state !== 'inactive') {
      liveMediaRecorder.stop();
    }
    if (liveStream) {
      liveStream.getTracks().forEach(track => track.stop());
      liveStream = null;
    }
    liveRecordingChunks = [];
    liveMediaRecorder = null;
    console.log('🎤 Faster Whisper recording cancelled');
  } catch (error) {
    console.error('Error cancelling recording:', error);
  }
};

/**
 * Check if currently recording
 */
export const isLiveFasterWhisperRecording = (): boolean => {
  return liveMediaRecorder !== null && liveMediaRecorder.state === 'recording';
};

export default {
  transcribe: transcribeWithFasterWhisper,
  transcribeBase64: transcribeBase64WithFasterWhisper,
  isConfigured: isFasterWhisperConfigured,
  testConnection: testFasterWhisperConnection,
  startLive: startLiveFasterWhisper,
  stopLive: stopLiveFasterWhisper,
  cancelLive: cancelLiveFasterWhisper,
  isRecording: isLiveFasterWhisperRecording
};
