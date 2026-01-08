import React from 'react';
import { motion } from 'framer-motion';
import { IconX } from '@tabler/icons-react';
import Ripple from './Ripple';
import { haptics } from '../../utils/haptics';

interface ChipProps {
  label: string;
  selected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
  icon?: React.ReactNode;
  variant?: 'filter' | 'input' | 'suggestion';
  className?: string;
  disabled?: boolean;
}

/**
 * Material Design 3 Chip Component
 * Features:
 * - Filter, Input, and Suggestion variants
 * - Selected state
 * - Delete action
 * - Ripple effect
 * - Haptic feedback
 */
const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onSelect,
  onDelete,
  icon,
  variant = 'filter',
  className = '',
  disabled = false,
}) => {
  const handleClick = () => {
    if (!disabled && onSelect) {
      haptics.selection();
      onSelect();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled && onDelete) {
      haptics.light();
      onDelete();
    }
  };

  const baseClasses = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
  }`;

  const variantClasses = {
    filter: selected
      ? 'bg-medical-teal text-white'
      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600',
    input: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
    suggestion: 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700',
  };

  return (
    <motion.div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
    >
      <Ripple
        className="flex items-center gap-1.5"
        onClick={handleClick}
        disabled={disabled}
        color={selected ? 'rgba(255, 255, 255, 0.3)' : 'rgba(14, 165, 233, 0.2)'}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span>{label}</span>
        {onDelete && (
          <motion.button
            className={`flex-shrink-0 rounded-full p-0.5 ${
              selected ? 'hover:bg-white/20' : 'hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
            onClick={handleDelete}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            disabled={disabled}
          >
            <IconX size={14} />
          </motion.button>
        )}
      </Ripple>
    </motion.div>
  );
};

export default Chip;
