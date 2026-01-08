import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { haptics } from '../../utils/haptics';

interface SwipeableListItemProps {
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
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
  className = '',
  threshold = 80,
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const x = useMotionValue(0);
  const backgroundColor = useTransform(
    x,
    [-threshold, 0, threshold],
    ['rgb(220, 38, 38)', 'transparent', 'rgb(14, 165, 233)']
  );

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeDistance = info.offset.x;

    // Right swipe - Edit
    if (swipeDistance > threshold && onEdit) {
      haptics.impact();
      setIsRevealed(true);
      setTimeout(() => {
        onEdit();
        setIsRevealed(false);
      }, 200);
    }
    // Left swipe - Delete
    else if (swipeDistance < -threshold && onDelete) {
      haptics.warning();
      setIsRevealed(true);
      setTimeout(() => {
        onDelete();
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
        {/* Edit Action (Right) */}
        {onEdit && (
          <motion.div
            className="flex items-center gap-2 text-white"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <IconEdit size={20} />
            <span className="font-semibold">Edit</span>
          </motion.div>
        )}

        <div className="flex-1" />

        {/* Delete Action (Left) */}
        {onDelete && (
          <motion.div
            className="flex items-center gap-2 text-white"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <span className="font-semibold">Delete</span>
            <IconTrash size={20} />
          </motion.div>
        )}
      </motion.div>

      {/* Swipeable Content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: onDelete ? -threshold * 1.2 : 0, right: onEdit ? threshold * 1.2 : 0 }}
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
