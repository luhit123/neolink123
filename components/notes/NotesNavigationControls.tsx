import React from 'react';
import { haptics } from '../../utils/haptics';

interface NotesNavigationControlsProps {
  currentIndex: number;
  totalNotes: number;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
}

const NotesNavigationControls: React.FC<NotesNavigationControlsProps> = ({
  currentIndex,
  totalNotes,
  onPrevious,
  onNext,
  className = '',
}) => {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalNotes - 1;

  const handlePrevious = () => {
    if (!isFirst) {
      haptics.selection();
      onPrevious();
    }
  };

  const handleNext = () => {
    if (!isLast) {
      haptics.selection();
      onNext();
    }
  };

  return (
    <div
      className={`hidden md:flex items-center justify-center gap-4 bg-white border-b border-slate-200 py-3 px-4 shadow-sm ${className}`}
      role="navigation"
      aria-label="Clinical notes navigation"
    >
      {/* Previous Button */}
      <button
        onClick={handlePrevious}
        disabled={isFirst}
        className={`p-2 rounded-lg transition-all duration-200 ${
          isFirst
            ? 'text-slate-300 cursor-not-allowed'
            : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700 active:scale-95'
        }`}
        aria-label={`Previous note (${currentIndex} of ${totalNotes})`}
        title="Previous note (←)"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Note Counter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">
          Note {currentIndex + 1} of {totalNotes}
        </span>
      </div>

      {/* Next Button */}
      <button
        onClick={handleNext}
        disabled={isLast}
        className={`p-2 rounded-lg transition-all duration-200 ${
          isLast
            ? 'text-slate-300 cursor-not-allowed'
            : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700 active:scale-95'
        }`}
        aria-label={`Next note (${currentIndex + 2} of ${totalNotes})`}
        title="Next note (→)"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
};

export default NotesNavigationControls;
