import React from 'react';
import { motion } from 'framer-motion';
import Ripple from './Ripple';
import { haptics } from '../../utils/haptics';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface BottomNavigationProps {
  items: NavItem[];
  activeItem: string;
  onItemClick: (id: string) => void;
  className?: string;
}

/**
 * Material Design 3 Bottom Navigation
 * Features:
 * - 3-5 navigation items
 * - Active indicator
 * - Ripple effect
 * - Haptic feedback
 * - Badge support
 * - Fixed at bottom
 */
const BottomNavigation: React.FC<BottomNavigationProps> = ({
  items,
  activeItem,
  onItemClick,
  className = '',
}) => {
  const handleItemClick = (id: string) => {
    haptics.selection();
    onItemClick(id);
  };

  return (
    <motion.nav
      className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-40 ${className}`}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center justify-around h-14 md:h-16 max-w-screen-lg mx-auto px-2">
        {items.map((item) => {
          const isActive = item.id === activeItem;

          return (
            <Ripple
              key={item.id}
              className="flex-1 h-full flex items-center justify-center relative"
              onClick={() => handleItemClick(item.id)}
              color={isActive ? 'rgba(14, 165, 233, 0.2)' : 'rgba(0, 0, 0, 0.1)'}
            >
              <motion.div
                className="flex flex-col items-center justify-center py-1 px-3 relative"
                animate={{
                  y: isActive ? -2 : 0,
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {/* Active Indicator */}
                {isActive && (
                  <motion.div
                    className="absolute -top-1 left-0 right-0 h-0.5 bg-medical-teal rounded-full"
                    layoutId="activeIndicator"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}

                {/* Icon with Badge */}
                <div className="relative">
                  <motion.div
                    className={`${
                      isActive ? 'text-medical-teal' : 'text-slate-600 dark:text-slate-400'
                    }`}
                    animate={{ scale: isActive ? 1.1 : 1 }}
                  >
                    {item.icon}
                  </motion.div>

                  {/* Badge */}
                  {item.badge !== undefined && item.badge > 0 && (
                    <motion.div
                      className="absolute -top-1 -right-1 bg-medical-red text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </motion.div>
                  )}
                </div>

                {/* Label */}
                <motion.span
                  className={`text-xs font-medium mt-0.5 ${
                    isActive ? 'text-medical-teal' : 'text-slate-600 dark:text-slate-400'
                  }`}
                  animate={{
                    opacity: isActive ? 1 : 0.7,
                    fontWeight: isActive ? 600 : 500,
                  }}
                >
                  {item.label}
                </motion.span>
              </motion.div>
            </Ripple>
          );
        })}
      </div>
    </motion.nav>
  );
};

export default BottomNavigation;
