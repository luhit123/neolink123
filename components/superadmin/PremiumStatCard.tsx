import React from 'react';
import { motion } from 'framer-motion';

interface PremiumStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    label: string;
  };
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'cyan' | 'pink';
  onClick?: () => void;
}

const colorClasses = {
  blue: {
    gradient: 'from-blue-500 to-blue-600',
    light: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
  },
  green: {
    gradient: 'from-green-500 to-emerald-600',
    light: 'bg-green-50',
    text: 'text-green-600',
    border: 'border-green-200',
  },
  purple: {
    gradient: 'from-purple-500 to-indigo-600',
    light: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-200',
  },
  orange: {
    gradient: 'from-orange-500 to-amber-600',
    light: 'bg-orange-50',
    text: 'text-orange-600',
    border: 'border-orange-200',
  },
  red: {
    gradient: 'from-red-500 to-rose-600',
    light: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
  },
  cyan: {
    gradient: 'from-cyan-500 to-teal-600',
    light: 'bg-cyan-50',
    text: 'text-cyan-600',
    border: 'border-cyan-200',
  },
  pink: {
    gradient: 'from-pink-500 to-rose-600',
    light: 'bg-pink-50',
    text: 'text-pink-600',
    border: 'border-pink-200',
  },
};

const PremiumStatCard: React.FC<PremiumStatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color,
  onClick,
}) => {
  const colors = colorClasses[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/80
        border-2 ${colors.border} shadow-lg hover:shadow-2xl
        transition-all duration-300 cursor-pointer
        ${onClick ? 'hover:border-opacity-100' : ''}
      `}
    >
      {/* Gradient overlay */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colors.gradient} opacity-5 rounded-full -mr-16 -mt-16`} />

      <div className="relative p-6">
        {/* Header with icon */}
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${colors.gradient} shadow-lg`}>
            <div className="text-white">
              {icon}
            </div>
          </div>

          {trend && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
              trend.isPositive
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d={trend.isPositive ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'}
                />
              </svg>
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mb-2">
          <div className="text-4xl font-bold text-slate-900 tracking-tight">
            {value}
          </div>
          {subtitle && (
            <div className="text-sm text-slate-500 mt-1">{subtitle}</div>
          )}
        </div>

        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
            {title}
          </div>
          {trend && (
            <div className="text-xs text-slate-400">
              {trend.label}
            </div>
          )}
        </div>

        {/* Hover indicator */}
        {onClick && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-20 transition-opacity" />
        )}
      </div>
    </motion.div>
  );
};

export default PremiumStatCard;
