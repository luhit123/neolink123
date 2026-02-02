import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Patient, ProgressNote, Unit, MaternalRiskFactor } from '../types';
import { generatePatientSummary } from '../services/openaiService';
import ClinicalNotesNavigator from './ClinicalNotesNavigator';
import ProgressNoteForm from './ProgressNoteFormEnhanced';
import MedicationManagement from './MedicationManagement';
import DischargeSummaryModal from './DischargeSummaryModal';
import { getFormattedAge } from '../utils/ageCalculator';
import { useBackgroundSave } from '../contexts/BackgroundSaveContext';

interface PatientViewPageProps {
  patient: Patient;
  onBack: () => void;
  onEdit?: (patient: Patient) => void;
  canEdit?: boolean;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  onPatientUpdate?: (updatedPatient: Patient) => void;
}

const PatientViewPage: React.FC<PatientViewPageProps> = ({
  patient,
  onBack,
  onEdit,
  canEdit = false,
  userEmail = '',
  userName = '',
  userRole = '',
  onPatientUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'meds' | 'ai'>('overview');
  const [localPatient, setLocalPatient] = useState(patient);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showDischargeSummary, setShowDischargeSummary] = useState(false);
  const [summary, setSummary] = useState('');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [copied, setCopied] = useState(false);

  // Ref to track latest patient state (avoids race conditions)
  const latestPatientRef = useRef(localPatient);

  // Background save context
  const { addSavingNote, updateNoteStatus } = useBackgroundSave();

  useEffect(() => {
    setLocalPatient(patient);
    latestPatientRef.current = patient;
  }, [patient]);

  // Helper to update patient state AND ref synchronously
  const updatePatientState = (newPatient: Patient) => {
    latestPatientRef.current = newPatient; // Update ref immediately (sync)
    setLocalPatient(newPatient); // Schedule state update (async)
  };

  const handleGenerateSummary = async () => {
    setIsLoadingSummary(true);
    try {
      const result = await generatePatientSummary(localPatient);
      setSummary(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleSaveNote = (note: ProgressNote) => {
    // Use ref to get the LATEST patient state (including any medications just added)
    const currentPatient = latestPatientRef.current;
    const updatedNotes = [...(currentPatient.progressNotes || []), note];
    const updatedPatient = { ...currentPatient, progressNotes: updatedNotes };
    updatePatientState(updatedPatient);
    onPatientUpdate?.(updatedPatient);
    setShowNoteForm(false);
  };

  // Background save handler - saves note asynchronously
  const handleBackgroundSave = useCallback(async (patientId: string, note: ProgressNote) => {
    const saveId = addSavingNote(patientId, localPatient.name, note);
    setShowNoteForm(false);

    try {
      const currentPatient = latestPatientRef.current;
      const updatedNotes = [...(currentPatient.progressNotes || []), note];
      const updatedPatient = { ...currentPatient, progressNotes: updatedNotes };
      updatePatientState(updatedPatient);
      await onPatientUpdate?.(updatedPatient);
      updateNoteStatus(saveId, 'saved');
    } catch (err) {
      console.error('Background save failed:', err);
      updateNoteStatus(saveId, 'error', (err as Error).message);
    }
  }, [localPatient.name, addSavingNote, updateNoteStatus, onPatientUpdate]);

  const handleUpdateMedications = (medications: any[]) => {
    // Use ref to get the LATEST patient state
    const currentPatient = latestPatientRef.current;
    const updatedPatient = { ...currentPatient, medications };
    updatePatientState(updatedPatient);
    onPatientUpdate?.(updatedPatient);
  };

  const getOutcomeBadge = (outcome: string) => {
    const styles: Record<string, string> = {
      'In Progress': 'bg-emerald-500 text-white',
      'Discharged': 'bg-blue-500 text-white',
      'Deceased': 'bg-slate-600 text-white',
      'Referred': 'bg-amber-500 text-white',
      'Step Down': 'bg-purple-500 text-white',
    };
    return styles[outcome] || 'bg-slate-500 text-white';
  };

  const calculateDaysAdmitted = () => {
    const admission = new Date(patient.admissionDate);
    const end = patient.releaseDate ? new Date(patient.releaseDate) : new Date();
    return Math.ceil((end.getTime() - admission.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getUnitShort = (unit: string) => {
    const map: Record<string, string> = {
      'Neonatal Intensive Care Unit': 'NICU',
      'Pediatric Intensive Care Unit': 'PICU',
      'Special New Born Care Unit': 'SNCU',
      'High Dependency Unit': 'HDU',
      'General Ward': 'General'
    };
    return map[unit] || unit;
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (date: string | undefined) => {
    if (!date) return null;
    return new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Simple Top Bar */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-3 py-2 flex items-center justify-between gap-3">
          <button onClick={onBack} className="p-1.5 -ml-1 hover:bg-slate-100 rounded-lg">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">{localPatient.name}</h1>
            {localPatient.ntid && (
              <p className="text-xs font-mono text-blue-600 font-semibold">{localPatient.ntid}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getOutcomeBadge(localPatient.outcome)}`}>
              {localPatient.outcome}
            </span>
            {/* Discharge Summary Button - Only show for discharged patients or any patient for planning */}
            <button
              onClick={() => setShowDischargeSummary(true)}
              className="p-1.5 hover:bg-emerald-100 rounded-lg group relative"
              title="Generate Discharge Summary"
            >
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            {canEdit && (
              <button
                onClick={() => onEdit?.(localPatient)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg font-semibold text-xs shadow-sm transition-all active:scale-95"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-3 pb-2">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            {['overview', 'notes', 'meds', 'ai'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-3 py-3 pb-24">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-2.5">
            {/* Edit Admission Banner */}
            {canEdit && (
              <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-3 border-2 border-blue-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Edit Admission Details</h3>
                      <p className="text-xs text-slate-500">Modify patient information, diagnosis, or add details</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onEdit?.(localPatient)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit Form
                  </button>
                </div>
                {/* Last edited info */}
                {localPatient.lastEditedAt && (
                  <div className="mt-2 pt-2 border-t border-blue-200 flex items-center gap-2 text-xs text-slate-500">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      Last edited: {new Date(localPatient.lastEditedAt).toLocaleString()}
                      {localPatient.lastUpdatedByName && ` by ${localPatient.lastUpdatedByName}`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Quick Info Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg">{getFormattedAge(localPatient.dateOfBirth, localPatient.age, localPatient.ageUnit)}</span>
              <span className="px-2 py-1 bg-slate-200 text-slate-700 text-xs font-medium rounded-lg">{localPatient.gender}</span>
              <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-lg">{getUnitShort(localPatient.unit)}</span>
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-lg">{calculateDaysAdmitted()} days</span>
              {localPatient.birthWeight && (
                <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-lg">{localPatient.birthWeight} kg</span>
              )}
              {localPatient.doctorInCharge && (
                <span className="px-2 py-1 bg-violet-100 text-violet-700 text-xs font-medium rounded-lg">Dr. {localPatient.doctorInCharge}</span>
              )}
            </div>

            {/* Diagnosis */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
              <div className="flex items-center gap-1.5 text-blue-600 text-xs font-semibold mb-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                PRIMARY DIAGNOSIS
              </div>
              <p className="text-sm text-slate-800 font-medium">{localPatient.diagnosis || 'Not specified'}</p>
            </div>

            {/* Patient Details Grid */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
              <SectionTitle icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" title="Patient Details" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 mt-2">
                <DataItem label="Full Name" value={localPatient.name} />
                <DataItem label="Gender" value={localPatient.gender} />
                <DataItem label="Current Age" value={getFormattedAge(localPatient.dateOfBirth, localPatient.age, localPatient.ageUnit)} />
                <DataItem label="Date of Birth" value={formatDate(localPatient.dateOfBirth)} />
                <DataItem label="Birth Weight" value={localPatient.birthWeight ? `${localPatient.birthWeight} kg` : null} />
                <DataItem label="Mode of Delivery" value={localPatient.modeOfDelivery} />
                <DataItem label="Category" value={localPatient.category} />
                <DataItem label="SNCU Reg No" value={localPatient.sncuRegNo} />
                <DataItem label="NTID" value={localPatient.ntid} mono highlight />
              </div>
            </div>

            {/* Maternal History - Only for NICU/SNCU */}
            {(localPatient.unit === Unit.NICU || localPatient.unit === Unit.SNCU) && localPatient.maternalHistory && (
              <div className="bg-white rounded-xl p-3 shadow-sm border border-pink-200">
                <SectionTitle icon="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" title="Maternal History" color="pink" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 mt-2">
                  {/* LMP, EDD, Gestational Age */}
                  <DataItem label="LMP" value={formatDate(localPatient.maternalHistory.lmp)} />
                  <DataItem label="EDD" value={formatDate(localPatient.maternalHistory.edd)} />
                  <DataItem
                    label="Gestational Age at Birth"
                    value={localPatient.gestationalAgeWeeks !== undefined && localPatient.gestationalAgeDays !== undefined
                      ? `${localPatient.gestationalAgeWeeks}w ${localPatient.gestationalAgeDays}d`
                      : null}
                    highlight
                  />
                  {localPatient.gestationalAgeCategory && (
                    <DataItem label="GA Category" value={localPatient.gestationalAgeCategory} />
                  )}

                  {/* Obstetric History */}
                  {(localPatient.maternalHistory.gravida !== undefined || localPatient.maternalHistory.para !== undefined) && (
                    <DataItem
                      label="Obstetric History"
                      value={`G${localPatient.maternalHistory.gravida || 0} P${localPatient.maternalHistory.para || 0} A${localPatient.maternalHistory.abortion || 0} L${localPatient.maternalHistory.living || 0}`}
                    />
                  )}

                  {/* Maternal Details */}
                  <DataItem label="Maternal Age" value={localPatient.maternalHistory.maternalAge ? `${localPatient.maternalHistory.maternalAge} years` : null} />
                  <DataItem label="Blood Group" value={localPatient.maternalHistory.bloodGroup} />

                  {/* ANC Details */}
                  <DataItem label="ANC Received" value={localPatient.maternalHistory.ancReceived !== undefined ? (localPatient.maternalHistory.ancReceived ? 'Yes' : 'No') : null} />
                  <DataItem label="ANC Visits" value={localPatient.maternalHistory.ancVisits} />
                  <DataItem label="ANC Place" value={localPatient.maternalHistory.ancPlace} />

                  {/* Steroid Coverage */}
                  <DataItem
                    label="Antenatal Steroids"
                    value={localPatient.maternalHistory.antenatalSteroidsGiven !== undefined
                      ? (localPatient.maternalHistory.antenatalSteroidsGiven
                        ? `Yes${localPatient.maternalHistory.steroidDoses ? ` (${localPatient.maternalHistory.steroidDoses} doses)` : ''}`
                        : 'No')
                      : null}
                  />
                  {localPatient.maternalHistory.lastSteroidToDeliveryHours && (
                    <DataItem label="Steroid-Delivery Interval" value={`${localPatient.maternalHistory.lastSteroidToDeliveryHours} hrs`} />
                  )}

                  {/* Intrapartum Risk Factors */}
                  {localPatient.maternalHistory.prolongedRupture && (
                    <DataItem label="PROM" value={localPatient.maternalHistory.ruptureToDeliveryHours ? `${localPatient.maternalHistory.ruptureToDeliveryHours} hrs` : 'Yes'} />
                  )}
                  {localPatient.maternalHistory.meconiumStainedLiquor && (
                    <DataItem label="Meconium Stained Liquor" value="Yes" />
                  )}
                  {localPatient.maternalHistory.fetalDistress && (
                    <DataItem label="Fetal Distress" value="Yes" />
                  )}
                  {localPatient.maternalHistory.maternalFever && (
                    <DataItem label="Maternal Fever" value="Yes" />
                  )}

                  {/* Previous Outcomes */}
                  {localPatient.maternalHistory.previousNICUAdmissions !== undefined && localPatient.maternalHistory.previousNICUAdmissions > 0 && (
                    <DataItem label="Previous NICU Admissions" value={localPatient.maternalHistory.previousNICUAdmissions} />
                  )}
                  {localPatient.maternalHistory.previousNeonatalDeaths !== undefined && localPatient.maternalHistory.previousNeonatalDeaths > 0 && (
                    <DataItem label="Previous Neonatal Deaths" value={localPatient.maternalHistory.previousNeonatalDeaths} />
                  )}
                  {localPatient.maternalHistory.previousStillbirths !== undefined && localPatient.maternalHistory.previousStillbirths > 0 && (
                    <DataItem label="Previous Stillbirths" value={localPatient.maternalHistory.previousStillbirths} />
                  )}
                </div>

                {/* Risk Factors - displayed as tags */}
                {localPatient.maternalHistory.riskFactors && localPatient.maternalHistory.riskFactors.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-pink-100">
                    <span className="text-[10px] text-pink-600 font-medium uppercase">Risk Factors</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {localPatient.maternalHistory.riskFactors.map((rf, i) => (
                        <span key={i} className="px-2 py-0.5 bg-pink-50 text-pink-700 text-xs rounded-lg border border-pink-200">
                          {rf}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Risk Factors */}
                {localPatient.maternalHistory.otherRiskFactors && (
                  <div className="mt-2 pt-2 border-t border-pink-100">
                    <span className="text-[10px] text-pink-600 font-medium uppercase">Other Risk Factors</span>
                    <p className="text-xs text-slate-700 mt-0.5">{localPatient.maternalHistory.otherRiskFactors}</p>
                  </div>
                )}
              </div>
            )}

            {/* Family & Contact */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
              <SectionTitle icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" title="Family & Contact" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 mt-2">
                <DataItem label="Mother's Name" value={localPatient.motherName} />
                <DataItem label="Father's Name" value={localPatient.fatherName} />
                <DataItem label="Contact 1" value={localPatient.contactNo1} sub={localPatient.contactRelation1} />
                <DataItem label="Contact 2" value={localPatient.contactNo2} sub={localPatient.contactRelation2} />
                <DataItem label="District" value={localPatient.district} />
                <DataItem label="State" value={localPatient.state} />
                <DataItem label="Village/Ward" value={localPatient.village} />
                <DataItem label="Post Office" value={localPatient.postOffice} />
                <DataItem label="PIN Code" value={localPatient.pinCode} />
              </div>
              {localPatient.address && (
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-500 font-medium uppercase">Address</span>
                  <p className="text-xs text-slate-700 mt-0.5">{localPatient.address}</p>
                </div>
              )}
            </div>

            {/* Admission Details */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
              <SectionTitle icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" title="Admission Details" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 mt-2">
                <DataItem label="Admission Date" value={formatDate(localPatient.admissionDate)} />
                <DataItem label="Admission Time" value={localPatient.admissionDateTime ? new Date(localPatient.admissionDateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null} />
                <DataItem label="Unit" value={getUnitShort(localPatient.unit)} />
                <DataItem label="Admission Type" value={localPatient.admissionType} />
                <DataItem label="Age on Admission" value={localPatient.ageOnAdmission ? `${localPatient.ageOnAdmission} ${localPatient.ageOnAdmissionUnit || ''}` : null} />
                <DataItem label="Weight on Admission" value={localPatient.weightOnAdmission ? `${localPatient.weightOnAdmission} kg` : null} />
                <DataItem label="Place of Delivery" value={localPatient.placeOfDelivery} />
                <DataItem label="Delivery Place Name" value={localPatient.placeOfDeliveryName} />
                <DataItem label="Referring Hospital" value={localPatient.referringHospital} />
                <DataItem label="Referring District" value={localPatient.referringDistrict} />
                <DataItem label="Mode of Transport" value={localPatient.modeOfTransport} />
                <DataItem label="Doctor In Charge" value={localPatient.doctorInCharge} highlight />
              </div>
            </div>

            {/* Clinical - Indications */}
            {(localPatient.indicationsForAdmission?.length || localPatient.customIndication) && (
              <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
                <SectionTitle icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" title="Indications for Admission" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {localPatient.indicationsForAdmission?.map((ind, i) => (
                    <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg border border-blue-200">
                      {ind}
                    </span>
                  ))}
                  {localPatient.customIndication && (
                    <span className="px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded-lg border border-amber-200">
                      {localPatient.customIndication}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Discharge/Outcome Details */}
            {localPatient.releaseDate && (
              <div className={`rounded-xl p-3 shadow-sm border ${
                localPatient.outcome === 'Deceased' ? 'bg-slate-50 border-slate-300' : 'bg-emerald-50 border-emerald-200'
              }`}>
                <SectionTitle
                  icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  title={localPatient.outcome === 'Deceased' ? 'Mortality Details' : 'Discharge Details'}
                  color={localPatient.outcome === 'Deceased' ? 'slate' : 'emerald'}
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 mt-2">
                  <DataItem
                    label={localPatient.outcome === 'Deceased' ? 'Date of Death' : 'Discharge Date'}
                    value={formatDateTime(localPatient.releaseDate || localPatient.dateOfDeath)}
                  />
                  <DataItem label="Total Stay" value={`${calculateDaysAdmitted()} days`} />
                  <DataItem label="Age on Discharge" value={localPatient.ageOnDischarge ? `${localPatient.ageOnDischarge} ${localPatient.ageOnDischargeUnit || ''}` : null} />
                  <DataItem label="Weight on Discharge" value={localPatient.weightOnDischarge ? `${localPatient.weightOnDischarge} kg` : null} />
                </div>
                {localPatient.outcome === 'Deceased' && localPatient.diagnosisAtDeath && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium uppercase">Diagnosis at Death</span>
                    <p className="text-xs text-slate-700 mt-0.5">{localPatient.diagnosisAtDeath}</p>
                  </div>
                )}
                {localPatient.outcome === 'Deceased' && localPatient.aiInterpretedDeathDiagnosis && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <span className="text-[10px] text-violet-600 font-medium uppercase flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      AI Interpreted Diagnosis
                    </span>
                    <p className="text-xs text-slate-700 mt-0.5">{localPatient.aiInterpretedDeathDiagnosis}</p>
                  </div>
                )}
              </div>
            )}

            {/* Step Down Info */}
            {(localPatient.isStepDown || localPatient.stepDownDate) && (
              <div className="bg-purple-50 rounded-xl p-3 shadow-sm border border-purple-200">
                <SectionTitle icon="M19 14l-7 7m0 0l-7-7m7 7V3" title="Step Down" color="purple" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 mt-2">
                  <DataItem label="Step Down Date" value={formatDateTime(localPatient.stepDownDate)} />
                  <DataItem label="From Unit" value={localPatient.stepDownFrom ? getUnitShort(localPatient.stepDownFrom) : null} />
                  {localPatient.isStepDown && (
                    <div className="col-span-2 sm:col-span-1">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs font-medium rounded-full">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                        Currently Step Down
                      </span>
                    </div>
                  )}
                  <DataItem label="Final Discharge" value={formatDate(localPatient.finalDischargeDate)} />
                </div>
              </div>
            )}

            {/* Referral Info */}
            {localPatient.outcome === 'Referred' && (localPatient.referredTo || localPatient.referralReason) && (
              <div className="bg-amber-50 rounded-xl p-3 shadow-sm border border-amber-200">
                <SectionTitle icon="M17 8l4 4m0 0l-4 4m4-4H3" title="Referral Details" color="amber" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 mt-2">
                  <DataItem label="Referred To" value={localPatient.referredTo} />
                </div>
                {localPatient.referralReason && (
                  <div className="mt-2 pt-2 border-t border-amber-200">
                    <span className="text-[10px] text-amber-600 font-medium uppercase">Reason</span>
                    <p className="text-xs text-slate-700 mt-0.5">{localPatient.referralReason}</p>
                  </div>
                )}
              </div>
            )}

            {/* Edit History */}
            {(localPatient.editHistory && localPatient.editHistory.length > 0) && (
              <div className="bg-indigo-50 rounded-xl p-3 shadow-sm border border-indigo-200">
                <SectionTitle icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" title="Edit History" color="indigo" />
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                  {localPatient.editHistory.slice().reverse().map((edit, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs bg-white rounded-lg p-2 border border-indigo-100">
                      <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-700 font-medium truncate">{edit.changes}</p>
                        <p className="text-slate-500 text-[10px] mt-0.5">
                          {edit.editedBy} • {new Date(edit.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Record Info */}
            <div className="bg-slate-100 rounded-xl p-3 shadow-sm border border-slate-200">
              <SectionTitle icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" title="Record Info" color="slate" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 mt-2">
                <DataItem label="Created By" value={localPatient.createdByName || localPatient.createdBy} />
                <DataItem label="Created At" value={localPatient.createdAt ? new Date(localPatient.createdAt).toLocaleString() : null} />
                <DataItem label="Institution" value={localPatient.institutionName} />
                <DataItem label="Record ID" value={localPatient.id?.slice(0, 8)} mono />
                {localPatient.lastEditedAt && (
                  <DataItem label="Last Edited" value={new Date(localPatient.lastEditedAt).toLocaleString()} />
                )}
                {localPatient.lastUpdatedByName && (
                  <DataItem label="Last Edited By" value={localPatient.lastUpdatedByName} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <ClinicalNotesNavigator
            notes={localPatient.progressNotes || []}
            patient={localPatient}
            canEdit={canEdit}
            onAddNote={() => setShowNoteForm(true)}
          />
        )}

        {/* Meds Tab */}
        {activeTab === 'meds' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <MedicationManagement
              medications={(localPatient as any).medications || []}
              onUpdate={handleUpdateMedications}
              userRole={userRole}
              userName={userName}
              userEmail={userEmail}
              readOnly={!canEdit}
            />
          </div>
        )}

        {/* AI Tab */}
        {activeTab === 'ai' && (
          <div className="space-y-3">
            <button
              onClick={handleGenerateSummary}
              disabled={isLoadingSummary}
              className="w-full py-3.5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg"
            >
              {isLoadingSummary ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate AI Clinical Summary
                </>
              )}
            </button>

            {summary && (
              <div className="bg-white rounded-xl shadow-sm border border-violet-200 overflow-hidden">
                <div className="px-3 py-2 bg-violet-500 text-white flex items-center justify-between">
                  <span className="font-semibold text-sm flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI Summary
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(summary);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-xs font-medium"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="p-3">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
                </div>
              </div>
            )}

            {!summary && !isLoadingSummary && (
              <div className="bg-violet-50 rounded-xl border border-violet-200 p-6 text-center">
                <div className="w-12 h-12 mx-auto bg-violet-500 rounded-xl flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-violet-800 font-semibold">AI-Powered Summary</p>
                <p className="text-violet-600 text-sm mt-1">Generate handoff summary for shift changes</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Note Form Modal */}
      {showNoteForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-full flex items-start sm:items-center justify-center p-4">
            <div className="bg-white w-full sm:max-w-2xl rounded-2xl shadow-2xl flex flex-col my-4">
              <div className="px-4 py-3 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white flex items-center justify-between flex-shrink-0 rounded-t-2xl">
                <h3 className="font-bold flex items-center gap-2">
                  <span className="text-xl">🎙️</span>
                  <span>Add Note</span>
                  <span className="text-lg">✨</span>
                </h3>
                <button onClick={() => setShowNoteForm(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 pb-6">
                <ProgressNoteForm
                  onSave={handleSaveNote}
                  onCancel={() => setShowNoteForm(false)}
                  onBackgroundSave={handleBackgroundSave}
                  onUpdatePatient={(updatedPatient) => {
                    // Use updatePatientState to sync ref immediately (prevents race condition)
                    updatePatientState(updatedPatient);
                    if (onPatientUpdate) {
                      onPatientUpdate(updatedPatient);
                    }
                  }}
                  lastNote={localPatient.progressNotes?.length > 0 ? localPatient.progressNotes[localPatient.progressNotes.length - 1] : undefined}
                  userEmail={userEmail}
                  userName={userName || userEmail}
                  patient={localPatient}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discharge Summary Modal */}
      {showDischargeSummary && (
        <DischargeSummaryModal
          patient={localPatient}
          onClose={() => setShowDischargeSummary(false)}
          userName={userName || userEmail}
          userRole={userRole || 'Doctor'}
          onPatientUpdate={onPatientUpdate}
        />
      )}
    </div>
  );
};

// Compact Section Title
const SectionTitle: React.FC<{ icon: string; title: string; color?: string }> = ({ icon, title, color = 'blue' }) => {
  const colors: Record<string, string> = {
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
    purple: 'text-purple-600',
    amber: 'text-amber-600',
    slate: 'text-slate-600',
    pink: 'text-pink-600',
  };

  return (
    <div className={`flex items-center gap-1.5 ${colors[color]} text-xs font-semibold`}>
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
      </svg>
      <span className="uppercase tracking-wide">{title}</span>
    </div>
  );
};

// Compact Data Item
const DataItem: React.FC<{ label: string; value: string | number | null | undefined; sub?: string; highlight?: boolean; mono?: boolean }> = ({
  label, value, sub, highlight, mono
}) => {
  if (!value) return null;

  return (
    <div>
      <div className="text-[10px] text-slate-500 font-medium uppercase">{label}</div>
      <div className={`text-xs font-medium mt-0.5 ${highlight ? 'text-blue-700' : 'text-slate-800'} ${mono ? 'font-mono' : ''}`}>
        {value}
        {sub && <span className="text-slate-500 font-normal ml-1">({sub})</span>}
      </div>
    </div>
  );
};

export default PatientViewPage;
