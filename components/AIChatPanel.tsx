import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatContext } from '../contexts/ChatContext';
import { Patient } from '../types';
import { handleComplexQuery } from '../services/aiChatServiceV3';
import { exportChatAnswerToPdf } from '../services/chatPdfService';
import ChatMessage from './chat/ChatMessage';
import ChatInput from './chat/ChatInput';
import ChatTypingIndicator from './chat/ChatTypingIndicator';
import ChatSuggestedQueries from './chat/ChatSuggestedQueries';
import { auth } from '../firebaseConfig';
import { haptics } from '../utils/haptics';

interface AIChatPanelProps {
  patients: Patient[];
  onClose: () => void;
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({ patients, onClose }) => {
  const { chatState, addMessage, setIsTyping, setError, clearConversation, getContext } = useChatContext();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [chatState.conversations, chatState.isTyping]);

  // Handle scroll detection for "scroll to bottom" button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom && chatState.conversations.length > 3);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [chatState.conversations.length]);

  const scrollToBottom = (smooth: boolean = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const handleSendMessage = async (messageText: string) => {
    try {
      // Add user message
      const userMessage = {
        id: `user-${Date.now()}`,
        role: 'user' as const,
        content: messageText,
        timestamp: new Date().toISOString(),
        context: getContext(),
      };
      addMessage(userMessage);

      // Set typing indicator
      setIsTyping(true);
      setError(null);

      // Get AI response
      const context = getContext();
      const conversationHistory = chatState.conversations.slice(-5); // Last 5 messages for context

      const aiResponse = await handleComplexQuery(
        messageText,
        context,
        patients,
        conversationHistory
      );

      // Add AI message
      const aiMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant' as const,
        content: aiResponse,
        timestamp: new Date().toISOString(),
        context,
      };
      addMessage(aiMessage);

      haptics.success();
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to get AI response. Please try again.');
      haptics.error();
    } finally {
      setIsTyping(false);
    }
  };

  const handleExportPDF = () => {
    try {
      if (chatState.conversations.length === 0) {
        alert('No conversation to export');
        return;
      }

      // Get the latest Q&A pair
      const conversations = chatState.conversations;
      const latestUserMessage = [...conversations]
        .reverse()
        .find((msg) => msg.role === 'user');
      const latestAiMessage = [...conversations]
        .reverse()
        .find((msg) => msg.role === 'assistant');

      if (!latestUserMessage || !latestAiMessage) {
        alert('No complete conversation to export');
        return;
      }

      const userEmail = auth.currentUser?.email || 'unknown@user.com';
      const context = getContext();

      exportChatAnswerToPdf(
        latestUserMessage.content,
        latestAiMessage.content,
        userEmail,
        context
      );

      haptics.success();
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
      haptics.error();
    }
  };

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear the conversation history?')) {
      clearConversation();
      haptics.selection();
    }
  };

  const handleSuggestedQuery = (query: string) => {
    handleSendMessage(query);
  };

  const context = getContext();

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="
        fixed top-0 right-0 h-full w-full sm:w-[400px]
        bg-slate-900 border-l border-slate-700 shadow-2xl z-40
        flex flex-col
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 border-b border-blue-500">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-base">NeoLink AI</h3>
            <p className="text-blue-100 text-xs">Intelligent Assistant</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors active:scale-95"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Context indicator */}
      <div className="px-4 py-2 bg-slate-800/60 border-b border-slate-700/50 text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Context: {context.currentPage}</span>
            {context.selectedUnit && <span> • {context.selectedUnit}</span>}
          </div>
          <div className="flex items-center space-x-1">
            {chatState.conversations.length > 0 && (
              <span className="text-blue-400">{chatState.conversations.length} msgs</span>
            )}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scroll-smooth"
        style={{ maxHeight: 'calc(100vh - 260px)' }}
      >
        {chatState.conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-white mb-2">Ask me anything!</h4>
            <p className="text-sm text-slate-400 mb-6">
              I can help you analyze patient data, answer clinical questions, generate reports, and more.
            </p>
            <ChatSuggestedQueries
              onQuerySelect={handleSuggestedQuery}
              currentPage={context.currentPage}
            />
          </div>
        ) : (
          <>
            {chatState.conversations.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {chatState.isTyping && <ChatTypingIndicator />}
            {chatState.error && (
              <div className="px-4 py-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                {chatState.error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => scrollToBottom()}
            className="absolute bottom-32 right-6 w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg flex items-center justify-center z-10 active:scale-95 transition-all"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      {chatState.conversations.length > 0 && (
        <div className="px-4 py-2 bg-slate-800/60 border-t border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportPDF}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg transition-colors active:scale-95 flex items-center space-x-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>PDF</span>
            </button>
            <button
              onClick={handleClearChat}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg transition-colors active:scale-95 flex items-center space-x-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Clear</span>
            </button>
          </div>
          <div className="text-xs text-slate-500">
            {patients.length} patients loaded
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3 bg-slate-800 border-t border-slate-700">
        <ChatInput
          onSend={handleSendMessage}
          disabled={chatState.isTyping}
        />
      </div>
    </motion.div>
  );
};

export default AIChatPanel;
