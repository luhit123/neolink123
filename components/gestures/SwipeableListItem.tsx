import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { haptics } from '../../utils/haptics';

interface SwipeAction {
  label: string;
  color: string;
  icon?: React.ReactNode;
}

interface SwipeableListItemProps {
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Alternative API: called on left-swipe gesture */
  onSwipeLeft?: () => void;
  /** Alternative API: called on right-swipe gesture */
  onSwipeRight?: () => void;
  /** Label/icon shown when swiping right (reveals from left) */
  leftAction?: SwipeAction;
  /** Label/icon shown when swiping left (reveals from right) */
  rightAction?: SwipeAction;
  className?: string;
  threshold?: number;
}

/**
 * Swipeable List Item Component
 * Material Design swipe actions
 * Features:
 * - Left swipe: Delete (red)
 * - Right swipe: Edit (blue)
 * - Haptic feedback
 * - Spring animation
 * - Action threshold
 */
const SwipeableListItem: React.FC<SwipeableListItemProps> = ({
  children,
  onEdit,
  onDelete,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  className = '',
  threshold = 80,
}) => {
  // Merge old and new APIs
  const handleLeft = onSwipeLeft ?? onDelete;
  const handleRight = onSwipeRight ?? onEdit;
  const [isRevealed, setIsRevealed] = useState(false);
  const x = useMotionValue(0);
  const backgroundColor = useTransform(
    x,
    [-threshold, 0, threshold],
    ['rgb(220, 38, 38)', 'transparent', 'rgb(14, 165, 233)']
  );

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeDistance = info.offset.x;

    // Right swipe
    if (swipeDistance > threshold && handleRight) {
      haptics.impact();
      setIsRevealed(true);
      setTimeout(() => {
        handleRight();
        setIsRevealed(false);
      }, 200);
    }
    // Left swipe
    else if (swipeDistance < -threshold && handleLeft) {
      haptics.warning();
      setIsRevealed(true);
      setTimeout(() => {
        handleLeft();
        setIsRevealed(false);
      }, 200);
    } else {
      setIsRevealed(false);
    }
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Background Actions */}
      <motion.div
        className="absolute inset-0 flex items-center justify-between px-6"
        style={{ backgroundColor }}
      >
        {/* Right-swipe Action (revealed from left) */}
        {(handleRight) && (
          <motion.div
            className="flex items-center gap-2 text-white"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {leftAction?.icon ?? <IconEdit size={20} />}
            <span className="font-semibold">{leftAction?.label ?? 'Edit'}</span>
          </motion.div>
        )}

        <div className="flex-1" />

        {/* Left-swipe Action (revealed from right) */}
        {(handleLeft) && (
          <motion.div
            className="flex items-center gap-2 text-white"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <span className="font-semibold">{rightAction?.label ?? 'Delete'}</span>
            {rightAction?.icon ?? <IconTrash size={20} />}
          </motion.div>
        )}
      </motion.div>

      {/* Swipeable Content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: handleLeft ? -threshold * 1.2 : 0, right: handleRight ? threshold * 1.2 : 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        animate={{ x: isRevealed ? 0 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-white dark:bg-slate-800"
      >
        {children}
      </motion.div>
    </div>
  );
};

export default SwipeableListItem;
