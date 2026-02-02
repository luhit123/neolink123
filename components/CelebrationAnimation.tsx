import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CelebrationAnimationProps {
  show: boolean;
  onComplete?: () => void;
  timeTaken: number; // in seconds
  formType: 'admission' | 'clinical_note';
  patientName?: string;
}

// Particle types for variety
type ParticleType = 'star' | 'flower' | 'sparkle' | 'heart' | 'confetti';

interface Particle {
  id: number;
  type: ParticleType;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  rotation: number;
}

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8B500', '#FF69B4', '#00CED1', '#FFD700', '#FF6347'
];

const PARTICLE_EMOJIS: Record<ParticleType, string[]> = {
  star: ['⭐', '🌟', '✨', '💫'],
  flower: ['🌸', '🌺', '🌼', '🌷', '💐', '🌻'],
  sparkle: ['✨', '💖', '💝', '💗'],
  heart: ['❤️', '💕', '💖', '💗', '💓'],
  confetti: ['🎉', '🎊', '🎈', '🎁']
};

/**
 * Beautiful Celebration Animation
 * Shows when user completes form entry
 */
const CelebrationAnimation: React.FC<CelebrationAnimationProps> = ({
  show,
  onComplete,
  timeTaken,
  formType,
  patientName
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showMessage, setShowMessage] = useState(false);

  // Generate particles
  const generateParticles = useCallback(() => {
    const newParticles: Particle[] = [];
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
      const types: ParticleType[] = ['star', 'flower', 'sparkle', 'heart', 'confetti'];
      const type = types[Math.floor(Math.random() * types.length)];

      newParticles.push({
        id: i,
        type,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        size: 16 + Math.random() * 24,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
        rotation: Math.random() * 360
      });
    }

    return newParticles;
  }, []);

  useEffect(() => {
    if (show) {
      setParticles(generateParticles());

      // Show message after a short delay
      setTimeout(() => setShowMessage(true), 300);

      // Auto-complete after animation
      const timer = setTimeout(() => {
        onComplete?.();
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      setShowMessage(false);
      setParticles([]);
    }
  }, [show, generateParticles, onComplete]);

  // Get motivational message based on time
  const getMessage = () => {
    const minutes = Math.floor(timeTaken / 60);
    const seconds = timeTaken % 60;
    const timeStr = minutes > 0
      ? `${minutes} min ${seconds} sec`
      : `${seconds} seconds`;

    if (timeTaken < 60) {
      return {
        title: '🚀 Lightning Fast!',
        subtitle: `Completed in just ${timeStr}!`,
        message: 'You\'re incredibly efficient!'
      };
    } else if (timeTaken < 180) {
      return {
        title: '⚡ Super Quick!',
        subtitle: `Done in ${timeStr}`,
        message: 'Great speed and accuracy!'
      };
    } else if (timeTaken < 300) {
      return {
        title: '✨ Excellent Work!',
        subtitle: `Completed in ${timeStr}`,
        message: 'Thorough and efficient!'
      };
    } else if (timeTaken < 600) {
      return {
        title: '🌟 Great Job!',
        subtitle: `Time taken: ${timeStr}`,
        message: 'Detailed documentation!'
      };
    } else {
      return {
        title: '💪 Comprehensive Entry!',
        subtitle: `Time invested: ${timeStr}`,
        message: 'Thorough patient documentation!'
      };
    }
  };

  const getParticleEmoji = (particle: Particle) => {
    const emojis = PARTICLE_EMOJIS[particle.type];
    return emojis[Math.floor(Math.random() * emojis.length)];
  };

  const messageData = getMessage();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
        >
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm pointer-events-auto"
            onClick={onComplete}
          />

          {/* Particle container */}
          <div className="absolute inset-0 overflow-hidden">
            {particles.map((particle) => (
              <motion.div
                key={particle.id}
                initial={{
                  x: `${particle.x}vw`,
                  y: `${particle.y}vh`,
                  rotate: 0,
                  scale: 0
                }}
                animate={{
                  y: '110vh',
                  rotate: particle.rotation + 720,
                  scale: [0, 1, 1, 0.5],
                  x: `${particle.x + (Math.random() - 0.5) * 20}vw`
                }}
                transition={{
                  duration: particle.duration,
                  delay: particle.delay,
                  ease: 'easeOut'
                }}
                style={{ fontSize: particle.size }}
                className="absolute"
              >
                {getParticleEmoji(particle)}
              </motion.div>
            ))}
          </div>

          {/* Central burst effect */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0] }}
            transition={{ duration: 0.5, times: [0, 0.5, 1] }}
            className="absolute w-64 h-64 bg-gradient-radial from-yellow-300/50 via-orange-300/30 to-transparent rounded-full"
          />

          {/* Main message card */}
          <AnimatePresence>
            {showMessage && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: -50 }}
                transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                className="relative z-10 pointer-events-auto"
              >
                <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md mx-4 border-4 border-yellow-300">
                  {/* Floating stars around card */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                    className="absolute -top-4 -left-4 text-3xl"
                  >
                    ⭐
                  </motion.div>
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                    className="absolute -top-4 -right-4 text-3xl"
                  >
                    🌟
                  </motion.div>
                  <motion.div
                    animate={{ y: [-5, 5, -5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-3xl"
                  >
                    🎉
                  </motion.div>

                  {/* Content */}
                  <div className="text-center">
                    {/* Animated trophy/badge */}
                    <motion.div
                      animate={{
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-6xl mb-4"
                    >
                      {timeTaken < 120 ? '🏆' : timeTaken < 300 ? '🥇' : '🎖️'}
                    </motion.div>

                    {/* Title */}
                    <motion.h2
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 bg-clip-text text-transparent mb-2"
                    >
                      {messageData.title}
                    </motion.h2>

                    {/* Form type badge */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 }}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full text-sm font-medium mb-3"
                    >
                      <span>{formType === 'admission' ? '📋 Admission Form' : '📝 Clinical Note'}</span>
                    </motion.div>

                    {/* Patient name if provided */}
                    {patientName && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-gray-600 text-sm mb-2"
                      >
                        Patient: <span className="font-semibold text-gray-800">{patientName}</span>
                      </motion.p>
                    )}

                    {/* Time display */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 mb-4 border border-green-200"
                    >
                      <p className="text-lg font-bold text-green-700">{messageData.subtitle}</p>
                      <p className="text-sm text-green-600">{messageData.message}</p>
                    </motion.div>

                    {/* Progress indicator */}
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 4, delay: 0.5 }}
                      className="h-1.5 bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 rounded-full mb-4"
                    />

                    {/* Close button */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={onComplete}
                      className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-shadow"
                    >
                      Continue 🚀
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CelebrationAnimation;
