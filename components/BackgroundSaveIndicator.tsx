import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackgroundSave, SavingNote } from '../contexts/BackgroundSaveContext';
import { Loader2, CheckCircle, AlertCircle, X, Eye, Wand2, FileText, Activity } from 'lucide-react';

/**
 * BackgroundSaveIndicator - Floating indicator for background saves
 *
 * Shows at top-right of screen:
 * - Clinical notes: "Processing clinical note..." / "Saving..." / "Saved"
 * - Discharge: "Generating discharge summary..." / "Ready to download"
 * - Status updates: "Updating patient status..."
 */
const BackgroundSaveIndicator: React.FC = () => {
  const { savingNotes, removeSavingNote, onViewPatient, onViewDischarge } = useBackgroundSave();

  if (savingNotes.length === 0) return null;

  const handleClick = (note: SavingNote) => {
    if (note.status === 'saved') {
      if (note.type === 'discharge' && onViewDischarge) {
        onViewDischarge(note.patientId);
        removeSavingNote(note.id);
      } else if (note.type === 'note' && onViewPatient && note.note) {
        onViewPatient(note.patientId, note.note.id);
        removeSavingNote(note.id);
      }
    }
  };

  const getStatusMessage = (note: SavingNote) => {
    if (note.type === 'discharge') {
      switch (note.status) {
        case 'processing': return 'Generating discharge summary...';
        case 'saving': return 'Preparing discharge certificate...';
        case 'saved': return 'Discharge certificate ready';
        case 'error': return 'Generation failed';
      }
    } else if (note.type === 'status') {
      switch (note.status) {
        case 'processing': return `Updating to ${note.statusChange}...`;
        case 'saving': return 'Saving changes...';
        case 'saved': return `Patient ${note.statusChange?.toLowerCase()}`;
        case 'error': return 'Update failed';
      }
    }
    // Default for clinical notes
    switch (note.status) {
      case 'processing': return 'Processing clinical note...';
      case 'saving': return 'Saving clinical note...';
      case 'saved': return 'Clinical note saved';
      case 'error': return 'Save failed';
    }
  };

  const getStatusColor = (note: SavingNote) => {
    if (note.type === 'discharge') {
      return {
        processing: { bg: 'bg-emerald-50/95', border: 'border-emerald-300', text: 'text-emerald-800', icon: 'bg-emerald-100', iconColor: 'text-emerald-600' },
        saving: { bg: 'bg-emerald-50/95', border: 'border-emerald-300', text: 'text-emerald-800', icon: 'bg-emerald-100', iconColor: 'text-emerald-600' },
        saved: { bg: 'bg-green-50/95', border: 'border-green-300', text: 'text-green-800', icon: 'bg-green-100', iconColor: 'text-green-600' },
        error: { bg: 'bg-red-50/95', border: 'border-red-300', text: 'text-red-800', icon: 'bg-red-100', iconColor: 'text-red-600' }
      }[note.status];
    }
    // Default colors for notes
    return {
      processing: { bg: 'bg-violet-50/95', border: 'border-violet-300', text: 'text-violet-800', icon: 'bg-violet-100', iconColor: 'text-violet-600' },
      saving: { bg: 'bg-blue-50/95', border: 'border-blue-300', text: 'text-blue-800', icon: 'bg-blue-100', iconColor: 'text-blue-600' },
      saved: { bg: 'bg-green-50/95', border: 'border-green-300', text: 'text-green-800', icon: 'bg-green-100', iconColor: 'text-green-600' },
      error: { bg: 'bg-red-50/95', border: 'border-red-300', text: 'text-red-800', icon: 'bg-red-100', iconColor: 'text-red-600' }
    }[note.status];
  };

  const getIcon = (note: SavingNote) => {
    if (note.type === 'discharge') {
      if (note.status === 'processing' || note.status === 'saving') {
        return <FileText className="w-5 h-5 text-emerald-600 animate-pulse" />;
      }
      if (note.status === 'saved') return <CheckCircle className="w-5 h-5 text-green-600" />;
      return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
    if (note.type === 'status') {
      if (note.status === 'processing' || note.status === 'saving') {
        return <Activity className="w-5 h-5 text-blue-600 animate-pulse" />;
      }
      if (note.status === 'saved') return <CheckCircle className="w-5 h-5 text-green-600" />;
      return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
    // Default for notes
    if (note.status === 'processing') return <Wand2 className="w-5 h-5 text-violet-600 animate-pulse" />;
    if (note.status === 'saving') return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
    if (note.status === 'saved') return <CheckCircle className="w-5 h-5 text-green-600" />;
    return <AlertCircle className="w-5 h-5 text-red-600" />;
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      <AnimatePresence mode="popLayout">
        {savingNotes.map((note) => {
          const colors = getStatusColor(note);
          const canClick = note.status === 'saved' && (note.type === 'discharge' || (note.type === 'note' && note.note));

          return (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, x: 100, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.8 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`
                relative rounded-xl shadow-2xl border-2 backdrop-blur-sm overflow-hidden
                ${colors.bg} ${colors.border}
                ${canClick ? 'cursor-pointer hover:brightness-95' : ''}
              `}
              onClick={() => handleClick(note)}
            >
              {/* Progress bar for processing/saving state */}
              {(note.status === 'processing' || note.status === 'saving') && (
                <motion.div
                  className={`absolute bottom-0 left-0 h-1 ${note.type === 'discharge' ? 'bg-emerald-500' : note.status === 'processing' ? 'bg-violet-500' : 'bg-blue-500'}`}
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: note.type === 'discharge' ? 5 : note.status === 'processing' ? 8 : 3, ease: 'linear' }}
                />
              )}

              <div className="p-3 pr-10">
                <div className="flex items-start gap-3">
                  {/* Status Icon */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${colors.icon}`}>
                    {getIcon(note)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${colors.text}`}>
                      {getStatusMessage(note)}
                    </p>
                    <p className="text-xs text-slate-600 truncate mt-0.5">
                      {note.patientName}
                    </p>
                    {note.status === 'saved' && note.type === 'discharge' && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        Click to view/download
                      </motion.p>
                    )}
                    {note.status === 'saved' && note.type === 'note' && (
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
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default BackgroundSaveIndicator;
