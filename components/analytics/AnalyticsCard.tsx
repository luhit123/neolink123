import React from 'react';
import { motion } from 'framer-motion';

interface AnalyticsCardProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
  headerGradient?: string;
}

const AnalyticsCard: React.FC<AnalyticsCardProps> = ({
  children,
  title,
  subtitle,
  icon,
  className = '',
  headerGradient = 'from-blue-600 to-blue-700'
}) => {
  return (
    <motion.div
      className={`w-full h-full flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className={`bg-gradient-to-r ${headerGradient} px-6 py-5`}>
        <div className="flex items-center gap-4">
          {icon && (
            <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-xl flex items-center justify-center">
              {icon}
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">{title}</h2>
            {subtitle && (
              <p className="text-blue-100 text-sm mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {children}
      </div>
    </motion.div>
  );
};

export default AnalyticsCard;
