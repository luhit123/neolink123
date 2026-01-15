import React from 'react';
import { ProgressNote, Patient } from '../types';

interface ProgressNoteDisplayProps {
    note: ProgressNote;
    patient?: Patient;
}

interface ExtendedProgressNoteDisplayProps extends ProgressNoteDisplayProps {
    noteIndex?: number;
    totalNotes?: number;
}

const ProgressNoteDisplay: React.FC<ExtendedProgressNoteDisplayProps> = ({ note, patient, noteIndex, totalNotes }) => {
    const hasVitals = note.vitals && Object.values(note.vitals).some(v => v);
    const hasMedications = note.medications && note.medications.length > 0;

    // Parse clinical note into sections
    const parseNoteIntoSections = (noteText: string) => {
        const sections: Record<string, string> = {};

        // Remove markdown and separator lines
        const cleanText = noteText
            .replace(/#{1,6}\s/g, '')
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/^-\s/gm, '')
            .replace(/^\*\s/gm, '')
            .replace(/`/g, '')
            .replace(/_{3,}/g, '')
            .replace(/={3,}/g, '')
            .replace(/\-{3,}/g, '')
            .replace(/\|/g, '');

        // Split into sections based on headers
        const sectionHeaders = [
            'CLINICAL PROGRESS NOTE',
            'VITALS',
            'SYSTEMIC EXAMINATION',
            'OTHER FINDINGS',
            'TREATMENT',
            'IMPRESSION',
            'PLAN AND ADVICE'
        ];

        let currentSection = 'header';
        let currentContent = '';

        const lines = cleanText.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Check if this line is a section header
            const matchedHeader = sectionHeaders.find(header =>
                trimmedLine.toUpperCase() === header
            );

            if (matchedHeader) {
                // Save previous section
                if (currentContent.trim()) {
                    sections[currentSection] = currentContent.trim();
                }
                // Start new section
                currentSection = matchedHeader.toLowerCase().replace(/\s+/g, '_');
                currentContent = '';
            } else {
                currentContent += line + '\n';
            }
        }

        // Save last section
        if (currentContent.trim()) {
            sections[currentSection] = currentContent.trim();
        }

        return sections;
    };

    const sections = note.note ? parseNoteIntoSections(note.note) : {};

    return (
        <div className="bg-white rounded-xl overflow-hidden border-2 border-blue-300 shadow-lg">
            {/* Header Bar - Medical Blue Theme */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-4 py-3">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {/* Note Number Badge */}
                        {noteIndex !== undefined && totalNotes !== undefined && (
                            <div className="bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                                <span className="text-white font-bold text-sm">
                                    #{totalNotes - noteIndex}
                                </span>
                            </div>
                        )}
                        <div>
                            <p className="text-white font-semibold text-sm">
                                {new Date(note.date).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                })}
                            </p>
                            <p className="text-blue-100 text-xs">
                                {new Date(note.date).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>
                        </div>
                    </div>
                    {note.addedBy && (
                        <div className="text-right">
                            <p className="text-blue-200 text-[10px] uppercase tracking-wide">Documented by</p>
                            <p className="text-white font-medium text-sm">{note.addedBy}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area - Case Sheet Style */}
            <div className="p-5 space-y-4">

                {/* Patient Particulars - Always shown at top like real case sheet */}
                {patient && (
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg border-2 border-blue-300 shadow-sm">
                        <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-3 flex items-center gap-2 border-b-2 border-blue-300 pb-2">
                            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            Patient Particulars
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            <div className="bg-white/90 p-2.5 rounded border border-blue-200">
                                <p className="text-[9px] text-blue-600 font-bold uppercase tracking-wide mb-0.5">Name</p>
                                <p className="text-sm font-bold text-blue-900">{patient.name}</p>
                            </div>
                            <div className="bg-white/90 p-2.5 rounded border border-blue-200">
                                <p className="text-[9px] text-blue-600 font-bold uppercase tracking-wide mb-0.5">Age</p>
                                <p className="text-sm font-bold text-blue-900">{patient.age} {patient.ageUnit}</p>
                            </div>
                            <div className="bg-white/90 p-2.5 rounded border border-blue-200 md:col-span-2">
                                <p className="text-[9px] text-blue-600 font-bold uppercase tracking-wide mb-0.5">Primary Diagnosis</p>
                                <p className="text-sm font-bold text-blue-900 leading-relaxed">{patient.diagnosis}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Clinical Note Sections with clear demarcation */}
                {note.note && (
                    <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg border-2 border-slate-300 overflow-hidden">
                        <div className="bg-gradient-to-r from-slate-700 to-slate-600 px-3 py-2 border-b-2 border-slate-400">
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Clinical Progress Note
                            </h4>
                        </div>

                        <div className="p-4 space-y-3">
                            {/* Header Info (Date, Time) */}
                            {sections.header && (
                                <div className="bg-white/80 p-3 rounded-lg border border-slate-200">
                                    <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap">{sections.header}</pre>
                                </div>
                            )}

                            {/* Vitals */}
                            {sections.vitals && (
                                <div className="bg-white rounded-lg border-2 border-emerald-200">
                                    <div className="bg-emerald-50 px-3 py-2 border-b-2 border-emerald-200">
                                        <h5 className="text-xs font-bold text-emerald-900 uppercase tracking-wide">Vitals</h5>
                                    </div>
                                    <div className="p-3">
                                        <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">{sections.vitals}</pre>
                                    </div>
                                </div>
                            )}

                            {/* Systemic Examination */}
                            {sections.systemic_examination && (
                                <div className="bg-white rounded-lg border-2 border-purple-200">
                                    <div className="bg-purple-50 px-3 py-2 border-b-2 border-purple-200">
                                        <h5 className="text-xs font-bold text-purple-900 uppercase tracking-wide">Systemic Examination</h5>
                                    </div>
                                    <div className="p-3">
                                        <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">{sections.systemic_examination}</pre>
                                    </div>
                                </div>
                            )}

                            {/* Other Findings */}
                            {sections.other_findings && sections.other_findings.trim().length > 0 && (
                                <div className="bg-white rounded-lg border-2 border-amber-200">
                                    <div className="bg-amber-50 px-3 py-2 border-b-2 border-amber-200">
                                        <h5 className="text-xs font-bold text-amber-900 uppercase tracking-wide">Other Findings</h5>
                                    </div>
                                    <div className="p-3">
                                        <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">{sections.other_findings}</pre>
                                    </div>
                                </div>
                            )}

                            {/* Treatment */}
                            {sections.treatment && (
                                <div className="bg-white rounded-lg border-2 border-rose-200">
                                    <div className="bg-rose-50 px-3 py-2 border-b-2 border-rose-200">
                                        <h5 className="text-xs font-bold text-rose-900 uppercase tracking-wide">Treatment</h5>
                                    </div>
                                    <div className="p-3">
                                        <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">{sections.treatment}</pre>
                                    </div>
                                </div>
                            )}

                            {/* Impression */}
                            {sections.impression && sections.impression.trim().length > 0 && (
                                <div className="bg-white rounded-lg border-2 border-sky-200">
                                    <div className="bg-sky-50 px-3 py-2 border-b-2 border-sky-200">
                                        <h5 className="text-xs font-bold text-sky-900 uppercase tracking-wide">Impression</h5>
                                    </div>
                                    <div className="p-3">
                                        <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">{sections.impression}</pre>
                                    </div>
                                </div>
                            )}

                            {/* Plan and Advice */}
                            {sections.plan_and_advice && sections.plan_and_advice.trim().length > 0 && (
                                <div className="bg-white rounded-lg border-2 border-indigo-200">
                                    <div className="bg-indigo-50 px-3 py-2 border-b-2 border-indigo-200">
                                        <h5 className="text-xs font-bold text-indigo-900 uppercase tracking-wide">Plan and Advice</h5>
                                    </div>
                                    <div className="p-3">
                                        <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">{sections.plan_and_advice}</pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgressNoteDisplay;
