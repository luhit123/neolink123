import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppContext, ChatMessage, ChatState, Conversation, PageType } from '../types/chat';
import { Patient, Unit } from '../types';
import { auth } from '../firebaseConfig';
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface ChatContextType {
  chatState: ChatState;
  addMessage: (message: ChatMessage) => void;
  clearConversation: () => void;
  setIsTyping: (isTyping: boolean) => void;
  setError: (error: string | null) => void;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  updateContext: (context: Partial<AppContext>) => void;
  getContext: () => AppContext;
  loadChatHistory: () => Promise<void>;
  saveChatHistory: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: React.ReactNode;
}

const MAX_MESSAGES_PER_SESSION = 50;
const MAX_CONVERSATIONS = 10;
const STORAGE_KEY = 'neolink-chat-history';

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [chatState, setChatState] = useState<ChatState>({
    isOpen: false,
    conversations: [],
    isTyping: false,
    currentContext: {
      currentPage: 'other',
    },
    error: null,
  });

  // Load chat history from localStorage on mount
  useEffect(() => {
    loadChatHistoryFromStorage();
  }, []);

  // Save chat history to localStorage whenever conversations change
  useEffect(() => {
    if (chatState.conversations.length > 0) {
      saveChatHistoryToStorage();
    }
  }, [chatState.conversations]);

  const loadChatHistoryFromStorage = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const history = JSON.parse(stored);
        if (history.conversations && Array.isArray(history.conversations)) {
          setChatState((prev) => ({
            ...prev,
            conversations: history.conversations.slice(-MAX_MESSAGES_PER_SESSION),
          }));
        }
      }
    } catch (error) {
      console.error('Error loading chat history from localStorage:', error);
    }
  };

  const saveChatHistoryToStorage = () => {
    try {
      const history = {
        userId: auth.currentUser?.uid || 'anonymous',
        conversations: chatState.conversations.slice(-MAX_MESSAGES_PER_SESSION),
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving chat history to localStorage:', error);
    }
  };

  const loadChatHistory = async () => {
    if (!auth.currentUser) return;

    try {
      const userId = auth.currentUser.uid;
      const chatHistoryRef = doc(db, 'chatHistory', userId);
      const chatHistoryDoc = await getDoc(chatHistoryRef);

      if (chatHistoryDoc.exists()) {
        const data = chatHistoryDoc.data();
        if (data.conversations && Array.isArray(data.conversations)) {
          setChatState((prev) => ({
            ...prev,
            conversations: data.conversations.slice(-MAX_MESSAGES_PER_SESSION),
          }));
        }
      }
    } catch (error) {
      console.error('Error loading chat history from Firestore:', error);
    }
  };

  const saveChatHistory = async () => {
    if (!auth.currentUser) return;

    try {
      const userId = auth.currentUser.uid;
      const chatHistoryRef = doc(db, 'chatHistory', userId);

      await setDoc(chatHistoryRef, {
        userId,
        conversations: chatState.conversations.slice(-MAX_MESSAGES_PER_SESSION),
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error saving chat history to Firestore:', error);
    }
  };

  const addMessage = useCallback((message: ChatMessage) => {
    setChatState((prev) => {
      const newConversations = [...prev.conversations, message];
      // Limit to MAX_MESSAGES_PER_SESSION
      if (newConversations.length > MAX_MESSAGES_PER_SESSION) {
        newConversations.splice(0, newConversations.length - MAX_MESSAGES_PER_SESSION);
      }
      return {
        ...prev,
        conversations: newConversations,
        error: null,
      };
    });
  }, []);

  const clearConversation = useCallback(() => {
    setChatState((prev) => ({
      ...prev,
      conversations: [],
      error: null,
    }));
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const setIsTyping = useCallback((isTyping: boolean) => {
    setChatState((prev) => ({
      ...prev,
      isTyping,
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setChatState((prev) => ({
      ...prev,
      error,
    }));
  }, []);

  const toggleChat = useCallback(() => {
    setChatState((prev) => ({
      ...prev,
      isOpen: !prev.isOpen,
    }));
  }, []);

  const openChat = useCallback(() => {
    setChatState((prev) => ({
      ...prev,
      isOpen: true,
    }));
  }, []);

  const closeChat = useCallback(() => {
    setChatState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const updateContext = useCallback((context: Partial<AppContext>) => {
    setChatState((prev) => ({
      ...prev,
      currentContext: {
        ...prev.currentContext,
        ...context,
      },
    }));
  }, []);

  const getContext = useCallback(() => {
    return chatState.currentContext;
  }, [chatState.currentContext]);

  const value: ChatContextType = {
    chatState,
    addMessage,
    clearConversation,
    setIsTyping,
    setError,
    toggleChat,
    openChat,
    closeChat,
    updateContext,
    getContext,
    loadChatHistory,
    saveChatHistory,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
