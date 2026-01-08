import React from 'react';
import { motion } from 'framer-motion';

/**
 * Patient Card/Row Loading Skeleton
 * Used in patient lists and tables
 */
const PatientCardSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 relative overflow-hidden"
        >
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full flex-shrink-0" />

            {/* Content */}
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-40" />
              <div className="h-3 bg-slate-100 dark:bg-slate-700/50 rounded w-64" />
              <div className="flex gap-2">
                <div className="h-6 bg-slate-100 dark:bg-slate-700/50 rounded w-16" />
                <div className="h-6 bg-slate-100 dark:bg-slate-700/50 rounded w-20" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0">
              <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>

          {/* Shimmer Effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent"
            animate={{
              x: ['-100%', '200%'],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
              delay: i * 0.1,
            }}
          />
        </div>
      ))}
    </>
  );
};

export default PatientCardSkeleton;
