import React from 'react';
import { motion } from 'framer-motion';
import { glassmorphism, glassClasses } from '../../theme/glassmorphism';

export interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'light' | 'medium' | 'heavy' | 'tinted';
  shadow?: 'soft' | 'elevated' | 'floating' | 'card';
  border?: 'light' | 'medium' | 'heavy' | 'glow';
  rounded?: 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  hoverable?: boolean;
  onClick?: () => void;
  priority?: 'critical' | 'urgent' | 'routine' | 'improving';
}

/**
 * GlassCard - Premium glass-style card component
 *
 * A reusable card component with glassmorphism design that supports
 * multiple variants, animations, and interactive states.
 *
 * @example
 * <GlassCard variant="tinted" shadow="floating" hoverable>
 *   <h3>Patient Name</h3>
 *   <p>Patient details...</p>
 * </GlassCard>
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  variant = 'light',
  shadow = 'card',
  border = 'light',
  rounded = '3xl',
  padding = 'md',
  animated = true,
  hoverable = false,
  onClick,
  priority,
}) => {
  const backdropClass = glassmorphism.backdrop[variant];
  const shadowClass = glassmorphism.shadow[shadow];
  const borderClass = priority
    ? glassmorphism.statusGlow[priority]
    : glassmorphism.border[border];

  const roundedClass = {
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    '3xl': 'rounded-3xl',
    full: 'rounded-full',
  }[rounded];

  const paddingClass = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  }[padding];

  const baseClasses = glassClasses(
    backdropClass,
    borderClass,
    shadowClass,
    roundedClass,
    paddingClass,
    'relative overflow-hidden transition-all duration-300',
    hoverable && 'cursor-pointer',
    className
  );

  const hoverProps = hoverable
    ? {
        whileHover: { scale: 1.02 },
        whileTap: { scale: 0.98 },
      }
    : {};

  const animationProps = animated
    ? {
        initial: { opacity: 0, y: 20, scale: 0.95 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: glassmorphism.animation.spring,
        ...hoverProps,
      }
    : hoverProps;

  return (
    <motion.div {...animationProps} className={baseClasses} onClick={onClick}>
      {/* Gradient overlay that appears on hover */}
      {hoverable && (
        <div
          className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent
                     opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

/**
 * GlassCardHeader - Header section for GlassCard
 */
export const GlassCardHeader: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={glassClasses('pb-3 border-b border-white/10', className)}>
      {children}
    </div>
  );
};

/**
 * GlassCardBody - Body section for GlassCard
 */
export const GlassCardBody: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return <div className={glassClasses('py-3', className)}>{children}</div>;
};

/**
 * GlassCardFooter - Footer section for GlassCard
 */
export const GlassCardFooter: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={glassClasses('pt-3 border-t border-white/10', className)}>
      {children}
    </div>
  );
};

export default GlassCard;
