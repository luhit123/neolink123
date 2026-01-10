import { VoiceRecognitionResult, VoiceRecognitionOptions } from '../types/chat';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export class VoiceInput {
  private recognition: any = null;
  private isListening: boolean = false;

  constructor() {
    if (this.isSupported()) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
    }
  }

  isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  start(
    onResult: (result: VoiceRecognitionResult) => void,
    onError?: (error: string) => void,
    options?: VoiceRecognitionOptions
  ): void {
    if (!this.isSupported()) {
      onError?.('Speech recognition is not supported in this browser');
      return;
    }

    if (this.isListening) {
      console.warn('Voice recognition is already listening');
      return;
    }

    // Configure recognition
    this.recognition.continuous = options?.continuous ?? false;
    this.recognition.interimResults = options?.interimResults ?? true;
    this.recognition.lang = options?.lang ?? 'en-US';

    // Handle results
    this.recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const result = event.results[last];
      const transcript = result[0].transcript;
      const isFinal = result.isFinal;
      const confidence = result[0].confidence;

      onResult({
        transcript,
        isFinal,
        confidence,
      });
    };

    // Handle errors
    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;

      let errorMessage = 'Voice recognition error occurred';
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'Microphone not available. Please check permissions.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please enable permissions.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
        default:
          errorMessage = `Voice recognition error: ${event.error}`;
      }

      onError?.(errorMessage);
    };

    // Handle end
    this.recognition.onend = () => {
      this.isListening = false;
    };

    // Start recognition
    try {
      this.recognition.start();
      this.isListening = true;
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      this.isListening = false;
      onError?.('Failed to start voice recognition');
    }
  }

  stop(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
        this.isListening = false;
      } catch (error) {
        console.error('Error stopping voice recognition:', error);
      }
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  abort(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.abort();
        this.isListening = false;
      } catch (error) {
        console.error('Error aborting voice recognition:', error);
      }
    }
  }
}

// Singleton instance
export const voiceInput = new VoiceInput();
