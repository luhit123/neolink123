import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { haptics } from '../../utils/haptics';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  className?: string;
  threshold?: number;
}

/**
 * Pull to Refresh Component
 * Android-style pull-to-refresh gesture
 * Features:
 * - Pull indicator with progress
 * - Haptic feedback on trigger
 * - Spring animation
 * - Works with scrollable content
 */
const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  className = '',
  threshold = 80,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const y = useMotionValue(0);
  const rotation = useTransform(y, [0, threshold], [0, 180]);
  const opacity = useTransform(y, [0, threshold / 2, threshold], [0, 0.5, 1]);

  const handleDragEnd = async (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      haptics.impact();

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  return (
    <motion.div className={`relative ${className}`} style={{ y }}>
      {/* Pull Indicator */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex justify-center items-center"
        style={{
          opacity,
          height: useTransform(y, [0, threshold], [0, threshold]),
        }}
      >
        <motion.div
          className="w-8 h-8 border-3 border-medical-teal border-t-transparent rounded-full"
          style={{ rotate: rotation }}
          animate={isRefreshing ? { rotate: 360 } : {}}
          transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
        />
      </motion.div>

      {/* Content */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.5, bottom: 0 }}
        onDragEnd={handleDragEnd}
        style={{ y: isRefreshing ? threshold : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

export default PullToRefresh;
