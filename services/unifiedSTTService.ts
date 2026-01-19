/**
 * Unified Speech-to-Text Service
 *
 * Provides a unified interface for speech-to-text transcription
 * that automatically switches between providers based on settings.
 *
 * Supported Providers:
 * - Deepgram (Nova-3) - Real-time streaming + batch transcription
 * - Faster Whisper (RunPod) - Batch transcription (simulated streaming)
 */

import {
  getSTTSettings,
  subscribeToSTTSettings,
  STTProvider,
  STTSettings,
  DEFAULT_STT_SETTINGS
} from './sttSettingsService';

import {
  isDeepgramConfigured,
  transcribeWithDeepgram,
  startLiveTranscription as startDeepgramLive,
  stopLiveTranscription as stopDeepgramLive
} from './deepgramService';

import {
  isFasterWhisperConfigured,
  transcribeWithFasterWhisper,
  startLiveFasterWhisper,
  stopLiveFasterWhisper,
  cancelLiveFasterWhisper
} from './fasterWhisperService';

// Cache for current settings
let cachedSettings: STTSettings = DEFAULT_STT_SETTINGS;
let settingsLoaded = false;

// Initialize settings cache
const initializeSettings = async (): Promise<void> => {
  if (!settingsLoaded) {
    try {
      cachedSettings = await getSTTSettings();
      settingsLoaded = true;
      console.log('🎤 Unified STT: Initialized with provider:', cachedSettings.activeProvider);
    } catch (error) {
      console.error('Failed to load STT settings, using defaults');
      cachedSettings = DEFAULT_STT_SETTINGS;
    }
  }
};

// Subscribe to settings changes
subscribeToSTTSettings((settings) => {
  cachedSettings = settings;
  settingsLoaded = true;
  console.log('🎤 Unified STT: Settings updated, provider:', settings.activeProvider);
});

/**
 * Get the current active STT provider
 */
export const getActiveProvider = async (): Promise<STTProvider> => {
  await initializeSettings();
  return cachedSettings.activeProvider;
};

/**
 * Get current settings (cached)
 */
export const getCurrentSettings = async (): Promise<STTSettings> => {
  await initializeSettings();
  return cachedSettings;
};

/**
 * Check if any STT provider is configured
 */
export const isSTTConfigured = (): boolean => {
  return isDeepgramConfigured() || isFasterWhisperConfigured();
};

/**
 * Check if the active provider is configured
 */
export const isActiveProviderConfigured = async (): Promise<boolean> => {
  await initializeSettings();
  const provider = cachedSettings.activeProvider;

  switch (provider) {
    case 'deepgram':
      return isDeepgramConfigured();
    case 'fasterWhisper':
      return isFasterWhisperConfigured();
    default:
      return false;
  }
};

/**
 * Transcribe audio using the active provider
 * @param audioBlob - Audio blob to transcribe
 * @param onProgress - Optional callback for progress updates
 * @returns Transcribed text
 */
export const transcribe = async (
  audioBlob: Blob,
  onProgress?: (status: string) => void
): Promise<string> => {
  await initializeSettings();
  const provider = cachedSettings.activeProvider;

  console.log(`🎤 Transcribing with ${provider}...`);

  switch (provider) {
    case 'deepgram':
      if (!isDeepgramConfigured()) {
        throw new Error('Deepgram is not configured. Please set VITE_DEEPGRAM_API_KEY.');
      }
      return transcribeWithDeepgram(audioBlob, onProgress);

    case 'fasterWhisper':
      if (!isFasterWhisperConfigured()) {
        throw new Error('Faster Whisper is not configured. Please set VITE_RUNPOD_API_KEY.');
      }
      return transcribeWithFasterWhisper(audioBlob, onProgress);

    default:
      throw new Error(`Unknown STT provider: ${provider}`);
  }
};

// Live transcription state
let currentLiveProvider: STTProvider | null = null;
let liveMediaStream: MediaStream | null = null;

/**
 * Start live transcription with the active provider
 *
 * Note: Different providers have different streaming capabilities:
 * - Deepgram: True real-time streaming via WebSocket
 * - Faster Whisper: Records audio and transcribes on stop (simulated streaming)
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
  await initializeSettings();
  const provider = cachedSettings.activeProvider;
  currentLiveProvider = provider;

  console.log(`🎤 Starting live transcription with ${provider}...`);

  switch (provider) {
    case 'deepgram':
      if (!isDeepgramConfigured()) {
        throw new Error('Deepgram is not configured. Please set VITE_DEEPGRAM_API_KEY.');
      }
      liveMediaStream = await startDeepgramLive(onTranscript, onError, onReady);
      return liveMediaStream;

    case 'fasterWhisper':
      if (!isFasterWhisperConfigured()) {
        throw new Error('Faster Whisper is not configured. Please set VITE_RUNPOD_API_KEY.');
      }
      // For Faster Whisper, we record locally and transcribe on stop
      // Interim updates are not available, only final result
      liveMediaStream = await startLiveFasterWhisper(
        onTranscript,
        onError,
        onReady
      );
      return liveMediaStream;

    default:
      throw new Error(`Unknown STT provider: ${provider}`);
  }
};

/**
 * Stop live transcription
 * For Faster Whisper, this triggers the actual transcription
 * For Deepgram, if WebSocket failed, it returns buffered audio for batch transcription
 *
 * @param onFinalTranscript - Callback for final transcript (for Faster Whisper or Deepgram fallback)
 * @param onProgress - Progress callback (for Faster Whisper or Deepgram fallback)
 */
export const stopLiveTranscription = async (
  onFinalTranscript?: (text: string) => void,
  onProgress?: (status: string) => void
): Promise<string | void> => {
  const provider = currentLiveProvider;
  console.log(`🎤 Stopping live transcription (${provider})...`);

  if (!provider) {
    console.warn('No active live transcription to stop');
    return;
  }

  try {
    switch (provider) {
      case 'deepgram':
        // Stop returns audio blob if WebSocket never connected
        const audioBlob = await stopDeepgramLive();

        // If we have a blob, WebSocket failed - do batch transcription
        if (audioBlob && audioBlob.size > 0) {
          console.log('🔄 Deepgram WebSocket failed - falling back to batch transcription');
          onProgress?.('Processing audio...');

          try {
            const transcript = await transcribeWithDeepgram(audioBlob, onProgress);
            onFinalTranscript?.(transcript);
            return transcript;
          } catch (error) {
            console.error('Batch transcription failed:', error);
            throw error;
          }
        }
        return;

      case 'fasterWhisper':
        // This triggers actual transcription
        const transcript = await stopLiveFasterWhisper(onFinalTranscript, onProgress);
        return transcript;

      default:
        console.warn(`Unknown provider to stop: ${provider}`);
    }
  } finally {
    currentLiveProvider = null;
    liveMediaStream = null;
  }
};

/**
 * Cancel live transcription without processing
 */
export const cancelLiveTranscription = (): void => {
  const provider = currentLiveProvider;
  console.log(`🎤 Cancelling live transcription (${provider})...`);

  if (!provider) {
    return;
  }

  try {
    switch (provider) {
      case 'deepgram':
        stopDeepgramLive();
        break;

      case 'fasterWhisper':
        cancelLiveFasterWhisper();
        break;
    }
  } finally {
    currentLiveProvider = null;
    liveMediaStream = null;
  }
};

/**
 * Check if currently in a live transcription session
 */
export const isLiveTranscriptionActive = (): boolean => {
  return currentLiveProvider !== null;
};

/**
 * Get the current live transcription provider
 */
export const getCurrentLiveProvider = (): STTProvider | null => {
  return currentLiveProvider;
};

/**
 * Check if the current provider supports real-time streaming
 */
export const supportsRealTimeStreaming = async (): Promise<boolean> => {
  await initializeSettings();
  // Only Deepgram supports true real-time streaming
  return cachedSettings.activeProvider === 'deepgram';
};

/**
 * Get provider capabilities
 */
export const getProviderCapabilities = async (): Promise<{
  realTimeStreaming: boolean;
  batchTranscription: boolean;
  medicalKeywords: boolean;
  provider: STTProvider;
}> => {
  await initializeSettings();
  const provider = cachedSettings.activeProvider;

  switch (provider) {
    case 'deepgram':
      return {
        realTimeStreaming: true,
        batchTranscription: true,
        medicalKeywords: true,
        provider
      };

    case 'fasterWhisper':
      return {
        realTimeStreaming: false, // Records and transcribes on stop
        batchTranscription: true,
        medicalKeywords: true, // Via initial prompt
        provider
      };

    default:
      return {
        realTimeStreaming: false,
        batchTranscription: false,
        medicalKeywords: false,
        provider
      };
  }
};

export default {
  getActiveProvider,
  getCurrentSettings,
  isConfigured: isSTTConfigured,
  isActiveProviderConfigured,
  transcribe,
  startLive: startLiveTranscription,
  stopLive: stopLiveTranscription,
  cancelLive: cancelLiveTranscription,
  isLiveActive: isLiveTranscriptionActive,
  getCurrentLiveProvider,
  supportsRealTimeStreaming,
  getCapabilities: getProviderCapabilities
};
