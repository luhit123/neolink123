import React from 'react';
import { motion, PanInfo } from 'framer-motion';

interface ModalTransitionProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  showBackdrop?: boolean;
  closeOnBackdropClick?: boolean;
  dragToClose?: boolean;
}

/**
 * Material Design Modal/Bottom Sheet Transition
 * Features:
 * - Slide up animation from bottom
 * - Backdrop fade
 * - Drag to dismiss
 * - Spring physics
 */
const ModalTransition: React.FC<ModalTransitionProps> = ({
  children,
  isOpen,
  onClose,
  className = '',
  showBackdrop = true,
  closeOnBackdropClick = true,
  dragToClose = true,
}) => {
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Close if dragged down more than 100px with sufficient velocity
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      {showBackdrop && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={closeOnBackdropClick ? onClose : undefined}
        />
      )}

      {/* Modal Content */}
      <motion.div
        className={`fixed bottom-0 left-0 right-0 z-50 ${className}`}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
        drag={dragToClose ? 'y' : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={dragToClose ? handleDragEnd : undefined}
      >
        {/* Drag Handle */}
        {dragToClose && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
          </div>
        )}
        {children}
      </motion.div>
    </>
  );
};

export default ModalTransition;
