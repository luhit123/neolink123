import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Patient,
  Unit,
  FeedingType,
  VaccinationType,
  ScreeningStatus,
  DischargeSummary,
  DischargeVitals,
  DischargeFeeding,
  DischargeMedication,
  NHMFollowUpSchedule,
  DischargeScreenings,
  DischargeType
} from '../types';
import {
  createDischargeSummaryFromPatient,
  downloadDischargeSummaryPDF,
  previewDischargeSummaryPDF
} from '../services/dischargeSummaryService';
import {
  generateDischargeClinicalSummary,
  generateDischargeAdvice,
  generateWarningSignsForDischarge,
  generateFinalDiagnosis
} from '../services/openaiService';
import { haptics } from '../utils/haptics';
import { db } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { showToast } from '../utils/toast';

interface DischargeSummaryModalProps {
  patient: Patient;
  onClose: () => void;
  onPatientUpdate?: (patient: Patient) => void;
  userName?: string;
  userRole?: string;
  institutionAddress?: string;
  hospitalHelpline?: string;
  viewMode?: boolean;
}

const DischargeSummaryModal: React.FC<DischargeSummaryModalProps> = ({
  patient,
  onClose,
  onPatientUpdate,
  userName = 'Doctor',
  userRole = 'Attending Physician',
  institutionAddress,
  hospitalHelpline,
  viewMode = false
}) => {
  const isNICU = patient.unit === Unit.NICU || patient.unit === Unit.SNCU;
  const hasSavedDischarge = !!patient.savedDischargeSummary;

  // Form state
  const [activeSection, setActiveSection] = useState(0);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(hasSavedDischarge);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showSectionMenu, setShowSectionMenu] = useState(false);

  // Discharge Type
  const [dischargeType, setDischargeType] = useState<DischargeType>(DischargeType.Normal);
  const [damaReason, setDamaReason] = useState('');
  const [damaWitnessName, setDamaWitnessName] = useState('');
  const [damaAcknowledgement, setDamaAcknowledgement] = useState(false);

  // Clinical Summary
  const [clinicalSummary, setClinicalSummary] = useState('');
  const [finalDiagnosis, setFinalDiagnosis] = useState('');

  // Discharge Vitals
  const [vitals, setVitals] = useState<DischargeVitals>({
    weight: patient.weightOnDischarge || patient.birthWeight || 0,
    length: undefined,
    headCircumference: undefined,
    temperature: '',
    heartRate: '',
    respiratoryRate: '',
    spo2: '',
    bloodPressure: ''
  });

  // Condition at Discharge
  const [conditionAtDischarge, setConditionAtDischarge] = useState<'Stable' | 'Improved' | 'Guarded' | 'Critical'>('Stable');
  const [generalCondition, setGeneralCondition] = useState('Good');
  const [activity, setActivity] = useState('Active, Alert');
  const [suckingReflex, setSuckingReflex] = useState<'Good' | 'Fair' | 'Poor'>('Good');

  // Feeding
  const [feeding, setFeeding] = useState<DischargeFeeding>({
    feedingType: FeedingType.ExclusiveBreastfeeding,
    feedingVolume: '',
    feedingFrequency: '3 hourly',
    calories: '',
    specialInstructions: ''
  });

  // Medications
  const [medications, setMedications] = useState<DischargeMedication[]>([]);
  const [vaccinations, setVaccinations] = useState<VaccinationType[]>([]);
  const [screenings, setScreenings] = useState<DischargeScreenings>({
    hearingScreenDone: false,
    hearingScreenResult: ScreeningStatus.NotDone,
    metabolicScreenDone: false,
    metabolicScreenResult: ScreeningStatus.NotDone,
    ropScreeningDone: false,
    carSeatTestDone: false
  });

  const [specialFollowUp, setSpecialFollowUp] = useState('');
  const [treatmentReceived, setTreatmentReceived] = useState<string[]>([]);
  const [dischargeAdvice, setDischargeAdvice] = useState<string[]>([]);
  const [warningsSigns, setWarningsSigns] = useState<string[]>([]);

  // Initialize treatment received
  useEffect(() => {
    const treatments = (patient.medications || []).map(med => {
      const parts = [med.name];
      if (med.dose) parts.push(med.dose);
      if (med.route) parts.push(`(${med.route})`);
      if (med.frequency) parts.push(`- ${med.frequency}`);
      return parts.join(' ');
    });
    setTreatmentReceived(treatments);
  }, [patient.medications]);

  // Initialize follow-up medications
  useEffect(() => {
    const defaultMeds: DischargeMedication[] = isNICU ? [
      {
        name: 'Vitamin D3 Drops (400 IU/mL)',
        frequency: '1 mL once daily',
        duration: 'Up to 1 year of age',
        instructions: 'Give orally with feeding'
      }
    ] : [];
    setMedications(defaultMeds);
  }, [isNICU]);

  const isViewingExisting = patient.outcome === 'Discharged' || viewMode;

  // Load saved discharge data or generate new AI content
  useEffect(() => {
    if (hasSavedDischarge && patient.savedDischargeSummary) {
      const saved = patient.savedDischargeSummary;
      setClinicalSummary(saved.clinicalCourseSummary || '');
      setFinalDiagnosis(saved.finalDiagnosis || '');
      setDischargeAdvice(saved.dischargeAdvice || []);
      setWarningsSigns(saved.warningSignsToWatch || []);
      if (saved.dischargeType) setDischargeType(saved.dischargeType);
      if (saved.damaReason) setDamaReason(saved.damaReason);
      if (saved.damaWitnessName) setDamaWitnessName(saved.damaWitnessName);
      if (saved.damaAcknowledgement) setDamaAcknowledgement(saved.damaAcknowledgement);
      if (saved.dischargeVitals) setVitals(saved.dischargeVitals);
      if (saved.conditionAtDischarge) setConditionAtDischarge(saved.conditionAtDischarge);
      if (saved.generalCondition) setGeneralCondition(saved.generalCondition);
      if (saved.activity) setActivity(saved.activity);
      if (saved.suckingReflex) setSuckingReflex(saved.suckingReflex);
      if (saved.dischargeFeeding) setFeeding(saved.dischargeFeeding);
      if (saved.dischargeMedications) setMedications(saved.dischargeMedications);
      if (saved.vaccinationsGiven) setVaccinations(saved.vaccinationsGiven);
      if (saved.screenings) setScreenings(saved.screenings);
      if (saved.nhmFollowUpSchedule?.specialFollowUp) setSpecialFollowUp(saved.nhmFollowUpSchedule.specialFollowUp);
      if (saved.treatmentReceived) setTreatmentReceived(saved.treatmentReceived);
      setIsSaved(true);
      setTimeout(() => handlePreviewPDF(), 300);
    } else if (!viewMode && !clinicalSummary) {
      handleGenerateAllAI();
    }
  }, []);

  const handleGenerateAllAI = async () => {
    setIsGeneratingAI(true);
    haptics.tap();
    try {
      const [summary, diagnosis, advice, warnings] = await Promise.all([
        generateDischargeClinicalSummary(patient),
        generateFinalDiagnosis(patient),
        generateDischargeAdvice(patient, isNICU),
        generateWarningSignsForDischarge(patient, isNICU)
      ]);
      setClinicalSummary(summary);
      setFinalDiagnosis(diagnosis);
      setDischargeAdvice(advice);
      setWarningsSigns(warnings);
      haptics.success();
    } catch (error) {
      console.error('Error generating AI content:', error);
      haptics.error();
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSaveDischarge = async () => {
    setIsSaving(true);
    haptics.tap();
    try {
      const summary = buildDischargeSummary();
      const now = new Date().toISOString();
      const patientRef = doc(db, 'patients', patient.id);
      await updateDoc(patientRef, {
        savedDischargeSummary: summary,
        dischargeSavedAt: now,
        dischargeSavedBy: userName
      });
      if (onPatientUpdate) {
        onPatientUpdate({
          ...patient,
          savedDischargeSummary: summary,
          dischargeSavedAt: now,
          dischargeSavedBy: userName
        });
      }
      setIsSaved(true);
      haptics.success();
      showToast('success', 'Discharge summary saved');
    } catch (error) {
      console.error('Error saving discharge:', error);
      haptics.error();
      showToast('error', 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePDF = () => {
    if (!isSaved) {
      showToast('warning', 'Please save first');
      return;
    }
    setIsGeneratingPDF(true);
    haptics.tap();
    try {
      const summary = buildDischargeSummary();
      downloadDischargeSummaryPDF(summary, patient);
      haptics.success();
    } catch (error) {
      console.error('Error generating PDF:', error);
      haptics.error();
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePreviewPDF = () => {
    haptics.tap();
    try {
      const summary = buildDischargeSummary();
      const url = previewDischargeSummaryPDF(summary, patient);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Error previewing PDF:', error);
      haptics.error();
    }
  };

  const buildDischargeSummary = (): DischargeSummary => {
    let finalAdvice = [...dischargeAdvice];
    let finalWarnings = [...warningsSigns];

    if (dischargeType === DischargeType.DAMA || dischargeType === DischargeType.DOR) {
      finalAdvice = [
        'Baby is being discharged against medical advice / on request before completing treatment',
        'Immediate hospitalization is advised if condition worsens',
        ...finalAdvice
      ];
      finalWarnings = [
        'SEEK IMMEDIATE MEDICAL ATTENTION if any danger signs appear',
        ...finalWarnings
      ];
    }

    if (dischargeType === DischargeType.LAMA) {
      finalAdvice = [
        'Patient left against medical advice without completing treatment',
        'Immediate medical evaluation recommended',
        ...finalAdvice
      ];
      finalWarnings = [
        'HIGH RISK: Patient left without medical clearance',
        ...finalWarnings
      ];
    }

    return createDischargeSummaryFromPatient(patient, {
      hospitalAddress: institutionAddress,
      dischargeType,
      damaReason: damaReason || undefined,
      damaWitnessName: damaWitnessName || undefined,
      damaAcknowledgement,
      clinicalCourseSummary: clinicalSummary,
      finalDiagnosis: finalDiagnosis || undefined,
      dischargeVitals: vitals,
      conditionAtDischarge,
      generalCondition,
      activity,
      suckingReflex,
      dischargeFeeding: feeding,
      treatmentReceived,
      dischargeMedications: medications,
      vaccinationsGiven: vaccinations,
      screenings,
      nhmFollowUpSchedule: isNICU ? {
        homeVisits: { day3: true, day7: true, day14: true, day21: true, day28: true, day42: true },
        facilityVisits: { month3: true, month6: true, month9: true, year1: true },
        specialFollowUp: specialFollowUp || undefined,
        additionalInstructions: undefined
      } : undefined,
      dischargeAdvice: finalAdvice,
      warningSignsToWatch: finalWarnings,
      hospitalHelpline,
      preparedBy: userName,
      preparedByRole: userRole
    });
  };

  const sections = isNICU ? [
    { id: 'clinical', title: 'Summary', shortTitle: 'Summary' },
    { id: 'vitals', title: 'Vitals', shortTitle: 'Vitals' },
    { id: 'feeding', title: 'Feeding', shortTitle: 'Feed' },
    { id: 'treatment', title: 'Treatment', shortTitle: 'Treat' },
    { id: 'meds', title: 'Medications', shortTitle: 'Meds' },
    { id: 'vaccines', title: 'Vaccines', shortTitle: 'Vax' },
    { id: 'followup', title: 'Follow-up', shortTitle: 'F/U' },
    { id: 'advice', title: 'Advice', shortTitle: 'Advice' }
  ] : [
    { id: 'clinical', title: 'Summary', shortTitle: 'Summary' },
    { id: 'vitals', title: 'Vitals', shortTitle: 'Vitals' },
    { id: 'feeding', title: 'Feeding', shortTitle: 'Feed' },
    { id: 'treatment', title: 'Treatment', shortTitle: 'Treat' },
    { id: 'meds', title: 'Medications', shortTitle: 'Meds' },
    { id: 'vaccines', title: 'Vaccines', shortTitle: 'Vax' },
    { id: 'advice', title: 'Advice', shortTitle: 'Advice' }
  ];

  const addMedication = () => {
    setMedications([...medications, { name: '', frequency: '', duration: '', instructions: '' }]);
  };

  const removeMedication = (index: number) => {
    if (isNICU && index === 0) return;
    setMedications(medications.filter((_, i) => i !== index));
  };

  const updateMedication = (index: number, field: keyof DischargeMedication, value: string) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
  };

  const toggleVaccination = (vax: VaccinationType) => {
    if (vaccinations.includes(vax)) {
      setVaccinations(vaccinations.filter(v => v !== vax));
    } else {
      setVaccinations([...vaccinations, vax]);
    }
  };

  const themeColor = isNICU ? 'sky' : 'violet';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="bg-white w-full sm:w-[95%] sm:max-w-3xl h-[95vh] sm:h-[90vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden rounded-t-3xl"
        >
          {/* Header - Compact */}
          <div className={`px-4 py-3 flex items-center justify-between flex-shrink-0 bg-gradient-to-r ${
            isNICU ? 'from-sky-500 to-cyan-600' : 'from-violet-500 to-purple-600'
          } text-white safe-area-top`}>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-bold truncate">Discharge Summary</h2>
              <p className="text-xs text-white/80 truncate">{patient.name}</p>
            </div>
            <div className="flex items-center gap-2">
              {isGeneratingAI && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-white/20 rounded-lg">
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">AI...</span>
                </div>
              )}
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Section Navigation - Mobile Optimized */}
          <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50">
            {/* Mobile: Dropdown */}
            <div className="sm:hidden p-2">
              <button
                onClick={() => setShowSectionMenu(!showSectionMenu)}
                className={`w-full px-4 py-2.5 rounded-xl flex items-center justify-between bg-white border-2 ${
                  isNICU ? 'border-sky-200' : 'border-violet-200'
                }`}
              >
                <span className={`font-semibold ${isNICU ? 'text-sky-700' : 'text-violet-700'}`}>
                  {activeSection + 1}. {sections[activeSection].title}
                </span>
                <svg className={`w-5 h-5 transition-transform ${showSectionMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <AnimatePresence>
                {showSectionMenu && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 bg-white rounded-xl border border-slate-200 overflow-hidden"
                  >
                    {sections.map((section, index) => (
                      <button
                        key={section.id}
                        onClick={() => { setActiveSection(index); setShowSectionMenu(false); }}
                        className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b border-slate-100 last:border-0 ${
                          activeSection === index
                            ? isNICU ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          activeSection === index
                            ? isNICU ? 'bg-sky-500 text-white' : 'bg-violet-500 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}>{index + 1}</span>
                        <span className="font-medium">{section.title}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Desktop: Horizontal tabs */}
            <div className="hidden sm:flex p-2 gap-1 overflow-x-auto">
              {sections.map((section, index) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(index)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeSection === index
                      ? isNICU ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    activeSection === index
                      ? isNICU ? 'bg-sky-500 text-white' : 'bg-violet-500 text-white'
                      : 'bg-slate-300 text-slate-600'
                  }`}>{index + 1}</span>
                  {section.title}
                </button>
              ))}
            </div>
          </div>

          {/* Discharge Type - Always visible, compact */}
          <div className={`flex-shrink-0 px-3 py-2 border-b flex flex-wrap items-center gap-2 ${
            dischargeType === DischargeType.Normal ? 'bg-emerald-50 border-emerald-200' :
            dischargeType === DischargeType.DOR ? 'bg-amber-50 border-amber-200' :
            'bg-red-50 border-red-200'
          }`}>
            <span className="text-xs font-semibold text-slate-600">Type:</span>
            <div className="flex gap-1">
              {[
                { type: DischargeType.Normal, label: 'Normal', color: 'emerald' },
                { type: DischargeType.DOR, label: 'DOR', color: 'amber' },
                { type: DischargeType.DAMA, label: 'DAMA', color: 'red' },
                { type: DischargeType.LAMA, label: 'LAMA', color: 'red' }
              ].map(({ type, label, color }) => (
                <button
                  key={type}
                  onClick={() => setDischargeType(type)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    dischargeType === type
                      ? color === 'emerald' ? 'bg-emerald-500 text-white' :
                        color === 'amber' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {(dischargeType !== DischargeType.Normal) && (
              <input
                type="text"
                value={damaReason}
                onChange={(e) => setDamaReason(e.target.value)}
                placeholder="Reason..."
                className="flex-1 min-w-[100px] px-2 py-1 text-xs border border-slate-200 rounded-lg"
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Clinical Summary Section */}
            {activeSection === 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Clinical Summary</h3>
                  <button
                    onClick={handleGenerateAllAI}
                    disabled={isGeneratingAI}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isNICU ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'
                    } disabled:opacity-50`}
                  >
                    {isGeneratingAI ? 'Generating...' : 'Regenerate AI'}
                  </button>
                </div>
                <textarea
                  value={clinicalSummary}
                  onChange={(e) => setClinicalSummary(e.target.value)}
                  placeholder="Clinical course summary..."
                  className="w-full h-32 p-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
                />

                <div className="pt-4 border-t">
                  <h3 className="font-bold text-slate-800 mb-2">Final Diagnosis</h3>
                  <textarea
                    value={finalDiagnosis}
                    onChange={(e) => setFinalDiagnosis(e.target.value)}
                    placeholder="Final diagnosis..."
                    className="w-full h-20 p-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            )}

            {/* Vitals Section */}
            {activeSection === 1 && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800">Discharge Vitals</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Weight (kg)', key: 'weight', type: 'number' },
                    { label: 'Length (cm)', key: 'length', type: 'number' },
                    { label: 'Head Circ (cm)', key: 'headCircumference', type: 'number' },
                    { label: 'Temperature', key: 'temperature', placeholder: '36.8°C' },
                    { label: 'Heart Rate', key: 'heartRate', placeholder: '140/min' },
                    { label: 'SpO2', key: 'spo2', placeholder: '98%' }
                  ].map(({ label, key, type, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                      <input
                        type={type || 'text'}
                        value={(vitals as any)[key] || ''}
                        onChange={(e) => setVitals({ ...vitals, [key]: type === 'number' ? parseFloat(e.target.value) || undefined : e.target.value })}
                        placeholder={placeholder}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t">
                  <h3 className="font-bold text-slate-800 mb-3">Condition</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Overall</label>
                      <select
                        value={conditionAtDischarge}
                        onChange={(e) => setConditionAtDischarge(e.target.value as any)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        {['Stable', 'Improved', 'Guarded', 'Critical'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Activity</label>
                      <input
                        type="text"
                        value={activity}
                        onChange={(e) => setActivity(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Feeding Section */}
            {activeSection === 2 && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800">Feeding at Discharge</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Feeding Type</label>
                    <select
                      value={feeding.feedingType}
                      onChange={(e) => setFeeding({ ...feeding, feedingType: e.target.value as FeedingType })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      {Object.values(FeedingType).map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Frequency</label>
                      <input
                        type="text"
                        value={feeding.feedingFrequency || ''}
                        onChange={(e) => setFeeding({ ...feeding, feedingFrequency: e.target.value })}
                        placeholder="3 hourly"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Volume</label>
                      <input
                        type="text"
                        value={feeding.feedingVolume || ''}
                        onChange={(e) => setFeeding({ ...feeding, feedingVolume: e.target.value })}
                        placeholder="60ml/feed"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Treatment Received Section */}
            {activeSection === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Treatment Received</h3>
                  <button
                    onClick={() => setTreatmentReceived([...treatmentReceived, ''])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      isNICU ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'
                    }`}
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-2">
                  {treatmentReceived.map((treatment, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={treatment}
                        onChange={(e) => {
                          const updated = [...treatmentReceived];
                          updated[index] = e.target.value;
                          setTreatmentReceived(updated);
                        }}
                        placeholder="Treatment..."
                        className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                      <button
                        onClick={() => setTreatmentReceived(treatmentReceived.filter((_, i) => i !== index))}
                        className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {treatmentReceived.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">No treatments added</p>
                  )}
                </div>
              </div>
            )}

            {/* Medications Section */}
            {activeSection === 4 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Follow-up Medications</h3>
                  <button onClick={addMedication} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold">
                    + Add Med
                  </button>
                </div>
                <div className="space-y-3">
                  {medications.map((med, index) => (
                    <div key={index} className={`p-3 rounded-xl border ${isNICU && index === 0 ? 'bg-sky-50 border-sky-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-slate-500">Med #{index + 1}</span>
                        {!(isNICU && index === 0) && (
                          <button onClick={() => removeMedication(index)} className="text-red-500 p-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={med.name}
                          onChange={(e) => updateMedication(index, 'name', e.target.value)}
                          placeholder="Name"
                          disabled={isNICU && index === 0}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={med.frequency}
                            onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                            placeholder="Frequency"
                            disabled={isNICU && index === 0}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                          />
                          <input
                            type="text"
                            value={med.duration || ''}
                            onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                            placeholder="Duration"
                            disabled={isNICU && index === 0}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vaccines Section */}
            {activeSection === 5 && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800">Vaccinations Given</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(VaccinationType).map(vax => (
                    <label key={vax} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      vaccinations.includes(vax) ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={vaccinations.includes(vax)}
                        onChange={() => toggleVaccination(vax)}
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      <span className="text-sm">{vax}</span>
                    </label>
                  ))}
                </div>

                {isNICU && (
                  <div className="pt-4 border-t">
                    <h3 className="font-bold text-slate-800 mb-3">Screenings</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'hearingScreenDone', label: 'Hearing Screen' },
                        { key: 'metabolicScreenDone', label: 'Metabolic Screen' },
                        { key: 'ropScreeningDone', label: 'ROP Screening' },
                        { key: 'carSeatTestDone', label: 'Car Seat Test' }
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 p-3 rounded-xl border bg-white border-slate-200">
                          <input
                            type="checkbox"
                            checked={(screenings as any)[key]}
                            onChange={(e) => setScreenings({ ...screenings, [key]: e.target.checked })}
                            className="w-4 h-4 text-sky-600 rounded"
                          />
                          <span className="text-sm">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* NHM Follow-up Section (NICU only) */}
            {activeSection === 6 && isNICU && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800">NHM Follow-up Schedule</h3>
                <div className="p-3 bg-sky-50 rounded-xl border border-sky-200">
                  <p className="font-semibold text-sky-800 text-sm mb-2">Home Visits (ASHA)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['Day 3', 'Day 7', 'Day 14', 'Day 21', 'Day 28', 'Day 42'].map(day => (
                      <span key={day} className="px-2 py-1 bg-white rounded-lg text-xs text-sky-700 border border-sky-200">{day}</span>
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <p className="font-semibold text-emerald-800 text-sm mb-2">Facility Visits</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['3 Mo', '6 Mo', '9 Mo', '1 Year'].map(m => (
                      <span key={m} className="px-2 py-1 bg-white rounded-lg text-xs text-emerald-700 border border-emerald-200">{m}</span>
                    ))}
                  </div>
                </div>
                <textarea
                  value={specialFollowUp}
                  onChange={(e) => setSpecialFollowUp(e.target.value)}
                  placeholder="Special follow-up notes..."
                  className="w-full h-20 p-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            )}

            {/* Advice Section */}
            {activeSection === (isNICU ? 7 : 6) && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-800">Discharge Advice</h3>
                    <button onClick={() => setDischargeAdvice([...dischargeAdvice, ''])} className="text-xs text-blue-600 font-semibold">+ Add</button>
                  </div>
                  <div className="space-y-2">
                    {dischargeAdvice.map((advice, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={advice}
                          onChange={(e) => {
                            const updated = [...dischargeAdvice];
                            updated[index] = e.target.value;
                            setDischargeAdvice(updated);
                          }}
                          className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
                        />
                        <button onClick={() => setDischargeAdvice(dischargeAdvice.filter((_, i) => i !== index))} className="p-2 text-red-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-red-700">Warning Signs</h3>
                    <button onClick={() => setWarningsSigns([...warningsSigns, ''])} className="text-xs text-red-600 font-semibold">+ Add</button>
                  </div>
                  <div className="space-y-2 p-3 bg-red-50 rounded-xl border border-red-200">
                    {warningsSigns.map((warning, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={warning}
                          onChange={(e) => {
                            const updated = [...warningsSigns];
                            updated[index] = e.target.value;
                            setWarningsSigns(updated);
                          }}
                          className="flex-1 px-3 py-2.5 border border-red-200 rounded-xl text-sm bg-white"
                        />
                        <button onClick={() => setWarningsSigns(warningsSigns.filter((_, i) => i !== index))} className="p-2 text-red-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Mobile Optimized */}
          <div className="flex-shrink-0 border-t border-slate-200 p-3 bg-white safe-area-bottom">
            {isSaved && (
              <div className="mb-2 flex items-center justify-center gap-1.5 text-green-600 text-xs">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Saved</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handlePreviewPDF}
                className="flex-1 py-3 px-4 border-2 border-slate-200 text-slate-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </button>

              {!isSaved ? (
                <button
                  onClick={handleSaveDischarge}
                  disabled={isSaving || isGeneratingAI}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              ) : (
                <button
                  onClick={handleGeneratePDF}
                  disabled={isGeneratingPDF}
                  className={`flex-1 py-3 px-4 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-gradient-to-r ${
                    isNICU ? 'from-sky-500 to-cyan-600' : 'from-violet-500 to-purple-600'
                  } disabled:opacity-50`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* PDF Preview - Full Screen on Mobile */}
        <AnimatePresence>
          {previewUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[60] flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-slate-900">
                <h3 className="font-semibold text-white">Preview</h3>
                <button
                  onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <iframe src={previewUrl} className="flex-1 w-full bg-white" title="Preview" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default DischargeSummaryModal;
