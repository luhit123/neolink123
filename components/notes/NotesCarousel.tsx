import React, { useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import ProgressNoteDisplay from '../ProgressNoteDisplay';
import { ProgressNote, Patient } from '../../types';
import { haptics } from '../../utils/haptics';

interface NotesCarouselProps {
  notes: ProgressNote[];
  patient?: Patient;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  className?: string;
}

const NotesCarousel: React.FC<NotesCarouselProps> = ({
  notes,
  patient,
  currentIndex,
  onIndexChange,
  className = '',
}) => {
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  // Swipe configuration
  const swipeThreshold = 80; // pixels
  const swipeVelocityThreshold = 500; // pixels/second

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    // Swipe right (go to previous note)
    if (offset > swipeThreshold || velocity > swipeVelocityThreshold) {
      if (currentIndex > 0) {
        haptics.selection();
        setSwipeDirection('right');
        onIndexChange(currentIndex - 1);
      }
    }
    // Swipe left (go to next note)
    else if (offset < -swipeThreshold || velocity < -swipeVelocityThreshold) {
      if (currentIndex < notes.length - 1) {
        haptics.selection();
        setSwipeDirection('left');
        onIndexChange(currentIndex + 1);
      }
    }
  };

  // Animation variants
  const slideVariants = {
    enter: (direction: 'left' | 'right' | null) => ({
      x: direction === 'left' ? 1000 : direction === 'right' ? -1000 : 0,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: 'left' | 'right' | null) => ({
      x: direction === 'left' ? -1000 : direction === 'right' ? 1000 : 0,
      opacity: 0,
    }),
  };

  const slideTransition = {
    x: { type: 'spring' as const, stiffness: 300, damping: 30 },
    opacity: { duration: 0.2 },
  };

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-slate-500 text-center font-medium">No clinical notes yet</p>
        <p className="text-slate-400 text-sm text-center mt-1">Add your first progress note</p>
      </div>
    );
  }

  const currentNote = notes[currentIndex];

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Swipe hint - Only on mobile, show briefly */}
      <div className="md:hidden absolute top-4 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none">
        <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 animate-pulse">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          <span>Swipe to navigate</span>
        </div>
      </div>

      {/* Carousel Container */}
      <div className="relative">
        <AnimatePresence initial={false} custom={swipeDirection} mode="wait">
          <motion.div
            key={currentIndex}
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            className="cursor-grab active:cursor-grabbing"
          >
            <ProgressNoteDisplay
              note={currentNote}
              patient={patient}
              noteIndex={currentIndex}
              totalNotes={notes.length}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Mobile Note Counter */}
      <div className="md:hidden flex justify-center mt-4">
        <div className="bg-slate-100 px-4 py-2 rounded-full">
          <span className="text-sm font-semibold text-slate-700">
            {currentIndex + 1} of {notes.length}
          </span>
        </div>
      </div>

      {/* Edge Indicators */}
      {currentIndex > 0 && (
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-slate-900/5 to-transparent pointer-events-none" />
      )}
      {currentIndex < notes.length - 1 && (
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-slate-900/5 to-transparent pointer-events-none" />
      )}
    </div>
  );
};

export default NotesCarousel;
