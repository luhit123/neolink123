import React from 'react';
import ProgressNoteDisplay from '../ProgressNoteDisplay';
import { ProgressNote, Patient } from '../../types';

interface NotesScrollViewProps {
  notes: ProgressNote[];
  patient?: Patient;
  className?: string;
}

const NotesScrollView: React.FC<NotesScrollViewProps> = ({ notes, patient, className = '' }) => {
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

  return (
    <div className={`space-y-4 ${className}`}>
      {notes.map((note, index) => (
        <ProgressNoteDisplay
          key={`${note.date}-${index}`}
          note={note}
          patient={patient}
          noteIndex={index}
          totalNotes={notes.length}
        />
      ))}
    </div>
  );
};

export default NotesScrollView;
