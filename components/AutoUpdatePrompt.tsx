import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AutoUpdatePrompt Component
 *
 * Sleek, minimal update notification with ultramodern loading animation
 */
const AutoUpdatePrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log('✅ Service Worker registered:', swUrl);

      // Check for updates every 60 seconds
      if (registration) {
        setInterval(() => {
          console.log('🔄 Checking for updates...');
          registration.update();
        }, 60000);
      }
    },
    onRegisterError(error) {
      console.error('❌ Service Worker registration error:', error);
    },
    onNeedRefresh() {
      console.log('🆕 New version available!');
      setShowPrompt(true);

      // Auto-refresh after 3 seconds
      setTimeout(() => {
        console.log('🔄 Auto-refreshing to apply updates...');
        updateServiceWorker(true);
      }, 3000);
    },
    onOfflineReady() {
      console.log('✅ App ready to work offline');
    },
  });

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100]"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900/90 backdrop-blur-xl rounded-full shadow-2xl border border-slate-700/50">
            {/* Ultramodern Loading Spinner */}
            <div className="relative w-5 h-5">
              {/* Outer ring */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 border-r-cyan-400"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              {/* Inner ring */}
              <motion.div
                className="absolute inset-0.5 rounded-full border-2 border-transparent border-b-purple-400 border-l-purple-400"
                animate={{ rotate: -360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
              {/* Center dot */}
              <motion.div
                className="absolute inset-[6px] rounded-full bg-gradient-to-r from-cyan-400 to-purple-400"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </div>

            {/* Text */}
            <div className="flex flex-col">
              <span className="text-white text-xs font-medium tracking-wide">
                NeoLink is updating
              </span>
              <span className="text-slate-400 text-[10px]">
                Launching new features soon
              </span>
            </div>

            {/* Pulse dots */}
            <div className="flex gap-0.5 ml-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 h-1 bg-cyan-400 rounded-full"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AutoUpdatePrompt;
