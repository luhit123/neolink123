import React, { useState, useEffect, useCallback } from 'react';
import { Patient, ProgressNote } from '../types';
import { XIcon, WandIcon, ClipboardDocumentListIcon } from './common/Icons';
import ClinicalNotesNavigator from './ClinicalNotesNavigator';
import { generatePatientSummary } from '../services/geminiService';
import ProgressNoteForm from './ProgressNoteFormEnhanced';
import MedicationManagement from './MedicationManagement';
import { useBackgroundSave } from '../contexts/BackgroundSaveContext';

interface PatientDetailModalProps {
  patient: Patient;
  onClose: () => void;
  onEdit?: (patient: Patient) => void;
  canEdit?: boolean;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  onPatientUpdate?: (updatedPatient: Patient) => void;
}

const DetailItem: React.FC<{ label: string; value: React.ReactNode; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="bg-gradient-to-br from-white to-sky-50 rounded-2xl p-4 border border-sky-100 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02]">
    <div className="flex items-center gap-2 mb-1">
      {icon && <span className="text-sky-600">{icon}</span>}
      <p className="text-xs font-bold text-sky-600 uppercase tracking-wider">{label}</p>
    </div>
    <p className="text-base font-semibold text-slate-800 ml-6">{value || 'N/A'}</p>
  </div>
);

const PatientDetailModal: React.FC<PatientDetailModalProps> = ({
    patient,
    onClose,
    onEdit,
    canEdit = false,
    userEmail = '',
    userName = '',
    userRole = '',
    onPatientUpdate
}) => {
    const [summary, setSummary] = useState('');
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [showQuickNote, setShowQuickNote] = useState(false);
    const [showQuickMed, setShowQuickMed] = useState(false);
    const [localPatient, setLocalPatient] = useState(patient);

    // Background save context
    const { addSavingNote, updateNoteStatus, setOnViewPatient } = useBackgroundSave();

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

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 200);
    };

    const handleSaveProgressNote = (note: ProgressNote) => {
        const updatedNotes = [...(localPatient.progressNotes || []), note];
        const updatedPatient = { ...localPatient, progressNotes: updatedNotes };
        setLocalPatient(updatedPatient);
        if (onPatientUpdate) {
            onPatientUpdate(updatedPatient);
        }
        setShowQuickNote(false);
    };

    // Background save handler - saves note asynchronously and shows status indicator
    const handleBackgroundSave = useCallback(async (patientId: string, note: ProgressNote) => {
        // Add to background save queue - shows "Saving..." indicator
        const saveId = addSavingNote(patientId, localPatient.name, note);

        // Close modal immediately so user can proceed
        setShowQuickNote(false);

        try {
            // Update local state immediately
            const updatedNotes = [...(localPatient.progressNotes || []), note];
            const updatedPatient = { ...localPatient, progressNotes: updatedNotes };
            setLocalPatient(updatedPatient);

            // Save to parent (which saves to Firestore)
            if (onPatientUpdate) {
                await onPatientUpdate(updatedPatient);
            }

            // Update status to saved
            updateNoteStatus(saveId, 'saved');
        } catch (err) {
            console.error('Background save failed:', err);
            updateNoteStatus(saveId, 'error', (err as Error).message);
        }
    }, [localPatient, addSavingNote, updateNoteStatus, onPatientUpdate]);

    const handleUpdateMedications = (medications: any[]) => {
        const updatedPatient = { ...localPatient, medications };
        setLocalPatient(updatedPatient);
        if (onPatientUpdate) {
            onPatientUpdate(updatedPatient);
        }
    };

    useEffect(() => {
        // Reset state when patient changes
        setSummary('');
        setError('');
        setIsLoadingSummary(false);
        setCopied(false);
        setIsClosing(false);
        setShowQuickNote(false);
        setShowQuickMed(false);
        setLocalPatient(patient);
    }, [patient]);

  return (
    <div
      className={`fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-50 transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
      onClick={handleClose}
    >
      {/* Material Design Bottom Sheet on Mobile, Dialog on Desktop */}
      <div
        className={`bg-gradient-to-b from-white to-sky-50/30 w-full md:max-w-4xl md:mx-4 md:rounded-3xl rounded-t-3xl md:rounded-b-3xl shadow-2xl border-t-4 md:border-4 border-sky-500 max-h-[90vh] md:max-h-[85vh] flex flex-col overflow-hidden transform transition-all duration-300 ${isClosing ? 'translate-y-full md:translate-y-0 md:scale-95' : 'translate-y-0 md:scale-100'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Material Design Header with Drag Handle */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 text-white shadow-lg">
          {/* Mobile Drag Handle */}
          <div className="md:hidden flex justify-center pt-2 pb-1">
            <div className="w-12 h-1.5 bg-white/40 rounded-full" />
          </div>

          <div className="px-5 md:px-6 py-4 md:py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight">Patient Details</h2>
                <p className="text-xs text-white/80 font-medium mt-0.5">Medical Record View</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && onEdit && (
                <>
                  <button
                    onClick={() => {
                      onEdit(patient);
                      handleClose();
                    }}
                    className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 md:px-4 py-2.5 rounded-xl transition-all duration-200 active:scale-95 font-semibold text-xs md:text-sm"
                    title="Edit full patient record"
                  >
                    <svg className="w-4 md:w-5 h-4 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span className="hidden lg:inline">Edit</span>
                  </button>
                  <button
                    onClick={() => setShowQuickNote(true)}
                    className="flex items-center gap-2 bg-emerald-500/90 hover:bg-emerald-600 px-3 md:px-4 py-2.5 rounded-xl transition-all duration-200 active:scale-95 font-semibold text-xs md:text-sm"
                    title="Quick add clinical note"
                  >
                    <svg className="w-4 md:w-5 h-4 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="hidden lg:inline">Note</span>
                  </button>
                  <button
                    onClick={() => setShowQuickMed(true)}
                    className="flex items-center gap-2 bg-purple-500/90 hover:bg-purple-600 px-3 md:px-4 py-2.5 rounded-xl transition-all duration-200 active:scale-95 font-semibold text-xs md:text-sm"
                    title="Quick add medication"
                  >
                    <svg className="w-4 md:w-5 h-4 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    <span className="hidden lg:inline">Med</span>
                  </button>
                </>
              )}
              <button
                onClick={handleClose}
                className="text-white hover:bg-white/20 p-2.5 rounded-xl transition-all duration-200 active:scale-95"
              >
                <XIcon className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content with Material Design Cards */}
        <div className="overflow-y-auto flex-1 px-2 md:px-6 py-5 space-y-5">
            {/* Patient Overview Card */}
            <div className="bg-white rounded-3xl shadow-lg border-2 border-sky-200 overflow-hidden">
                <div className="bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-3">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Patient Information
                    </h3>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <DetailItem
                        label="Full Name"
                        value={patient.name}
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                    />
                    <DetailItem
                        label="Age"
                        value={`${patient.age} ${patient.ageUnit}`}
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    />
                    <DetailItem
                        label="Gender"
                        value={patient.gender}
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                    />
                    <DetailItem
                        label="Unit"
                        value={patient.unit}
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                    />
                    <DetailItem
                        label="Admission Date"
                        value={new Date(patient.admissionDate).toLocaleDateString()}
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                    />
                    <DetailItem
                        label="Status"
                        value={patient.outcome}
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    />
                    <DetailItem
                        label="Date of Release"
                        value={patient.releaseDate ? new Date(patient.releaseDate).toLocaleDateString() : 'N/A'}
                        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>}
                    />
                    {patient.unit === 'Neonatal Intensive Care Unit' && (
                        <DetailItem
                            label="Admission Type"
                            value={patient.admissionType}
                            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                        />
                    )}
                    {patient.admissionType === 'Outborn' && (
                        <DetailItem
                            label="Referring Hospital"
                            value={patient.referringHospital}
                            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                        />
                    )}
                    {patient.admissionType === 'Outborn' && (
                        <DetailItem
                            label="Referring District"
                            value={patient.referringDistrict}
                            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                        />
                    )}
                </div>
            </div>

            {/* Step Down Information Section */}
            {(patient.isStepDown || patient.stepDownDate || patient.readmissionFromStepDown || patient.finalDischargeDate) && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-100 rounded-3xl shadow-lg border-2 border-purple-300 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-5 py-3">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                            Step Down Information
                        </h3>
                    </div>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {patient.stepDownDate && (
                            <DetailItem
                                label="Step Down Date"
                                value={new Date(patient.stepDownDate).toLocaleString()}
                                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                            />
                        )}
                        {patient.stepDownFrom && (
                            <DetailItem
                                label="Stepped Down From"
                                value={patient.stepDownFrom === 'Neonatal Intensive Care Unit' ? 'NICU' : 'PICU'}
                                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                            />
                        )}
                        {patient.isStepDown && (
                            <DetailItem
                                label="Current Status"
                                value={<span className="text-purple-600 font-bold">Currently in Step Down</span>}
                                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                            />
                        )}
                        {patient.readmissionFromStepDown && (
                            <DetailItem
                                label="Readmission Status"
                                value={<span className="text-red-600 font-bold">⚠️ Readmitted from Step Down</span>}
                                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                            />
                        )}
                        {patient.finalDischargeDate && (
                            <DetailItem
                                label="Final Discharge Date"
                                value={new Date(patient.finalDischargeDate).toLocaleString()}
                                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Referral Information Section */}
            {patient.outcome === 'Referred' && (patient.referralReason || patient.referredTo) && (
                <div className="bg-gradient-to-br from-orange-50 to-amber-100 rounded-3xl shadow-lg border-2 border-orange-300 overflow-hidden">
                    <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-5 py-3">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            Referral Information
                        </h3>
                    </div>
                    <div className="p-5 space-y-3">
                        {patient.referredTo && (
                            <div className="bg-white rounded-2xl p-4 border border-orange-200 shadow-sm">
                                <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">Referred To</p>
                                <p className="text-base font-bold text-orange-900">{patient.referredTo}</p>
                            </div>
                        )}
                        {patient.referralReason && (
                            <div className="bg-white rounded-2xl p-4 border border-orange-200 shadow-sm">
                                <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-2">Reason for Referral</p>
                                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{patient.referralReason}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

             {/* Primary Diagnosis Card */}
             <div className="bg-white rounded-3xl shadow-lg border-2 border-sky-200 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        Primary Diagnosis
                    </h3>
                </div>
                <div className="p-5">
                    <p className="text-base text-slate-800 leading-relaxed font-medium">{patient.diagnosis}</p>
                </div>
            </div>

            {/* Clinical Progress Notes */}
            <div className="bg-white rounded-3xl shadow-lg border-2 border-sky-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Clinical Progress Notes
                        </h3>
                        <span className="text-xs bg-white/25 text-white font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
                            {(localPatient.progressNotes || []).length} {(localPatient.progressNotes || []).length === 1 ? 'entry' : 'entries'}
                        </span>
                    </div>
                </div>
                <div className="p-2 md:p-4">
                    <ClinicalNotesNavigator
                        notes={localPatient.progressNotes || []}
                        patient={localPatient}
                        canEdit={canEdit}
                    />
                </div>
            </div>

            {/* Medications Card */}
            <div className="bg-white rounded-3xl shadow-lg border-2 border-purple-200 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-5 py-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            Medications
                        </h3>
                        {localPatient.medications && localPatient.medications.length > 0 && (
                            <span className="text-xs bg-white/25 text-white font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
                                {localPatient.medications.length} {localPatient.medications.length === 1 ? 'medication' : 'medications'}
                            </span>
                        )}
                    </div>
                </div>
                <div className="p-5">
                    {localPatient.medications && localPatient.medications.length > 0 ? (
                        <div className="space-y-2">
                            {localPatient.medications.map((med, index) => (
                                <div key={index} className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4 transform transition-all hover:scale-[1.01]">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h4 className="text-base font-bold text-slate-800 mb-1">{med.name}</h4>
                                            <div className="flex flex-wrap gap-3 text-sm">
                                                <div className="flex items-center gap-1.5">
                                                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                    </svg>
                                                    <span className="text-purple-700 font-semibold">{med.dose}</span>
                                                </div>
                                                {med.route && (
                                                    <div className="flex items-center gap-1.5">
                                                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                        </svg>
                                                        <span className="text-sky-700">{med.route}</span>
                                                    </div>
                                                )}
                                                {med.frequency && (
                                                    <div className="flex items-center gap-1.5">
                                                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        <span className="text-emerald-700 font-semibold">{med.frequency}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {(med.addedBy || med.addedAt) && (
                                                <div className="mt-2 text-xs text-purple-600">
                                                    {med.addedBy && <span>Added by {med.addedBy}</span>}
                                                    {med.addedAt && <span> • {new Date(med.addedAt).toLocaleDateString()}</span>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-slate-400 text-center py-12 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border-2 border-dashed border-purple-200">
                            <svg className="w-16 h-16 mx-auto mb-3 opacity-30 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            <p className="text-base font-semibold text-slate-500">No medications added yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* AI Summary Card */}
            <div className="bg-gradient-to-br from-violet-50 to-fuchsia-100 rounded-3xl shadow-lg border-2 border-violet-300 overflow-hidden mb-6">
                <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 px-5 py-3">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        AI-Generated Handoff Summary
                    </h3>
                </div>
                <div className="p-5 space-y-4">
                    <button
                        onClick={handleGenerateSummary}
                        disabled={isLoadingSummary}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 transition-all duration-300 font-bold shadow-lg hover:shadow-xl disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed active:scale-95 transform"
                    >
                        {isLoadingSummary ? (
                            <>
                                <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="text-lg">Generating Summary...</span>
                            </>
                        ) : (
                            <>
                                <WandIcon className="w-6 h-6" />
                                <span className="text-lg">Generate AI Summary</span>
                            </>
                        )}
                    </button>

                    {error && (
                        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-red-700 font-medium text-sm">{error}</p>
                        </div>
                    )}

                    {summary && (
                        <div className="bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 rounded-2xl border-2 border-sky-300 shadow-lg overflow-hidden">
                            <div className="bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-500 px-4 py-3 flex items-center justify-between shadow-md">
                                <span className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    Clinical Summary
                                </span>
                                <button
                                    onClick={handleCopyToClipboard}
                                    className="flex items-center gap-2 px-4 py-2 bg-white/90 hover:bg-white text-sky-700 rounded-lg transition-all duration-200 active:scale-95 shadow-md font-bold"
                                >
                                    <ClipboardDocumentListIcon className="w-4 h-4" />
                                    <span className="text-xs">{copied ? 'Copied!' : 'Copy'}</span>
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border-2 border-sky-200 shadow-sm">
                                    <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line font-['system-ui']" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                                        {summary.replace(/#{1,6}\s/g, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/^-\s/gm, '').replace(/^\*\s/gm, '').replace(/`/g, '').replace(/_{3,}/g, '').replace(/={3,}/g, '').replace(/\|/g, '')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* Quick Clinical Note Modal - Mobile Optimized */}
      {showQuickNote && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-0 md:p-4"
          onClick={() => setShowQuickNote(false)}
        >
          <div
            className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl border-t-4 md:border-4 border-emerald-500 w-full md:max-w-4xl h-full md:h-auto md:max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Mobile Optimized */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-3 md:px-6 py-3 md:py-4 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2 md:gap-3">
                <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <h3 className="text-base md:text-xl font-bold text-white">Add Clinical Note</h3>
                  <p className="text-xs text-white/80">For {localPatient.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickNote(false)}
                className="text-white hover:bg-white/20 p-1.5 md:p-2 rounded-xl transition-all"
              >
                <XIcon className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>

            {/* Content - Mobile Optimized Padding with Bottom Space */}
            <div className="overflow-y-auto h-[calc(100vh-60px)] md:max-h-[calc(90vh-80px)] p-2 md:p-6 pb-6 md:pb-8">
              <ProgressNoteForm
                onSave={handleSaveProgressNote}
                onCancel={() => setShowQuickNote(false)}
                onBackgroundSave={handleBackgroundSave}
                onUpdatePatient={(updatedPatient) => {
                  setLocalPatient(updatedPatient);
                  if (onPatientUpdate) {
                    onPatientUpdate(updatedPatient);
                  }
                }}
                lastNote={localPatient.progressNotes && localPatient.progressNotes.length > 0
                  ? localPatient.progressNotes[localPatient.progressNotes.length - 1]
                  : undefined}
                userEmail={userEmail}
                userName={userName || userEmail}
                patient={localPatient}
              />
            </div>
          </div>
        </div>
      )}

      {/* Quick Medication Modal - Mobile Optimized */}
      {showQuickMed && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-0 md:p-4"
          onClick={() => setShowQuickMed(false)}
        >
          <div
            className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl border-t-4 md:border-4 border-purple-500 w-full md:max-w-3xl h-full md:h-auto md:max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Mobile Optimized */}
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-3 md:px-6 py-3 md:py-4 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2 md:gap-3">
                <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <div>
                  <h3 className="text-base md:text-xl font-bold text-white">Manage Medications</h3>
                  <p className="text-xs text-white/80">For {localPatient.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickMed(false)}
                className="text-white hover:bg-white/20 p-1.5 md:p-2 rounded-xl transition-all"
              >
                <XIcon className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>

            {/* Content - Mobile Optimized Padding */}
            <div className="overflow-y-auto h-[calc(100vh-120px)] md:max-h-[calc(90vh-160px)] p-2 md:p-6">
              <MedicationManagement
                medications={localPatient.medications || []}
                onUpdate={handleUpdateMedications}
                userRole={userRole}
                userName={userName}
                userEmail={userEmail}
                readOnly={false}
              />
              <div className="mt-4 flex justify-end sticky bottom-0 bg-white py-3 border-t">
                <button
                  onClick={() => setShowQuickMed(false)}
                  className="w-full md:w-auto px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDetailModal;
