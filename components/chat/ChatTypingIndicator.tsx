import React from 'react';
import { motion } from 'framer-motion';

const ChatTypingIndicator: React.FC = () => {
  const dotVariants = {
    initial: { y: 0 },
    animate: { y: -8 },
  };

  const dotTransition = {
    duration: 0.5,
    repeat: Infinity,
    repeatType: 'reverse' as const,
    ease: 'easeInOut',
  };

  return (
    <div className="flex items-center space-x-2 px-4 py-3 bg-slate-700/40 rounded-lg max-w-fit">
      <div className="flex items-center space-x-1.5">
        <motion.div
          className="w-2 h-2 bg-blue-400 rounded-full"
          variants={dotVariants}
          initial="initial"
          animate="animate"
          transition={{ ...dotTransition, delay: 0 }}
        />
        <motion.div
          className="w-2 h-2 bg-blue-400 rounded-full"
          variants={dotVariants}
          initial="initial"
          animate="animate"
          transition={{ ...dotTransition, delay: 0.15 }}
        />
        <motion.div
          className="w-2 h-2 bg-blue-400 rounded-full"
          variants={dotVariants}
          initial="initial"
          animate="animate"
          transition={{ ...dotTransition, delay: 0.3 }}
        />
      </div>
      <span className="text-xs text-slate-400 ml-2">AI is thinking...</span>
    </div>
  );
};

export default ChatTypingIndicator;
