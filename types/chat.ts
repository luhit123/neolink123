import { Unit, Patient } from '../types';

export type PageType = 'dashboard' | 'patient-detail' | 'analytics' | 'admin' | 'referral' | 'other';

export interface AppContext {
  currentPage: PageType;
  selectedUnit?: Unit;
  selectedPatient?: Patient;
  activeFilters?: {
    unit?: Unit;
    outcome?: string;
    dateRange?: {
      start: string;
      end: string;
    };
    [key: string]: any;
  };
  visibleData?: {
    stats?: any;
    charts?: string[];
    patientCount?: number;
    [key: string]: any;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  context?: AppContext;
}

export interface Conversation {
  id: string;
  timestamp: string;
  messages: ChatMessage[];
  context: AppContext;
  title?: string; // First user message (truncated)
}

export interface ChatState {
  isOpen: boolean;
  conversations: ChatMessage[];
  isTyping: boolean;
  currentContext: AppContext;
  error: string | null;
}

export interface ChatHistory {
  userId: string;
  conversations: Conversation[];
  maxConversations: 10;
}

export interface SuggestedQuery {
  id: string;
  text: string;
  icon?: string;
  context?: PageType | PageType[];
}

export interface VoiceRecognitionResult {
  transcript: string;
  isFinal: boolean;
  confidence: number;
}

export interface VoiceRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
}
