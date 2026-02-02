import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProgressNote, VitalSigns, ClinicalExamination, Patient, Medication } from '../../types';
import { PatientContext } from '../../types/medgemma';
import { VoiceScribePanel } from './VoiceScribePanel';
import { Mic, Sparkles, Heart, Activity, Wind, Thermometer, Droplets, Clock, Brain, Stethoscope, ChevronDown, ChevronUp, Check, AlertTriangle, Pill, FileText, Zap } from 'lucide-react';
import FormTimer from '../FormTimer';
import CelebrationAnimation from '../CelebrationAnimation';
import { saveFormTiming } from '../../services/formTimingService';

interface ClinicalNoteModernProps {
  patient?: Patient;
  onSave: (note: ProgressNote) => void;
  onCancel: () => void;
  existingNote?: ProgressNote;
  lastNote?: ProgressNote;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  institutionId?: string;
  institutionName?: string;
}

// Normal values by age group
const NORMAL_VALUES = {
  preterm: { temp: '36.8', hr: '155', rr: '55', bp: '55/35', spo2: '93', crt: '<3' },
  newborn: { temp: '37.0', hr: '140', rr: '48', bp: '65/40', spo2: '97', crt: '<2' },
  infant: { temp: '37.0', hr: '125', rr: '38', bp: '80/50', spo2: '98', crt: '<2' },
  child: { temp: '37.0', hr: '100', rr: '24', bp: '95/60', spo2: '98', crt: '<2' },
};

// Normal examination findings
const NORMAL_EXAM = {
  cns: 'Alert, active, good cry, normal tone, normal reflexes, anterior fontanelle soft and flat, no seizures',
  cvs: 'S1S2 heard, no murmur, regular rhythm, CRT <2 seconds, peripheral pulses well felt, warm peripheries, no cyanosis',
  chest: 'Bilateral equal air entry, no added sounds, no retractions, no grunting, no nasal flaring, normal respiratory effort',
  perAbdomen: 'Soft, non-distended, non-tender, bowel sounds present, no organomegaly, umbilicus healthy, tolerating feeds well',
  other: 'Pink, well perfused, no rash, no edema, activity appropriate for age'
};

// Quick finding chips
const QUICK_FINDINGS = {
  cns: {
    normal: ['Alert', 'Active', 'Good tone', 'Good cry', 'Normal reflexes', 'Soft fontanelle'],
    abnormal: ['Lethargic', 'Irritable', 'Hypotonic', 'Hypertonic', 'Seizures', 'Bulging fontanelle', 'Jittery']
  },
  cvs: {
    normal: ['S1S2 normal', 'No murmur', 'CRT <2s', 'Good perfusion', 'Warm peripheries'],
    abnormal: ['Murmur present', 'CRT >3s', 'Cold peripheries', 'Mottled', 'Cyanosis', 'Tachycardia', 'Bradycardia']
  },
  chest: {
    normal: ['B/L air entry equal', 'No added sounds', 'No retractions', 'No grunting', 'Normal effort'],
    abnormal: ['Decreased air entry', 'Crepitations', 'Wheeze', 'Retractions', 'Grunting', 'Nasal flaring', 'Tachypnea']
  },
  perAbdomen: {
    normal: ['Soft', 'Non-distended', 'BS present', 'No organomegaly', 'Tolerating feeds'],
    abnormal: ['Distended', 'Tender', 'BS absent', 'Hepatomegaly', 'Feed intolerance', 'Vomiting']
  }
};

const ClinicalNoteModern: React.FC<ClinicalNoteModernProps> = ({
  patient,
  onSave,
  onCancel,
  existingNote,
  lastNote,
  userEmail,
  userName,
  userRole = 'Doctor',
  institutionId = '',
  institutionName = ''
}) => {
  // Voice Scribe state
  const [showVoiceScribe, setShowVoiceScribe] = useState(false);

  // Form Timer State
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [formStartTime] = useState(new Date().toISOString());
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationTimeTaken, setCelebrationTimeTaken] = useState(0);

  // Vitals state
  const [vitals, setVitals] = useState<VitalSigns>({
    temperature: existingNote?.vitals?.temperature || '',
    hr: existingNote?.vitals?.hr || '',
    rr: existingNote?.vitals?.rr || '',
    bp: existingNote?.vitals?.bp || '',
    spo2: existingNote?.vitals?.spo2 || '',
    crt: existingNote?.vitals?.crt || '',
    weight: existingNote?.vitals?.weight || ''
  });

  // Examination state
  const [examination, setExamination] = useState<ClinicalExamination>({
    cns: existingNote?.examination?.cns || '',
    cvs: existingNote?.examination?.cvs || '',
    chest: existingNote?.examination?.chest || '',
    perAbdomen: existingNote?.examination?.perAbdomen || '',
    otherFindings: existingNote?.examination?.otherFindings || ''
  });

  // Clinical note
  const [clinicalNote, setClinicalNote] = useState(existingNote?.note || '');

  // Medications
  const [medications, setMedications] = useState<Medication[]>(existingNote?.medications || []);

  // UI state
  const [expandedSections, setExpandedSections] = useState({
    vitals: true,
    examination: true,
    medications: false,
    summary: true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [activeExamSystem, setActiveExamSystem] = useState<string | null>('cns');

  // Get age group for normal values
  const getAgeGroup = (): keyof typeof NORMAL_VALUES => {
    if (!patient) return 'newborn';
    const diagnosis = (patient.diagnosis || '').toLowerCase();
    if (diagnosis.includes('preterm') || diagnosis.includes('premature')) return 'preterm';

    const age = patient.age || 0;
    const unit = patient.ageUnit || 'days';
    let ageInDays = age;
    if (unit === 'weeks') ageInDays = age * 7;
    else if (unit === 'months') ageInDays = age * 30;
    else if (unit === 'years') ageInDays = age * 365;

    if (ageInDays <= 28) return 'newborn';
    if (ageInDays <= 365) return 'infant';
    return 'child';
  };

  // Fill all vitals with normal values
  const fillNormalVitals = () => {
    const normals = NORMAL_VALUES[getAgeGroup()];
    setVitals(prev => ({
      ...prev,
      temperature: normals.temp,
      hr: normals.hr,
      rr: normals.rr,
      bp: normals.bp,
      spo2: normals.spo2,
      crt: normals.crt
    }));
  };

  // Fill all examination with normal values
  const fillNormalExam = () => {
    setExamination({
      cns: NORMAL_EXAM.cns,
      cvs: NORMAL_EXAM.cvs,
      chest: NORMAL_EXAM.chest,
      perAbdomen: NORMAL_EXAM.perAbdomen,
      otherFindings: NORMAL_EXAM.other
    });
  };

  // Fill everything normal
  const fillAllNormal = () => {
    fillNormalVitals();
    fillNormalExam();
    setClinicalNote('Baby clinically stable. All vitals within normal limits. Systemic examination unremarkable.');
  };

  // Toggle quick finding chip
  const toggleFinding = (system: keyof typeof QUICK_FINDINGS, finding: string) => {
    setExamination(prev => {
      const currentFindings = prev[system as keyof ClinicalExamination] || '';
      const findingsArray = currentFindings.split(', ').filter(f => f.trim());

      if (findingsArray.includes(finding)) {
        // Remove finding
        const newFindings = findingsArray.filter(f => f !== finding);
        return { ...prev, [system]: newFindings.join(', ') };
      } else {
        // Add finding
        findingsArray.push(finding);
        return { ...prev, [system]: findingsArray.join(', ') };
      }
    });
  };

  // Check if finding is selected
  const isFindingSelected = (system: keyof ClinicalExamination, finding: string): boolean => {
    const currentFindings = examination[system] || '';
    return currentFindings.includes(finding);
  };

  // Handle voice scribe data insertion
  const handleVoiceInsert = useCallback((data: Partial<ProgressNote>) => {
    if (data.vitals) {
      setVitals(prev => ({ ...prev, ...data.vitals }));
    }
    if (data.examination) {
      setExamination(prev => ({ ...prev, ...data.examination }));
    }
    if (data.note) {
      setClinicalNote(prev => prev ? `${prev}\n\n${data.note}` : data.note);
    }
    if (data.medications) {
      setMedications(prev => [...prev, ...data.medications!]);
    }
    setShowVoiceScribe(false);
  }, []);

  // Check if vital is abnormal
  const isVitalAbnormal = (vital: string, value: string): boolean => {
    if (!value) return false;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return false;

    const ageGroup = getAgeGroup();
    switch (vital) {
      case 'temperature':
        return numValue < 36 || numValue > 37.8;
      case 'hr':
        if (ageGroup === 'preterm') return numValue < 120 || numValue > 180;
        if (ageGroup === 'newborn') return numValue < 100 || numValue > 180;
        return numValue < 60 || numValue > 160;
      case 'rr':
        if (ageGroup === 'preterm' || ageGroup === 'newborn') return numValue < 30 || numValue > 70;
        return numValue < 15 || numValue > 50;
      case 'spo2':
        return numValue < 90;
      default:
        return false;
    }
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);

    // Stop timer
    setIsTimerRunning(false);
    const finalTime = elapsedSeconds;
    setCelebrationTimeTaken(finalTime);

    const progressNote: ProgressNote = {
      id: existingNote?.id || Date.now().toString(),
      date: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      vitals,
      examination,
      note: clinicalNote,
      medications,
      authorEmail: userEmail || '',
      authorName: userName || userEmail || ''
    };

    try {
      // Save form timing for research
      if (institutionId) {
        await saveFormTiming({
          formType: 'clinical_note',
          patientId: patient?.id,
          patientName: patient?.name,
          patientNtid: patient?.ntid,
          institutionId,
          institutionName,
          userId: userEmail || '',
          userEmail: userEmail || '',
          userName: userName || userEmail || '',
          userRole,
          startTime: formStartTime,
          endTime: new Date().toISOString(),
          durationSeconds: finalTime,
          unit: patient?.unit,
          isEdit: !!existingNote
        });
      }

      await onSave(progressNote);

      // Show celebration
      setShowCelebration(true);
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header with Voice Scribe CTA */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-4 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Clinical Progress Note
            </h2>
            <p className="text-white/80 text-sm mt-1">
              {patient?.name} • {patient?.age} {patient?.ageUnit} • {patient?.diagnosis || 'No diagnosis'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Note Timer */}
            <FormTimer
              isRunning={isTimerRunning}
              onTimeUpdate={setElapsedSeconds}
              label="Note Time"
              compact={true}
            />

            {/* Voice Scribe Button - Primary CTA */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowVoiceScribe(true)}
              className="px-5 py-3 bg-white text-purple-600 rounded-xl font-bold flex items-center gap-2 shadow-lg"
            >
              <Mic className="w-5 h-5" />
              Voice Scribe
            </motion.button>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={fillAllNormal}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium flex items-center gap-1.5 backdrop-blur-sm"
          >
            <Zap className="w-4 h-4" />
            Baby Stable (All Normal)
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={fillNormalVitals}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium flex items-center gap-1.5 backdrop-blur-sm"
          >
            <Activity className="w-4 h-4" />
            Normal Vitals
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={fillNormalExam}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium flex items-center gap-1.5 backdrop-blur-sm"
          >
            <Stethoscope className="w-4 h-4" />
            Normal Exam
          </motion.button>
          {lastNote && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (lastNote.vitals) setVitals(lastNote.vitals);
                if (lastNote.examination) setExamination(lastNote.examination);
              }}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium flex items-center gap-1.5 backdrop-blur-sm"
            >
              <Clock className="w-4 h-4" />
              Copy Last Note
            </motion.button>
          )}
        </div>
      </div>

      {/* VITALS SECTION */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
        <button
          onClick={() => setExpandedSections(prev => ({ ...prev, vitals: !prev.vitals }))}
          className="w-full px-4 py-3 bg-gradient-to-r from-rose-50 to-red-50 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center shadow-md">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <span className="font-bold text-slate-800 block">Vital Signs</span>
              <span className="text-xs text-slate-500">
                {Object.values(vitals).filter(v => v).length}/7 recorded
              </span>
            </div>
          </div>
          {expandedSections.vitals ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        <AnimatePresence>
          {expandedSections.vitals && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Temperature */}
                <div className={`relative rounded-xl p-3 ${isVitalAbnormal('temperature', vitals.temperature) ? 'bg-red-50 border-2 border-red-300' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer className={`w-4 h-4 ${isVitalAbnormal('temperature', vitals.temperature) ? 'text-red-500' : 'text-orange-500'}`} />
                    <span className="text-xs font-medium text-slate-600">Temp (°C)</span>
                  </div>
                  <input
                    type="text"
                    value={vitals.temperature}
                    onChange={(e) => setVitals(prev => ({ ...prev, temperature: e.target.value }))}
                    placeholder="37.0"
                    className="w-full text-2xl font-bold text-slate-800 bg-transparent outline-none"
                  />
                  {isVitalAbnormal('temperature', vitals.temperature) && (
                    <AlertTriangle className="absolute top-2 right-2 w-4 h-4 text-red-500" />
                  )}
                </div>

                {/* Heart Rate */}
                <div className={`relative rounded-xl p-3 ${isVitalAbnormal('hr', vitals.hr) ? 'bg-red-50 border-2 border-red-300' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className={`w-4 h-4 ${isVitalAbnormal('hr', vitals.hr) ? 'text-red-500' : 'text-rose-500'}`} />
                    <span className="text-xs font-medium text-slate-600">HR (bpm)</span>
                  </div>
                  <input
                    type="text"
                    value={vitals.hr}
                    onChange={(e) => setVitals(prev => ({ ...prev, hr: e.target.value }))}
                    placeholder="140"
                    className="w-full text-2xl font-bold text-slate-800 bg-transparent outline-none"
                  />
                  {isVitalAbnormal('hr', vitals.hr) && (
                    <AlertTriangle className="absolute top-2 right-2 w-4 h-4 text-red-500" />
                  )}
                </div>

                {/* Respiratory Rate */}
                <div className={`relative rounded-xl p-3 ${isVitalAbnormal('rr', vitals.rr) ? 'bg-red-50 border-2 border-red-300' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Wind className={`w-4 h-4 ${isVitalAbnormal('rr', vitals.rr) ? 'text-red-500' : 'text-sky-500'}`} />
                    <span className="text-xs font-medium text-slate-600">RR (/min)</span>
                  </div>
                  <input
                    type="text"
                    value={vitals.rr}
                    onChange={(e) => setVitals(prev => ({ ...prev, rr: e.target.value }))}
                    placeholder="48"
                    className="w-full text-2xl font-bold text-slate-800 bg-transparent outline-none"
                  />
                  {isVitalAbnormal('rr', vitals.rr) && (
                    <AlertTriangle className="absolute top-2 right-2 w-4 h-4 text-red-500" />
                  )}
                </div>

                {/* SpO2 */}
                <div className={`relative rounded-xl p-3 ${isVitalAbnormal('spo2', vitals.spo2) ? 'bg-red-50 border-2 border-red-300' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Droplets className={`w-4 h-4 ${isVitalAbnormal('spo2', vitals.spo2) ? 'text-red-500' : 'text-blue-500'}`} />
                    <span className="text-xs font-medium text-slate-600">SpO₂ (%)</span>
                  </div>
                  <input
                    type="text"
                    value={vitals.spo2}
                    onChange={(e) => setVitals(prev => ({ ...prev, spo2: e.target.value }))}
                    placeholder="97"
                    className="w-full text-2xl font-bold text-slate-800 bg-transparent outline-none"
                  />
                  {isVitalAbnormal('spo2', vitals.spo2) && (
                    <AlertTriangle className="absolute top-2 right-2 w-4 h-4 text-red-500" />
                  )}
                </div>

                {/* BP */}
                <div className="rounded-xl p-3 bg-slate-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-purple-500" />
                    <span className="text-xs font-medium text-slate-600">BP (mmHg)</span>
                  </div>
                  <input
                    type="text"
                    value={vitals.bp}
                    onChange={(e) => setVitals(prev => ({ ...prev, bp: e.target.value }))}
                    placeholder="65/40"
                    className="w-full text-2xl font-bold text-slate-800 bg-transparent outline-none"
                  />
                </div>

                {/* CRT */}
                <div className="rounded-xl p-3 bg-slate-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-medium text-slate-600">CRT (sec)</span>
                  </div>
                  <input
                    type="text"
                    value={vitals.crt}
                    onChange={(e) => setVitals(prev => ({ ...prev, crt: e.target.value }))}
                    placeholder="<2"
                    className="w-full text-2xl font-bold text-slate-800 bg-transparent outline-none"
                  />
                </div>

                {/* Weight */}
                <div className="rounded-xl p-3 bg-slate-50 col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-medium text-slate-600">Weight (kg)</span>
                  </div>
                  <input
                    type="text"
                    value={vitals.weight}
                    onChange={(e) => setVitals(prev => ({ ...prev, weight: e.target.value }))}
                    placeholder="2.8"
                    className="w-full text-2xl font-bold text-slate-800 bg-transparent outline-none"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* EXAMINATION SECTION */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
        <button
          onClick={() => setExpandedSections(prev => ({ ...prev, examination: !prev.examination }))}
          className="w-full px-4 py-3 bg-gradient-to-r from-sky-50 to-blue-50 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 flex items-center justify-center shadow-md">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <span className="font-bold text-slate-800 block">Systemic Examination</span>
              <span className="text-xs text-slate-500">CNS, CVS, Chest, Abdomen</span>
            </div>
          </div>
          {expandedSections.examination ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        <AnimatePresence>
          {expandedSections.examination && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-4">
                {/* System Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {(['cns', 'cvs', 'chest', 'perAbdomen'] as const).map((system) => (
                    <button
                      key={system}
                      onClick={() => setActiveExamSystem(activeExamSystem === system ? null : system)}
                      className={`px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${
                        activeExamSystem === system
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {system === 'cns' && <><Brain className="w-4 h-4 inline mr-1" /> CNS</>}
                      {system === 'cvs' && <><Heart className="w-4 h-4 inline mr-1" /> CVS</>}
                      {system === 'chest' && <><Wind className="w-4 h-4 inline mr-1" /> Chest</>}
                      {system === 'perAbdomen' && <><Activity className="w-4 h-4 inline mr-1" /> Abdomen</>}
                    </button>
                  ))}
                </div>

                {/* Active System Content */}
                <AnimatePresence mode="wait">
                  {activeExamSystem && (
                    <motion.div
                      key={activeExamSystem}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-3"
                    >
                      {/* Quick Fill Chips - Normal */}
                      <div>
                        <p className="text-xs font-medium text-emerald-600 mb-2">Normal Findings (tap to add)</p>
                        <div className="flex flex-wrap gap-2">
                          {QUICK_FINDINGS[activeExamSystem as keyof typeof QUICK_FINDINGS]?.normal.map((finding) => (
                            <motion.button
                              key={finding}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => toggleFinding(activeExamSystem as keyof typeof QUICK_FINDINGS, finding)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                isFindingSelected(activeExamSystem as keyof ClinicalExamination, finding)
                                  ? 'bg-emerald-500 text-white shadow-md'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              {isFindingSelected(activeExamSystem as keyof ClinicalExamination, finding) && (
                                <Check className="w-3 h-3 inline mr-1" />
                              )}
                              {finding}
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Quick Fill Chips - Abnormal */}
                      <div>
                        <p className="text-xs font-medium text-red-600 mb-2">Abnormal Findings</p>
                        <div className="flex flex-wrap gap-2">
                          {QUICK_FINDINGS[activeExamSystem as keyof typeof QUICK_FINDINGS]?.abnormal.map((finding) => (
                            <motion.button
                              key={finding}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => toggleFinding(activeExamSystem as keyof typeof QUICK_FINDINGS, finding)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                isFindingSelected(activeExamSystem as keyof ClinicalExamination, finding)
                                  ? 'bg-red-500 text-white shadow-md'
                                  : 'bg-red-50 text-red-700 hover:bg-red-100'
                              }`}
                            >
                              {isFindingSelected(activeExamSystem as keyof ClinicalExamination, finding) && (
                                <Check className="w-3 h-3 inline mr-1" />
                              )}
                              {finding}
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Free Text Input */}
                      <textarea
                        value={examination[activeExamSystem as keyof ClinicalExamination] || ''}
                        onChange={(e) => setExamination(prev => ({ ...prev, [activeExamSystem]: e.target.value }))}
                        placeholder={`Enter ${activeExamSystem.toUpperCase()} findings...`}
                        rows={3}
                        className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm resize-none"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Other Findings */}
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-medium text-slate-600 mb-2">Other Findings</p>
                  <textarea
                    value={examination.otherFindings || ''}
                    onChange={(e) => setExamination(prev => ({ ...prev, otherFindings: e.target.value }))}
                    placeholder="Skin, extremities, other findings..."
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm resize-none"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CLINICAL SUMMARY */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
        <button
          onClick={() => setExpandedSections(prev => ({ ...prev, summary: !prev.summary }))}
          className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <span className="font-bold text-slate-800 block">Clinical Summary</span>
              <span className="text-xs text-slate-500">Assessment & Plan</span>
            </div>
          </div>
          {expandedSections.summary ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        <AnimatePresence>
          {expandedSections.summary && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4">
                <textarea
                  value={clinicalNote}
                  onChange={(e) => setClinicalNote(e.target.value)}
                  placeholder="Enter clinical assessment, impression, and plan..."
                  rows={5}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none text-sm resize-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ACTION BUTTONS - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex gap-3 z-50">
        <button
          onClick={onCancel}
          className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all"
        >
          Cancel
        </button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
            />
          ) : (
            <>
              <Check className="w-5 h-5" />
              Save Note
            </>
          )}
        </motion.button>
      </div>

      {/* Voice Scribe Modal */}
      <VoiceScribePanel
        isOpen={showVoiceScribe}
        onClose={() => setShowVoiceScribe(false)}
        onInsert={handleVoiceInsert}
        patient={patient}
      />

      {/* Celebration Animation */}
      <CelebrationAnimation
        show={showCelebration}
        onComplete={() => {
          setShowCelebration(false);
          onCancel(); // Close the note form after celebration
        }}
        timeTaken={celebrationTimeTaken}
        formType="clinical_note"
        patientName={patient?.name}
      />
    </div>
  );
};

export default ClinicalNoteModern;
