import React, { useState, useCallback, CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RippleEffect {
  id: number;
  x: number;
  y: number;
  size: number;
}

interface RippleProps {
  color?: string;
  duration?: number;
  className?: string;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
}

/**
 * Material Design Ripple Effect Component
 * Provides touch feedback with expanding circle animation
 * GPU-accelerated for 60fps performance
 */
const Ripple: React.FC<RippleProps> = ({
  color = 'rgba(14, 165, 233, 0.3)', // Medical teal with 30% opacity
  duration = 600,
  className = '',
  children,
  onClick,
  disabled = false,
}) => {
  const [ripples, setRipples] = useState<RippleEffect[]>([]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Calculate ripple size based on element size
      const size = Math.max(rect.width, rect.height) * 2;

      const newRipple: RippleEffect = {
        id: Date.now(),
        x,
        y,
        size,
      };

      setRipples((prev) => [...prev, newRipple]);

      // Remove ripple after animation completes
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, duration);

      // Call original onClick handler
      onClick?.(e);
    },
    [disabled, duration, onClick]
  );

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onClick={handleClick}
      style={{
        WebkitTapHighlightColor: 'transparent', // Remove default mobile tap highlight
      }}
    >
      {children}
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
              marginLeft: -ripple.size / 2,
              marginTop: -ripple.size / 2,
              backgroundColor: color,
              willChange: 'transform, opacity',
            } as CSSProperties}
            initial={{
              transform: 'scale(0)',
              opacity: 1,
            }}
            animate={{
              transform: 'scale(1)',
              opacity: 0,
            }}
            exit={{
              opacity: 0,
            }}
            transition={{
              duration: duration / 1000,
              ease: [0.4, 0.0, 0.2, 1], // Material Design standard easing
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

/**
 * Higher-order component to add ripple effect to any component
 */
export const withRipple = <P extends object>(
  Component: React.ComponentType<P>,
  rippleColor?: string
): React.FC<P & { rippleColor?: string }> => {
  return ({ rippleColor: customColor, ...props }: P & { rippleColor?: string }) => (
    <Ripple color={customColor || rippleColor}>
      <Component {...(props as P)} />
    </Ripple>
  );
};

/**
 * Button wrapper with built-in ripple effect
 */
export const RippleButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    rippleColor?: string;
  }
> = ({ rippleColor, children, className = '', disabled, onClick, ...props }) => {
  return (
    <Ripple
      color={rippleColor}
      className={`${className} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      onClick={onClick as any}
      disabled={disabled}
    >
      <button className="w-full h-full" disabled={disabled} {...props}>
        {children}
      </button>
    </Ripple>
  );
};

export default Ripple;
