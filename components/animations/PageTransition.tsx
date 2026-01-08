import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
  pageKey: string;
  direction?: 'forward' | 'back';
  className?: string;
}

/**
 * Android-style Page Transition Component
 * Implements Material Design motion patterns
 * - Forward: Slide in from right
 * - Back: Slide in from left
 * - Exit: Fade and slide slightly left
 */
const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  pageKey,
  direction = 'forward',
  className = '',
}) => {
  const variants = {
    initial: {
      x: direction === 'forward' ? '100%' : '-25%',
      opacity: direction === 'forward' ? 1 : 0,
    },
    animate: {
      x: 0,
      opacity: 1,
    },
    exit: {
      x: direction === 'forward' ? '-25%' : '100%',
      opacity: direction === 'forward' ? 0 : 1,
    },
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        className={className}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
          mass: 0.8,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default PageTransition;
