import React from 'react';
import { haptics } from '../../utils/haptics';

export type ViewMode = 'swipe' | 'scroll';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onToggle: (mode: ViewMode) => void;
  className?: string;
}

const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ viewMode, onToggle, className = '' }) => {
  const handleToggle = (mode: ViewMode) => {
    if (mode !== viewMode) {
      haptics.tap();
      onToggle(mode);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs font-semibold text-slate-600 hidden md:inline">View:</span>
      <div className="flex bg-slate-200 rounded-lg p-1">
        {/* Swipe Mode Button */}
        <button
          onClick={() => handleToggle('swipe')}
          className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-semibold text-xs md:text-sm transition-all duration-200 flex items-center gap-1.5 md:gap-2 whitespace-nowrap ${
            viewMode === 'swipe'
              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
              : 'text-slate-600 hover:bg-slate-300'
          }`}
          aria-label="Swipe View"
          aria-pressed={viewMode === 'swipe'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          <span className="hidden sm:inline">Swipe</span>
        </button>

        {/* Scroll Mode Button */}
        <button
          onClick={() => handleToggle('scroll')}
          className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-semibold text-xs md:text-sm transition-all duration-200 flex items-center gap-1.5 md:gap-2 whitespace-nowrap ${
            viewMode === 'scroll'
              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
              : 'text-slate-600 hover:bg-slate-300'
          }`}
          aria-label="Scroll View"
          aria-pressed={viewMode === 'scroll'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <span className="hidden sm:inline">Scroll</span>
        </button>
      </div>
    </div>
  );
};

export default ViewModeToggle;
