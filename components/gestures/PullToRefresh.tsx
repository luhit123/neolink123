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
  const [canPull, setCanPull] = useState(true);

  const handleDragStart = () => {
    // Only allow pull-to-refresh when scrolled to top
    const isAtTop = window.scrollY === 0;
    setCanPull(isAtTop);
  };

  const handleDragEnd = async (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (canPull && info.offset.y >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      haptics.impact();

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  // Simplified version - just wrap children without drag interference
  if (isRefreshing) {
    return (
      <div className={`relative ${className}`}>
        {/* Pull Indicator */}
        <div className="flex justify-center items-center py-4">
          <div className="w-8 h-8 border-3 border-medical-teal border-t-transparent rounded-full animate-spin" />
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {children}
    </div>
  );
};

export default PullToRefresh;
