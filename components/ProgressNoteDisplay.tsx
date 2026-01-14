import React from 'react';
import { ProgressNote } from '../types';

interface ProgressNoteDisplayProps {
    note: ProgressNote;
}

const ProgressNoteDisplay: React.FC<ProgressNoteDisplayProps> = ({ note }) => {
    const hasVitals = note.vitals && Object.values(note.vitals).some(v => v);
    const hasExamination = note.examination && Object.values(note.examination).some(v => v);
    const hasMedications = note.medications && note.medications.length > 0;

    return (
        <div className="bg-white p-3 sm:p-4 rounded-lg border border-slate-200 shadow-sm space-y-3">
            {/* Date and Author */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                <div>
                    <p className="text-sm font-semibold text-slate-800">
                        {new Date(note.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </p>
                    <p className="text-xs text-slate-500">
                        {new Date(note.date).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </p>
                </div>
                {note.addedBy && (
                    <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide text-slate-400">Added by</p>
                        <p className="text-sm font-medium text-slate-700">{note.addedBy}</p>
                    </div>
                )}
            </div>

            {/* Vital Signs */}
            {hasVitals && (
                <div className="bg-slate-50 p-3 rounded-lg">
                    <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Vital Signs
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        {note.vitals?.temperature && (
                            <div className="bg-white p-2 rounded border border-slate-200">
                                <span className="text-slate-500">Temp:</span>
                                <span className="ml-1 font-semibold text-slate-800">{note.vitals.temperature}°C</span>
                            </div>
                        )}
                        {note.vitals?.hr && (
                            <div className="bg-white p-2 rounded border border-slate-200">
                                <span className="text-slate-500">HR:</span>
                                <span className="ml-1 font-semibold text-slate-800">{note.vitals.hr} bpm</span>
                            </div>
                        )}
                        {note.vitals?.rr && (
                            <div className="bg-white p-2 rounded border border-slate-200">
                                <span className="text-slate-500">RR:</span>
                                <span className="ml-1 font-semibold text-slate-800">{note.vitals.rr}/min</span>
                            </div>
                        )}
                        {note.vitals?.bp && (
                            <div className="bg-white p-2 rounded border border-slate-200">
                                <span className="text-slate-500">BP:</span>
                                <span className="ml-1 font-semibold text-slate-800">{note.vitals.bp} mmHg</span>
                            </div>
                        )}
                        {note.vitals?.spo2 && (
                            <div className="bg-white p-2 rounded border border-slate-200">
                                <span className="text-slate-500">SpO₂:</span>
                                <span className="ml-1 font-semibold text-slate-800">{note.vitals.spo2}%</span>
                            </div>
                        )}
                        {note.vitals?.crt && (
                            <div className="bg-white p-2 rounded border border-slate-200">
                                <span className="text-slate-500">CRT:</span>
                                <span className="ml-1 font-semibold text-slate-800">{note.vitals.crt} sec</span>
                            </div>
                        )}
                        {note.vitals?.weight && (
                            <div className="bg-white p-2 rounded border border-slate-200">
                                <span className="text-slate-500">Weight:</span>
                                <span className="ml-1 font-semibold text-slate-800">{note.vitals.weight} kg</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Clinical Examination */}
            {hasExamination && (
                <div className="bg-slate-50 p-3 rounded-lg">
                    <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        Clinical Examination
                    </h4>
                    <div className="space-y-2 text-sm">
                        {note.examination?.cns && (
                            <div className="bg-white p-2 rounded border border-slate-200">
                                <span className="font-medium text-slate-600 text-xs uppercase">CNS:</span>
                                <p className="text-slate-800 mt-0.5">{note.examination.cns}</p>
                            </div>
                        )}
                        {note.examination?.cvs && (
                            <div className="bg-white p-2 rounded border border-slate-200">
                                <span className="font-medium text-slate-600 text-xs uppercase">CVS:</span>
                                <p className="text-slate-800 mt-0.5">{note.examination.cvs}</p>
                            </div>
                        )}
                        {note.examination?.chest && (
                            <div className="bg-white p-2 rounded border border-slate-200">
                                <span className="font-medium text-slate-600 text-xs uppercase">Chest:</span>
                                <p className="text-slate-800 mt-0.5">{note.examination.chest}</p>
                            </div>
                        )}
                        {note.examination?.perAbdomen && (
                            <div className="bg-white p-2 rounded border border-slate-200">
                                <span className="font-medium text-slate-600 text-xs uppercase">Per Abdomen:</span>
                                <p className="text-slate-800 mt-0.5">{note.examination.perAbdomen}</p>
                            </div>
                        )}
                        {note.examination?.otherFindings && (
                            <div className="bg-white p-2 rounded border border-slate-200">
                                <span className="font-medium text-slate-600 text-xs uppercase">Other Findings:</span>
                                <p className="text-slate-800 mt-0.5">{note.examination.otherFindings}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Medications */}
            {hasMedications && (
                <div className="bg-slate-50 p-3 rounded-lg">
                    <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        Medications
                    </h4>
                    <div className="space-y-1.5">
                        {note.medications?.map((med, index) => (
                            <div key={index} className="bg-white border border-slate-200 p-2 rounded text-sm flex items-center justify-between">
                                <span className="font-medium text-slate-800">{med.name}</span>
                                <span className="text-slate-500 text-xs">
                                    {med.dose}
                                    {med.route && ` • ${med.route}`}
                                    {med.frequency && ` • ${med.frequency}`}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* General Clinical Note */}
            {note.note && (
                <div className="bg-slate-50 p-3 rounded-lg">
                    <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Clinical Notes
                    </h4>
                    <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">{note.note}</p>
                </div>
            )}

            {/* Legacy note support - if no structured data */}
            {!hasVitals && !hasExamination && !hasMedications && note.note && (
                <div className="text-slate-700 text-sm">
                    <p className="whitespace-pre-wrap leading-relaxed">{note.note}</p>
                </div>
            )}
        </div>
    );
};

export default ProgressNoteDisplay;
