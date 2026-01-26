import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ProgressNote, Patient } from '../types';

export type SaveItemType = 'note' | 'discharge' | 'status';

export interface SavingNote {
  id: string;
  patientId: string;
  patientName: string;
  status: 'processing' | 'saving' | 'saved' | 'error';
  type: SaveItemType; // 'note' for clinical notes, 'discharge' for discharge summary, 'status' for status updates
  note?: ProgressNote; // Optional during processing phase
  timestamp: Date;
  errorMessage?: string;
  statusChange?: string; // For status updates (e.g., "Discharged", "Step Down")
}

interface BackgroundSaveContextType {
  savingNotes: SavingNote[];
  addSavingNote: (patientId: string, patientName: string, note: ProgressNote) => string;
  startProcessing: (patientId: string, patientName: string, type?: SaveItemType, statusChange?: string) => string; // For immediate indicator
  updateNoteStatus: (id: string, status: 'processing' | 'saving' | 'saved' | 'error', errorMessage?: string) => void;
  updateNoteContent: (id: string, note: ProgressNote) => void; // Add note content after processing
  removeSavingNote: (id: string) => void;
  clearAllSaved: () => void;
  onViewPatient?: (patientId: string, noteId?: string) => void; // Include noteId for "click to view"
  setOnViewPatient: (callback: ((patientId: string, noteId?: string) => void) | undefined) => void;
  onViewDischarge?: (patientId: string) => void; // For viewing discharge certificate
  setOnViewDischarge: (callback: ((patientId: string) => void) | undefined) => void;
}

const BackgroundSaveContext = createContext<BackgroundSaveContextType | undefined>(undefined);

export const BackgroundSaveProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [savingNotes, setSavingNotes] = useState<SavingNote[]>([]);
  const [onViewPatient, setOnViewPatientCallback] = useState<((patientId: string, noteId?: string) => void) | undefined>();
  const [onViewDischarge, setOnViewDischargeCallback] = useState<((patientId: string) => void) | undefined>();

  // Start processing immediately (before Gemini completes) - shows indicator right away
  const startProcessing = useCallback((patientId: string, patientName: string, type: SaveItemType = 'note', statusChange?: string): string => {
    const id = `save-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const savingNote: SavingNote = {
      id,
      patientId,
      patientName,
      status: 'processing',
      type,
      statusChange,
      timestamp: new Date()
    };
    setSavingNotes(prev => [...prev, savingNote]);
    return id;
  }, []);

  const addSavingNote = useCallback((patientId: string, patientName: string, note: ProgressNote): string => {
    const id = `save-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const savingNote: SavingNote = {
      id,
      patientId,
      patientName,
      status: 'saving',
      type: 'note',
      note,
      timestamp: new Date()
    };
    setSavingNotes(prev => [...prev, savingNote]);
    return id;
  }, []);

  const setOnViewDischarge = useCallback((callback: ((patientId: string) => void) | undefined) => {
    setOnViewDischargeCallback(() => callback);
  }, []);

  // Add note content after Gemini processing completes
  const updateNoteContent = useCallback((id: string, note: ProgressNote) => {
    setSavingNotes(prev => prev.map(n =>
      n.id === id ? { ...n, note } : n
    ));
  }, []);

  const updateNoteStatus = useCallback((id: string, status: 'processing' | 'saving' | 'saved' | 'error', errorMessage?: string) => {
    setSavingNotes(prev => prev.map(note =>
      note.id === id ? { ...note, status, errorMessage } : note
    ));

    // Auto-remove saved notes after 30 seconds
    if (status === 'saved') {
      setTimeout(() => {
        setSavingNotes(prev => prev.filter(note => note.id !== id));
      }, 30000);
    }
  }, []);

  const removeSavingNote = useCallback((id: string) => {
    setSavingNotes(prev => prev.filter(note => note.id !== id));
  }, []);

  const clearAllSaved = useCallback(() => {
    setSavingNotes(prev => prev.filter(note => note.status === 'saving' || note.status === 'processing'));
  }, []);

  const setOnViewPatient = useCallback((callback: ((patientId: string, noteId?: string) => void) | undefined) => {
    setOnViewPatientCallback(() => callback);
  }, []);

  return (
    <BackgroundSaveContext.Provider value={{
      savingNotes,
      addSavingNote,
      startProcessing,
      updateNoteStatus,
      updateNoteContent,
      removeSavingNote,
      clearAllSaved,
      onViewPatient,
      setOnViewPatient,
      onViewDischarge,
      setOnViewDischarge
    }}>
      {children}
    </BackgroundSaveContext.Provider>
  );
};

export const useBackgroundSave = () => {
  const context = useContext(BackgroundSaveContext);
  if (!context) {
    throw new Error('useBackgroundSave must be used within a BackgroundSaveProvider');
  }
  return context;
};

export default BackgroundSaveContext;
