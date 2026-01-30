/**
 * Professional Skeleton Loading Components
 *
 * Provides smooth loading states that match the actual content layout.
 * Uses CSS animations for performance.
 */

import React from 'react';

// Base skeleton with shimmer animation
export const Skeleton: React.FC<{
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}> = ({
  className = '',
  variant = 'text',
  width,
  height,
  animate = true
}) => {
  const baseClasses = 'bg-slate-200 dark:bg-slate-700';

  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-lg'
  };

  const animationClasses = animate
    ? 'animate-pulse relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent'
    : '';

  const style: React.CSSProperties = {
    width: width || (variant === 'text' ? '100%' : undefined),
    height: height || (variant === 'text' ? '1em' : undefined),
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses} ${className}`}
      style={style}
    />
  );
};

// Patient card skeleton
export const PatientCardSkeleton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={12} />
        </div>
        <Skeleton variant="rounded" width={60} height={24} />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" width={48} height={48} />
          <div className="space-y-2">
            <Skeleton width={150} height={18} />
            <Skeleton width={100} height={14} />
          </div>
        </div>
        <Skeleton variant="rounded" width={80} height={28} />
      </div>

      {/* Content */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton width="80%" height={14} />
          <Skeleton width="60%" height={14} />
        </div>
        <div className="space-y-2">
          <Skeleton width="70%" height={14} />
          <Skeleton width="50%" height={14} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
        <Skeleton width={120} height={12} />
        <div className="flex gap-2">
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="circular" width={32} height={32} />
        </div>
      </div>
    </div>
  );
};

// Patient list skeleton
export const PatientListSkeleton: React.FC<{ count?: number; compact?: boolean }> = ({
  count = 5,
  compact = false
}) => {
  return (
    <div className={`space-y-${compact ? '2' : '4'}`}>
      {Array.from({ length: count }).map((_, i) => (
        <PatientCardSkeleton key={i} compact={compact} />
      ))}
    </div>
  );
};

// Stats card skeleton
export const StatsCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton width={80} height={14} />
          <Skeleton width={60} height={32} />
        </div>
        <Skeleton variant="rounded" width={48} height={48} />
      </div>
    </div>
  );
};

// Dashboard stats skeleton
export const DashboardStatsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatsCardSkeleton key={i} />
      ))}
    </div>
  );
};

// Table skeleton
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 5
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width={`${100 / columns}%`} height={16} />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex gap-4 p-4 border-b border-slate-100 dark:border-slate-700 last:border-0"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              width={`${100 / columns}%`}
              height={14}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

// Chart skeleton
export const ChartSkeleton: React.FC<{ type?: 'bar' | 'line' | 'pie' }> = ({ type = 'bar' }) => {
  if (type === 'pie') {
    return (
      <div className="flex items-center justify-center p-8">
        <Skeleton variant="circular" width={200} height={200} />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
      <Skeleton width={150} height={20} className="mb-4" />
      <div className="flex items-end gap-2 h-48">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            width="100%"
            height={`${Math.random() * 60 + 40}%`}
          />
        ))}
      </div>
    </div>
  );
};

// Full page loading skeleton
export const PageLoadingSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton width={200} height={28} />
          <Skeleton width={150} height={16} />
        </div>
        <div className="flex gap-3">
          <Skeleton variant="rounded" width={120} height={40} />
          <Skeleton variant="rounded" width={100} height={40} />
        </div>
      </div>

      {/* Stats */}
      <DashboardStatsSkeleton />

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PatientListSkeleton count={4} />
        </div>
        <div className="space-y-4">
          <ChartSkeleton type="pie" />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>
      </div>
    </div>
  );
};

// Inline loading spinner
export const InlineLoader: React.FC<{ size?: 'sm' | 'md' | 'lg'; color?: string }> = ({
  size = 'md',
  color = 'teal'
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3'
  };

  return (
    <div
      className={`${sizeClasses[size]} border-${color}-200 border-t-${color}-500 rounded-full animate-spin`}
      style={{
        borderColor: `var(--${color}-200, #99f6e4)`,
        borderTopColor: `var(--${color}-500, #14b8a6)`
      }}
    />
  );
};

// Load more button
export const LoadMoreButton: React.FC<{
  onClick: () => void;
  loading?: boolean;
  hasMore?: boolean;
  className?: string;
}> = ({ onClick, loading = false, hasMore = true, className = '' }) => {
  if (!hasMore && !loading) {
    return (
      <p className="text-center text-slate-500 dark:text-slate-400 text-sm py-4">
        All patients loaded
      </p>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`
        w-full py-3 rounded-xl font-medium transition-all
        ${loading
          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-wait'
          : 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/50'
        }
        ${className}
      `}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <InlineLoader size="sm" />
          Loading more...
        </span>
      ) : (
        'Load More Patients'
      )}
    </button>
  );
};

// Empty state
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="w-16 h-16 mb-4 text-slate-300 dark:text-slate-600">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-slate-500 dark:text-slate-400 mb-4 max-w-sm">
          {description}
        </p>
      )}
      {action}
    </div>
  );
};

export default Skeleton;
