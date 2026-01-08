import React from 'react';
import { motion } from 'framer-motion';
import Ripple from './Ripple';
import { haptics } from '../../utils/haptics';

interface MaterialCardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'filled' | 'outlined';
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
  onClick?: () => void;
  className?: string;
  hoverable?: boolean;
}

/**
 * Material Design 3 Card Component
 * Features:
 * - Three variants: elevated, filled, outlined
 * - Elevation system (0-5)
 * - Ripple effect (if clickable)
 * - Hover animations
 * - Haptic feedback
 */
const MaterialCard: React.FC<MaterialCardProps> = ({
  children,
  variant = 'elevated',
  elevation = 1,
  onClick,
  className = '',
  hoverable = true,
}) => {
  const handleClick = () => {
    if (onClick) {
      haptics.tap();
      onClick();
    }
  };

  const elevationClasses = {
    0: 'shadow-md-elevation-0',
    1: 'shadow-md-elevation-1',
    2: 'shadow-md-elevation-2',
    3: 'shadow-md-elevation-3',
    4: 'shadow-md-elevation-4',
    5: 'shadow-md-elevation-5',
  };

  const variantClasses = {
    elevated: `bg-white dark:bg-slate-800 ${elevationClasses[elevation]}`,
    filled: 'bg-slate-100 dark:bg-slate-700',
    outlined: 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600',
  };

  const baseClasses = `rounded-xl overflow-hidden ${variantClasses[variant]} ${className} ${
    onClick ? 'cursor-pointer' : ''
  }`;

  const content = (
    <motion.div
      className="h-full"
      whileHover={
        hoverable && onClick
          ? {
              y: -4,
              transition: { type: 'spring', stiffness: 400, damping: 25 },
            }
          : {}
      }
      whileTap={onClick ? { scale: 0.98 } : {}}
    >
      {children}
    </motion.div>
  );

  if (onClick) {
    return (
      <Ripple className={baseClasses} onClick={handleClick}>
        {content}
      </Ripple>
    );
  }

  return <div className={baseClasses}>{content}</div>;
};

export default MaterialCard;
