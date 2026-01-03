import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import { XIcon, WandIcon, ClipboardDocumentListIcon } from './common/Icons';
import ProgressNoteDisplay from './ProgressNoteDisplay';
import { generatePatientSummary } from '../services/geminiService';

interface PatientDetailModalProps {
  patient: Patient;
  onClose: () => void;
}

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="text-sm font-medium text-slate-400">{label}</p>
    <p className="text-md text-slate-200">{value || 'N/A'}</p>
  </div>
);

const PatientDetailModal: React.FC<PatientDetailModalProps> = ({ patient, onClose }) => {
    const [summary, setSummary] = useState('');
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    
    const handleGenerateSummary = async () => {
        setIsLoadingSummary(true);
        setError('');
        try {
            const result = await generatePatientSummary(patient);
            setSummary(result);
        } catch (e) {
            console.error(e);
            setError('Failed to generate summary. Please try again.');
        } finally {
            setIsLoadingSummary(false);
        }
    };

    const handleCopyToClipboard = () => {
        if (summary) {
            navigator.clipboard.writeText(summary);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };
    
    useEffect(() => {
        // Reset state when patient changes
        setSummary('');
        setError('');
        setIsLoadingSummary(false);
        setCopied(false);
    }, [patient]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl border border-slate-700 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Patient Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
            <div className="bg-slate-700/50 p-4 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <DetailItem label="Full Name" value={patient.name} />
                    <DetailItem label="Age" value={`${patient.age} ${patient.ageUnit}`} />
                    <DetailItem label="Gender" value={patient.gender} />
                    <DetailItem label="Unit" value={patient.unit} />
                    <DetailItem label="Admission Date" value={new Date(patient.admissionDate).toLocaleDateString()} />
                    <DetailItem label="Status" value={patient.outcome} />
                    <DetailItem label="Date of Release" value={patient.releaseDate ? new Date(patient.releaseDate).toLocaleDateString() : 'N/A'} />
                    {patient.unit === 'Neonatal Intensive Care Unit' && <DetailItem label="Admission Type" value={patient.admissionType}/>}
                    {patient.admissionType === 'Outborn' && <DetailItem label="Referring Hospital" value={patient.referringHospital}/>}
                    {patient.admissionType === 'Outborn' && <DetailItem label="Referring District" value={patient.referringDistrict}/>}
                </div>
            </div>

            {/* Step Down Information Section */}
            {(patient.isStepDown || patient.stepDownDate || patient.readmissionFromStepDown || patient.finalDischargeDate) && (
                <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-300 mb-3 flex items-center gap-2">
                        🟣 Step Down Information
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {patient.stepDownDate && (
                            <DetailItem 
                                label="Step Down Date" 
                                value={new Date(patient.stepDownDate).toLocaleString()} 
                            />
                        )}
                        {patient.stepDownFrom && (
                            <DetailItem 
                                label="Stepped Down From" 
                                value={patient.stepDownFrom === 'Neonatal Intensive Care Unit' ? 'NICU' : 'PICU'} 
                            />
                        )}
                        {patient.isStepDown && (
                            <DetailItem 
                                label="Current Status" 
                                value={<span className="text-blue-400 font-semibold">Currently in Step Down</span>} 
                            />
                        )}
                        {patient.readmissionFromStepDown && (
                            <DetailItem 
                                label="Readmission Status" 
                                value={<span className="text-orange-400 font-semibold">Readmitted from Step Down</span>} 
                            />
                        )}
                        {patient.finalDischargeDate && (
                            <DetailItem 
                                label="Final Discharge Date" 
                                value={new Date(patient.finalDischargeDate).toLocaleString()} 
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Referral Information Section */}
            {patient.outcome === 'Referred' && (patient.referralReason || patient.referredTo) && (
                <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-orange-300 mb-3 flex items-center gap-2">
                        🔄 Referral Information
                    </h3>
                    <div className="space-y-3">
                        {patient.referredTo && (
                            <DetailItem 
                                label="Referred To" 
                                value={<span className="text-orange-400 font-semibold">{patient.referredTo}</span>} 
                            />
                        )}
                        {patient.referralReason && (
                            <div>
                                <p className="text-sm font-medium text-slate-400 mb-1">Reason for Referral</p>
                                <p className="text-md text-slate-200 bg-slate-700/40 p-3 rounded-md whitespace-pre-wrap">{patient.referralReason}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

             <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-2">Primary Diagnosis</h3>
                <p className="text-slate-300">{patient.diagnosis}</p>
            </div>
            <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Clinical Progress Notes
                    <span className="ml-auto text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                        {patient.progressNotes.length} {patient.progressNotes.length === 1 ? 'entry' : 'entries'}
                    </span>
                </h3>
                <div className="space-y-4">
                    {patient.progressNotes.length > 0 ? (
                        patient.progressNotes
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map((note, index) => (
                                <ProgressNoteDisplay key={index} note={note} />
                            ))
                    ) : (
                        <div className="text-slate-400 text-center py-8 bg-slate-800/30 rounded-lg border border-slate-700 border-dashed">
                            <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p>No progress notes yet</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="border-t border-slate-700 pt-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-2">AI-Generated Handoff Summary</h3>
                 <button onClick={handleGenerateSummary} disabled={isLoadingSummary} className="flex items-center gap-2 px-4 py-2 mb-4 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors font-semibold disabled:bg-sky-800 disabled:cursor-not-allowed">
                    {isLoadingSummary ? (
                        <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating...
                        </>
                    ) : (
                        <>
                        <WandIcon className="w-5 h-5"/>
                        Generate Summary
                        </>
                    )}
                 </button>
                 
                {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
                
                {summary && (
                    <div className="bg-slate-700/50 p-4 rounded-lg relative">
                        <p className="text-slate-300 whitespace-pre-wrap">{summary}</p>
                        <button onClick={handleCopyToClipboard} className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-white bg-slate-600/50 hover:bg-slate-500/50 rounded-md transition-colors">
                            <ClipboardDocumentListIcon className="w-5 h-5"/>
                        </button>
                        {copied && <span className="absolute top-10 right-2 text-xs bg-slate-900 text-white px-2 py-1 rounded">Copied!</span>}
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default PatientDetailModal;
