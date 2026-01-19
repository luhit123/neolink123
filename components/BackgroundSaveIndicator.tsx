import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackgroundSave, SavingNote } from '../contexts/BackgroundSaveContext';
import { Loader2, CheckCircle, AlertCircle, X, Eye, Wand2 } from 'lucide-react';

/**
 * BackgroundSaveIndicator - Floating indicator for background clinical note saves
 *
 * Shows at top-right of screen:
 * - "Processing clinical note..." with AI icon when Gemini is generating
 * - "Saving clinical note..." with spinner when saving to Firestore
 * - "Clinical note saved - Click to view" when complete
 * - Allows user to continue working while notes process/save
 */
const BackgroundSaveIndicator: React.FC = () => {
  const { savingNotes, removeSavingNote, onViewPatient } = useBackgroundSave();

  if (savingNotes.length === 0) return null;

  const handleViewPatient = (note: SavingNote) => {
    if (onViewPatient && note.status === 'saved' && note.note) {
      onViewPatient(note.patientId, note.note.id);
      removeSavingNote(note.id);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      <AnimatePresence mode="popLayout">
        {savingNotes.map((note) => (
          <motion.div
            key={note.id}
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`
              relative rounded-xl shadow-2xl border-2 backdrop-blur-sm overflow-hidden
              ${note.status === 'processing'
                ? 'bg-violet-50/95 border-violet-300'
                : note.status === 'saving'
                ? 'bg-blue-50/95 border-blue-300'
                : note.status === 'saved'
                ? 'bg-green-50/95 border-green-300 cursor-pointer hover:bg-green-100/95'
                : 'bg-red-50/95 border-red-300'
              }
            `}
            onClick={() => handleViewPatient(note)}
          >
            {/* Progress bar for processing/saving state */}
            {(note.status === 'processing' || note.status === 'saving') && (
              <motion.div
                className={`absolute bottom-0 left-0 h-1 ${note.status === 'processing' ? 'bg-violet-500' : 'bg-blue-500'}`}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: note.status === 'processing' ? 8 : 3, ease: 'linear' }}
              />
            )}

            <div className="p-3 pr-10">
              <div className="flex items-start gap-3">
                {/* Status Icon */}
                <div className={`
                  flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                  ${note.status === 'processing'
                    ? 'bg-violet-100'
                    : note.status === 'saving'
                    ? 'bg-blue-100'
                    : note.status === 'saved'
                    ? 'bg-green-100'
                    : 'bg-red-100'
                  }
                `}>
                  {note.status === 'processing' && (
                    <Wand2 className="w-5 h-5 text-violet-600 animate-pulse" />
                  )}
                  {note.status === 'saving' && (
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  )}
                  {note.status === 'saved' && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  {note.status === 'error' && (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${
                    note.status === 'processing'
                      ? 'text-violet-800'
                      : note.status === 'saving'
                      ? 'text-blue-800'
                      : note.status === 'saved'
                      ? 'text-green-800'
                      : 'text-red-800'
                  }`}>
                    {note.status === 'processing' && 'Processing clinical note...'}
                    {note.status === 'saving' && 'Saving clinical note...'}
                    {note.status === 'saved' && 'Clinical note saved'}
                    {note.status === 'error' && 'Save failed'}
                  </p>
                  <p className="text-xs text-slate-600 truncate mt-0.5">
                    {note.patientName}
                  </p>
                  {note.status === 'saved' && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Click to view
                    </motion.p>
                  )}
                  {note.status === 'error' && note.errorMessage && (
                    <p className="text-xs text-red-600 mt-1">
                      {note.errorMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Close button - only show for saved/error states */}
            {note.status !== 'saving' && note.status !== 'processing' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeSavingNote(note.id);
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-black/10 transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default BackgroundSaveIndicator;
