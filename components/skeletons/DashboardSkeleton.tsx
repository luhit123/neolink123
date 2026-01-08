import React from 'react';
import { motion } from 'framer-motion';

/**
 * Dashboard Loading Skeleton
 * Matches Dashboard layout for seamless loading experience
 * Features shimmer animation
 */
const DashboardSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse space-y-6">
      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-lg md:rounded-xl shadow-md-elevation-1 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20 mb-2" />
                <div className="h-8 bg-slate-300 dark:bg-slate-600 rounded w-16" />
              </div>
              <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Shimmer Effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{
                x: ['-100%', '200%'],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </div>
        ))}
      </div>

      {/* Chart Skeleton */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md-elevation-1 relative overflow-hidden">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-4" />
        <div className="h-64 bg-slate-100 dark:bg-slate-700/50 rounded flex items-end gap-2 px-4 pb-4">
          {[40, 60, 45, 70, 50, 80, 55].map((height, i) => (
            <div
              key={i}
              className="flex-1 bg-slate-300 dark:bg-slate-600 rounded-t"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>

        {/* Shimmer */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Patient List Skeleton */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md-elevation-1 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-40" />
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 relative overflow-hidden">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-700/50 rounded w-48" />
                </div>
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-16" />
              </div>

              {/* Shimmer */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear', delay: i * 0.1 }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
