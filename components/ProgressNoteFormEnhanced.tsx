import React from 'react';
import { ProgressNote, Patient } from '../types';
import VoiceClinicalNote from './clinical/VoiceClinicalNote';

interface ProgressNoteFormProps {
    onSave: (note: ProgressNote) => void;
    onCancel: () => void;
    onUpdatePatient?: (patient: Patient) => void; // Callback to update patient data
    onBackgroundSave?: (patientId: string, note: ProgressNote) => void; // Background save for immediate close
    // New callbacks for immediate indicator on Done click
    onProcessingStart?: (patientId: string, patientName: string) => string;
    onProcessingComplete?: (saveId: string, patientId: string, note: ProgressNote) => void;
    onProcessingError?: (saveId: string, error: string) => void;
    existingNote?: ProgressNote;
    lastNote?: ProgressNote;
    userEmail?: string;
    userName?: string;
    userId?: string;
    patientAge?: number;
    patientUnit?: string;
    patient?: Patient;
}

/**
 * ProgressNoteFormEnhanced - Voice-Only Clinical Documentation
 *
 * Features:
 * - Pure voice input - no typing required
 * - AI generates formatted clinical note like paper
 * - Structured format: Vitals, CNS, CVS, Chest, P/A, Plan, Advice
 * - Date/time stamped automatically
 */
const ProgressNoteFormEnhanced: React.FC<ProgressNoteFormProps> = ({
    onSave,
    onCancel,
    onUpdatePatient,
    onBackgroundSave,
    onProcessingStart,
    onProcessingComplete,
    onProcessingError,
    existingNote,
    userEmail,
    userName,
    patient
}) => {
    return (
        <VoiceClinicalNote
            patient={patient}
            onSave={onSave}
            onCancel={onCancel}
            onUpdatePatient={onUpdatePatient}
            onBackgroundSave={onBackgroundSave}
            onProcessingStart={onProcessingStart}
            onProcessingComplete={onProcessingComplete}
            onProcessingError={onProcessingError}
            existingNote={existingNote}
            userEmail={userEmail}
            userName={userName}
        />
    );
};

export default ProgressNoteFormEnhanced;
