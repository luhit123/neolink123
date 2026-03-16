import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Ripple from './material/Ripple';
import { haptics } from '../utils/haptics';
import { glassClasses, glassmorphism } from '../theme/glassmorphism';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, onClick }) => {
  const handleClick = () => {
    if (onClick) {
      haptics.tap();
      onClick();
    }
  };

  return (
    <Ripple
      className={glassClasses(
        glassmorphism.backdrop.tinted,
        glassmorphism.border.light,
        glassmorphism.shadow.card,
        'rounded-2xl overflow-hidden',
        onClick ? 'cursor-pointer' : ''
      )}
      onClick={handleClick}
    >
      <motion.div
        className="p-3 md:p-6"
        whileHover={onClick ? { y: -4, boxShadow: '0 25px 80px -10px rgba(236, 72, 153, 0.35)' } : {}}
        whileTap={onClick ? { scale: 0.98 } : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm font-medium text-slate-600 truncate">{title}</p>
            <AnimatePresence mode="wait">
              <motion.p
                key={value}
                className="text-xl md:text-3xl font-bold text-slate-900 mt-1"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
              >
                {value}
              </motion.p>
            </AnimatePresence>
          </div>
          <motion.div
            className={`p-2 md:p-3 rounded-full ${color} flex-shrink-0 ml-2`}
            whileHover={{ rotate: 5, scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            {icon}
          </motion.div>
        </div>
      </motion.div>
    </Ripple>
  );
};

export default StatCard;
