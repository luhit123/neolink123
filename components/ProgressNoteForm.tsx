import React, { useState } from 'react';
import { ProgressNote, VitalSigns, ClinicalExamination, Medication } from '../types';

interface ProgressNoteFormProps {
    onSave: (note: ProgressNote) => void;
    onCancel: () => void;
    existingNote?: ProgressNote;
    userEmail?: string;
    userName?: string;
}

const ProgressNoteForm: React.FC<ProgressNoteFormProps> = ({
    onSave,
    onCancel,
    existingNote,
    userEmail,
    userName
}) => {
    // Vital Signs State
    const [vitals, setVitals] = useState<VitalSigns>(existingNote?.vitals || {
        temperature: '',
        hr: '',
        rr: '',
        bp: '',
        spo2: '',
        crt: '',
        weight: ''
    });

    // Clinical Examination State
    const [examination, setExamination] = useState<ClinicalExamination>(existingNote?.examination || {
        cns: '',
        cvs: '',
        chest: '',
        perAbdomen: '',
        otherFindings: ''
    });

    // Medications State
    const [medications, setMedications] = useState<Medication[]>(existingNote?.medications || []);
    const [newMedication, setNewMedication] = useState<Medication>({
        name: '',
        dose: '',
        route: '',
        frequency: ''
    });

    // General Clinical Note
    const [clinicalNote, setClinicalNote] = useState(existingNote?.note || '');

    const handleAddMedication = () => {
        if (newMedication.name.trim() && newMedication.dose.trim()) {
            setMedications([...medications, newMedication]);
            setNewMedication({ name: '', dose: '', route: '', frequency: '' });
        }
    };

    const handleRemoveMedication = (index: number) => {
        setMedications(medications.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const progressNote: ProgressNote = {
            date: new Date().toISOString(),
            note: clinicalNote || undefined, // Use undefined instead of empty string
            vitals: Object.values(vitals).some(v => v) ? vitals : undefined,
            examination: Object.values(examination).some(v => v) ? examination : undefined,
            medications: medications.length > 0 ? medications : undefined,
            addedBy: userName || undefined, // Use undefined instead of null
            addedByEmail: userEmail || undefined // Use undefined instead of null
        };

        onSave(progressNote);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Vital Signs Section */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded border border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2 uppercase tracking-wide">
                    <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Vital Signs
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Temperature (°C)
                        </label>
                        <input
                            type="text"
                            value={vitals.temperature}
                            onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                            placeholder="37.5"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            HR (bpm)
                        </label>
                        <input
                            type="text"
                            value={vitals.hr}
                            onChange={(e) => setVitals({ ...vitals, hr: e.target.value })}
                            placeholder="120"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            RR (/min)
                        </label>
                        <input
                            type="text"
                            value={vitals.rr}
                            onChange={(e) => setVitals({ ...vitals, rr: e.target.value })}
                            placeholder="40"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            BP (mmHg)
                        </label>
                        <input
                            type="text"
                            value={vitals.bp}
                            onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                            placeholder="90/60"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            SpO₂ (%)
                        </label>
                        <input
                            type="text"
                            value={vitals.spo2}
                            onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                            placeholder="98"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            CRT (sec)
                        </label>
                        <input
                            type="text"
                            value={vitals.crt}
                            onChange={(e) => setVitals({ ...vitals, crt: e.target.value })}
                            placeholder="<2"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Weight (kg)
                        </label>
                        <input
                            type="text"
                            value={vitals.weight}
                            onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                            placeholder="3.5"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>
                </div>
            </div>

            {/* Clinical Examination Section */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Clinical Examination
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            CNS (Central Nervous System)
                        </label>
                        <textarea
                            value={examination.cns}
                            onChange={(e) => setExamination({ ...examination, cns: e.target.value })}
                            placeholder="E.g., Alert, active, good cry, normal tone, reflexes intact..."
                            rows={2}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            CVS (Cardiovascular System)
                        </label>
                        <textarea
                            value={examination.cvs}
                            onChange={(e) => setExamination({ ...examination, cvs: e.target.value })}
                            placeholder="E.g., S1S2 heard, no murmur, peripheral pulses palpable, CRT <2 sec..."
                            rows={2}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            CHEST (Respiratory)
                        </label>
                        <textarea
                            value={examination.chest}
                            onChange={(e) => setExamination({ ...examination, chest: e.target.value })}
                            placeholder="E.g., Bilateral air entry equal, no added sounds, no recession..."
                            rows={2}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            PER ABDOMEN
                        </label>
                        <textarea
                            value={examination.perAbdomen}
                            onChange={(e) => setExamination({ ...examination, perAbdomen: e.target.value })}
                            placeholder="E.g., Soft, non-tender, no distension, bowel sounds present..."
                            rows={2}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Other Significant Findings
                        </label>
                        <textarea
                            value={examination.otherFindings}
                            onChange={(e) => setExamination({ ...examination, otherFindings: e.target.value })}
                            placeholder="E.g., Skin condition, rashes, IV lines, tubes, monitors..."
                            rows={2}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>
                </div>
            </div>

            {/* Medications Section */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    Medications
                </h3>

                {/* Existing Medications List */}
                {medications.length > 0 && (
                    <div className="mb-4 space-y-2">
                        {medications.map((med, index) => (
                            <div key={index} className="flex items-center justify-between bg-white dark:bg-slate-700 p-3 rounded border border-slate-200 dark:border-slate-600">
                                <div className="flex-1">
                                    <div className="font-semibold text-slate-900 dark:text-white">{med.name}</div>
                                    <div className="text-sm text-slate-600 dark:text-slate-400">
                                        {med.dose} {med.route && `• ${med.route}`} {med.frequency && `• ${med.frequency}`}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveMedication(index)}
                                    className="ml-4 text-red-500 hover:text-red-700"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add New Medication */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="md:col-span-2">
                        <input
                            type="text"
                            value={newMedication.name}
                            onChange={(e) => setNewMedication({ ...newMedication, name: e.target.value })}
                            placeholder="Medication name"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>
                    <div>
                        <input
                            type="text"
                            value={newMedication.dose}
                            onChange={(e) => setNewMedication({ ...newMedication, dose: e.target.value })}
                            placeholder="Dose"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>
                    <div>
                        <input
                            type="text"
                            value={newMedication.route}
                            onChange={(e) => setNewMedication({ ...newMedication, route: e.target.value })}
                            placeholder="Route (IV/PO)"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>
                    <div>
                        <input
                            type="text"
                            value={newMedication.frequency}
                            onChange={(e) => setNewMedication({ ...newMedication, frequency: e.target.value })}
                            placeholder="Frequency"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleAddMedication}
                    className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold transition-colors flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Medication
                </button>
            </div>

            {/* General Clinical Note */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    General Clinical Note
                </h3>
                <textarea
                    value={clinicalNote}
                    onChange={(e) => setClinicalNote(e.target.value)}
                    placeholder="Additional notes, plan, observations..."
                    rows={4}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded font-semibold transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition-colors flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Progress Note
                </button>
            </div>
        </form>
    );
};

export default ProgressNoteForm;
