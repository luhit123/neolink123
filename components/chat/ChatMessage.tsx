import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChatMessage as ChatMessageType } from '../../types/chat';

interface ChatMessageProps {
  message: ChatMessageType;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);
  const [showTimestamp, setShowTimestamp] = useState(false);

  const isUser = message.role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatMarkdown = (text: string) => {
    // Simple markdown rendering
    let formatted = text;

    // Bold: **text** -> <strong>text</strong>
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic: *text* -> <em>text</em>
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Code: `text` -> <code>text</code>
    formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-slate-800 px-1.5 py-0.5 rounded text-sm">$1</code>');

    // Headers: # text -> <h3>text</h3>
    formatted = formatted.replace(/^### (.*?)$/gm, '<h3 class="text-lg font-bold mt-3 mb-2">$1</h3>');
    formatted = formatted.replace(/^## (.*?)$/gm, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>');
    formatted = formatted.replace(/^# (.*?)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>');

    // Lists: - item -> <li>item</li>
    formatted = formatted.replace(/^- (.*?)$/gm, '<li class="ml-4">• $1</li>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br />');

    return formatted;
  };

  const formattedTimestamp = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
    >
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Timestamp (shown on hover) */}
        {showTimestamp && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-slate-500 mb-1 px-2"
          >
            {formattedTimestamp}
          </motion.span>
        )}

        {/* Message bubble */}
        <div
          className={`
            relative group rounded-lg px-4 py-3 shadow-md
            ${
              isUser
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-br-none'
                : 'bg-slate-700/80 text-slate-100 rounded-bl-none'
            }
          `}
        >
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className={`
              absolute top-2 ${isUser ? 'left-2' : 'right-2'}
              opacity-0 group-hover:opacity-100 transition-opacity
              p-1.5 rounded hover:bg-slate-600/50 active:scale-95
              ${isUser ? 'text-blue-100' : 'text-slate-300'}
            `}
            title="Copy message"
          >
            {copied ? (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
          </button>

          {/* Message content */}
          <div
            className={`text-sm leading-relaxed ${isUser ? 'pr-6' : 'pl-6'}`}
            dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default ChatMessage;
