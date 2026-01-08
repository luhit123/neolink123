import React from 'react';
import { motion } from 'framer-motion';
import { IconPlus } from '@tabler/icons-react';
import Ripple from './Ripple';
import { haptics } from '../../utils/haptics';

interface FABProps {
  icon?: React.ReactNode;
  label?: string;
  onClick: () => void;
  extended?: boolean;
  className?: string;
  color?: string;
}

/**
 * Floating Action Button (FAB)
 * Material Design 3 primary action button
 * Features:
 * - 64x64dp size (56dp on small screens)
 * - Ripple effect
 * - Haptic feedback
 * - Entrance animation
 * - Extended variant with label
 */
const FAB: React.FC<FABProps> = ({
  icon = <IconPlus size={24} />,
  label,
  onClick,
  extended = false,
  className = '',
  color = 'bg-medical-teal',
}) => {
  const handleClick = () => {
    haptics.impact();
    onClick();
  };

  return (
    <motion.div
      className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 z-30 ${className}`}
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      exit={{ scale: 0, rotate: 180 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Ripple
        className={`${color} text-white shadow-md-elevation-3 hover:shadow-md-elevation-4 transition-shadow ${
          extended ? 'rounded-full px-6 py-4' : 'w-14 h-14 md:w-16 md:h-16 rounded-full'
        } flex items-center justify-center gap-2 cursor-pointer`}
        onClick={handleClick}
        color="rgba(255, 255, 255, 0.3)"
      >
        <span className="flex-shrink-0">{icon}</span>
        {extended && label && (
          <motion.span
            className="font-semibold text-sm md:text-base whitespace-nowrap"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {label}
          </motion.span>
        )}
      </Ripple>
    </motion.div>
  );
};

export default FAB;
