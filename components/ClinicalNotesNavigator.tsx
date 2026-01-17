import React, { useState, useMemo, useEffect } from 'react';
import { ProgressNote, Patient } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import ViewModeToggle, { ViewMode } from './notes/ViewModeToggle';
import NotesCarousel from './notes/NotesCarousel';
import NotesScrollView from './notes/NotesScrollView';
import NotesNavigationControls from './notes/NotesNavigationControls';
import NotesDateFilter, { DateFilterState } from './notes/NotesDateFilter';

interface ClinicalNotesNavigatorProps {
  notes: ProgressNote[];
  patient?: Patient;
  canEdit?: boolean;
  onAddNote?: () => void;
  className?: string;
}

interface NotesViewPreferences {
  viewMode: ViewMode;
}

const ClinicalNotesNavigator: React.FC<ClinicalNotesNavigatorProps> = ({
  notes,
  patient,
  canEdit,
  onAddNote,
  className = '',
}) => {
  // Sort notes by date descending (newest first)
  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [notes]);

  // View mode preference (persisted to localStorage)
  const [preferences, setPreferences] = useLocalStorage<NotesViewPreferences>(
    'clinical-notes-view-preferences',
    { viewMode: 'swipe' }
  );

  // Date filter state
  const [dateFilter, setDateFilter] = useState<DateFilterState>({
    startDate: null,
    endDate: null,
    isActive: false,
  });

  // Current note index for carousel view
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter notes by date range
  const filteredNotes = useMemo(() => {
    if (!dateFilter.isActive || (!dateFilter.startDate && !dateFilter.endDate)) {
      return sortedNotes;
    }

    return sortedNotes.filter((note) => {
      const noteDate = new Date(note.date);

      if (dateFilter.startDate && noteDate < new Date(dateFilter.startDate)) {
        return false;
      }

      if (dateFilter.endDate) {
        const endDate = new Date(dateFilter.endDate);
        endDate.setHours(23, 59, 59, 999); // Include the entire end date
        if (noteDate > endDate) {
          return false;
        }
      }

      return true;
    });
  }, [sortedNotes, dateFilter]);

  // Reset index when filter changes
  useEffect(() => {
    if (currentIndex >= filteredNotes.length) {
      setCurrentIndex(Math.max(0, filteredNotes.length - 1));
    }
  }, [filteredNotes.length, currentIndex]);

  // Keyboard navigation for swipe mode
  useEffect(() => {
    if (preferences.viewMode !== 'swipe') return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < filteredNotes.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, filteredNotes.length, preferences.viewMode]);

  const handleViewModeChange = (mode: ViewMode) => {
    setPreferences({ viewMode: mode });
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < filteredNotes.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Empty state when no notes after filtering
  if (dateFilter.isActive && filteredNotes.length === 0) {
    return (
      <div className={className}>
        {/* Controls */}
        <div className="space-y-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <ViewModeToggle viewMode={preferences.viewMode} onToggle={handleViewModeChange} />
          </div>
          <NotesDateFilter
            dateFilter={dateFilter}
            totalNotes={sortedNotes.length}
            filteredCount={0}
            onFilterChange={setDateFilter}
          />
        </div>

        {/* Empty state */}
        <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-slate-300 rounded-lg">
          <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-slate-500 text-center font-medium mb-2">No notes in selected date range</p>
          <button
            onClick={() => setDateFilter({ startDate: null, endDate: null, isActive: false })}
            className="mt-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Clear Filter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Controls */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <ViewModeToggle viewMode={preferences.viewMode} onToggle={handleViewModeChange} />

          {onAddNote && canEdit && (
            <button
              onClick={onAddNote}
              className="group relative px-5 py-2.5 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-700 hover:via-purple-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2.5 overflow-hidden"
            >
              {/* Animated glow effect */}
              <span className="absolute inset-0 bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-500"></span>
              <span className="absolute -inset-1 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-xl blur opacity-30 group-hover:opacity-50 animate-pulse"></span>

              {/* Content */}
              <span className="relative flex items-center gap-2">
                <span className="text-lg">🎙️</span>
                <span>Add Note</span>
                <span className="text-lg">✨</span>
              </span>

              {/* Shimmer effect */}
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"></span>
            </button>
          )}
        </div>

        <NotesDateFilter
          dateFilter={dateFilter}
          totalNotes={sortedNotes.length}
          filteredCount={filteredNotes.length}
          onFilterChange={setDateFilter}
        />
      </div>

      {/* Navigation Controls (Desktop, Swipe Mode Only) */}
      {preferences.viewMode === 'swipe' && filteredNotes.length > 0 && (
        <NotesNavigationControls
          currentIndex={currentIndex}
          totalNotes={filteredNotes.length}
          onPrevious={handlePrevious}
          onNext={handleNext}
          className="mb-4"
        />
      )}

      {/* Notes Display */}
      {preferences.viewMode === 'swipe' ? (
        <NotesCarousel
          notes={filteredNotes}
          patient={patient}
          currentIndex={currentIndex}
          onIndexChange={setCurrentIndex}
        />
      ) : (
        <NotesScrollView notes={filteredNotes} patient={patient} />
      )}
    </div>
  );
};

export default ClinicalNotesNavigator;
