/**
 * STT Settings Service
 *
 * Manages Speech-to-Text configuration settings stored in Firebase
 * Allows SuperAdmin to switch between STT providers (Deepgram, Faster Whisper)
 */

import { db } from '../firebaseConfig';
import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';

// STT Provider types
export type STTProvider = 'deepgram' | 'fasterWhisper';

// STT Settings interface
export interface STTSettings {
  activeProvider: STTProvider;
  deepgram: {
    enabled: boolean;
    model: string;
    language: string;
  };
  fasterWhisper: {
    enabled: boolean;
    endpointId: string;
    language: string;
  };
  lastModifiedBy?: string;
  lastModifiedAt?: Date;
}

// Default settings
export const DEFAULT_STT_SETTINGS: STTSettings = {
  activeProvider: 'deepgram',
  deepgram: {
    enabled: true,
    model: 'nova-3',
    language: 'en-US'
  },
  fasterWhisper: {
    enabled: true,
    endpointId: 'zaksh05iky86bv',
    language: 'en'
  }
};

// Settings document path
const SETTINGS_DOC_PATH = 'appSettings/sttConfig';

/**
 * Get current STT settings from Firebase
 */
export const getSTTSettings = async (): Promise<STTSettings> => {
  try {
    const docRef = doc(db, SETTINGS_DOC_PATH);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as STTSettings;
      console.log('📋 Loaded STT settings:', data.activeProvider);
      return data;
    }

    // Return default settings if none exist
    console.log('📋 No STT settings found, using defaults');
    return DEFAULT_STT_SETTINGS;
  } catch (error) {
    console.error('❌ Error loading STT settings:', error);
    return DEFAULT_STT_SETTINGS;
  }
};

/**
 * Save STT settings to Firebase
 */
export const saveSTTSettings = async (
  settings: STTSettings,
  modifiedBy?: string
): Promise<void> => {
  try {
    const docRef = doc(db, SETTINGS_DOC_PATH);
    await setDoc(docRef, {
      ...settings,
      lastModifiedBy: modifiedBy || 'system',
      lastModifiedAt: new Date()
    });
    console.log('✅ STT settings saved successfully');
  } catch (error) {
    console.error('❌ Error saving STT settings:', error);
    throw new Error('Failed to save STT settings');
  }
};

/**
 * Update only the active provider
 */
export const setActiveSTTProvider = async (
  provider: STTProvider,
  modifiedBy?: string
): Promise<void> => {
  try {
    const currentSettings = await getSTTSettings();
    await saveSTTSettings({
      ...currentSettings,
      activeProvider: provider
    }, modifiedBy);
    console.log(`✅ Active STT provider set to: ${provider}`);
  } catch (error) {
    console.error('❌ Error setting active STT provider:', error);
    throw error;
  }
};

/**
 * Subscribe to STT settings changes (real-time listener)
 */
export const subscribeToSTTSettings = (
  callback: (settings: STTSettings) => void
): Unsubscribe => {
  const docRef = doc(db, SETTINGS_DOC_PATH);

  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data() as STTSettings;
      console.log('📡 STT settings updated:', data.activeProvider);
      callback(data);
    } else {
      console.log('📡 No STT settings, using defaults');
      callback(DEFAULT_STT_SETTINGS);
    }
  }, (error) => {
    console.error('❌ Error in STT settings listener:', error);
    callback(DEFAULT_STT_SETTINGS);
  });
};

/**
 * Get the display name for an STT provider
 */
export const getProviderDisplayName = (provider: STTProvider): string => {
  switch (provider) {
    case 'deepgram':
      return 'Deepgram Nova-3';
    case 'fasterWhisper':
      return 'Faster Whisper (RunPod)';
    default:
      return provider;
  }
};

/**
 * Get provider configuration status
 */
export const getProviderStatus = (provider: STTProvider): { configured: boolean; reason?: string } => {
  switch (provider) {
    case 'deepgram':
      const deepgramKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
      return {
        configured: !!deepgramKey,
        reason: !deepgramKey ? 'VITE_DEEPGRAM_API_KEY not set in environment' : undefined
      };
    case 'fasterWhisper':
      const runpodKey = import.meta.env.VITE_RUNPOD_API_KEY;
      return {
        configured: !!runpodKey,
        reason: !runpodKey ? 'VITE_RUNPOD_API_KEY not set in environment' : undefined
      };
    default:
      return { configured: false, reason: 'Unknown provider' };
  }
};

export default {
  getSettings: getSTTSettings,
  saveSettings: saveSTTSettings,
  setActiveProvider: setActiveSTTProvider,
  subscribe: subscribeToSTTSettings,
  getDisplayName: getProviderDisplayName,
  getProviderStatus,
  DEFAULT_SETTINGS: DEFAULT_STT_SETTINGS
};
