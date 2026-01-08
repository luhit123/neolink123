import React from 'react';
import { motion } from 'framer-motion';

interface ListItemAnimationProps {
  children: React.ReactNode;
  index: number;
  className?: string;
  delay?: number;
}

/**
 * Stagger Animation for List Items
 * Material Design list entrance animation
 * Each item fades in and slides up with a stagger delay
 */
const ListItemAnimation: React.FC<ListItemAnimationProps> = ({
  children,
  index,
  className = '',
  delay = 50,
}) => {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        duration: 0.3,
        delay: index * (delay / 1000),
        ease: [0.4, 0.0, 0.2, 1],
      }}
      layout
    >
      {children}
    </motion.div>
  );
};

/**
 * Container for staggered list animations
 */
export const AnimatedList: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {children}
    </motion.div>
  );
};

export default ListItemAnimation;
