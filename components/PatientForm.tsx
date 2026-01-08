import React, { useState, useEffect } from 'react';
import { Patient, Unit, AgeUnit, UserRole, ProgressNote, AdmissionType, Category, PlaceOfDelivery, ModeOfTransport, ModeOfDelivery, AdmissionIndication } from '../types';
import { XIcon, PlusIcon, TrashIcon } from './common/Icons';
import ProgressNoteForm from './ProgressNoteForm';
import ProgressNoteDisplay from './ProgressNoteDisplay';
import ReferralForm from './ReferralForm';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { calculateAgeFromBirthDate, calculateAgeAtDate } from '../utils/ageCalculator';

interface PatientFormProps {
  patientToEdit?: Patient | null;
  onSave: (patient: Patient) => void;
  onClose: () => void;
  userRole: UserRole;
  defaultUnit?: Unit;
  institutionId: string;
  institutionName: string;
  userEmail: string;
  userName?: string;
  availableUnits?: Unit[];
}

const PatientForm: React.FC<PatientFormProps> = ({
  patientToEdit,
  onSave,
  onClose,
  userRole,
  defaultUnit,
  institutionId,
  institutionName,
  userEmail,
  userName,
  availableUnits
}) => {
  const isNurse = userRole === UserRole.Nurse;
  const isDoctor = userRole === UserRole.Doctor || userRole === UserRole.Admin;

  const [showReferralForm, setShowReferralForm] = useState(false);
  const [patient, setPatient] = useState<Patient>(
    patientToEdit || {
      id: '',
      name: '',
      age: 0,
      ageUnit: AgeUnit.Days,
      gender: 'Male',
      admissionDate: new Date().toISOString(),
      admissionDateTime: new Date().toISOString(), // Default to current time
      diagnosis: '',
      progressNotes: [], // Start with empty array - doctor will add comprehensive notes
      outcome: 'In Progress',
      unit: defaultUnit || Unit.NICU,
      admissionType: AdmissionType.Inborn,
      category: Category.General,
      institutionId,
      institutionName,
      isDraft: isNurse,
      createdBy: userRole,
      createdByEmail: userEmail
    }
  );

  const [newNote, setNewNote] = useState('');
  const [showProgressNoteForm, setShowProgressNoteForm] = useState(false);
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);

  // Admission Indications
  const [admissionIndications, setAdmissionIndications] = useState<AdmissionIndication[]>([]);
  const [loadingIndications, setLoadingIndications] = useState(false);

  // Section expansion states
  const [expandedSections, setExpandedSections] = useState({
    demographics: true,
    admissionDetails: true, // Now includes Birth Details
    dischargeDetails: false
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    if (patientToEdit) {
      setPatient(patientToEdit);
    }
  }, [patientToEdit]);

  // Update unit if defaultUnit changes (for new patients)
  useEffect(() => {
    if (!patientToEdit && defaultUnit && patient.unit !== defaultUnit) {
      console.log('🔄 Switching form unit to:', defaultUnit);
      setPatient(prev => ({ ...prev, unit: defaultUnit }));
    }
  }, [defaultUnit, patientToEdit]);

  // Prefill "Baby of " for NICU/SNCU if name is empty
  useEffect(() => {
    if ((patient.unit === Unit.NICU || patient.unit === Unit.SNCU) && !patient.name && !patientToEdit) {
      setPatient(prev => ({ ...prev, name: 'Baby of ' }));
    }
  }, [patient.unit, patientToEdit]);

  // Fetch admission indications based on unit type
  useEffect(() => {
    const fetchAdmissionIndications = async () => {
      setLoadingIndications(true);
      try {
        const indicationsRef = collection(db, 'admissionIndications');

        // Try query with array-contains first
        try {
          const q = query(
            indicationsRef,
            where('isActive', '==', true),
            where('applicableUnits', 'array-contains', patient.unit),
            orderBy('order', 'asc')
          );
          const snapshot = await getDocs(q);
          const indications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdmissionIndication));
          console.log('✅ Fetched', indications.length, 'indications for', patient.unit);
          setAdmissionIndications(indications);
        } catch (indexError: any) {
          console.warn('⚠️ Array-contains query failed, using fallback. Error:', indexError.message);

          // Fallback: Fetch all indications and filter client-side to avoid index issues
          const fallbackQuery = query(
            indicationsRef,
            orderBy('order', 'asc')
          );
          const snapshot = await getDocs(fallbackQuery);
          const allIndications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdmissionIndication));

          // Filter client-side for the current unit and active status
          const filtered = allIndications.filter(ind => ind.isActive && ind.applicableUnits?.includes(patient.unit));
          console.log('✅ Fallback: Fetched', filtered.length, 'indications for', patient.unit, 'from', allIndications.length, 'total');
          setAdmissionIndications(filtered);
        }
      } catch (error: any) {
        console.error('❌ Error fetching admission indications:', error);
        console.error('Error details:', error.message);

        // If collection doesn't exist or other error, show empty
        setAdmissionIndications([]);
      } finally {
        setLoadingIndications(false);
      }
    };

    fetchAdmissionIndications();
  }, [patient.unit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPatient(prev => {
      let processedValue: any = value;

      // Handle number fields
      if (['age', 'birthWeight', 'weightOnAdmission', 'weightOnDischarge', 'ageOnAdmission', 'ageOnDischarge'].includes(name)) {
        processedValue = value === '' ? undefined : parseFloat(value);
      }

      // Handle datetime fields - convert to ISO string
      if (['dateOfBirth', 'admissionDateTime', 'dischargeDateTime'].includes(name)) {
        processedValue = value ? new Date(value).toISOString() : '';
      }

      const updated = { ...prev, [name]: processedValue };

      // Auto-calculate age from date of birth
      if (name === 'dateOfBirth' && processedValue) {
        const calculatedAge = calculateAgeFromBirthDate(processedValue);
        updated.age = calculatedAge.age;
        updated.ageUnit = calculatedAge.ageUnit;
        console.log('✅ Auto-calculated age:', calculatedAge.age, calculatedAge.ageUnit);
      }

      // Auto-fill Mother's Name from "Baby of ..."
      if (name === 'name' && typeof processedValue === 'string') {
        const babyOfPrefix = 'Baby of ';
        if (processedValue.toLowerCase().startsWith(babyOfPrefix.toLowerCase())) {
          const extractedMotherName = processedValue.slice(babyOfPrefix.length);
          // Update even if empty string (to clear it if user backspaces to just "Baby of ")
          updated.motherName = extractedMotherName;
        }
      }

      // Auto-calculate age on admission from birth date and admission datetime
      if (name === 'admissionDateTime' && processedValue && prev.dateOfBirth) {
        const ageAtAdmission = calculateAgeAtDate(prev.dateOfBirth, processedValue);
        updated.ageOnAdmission = ageAtAdmission.age;
        updated.ageOnAdmissionUnit = ageAtAdmission.ageUnit;
        console.log('✅ Auto-calculated age on admission:', ageAtAdmission.age, ageAtAdmission.ageUnit);
      }

      // Auto-calculate age on discharge from birth date and discharge datetime
      if (name === 'dischargeDateTime' && processedValue && prev.dateOfBirth) {
        const ageAtDischarge = calculateAgeAtDate(prev.dateOfBirth, processedValue);
        updated.ageOnDischarge = ageAtDischarge.age;
        updated.ageOnDischargeUnit = ageAtDischarge.ageUnit;
        console.log('✅ Auto-calculated age on discharge:', ageAtDischarge.age, ageAtDischarge.ageUnit);
      }

      // Handle Step Down logic for both NICU and PICU
      if (name === 'outcome' && value === 'Step Down') {
        updated.stepDownDate = new Date().toISOString();
        updated.stepDownFrom = prev.unit; // Can be NICU or PICU
        updated.isStepDown = true;
        updated.outcome = 'Step Down';
      }

      // Sync admissionDateTime with admissionDate for backward compatibility
      if (name === 'admissionDateTime') {
        updated.admissionDate = processedValue;
      }

      // Sync dischargeDateTime with releaseDate for backward compatibility
      if (name === 'dischargeDateTime') {
        updated.releaseDate = processedValue;
      }

      // Auto-fill place of delivery for Inborn admissions
      if (name === 'admissionType' && value === AdmissionType.Inborn) {
        updated.placeOfDelivery = PlaceOfDelivery.GovernmentHospital;
        updated.placeOfDeliveryName = institutionName;
        // Clear referring hospital/district for inborn
        updated.referringHospital = '';
        updated.referringDistrict = '';
      }

      return updated;
    });
  };

  const handleNoteChange = (index: number, value: string) => {
    const updatedNotes = [...patient.progressNotes];
    updatedNotes[index].note = value;
    setPatient(prev => ({ ...prev, progressNotes: updatedNotes }));
  };

  const handleIndicationToggle = (indicationName: string) => {
    setPatient(prev => {
      const currentIndications = prev.indicationsForAdmission || [];
      const isSelected = currentIndications.includes(indicationName);

      if (isSelected) {
        // Remove indication
        return {
          ...prev,
          indicationsForAdmission: currentIndications.filter(i => i !== indicationName)
        };
      } else {
        // Add indication
        return {
          ...prev,
          indicationsForAdmission: [...currentIndications, indicationName]
        };
      }
    });
  };

  const handleSaveProgressNote = (note: ProgressNote) => {
    console.log('🚀 ========================================');
    console.log('🚀 handleSaveProgressNote CALLED');
    console.log('🚀 Received note:', JSON.stringify(note, null, 2));
    console.log('🚀 editingNoteIndex:', editingNoteIndex);
    console.log('🚀 Current patient.progressNotes length:', patient.progressNotes.length);
    console.log('🚀 Current patient.progressNotes:', JSON.stringify(patient.progressNotes, null, 2));

    if (editingNoteIndex !== null) {
      // Update existing note
      console.log('🚀 MODE: Updating existing note at index', editingNoteIndex);
      const updatedNotes = [...patient.progressNotes];
      updatedNotes[editingNoteIndex] = note;
      console.log('🚀 Updated notes array:', JSON.stringify(updatedNotes, null, 2));
      setPatient(prev => ({ ...prev, progressNotes: updatedNotes }));
    } else {
      // Add new note
      console.log('🚀 MODE: Adding new note');
      console.log('🚀 Adding new note to existing:', JSON.stringify(patient.progressNotes, null, 2));
      setPatient(prev => {
        const newNotes = [...prev.progressNotes, note];
        console.log('🚀 New notes array after add (length:', newNotes.length, '):', JSON.stringify(newNotes, null, 2));
        return {
          ...prev,
          progressNotes: newNotes
        };
      });
    }

    console.log('🚀 Setting showProgressNoteForm to FALSE');
    setShowProgressNoteForm(false);
    console.log('🚀 Setting editingNoteIndex to NULL');
    setEditingNoteIndex(null);
    console.log('🚀 handleSaveProgressNote COMPLETED');
    console.log('🚀 ========================================');
  };

  const handleAddNewProgressNote = () => {
    setEditingNoteIndex(null);
    setShowProgressNoteForm(true);
  };

  const handleEditNote = (index: number) => {
    setEditingNoteIndex(index);
    setShowProgressNoteForm(true);
  };

  const addNote = () => {
    setPatient(prev => ({
      ...prev,
      progressNotes: [...prev.progressNotes, { date: new Date().toISOString(), note: '' }]
    }));
  };

  const removeNote = (index: number) => {
    if (patient.progressNotes.length > 1) {
      const updatedNotes = patient.progressNotes.filter((_, i) => i !== index);
      setPatient(prev => ({ ...prev, progressNotes: updatedNotes }));
    }
  }


  const handleSubmit = (e: React.FormEvent, saveAsDraft: boolean = false) => {
    console.log('💾 ========================================');
    console.log('💾 PatientForm handleSubmit CALLED');
    console.log('💾 Event type:', e.type);
    console.log('💾 saveAsDraft:', saveAsDraft);
    e.preventDefault();
    console.log('💾 preventDefault called on form submission');

    const updatedPatient = {
      ...patient,
      id: patient.id || Date.now().toString(),
      isDraft: saveAsDraft,
      lastUpdatedBy: userRole,
      lastUpdatedByEmail: userEmail,
      lastEditedAt: new Date().toISOString(),
      institutionId,
      institutionName
    };
    console.log('💾 updatedPatient.progressNotes (length:', updatedPatient.progressNotes.length, '):', JSON.stringify(updatedPatient.progressNotes, null, 2));
    console.log('💾 Full patient object keys:', Object.keys(updatedPatient));
    console.log('💾 About to call onSave with updatedPatient');
    onSave(updatedPatient);
    console.log('💾 onSave completed');
    console.log('💾 ========================================');
  };

  const handleSaveAsDraft = (e: React.FormEvent) => {
    handleSubmit(e, true);
  };

  const handleSaveComplete = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate indications for NICU/SNCU if no diagnosis
    if ((patient.unit === Unit.NICU || patient.unit === Unit.SNCU) && !isNurse) {
      if (!patient.diagnosis && (!patient.indicationsForAdmission || patient.indicationsForAdmission.length === 0)) {
        alert('Please select at least one indication for admission or enter a diagnosis');
        return;
      }
    }

    handleSubmit(e, false);
  };

  const canEditSensitiveFields = userRole === UserRole.Admin || userRole === UserRole.Doctor;

  return (
    <div className="w-full min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 p-6 mb-6 sticky top-0 z-10">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{patientToEdit ? 'Edit Patient Record' : 'Add New Patient'}</h1>
              {isNurse && <p className="text-sm text-blue-400">Enter basic patient information. Doctor will complete the diagnosis.</p>}
              {patient.isDraft && isDoctor && <p className="text-sm text-yellow-400">⚠️ Draft record - Please complete diagnosis and notes</p>}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors font-semibold flex items-center gap-2"
            >
              <XIcon className="w-5 h-5" />
              Close
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveComplete} className="space-y-6">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 flex-grow">

            {/* Admission & Birth Details Section */}
            <div className="bg-gradient-to-r from-green-900/30 to-teal-900/30 rounded-xl border border-green-500/30 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('admissionDetails')}
                className="w-full px-4 py-3 flex items-center justify-between bg-green-900/50 hover:bg-green-900/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="text-lg font-bold text-green-200">Admission & Birth Details</h3>
                </div>
                <svg className={`w-5 h-5 text-green-400 transition-transform ${expandedSections.admissionDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedSections.admissionDetails && (
                <div className="p-4 space-y-6">
                  {/* 1. Admission Context */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(patient.unit === Unit.NICU || patient.unit === Unit.SNCU) && (
                      <div>
                        <label htmlFor="admissionType" className="block text-sm font-medium text-slate-300 mb-1">
                          Type of Admission <span className="text-red-400">*</span>
                        </label>
                        <select
                          name="admissionType"
                          id="admissionType"
                          value={patient.admissionType || ''}
                          onChange={handleChange}
                          required
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-transparent"
                        >
                          <option value="">Select Admission Type</option>
                          {Object.values(AdmissionType).map(at => <option key={at} value={at}>{at}</option>)}
                        </select>
                        {patient.admissionType === AdmissionType.Inborn && (
                          <p className="text-xs text-green-400 mt-1">
                            ✓ Place of delivery will be set to: {institutionName}
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <label htmlFor="admissionDateTime" className="block text-sm font-medium text-slate-300 mb-1">Date and Time of Admission <span className="text-red-400">*</span></label>
                      <input type="datetime-local" name="admissionDateTime" id="admissionDateTime" value={patient.admissionDateTime ? patient.admissionDateTime.slice(0, 16) : patient.admissionDate.slice(0, 16)} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-transparent" />
                    </div>
                  </div>

                  <hr className="border-slate-700/50" />

                  {/* 2. Birth & Weight Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(patient.unit === Unit.NICU || patient.unit === Unit.SNCU) && (
                      <div>
                        <label htmlFor="dateOfBirth" className="block text-sm font-medium text-slate-300 mb-1">Date and Time of Birth</label>
                        <input type="datetime-local" name="dateOfBirth" id="dateOfBirth" value={patient.dateOfBirth ? patient.dateOfBirth.slice(0, 16) : ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-transparent" />
                      </div>
                    )}
                    <div>
                      <label htmlFor="age" className="block text-sm font-medium text-slate-300 mb-1">Current Age <span className="text-red-400">*</span></label>
                      <div className="flex gap-2">
                        <input type="number" name="age" id="age" value={patient.age} onChange={handleChange} required min="0" className="w-2/3 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-transparent" />
                        <select name="ageUnit" id="ageUnit" value={patient.ageUnit} onChange={handleChange} required className="w-1/3 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-transparent text-sm">
                          {Object.values(AgeUnit).map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(patient.unit === Unit.NICU || patient.unit === Unit.SNCU) ? (
                      <div>
                        <label htmlFor="birthWeight" className="block text-sm font-medium text-slate-300 mb-1">Birth Weight (Kg)</label>
                        <input type="number" name="birthWeight" id="birthWeight" value={patient.birthWeight || ''} onChange={handleChange} step="0.001" min="0" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-transparent" placeholder="e.g., 2.500" />
                      </div>
                    ) : <div></div>}
                    <div>
                      <label htmlFor="weightOnAdmission" className="block text-sm font-medium text-slate-300 mb-1">Weight on Admission (Kg)</label>
                      <input type="number" name="weightOnAdmission" id="weightOnAdmission" value={patient.weightOnAdmission || ''} onChange={handleChange} step="0.001" min="0" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-transparent" placeholder="e.g., 2.500" />
                    </div>
                  </div>

                  <hr className="border-slate-700/50" />

                  {/* 3. Delivery Details (NICU Only) */}
                  {(patient.unit === Unit.NICU || patient.unit === Unit.SNCU) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="modeOfDelivery" className="block text-sm font-medium text-slate-300 mb-1">Mode of Delivery</label>
                        <select name="modeOfDelivery" id="modeOfDelivery" value={patient.modeOfDelivery || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-transparent">
                          <option value="">Select Mode</option>
                          {Object.values(ModeOfDelivery).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="placeOfDelivery" className="block text-sm font-medium text-slate-300 mb-1">
                          Place of Delivery {patient.admissionType === AdmissionType.Inborn && <span className="text-xs text-green-400">(Auto-filled)</span>}
                        </label>
                        <select
                          name="placeOfDelivery"
                          id="placeOfDelivery"
                          value={patient.placeOfDelivery || ''}
                          onChange={handleChange}
                          disabled={patient.admissionType === AdmissionType.Inborn}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <option value="">Select Place</option>
                          {Object.values(PlaceOfDelivery).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {(patient.placeOfDelivery === PlaceOfDelivery.PrivateHospital || patient.placeOfDelivery === PlaceOfDelivery.GovernmentHospital) && (
                    <div>
                      <label htmlFor="placeOfDeliveryName" className="block text-sm font-medium text-slate-300 mb-1">
                        Hospital Name {patient.admissionType === AdmissionType.Inborn && <span className="text-xs text-green-400">(Auto-filled)</span>}
                      </label>
                      <input
                        type="text"
                        name="placeOfDeliveryName"
                        id="placeOfDeliveryName"
                        value={patient.placeOfDeliveryName || ''}
                        onChange={handleChange}
                        disabled={patient.admissionType === AdmissionType.Inborn}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                        placeholder="Enter hospital name"
                      />
                    </div>
                  )}


                  {/* 4. Transport & Referral */}
                  {(patient.unit === Unit.NICU || patient.unit === Unit.SNCU) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="modeOfTransport" className="block text-sm font-medium text-slate-300 mb-1">Mode of Transport</label>
                        <select name="modeOfTransport" id="modeOfTransport" value={patient.modeOfTransport || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-transparent">
                          <option value="">Select Mode</option>
                          {Object.values(ModeOfTransport).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>

                      {(patient.admissionType === AdmissionType.OutbornHealthFacility || patient.admissionType === AdmissionType.OutbornCommunity) && (
                        <div className="space-y-4 md:col-span-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
                          <div>
                            <label htmlFor="referringHospital" className="block text-sm font-medium text-slate-300 mb-1">Referred From (Hospital/Facility)</label>
                            <input type="text" name="referringHospital" id="referringHospital" value={patient.referringHospital || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-transparent" placeholder="Name of referring hospital or facility" />
                          </div>
                          <div>
                            <label htmlFor="referringDistrict" className="block text-sm font-medium text-slate-300 mb-1">Referring District</label>
                            <input type="text" name="referringDistrict" id="referringDistrict" value={patient.referringDistrict || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-green-400 focus:border-transparent" placeholder="District name" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Administrative & Demographic Information Section */}
            <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 rounded-xl border border-blue-500/30 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('demographics')}
                className="w-full px-4 py-3 flex items-center justify-between bg-blue-900/50 hover:bg-blue-900/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h3 className="text-lg font-bold text-blue-200">Administrative & Demographic Information</h3>
                </div>
                <svg className={`w-5 h-5 text-blue-400 transition-transform ${expandedSections.demographics ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedSections.demographics && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="sncuRegNo" className="block text-sm font-medium text-slate-300 mb-1">SNCU Reg. No.</label>
                      <input type="text" name="sncuRegNo" id="sncuRegNo" value={patient.sncuRegNo || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent" placeholder="e.g., SNCU/2024/001" />
                    </div>
                    <div>
                      <label htmlFor="mctsNo" className="block text-sm font-medium text-slate-300 mb-1">MCTS No.</label>
                      <input type="text" name="mctsNo" id="mctsNo" value={patient.mctsNo || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent" placeholder="Mother & Child Tracking System Number" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">Baby's Name <span className="text-red-400">*</span></label>
                      <input type="text" name="name" id="name" value={patient.name} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent" placeholder="Full name of the baby" />
                    </div>
                    <div>
                      <label htmlFor="unit" className="block text-sm font-medium text-slate-300 mb-1">Unit <span className="text-red-400">*</span></label>
                      <select name="unit" id="unit" value={patient.unit} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed" disabled={!canEditSensitiveFields}>
                        {(availableUnits || Object.values(Unit)).map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="motherName" className="block text-sm font-medium text-slate-300 mb-1">Mother's Name</label>
                      <input type="text" name="motherName" id="motherName" value={patient.motherName || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent" placeholder="Baby of (Mother's Name)" />
                    </div>
                    <div>
                      <label htmlFor="fatherName" className="block text-sm font-medium text-slate-300 mb-1">Father's Name</label>
                      <input type="text" name="fatherName" id="fatherName" value={patient.fatherName || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent" placeholder="Father's full name" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="gender" className="block text-sm font-medium text-slate-300 mb-1">Sex <span className="text-red-400">*</span></label>
                      <select name="gender" id="gender" value={patient.gender} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Ambiguous">Ambiguous</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                      <select name="category" id="category" value={patient.category || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent">
                        <option value="">Select Category</option>
                        {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="doctorInCharge" className="block text-sm font-medium text-slate-300 mb-1">Doctor In Charge</label>
                      <input type="text" name="doctorInCharge" id="doctorInCharge" value={patient.doctorInCharge || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent" placeholder="Responsible doctor" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="address" className="block text-sm font-medium text-slate-300 mb-1">Complete Address (Village Name / Ward No.)</label>
                    <textarea name="address" id="address" value={patient.address || ''} onChange={handleChange} rows={2} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent" placeholder="Complete address with village name or ward number"></textarea>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-300">Contact 1</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="tel" name="contactNo1" id="contactNo1" value={patient.contactNo1 || ''} onChange={handleChange} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent" placeholder="Phone number" />
                        <input type="text" name="contactRelation1" id="contactRelation1" value={patient.contactRelation1 || ''} onChange={handleChange} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent" placeholder="Relation" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-300">Contact 2</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="tel" name="contactNo2" id="contactNo2" value={patient.contactNo2 || ''} onChange={handleChange} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent" placeholder="Phone number" />
                        <input type="text" name="contactRelation2" id="contactRelation2" value={patient.contactRelation2 || ''} onChange={handleChange} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent" placeholder="Relation" />
                      </div>
                    </div>
                  </div>

                  {/* Admission Type - For NICU/SNCU */}
                  {(patient.unit === Unit.NICU || patient.unit === Unit.SNCU) && (
                    <div className="pt-4 border-t border-blue-500/30">
                      <label htmlFor="admissionType" className="block text-sm font-medium text-slate-300 mb-1">
                        Type of Admission <span className="text-red-400">*</span>
                      </label>
                      <select
                        name="admissionType"
                        id="admissionType"
                        value={patient.admissionType || ''}
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent"
                      >
                        <option value="">Select Admission Type</option>
                        {Object.values(AdmissionType).map(at => <option key={at} value={at}>{at}</option>)}
                      </select>
                      {patient.admissionType === AdmissionType.Inborn && (
                        <p className="text-xs text-green-400 mt-1">
                          ✓ Place of delivery will be set to: {institutionName}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>





            {/* Clinical Information Section */}
            <div className="bg-gradient-to-r from-purple-900/30 to-violet-900/30 rounded-xl border border-purple-500/30 overflow-hidden">
              <div className="px-4 py-3 bg-purple-900/50">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <h3 className="text-lg font-bold text-purple-200">Clinical Information</h3>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Indications for Admission - Show if NICU/SNCU OR if indications are configured for the unit */}
                {(patient.unit === Unit.NICU || patient.unit === Unit.SNCU || admissionIndications.length > 0) && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                      Indications for Admission <span className="text-red-400">*</span>
                      {isNurse && <span className="text-xs text-slate-400 ml-2">(Doctor will select)</span>}
                    </label>

                    {loadingIndications ? (
                      <div className="text-center py-4 text-slate-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto"></div>
                        <p className="text-sm mt-2">Loading indications...</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                        {admissionIndications.length > 0 ? (
                          admissionIndications.map((indication) => (
                            <label
                              key={indication.id}
                              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${(patient.indicationsForAdmission || []).includes(indication.name)
                                ? 'bg-purple-600/30 border-2 border-purple-400'
                                : 'bg-slate-700 border-2 border-slate-600 hover:border-purple-400/50'
                                } ${isNurse ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={(patient.indicationsForAdmission || []).includes(indication.name)}
                                onChange={() => handleIndicationToggle(indication.name)}
                                disabled={isNurse}
                                className="mt-1 w-4 h-4 text-purple-600 bg-slate-600 border-slate-500 rounded focus:ring-purple-500 focus:ring-2"
                              />
                              <span className="text-sm text-slate-200 flex-1">{indication.name}</span>
                            </label>
                          ))
                        ) : (
                          <div className="col-span-2 text-center py-8 text-slate-400">
                            <p className="text-sm">No indications configured yet.</p>
                            <p className="text-xs mt-1">SuperAdmin needs to add indications in Settings.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Custom Indication Field */}
                    <div className="mt-4">
                      <label htmlFor="customIndication" className="block text-sm font-medium text-slate-300 mb-1">
                        Custom Indication / Additional Notes
                      </label>
                      <textarea
                        name="customIndication"
                        id="customIndication"
                        value={patient.customIndication || ''}
                        onChange={handleChange}
                        rows={3}
                        disabled={isNurse}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder={isNurse ? "Doctor will add custom indications" : "Enter any other indications or additional clinical notes..."}
                      ></textarea>
                    </div>

                    {/* Selected Indications Summary */}
                    {(patient.indicationsForAdmission || []).length > 0 && (
                      <div className="mt-4 p-3 bg-purple-900/30 rounded-lg border border-purple-500/40">
                        <p className="text-xs font-medium text-purple-300 mb-2">Selected Indications ({patient.indicationsForAdmission?.length}):</p>
                        <div className="flex flex-wrap gap-2">
                          {patient.indicationsForAdmission?.map((indication, idx) => (
                            <span key={idx} className="px-2 py-1 bg-purple-600/40 text-purple-200 text-xs rounded-full border border-purple-400/30">
                              {indication}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Primary Diagnosis - Show for other units ONLY if no indications are configured */}
                {patient.unit !== Unit.NICU && patient.unit !== Unit.SNCU && admissionIndications.length === 0 && (
                  <div>
                    <label htmlFor="diagnosis" className="block text-sm font-medium text-slate-300 mb-1">
                      Primary Diagnosis <span className="text-red-400">*</span> {isNurse && <span className="text-xs text-slate-400">(Doctor will fill this)</span>}
                    </label>
                    <input
                      type="text"
                      name="diagnosis"
                      id="diagnosis"
                      value={patient.diagnosis}
                      onChange={handleChange}
                      required={!isNurse}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isNurse}
                      placeholder={isNurse ? "Doctor will complete diagnosis" : "Enter primary diagnosis"}
                    />
                  </div>
                )}

                {/* Keep diagnosis field hidden for NICU/SNCU for legacy data */}
                {(patient.unit === Unit.NICU || patient.unit === Unit.SNCU) && patient.diagnosis && (
                  <div className="bg-slate-700/30 p-3 rounded-lg border border-slate-600">
                    <label className="block text-xs font-medium text-slate-400 mb-1">Legacy Diagnosis</label>
                    <p className="text-sm text-slate-300">{patient.diagnosis}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Patient Status Section */}
            <div className="bg-gradient-to-r from-amber-900/30 to-yellow-900/30 rounded-xl border border-amber-500/30 overflow-hidden">
              <div className="px-4 py-3 bg-amber-900/50">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-bold text-amber-200">Patient Status</h3>
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="outcome" className="block text-sm font-medium text-slate-300 mb-1">Current Status <span className="text-red-400">*</span></label>
                    <select name="outcome" id="outcome" value={patient.outcome} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-transparent">
                      <option value="In Progress">In Progress</option>
                      {!patient.isStepDown && (
                        <option value="Step Down">Step Down</option>
                      )}
                      <option value="Discharged">Discharged</option>
                      <option value="Referred">Referred</option>
                      <option value="Deceased">Deceased</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="admissionDate" className="block text-sm font-medium text-slate-300 mb-1">Admission Date <span className="text-red-400">*</span></label>
                    <input type="date" name="admissionDate" id="admissionDate" value={patient.admissionDate.split('T')[0]} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed" disabled={!canEditSensitiveFields} />
                  </div>
                </div>
              </div>
            </div>

            {/* Readmit to ICU Section - Only show for Step Down patients */}
            {patient.outcome === 'Step Down' && patient.isStepDown && (
              <div className="bg-gradient-to-r from-red-900/30 to-pink-900/30 rounded-xl border-2 border-red-500/50 overflow-hidden shadow-lg">
                <div className="px-4 py-3 bg-red-900/50">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="text-lg font-bold text-red-200">Readmission Required?</h3>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="bg-red-50/10 border border-red-400/30 rounded-lg p-4">
                    <p className="text-sm text-slate-300 mb-4">
                      This patient is currently in <strong className="text-purple-400">Step Down</strong> status from <strong className="text-purple-400">{patient.stepDownFrom}</strong>.
                      If the patient requires readmission to intensive care, click the button below.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[Unit.NICU, Unit.PICU, Unit.SNCU].map(unit => (
                        <button
                          key={unit}
                          type="button"
                          onClick={() => {
                            setPatient(prev => ({
                              ...prev,
                              outcome: 'In Progress',
                              unit: unit,
                              isStepDown: false,
                              readmissionFromStepDown: true,
                            }));
                            alert(`Patient readmitted to ${unit} successfully! Status changed to "In Progress".`);
                          }}
                          className="px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-lg font-bold transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Readmit to {unit}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Discharge Details Section - Only show when outcome is not In Progress */}
            {patient.outcome !== 'In Progress' && (
              <div className="bg-gradient-to-r from-orange-900/30 to-amber-900/30 rounded-xl border border-orange-500/30 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('dischargeDetails')}
                  className="w-full px-4 py-3 flex items-center justify-between bg-orange-900/50 hover:bg-orange-900/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <h3 className="text-lg font-bold text-orange-200">
                      {patient.outcome === 'Step Down' ? 'Step Down Details' : 'Discharge Details'}
                    </h3>
                  </div>
                  <svg className={`w-5 h-5 text-orange-400 transition-transform ${expandedSections.dischargeDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedSections.dischargeDetails && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="dischargeDateTime" className="block text-sm font-medium text-slate-300 mb-1">
                          Date and Time of {patient.outcome === 'Step Down' ? 'Step Down' : 'Discharge'}
                        </label>
                        <input type="datetime-local" name="dischargeDateTime" id="dischargeDateTime" value={patient.dischargeDateTime ? patient.dischargeDateTime.slice(0, 16) : (patient.releaseDate ? patient.releaseDate.slice(0, 16) : '')} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-transparent" />
                      </div>
                      <div>
                        <label htmlFor="weightOnDischarge" className="block text-sm font-medium text-slate-300 mb-1">Weight on Discharge (Kg)</label>
                        <input type="number" name="weightOnDischarge" id="weightOnDischarge" value={patient.weightOnDischarge || ''} onChange={handleChange} step="0.001" min="0" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-transparent" placeholder="e.g., 3.200" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="ageOnDischarge" className="block text-sm font-medium text-slate-300 mb-1">Age on Discharge</label>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="number" name="ageOnDischarge" id="ageOnDischarge" value={patient.ageOnDischarge || ''} onChange={handleChange} min="0" className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-transparent" placeholder="Age" />
                          <select name="ageOnDischargeUnit" id="ageOnDischargeUnit" value={patient.ageOnDischargeUnit || AgeUnit.Days} onChange={handleChange} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-transparent">
                            {Object.values(AgeUnit).map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="releaseDate" className="block text-sm font-medium text-slate-300 mb-1">Legacy Release Date</label>
                        <input
                          type="date"
                          name="releaseDate"
                          id="releaseDate"
                          value={patient.releaseDate ? patient.releaseDate.split('T')[0] : ''}
                          onChange={handleChange}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-transparent"
                          required={patient.outcome === 'Step Down'}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isDoctor && (
              <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-6 rounded-xl border border-slate-600 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <label className="block text-xl font-bold text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        Clinical Progress Notes
                        <span className="px-2.5 py-1 bg-blue-500/30 text-blue-300 text-sm font-bold rounded-full border border-blue-400/30">
                          {patient.progressNotes.length}
                        </span>
                      </div>
                      <div className="text-xs font-normal text-slate-400 mt-0.5">
                        Add notes at different times throughout the day
                      </div>
                    </div>
                  </label>
                  {!showProgressNoteForm && (
                    <button
                      type="button"
                      onClick={handleAddNewProgressNote}
                      className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <PlusIcon className="w-5 h-5" />
                      Add New Note
                    </button>
                  )}
                </div>

                {/* Timeline View for Progress Notes */}
                {patient.progressNotes.length > 0 && !showProgressNoteForm && (
                  <div className="relative">
                    {/* Timeline Line */}
                    <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500"></div>

                    <div className="space-y-6 mb-4">
                      {patient.progressNotes
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((note, index) => {
                          const noteDate = new Date(note.date);
                          const timeStr = noteDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                          const dateStr = noteDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                          return (
                            <div key={index} className="relative flex gap-4">
                              {/* Timeline Node */}
                              <div className="flex flex-col items-center flex-shrink-0">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg ring-4 ring-slate-800 z-10">
                                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <div className="text-center mt-2">
                                  <div className="text-xs font-bold text-blue-300">{timeStr}</div>
                                  <div className="text-xs text-slate-400">{dateStr}</div>
                                </div>
                              </div>

                              {/* Note Card */}
                              <div className="flex-1 relative group">
                                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-600 p-4 shadow-lg hover:shadow-xl transition-all hover:border-blue-500/50">
                                  <ProgressNoteDisplay note={note} />

                                  {/* Hover Actions */}
                                  <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => handleEditNote(patient.progressNotes.findIndex(n => n.date === note.date))}
                                      className="p-2 text-slate-400 hover:text-blue-400 bg-slate-900/90 hover:bg-blue-900/50 rounded-lg transition-all shadow-md"
                                      title="Edit note"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeNote(patient.progressNotes.findIndex(n => n.date === note.date))}
                                      className="p-2 text-slate-400 hover:text-red-400 bg-slate-900/90 hover:bg-red-900/50 rounded-lg transition-all shadow-md"
                                      title="Remove note"
                                    >
                                      <TrashIcon className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Show comprehensive form when adding/editing */}
                {showProgressNoteForm && (
                  <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-blue-500/30">
                    <ProgressNoteForm
                      onSave={handleSaveProgressNote}
                      onCancel={() => {
                        setShowProgressNoteForm(false);
                        setEditingNoteIndex(null);
                      }}
                      existingNote={editingNoteIndex !== null ? patient.progressNotes[editingNoteIndex] : undefined}
                      lastNote={patient.progressNotes.length > 0 ? patient.progressNotes[patient.progressNotes.length - 1] : undefined}
                      userEmail={userEmail}
                      userName={userName || userEmail}
                    />
                  </div>
                )}

                {patient.progressNotes.length === 0 && !showProgressNoteForm && (
                  <div className="text-center py-8 text-slate-400">
                    <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">No progress notes added yet</p>
                    <p className="text-xs mt-1">Click "Add Progress Note" to create your first comprehensive note</p>
                  </div>
                )}
              </div>
            )}
            {isNurse && (
              <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                <p className="text-sm text-slate-300">📝 Clinical progress notes will be added by the doctor.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="admissionDate" className="block text-sm font-medium text-slate-300 mb-1">Admission Date</label>
                <input type="date" name="admissionDate" id="admissionDate" value={patient.admissionDate.split('T')[0]} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed" disabled={!canEditSensitiveFields} />
              </div>
              <div>
                <label htmlFor="releaseDate" className="block text-sm font-medium text-slate-300 mb-1">
                  {patient.outcome === 'Step Down' ? 'Step Down Date' : 'Date of Release'}
                </label>
                <input
                  type="date"
                  name="releaseDate"
                  id="releaseDate"
                  value={patient.releaseDate ? patient.releaseDate.split('T')[0] : ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  required={patient.outcome === 'Step Down'}
                />
              </div>
              <div>
                <label htmlFor="outcome" className="block text-sm font-medium text-slate-300 mb-1">Current Status</label>
                <select name="outcome" id="outcome" value={patient.outcome} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed">
                  <option value="In Progress">In Progress</option>
                  {!patient.isStepDown && (
                    <option value="Step Down">Step Down</option>
                  )}
                  <option value="Discharged">Discharged</option>
                  <option value="Referred">Referred</option>
                  <option value="Deceased">Deceased</option>
                </select>
              </div>
            </div>

            {/* Referral Information - Only show when outcome is Referred */}
            {patient.outcome === 'Referred' && isDoctor && patientToEdit && (
              <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border-2 border-orange-500/50 p-6 rounded-xl space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <div>
                    <h3 className="text-xl font-bold text-orange-300">Create Formal Referral</h3>
                    <p className="text-sm text-slate-300">Generate AI-powered referral letter and notify receiving institution</p>
                  </div>
                </div>

                <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
                  <p className="text-sm text-slate-300 mb-3">
                    <span className="font-semibold text-white">📋 Complete Referral Includes:</span>
                  </p>
                  <ul className="text-sm text-slate-300 space-y-1 ml-4">
                    <li>✓ Searchable institution dropdown</li>
                    <li>✓ Comprehensive referral details form</li>
                    <li>✓ AI-generated professional referral letter</li>
                    <li>✓ Real-time notification to receiving institution</li>
                    <li>✓ Status tracking and updates</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => setShowReferralForm(true)}
                  className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-6 py-4 rounded-lg transition-all font-bold text-lg shadow-lg flex items-center justify-center gap-3"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Create Formal Referral
                </button>

                <p className="text-xs text-slate-400 text-center">
                  Click to open comprehensive referral form with AI-powered letter generation
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 p-6 mt-6 sticky bottom-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-3 rounded-lg text-slate-200 bg-slate-700 hover:bg-slate-600 transition-colors font-semibold text-base flex items-center justify-center gap-2"
              >
                <XIcon className="w-5 h-5" />
                Cancel
              </button>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                {isNurse && (
                  <button
                    type="button"
                    onClick={handleSaveAsDraft}
                    className="w-full sm:w-auto px-8 py-3 rounded-lg text-white bg-yellow-600 hover:bg-yellow-700 transition-colors font-bold text-base flex items-center justify-center gap-2 shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save as Draft
                  </button>
                )}
                {isDoctor && (
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-8 py-3 rounded-lg text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all font-bold text-base flex items-center justify-center gap-2 shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Complete & Save Patient
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Referral Form Modal */}
        {showReferralForm && patientToEdit && (
          <ReferralForm
            patient={patientToEdit}
            currentInstitutionId={institutionId}
            currentInstitutionName={institutionName}
            userEmail={userEmail}
            userRole={userRole}
            userName={userName || userEmail}
            onClose={() => setShowReferralForm(false)}
            onSuccess={() => {
              setShowReferralForm(false);
              onClose(); // Close the patient form after successful referral
            }}
          />
        )}
      </div>
    </div>
  );
};

export default PatientForm;
