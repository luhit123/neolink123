import React, { useState } from 'react';
import { ProgressNote, VitalSigns, ClinicalExamination, Medication } from '../types';

interface ProgressNoteFormProps {
    onSave: (note: ProgressNote) => void;
    onCancel: () => void;
    existingNote?: ProgressNote;
    lastNote?: ProgressNote; // For copying previous values
    userEmail?: string;
    userName?: string;
}

const ProgressNoteForm: React.FC<ProgressNoteFormProps> = ({
    onSave,
    onCancel,
    existingNote,
    lastNote,
    userEmail,
    userName
}) => {
    // Collapsible sections state
    const [expandedSections, setExpandedSections] = useState({
        vitals: true,
        examination: false,
        medications: false,
        note: true
    });

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
        route: 'IV',
        frequency: 'TID'
    });

    // General Clinical Note
    const [clinicalNote, setClinicalNote] = useState(existingNote?.note || '');

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const copyFromLastNote = () => {
        if (lastNote) {
            if (lastNote.vitals) setVitals(lastNote.vitals);
            if (lastNote.medications) setMedications([...lastNote.medications]);
            alert('✓ Copied vitals and medications from last note');
        }
    };

    const handleAddMedication = () => {
        if (newMedication.name.trim() && newMedication.dose.trim()) {
            setMedications([...medications, newMedication]);
            setNewMedication({ name: '', dose: '', route: 'IV', frequency: 'TID' });
        }
    };

    const handleRemoveMedication = (index: number) => {
        setMedications(medications.filter((_, i) => i !== index));
    };

    const handleQuickSave = () => {
        // Quick save with just the clinical note
        const progressNote: ProgressNote = {
            date: new Date().toISOString(),
            note: clinicalNote || undefined,
            vitals: Object.values(vitals).some(v => v) ? vitals : undefined,
            examination: Object.values(examination).some(v => v) ? examination : undefined,
            medications: medications.length > 0 ? medications : undefined,
            addedBy: userName || undefined,
            addedByEmail: userEmail || undefined
        };

        onSave(progressNote);
    };

    return (
        <div className="space-y-3">
            {/* Header with Actions */}
            <div className="flex items-center justify-between pb-3 border-b border-blue-500/30">
                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {existingNote ? 'Edit Progress Note' : 'New Progress Note'}
                </h4>
                {lastNote && !existingNote && (
                    <button
                        type="button"
                        onClick={copyFromLastNote}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy from Last Note
                    </button>
                )}
            </div>

            {/* VITAL SIGNS - Collapsible */}
            <div className="bg-slate-700/80 rounded-lg border border-slate-500 overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleSection('vitals')}
                    className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-600/70 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        <span className="text-sm font-bold text-white">Vital Signs</span>
                        {Object.values(vitals).some(v => v) && (
                            <span className="ml-2 px-2 py-0.5 bg-green-500/30 text-green-200 text-xs rounded-full font-semibold">
                                {Object.values(vitals).filter(v => v).length} recorded
                            </span>
                        )}
                    </div>
                    <svg className={`w-4 h-4 text-slate-300 transition-transform ${expandedSections.vitals ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {expandedSections.vitals && (
                    <div className="p-4 bg-slate-800/50">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Temp (°C)</label>
                                <input
                                    type="text"
                                    value={vitals.temperature}
                                    onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                                    placeholder="37.5"
                                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">HR (bpm)</label>
                                <input
                                    type="text"
                                    value={vitals.hr}
                                    onChange={(e) => setVitals({ ...vitals, hr: e.target.value })}
                                    placeholder="120"
                                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">RR (/min)</label>
                                <input
                                    type="text"
                                    value={vitals.rr}
                                    onChange={(e) => setVitals({ ...vitals, rr: e.target.value })}
                                    placeholder="40"
                                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">BP (mmHg)</label>
                                <input
                                    type="text"
                                    value={vitals.bp}
                                    onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                                    placeholder="90/60"
                                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">SpO₂ (%)</label>
                                <input
                                    type="text"
                                    value={vitals.spo2}
                                    onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                                    placeholder="98"
                                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">CRT (sec)</label>
                                <input
                                    type="text"
                                    value={vitals.crt}
                                    onChange={(e) => setVitals({ ...vitals, crt: e.target.value })}
                                    placeholder="<2"
                                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Weight (kg)</label>
                                <input
                                    type="text"
                                    value={vitals.weight}
                                    onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                                    placeholder="3.5"
                                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* EXAMINATION - Collapsible */}
            <div className="bg-slate-700/80 rounded-lg border border-slate-500 overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleSection('examination')}
                    className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-600/70 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <span className="text-sm font-bold text-white">Clinical Examination</span>
                        {Object.values(examination).some(v => v) && (
                            <span className="ml-2 px-2 py-0.5 bg-green-500/30 text-green-200 text-xs rounded-full font-semibold">
                                {Object.values(examination).filter(v => v).length} findings
                            </span>
                        )}
                    </div>
                    <svg className={`w-4 h-4 text-slate-300 transition-transform ${expandedSections.examination ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {expandedSections.examination && (
                    <div className="p-4 bg-slate-800/50 space-y-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">CNS</label>
                            <textarea
                                value={examination.cns}
                                onChange={(e) => setExamination({ ...examination, cns: e.target.value })}
                                placeholder="Alert, active, good cry..."
                                rows={2}
                                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">CVS</label>
                            <textarea
                                value={examination.cvs}
                                onChange={(e) => setExamination({ ...examination, cvs: e.target.value })}
                                placeholder="S1S2 heard, no murmur..."
                                rows={2}
                                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">CHEST</label>
                            <textarea
                                value={examination.chest}
                                onChange={(e) => setExamination({ ...examination, chest: e.target.value })}
                                placeholder="Bilateral air entry equal..."
                                rows={2}
                                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">PER ABDOMEN</label>
                            <textarea
                                value={examination.perAbdomen}
                                onChange={(e) => setExamination({ ...examination, perAbdomen: e.target.value })}
                                placeholder="Soft, non-tender..."
                                rows={2}
                                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1">Other Findings</label>
                            <textarea
                                value={examination.otherFindings}
                                onChange={(e) => setExamination({ ...examination, otherFindings: e.target.value })}
                                placeholder="Skin, IV lines, monitors..."
                                rows={2}
                                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* MEDICATIONS - Collapsible */}
            <div className="bg-slate-700/80 rounded-lg border border-slate-500 overflow-hidden">
                <button
                    type="button"
                    onClick={() => toggleSection('medications')}
                    className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-600/70 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        <span className="text-sm font-bold text-white">Medications</span>
                        {medications.length > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-purple-500/30 text-purple-200 text-xs rounded-full font-semibold">
                                {medications.length} drugs
                            </span>
                        )}
                    </div>
                    <svg className={`w-4 h-4 text-slate-300 transition-transform ${expandedSections.medications ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {expandedSections.medications && (
                    <div className="p-4 bg-slate-800/50">
                        {/* Existing Medications */}
                        {medications.length > 0 && (
                            <div className="mb-3 space-y-1.5">
                                {medications.map((med, index) => (
                                    <div key={index} className="flex items-center justify-between bg-slate-700/50 px-3 py-2 rounded border border-slate-600">
                                        <div className="flex-1 text-sm">
                                            <span className="font-semibold text-white">{med.name}</span>
                                            <span className="text-slate-400 ml-2">{med.dose}</span>
                                            {med.route && <span className="text-slate-400 ml-1">• {med.route}</span>}
                                            {med.frequency && <span className="text-slate-400 ml-1">• {med.frequency}</span>}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveMedication(index)}
                                            className="ml-2 text-red-400 hover:text-red-300"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add New Medication */}
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    value={newMedication.name}
                                    onChange={(e) => setNewMedication({ ...newMedication, name: e.target.value })}
                                    placeholder="Drug name"
                                    className="px-2 py-1.5 bg-slate-900 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                                <input
                                    type="text"
                                    value={newMedication.dose}
                                    onChange={(e) => setNewMedication({ ...newMedication, dose: e.target.value })}
                                    placeholder="Dose"
                                    className="px-2 py-1.5 bg-slate-900 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={newMedication.route}
                                    onChange={(e) => setNewMedication({ ...newMedication, route: e.target.value })}
                                    className="px-2 py-1.5 bg-slate-900 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                >
                                    <option value="IV">IV</option>
                                    <option value="PO">PO</option>
                                    <option value="IM">IM</option>
                                    <option value="SC">SC</option>
                                    <option value="Topical">Topical</option>
                                    <option value="Inhalation">Inhalation</option>
                                </select>
                                <select
                                    value={newMedication.frequency}
                                    onChange={(e) => setNewMedication({ ...newMedication, frequency: e.target.value })}
                                    className="px-2 py-1.5 bg-slate-900 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                >
                                    <option value="STAT">STAT</option>
                                    <option value="OD">OD</option>
                                    <option value="BD">BD</option>
                                    <option value="TID">TID</option>
                                    <option value="QID">QID</option>
                                    <option value="Q4H">Q4H</option>
                                    <option value="Q6H">Q6H</option>
                                    <option value="Q8H">Q8H</option>
                                    <option value="PRN">PRN</option>
                                </select>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddMedication}
                                className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-semibold transition-colors"
                            >
                                + Add Medication
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* CLINICAL NOTE - Always Visible */}
            <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 rounded-lg border border-blue-500/40 p-4">
                <label className="block text-sm font-bold text-blue-200 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Clinical Note / Assessment / Plan
                </label>
                <textarea
                    value={clinicalNote}
                    onChange={(e) => setClinicalNote(e.target.value)}
                    placeholder="Patient progress, assessment, and plan of care..."
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-500"
                />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-semibold transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleQuickSave}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Note
                </button>
            </div>
        </div>
    );
};

export default ProgressNoteForm;
