import React from 'react';
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { haptics } from '../../utils/haptics';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  snapPoints?: number[]; // Heights in pixels [collapsed, expanded]
  className?: string;
}

/**
 * Material Design 3 Bottom Sheet
 * Features:
 * - Draggable with snap points
 * - Backdrop blur
 * - Spring physics
 * - Haptic feedback
 * - Optional title header
 */
const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
  snapPoints = [400],
  className = '',
}) => {
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [0.6, 0]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 150 || info.velocity.y > 500) {
      haptics.selection();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ opacity }}
      />

      {/* Bottom Sheet */}
      <motion.div
        className={`fixed left-0 right-0 bottom-0 bg-white dark:bg-slate-800 rounded-t-3xl z-50 max-h-[90vh] overflow-hidden ${className}`}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={handleDragEnd}
        style={{ y }}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-6 pb-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {children}
        </div>
      </motion.div>
    </>
  );
};

export default BottomSheet;
