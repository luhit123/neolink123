import React, { useState, useEffect } from 'react';
import { Patient, Unit, AgeUnit, UserRole, ProgressNote, AdmissionType } from '../types';
import { XIcon, PlusIcon, TrashIcon } from './common/Icons';

interface PatientFormProps {
  patientToEdit?: Patient | null;
  onSave: (patient: Patient) => void;
  onClose: () => void;
  userRole: UserRole;
  defaultUnit?: Unit;
}

const PatientForm: React.FC<PatientFormProps> = ({ patientToEdit, onSave, onClose, userRole, defaultUnit }) => {
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
      progressNotes: [{ date: new Date().toISOString(), note: '' }],
      outcome: 'In Progress',
      unit: defaultUnit || Unit.NICU,
      admissionType: AdmissionType.Inborn,
      isDraft: isNurse,
      createdBy: userRole
    }
  );
  
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    if (patientToEdit) {
      setPatient(patientToEdit);
    }
  }, [patientToEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPatient(prev => ({ ...prev, [name]: name === 'age' ? parseInt(value) : value }));
  };

  const handleNoteChange = (index: number, value: string) => {
    const updatedNotes = [...patient.progressNotes];
    updatedNotes[index].note = value;
    setPatient(prev => ({ ...prev, progressNotes: updatedNotes }));
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
        setPatient(prev => ({...prev, progressNotes: updatedNotes}));
    }
  }


  const handleSubmit = (e: React.FormEvent, saveAsDraft: boolean = false) => {
    e.preventDefault();
    const updatedPatient = {
      ...patient,
      id: patient.id || Date.now().toString(),
      isDraft: saveAsDraft,
      lastUpdatedBy: userRole
    };
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
            {isNurse && <p className="text-xs sm:text-sm text-cyan-400 mt-1">Enter basic patient information. Doctor will complete the diagnosis.</p>}
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
                    <input type="text" name="name" id="name" value={patient.name} onChange={handleChange} required className="form-input" />
                </div>
                <div>
                    <label htmlFor="unit" className="block text-sm font-medium text-slate-300 mb-1">Unit</label>
                    <select name="unit" id="unit" value={patient.unit} onChange={handleChange} className="form-input" disabled={!canEditSensitiveFields}>
                        {Object.values(Unit).map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </div>
            </div>
            
            {patient.unit === Unit.NICU && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="admissionType" className="block text-sm font-medium text-slate-300 mb-1">Admission Type</label>
                  <select name="admissionType" id="admissionType" value={patient.admissionType} onChange={handleChange} className="form-input" required>
                    {Object.values(AdmissionType).map(at => <option key={at} value={at}>{at}</option>)}
                  </select>
                </div>
                {patient.admissionType === AdmissionType.Outborn && (
                  <>
                    <div>
                      <label htmlFor="referringHospital" className="block text-sm font-medium text-slate-300 mb-1">Referring Hospital</label>
                      <input type="text" name="referringHospital" id="referringHospital" value={patient.referringHospital || ''} onChange={handleChange} className="form-input" />
                    </div>
                     <div>
                      <label htmlFor="referringDistrict" className="block text-sm font-medium text-slate-300 mb-1">Referring District</label>
                      <input type="text" name="referringDistrict" id="referringDistrict" value={patient.referringDistrict || ''} onChange={handleChange} className="form-input" />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label htmlFor="age" className="block text-sm font-medium text-slate-300 mb-1">Age</label>
                    <input type="number" name="age" id="age" value={patient.age} onChange={handleChange} required min="0" className="form-input" />
                </div>
                <div>
                    <label htmlFor="ageUnit" className="block text-sm font-medium text-slate-300 mb-1">Age Unit</label>
                    <select name="ageUnit" id="ageUnit" value={patient.ageUnit} onChange={handleChange} className="form-input">
                        {Object.values(AgeUnit).map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </div>
                 <div>
                    <label htmlFor="gender" className="block text-sm font-medium text-slate-300 mb-1">Gender</label>
                    <select name="gender" id="gender" value={patient.gender} onChange={handleChange} className="form-input">
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
                  className="form-input" 
                  disabled={isNurse}
                  placeholder={isNurse ? "Doctor will complete diagnosis" : "Enter primary diagnosis"}
                />
            </div>

            {isDoctor && (
              <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Clinical Progress Notes</label>
                  <div className="space-y-4">
                    {patient.progressNotes.map((note, index) => (
                      <div key={index} className="flex items-start gap-2">
                         <textarea
                              value={note.note}
                              onChange={(e) => handleNoteChange(index, e.target.value)}
                              rows={2}
                              className="form-input flex-grow"
                              placeholder={`Note on ${new Date(note.date).toLocaleDateString()}`}
                          />
                          <button type="button" onClick={() => removeNote(index)} className="p-2 mt-1 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50" disabled={patient.progressNotes.length <= 1}>
                              <TrashIcon className="w-5 h-5"/>
                          </button>
                      </div>
                    ))}
                  </div>
                   <button type="button" onClick={addNote} className="flex items-center gap-2 mt-3 text-sm text-cyan-400 hover:text-cyan-300 font-semibold">
                      <PlusIcon className="w-4 h-4" />
                      Add Another Note
                  </button>
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
                    <input type="date" name="admissionDate" id="admissionDate" value={patient.admissionDate.split('T')[0]} onChange={handleChange} required className="form-input" disabled={!canEditSensitiveFields}/>
                </div>
                <div>
                  <label htmlFor="releaseDate" className="block text-sm font-medium text-slate-300 mb-1">Date of Release</label>
                  <input type="date" name="releaseDate" id="releaseDate" value={patient.releaseDate ? patient.releaseDate.split('T')[0] : ''} onChange={handleChange} className="form-input" />
                </div>
                 <div>
                    <label htmlFor="outcome" className="block text-sm font-medium text-slate-300 mb-1">Current Status</label>
                    <select name="outcome" id="outcome" value={patient.outcome} onChange={handleChange} className="form-input">
                        <option value="In Progress">In Progress</option>
                        <option value="Discharged">Discharged</option>
                        <option value="Referred">Referred</option>
                        <option value="Deceased">Deceased</option>
                    </select>
                </div>
            </div>
          </div>
          <div className="p-4 sm:p-6 bg-slate-700/50 flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 sticky bottom-0">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-200 bg-slate-600 hover:bg-slate-500 active:bg-slate-500 transition-colors font-semibold text-sm sm:text-base order-2 sm:order-1">Cancel</button>
            {isNurse && (
              <button type="button" onClick={handleSaveAsDraft} className="px-6 py-2 rounded-lg text-white bg-yellow-600 hover:bg-yellow-700 active:bg-yellow-700 transition-colors font-semibold flex items-center justify-center gap-2 text-sm sm:text-base order-1 sm:order-2">
                💾 Save as Draft
              </button>
            )}
            {isDoctor && (
              <button type="submit" className="px-6 py-2 rounded-lg text-white bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-700 transition-colors font-semibold flex items-center justify-center gap-2 text-sm sm:text-base order-1 sm:order-2">
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
