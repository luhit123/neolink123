import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { glassmorphism, glassClasses } from '../../theme/glassmorphism';

export interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  variant?: 'center' | 'bottom-sheet';
  closeOnBackdropClick?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

/**
 * GlassModal - Premium modal component with glassmorphism
 *
 * A modal/dialog component with glass effects, smooth animations,
 * and support for both centered modals and bottom sheets.
 *
 * @example
 * <GlassModal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   title="Patient Details"
 *   variant="center"
 * >
 *   <p>Modal content here...</p>
 * </GlassModal>
 */
export const GlassModal: React.FC<GlassModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  variant = 'center',
  closeOnBackdropClick = true,
  showCloseButton = true,
  className = '',
}) => {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full',
  }[size];

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants =
    variant === 'center'
      ? {
          hidden: { opacity: 0, scale: 0.9, y: 20 },
          visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: glassmorphism.animation.spring,
          },
          exit: {
            opacity: 0,
            scale: 0.9,
            y: 20,
            transition: glassmorphism.animation.fast,
          },
        }
      : {
          hidden: { y: '100%' },
          visible: {
            y: 0,
            transition: glassmorphism.animation.spring,
          },
          exit: {
            y: '100%',
            transition: glassmorphism.animation.smooth,
          },
        };

  const handleBackdropClick = () => {
    if (closeOnBackdropClick) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={handleBackdropClick}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className={glassClasses(
              variant === 'center'
                ? glassClasses(
                    'relative',
                    'w-full mx-4',
                    sizeClasses,
                    glassmorphism.backdrop.heavy,
                    glassmorphism.border.light,
                    'rounded-3xl',
                    glassmorphism.shadow.floating,
                    'max-h-[90vh] overflow-auto'
                  )
                : glassClasses(
                    'fixed bottom-0 left-0 right-0',
                    'w-full',
                    glassmorphism.backdrop.heavy,
                    'rounded-t-3xl',
                    glassmorphism.border.light,
                    'border-b-0',
                    glassmorphism.shadow.floating,
                    'max-h-[85vh] overflow-auto'
                  ),
              className
            )}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/60 border-b border-white/20 px-6 py-4 flex items-center justify-between">
                {title && (
                  <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                )}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-white/30 transition-colors text-slate-600 hover:text-slate-800"
                    aria-label="Close modal"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Bottom sheet drag indicator */}
            {variant === 'bottom-sheet' && (
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-12 h-1 bg-slate-300 rounded-full" />
              </div>
            )}

            {/* Content */}
            <div className={variant === 'center' ? 'p-6' : 'px-6 pb-6'}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

/**
 * ConfirmationModal - Glass modal for confirmations
 */
export const ConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info',
}) => {
  const variantColors = {
    danger: {
      bg: 'bg-red-50',
      icon: 'text-red-600',
      button: 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700',
    },
    warning: {
      bg: 'bg-yellow-50',
      icon: 'text-yellow-600',
      button: 'bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700',
    },
    info: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      button: 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700',
    },
  }[variant];

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <GlassModal isOpen={isOpen} onClose={onClose} size="sm" variant="center">
      <div className="text-center">
        {/* Icon */}
        <div className={glassClasses('mx-auto flex items-center justify-center h-12 w-12 rounded-full', variantColors.bg)}>
          <svg
            className={glassClasses('h-6 w-6', variantColors.icon)}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Title */}
        <h3 className="mt-4 text-lg font-semibold text-slate-800">{title}</h3>

        {/* Message */}
        <p className="mt-2 text-sm text-slate-600">{message}</p>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white/70 backdrop-blur-lg border border-white/30 rounded-xl font-semibold text-slate-700 hover:bg-white/80 transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={glassClasses(
              'flex-1 px-4 py-2 rounded-xl font-semibold text-white transition-all shadow-lg',
              variantColors.button
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </GlassModal>
  );
};

export default GlassModal;
