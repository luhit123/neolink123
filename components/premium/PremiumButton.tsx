import React from 'react';
import { motion } from 'framer-motion';
import { glassmorphism, glassClasses } from '../../theme/glassmorphism';
import { Ripple } from '../Ripple';

export interface PremiumButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  glass?: boolean;
}

/**
 * PremiumButton - High-quality button component with glass effects
 *
 * A premium button component featuring glassmorphism, ripple effects,
 * haptic feedback, and smooth animations.
 *
 * @example
 * <PremiumButton variant="primary" icon={<SaveIcon />} loading={isSaving}>
 *   Save Patient
 * </PremiumButton>
 */
export const PremiumButton: React.FC<PremiumButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  className = '',
  type = 'button',
  glass = true,
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
    xl: 'px-8 py-4 text-xl',
  }[size];

  const variantClasses = glass
    ? {
        primary: glassClasses(
          glassmorphism.backdrop.light,
          glassmorphism.border.glow,
          'bg-gradient-to-r from-sky-500/80 to-blue-600/80',
          'hover:from-sky-600/90 hover:to-blue-700/90',
          'text-white font-semibold',
          glassmorphism.shadow.elevated
        ),
        secondary: glassClasses(
          glassmorphism.backdrop.light,
          glassmorphism.border.light,
          'hover:bg-white/80',
          'text-sky-700 font-semibold',
          glassmorphism.shadow.card
        ),
        success: glassClasses(
          glassmorphism.backdrop.light,
          glassmorphism.border.glowGreen,
          'bg-gradient-to-r from-emerald-500/80 to-green-600/80',
          'hover:from-emerald-600/90 hover:to-green-700/90',
          'text-white font-semibold',
          glassmorphism.shadow.elevated
        ),
        danger: glassClasses(
          glassmorphism.backdrop.light,
          glassmorphism.border.glowRed,
          'bg-gradient-to-r from-red-500/80 to-rose-600/80',
          'hover:from-red-600/90 hover:to-rose-700/90',
          'text-white font-semibold',
          glassmorphism.shadow.elevated
        ),
        outline: glassClasses(
          'bg-transparent',
          'border-2 border-sky-400',
          'hover:bg-sky-50/50',
          'text-sky-600 font-semibold'
        ),
        ghost: glassClasses(
          'bg-transparent',
          'hover:bg-white/30',
          'text-sky-700 font-medium'
        ),
      }[variant]
    : // Non-glass solid variants
      {
        primary: 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold shadow-lg',
        secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold shadow',
        success: 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold shadow-lg',
        danger: 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold shadow-lg',
        outline: 'bg-transparent border-2 border-sky-400 hover:bg-sky-50 text-sky-600 font-semibold',
        ghost: 'bg-transparent hover:bg-slate-100 text-slate-700 font-medium',
      }[variant];

  const baseClasses = glassClasses(
    sizeClasses,
    variantClasses,
    'rounded-xl',
    'relative overflow-hidden',
    'transition-all duration-200',
    'flex items-center justify-center gap-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'active:scale-95',
    fullWidth && 'w-full',
    className
  );

  const handleClick = () => {
    if (!disabled && !loading && onClick) {
      // Haptic feedback (if available)
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
      onClick();
    }
  };

  return (
    <motion.button
      type={type}
      disabled={disabled || loading}
      onClick={handleClick}
      className={baseClasses}
      whileTap={!disabled && !loading ? { scale: 0.95 } : undefined}
      whileHover={!disabled && !loading ? { scale: 1.02 } : undefined}
    >
      <Ripple />

      {/* Loading spinner */}
      {loading && (
        <svg
          className="animate-spin h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
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
      )}

      {/* Icon (left) */}
      {!loading && icon && iconPosition === 'left' && (
        <span className="flex-shrink-0">{icon}</span>
      )}

      {/* Content */}
      {!loading && <span>{children}</span>}

      {/* Icon (right) */}
      {!loading && icon && iconPosition === 'right' && (
        <span className="flex-shrink-0">{icon}</span>
      )}
    </motion.button>
  );
};

/**
 * IconButton - Circular button for icons only
 */
export const IconButton: React.FC<{
  icon: React.ReactNode;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
  glass?: boolean;
  label?: string;
}> = ({ icon, onClick, size = 'md', variant = 'secondary', className = '', glass = true, label }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 p-1.5',
    md: 'w-10 h-10 p-2',
    lg: 'w-12 h-12 p-2.5',
  }[size];

  const variantClasses = glass
    ? {
        primary: glassClasses(
          glassmorphism.backdrop.light,
          glassmorphism.border.glow,
          'bg-gradient-to-br from-sky-500/80 to-blue-600/80',
          'hover:from-sky-600/90 hover:to-blue-700/90',
          'text-white'
        ),
        secondary: glassClasses(
          glassmorphism.backdrop.light,
          glassmorphism.border.light,
          'hover:bg-white/80',
          'text-sky-700'
        ),
        ghost: 'bg-transparent hover:bg-white/30 text-sky-700',
      }[variant]
    : {
        primary: 'bg-gradient-to-br from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-lg',
        secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 shadow',
        ghost: 'bg-transparent hover:bg-slate-100 text-slate-700',
      }[variant];

  const handleClick = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    onClick?.();
  };

  return (
    <motion.button
      onClick={handleClick}
      className={glassClasses(
        sizeClasses,
        variantClasses,
        'rounded-full',
        'relative overflow-hidden',
        'flex items-center justify-center',
        'transition-all duration-200',
        className
      )}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.1 }}
      aria-label={label}
    >
      <Ripple />
      {icon}
    </motion.button>
  );
};

export default PremiumButton;
