import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AutoUpdatePrompt Component
 *
 * Automatically detects when a new version of the app is available
 * and prompts the user to refresh. Can be configured to auto-refresh
 * or show a notification.
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
        }, 60000); // Check every 60 seconds
      }
    },
    onRegisterError(error) {
      console.error('❌ Service Worker registration error:', error);
    },
    onNeedRefresh() {
      console.log('🆕 New version available!');
      setShowPrompt(true);

      // OPTION 1: Auto-refresh after 3 seconds (recommended for instant updates)
      setTimeout(() => {
        console.log('🔄 Auto-refreshing to apply updates...');
        updateServiceWorker(true); // true = reload page immediately
      }, 3000);

      // OPTION 2: If you prefer manual refresh, comment out the setTimeout above
      // and the notification will stay until user clicks "Refresh"
    },
    onOfflineReady() {
      console.log('✅ App ready to work offline');
    },
  });

  const handleRefresh = () => {
    updateServiceWorker(true); // Reload page immediately
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setNeedRefresh(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50"
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="backdrop-blur-xl bg-gradient-to-r from-medical-teal to-blue-600 text-white p-4 rounded-2xl shadow-2xl border border-white/20">
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 mt-1">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </motion.div>
              </div>

              {/* Content */}
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">New Update Available!</h3>
                <p className="text-sm text-white/90 mb-3">
                  A new version of NeoLink is ready. Refreshing in 3 seconds...
                </p>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleRefresh}
                    className="px-4 py-2 bg-white text-medical-teal font-semibold rounded-lg hover:bg-white/90 transition-colors text-sm"
                  >
                    Refresh Now
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-4 py-2 bg-white/20 backdrop-blur text-white font-semibold rounded-lg hover:bg-white/30 transition-colors text-sm"
                  >
                    Later
                  </button>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AutoUpdatePrompt;
