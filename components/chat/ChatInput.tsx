import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { voiceInput } from '../../utils/voiceInput';
import { haptics } from '../../utils/haptics';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Ask me anything about your patients, analytics, or clinical questions...',
}) => {
  const [message, setMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      haptics.selection();
      onSend(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoiceInput = () => {
    if (!voiceInput.isSupported()) {
      setVoiceError('Voice input is not supported in this browser');
      setTimeout(() => setVoiceError(null), 3000);
      return;
    }

    if (isListening) {
      voiceInput.stop();
      setIsListening(false);
      haptics.selection();
    } else {
      setVoiceError(null);
      setIsListening(true);
      haptics.selection();

      voiceInput.start(
        (result) => {
          if (result.isFinal) {
            setMessage((prev) => prev + (prev ? ' ' : '') + result.transcript);
            setIsListening(false);
          } else {
            // Show interim results in placeholder or somewhere
            setMessage((prev) => prev + (prev ? ' ' : '') + result.transcript);
          }
        },
        (error) => {
          setVoiceError(error);
          setIsListening(false);
          setTimeout(() => setVoiceError(null), 3000);
        },
        {
          continuous: false,
          interimResults: true,
          lang: 'en-US',
        }
      );
    }
  };

  return (
    <div className="relative">
      {/* Voice error message */}
      <AnimatePresence>
        {voiceError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full left-0 right-0 mb-2 px-3 py-2 bg-red-500/90 text-white text-sm rounded-lg"
          >
            {voiceError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input container */}
      <div className="flex items-end space-x-2 p-3 bg-slate-800/60 border border-slate-600 rounded-lg focus-within:border-blue-500 transition-colors">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="
            flex-1 bg-transparent text-white placeholder-slate-400 resize-none
            outline-none text-sm leading-relaxed max-h-[120px] min-h-[44px]
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          rows={1}
        />

        {/* Voice input button */}
        {voiceInput.isSupported() && (
          <button
            type="button"
            onClick={toggleVoiceInput}
            disabled={disabled}
            className={`
              min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg
              transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
              ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }
            `}
            title={isListening ? 'Stop recording' : 'Start voice input'}
          >
            {isListening ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 10h6v4H9z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            )}
          </button>
        )}

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className={`
            min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg
            transition-all active:scale-95
            ${
              message.trim() && !disabled
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
            }
          `}
          title="Send message (Enter)"
        >
          {disabled ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Keyboard shortcut hint */}
      <div className="text-xs text-slate-500 mt-1.5 px-1">
        Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">Enter</kbd> to
        send, <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">Shift + Enter</kbd>{' '}
        for new line
      </div>
    </div>
  );
};

export default ChatInput;
