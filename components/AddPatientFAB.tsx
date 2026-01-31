import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { haptics } from '../utils/haptics';

interface AddPatientFABProps {
  onClick: () => void;
  className?: string;
}

/**
 * World-Class Add Patient Floating Action Button
 *
 * Features:
 * - Multi-layer glow effects with animated gradients
 * - Morphing plus icon with rotation animation
 * - Particle effects on hover
 * - Pulse ring animation
 * - Magnetic hover effect
 * - Premium glass morphism
 * - Haptic feedback
 * - Fully responsive
 */
const AddPatientFAB: React.FC<AddPatientFABProps> = ({ onClick, className = '' }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  // Generate particle positions
  const particles = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    angle: (i * 45) * (Math.PI / 180),
    delay: i * 0.05,
  }));

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    haptics.impact();

    // Create ripple effect
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRipple = { id: Date.now(), x, y };
    setRipples(prev => [...prev, newRipple]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 600);

    onClick();
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    setShowParticles(true);
    haptics.selection();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTimeout(() => setShowParticles(false), 300);
  };

  return (
    <div className={`fixed bottom-20 md:bottom-8 right-4 md:right-8 z-50 ${className}`}>
      {/* Tooltip - Desktop only */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute right-full mr-4 top-1/2 -translate-y-1/2 hidden md:block"
          >
            <div className="relative">
              {/* Tooltip background with glass effect */}
              <div className="px-4 py-2.5 bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10">
                <span className="text-white font-semibold text-sm whitespace-nowrap flex items-center gap-2">
                  <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Add Patient
                </span>
              </div>
              {/* Tooltip arrow */}
              <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-slate-900/95 rotate-45 border-r border-t border-white/10" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Outer glow rings */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          boxShadow: isHovered
            ? [
                '0 0 0 0 rgba(20, 184, 166, 0.4)',
                '0 0 0 15px rgba(20, 184, 166, 0)',
              ]
            : '0 0 0 0 rgba(20, 184, 166, 0)',
        }}
        transition={{ duration: 1, repeat: isHovered ? Infinity : 0 }}
      />

      {/* Ambient glow */}
      <motion.div
        className="absolute -inset-3 rounded-full bg-gradient-to-r from-teal-500/30 via-cyan-500/30 to-blue-500/30 blur-xl"
        animate={{
          opacity: isHovered ? 0.8 : 0.4,
          scale: isHovered ? 1.2 : 1,
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Rotating gradient ring */}
      <motion.div
        className="absolute -inset-1 rounded-full bg-gradient-conic from-teal-500 via-cyan-500 via-blue-500 via-purple-500 to-teal-500 opacity-60"
        style={{ background: 'conic-gradient(from 0deg, #14b8a6, #06b6d4, #3b82f6, #8b5cf6, #14b8a6)' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />

      {/* Particle effects */}
      <AnimatePresence>
        {showParticles && particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute w-1.5 h-1.5 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400"
            initial={{
              x: '50%',
              y: '50%',
              opacity: 0,
              scale: 0,
            }}
            animate={{
              x: `calc(50% + ${Math.cos(particle.angle) * 40}px)`,
              y: `calc(50% + ${Math.sin(particle.angle) * 40}px)`,
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
            }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{
              duration: 0.8,
              delay: particle.delay,
              repeat: Infinity,
              repeatDelay: 0.5,
            }}
            style={{
              left: 0,
              top: 0,
              marginLeft: '-3px',
              marginTop: '-3px',
            }}
          />
        ))}
      </AnimatePresence>

      {/* Main button */}
      <motion.button
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onTouchStart={() => { setIsPressed(true); haptics.selection(); }}
        onTouchEnd={() => setIsPressed(false)}
        className="relative w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden focus:outline-none focus:ring-4 focus:ring-teal-400/50"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 15,
          delay: 0.2,
        }}
        aria-label="Add new patient"
      >
        {/* Button background gradient */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-teal-400 via-teal-500 to-cyan-600"
          animate={{
            background: isHovered
              ? 'linear-gradient(135deg, #2dd4bf 0%, #14b8a6 50%, #0891b2 100%)'
              : 'linear-gradient(135deg, #5eead4 0%, #14b8a6 50%, #0e7490 100%)',
          }}
          transition={{ duration: 0.3 }}
        />

        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: isHovered ? '100%' : '-100%' }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        />

        {/* Glass overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />

        {/* Inner shadow for depth */}
        <div className="absolute inset-0 rounded-full shadow-inner" style={{ boxShadow: 'inset 0 -4px 8px rgba(0,0,0,0.15)' }} />

        {/* Ripple effects */}
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            className="absolute bg-white/40 rounded-full pointer-events-none"
            initial={{ width: 0, height: 0, opacity: 0.5 }}
            animate={{ width: 120, height: 120, opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              left: ripple.x,
              top: ripple.y,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}

        {/* Plus icon container */}
        <motion.div
          className="relative z-10 flex items-center justify-center w-full h-full"
          animate={{
            rotate: isHovered ? 90 : 0,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {/* Custom Plus Icon with enhanced styling */}
          <svg
            className="w-7 h-7 md:w-8 md:h-8 text-white drop-shadow-lg"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            strokeLinecap="round"
          >
            <motion.line
              x1="12" y1="5" x2="12" y2="19"
              animate={{
                strokeWidth: isPressed ? 3 : 2.5,
              }}
            />
            <motion.line
              x1="5" y1="12" x2="19" y2="12"
              animate={{
                strokeWidth: isPressed ? 3 : 2.5,
              }}
            />
          </svg>
        </motion.div>

        {/* Pulse ring animation */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-white/50"
          animate={{
            scale: [1, 1.3, 1.3],
            opacity: [0.5, 0, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      </motion.button>

      {/* Bottom glow reflection */}
      <motion.div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 h-3 bg-teal-500/40 rounded-full blur-md"
        animate={{
          opacity: isHovered ? 0.8 : 0.5,
          width: isHovered ? 48 : 40,
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Mobile label - Shows below button on small screens */}
      <motion.div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 md:hidden"
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
          Add Patient
        </span>
      </motion.div>
    </div>
  );
};

export default AddPatientFAB;
