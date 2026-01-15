import React from 'react';
import { ProgressNote, Patient } from '../types';
import VoiceClinicalNote from './clinical/VoiceClinicalNote';

interface ProgressNoteFormProps {
    onSave: (note: ProgressNote) => void;
    onCancel: () => void;
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
            existingNote={existingNote}
            userEmail={userEmail}
            userName={userName}
        />
    );
};

export default ProgressNoteFormEnhanced;
