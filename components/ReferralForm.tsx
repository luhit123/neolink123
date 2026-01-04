import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, onSnapshot, query, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Patient, Institution, Unit, UserRole, ReferralDetails, VitalSigns } from '../types';
import { generateReferralLetter } from '../utils/geminiService';

interface ReferralFormProps {
  patient: Patient;
  currentInstitutionId: string;
  currentInstitutionName: string;
  userEmail: string;
  userRole: UserRole;
  userName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ReferralForm: React.FC<ReferralFormProps> = ({
  patient,
  currentInstitutionId,
  currentInstitutionName,
  userEmail,
  userRole,
  userName,
  onClose,
  onSuccess
}) => {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [showInstitutionDropdown, setShowInstitutionDropdown] = useState(false);
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [generatedLetter, setGeneratedLetter] = useState<string>('');
  const [showLetterPreview, setShowLetterPreview] = useState(false);
  const [editingLetter, setEditingLetter] = useState(false);

  // Referral form data
  const [referralData, setReferralData] = useState<ReferralDetails>({
    reasonForReferral: '',
    diagnosisAtReferral: patient.diagnosis || '',
    conditionAtReferral: '',
    treatmentsProvided: [],
    investigationsPerformed: '',
    recommendedTreatment: '',
    clinicalSummary: ''
  });

  const [treatmentInput, setTreatmentInput] = useState('');
  const [vitalSigns, setVitalSigns] = useState<VitalSigns>({
    temperature: '',
    hr: '',
    rr: '',
    bp: '',
    spo2: '',
    crt: '',
    weight: ''
  });

  const [selectedUnit, setSelectedUnit] = useState<Unit | ''>('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load institutions
  useEffect(() => {
    const q = collection(db, 'institutions');

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const institutionData: Institution[] = [];
      snapshot.forEach((doc) => {
        const institution = { id: doc.id, ...doc.data() } as Institution;
        // Exclude current institution (prevent self-referral)
        if (institution.id !== currentInstitutionId) {
          institutionData.push(institution);
        }
      });
      setInstitutions(institutionData);
    });

    return () => unsubscribe();
  }, [currentInstitutionId]);

  // Filter institutions based on search
  const filteredInstitutions = useMemo(() => {
    if (!searchTerm) return institutions;

    const term = searchTerm.toLowerCase();
    return institutions.filter(
      (inst) =>
        inst.name.toLowerCase().includes(term) ||
        inst.district?.toLowerCase().includes(term) ||
        inst.institutionType?.toLowerCase().includes(term)
    );
  }, [institutions, searchTerm]);

  const handleAddTreatment = () => {
    if (treatmentInput.trim()) {
      setReferralData((prev) => ({
        ...prev,
        treatmentsProvided: [...prev.treatmentsProvided, treatmentInput.trim()]
      }));
      setTreatmentInput('');
    }
  };

  const handleRemoveTreatment = (index: number) => {
    setReferralData((prev) => ({
      ...prev,
      treatmentsProvided: prev.treatmentsProvided.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedInstitution) newErrors.institution = 'Please select a receiving institution';
    if (!referralData.reasonForReferral.trim())
      newErrors.reason = 'Reason for referral is required';
    if (!referralData.diagnosisAtReferral.trim())
      newErrors.diagnosis = 'Diagnosis at referral is required';
    if (!referralData.conditionAtReferral.trim())
      newErrors.condition = 'Patient condition is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGenerateLetter = async () => {
    if (!validateForm()) return;
    if (!selectedInstitution) return;

    setGeneratingLetter(true);
    try {
      // Generate AI clinical summary using Gemini
      const aiSummary = await generateReferralLetter({
        patient,
        referralDetails: {
          ...referralData,
          vitalSignsAtReferral: vitalSigns
        },
        fromInstitutionName: currentInstitutionName,
        toInstitutionName: selectedInstitution.name,
        toInstitutionAddress: `${selectedInstitution.district || ''}`,
        referredBy: userName,
        referredByRole: userRole,
        referralDate: new Date().toISOString()
      });

      setGeneratedLetter(aiSummary);
      setShowLetterPreview(true);
    } catch (error) {
      console.error('Error generating referral summary:', error);
      alert(
        `Failed to generate referral summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setGeneratingLetter(false);
    }
  };



  const handleFinalSubmit = async () => {
    if (!selectedInstitution) return;

    setLoading(true);
    try {
      // Create referral document with the generated/edited letter
      const referralDoc = {
        // Patient Information
        patientId: patient.id,
        patientName: patient.name,
        patientAge: patient.age,
        patientAgeUnit: patient.ageUnit,
        patientGender: patient.gender,
        patientAdmissionDate: patient.admissionDate,

        // Referring Institution
        fromInstitutionId: currentInstitutionId,
        fromInstitutionName: currentInstitutionName,
        fromUnit: patient.unit,
        referredBy: userName,
        referredByEmail: userEmail,
        referredByRole: userRole,
        referralDate: new Date().toISOString(),

        // Receiving Institution
        toInstitutionId: selectedInstitution.id,
        toInstitutionName: selectedInstitution.name,
        toUnit: selectedUnit || undefined,

        // Referral Details
        referralDetails: {
          ...referralData,
          vitalSignsAtReferral: vitalSigns
        },
        referralLetter: generatedLetter,

        // Status
        status: 'Pending',
        statusUpdates: [
          {
            timestamp: new Date().toISOString(),
            updatedBy: userName,
            updatedByEmail: userEmail,
            updatedByRole: userRole,
            status: 'Referral Created',
            notes: 'Patient referral initiated'
          }
        ],

        // Metadata
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        isRead: false,
        priority
      };

      // Save to Firestore
      await addDoc(collection(db, 'referrals'), referralDoc);

      // Update Patient Status to Referred immediately to free up bed and update dashboard
      await updateDoc(doc(db, 'patients', patient.id), {
        outcome: 'Referred',
        referralReason: referralData.reasonForReferral,
        referredTo: selectedInstitution.name,
        releaseDate: new Date().toISOString(), // Marks the bed as free from now
        lastUpdatedBy: userRole,
        lastUpdatedByEmail: userEmail,
        lastEditedAt: new Date().toISOString()
      });

      alert('Referral sent successfully! The receiving institution has been notified.');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating referral:', error);
      alert(
        `Failed to send referral: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBackToForm = () => {
    setShowLetterPreview(false);
    setEditingLetter(false);
  };

  // Show letter preview if generated
  if (showLetterPreview) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">📄 Review Referral Ticket</h2>
                <p className="text-green-100 text-sm mt-1">
                  Review the structured referral ticket before sending to {selectedInstitution?.name}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Letter Preview/Edit Section */}
          <div className="p-6 space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto">
            {/* Info Banner */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h4 className="font-bold text-blue-900 mb-1">Generated by AI</h4>
                  <p className="text-sm text-blue-700">
                    This referral letter was automatically generated using Gemini AI. Please review carefully and edit if needed before sending.
                  </p>
                </div>
              </div>
            </div>

            {/* Referral TICKET Preview/Edit */}
            <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-lg print:shadow-none print:border-0" id="referral-ticket">
              {/* 1. Header Section */}
              <div className="bg-slate-50 border-b-2 border-slate-900 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-widest">Medical Referral Ticket</h2>
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Priority: <span className={`${priority === 'Critical' ? 'text-red-600 font-extrabold' : 'text-slate-700'}`}>{priority}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 uppercase">Referral Date</p>
                  <p className="font-bold text-slate-900">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              {/* 2. Transfer Details (From -> To) */}
              <div className="flex border-b border-slate-200">
                <div className="flex-1 p-5 border-r border-slate-200 bg-slate-50/50">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">From Institution</p>
                  <p className="font-bold text-lg text-slate-800">{currentInstitutionName}</p>
                  <p className="text-sm text-slate-600">{patient.unit}</p>
                  <div className="mt-2 text-sm">
                    <p className="font-semibold text-slate-700">Ref. By: {userName}</p>
                    <p className="text-slate-500 text-xs">{userRole}</p>
                  </div>
                </div>
                <div className="flex-1 p-5 bg-sky-50/30">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">To Institution</p>
                  <p className="font-bold text-lg text-slate-800">{selectedInstitution?.name}</p>
                  <p className="text-sm text-slate-600">{selectedInstitution?.district}</p>
                  {selectedUnit && (
                    <div className="mt-2 inline-block px-2 py-1 bg-sky-100 text-sky-700 text-xs font-bold rounded">
                      Requested Unit: {selectedUnit}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Patient Demographics Grid */}
              <div className="grid grid-cols-4 border-b border-slate-200 divide-x divide-slate-200">
                <div className="p-4">
                  <p className="text-xs font-bold text-slate-400 uppercase">Patient Name</p>
                  <p className="font-semibold text-slate-900">{patient.name}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs font-bold text-slate-400 uppercase">Age / Gender</p>
                  <p className="font-semibold text-slate-900">{patient.age} {patient.ageUnit} / {patient.gender}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs font-bold text-slate-400 uppercase">Admission Date</p>
                  <p className="font-semibold text-slate-900">{new Date(patient.admissionDate).toLocaleDateString()}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs font-bold text-slate-400 uppercase">UHID / IP No</p>
                  <p className="font-semibold text-slate-900">{patient.ipNumber || 'N/A'}</p>
                </div>
              </div>

              {/* 4. Clinical Details Section - ALL EDITABLE */}
              <div className="p-6 space-y-6">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span className="text-sm text-amber-800 font-medium">All fields below are editable. Click on any field to modify before sending.</span>
                </div>

                {/* Diagnosis & Reason Grid - EDITABLE */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Diagnosis <span className="text-amber-500">*</span></h4>
                    <textarea
                      value={referralData.diagnosisAtReferral}
                      onChange={(e) => setReferralData(prev => ({ ...prev, diagnosisAtReferral: e.target.value }))}
                      className="w-full p-2 border border-slate-200 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={2}
                      placeholder="Enter diagnosis..."
                    />
                  </div>
                  <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Reason for Referral <span className="text-amber-500">*</span></h4>
                    <textarea
                      value={referralData.reasonForReferral}
                      onChange={(e) => setReferralData(prev => ({ ...prev, reasonForReferral: e.target.value }))}
                      className="w-full p-2 border border-slate-200 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={2}
                      placeholder="Enter reason for referral..."
                    />
                  </div>
                </div>

                {/* Vitals Grid - EDITABLE */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 text-center border-b border-slate-100 pb-2">Vitals at Referral (Editable)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                    {Object.entries(vitalSigns).map(([key, value]) => {
                      const labels: Record<string, string> = { temperature: 'Temp', hr: 'HR', rr: 'RR', bp: 'BP', spo2: 'SpO2', crt: 'CRT', weight: 'Wt' };
                      const units: Record<string, string> = { temperature: '°C', hr: 'bpm', rr: '/min', bp: 'mmHg', spo2: '%', crt: 'sec', weight: 'kg' };
                      const placeholders: Record<string, string> = { temperature: '37', hr: '120', rr: '30', bp: '90/60', spo2: '98', crt: '2', weight: '3.5' };
                      return (
                        <div key={key} className="bg-slate-50 border border-slate-100 rounded p-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase text-center">{labels[key]}</p>
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={value || ''}
                              onChange={(e) => setVitalSigns(prev => ({ ...prev, [key]: e.target.value }))}
                              className="w-full text-center p-1 border border-slate-200 rounded text-sm font-bold text-slate-700 focus:ring-1 focus:ring-blue-500"
                              placeholder={placeholders[key]}
                            />
                            <span className="text-[10px] text-slate-400">{units[key]}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Treatments & Condition - EDITABLE */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Treatments Given</h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      {referralData.treatmentsProvided.length > 0 && (
                        <ul className="space-y-2 mb-3">
                          {referralData.treatmentsProvided.map((t, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                              <span className="flex-1">{i + 1}. {t}</span>
                              <button
                                onClick={() => setReferralData(prev => ({
                                  ...prev,
                                  treatmentsProvided: prev.treatmentsProvided.filter((_, index) => index !== i)
                                }))}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                ✕
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={treatmentInput}
                          onChange={(e) => setTreatmentInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && treatmentInput.trim()) {
                              setReferralData(prev => ({
                                ...prev,
                                treatmentsProvided: [...prev.treatmentsProvided, treatmentInput.trim()]
                              }));
                              setTreatmentInput('');
                            }
                          }}
                          className="flex-1 p-2 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-blue-500"
                          placeholder="Add treatment..."
                        />
                        <button
                          onClick={() => {
                            if (treatmentInput.trim()) {
                              setReferralData(prev => ({
                                ...prev,
                                treatmentsProvided: [...prev.treatmentsProvided, treatmentInput.trim()]
                              }));
                              setTreatmentInput('');
                            }
                          }}
                          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Current Condition <span className="text-amber-500">*</span></h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 h-full">
                      <textarea
                        value={referralData.conditionAtReferral}
                        onChange={(e) => setReferralData(prev => ({ ...prev, conditionAtReferral: e.target.value }))}
                        className="w-full p-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={4}
                        placeholder="Describe current condition..."
                      />
                    </div>
                  </div>
                </div>

                {/* Investigations & Recommended - EDITABLE */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Investigations Performed</h4>
                    <textarea
                      value={referralData.investigationsPerformed || ''}
                      onChange={(e) => setReferralData(prev => ({ ...prev, investigationsPerformed: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="List investigations performed..."
                    />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Recommended Treatment</h4>
                    <textarea
                      value={referralData.recommendedTreatment || ''}
                      onChange={(e) => setReferralData(prev => ({ ...prev, recommendedTreatment: e.target.value }))}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Recommend treatment for receiving hospital..."
                    />
                  </div>
                </div>

                {/* AI Summary Box */}
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-sm font-bold text-slate-900 uppercase">Clinical Summary</h4>
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">Generated by AI</span>

                    {editingLetter ? (
                      <button onClick={() => setEditingLetter(false)} className="ml-auto text-xs text-blue-600 hover:underline">Done Editing</button>
                    ) : (
                      <button onClick={() => setEditingLetter(true)} className="ml-auto text-xs text-blue-600 hover:underline">Edit Summary</button>
                    )}
                  </div>

                  {editingLetter ? (
                    <textarea
                      value={generatedLetter}
                      onChange={(e) => setGeneratedLetter(e.target.value)}
                      className="w-full p-4 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm leading-relaxed"
                      rows={6}
                    />
                  ) : (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 text-slate-800 text-sm leading-relaxed text-justify">
                      {generatedLetter || "No summary generated."}
                    </div>
                  )}
                </div>

              </div>

              {/* Footer / Signature Area */}
              <div className="bg-slate-50 border-t border-slate-200 p-8 flex justify-between items-end mt-4">
                <div className="text-xs text-slate-400">
                  <p>Generated via NeoLink Network</p>
                  <p>{new Date().toLocaleString()}</p>
                </div>
                <div className="text-center w-64">
                  <div className="border-b border-slate-400 mb-2 h-8"></div>
                  <p className="font-bold text-slate-900 text-sm">{userName}</p>
                  <p className="text-xs text-slate-500 uppercase">{userRole}</p>
                  <p className="text-xs text-slate-400">{currentInstitutionName}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex gap-3">
            <button
              onClick={handleBackToForm}
              disabled={loading}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all font-semibold disabled:opacity-50"
            >
              ← Back to Form
            </button>
            <button
              onClick={handleFinalSubmit}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3 rounded-lg transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                  Sending Referral...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send to {selectedInstitution?.name}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-500 to-blue-500 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Create Patient Referral</h2>
              <p className="text-sky-100 text-sm mt-1">
                Referring {patient.name} to another institution
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Patient Summary */}
          <div className="bg-sky-50 rounded-xl p-4 border border-sky-200">
            <h3 className="font-bold text-sky-900 mb-2">Patient Information</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-sky-600">Name:</span>
                <p className="font-semibold text-sky-900">{patient.name}</p>
              </div>
              <div>
                <span className="text-sky-600">Age/Gender:</span>
                <p className="font-semibold text-sky-900">
                  {patient.age} {patient.ageUnit} / {patient.gender}
                </p>
              </div>
              <div>
                <span className="text-sky-600">Current Unit:</span>
                <p className="font-semibold text-sky-900">{patient.unit}</p>
              </div>
              <div>
                <span className="text-sky-600">Current Diagnosis:</span>
                <p className="font-semibold text-sky-900">{patient.diagnosis}</p>
              </div>
            </div>
          </div>

          {/* Select Receiving Institution */}
          <div>
            <label className="block text-sm font-bold text-sky-900 mb-2">
              Receiving Institution <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={selectedInstitution ? selectedInstitution.name : searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedInstitution(null);
                  setShowInstitutionDropdown(true);
                }}
                onFocus={() => setShowInstitutionDropdown(true)}
                placeholder="Search institution by name, district, or type..."
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.institution ? 'border-red-500' : 'border-sky-200'
                  }`}
              />
              <svg
                className="absolute right-3 top-4 w-5 h-5 text-sky-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>

              {/* Dropdown */}
              {showInstitutionDropdown && filteredInstitutions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-sky-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {filteredInstitutions.map((institution) => (
                    <button
                      key={institution.id}
                      type="button"
                      onClick={() => {
                        setSelectedInstitution(institution);
                        setShowInstitutionDropdown(false);
                        setSearchTerm('');
                        setErrors((prev) => ({ ...prev, institution: '' }));
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-sky-50 transition-all border-b border-sky-100 last:border-0"
                    >
                      <p className="font-semibold text-sky-900">{institution.name}</p>
                      <p className="text-sm text-sky-600">
                        {institution.district} • {institution.institutionType || 'Medical Institution'}
                      </p>
                      <p className="text-xs text-sky-500 mt-1">
                        Facilities: {institution.facilities?.map(f => f === Unit.NICU ? 'NICU' : f === Unit.PICU ? 'PICU' : f === Unit.SNCU ? 'SNCU' : f === Unit.HDU ? 'HDU' : 'General').join(', ') || 'N/A'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.institution && <p className="text-red-500 text-sm mt-1">{errors.institution}</p>}
            {selectedInstitution && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-semibold text-green-900">
                  Selected: {selectedInstitution.name}
                </p>
                <p className="text-xs text-green-700">
                  {selectedInstitution.district} • {selectedInstitution.institutionType}
                </p>
              </div>
            )}
          </div>

          {/* Suggested Unit */}
          <div>
            <label className="block text-sm font-bold text-sky-900 mb-2">
              Suggested Unit at Receiving Institution
            </label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value as Unit)}
              className="w-full px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Not specified</option>
              <option value={Unit.NICU}>NICU (Neonatal Intensive Care Unit)</option>
              <option value={Unit.PICU}>PICU (Pediatric Intensive Care Unit)</option>
              <option value={Unit.SNCU}>SNCU (Special Newborn Care Unit)</option>
              <option value="HDU">HDU (High Dependency Unit)</option>
              <option value="Pediatric Ward">Pediatric Ward</option>
              <option value="General Ward">General Ward</option>
            </select>
            {selectedInstitution && selectedInstitution.facilities && selectedUnit && !selectedInstitution.facilities.includes(selectedUnit as Unit) && selectedUnit !== 'HDU' && selectedUnit !== 'Pediatric Ward' && selectedUnit !== 'General Ward' && (
              <p className="text-orange-500 text-sm mt-1">
                ⚠️ Note: {selectedInstitution.name} may not have {selectedUnit} facility. Please confirm availability.
              </p>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-bold text-sky-900 mb-2">Priority</label>
            <div className="grid grid-cols-4 gap-2">
              {(['Low', 'Medium', 'High', 'Critical'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${priority === p
                    ? p === 'Critical'
                      ? 'bg-red-500 text-white'
                      : p === 'High'
                        ? 'bg-orange-500 text-white'
                        : p === 'Medium'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Reason for Referral */}
          <div>
            <label className="block text-sm font-bold text-sky-900 mb-2">
              Reason for Referral <span className="text-red-500">*</span>
            </label>
            <textarea
              value={referralData.reasonForReferral}
              onChange={(e) => {
                setReferralData((prev) => ({ ...prev, reasonForReferral: e.target.value }));
                setErrors((prev) => ({ ...prev, reason: '' }));
              }}
              rows={3}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.reason ? 'border-red-500' : 'border-sky-200'
                }`}
              placeholder="Why is this patient being referred? (e.g., Higher level of care required, specialized treatment needed)"
            />
            {errors.reason && <p className="text-red-500 text-sm mt-1">{errors.reason}</p>}
          </div>

          {/* Diagnosis at Referral */}
          <div>
            <label className="block text-sm font-bold text-sky-900 mb-2">
              Diagnosis at Referral <span className="text-red-500">*</span>
            </label>
            <textarea
              value={referralData.diagnosisAtReferral}
              onChange={(e) => {
                setReferralData((prev) => ({ ...prev, diagnosisAtReferral: e.target.value }));
                setErrors((prev) => ({ ...prev, diagnosis: '' }));
              }}
              rows={3}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.diagnosis ? 'border-red-500' : 'border-sky-200'
                }`}
              placeholder="Current diagnosis and clinical findings"
            />
            {errors.diagnosis && <p className="text-red-500 text-sm mt-1">{errors.diagnosis}</p>}
          </div>

          {/* Condition at Referral */}
          <div>
            <label className="block text-sm font-bold text-sky-900 mb-2">
              Patient Condition at Referral <span className="text-red-500">*</span>
            </label>
            <textarea
              value={referralData.conditionAtReferral}
              onChange={(e) => {
                setReferralData((prev) => ({ ...prev, conditionAtReferral: e.target.value }));
                setErrors((prev) => ({ ...prev, condition: '' }));
              }}
              rows={2}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 ${errors.condition ? 'border-red-500' : 'border-sky-200'
                }`}
              placeholder="Current clinical status (e.g., Stable, Critical, Deteriorating)"
            />
            {errors.condition && <p className="text-red-500 text-sm mt-1">{errors.condition}</p>}
          </div>

          {/* Vital Signs at Referral */}
          <div>
            <label className="block text-sm font-bold text-sky-900 mb-2">
              Vital Signs at Referral (Optional)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Temp (°C)"
                value={vitalSigns.temperature}
                onChange={(e) =>
                  setVitalSigns((prev) => ({ ...prev, temperature: e.target.value }))
                }
                className="px-3 py-2 border border-sky-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <input
                type="text"
                placeholder="HR (bpm)"
                value={vitalSigns.hr}
                onChange={(e) => setVitalSigns((prev) => ({ ...prev, hr: e.target.value }))}
                className="px-3 py-2 border border-sky-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <input
                type="text"
                placeholder="RR (br/min)"
                value={vitalSigns.rr}
                onChange={(e) => setVitalSigns((prev) => ({ ...prev, rr: e.target.value }))}
                className="px-3 py-2 border border-sky-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <input
                type="text"
                placeholder="BP (mmHg)"
                value={vitalSigns.bp}
                onChange={(e) => setVitalSigns((prev) => ({ ...prev, bp: e.target.value }))}
                className="px-3 py-2 border border-sky-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <input
                type="text"
                placeholder="SpO2 (%)"
                value={vitalSigns.spo2}
                onChange={(e) => setVitalSigns((prev) => ({ ...prev, spo2: e.target.value }))}
                className="px-3 py-2 border border-sky-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <input
                type="text"
                placeholder="CRT (sec)"
                value={vitalSigns.crt}
                onChange={(e) => setVitalSigns((prev) => ({ ...prev, crt: e.target.value }))}
                className="px-3 py-2 border border-sky-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <input
                type="text"
                placeholder="Weight (kg)"
                value={vitalSigns.weight}
                onChange={(e) => setVitalSigns((prev) => ({ ...prev, weight: e.target.value }))}
                className="px-3 py-2 border border-sky-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Treatments Provided */}
          <div>
            <label className="block text-sm font-bold text-sky-900 mb-2">
              Treatments Provided
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={treatmentInput}
                onChange={(e) => setTreatmentInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTreatment()}
                placeholder="Enter treatment and press Add"
                className="flex-1 px-4 py-2 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={handleAddTreatment}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold"
              >
                Add
              </button>
            </div>
            {referralData.treatmentsProvided.length > 0 && (
              <div className="space-y-2">
                {referralData.treatmentsProvided.map((treatment, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-sky-50 px-3 py-2 rounded-lg"
                  >
                    <span className="text-sm text-sky-900">
                      {index + 1}. {treatment}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTreatment(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Investigations Performed */}
          <div>
            <label className="block text-sm font-bold text-sky-900 mb-2">
              Investigations Performed (Optional)
            </label>
            <textarea
              value={referralData.investigationsPerformed}
              onChange={(e) =>
                setReferralData((prev) => ({ ...prev, investigationsPerformed: e.target.value }))
              }
              rows={2}
              className="w-full px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Lab reports, imaging, etc."
            />
          </div>

          {/* Recommended Treatment */}
          <div>
            <label className="block text-sm font-bold text-sky-900 mb-2">
              Recommended Treatment (Optional)
            </label>
            <textarea
              value={referralData.recommendedTreatment}
              onChange={(e) =>
                setReferralData((prev) => ({ ...prev, recommendedTreatment: e.target.value }))
              }
              rows={2}
              className="w-full px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Suggested treatment at receiving hospital"
            />
          </div>

          {/* Clinical Summary */}
          <div>
            <label className="block text-sm font-bold text-sky-900 mb-2">
              Clinical Summary (Optional)
            </label>
            <textarea
              value={referralData.clinicalSummary}
              onChange={(e) =>
                setReferralData((prev) => ({ ...prev, clinicalSummary: e.target.value }))
              }
              rows={3}
              className="w-full px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Brief clinical summary of the case"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-6 py-3 border-2 border-sky-300 text-sky-700 rounded-lg hover:bg-sky-50 transition-all font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerateLetter}
            disabled={loading || generatingLetter}
            className="flex-1 bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white px-6 py-3 rounded-lg transition-all font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generatingLetter ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                Generating AI Letter...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Generate Referral Letter
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReferralForm;
