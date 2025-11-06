import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import { XIcon, WandIcon, ClipboardDocumentListIcon } from './common/Icons';
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
             <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-2">Primary Diagnosis</h3>
                <p className="text-slate-300">{patient.diagnosis}</p>
            </div>
            <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-2">Clinical Progress Notes</h3>
                <div className="space-y-3">
                    {patient.progressNotes.map((note, index) => (
                        <div key={index} className="text-slate-300 bg-slate-700/40 p-3 rounded-md">
                           <p className="text-xs text-slate-400 font-semibold mb-1">{new Date(note.date).toLocaleString()}</p>
                           <p className="whitespace-pre-wrap">{note.note}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="border-t border-slate-700 pt-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-2">AI-Generated Handoff Summary</h3>
                 <button onClick={handleGenerateSummary} disabled={isLoadingSummary} className="flex items-center gap-2 px-4 py-2 mb-4 rounded-lg text-white bg-cyan-600 hover:bg-cyan-700 transition-colors font-semibold disabled:bg-cyan-800 disabled:cursor-not-allowed">
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
