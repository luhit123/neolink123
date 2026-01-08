import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';
import { haptics } from '../../utils/haptics';

export type SnackbarType = 'success' | 'error' | 'info' | 'warning';

interface SnackbarProps {
  message: string;
  type?: SnackbarType;
  isOpen: boolean;
  onClose: () => void;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Material Design 3 Snackbar Component
 * Features:
 * - Auto-dismiss after duration
 * - Swipe to dismiss
 * - Action button support
 * - Type-based styling (success, error, info, warning)
 * - Positioned above bottom navigation
 */
const Snackbar: React.FC<SnackbarProps> = ({
  message,
  type = 'info',
  isOpen,
  onClose,
  duration = 4000,
  action,
  className = '',
}) => {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  const icons = {
    success: <IconCheck size={20} />,
    error: <IconX size={20} />,
    info: <IconAlertCircle size={20} />,
    warning: <IconAlertCircle size={20} />,
  };

  const colors = {
    success: 'bg-medical-green',
    error: 'bg-medical-red',
    info: 'bg-slate-800 dark:bg-slate-700',
    warning: 'bg-medical-orange',
  };

  const handleActionClick = () => {
    if (action) {
      haptics.tap();
      action.onClick();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={`fixed left-4 right-4 md:left-auto md:right-6 md:min-w-[344px] md:max-w-[672px] bottom-20 md:bottom-20 z-50 ${className}`}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.7}
          onDragEnd={(_, info) => {
            if (Math.abs(info.offset.x) > 100) {
              haptics.selection();
              onClose();
            }
          }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
          }}
        >
          <div className={`${colors[type]} text-white rounded-lg shadow-md-elevation-4 p-4 flex items-center gap-3`}>
            <span className="flex-shrink-0">{icons[type]}</span>

            <p className="flex-1 text-sm font-medium">{message}</p>

            {action && (
              <button
                className="flex-shrink-0 px-3 py-1 text-sm font-semibold uppercase tracking-wide hover:bg-white/10 rounded transition-colors"
                onClick={handleActionClick}
              >
                {action.label}
              </button>
            )}

            <button
              className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
              onClick={() => {
                haptics.light();
                onClose();
              }}
            >
              <IconX size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Snackbar;
