import React, { useState, useEffect } from 'react';
import { Patient, Unit, AgeUnit, UserRole, ProgressNote, AdmissionType } from '../types';
import { XIcon, PlusIcon, TrashIcon } from './common/Icons';
import ProgressNoteForm from './ProgressNoteForm';
import ProgressNoteDisplay from './ProgressNoteDisplay';

interface PatientFormProps {
  patientToEdit?: Patient | null;
  onSave: (patient: Patient) => void;
  onClose: () => void;
  userRole: UserRole;
  defaultUnit?: Unit;
  institutionId: string;
  institutionName: string;
  userEmail: string;
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
  availableUnits
}) => {
  const isNurse = userRole === UserRole.Nurse;
  const isDoctor = userRole === UserRole.Doctor || userRole === UserRole.Admin;

  const [patient, setPatient] = useState<Patient>(
    patientToEdit || {
      id: '',
      name: '',
      age: 0,
      ageUnit: AgeUnit.Days,
      gender: 'Male',
      admissionDate: new Date().toISOString(),
      diagnosis: '',
      progressNotes: [], // Start with empty array - doctor will add comprehensive notes
      outcome: 'In Progress',
      unit: defaultUnit || Unit.NICU,
      admissionType: AdmissionType.Inborn,
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

  useEffect(() => {
    if (patientToEdit) {
      setPatient(patientToEdit);
    }
  }, [patientToEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPatient(prev => {
      const updated = { ...prev, [name]: name === 'age' ? parseInt(value) : value };

      // Handle Step Down logic for both NICU and PICU
      if (name === 'outcome' && value === 'Step Down') {
        updated.stepDownDate = new Date().toISOString();
        updated.stepDownFrom = prev.unit; // Can be NICU or PICU
        updated.isStepDown = true;
        updated.outcome = 'Step Down';
      }

      return updated;
    });
  };

  const handleNoteChange = (index: number, value: string) => {
    const updatedNotes = [...patient.progressNotes];
    updatedNotes[index].note = value;
    setPatient(prev => ({ ...prev, progressNotes: updatedNotes }));
  };

  const handleSaveProgressNote = (note: ProgressNote) => {
    console.log('📝 handleSaveProgressNote called with note:', JSON.stringify(note));
    if (editingNoteIndex !== null) {
      // Update existing note
      const updatedNotes = [...patient.progressNotes];
      updatedNotes[editingNoteIndex] = note;
      console.log('📝 Updated notes array:', JSON.stringify(updatedNotes));
      setPatient(prev => ({ ...prev, progressNotes: updatedNotes }));
    } else {
      // Add new note
      console.log('📝 Adding new note to existing:', JSON.stringify(patient.progressNotes));
      setPatient(prev => {
        const newNotes = [...prev.progressNotes, note];
        console.log('📝 New notes array after add:', JSON.stringify(newNotes));
        return {
          ...prev,
          progressNotes: newNotes
        };
      });
    }
    setShowProgressNoteForm(false);
    setEditingNoteIndex(null);
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
    e.preventDefault();
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
    console.log('📤 PatientForm handleSubmit - updatedPatient.progressNotes:', JSON.stringify(updatedPatient.progressNotes));
    console.log('📤 PatientForm handleSubmit - Full patient object keys:', Object.keys(updatedPatient));
    onSave(updatedPatient);
  };

  const handleSaveAsDraft = (e: React.FormEvent) => {
    handleSubmit(e, true);
  };

  const handleSaveComplete = (e: React.FormEvent) => {
    handleSubmit(e, false);
  };

  const canEditSensitiveFields = userRole === UserRole.Admin || userRole === UserRole.Doctor;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-2 sm:p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl border border-slate-700 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 border-b border-slate-700 flex justify-between items-start sticky top-0 bg-slate-800 z-10">
          <div className="flex-1 pr-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white">{patientToEdit ? 'Edit Patient' : 'Add New Patient'}</h2>
            {isNurse && <p className="text-xs sm:text-sm text-blue-400 mt-1">Enter basic patient information. Doctor will complete the diagnosis.</p>}
            {patient.isDraft && isDoctor && <p className="text-xs sm:text-sm text-yellow-400 mt-1">⚠️ Draft record - Please complete diagnosis and notes</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white active:text-white transition-colors flex-shrink-0">
            <XIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
        <form onSubmit={handleSaveComplete} className="flex flex-col h-full">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 flex-grow">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                <input type="text" name="name" id="name" value={patient.name} onChange={handleChange} required className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent" />
              </div>
              <div>
                <label htmlFor="unit" className="block text-sm font-medium text-slate-300 mb-1">Unit</label>
                <select name="unit" id="unit" value={patient.unit} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed" disabled={!canEditSensitiveFields}>
                  {(availableUnits || Object.values(Unit)).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {(patient.unit === Unit.NICU || patient.unit === Unit.SNCU) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="admissionType" className="block text-sm font-medium text-slate-300 mb-1">Admission Type</label>
                  <select name="admissionType" id="admissionType" value={patient.admissionType} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed" required>
                    {Object.values(AdmissionType).map(at => <option key={at} value={at}>{at}</option>)}
                  </select>
                </div>
                {patient.admissionType === AdmissionType.Outborn && (
                  <>
                    <div>
                      <label htmlFor="referringHospital" className="block text-sm font-medium text-slate-300 mb-1">Referring Hospital</label>
                      <input type="text" name="referringHospital" id="referringHospital" value={patient.referringHospital || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed" />
                    </div>
                    <div>
                      <label htmlFor="referringDistrict" className="block text-sm font-medium text-slate-300 mb-1">Referring District</label>
                      <input type="text" name="referringDistrict" id="referringDistrict" value={patient.referringDistrict || ''} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed" />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="age" className="block text-sm font-medium text-slate-300 mb-1">Age</label>
                <input type="number" name="age" id="age" value={patient.age} onChange={handleChange} required min="0" className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed" />
              </div>
              <div>
                <label htmlFor="ageUnit" className="block text-sm font-medium text-slate-300 mb-1">Age Unit</label>
                <select name="ageUnit" id="ageUnit" value={patient.ageUnit} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed">
                  {Object.values(AgeUnit).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-slate-300 mb-1">Gender</label>
                <select name="gender" id="gender" value={patient.gender} onChange={handleChange} className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="diagnosis" className="block text-sm font-medium text-slate-300 mb-1">
                Primary Diagnosis {isNurse && <span className="text-xs text-slate-400">(Doctor will fill this)</span>}
              </label>
              <input
                type="text"
                name="diagnosis"
                id="diagnosis"
                value={patient.diagnosis}
                onChange={handleChange}
                required={!isNurse}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isNurse}
                placeholder={isNurse ? "Doctor will complete diagnosis" : "Enter primary diagnosis"}
              />
            </div>

            {isDoctor && (
              <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-600">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-lg font-semibold text-slate-200 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Clinical Progress Notes
                    <span className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                      {patient.progressNotes.length}
                    </span>
                  </label>
                  {!showProgressNoteForm && (
                    <button
                      type="button"
                      onClick={handleAddNewProgressNote}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Add Progress Note
                    </button>
                  )}
                </div>

                {/* Show existing progress notes */}
                {patient.progressNotes.length > 0 && !showProgressNoteForm && (
                  <div className="space-y-3 mb-4">
                    {patient.progressNotes
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((note, index) => (
                        <div key={index} className="relative">
                          <ProgressNoteDisplay note={note} />
                          <div className="absolute top-2 right-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditNote(patient.progressNotes.findIndex(n => n.date === note.date))}
                              className="p-1.5 text-slate-400 hover:text-blue-400 bg-slate-800/80 rounded-lg transition-colors"
                              title="Edit note"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeNote(patient.progressNotes.findIndex(n => n.date === note.date))}
                              className="p-1.5 text-slate-400 hover:text-red-400 bg-slate-800/80 rounded-lg transition-colors"
                              title="Remove note"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
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
                      userEmail={userEmail}
                      userName={userRole}
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
            {patient.outcome === 'Referred' && (
              <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-lg space-y-4">
                <h3 className="text-lg font-semibold text-orange-300 mb-2">Referral Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="referredTo" className="block text-sm font-medium text-slate-300 mb-1">
                      Referred To (Facility Name) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="referredTo"
                      id="referredTo"
                      value={patient.referredTo || ''}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="e.g., GMCH, AIIMS, etc."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="referralReason" className="block text-sm font-medium text-slate-300 mb-1">
                      Reason for Referral <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      name="referralReason"
                      id="referralReason"
                      value={patient.referralReason || ''}
                      onChange={handleChange}
                      required
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Specify the reason for referring this patient (e.g., Need for specialized care, Equipment not available, Higher level NICU/PICU required, etc.)"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="p-4 sm:p-6 bg-slate-700/50 flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 sticky bottom-0">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-200 bg-slate-600 hover:bg-slate-500 active:bg-slate-500 transition-colors font-semibold text-sm sm:text-base order-2 sm:order-1">Cancel</button>
            {isNurse && (
              <button type="button" onClick={handleSaveAsDraft} className="px-6 py-2 rounded-lg text-white bg-yellow-600 hover:bg-yellow-700 active:bg-yellow-700 transition-colors font-semibold flex items-center justify-center gap-2 text-sm sm:text-base order-1 sm:order-2">
                💾 Save as Draft
              </button>
            )}
            {isDoctor && (
              <button type="submit" className="px-6 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-700 transition-colors font-semibold flex items-center justify-center gap-2 text-sm sm:text-base order-1 sm:order-2">
                ✓ Complete & Save
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatientForm;
