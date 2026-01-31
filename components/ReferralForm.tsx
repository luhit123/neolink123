import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, onSnapshot, query, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Patient, Institution, Unit, UserRole, ReferralDetails, VitalSigns, ProgressNote, Medication } from '../types';
import { generateReferralLetter } from '../utils/openaiService';

// Helper function to format clinical notes for display
const formatClinicalNotes = (notes: ProgressNote[]): string => {
  if (!notes || notes.length === 0) return 'No clinical notes recorded';

  return notes.slice(-5).map((note, idx) => {
    const date = new Date(note.date || note.timestamp || '').toLocaleDateString();
    const noteText = note.note || '';
    const vitals = note.vitals ? Object.entries(note.vitals)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ') : '';

    return `[${date}] ${noteText}${vitals ? ` | Vitals: ${vitals}` : ''}`;
  }).join('\n');
};

// Helper function to extract all treatments from clinical notes
const extractTreatmentsFromNotes = (notes: ProgressNote[]): string[] => {
  const treatments = new Set<string>();

  notes.forEach(note => {
    if (note.medications) {
      note.medications.forEach(med => {
        const treatment = `${med.name} ${med.dose}${med.route ? ` (${med.route})` : ''}${med.frequency ? ` - ${med.frequency}` : ''}`;
        treatments.add(treatment);
      });
    }
  });

  return Array.from(treatments);
};

// Helper function to get latest vitals from progress notes
const getLatestVitals = (notes: ProgressNote[]): VitalSigns => {
  const latestVitals: VitalSigns = {};

  // Go through notes from newest to oldest to get latest vitals
  const sortedNotes = [...notes].sort((a, b) =>
    new Date(b.date || b.timestamp || 0).getTime() - new Date(a.date || a.timestamp || 0).getTime()
  );

  for (const note of sortedNotes) {
    if (note.vitals) {
      if (!latestVitals.temperature && note.vitals.temperature) latestVitals.temperature = note.vitals.temperature;
      if (!latestVitals.hr && note.vitals.hr) latestVitals.hr = note.vitals.hr;
      if (!latestVitals.rr && note.vitals.rr) latestVitals.rr = note.vitals.rr;
      if (!latestVitals.bp && note.vitals.bp) latestVitals.bp = note.vitals.bp;
      if (!latestVitals.spo2 && note.vitals.spo2) latestVitals.spo2 = note.vitals.spo2;
      if (!latestVitals.crt && note.vitals.crt) latestVitals.crt = note.vitals.crt;
      if (!latestVitals.weight && note.vitals.weight) latestVitals.weight = note.vitals.weight;
    }

    // If all vitals are filled, stop searching
    if (latestVitals.temperature && latestVitals.hr && latestVitals.rr &&
        latestVitals.bp && latestVitals.spo2 && latestVitals.crt && latestVitals.weight) {
      break;
    }
  }

  return latestVitals;
};

// Helper function to generate clinical course summary from notes
const generateClinicalCourseSummary = (patient: Patient): string => {
  const parts: string[] = [];

  // Admission info
  parts.push(`Patient ${patient.name}, ${patient.age} ${patient.ageUnit} old ${patient.gender}, admitted on ${new Date(patient.admissionDate).toLocaleDateString()} with ${patient.diagnosis}.`);

  // Gestational age for neonates
  if (patient.gestationalAgeWeeks) {
    parts.push(`Gestational age: ${patient.gestationalAgeWeeks}${patient.gestationalAgeDays ? `+${patient.gestationalAgeDays}` : ''} weeks.`);
  }

  // Birth weight
  if (patient.birthWeight) {
    parts.push(`Birth weight: ${patient.birthWeight} kg.`);
  }

  // Key progress notes summary
  if (patient.progressNotes && patient.progressNotes.length > 0) {
    parts.push(`\nClinical Course (${patient.progressNotes.length} notes recorded):`);
    patient.progressNotes.slice(-3).forEach(note => {
      const date = new Date(note.date || note.timestamp || '').toLocaleDateString();
      if (note.note) {
        parts.push(`- [${date}] ${note.note.substring(0, 200)}${note.note.length > 200 ? '...' : ''}`);
      }
    });
  }

  return parts.join('\n');
};

interface ReferralFormProps {
  patient: Patient;
  currentInstitutionId: string;
  currentInstitutionName: string;
  userEmail: string;
  userRole: UserRole;
  userName: string;
  onClose: () => void;
  onSuccess: () => void;
  onShowReferrals?: () => void; // Navigate to Referral Network
}

const ReferralForm: React.FC<ReferralFormProps> = ({
  patient,
  currentInstitutionId,
  currentInstitutionName,
  userEmail,
  userRole,
  userName,
  onClose,
  onSuccess,
  onShowReferrals
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

  // Custom institution state
  const [showCustomInstitutionForm, setShowCustomInstitutionForm] = useState(false);
  const [customInstitution, setCustomInstitution] = useState({
    name: '',
    district: '',
    institutionType: '',
    phone: '',
    address: ''
  });

  // State for comprehensive patient history view
  const [showClinicalHistory, setShowClinicalHistory] = useState(false);

  // Auto-populate form with patient data on mount
  useEffect(() => {
    // Auto-populate vitals from latest progress notes
    if (patient.progressNotes && patient.progressNotes.length > 0) {
      const latestVitals = getLatestVitals(patient.progressNotes);
      setVitalSigns(prev => ({
        ...prev,
        ...latestVitals
      }));
    }

    // Auto-populate treatments from medications and progress notes
    const allTreatments: string[] = [];

    // Add active medications
    if (patient.medications) {
      patient.medications.filter(med => med.isActive !== false).forEach(med => {
        const treatment = `${med.name} ${med.dose}${med.route ? ` (${med.route})` : ''}${med.frequency ? ` - ${med.frequency}` : ''}`;
        allTreatments.push(treatment);
      });
    }

    // Add treatments from clinical notes
    if (patient.progressNotes) {
      const noteTreatments = extractTreatmentsFromNotes(patient.progressNotes);
      noteTreatments.forEach(t => {
        if (!allTreatments.includes(t)) {
          allTreatments.push(t);
        }
      });
    }

    if (allTreatments.length > 0) {
      setReferralData(prev => ({
        ...prev,
        treatmentsProvided: allTreatments
      }));
    }

    // Generate clinical summary from patient history
    const clinicalSummary = generateClinicalCourseSummary(patient);
    setReferralData(prev => ({
      ...prev,
      clinicalSummary
    }));

  }, [patient]);

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

  // Handle adding custom institution
  const handleAddCustomInstitution = () => {
    if (!customInstitution.name.trim()) {
      setErrors(prev => ({ ...prev, customInstitutionName: 'Institution name is required' }));
      return;
    }

    // Create a pseudo-institution object for the referral
    const customInst: Institution = {
      id: `custom_${Date.now()}`,
      name: customInstitution.name.trim(),
      district: customInstitution.district.trim() || 'Not specified',
      institutionType: customInstitution.institutionType.trim() || 'External Institution',
      adminEmail: '',
      facilities: [],
      isActive: true,
      isCustom: true, // Flag to identify custom institutions
      phone: customInstitution.phone.trim(),
      address: customInstitution.address.trim()
    } as Institution & { isCustom: boolean; phone?: string; address?: string };

    setSelectedInstitution(customInst);
    setShowCustomInstitutionForm(false);
    setShowInstitutionDropdown(false);
    setSearchTerm('');
    setErrors(prev => ({ ...prev, institution: '', customInstitutionName: '' }));
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



  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdReferralInfo, setCreatedReferralInfo] = useState<{toName: string; patientName: string} | null>(null);

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

      // Show success modal with tracking info
      setCreatedReferralInfo({
        toName: selectedInstitution.name,
        patientName: patient.name
      });
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error creating referral:', error);
      alert(
        `Failed to send referral: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setLoading(false);
    }
  };

  // Success Modal - shows after referral is created
  if (showSuccessModal && createdReferralInfo) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          {/* Success Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-green-500 text-white p-6 rounded-t-2xl text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold">Referral Sent!</h2>
            <p className="text-emerald-100 text-sm mt-1">
              Patient has been successfully referred
            </p>
          </div>

          {/* Info */}
          <div className="p-6 space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Patient</p>
                  <p className="font-semibold text-slate-900">{createdReferralInfo.patientName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Referred To</p>
                  <p className="font-semibold text-slate-900">{createdReferralInfo.toName}</p>
                </div>
              </div>
            </div>

            {/* Status Info */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-amber-800 text-sm">Awaiting Response</p>
                  <p className="text-xs text-amber-700 mt-1">
                    The receiving institution has been notified. Track this referral's status in the <strong>Referral Network</strong> dashboard.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-blue-800 text-sm">How to Track</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Go to <strong>More → Referral Network</strong> to view all your outgoing referrals and their current status.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 pt-0 flex gap-3">
            <button
              onClick={() => {
                setShowSuccessModal(false);
                onSuccess();
                onClose();
              }}
              className="flex-1 py-3 border-2 border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all"
            >
              Done
            </button>
            {onShowReferrals && (
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  onSuccess();
                  onClose();
                  onShowReferrals();
                }}
                className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-600 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                View in Referral Network
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

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

                {/* Complete Medications List */}
                {patient.medications && patient.medications.filter(m => m.isActive !== false).length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Current Medications ({patient.medications.filter(m => m.isActive !== false).length})
                    </h4>
                    <div className="bg-green-50 border border-green-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-green-100">
                          <tr>
                            <th className="text-left px-3 py-2 text-green-800 font-semibold">Medication</th>
                            <th className="text-left px-3 py-2 text-green-800 font-semibold">Dose</th>
                            <th className="text-left px-3 py-2 text-green-800 font-semibold">Route</th>
                            <th className="text-left px-3 py-2 text-green-800 font-semibold">Frequency</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-green-100">
                          {patient.medications.filter(m => m.isActive !== false).map((med, idx) => (
                            <tr key={idx}>
                              <td className="px-3 py-2 font-medium text-slate-800">{med.name}</td>
                              <td className="px-3 py-2 text-slate-600">{med.dose}</td>
                              <td className="px-3 py-2 text-slate-600">{med.route || '-'}</td>
                              <td className="px-3 py-2 text-slate-600">{med.frequency || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recent Clinical Notes Summary */}
                {patient.progressNotes && patient.progressNotes.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      Clinical Course Summary ({patient.progressNotes.length} notes)
                    </h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 max-h-48 overflow-y-auto">
                      {[...patient.progressNotes].reverse().slice(0, 3).map((note, idx) => (
                        <div key={idx} className="border-l-2 border-blue-400 pl-3">
                          <p className="text-xs font-bold text-slate-500">
                            {new Date(note.date || note.timestamp || '').toLocaleString()}
                            {note.addedBy && <span className="text-slate-400 ml-2">by {note.addedBy}</span>}
                          </p>
                          {note.note && <p className="text-sm text-slate-700 mt-1">{note.note}</p>}
                          {note.vitals && Object.values(note.vitals).some(v => v) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(note.vitals).filter(([_, v]) => v).map(([key, val]) => (
                                <span key={key} className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                                  {key}: {val}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Summary Box */}
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-sm font-bold text-slate-900 uppercase">AI-Generated Comprehensive Summary</h4>
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">Generated by AI</span>

                    {editingLetter ? (
                      <button onClick={() => setEditingLetter(false)} className="ml-auto text-xs text-blue-600 hover:underline">Done Editing</button>
                    ) : (
                      <button onClick={() => setEditingLetter(true)} className="ml-auto text-xs text-blue-600 hover:underline">Edit Summary</button>
                    )}
                  </div>

                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 mb-2">
                    <p className="text-xs text-blue-700 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      This summary analyzes {patient.progressNotes?.length || 0} clinical notes and {patient.medications?.filter(m => m.isActive !== false).length || 0} medications to provide a comprehensive overview.
                    </p>
                  </div>

                  {editingLetter ? (
                    <textarea
                      value={generatedLetter}
                      onChange={(e) => setGeneratedLetter(e.target.value)}
                      className="w-full p-4 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm leading-relaxed"
                      rows={8}
                    />
                  ) : (
                    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 text-slate-800 text-sm leading-relaxed text-justify whitespace-pre-line">
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

            {/* Birth Details for Neonates */}
            {(patient.birthWeight || patient.gestationalAgeWeeks) && (
              <div className="mt-3 pt-3 border-t border-sky-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {patient.birthWeight && (
                  <div>
                    <span className="text-sky-600">Birth Weight:</span>
                    <p className="font-semibold text-sky-900">{patient.birthWeight} kg</p>
                  </div>
                )}
                {patient.gestationalAgeWeeks && (
                  <div>
                    <span className="text-sky-600">Gestational Age:</span>
                    <p className="font-semibold text-sky-900">{patient.gestationalAgeWeeks}{patient.gestationalAgeDays ? `+${patient.gestationalAgeDays}` : ''} weeks</p>
                  </div>
                )}
                {patient.modeOfDelivery && (
                  <div>
                    <span className="text-sky-600">Mode of Delivery:</span>
                    <p className="font-semibold text-sky-900">{patient.modeOfDelivery}</p>
                  </div>
                )}
                {patient.admissionDateTime && (
                  <div>
                    <span className="text-sky-600">Admission:</span>
                    <p className="font-semibold text-sky-900">{new Date(patient.admissionDateTime).toLocaleString()}</p>
                  </div>
                )}
              </div>
            )}

            {/* Toggle Clinical History View */}
            <button
              type="button"
              onClick={() => setShowClinicalHistory(!showClinicalHistory)}
              className="mt-3 text-sm text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1"
            >
              <svg className={`w-4 h-4 transform transition-transform ${showClinicalHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {showClinicalHistory ? 'Hide' : 'View'} Clinical History ({patient.progressNotes?.length || 0} notes, {patient.medications?.filter(m => m.isActive !== false).length || 0} active medications)
            </button>
          </div>

          {/* Clinical History Section (Collapsible) */}
          {showClinicalHistory && (
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-700 text-white px-4 py-3">
                <h3 className="font-bold flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Complete Clinical History
                </h3>
                <p className="text-slate-300 text-xs">This data will be included in the referral ticket</p>
              </div>

              <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {/* Active Medications */}
                {patient.medications && patient.medications.filter(m => m.isActive !== false).length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Active Medications ({patient.medications.filter(m => m.isActive !== false).length})
                    </h4>
                    <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
                      {patient.medications.filter(m => m.isActive !== false).map((med, idx) => (
                        <div key={idx} className="px-3 py-2 flex justify-between items-center">
                          <div>
                            <span className="font-semibold text-slate-800">{med.name}</span>
                            <span className="text-slate-600 ml-2">{med.dose}</span>
                          </div>
                          <div className="text-sm text-slate-500">
                            {med.route && <span className="bg-slate-100 px-2 py-0.5 rounded mr-1">{med.route}</span>}
                            {med.frequency && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{med.frequency}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Progress Notes */}
                {patient.progressNotes && patient.progressNotes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      Recent Clinical Notes (Last 5)
                    </h4>
                    <div className="space-y-2">
                      {[...patient.progressNotes].reverse().slice(0, 5).map((note, idx) => (
                        <div key={idx} className="bg-white rounded-lg border border-slate-200 p-3">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-slate-500">
                              {new Date(note.date || note.timestamp || '').toLocaleString()}
                            </span>
                            {note.addedBy && (
                              <span className="text-xs text-slate-400">by {note.addedBy}</span>
                            )}
                          </div>
                          {note.note && (
                            <p className="text-sm text-slate-700 mb-2">{note.note}</p>
                          )}
                          {note.vitals && Object.values(note.vitals).some(v => v) && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {note.vitals.temperature && (
                                <span className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded">Temp: {note.vitals.temperature}°C</span>
                              )}
                              {note.vitals.hr && (
                                <span className="text-xs bg-pink-50 text-pink-700 px-2 py-1 rounded">HR: {note.vitals.hr}</span>
                              )}
                              {note.vitals.rr && (
                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">RR: {note.vitals.rr}</span>
                              )}
                              {note.vitals.spo2 && (
                                <span className="text-xs bg-cyan-50 text-cyan-700 px-2 py-1 rounded">SpO2: {note.vitals.spo2}%</span>
                              )}
                              {note.vitals.bp && (
                                <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">BP: {note.vitals.bp}</span>
                              )}
                            </div>
                          )}
                          {note.examination && (
                            <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded">
                              {note.examination.cns && <p><strong>CNS:</strong> {note.examination.cns}</p>}
                              {note.examination.cvs && <p><strong>CVS:</strong> {note.examination.cvs}</p>}
                              {note.examination.chest && <p><strong>Chest:</strong> {note.examination.chest}</p>}
                              {note.examination.perAbdomen && <p><strong>Abdomen:</strong> {note.examination.perAbdomen}</p>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Indication for Admission */}
                {patient.indicationsForAdmission && patient.indicationsForAdmission.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                      Indications for Admission
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {patient.indicationsForAdmission.map((ind, idx) => (
                        <span key={idx} className="bg-amber-100 text-amber-800 text-sm px-3 py-1 rounded-full">{ind}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Data Message */}
                {(!patient.progressNotes || patient.progressNotes.length === 0) && (!patient.medications || patient.medications.length === 0) && (
                  <div className="text-center py-8 text-slate-500">
                    <svg className="w-12 h-12 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>No clinical history recorded yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

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
              {showInstitutionDropdown && (
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
                      className="w-full text-left px-4 py-3 hover:bg-sky-50 transition-all border-b border-sky-100"
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

                  {/* Add Custom Institution Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomInstitutionForm(true);
                      setShowInstitutionDropdown(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-all border-t-2 border-amber-200 bg-amber-50/50"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <div>
                        <p className="font-semibold text-amber-800">Institution not listed?</p>
                        <p className="text-sm text-amber-600">Click to add a custom institution</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
            {errors.institution && <p className="text-red-500 text-sm mt-1">{errors.institution}</p>}
            {selectedInstitution && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-green-900">
                      Selected: {selectedInstitution.name}
                      {(selectedInstitution as any).isCustom && (
                        <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">Custom</span>
                      )}
                    </p>
                    <p className="text-xs text-green-700">
                      {selectedInstitution.district} • {selectedInstitution.institutionType}
                    </p>
                    {(selectedInstitution as any).phone && (
                      <p className="text-xs text-green-600 mt-1">Phone: {(selectedInstitution as any).phone}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedInstitution(null)}
                    className="text-green-600 hover:text-green-800 p-1"
                    title="Clear selection"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Custom Institution Form Modal */}
            {showCustomInstitutionForm && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <h3 className="text-lg font-bold">Add Custom Institution</h3>
                      </div>
                      <button
                        onClick={() => setShowCustomInstitutionForm(false)}
                        className="text-white hover:bg-white/20 p-1 rounded-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-amber-100 text-sm mt-1">
                      Add details for an institution not in our system
                    </p>
                  </div>

                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Institution Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={customInstitution.name}
                        onChange={(e) => setCustomInstitution(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., City General Hospital"
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                          errors.customInstitutionName ? 'border-red-500' : 'border-slate-300'
                        }`}
                      />
                      {errors.customInstitutionName && (
                        <p className="text-red-500 text-xs mt-1">{errors.customInstitutionName}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">District</label>
                        <input
                          type="text"
                          value={customInstitution.district}
                          onChange={(e) => setCustomInstitution(prev => ({ ...prev, district: e.target.value }))}
                          placeholder="e.g., Kamrup"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Type</label>
                        <select
                          value={customInstitution.institutionType}
                          onChange={(e) => setCustomInstitution(prev => ({ ...prev, institutionType: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="">Select type</option>
                          <option value="Government Hospital">Government Hospital</option>
                          <option value="Medical College">Medical College</option>
                          <option value="Private Hospital">Private Hospital</option>
                          <option value="District Hospital">District Hospital</option>
                          <option value="Community Health Center">Community Health Center</option>
                          <option value="Primary Health Center">Primary Health Center</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={customInstitution.phone}
                        onChange={(e) => setCustomInstitution(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="e.g., 0361-2345678"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Address</label>
                      <textarea
                        value={customInstitution.address}
                        onChange={(e) => setCustomInstitution(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Full address of the institution"
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs text-amber-700">
                        <strong>Note:</strong> This institution will only be used for this referral and won't be added to the system permanently.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-200 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCustomInstitutionForm(false)}
                      className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCustomInstitution}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 font-semibold"
                    >
                      Add Institution
                    </button>
                  </div>
                </div>
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
