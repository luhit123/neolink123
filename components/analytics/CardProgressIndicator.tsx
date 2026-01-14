import React from 'react';
import { motion } from 'framer-motion';
import { haptics } from '../../utils/haptics';

interface CardProgressIndicatorProps {
  totalCards: number;
  currentIndex: number;
  onDotClick: (index: number) => void;
  labels?: string[];
}

const CardProgressIndicator: React.FC<CardProgressIndicatorProps> = ({
  totalCards,
  currentIndex,
  onDotClick,
  labels = ['Stats', 'Charts', 'Cases', 'AI']
}) => {
  return (
    <div className="flex flex-col items-center gap-2 py-3 px-4 bg-white/90 backdrop-blur-xl">
      {/* Dots */}
      <div className="flex items-center gap-3">
        {Array.from({ length: totalCards }).map((_, index) => (
          <motion.button
            key={index}
            onClick={() => {
              haptics.selection();
              onDotClick(index);
            }}
            className="relative p-2 -m-2"
            whileTap={{ scale: 0.9 }}
          >
            <motion.div
              className="rounded-full"
              animate={{
                width: currentIndex === index ? 24 : 8,
                height: 8,
                backgroundColor: currentIndex === index ? '#0EA5E9' : '#CBD5E1',
              }}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 30
              }}
            />
          </motion.button>
        ))}
      </div>

      {/* Current Label */}
      <motion.span
        key={currentIndex}
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xs font-semibold text-slate-600"
      >
        {labels[currentIndex]}
      </motion.span>
    </div>
  );
};

export default CardProgressIndicator;
