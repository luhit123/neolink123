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
  generateFinalDiagnosis,
  generateEnhancedFinalDiagnosis,
  generateEnhancedClinicalCourseSummary
} from '../services/openaiService';
import { generateComprehensiveClinicalSummary, ClinicalWarning } from '../services/clinicalIntelligenceService';
import { haptics } from '../utils/haptics';
import { db } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { showToast } from '../utils/toast';
import { syncDischargeSummaryToSupabase } from '../services/supabaseSyncService';

interface DischargeSummaryModalProps {
  patient: Patient;
  onClose: () => void;
  onPatientUpdate?: (patient: Patient) => void;
  userName?: string;
  userRole?: string;
  institutionAddress?: string;
  hospitalHelpline?: string;
  viewMode?: boolean;
  institutionId?: string;
}

const DischargeSummaryModal: React.FC<DischargeSummaryModalProps> = ({
  patient,
  onClose,
  onPatientUpdate,
  userName = 'Doctor',
  userRole = 'Attending Physician',
  institutionAddress,
  hospitalHelpline,
  viewMode = false,
  institutionId
}) => {
  const isNICU = patient.unit === Unit.NICU || patient.unit === Unit.SNCU;
  const hasSavedDischarge = !!patient.savedDischargeSummary;

  // Form state
  const [activeSection, setActiveSection] = useState(0);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiGenerationComplete, setAiGenerationComplete] = useState(hasSavedDischarge); // AI is already done if loaded from saved
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(hasSavedDischarge);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showSectionMenu, setShowSectionMenu] = useState(false);

  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);

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
  // Pre-select all vaccines by default (BCG, OPV-0, Hep B-0, Vitamin K)
  const [vaccinations, setVaccinations] = useState<VaccinationType[]>([
    VaccinationType.BCG,
    VaccinationType.OPV0,
    VaccinationType.HepB0,
    VaccinationType.VitaminK
  ]);
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

  // Initialize treatment received - extract medications from patient.medications AND progressNotes
  useEffect(() => {
    // Collect all medications from multiple sources
    const allMedications: { name: string; startDate?: string; stopDate?: string; isActive?: boolean }[] = [];

    // Source 1: patient.medications (main medication list)
    if (patient.medications && patient.medications.length > 0) {
      patient.medications.forEach(med => {
        if (med.name) {
          allMedications.push({
            name: med.name,
            startDate: med.startDate,
            stopDate: med.stopDate,
            isActive: med.isActive
          });
        }
      });
    }

    // Source 2: progressNotes[].medications (medications documented in clinical notes)
    if (patient.progressNotes && patient.progressNotes.length > 0) {
      patient.progressNotes.forEach(note => {
        if (note.medications && note.medications.length > 0) {
          note.medications.forEach(med => {
            if (med.name) {
              // Check if this medication is already in the list (avoid duplicates)
              const exists = allMedications.some(
                existing => existing.name.toLowerCase() === med.name.toLowerCase()
              );
              if (!exists) {
                allMedications.push({
                  name: med.name,
                  startDate: med.startDate || note.date,
                  stopDate: med.stopDate,
                  isActive: med.isActive
                });
              }
            }
          });
        }
      });
    }

    // Format medications with duration
    const treatments = allMedications.map(med => {
      let duration = '';

      // Calculate duration from start/stop dates
      if (med.startDate) {
        const startDate = new Date(med.startDate);
        let endDate: Date;

        if (med.stopDate) {
          endDate = new Date(med.stopDate);
        } else {
          endDate = new Date();
        }

        const durationMs = endDate.getTime() - startDate.getTime();
        const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

        if (durationDays === 0) {
          duration = ' - Single dose';
        } else if (durationDays === 1) {
          duration = ' - 1 day';
        } else {
          duration = ` - ${durationDays} days`;
        }
      }

      return `${med.name}${duration}`;
    });

    // Only update if we have medications
    if (treatments.length > 0) {
      setTreatmentReceived(treatments);
    }
  }, [patient.medications, patient.progressNotes]);

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

  // Load saved discharge data (if exists)
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
      setAiGenerationComplete(true);
    }
  }, []);

  // Clinical warnings from intelligence service
  const [clinicalWarnings, setClinicalWarnings] = useState<ClinicalWarning[]>([]);

  // Auto-generate AI content on mount
  useEffect(() => {
    if (!hasSavedDischarge && !viewMode) {
      handleGenerateAllAI();
    }
  }, []);

  const handleGenerateAllAI = async () => {
    setIsGeneratingAI(true);
    haptics.tap();

    try {
      // Use enhanced clinical intelligence for accurate diagnosis
      const [enhancedDiagnosis, enhancedSummary, advice, warnings] = await Promise.all([
        generateEnhancedFinalDiagnosis(patient),
        generateEnhancedClinicalCourseSummary(patient),
        generateDischargeAdvice(patient, isNICU),
        generateWarningSignsForDischarge(patient, isNICU)
      ]);

      // Set diagnosis with validation
      setFinalDiagnosis(enhancedDiagnosis.diagnosis);
      setClinicalWarnings(enhancedDiagnosis.clinicalSummary.warnings);

      // Set clinical summary
      setClinicalSummary(enhancedSummary.summary);

      // Update treatment received from clinical analysis
      if (enhancedSummary.treatmentProvided.length > 0) {
        setTreatmentReceived(enhancedSummary.treatmentProvided);
      }

      // Set discharge advice and warning signs
      setDischargeAdvice(advice);
      setWarningsSigns(warnings);

      // Show warnings if any validation issues
      if (enhancedDiagnosis.warnings.length > 0) {
        console.warn('Clinical validation warnings:', enhancedDiagnosis.warnings);
        showToast('warning', `${enhancedDiagnosis.warnings.length} validation issue(s) found - please review`);
      }

      setAiGenerationComplete(true);
      haptics.success();
    } catch (error) {
      console.error('Error generating AI content:', error);
      // Fallback to basic generation
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
        setAiGenerationComplete(true);
      } catch (fallbackError) {
        console.error('Fallback generation also failed:', fallbackError);
        showToast('error', 'Failed to generate discharge content');
      }
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

      // Sync to Supabase in background (non-blocking)
      if (patient.institutionId) {
        syncDischargeSummaryToSupabase(patient.id, summary, patient.name, patient.institutionId)
          .catch(err => console.error('Background Supabase discharge sync failed:', err));
      }
    } catch (error) {
      console.error('Error saving discharge:', error);
      haptics.error();
      showToast('error', 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!isSaved) {
      showToast('warning', 'Please save first');
      return;
    }
    setIsGeneratingPDF(true);
    haptics.tap();
    try {
      const summary = buildDischargeSummary();
      await downloadDischargeSummaryPDF(summary, patient);
      haptics.success();
    } catch (error) {
      console.error('Error generating PDF:', error);
      haptics.error();
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePreviewPDF = async () => {
    haptics.tap();
    try {
      const summary = buildDischargeSummary();
      const url = await previewDischargeSummaryPDF(summary, patient);
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

  // Generate AI-powered discharge advice
  const handleGenerateAdviceFromDiagnosis = async () => {
    if (!finalDiagnosis.trim()) {
      showToast('warning', 'Please enter a diagnosis first');
      return;
    }

    setIsGeneratingAdvice(true);
    haptics.tap();

    try {
      const [advice, warnings] = await Promise.all([
        generateDischargeAdvice(patient, isNICU),
        generateWarningSignsForDischarge(patient, isNICU)
      ]);

      setDischargeAdvice(advice);
      setWarningsSigns(warnings);

      showToast('success', 'Generated discharge advice');
      haptics.success();

    } catch (error) {
      console.error('Error generating advice:', error);
      showToast('error', 'Failed to generate advice. Please try again.');
      haptics.error();
    } finally {
      setIsGeneratingAdvice(false);
    }
  };

  const themeColor = isNICU ? 'sky' : 'violet';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center overflow-hidden"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="bg-white w-full sm:w-[95%] sm:max-w-3xl h-[100dvh] sm:h-[90vh] max-h-[100dvh] sm:max-h-[90vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden rounded-t-3xl"
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
              <div className="space-y-5">
                {/* Final Diagnosis - Simple Text Input */}
                <div className={`p-4 rounded-xl border-2 ${isNICU ? 'bg-sky-50 border-sky-200' : 'bg-violet-50 border-violet-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isNICU ? 'bg-sky-500' : 'bg-violet-500'}`}>
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className={`font-bold ${isNICU ? 'text-sky-800' : 'text-violet-800'}`}>Final Diagnosis</h3>
                        <p className={`text-xs ${isNICU ? 'text-sky-600' : 'text-violet-600'}`}>Auto-filled from admission diagnosis</p>
                      </div>
                    </div>
                  </div>
                  <textarea
                    value={finalDiagnosis}
                    onChange={(e) => setFinalDiagnosis(e.target.value)}
                    placeholder="e.g., Preterm (32 weeks), Low Birth Weight (1.5 kg), Respiratory Distress Syndrome, Neonatal Sepsis - resolved"
                    className={`w-full h-24 p-3 border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 ${
                      isNICU
                        ? 'border-sky-200 focus:ring-sky-400 bg-white'
                        : 'border-violet-200 focus:ring-violet-400 bg-white'
                    } text-slate-800`}
                  />
                  <p className={`text-xs mt-2 ${isNICU ? 'text-sky-500' : 'text-violet-500'}`}>
                    List all diagnoses separated by commas. Include gestational age, birth weight, and conditions treated.
                  </p>
                </div>

                {/* Clinical Course Summary */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-600 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <h3 className="font-bold text-slate-800">Clinical Course Summary</h3>
                    </div>
                    <button
                      onClick={() => handleGenerateAllAI()}
                      disabled={isGeneratingAI}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isNICU ? 'bg-sky-100 text-sky-700 hover:bg-sky-200' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                      } disabled:opacity-50`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {isGeneratingAI ? 'Generating...' : 'Regenerate AI'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">Document the clinical course during hospital stay in proper medical documentation style.</p>
                  <textarea
                    value={clinicalSummary}
                    onChange={(e) => setClinicalSummary(e.target.value)}
                    placeholder="Baby was admitted with... During the hospital stay... Currently baby is..."
                    className="w-full h-40 p-4 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-50 text-slate-800 leading-relaxed"
                    style={{ lineHeight: '1.8' }}
                  />
                  <p className="text-xs text-slate-400 mt-2 italic">Tip: Use passive voice ("Baby was admitted..."). Write in 4-5 complete sentences.</p>
                </div>
              </div>
            )}

            {/* Vitals Section */}
            {activeSection === 1 && (
              <div className="space-y-5">
                {/* Vitals at Discharge */}
                <div className={`p-4 rounded-xl border ${isNICU ? 'border-sky-200 bg-sky-50/30' : 'border-violet-200 bg-violet-50/30'}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isNICU ? 'bg-sky-500' : 'bg-violet-500'}`}>
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className={`font-bold ${isNICU ? 'text-sky-800' : 'text-violet-800'}`}>Discharge Vitals & Anthropometry</h3>
                      <p className={`text-xs ${isNICU ? 'text-sky-600' : 'text-violet-600'}`}>Record vital signs and measurements at discharge</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-white rounded-lg p-3 border border-slate-200">
                    {[
                      { label: 'Weight', key: 'weight', type: 'number', unit: 'kg', icon: '⚖️' },
                      { label: 'Length', key: 'length', type: 'number', unit: 'cm', icon: '📏' },
                      { label: 'Head Circumference', key: 'headCircumference', type: 'number', unit: 'cm', icon: '🔴' },
                      { label: 'Temperature', key: 'temperature', placeholder: '36.8°C', icon: '🌡️' },
                      { label: 'Heart Rate', key: 'heartRate', placeholder: '140/min', icon: '💓' },
                      { label: 'SpO2', key: 'spo2', placeholder: '98%', icon: '💨' }
                    ].map(({ label, key, type, placeholder, unit, icon }) => (
                      <div key={key} className="relative">
                        <label className="block text-xs font-semibold text-slate-600 mb-1">
                          <span className="mr-1">{icon}</span>
                          {label} {unit && <span className="text-slate-400">({unit})</span>}
                        </label>
                        <input
                          type={type || 'text'}
                          value={(vitals as any)[key] || ''}
                          onChange={(e) => setVitals({ ...vitals, [key]: type === 'number' ? parseFloat(e.target.value) || undefined : e.target.value })}
                          placeholder={placeholder || (unit ? `Enter ${label.toLowerCase()}` : undefined)}
                          className={`w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 ${
                            isNICU ? 'focus:ring-sky-400' : 'focus:ring-violet-400'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Condition at Discharge */}
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-emerald-800">Condition at Discharge</h3>
                      <p className="text-xs text-emerald-600">Clinical status and general condition</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-white rounded-lg p-3 border border-slate-200">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Overall Condition</label>
                      <select
                        value={conditionAtDischarge}
                        onChange={(e) => setConditionAtDischarge(e.target.value as any)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                      >
                        {[
                          { value: 'Stable', label: '✅ Stable', color: 'text-emerald-700' },
                          { value: 'Improved', label: '📈 Improved', color: 'text-blue-700' },
                          { value: 'Guarded', label: '⚠️ Guarded', color: 'text-amber-700' },
                          { value: 'Critical', label: '🚨 Critical', color: 'text-red-700' }
                        ].map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">General Condition</label>
                      <input
                        type="text"
                        value={generalCondition}
                        onChange={(e) => setGeneralCondition(e.target.value)}
                        placeholder="e.g., Good, Fair"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Activity Level</label>
                      <input
                        type="text"
                        value={activity}
                        onChange={(e) => setActivity(e.target.value)}
                        placeholder="e.g., Active, Alert"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>
                    {isNICU && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Sucking Reflex</label>
                        <select
                          value={suckingReflex}
                          onChange={(e) => setSuckingReflex(e.target.value as any)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                        >
                          <option value="Good">Good</option>
                          <option value="Fair">Fair</option>
                          <option value="Poor">Poor</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Feeding Section */}
            {activeSection === 2 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-amber-800">Feeding at Discharge</h3>
                      <p className="text-xs text-amber-600">Feeding plan and instructions for home</p>
                    </div>
                  </div>

                  <div className="space-y-3 bg-white rounded-lg p-3 border border-slate-200">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">🍼 Feeding Type</label>
                      <select
                        value={feeding.feedingType}
                        onChange={(e) => setFeeding({ ...feeding, feedingType: e.target.value as FeedingType })}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                      >
                        {Object.values(FeedingType).map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">⏰ Frequency</label>
                        <input
                          type="text"
                          value={feeding.feedingFrequency || ''}
                          onChange={(e) => setFeeding({ ...feeding, feedingFrequency: e.target.value })}
                          placeholder="e.g., 3 hourly, on demand"
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">📊 Volume per Feed</label>
                        <input
                          type="text"
                          value={feeding.feedingVolume || ''}
                          onChange={(e) => setFeeding({ ...feeding, feedingVolume: e.target.value })}
                          placeholder="e.g., 60ml/feed"
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">📝 Special Instructions</label>
                      <textarea
                        value={feeding.specialInstructions || ''}
                        onChange={(e) => setFeeding({ ...feeding, specialInstructions: e.target.value })}
                        placeholder="Any special feeding instructions (e.g., fortification, positioning, etc.)"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none h-20"
                      />
                    </div>
                  </div>

                  {/* Quick Tips */}
                  <div className="mt-3 p-3 bg-amber-100 rounded-lg border border-amber-200">
                    <p className="text-xs text-amber-800 font-semibold mb-1">💡 Feeding Tips for Parents:</p>
                    <ul className="text-xs text-amber-700 space-y-0.5">
                      <li>• Breastfeed on demand or as per schedule advised</li>
                      <li>• Watch for signs of hunger (rooting, hand-to-mouth)</li>
                      <li>• Ensure good latch for successful breastfeeding</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Treatment Received Section */}
            {activeSection === 3 && (
              <div className="space-y-4">
                <div className={`p-4 rounded-xl border ${isNICU ? 'border-sky-200 bg-sky-50/50' : 'border-violet-200 bg-violet-50/50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isNICU ? 'bg-sky-500' : 'bg-violet-500'}`}>
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className={`font-bold ${isNICU ? 'text-sky-800' : 'text-violet-800'}`}>Treatment Received During Hospital Stay</h3>
                        <p className={`text-xs ${isNICU ? 'text-sky-600' : 'text-violet-600'}`}>Medications and interventions given during admission</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          // Collect all medications from multiple sources
                          const allMedications: { name: string; startDate?: string; stopDate?: string }[] = [];

                          // Source 1: patient.medications
                          if (patient.medications && patient.medications.length > 0) {
                            patient.medications.forEach(med => {
                              if (med.name) {
                                allMedications.push({
                                  name: med.name,
                                  startDate: med.startDate,
                                  stopDate: med.stopDate
                                });
                              }
                            });
                          }

                          // Source 2: progressNotes[].medications
                          if (patient.progressNotes && patient.progressNotes.length > 0) {
                            patient.progressNotes.forEach(note => {
                              if (note.medications && note.medications.length > 0) {
                                note.medications.forEach(med => {
                                  if (med.name) {
                                    const exists = allMedications.some(
                                      existing => existing.name.toLowerCase() === med.name.toLowerCase()
                                    );
                                    if (!exists) {
                                      allMedications.push({
                                        name: med.name,
                                        startDate: med.startDate || note.date,
                                        stopDate: med.stopDate
                                      });
                                    }
                                  }
                                });
                              }
                            });
                          }

                          // Format with duration
                          const treatments = allMedications.map(med => {
                            let duration = '';
                            if (med.startDate) {
                              const startDate = new Date(med.startDate);
                              const endDate = med.stopDate ? new Date(med.stopDate) : new Date();
                              const durationMs = endDate.getTime() - startDate.getTime();
                              const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
                              if (durationDays === 0) {
                                duration = ' - Single dose';
                              } else if (durationDays === 1) {
                                duration = ' - 1 day';
                              } else {
                                duration = ` - ${durationDays} days`;
                              }
                            }
                            return `${med.name}${duration}`;
                          });

                          setTreatmentReceived(treatments);
                          haptics.tap();
                          showToast('success', `Loaded ${treatments.length} medications from patient records`);
                        }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          isNICU ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        }`}
                        title="Extract medications from patient records and clinical notes"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Reload from Records
                      </button>
                      <button
                        onClick={() => setTreatmentReceived([...treatmentReceived, ''])}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          isNICU ? 'bg-sky-100 text-sky-700 hover:bg-sky-200' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Treatment
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 bg-white rounded-lg p-3 border border-slate-200">
                    {treatmentReceived.map((treatment, index) => (
                      <div key={index} className="flex items-start gap-2 group">
                        <span className={`flex-shrink-0 w-6 h-8 flex items-center justify-center rounded-lg text-xs font-bold ${
                          isNICU ? 'bg-sky-200 text-sky-700' : 'bg-violet-200 text-violet-700'
                        }`}>
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          value={treatment}
                          onChange={(e) => {
                            const updated = [...treatmentReceived];
                            updated[index] = e.target.value;
                            setTreatmentReceived(updated);
                          }}
                          placeholder={`Treatment ${index + 1} (e.g., Ampicillin - 7 days)`}
                          className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                            isNICU ? 'border-sky-200 focus:ring-sky-400' : 'border-violet-200 focus:ring-violet-400'
                          } text-slate-700`}
                        />
                        <button
                          onClick={() => setTreatmentReceived(treatmentReceived.filter((_, i) => i !== index))}
                          className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {treatmentReceived.length === 0 && (
                      <p className={`text-sm text-center py-4 border border-dashed rounded-lg ${
                        isNICU ? 'text-sky-500 border-sky-300' : 'text-violet-500 border-violet-300'
                      }`}>
                        No treatments added. Click "Add Treatment" to document treatments received.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Medications Section */}
            {activeSection === 4 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-bold text-blue-800">Follow-up Medications</h3>
                        <p className="text-xs text-blue-600">Medications to take home after discharge</p>
                      </div>
                    </div>
                    <button
                      onClick={addMedication}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-200 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Medication
                    </button>
                  </div>

                  <div className="space-y-3">
                    {medications.map((med, index) => (
                      <div key={index} className={`p-4 rounded-xl border-2 transition-all ${
                        isNICU && index === 0
                          ? 'bg-gradient-to-r from-sky-50 to-cyan-50 border-sky-300 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-blue-300'
                      }`}>
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isNICU && index === 0 ? 'bg-sky-500 text-white' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {index + 1}
                            </span>
                            {isNICU && index === 0 && (
                              <span className="text-xs font-semibold text-sky-600 bg-sky-100 px-2 py-0.5 rounded-full">Default (Vitamin D3)</span>
                            )}
                          </div>
                          {!(isNICU && index === 0) && (
                            <button onClick={() => removeMedication(index)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Medication Name</label>
                            <input
                              type="text"
                              value={med.name}
                              onChange={(e) => updateMedication(index, 'name', e.target.value)}
                              placeholder="e.g., Vitamin D3 Drops (400 IU/mL)"
                              disabled={isNICU && index === 0}
                              className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                                isNICU && index === 0 ? 'bg-sky-100 border-sky-300 text-sky-800' : 'border-slate-200'
                              }`}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Frequency/Dose</label>
                              <input
                                type="text"
                                value={med.frequency}
                                onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                                placeholder="e.g., 1 mL once daily"
                                disabled={isNICU && index === 0}
                                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                                  isNICU && index === 0 ? 'bg-sky-100 border-sky-300 text-sky-800' : 'border-slate-200'
                                }`}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Duration</label>
                              <input
                                type="text"
                                value={med.duration || ''}
                                onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                                placeholder="e.g., Up to 1 year of age"
                                disabled={isNICU && index === 0}
                                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                                  isNICU && index === 0 ? 'bg-sky-100 border-sky-300 text-sky-800' : 'border-slate-200'
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {medications.length === 0 && (
                      <div className="text-center py-6 bg-white rounded-lg border border-dashed border-blue-300">
                        <p className="text-sm text-blue-500">No medications added.</p>
                        <p className="text-xs text-slate-400 mt-1">Click "Add Medication" to prescribe take-home medications.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Vaccines Section */}
            {activeSection === 5 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Vaccinations Given</h3>
                  <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded-lg">
                    {vaccinations.length} selected
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.values(VaccinationType).map(vax => {
                    const isSelected = vaccinations.includes(vax);
                    return (
                      <button
                        key={vax}
                        type="button"
                        onClick={() => toggleVaccination(vax)}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all text-left ${
                          isSelected
                            ? 'bg-emerald-100 border-emerald-500 shadow-md'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected
                            ? 'bg-emerald-500'
                            : 'bg-slate-200'
                        }`}>
                          {isSelected && (
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-sm font-medium ${isSelected ? 'text-emerald-800' : 'text-slate-700'}`}>
                          {vax}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {isNICU && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-slate-800">Screenings</h3>
                      <span className="text-xs text-sky-600 font-semibold bg-sky-50 px-2 py-1 rounded-lg">
                        {Object.values(screenings).filter(Boolean).length} done
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { key: 'hearingScreenDone', label: 'Hearing Screen', icon: '👂' },
                        { key: 'metabolicScreenDone', label: 'Metabolic Screen', icon: '🧬' },
                        { key: 'ropScreeningDone', label: 'ROP Screening', icon: '👁️' },
                        { key: 'carSeatTestDone', label: 'Car Seat Test', icon: '🚗' }
                      ].map(({ key, label, icon }) => {
                        const isChecked = (screenings as any)[key];
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setScreenings({ ...screenings, [key]: !isChecked })}
                            className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all text-left ${
                              isChecked
                                ? 'bg-sky-100 border-sky-500 shadow-md'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all text-lg ${
                              isChecked
                                ? 'bg-sky-500'
                                : 'bg-slate-100'
                            }`}>
                              {isChecked ? (
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <span>{icon}</span>
                              )}
                            </div>
                            <div>
                              <span className={`text-sm font-medium block ${isChecked ? 'text-sky-800' : 'text-slate-700'}`}>
                                {label}
                              </span>
                              <span className={`text-xs ${isChecked ? 'text-sky-600' : 'text-slate-400'}`}>
                                {isChecked ? 'Done' : 'Not done'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
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
              <div className="space-y-5">
                {/* Discharge Advice Section */}
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-bold text-emerald-800">Discharge Advice</h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleGenerateAdviceFromDiagnosis}
                        disabled={isGeneratingAdvice}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          isGeneratingAdvice
                            ? 'bg-sky-200 text-sky-500 cursor-wait'
                            : 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white hover:from-sky-600 hover:to-indigo-600 shadow-md'
                        }`}
                        title="AI-powered discharge advice"
                      >
                        {isGeneratingAdvice ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            AI Generate Advice
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setDischargeAdvice([...dischargeAdvice, ''])}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-200 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Custom
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {dischargeAdvice.map((advice, index) => (
                      <div key={index} className="flex items-start gap-2 group">
                        <span className="flex-shrink-0 w-6 h-12 flex items-center justify-center rounded-lg bg-emerald-200 text-emerald-700 text-xs font-bold">
                          {index + 1}
                        </span>
                        <textarea
                          value={advice}
                          onChange={(e) => {
                            const updated = [...dischargeAdvice];
                            updated[index] = e.target.value;
                            setDischargeAdvice(updated);
                          }}
                          placeholder={`Advice ${index + 1}...`}
                          rows={2}
                          className="flex-1 px-3 py-2 border border-emerald-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 text-slate-700 resize-none"
                        />
                        <button
                          onClick={() => setDischargeAdvice(dischargeAdvice.filter((_, i) => i !== index))}
                          className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {dischargeAdvice.length === 0 && (
                      <p className="text-sm text-emerald-500 text-center py-4 bg-white rounded-lg border border-dashed border-emerald-300">
                        No advice added. Click "Add Advice" to add discharge instructions.
                      </p>
                    )}
                  </div>
                </div>

                {/* Warning Signs Section */}
                <div className="p-4 rounded-xl border-2 border-red-200 bg-red-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <h3 className="font-bold text-red-800">Warning Signs - Bring Baby Immediately If:</h3>
                    </div>
                    <button
                      onClick={() => setWarningsSigns([...warningsSigns, ''])}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Warning
                    </button>
                  </div>
                  <p className="text-xs text-red-600 mb-3">Danger signs that require immediate medical attention.</p>

                  <div className="space-y-2 p-3 bg-white rounded-lg border border-red-200">
                    {warningsSigns.map((warning, index) => (
                      <div key={index} className="flex items-start gap-2 group">
                        <span className="flex-shrink-0 w-6 h-8 flex items-center justify-center">
                          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <circle cx="10" cy="10" r="4" />
                          </svg>
                        </span>
                        <input
                          type="text"
                          value={warning}
                          onChange={(e) => {
                            const updated = [...warningsSigns];
                            updated[index] = e.target.value;
                            setWarningsSigns(updated);
                          }}
                          placeholder={`Warning sign ${index + 1}...`}
                          className="flex-1 px-3 py-2 border border-red-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400 text-slate-700"
                        />
                        <button
                          onClick={() => setWarningsSigns(warningsSigns.filter((_, i) => i !== index))}
                          className="p-2 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {warningsSigns.length === 0 && (
                      <p className="text-sm text-red-500 text-center py-4 border border-dashed border-red-200 rounded-lg">
                        No warning signs added. Click "Add Warning" to add danger signs.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Mobile Optimized */}
          <div className="flex-shrink-0 border-t border-slate-200 p-3 pb-6 sm:pb-3 bg-white" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            {/* Show AI generating state - no actions available */}
            {isGeneratingAI && (
              <div className="flex items-center justify-center gap-3 py-4">
                <div className={`w-6 h-6 border-3 border-t-transparent rounded-full animate-spin ${
                  isNICU ? 'border-sky-500' : 'border-violet-500'
                }`} />
                <span className="text-slate-600 font-medium">Generating discharge summary with AI...</span>
              </div>
            )}

            {/* Show actions only after AI generation is complete */}
            {!isGeneratingAI && aiGenerationComplete && (
              <>
                {isSaved && (
                  <div className="mb-3 flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-200">
                    <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-emerald-700 text-sm font-semibold">Discharge Summary Saved Successfully</span>
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
                      disabled={isSaving}
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
              </>
            )}

            {/* Show waiting state if AI hasn't started yet (edge case) */}
            {!isGeneratingAI && !aiGenerationComplete && (
              <div className="text-center py-4 text-slate-500 text-sm">
                Preparing discharge summary...
              </div>
            )}
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
