import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProgressNote, Patient } from '../../types';
import { GoogleGenAI } from '@google/genai';
import { audioRecorder } from '../../utils/audioRecorder';
import {
  isDeepgramConfigured,
  startLiveTranscription,
  stopLiveTranscription
} from '../../services/deepgramService';
import {
  Mic, Square, FileText, RefreshCw, X, Plus, Edit3,
  Volume2, Pause, Play, Trash2, Save, Wand2, Stethoscope, Radio, Loader2
} from 'lucide-react';
import { extractMedicationsFromNote } from '../../services/medicationExtractionService';
import { reconcileMedications, getMedicationsAfterReconciliation } from '../../services/medicationReconciliationService';
import { showToast } from '../../utils/toast';
import { db } from '../../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { calculateAgeFromBirthDate } from '../../utils/ageCalculator';

interface VoiceClinicalNoteProps {
  patient?: Patient;
  onSave: (note: ProgressNote) => void;
  onCancel: () => void;
  onUpdatePatient?: (patient: Patient) => void; // Callback to update patient data (e.g., medications)
  existingNote?: ProgressNote;
  userEmail?: string;
  userName?: string;
  autoStart?: boolean; // Auto-start recording on mount
  onBackgroundSave?: (patientId: string, note: ProgressNote) => void; // For background processing
}

interface RecordingSession {
  id: string;
  transcript: string;
  duration: number;
  timestamp: Date;
}

/**
 * VoiceClinicalNote - World-Class Voice Clinical Documentation
 *
 * State-of-the-art features:
 * - Deepgram Nova-3 for medical speech-to-text (latest model)
 * - Real-time streaming transcription
 * - Audio waveform visualization
 * - Multiple recording sessions with append mode
 * - Editable formatted note
 * - Google Gemini for clinical note formatting
 * - Advanced medical terminology recognition
 */
const VoiceClinicalNote: React.FC<VoiceClinicalNoteProps> = ({
  patient,
  onSave,
  onCancel,
  onUpdatePatient,
  existingNote,
  userEmail,
  userName,
  autoStart = true, // Default to auto-start
  onBackgroundSave
}) => {
  // Core states
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<'transcribing' | 'formatting' | 'enhancing' | ''>('');
  const [recordingTime, setRecordingTime] = useState(0);

  // Transcription states
  const [liveTranscript, setLiveTranscript] = useState('');
  const [transcriptionStatus, setTranscriptionStatus] = useState('');
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [combinedTranscript, setCombinedTranscript] = useState('');

  // Note states
  const [formattedNote, setFormattedNote] = useState<string>(existingNote?.note || '');
  const [isEditing, setIsEditing] = useState(false);
  const [editableNote, setEditableNote] = useState('');

  // UI states
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSessions, setShowSessions] = useState(true);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(32).fill(0));

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const autoStartedRef = useRef(false);

  // Initialize Gemini AI and check Deepgram
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey) {
      aiRef.current = new GoogleGenAI({ apiKey });
    }

    // Check Deepgram configuration
    if (!isDeepgramConfigured()) {
      console.warn('Deepgram not configured. Check Deepgram API key.');
    } else {
      console.log('Deepgram configured and ready');
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Auto-start recording on mount - Start immediately but show connecting status
  useEffect(() => {
    if (autoStart && !existingNote && !autoStartedRef.current) {
      autoStartedRef.current = true;
      console.log('🚀 Auto-starting recording...');
      // Just call startRecording - it will handle the UI states properly
      startRecording();
    }
  }, [autoStart, existingNote]);

  // Simple audio visualization (no silence detection)
  const startAudioVisualization = async (stream: MediaStream) => {
    try {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevels = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const levels = Array.from(dataArray).map(v => v / 255);
        setAudioLevels(levels);
        animationFrameRef.current = requestAnimationFrame(updateLevels);
      };

      updateLevels();
    } catch (err) {
      console.error('Audio visualization error:', err);
    }
  };

  const stopAudioVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setAudioLevels(new Array(32).fill(0));
  };

  // Play beep sound to indicate ready to record
  const playBeepSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // 800 Hz beep
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);

      console.log('🔔 Beep sound played - ready to record!');
    } catch (error) {
      console.error('Failed to play beep sound:', error);
    }
  };

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get current date/time formatted
  const getCurrentDateTime = () => {
    const now = new Date();
    const date = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const time = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return { date, time };
  };

  // Calculate day of admission
  const getDayOfAdmission = (): string => {
    if (!patient?.dateOfAdmission) return '';
    const admission = new Date(patient.dateOfAdmission);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - admission.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `Day ${diffDays} of Admission`;
  };

  // Calculate current age dynamically from DOB
  const getCurrentAge = useMemo(() => {
    if (patient?.dateOfBirth) {
      const { age, ageUnit } = calculateAgeFromBirthDate(patient.dateOfBirth);
      return `${age} ${ageUnit}`;
    }
    // Fallback to stored age if no DOB
    return `${patient?.age || 0} ${patient?.ageUnit || 'days'}`;
  }, [patient?.dateOfBirth, patient?.age, patient?.ageUnit]);

  // Calculate Day of Life (DOL) for neonates
  const getDayOfLife = (): string => {
    if (!patient?.dateOfBirth) return '';
    const birthDate = new Date(patient.dateOfBirth);
    const now = new Date();
    const diffMs = now.getTime() - birthDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1; // Day 1 is birth day
    return `DOL ${diffDays}`;
  };

  // Start recording with real-time Deepgram transcription
  const startRecording = async () => {
    if (isRecording || isInitializing) return;

    setError('');
    setLiveTranscript('');
    setRecordingTime(0);
    setIsInitializing(true);
    finalTranscriptRef.current = '';

    if (!isDeepgramConfigured()) {
      setError('Deepgram not configured.');
      setIsInitializing(false);
      return;
    }

    try {
      // Start Deepgram live transcription - returns the stream for visualization
      const stream = await startLiveTranscription(
        // onTranscript callback
        (transcript: string, isFinal: boolean) => {
          if (isFinal) {
            finalTranscriptRef.current = finalTranscriptRef.current
              ? `${finalTranscriptRef.current} ${transcript}`
              : transcript;
            setLiveTranscript(finalTranscriptRef.current);
          } else {
            setLiveTranscript(
              finalTranscriptRef.current
                ? `${finalTranscriptRef.current} ${transcript}`
                : transcript
            );
          }
        },
        // onError callback
        (error: string) => {
          console.error('Transcription error:', error);
          setError(error);
        }
      );

      // Use the same stream for visualization
      mediaStreamRef.current = stream;
      startAudioVisualization(stream);

      // Ready!
      setIsInitializing(false);
      setIsRecording(true);
      playBeepSound();

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to start:', err);
      setError('Could not start recording: ' + (err as Error).message);
      setIsInitializing(false);
    }
  };

  // Pause recording
  const pauseRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsPaused(true);
  };

  // Resume recording
  const resumeRecording = () => {
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
    setIsPaused(false);
  };

  // Stop, Generate, and Save - ALL IN ONE
  const stopAndSaveNote = async () => {
    console.log('🛑 Stop → Generate → Save');

    // 1. STOP RECORDING
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    stopAudioVisualization();
    setIsRecording(false);

    // Wait for final transcripts
    await new Promise(resolve => setTimeout(resolve, 300));
    stopLiveTranscription();

    const transcript = finalTranscriptRef.current.trim();
    console.log('📝 Transcript:', transcript);

    if (!transcript || transcript.length < 3) {
      setError('No speech detected. Please speak clearly and try again.');
      finalTranscriptRef.current = '';
      return;
    }

    // 2. GENERATE NOTE using the full prompt
    setIsProcessing(true);
    setProcessingStep('formatting');

    const { date, time } = getCurrentDateTime();
    const dayInfo = getDayOfAdmission();
    const dolInfo = getDayOfLife();

    const prompt = `You are an elite NICU/PICU intensivist creating world-class clinical documentation.

PATIENT: ${patient?.name || 'N/A'} | ${getCurrentAge} | ${dolInfo ? dolInfo + ' | ' : ''}${patient?.unit || 'NICU'} | Dx: ${patient?.diagnosis || 'N/A'}
DATE: ${date} | TIME: ${time}${dayInfo ? ' | ' + dayInfo : ''}

VOICE DICTATION:
"${transcript}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    CLINICAL PROGRESS NOTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Date: ${date}                                        Time: ${time}
${dayInfo || ''}${dolInfo ? '                                             ' + dolInfo : ''}

┌─ SUBJECTIVE ─────────────────────────────────────────────────┐
│                                                              │
│ CHIEF CONCERN: [Context-aware - identify the TYPE]:         │
│   • Disease/Condition update (e.g., "RDS Day 3 - weaning")  │
│   • Investigation review (e.g., "CXR review - improving")   │
│   • Procedure (e.g., "Post UVC insertion")                  │
│   • Counselling (e.g., "Discharge counselling")             │
│   • Routine follow-up (e.g., "Routine Day 5 assessment")    │
│                                                              │
│ HISTORY: [What happened BEFORE this note - timeline]:       │
│   • Birth/Admission details if relevant                     │
│   • Course since last review                                │
│   • Events/changes in last 24h                              │
│   • Previous interventions and response                     │
│                                                              │
│ FEEDING: [Type, volume, frequency, tolerance]               │
│ OUTPUT: [Urine, stool - adequacy]                           │
│ PARENTS: [Concerns, counselling done]                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌─ OBJECTIVE ──────────────────────────────────────────────────┐
│                                                              │
│ VITALS                                                       │
│ T:      HR:      RR:      SpO2:      BP:      CRT:      Wt:  │
│                                                              │
│ RESPIRATORY SUPPORT: [ONLY if mentioned - with STATUS]:     │
│   Status: Continuing / Newly started / Changed / Weaning    │
│   Mode: [CPAP/HFNC/Ventilator/Room air/O2]                  │
│   Settings: [FiO2, PEEP, PIP, etc. if mentioned]            │
│                                                              │
│ OTHER SUPPORT: [ONLY if mentioned - IV lines, feeds, etc.]  │
│                                                              │
│ EXAMINATION                                                  │
│ General  :                                                   │
│ CNS      :                                                   │
│ CVS      :                                                   │
│ Resp     :                                                   │
│ Abdomen  :                                                   │
│ Skin     :                                                   │
│ Access   : [Lines, tubes if mentioned]                       │
│                                                              │
│ INVESTIGATIONS [Only if mentioned]                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌─ ASSESSMENT ─────────────────────────────────────────────────┐
│                                                              │
│ PRIMARY DIAGNOSIS:                                           │
│ [Diagnosis] - [Severity: mild/moderate/severe], [Status]     │
│                                                              │
│ SECONDARY DIAGNOSES:                                         │
│ 1.                                                           │
│ 2.                                                           │
│ 3.                                                           │
│                                                              │
│ ══════════════════════════════════════════════════════════   │
│ CLINICAL IMPRESSION:                                         │
│ [Synthesize: What is the overall clinical picture? How is    │
│  the patient trending? What are the key concerns? What is    │
│  the prognosis for the next 24-48 hours?]                    │
│ ══════════════════════════════════════════════════════════   │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌─ PLAN ───────────────────────────────────────────────────────┐
│                                                              │
│ [Write plan naturally - exactly as dictated]                 │
│ [Group logically: Respiratory → Medications → Fluids/Feeds   │
│  → Monitoring → Investigations → Follow-up]                  │
│                                                              │
│ Medications: Inj/Tab/Syp [Drug] [Dose] [Route] [Frequency]   │
│                                                              │
└──────────────────────────────────────────────────────────────┘

                                           Dr. ${userName || '_______________'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INTELLIGENCE GUIDELINES:

1. CHIEF CONCERN - Be CONTEXT-AWARE:
   Analyze the dictation and identify what TYPE of note this is:
   → Disease update: "RDS Day 3 - on CPAP, weaning FiO2"
   → Investigation: "Blood culture review - no growth at 48h"
   → Procedure: "Post surfactant administration"
   → Counselling: "Pre-discharge counselling with parents"
   → Routine: "Routine morning rounds - DOL 5"

2. HISTORY - Tell the STORY:
   → What is the background? (Birth weight, GA, mode of delivery)
   → What happened since admission/last note?
   → What interventions were done and how did baby respond?
   → Any significant events in the last 24 hours?

3. CLINICAL IMPRESSION - This is CRITICAL:
   Write 1-2 sentences that capture:
   → Overall trajectory (improving/stable/worsening)
   → Key clinical concerns right now
   → Expected course in next 24-48 hours

4. RESPIRATORY/OTHER SUPPORT - UNDERSTAND THE CONTEXT:
   ★ ALWAYS clarify the STATUS of any support mentioned:
     → "on CPAP" / "CPAP continuing" → Status: Continuing on CPAP
     → "started on CPAP" / "put on CPAP" / "intubated" → Status: Newly started
     → "CPAP to HFNC" / "weaning" / "stepped down" → Status: Changed/Weaning
     → "extubated" / "off CPAP" / "room air" → Status: Support removed
   ★ DO NOT include respiratory support section if NOT mentioned
   ★ Same logic for: Ventilator, HFNC, O2 therapy, IV fluids, TPN, phototherapy, etc.
   ★ Examples:
     → User says "baby on CPAP" → Write: "CPAP (Continuing) - [settings if mentioned]"
     → User says "started CPAP today" → Write: "CPAP (Newly initiated) - [settings]"
     → User says "weaning CPAP" → Write: "CPAP (Weaning) - FiO2 reduced from X to Y"

5. INTELLIGENT DEFAULTS - SYSTEM-FOCUSED EXAMINATION:
   ★ If user focuses on ONE SYSTEM (e.g., respiratory), assume OTHER systems are NORMAL:
     → User mentions only respiratory → Other systems: "WNL"
     → User mentions only CNS → CVS, Resp, Abdomen: assume normal
   ★ If user says "vitals stable" or doesn't mention vitals:
     → Neonate defaults: T:37°C HR:140/min RR:45/min SpO2:98% CRT:<2s
   ★ If user says "exam normal" without specifics:
     → General: Active | CNS: Normal tone | CVS: S1S2+ | Resp: B/L AE+ | Abd: Soft, BS+

6. PRONUNCIATION CORRECTION - ALL MEDICAL TERMS:
   Voice transcription often has errors. INTELLIGENTLY DECODE based on context:

   MEDICATIONS:
   → "Vanco mice in" / "Vanko my sin" → Vancomycin
   → "Amp a sill in" / "Ampi cillin" → Ampicillin
   → "Jenta mice in" / "Genta my sin" → Gentamicin
   → "Phenol barb a tone" / "Pheno barbi tone" → Phenobarbitone
   → "Dopa mean" / "Doppa meen" → Dopamine
   → "Cafe in" / "Caff een" → Caffeine
   → "Amino fill in" → Aminophylline
   → "Metro nida zole" → Metronidazole
   → "Cef o tax eem" / "Cefo taxime" → Cefotaxime
   → "Amika sin" → Amikacin
   → "Mero pen em" → Meropenem
   → "Pip taz" / "Piper a cillin" → Piperacillin-Tazobactam
   → "Surface tent" / "Sir fac tant" → Surfactant
   → "Leve tiara set am" → Levetiracetam
   → "Midazz o lam" → Midazolam

   DIAGNOSES:
   → "RD yes" / "R D S" → RDS (Respiratory Distress Syndrome)
   → "Neck" / "N E C" → NEC (Necrotizing Enterocolitis)
   → "PD A" / "Pee dee ay" → PDA (Patent Ductus Arteriosus)
   → "High E" / "H I E" → HIE (Hypoxic Ischemic Encephalopathy)
   → "Sepsis" / "Sep sis" → Sepsis
   → "Neo natal" / "Neonatal" → Neonatal
   → "Hyper bili" / "Jaundice" → Hyperbilirubinemia
   → "Meck onium" / "Meconium" → Meconium Aspiration

   PROCEDURES/EQUIPMENT:
   → "See pap" / "C pap" → CPAP
   → "High flow" / "HF NC" → HFNC
   → "You vee see" / "UVC" → Umbilical Venous Catheter
   → "You ay see" / "UAC" → Umbilical Arterial Catheter
   → "Lumber puncture" / "LP" → Lumbar Puncture
   → "Photo therapy" → Phototherapy
   → "Exchange transfusion" → Exchange Transfusion

   EXAMINATION FINDINGS:
   → "Crep it ations" / "Creps" → Crepitations
   → "Ron kai" / "Rhonchi" → Rhonchi
   → "Bi lateral" → Bilateral
   → "Hepato megaly" → Hepatomegaly
   → "Tachy cardia" → Tachycardia
   → "Brady cardia" → Bradycardia
   → "Hypo tonia" → Hypotonia

7. CONTEXT-BASED VALIDATION:
   ★ Only include items RELEVANT to the condition:
     → Sepsis → Antibiotics expected | RDS → Caffeine, Surfactant expected
     → Seizures → Anticonvulsants expected | HIE → Phenobarbitone expected
   ★ IF UNCLEAR: Write "Unable to appreciate" - DO NOT GUESS randomly
   ★ NEVER invent things not mentioned or implied by the dictation

8. ABBREVIATIONS:
   B/L=Bilateral | AE=Air Entry | BS=Bowel Sounds | S1S2+=Heart sounds normal
   CRT=Capillary Refill | GA=Gestational Age | DOL=Day of Life | EBM=Expressed Breast Milk
   TPN=Total Parenteral Nutrition | WNL=Within Normal Limits | NAD=No Abnormality Detected

CRITICAL RULES:
✓ One line per finding - be concise
✓ Use medical abbreviations
✓ Numbers with units (37°C, 140/min, 2.5kg)
✓ NO markdown formatting (no **, ##, *)
✓ CLINICAL IMPRESSION is mandatory - synthesize the case
✓ Plan should mirror what was dictated
✓ If a system is NOT mentioned, write "WNL" or skip it - DO NOT fabricate findings
✓ Respiratory support: MUST indicate status (Continuing/New/Changed/Weaning)
✓ All medical terms must be spelled correctly - use context to decode pronunciation errors`;

    try {
      console.log('🤖 Generating SOAP note...');
      const response = await aiRef.current!.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt
      });

      let noteText = response.text.trim().replace(/```/g, '').replace(/\*\*/g, '');

      if (!noteText || noteText.length < 10) {
        setError('Failed to generate note. Please try again.');
        setIsProcessing(false);
        return;
      }

      console.log('✅ Note generated, length:', noteText.length);

      // 3. EXTRACT & RECONCILE MEDICATIONS
      setProcessingStep('enhancing');

      let medicationsForNote: any[] = [];

      if (patient && onUpdatePatient) {
        try {
          const extractionResult = await extractMedicationsFromNote(
            noteText,
            {
              age: patient.age,
              ageUnit: patient.ageUnit,
              unit: patient.unit,
              diagnosis: patient.diagnosis,
              currentMedications: patient.medications || []
            }
          );

          console.log('🔬 Medication Extraction:', extractionResult.totalFound, 'found');

          medicationsForNote = extractionResult.medications.map(em => ({
            name: em.name,
            dose: em.dose,
            route: em.route,
            frequency: em.frequency,
            startDate: new Date().toISOString(),
            isActive: true,
            addedBy: userName || userEmail || 'Clinical Note',
            addedAt: new Date().toISOString()
          }));

          const reconciliationResult = await reconcileMedications(
            extractionResult.medications,
            patient.medications || [],
            extractionResult.stoppedMedications,
            { addedBy: userName || userEmail || 'System', addedAt: new Date().toISOString() }
          );

          const hasChanges = reconciliationResult.added.length > 0 ||
            reconciliationResult.updated.length > 0 ||
            reconciliationResult.stopped.length > 0;

          if (hasChanges) {
            const allMedications = getMedicationsAfterReconciliation(reconciliationResult);
            const updatedPatient = { ...patient, medications: allMedications };

            const patientRef = doc(db, 'patients', patient.id);
            await updateDoc(patientRef, { medications: allMedications });
            onUpdatePatient(updatedPatient);

            const messages: string[] = [];
            if (reconciliationResult.added.length > 0) messages.push(`${reconciliationResult.added.length} added`);
            if (reconciliationResult.updated.length > 0) messages.push(`${reconciliationResult.updated.length} updated`);
            if (reconciliationResult.stopped.length > 0) messages.push(`${reconciliationResult.stopped.length} stopped`);
            showToast('success', `💊 ${messages.join(', ')}`);
          }
        } catch (medError) {
          console.error('Medication extraction failed:', medError);
        }
      }

      // 4. SAVE NOTE
      const vitals = parseVitals(noteText);
      const examination = parseExamination(noteText);

      const progressNote: ProgressNote = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        note: noteText,
        authorEmail: userEmail || '',
        authorName: userName || userEmail || '',
        date: new Date().toISOString(),
        addedBy: userName || userEmail || '',
        vitals,
        examination,
        medications: medicationsForNote.length > 0 ? medicationsForNote : undefined
      };

      await onSave(progressNote);

      setIsProcessing(false);
      finalTranscriptRef.current = '';

      showToast('success', '✅ Note saved!');
      setTimeout(() => onCancel(), 500);

    } catch (err) {
      console.error('❌ Error:', err);
      setError('Failed: ' + (err as Error).message);
      setIsProcessing(false);
    }
  };

  // Generate formatted note with Gemini AI
  const generateFormattedNote = async () => {
    if (!combinedTranscript && sessions.length === 0) {
      setError('No recordings to process. Please record first.');
      return;
    }

    const fullTranscript = combinedTranscript || sessions.map(s => s.transcript).join(' ');

    if (!fullTranscript.trim()) {
      setError('No transcript available. Please record again.');
      return;
    }

    setIsProcessing(true);
    setProcessingStep('formatting');
    await generateNoteFromText(fullTranscript);
  };

  // Core note generation logic
  const generateNoteFromText = async (fullTranscript: string) => {
    setIsProcessing(true);
    setProcessingStep('formatting');

    const { date, time } = getCurrentDateTime();
    const dayInfo = getDayOfAdmission();
    const dolInfo = getDayOfLife();

    const prompt = `You are an elite NICU/PICU intensivist creating world-class clinical documentation.

PATIENT: ${patient?.name || 'N/A'} | ${getCurrentAge} | ${dolInfo ? dolInfo + ' | ' : ''}${patient?.unit || 'NICU'} | Dx: ${patient?.diagnosis || 'N/A'}
DATE: ${date} | TIME: ${time}${dayInfo ? ' | ' + dayInfo : ''}

VOICE DICTATION:
"${fullTranscript}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    CLINICAL PROGRESS NOTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Date: ${date}                                        Time: ${time}
${dayInfo || ''}${dolInfo ? '                                             ' + dolInfo : ''}

┌─ SUBJECTIVE ─────────────────────────────────────────────────┐
│                                                              │
│ CHIEF CONCERN: [Context-aware - identify the TYPE]:         │
│   • Disease/Condition update (e.g., "RDS Day 3 - weaning")  │
│   • Investigation review (e.g., "CXR review - improving")   │
│   • Procedure (e.g., "Post UVC insertion")                  │
│   • Counselling (e.g., "Discharge counselling")             │
│   • Routine follow-up (e.g., "Routine Day 5 assessment")    │
│                                                              │
│ HISTORY: [What happened BEFORE this note - timeline]:       │
│   • Birth/Admission details if relevant                     │
│   • Course since last review                                │
│   • Events/changes in last 24h                              │
│   • Previous interventions and response                     │
│                                                              │
│ FEEDING: [Type, volume, frequency, tolerance]               │
│ OUTPUT: [Urine, stool - adequacy]                           │
│ PARENTS: [Concerns, counselling done]                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌─ OBJECTIVE ──────────────────────────────────────────────────┐
│                                                              │
│ VITALS                                                       │
│ T:      HR:      RR:      SpO2:      BP:      CRT:      Wt:  │
│                                                              │
│ RESPIRATORY SUPPORT: [ONLY if mentioned - with STATUS]:     │
│   Status: Continuing / Newly started / Changed / Weaning    │
│   Mode: [CPAP/HFNC/Ventilator/Room air/O2]                  │
│   Settings: [FiO2, PEEP, PIP, etc. if mentioned]            │
│                                                              │
│ OTHER SUPPORT: [ONLY if mentioned - IV lines, feeds, etc.]  │
│                                                              │
│ EXAMINATION                                                  │
│ General  :                                                   │
│ CNS      :                                                   │
│ CVS      :                                                   │
│ Resp     :                                                   │
│ Abdomen  :                                                   │
│ Skin     :                                                   │
│ Access   : [Lines, tubes if mentioned]                       │
│                                                              │
│ INVESTIGATIONS [Only if mentioned]                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌─ ASSESSMENT ─────────────────────────────────────────────────┐
│                                                              │
│ PRIMARY DIAGNOSIS:                                           │
│ [Diagnosis] - [Severity: mild/moderate/severe], [Status]     │
│                                                              │
│ SECONDARY DIAGNOSES:                                         │
│ 1.                                                           │
│ 2.                                                           │
│ 3.                                                           │
│                                                              │
│ ══════════════════════════════════════════════════════════   │
│ CLINICAL IMPRESSION:                                         │
│ [Synthesize: What is the overall clinical picture? How is    │
│  the patient trending? What are the key concerns? What is    │
│  the prognosis for the next 24-48 hours?]                    │
│ ══════════════════════════════════════════════════════════   │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌─ PLAN ───────────────────────────────────────────────────────┐
│                                                              │
│ [Write plan naturally - exactly as dictated]                 │
│ [Group logically: Respiratory → Medications → Fluids/Feeds   │
│  → Monitoring → Investigations → Follow-up]                  │
│                                                              │
│ Medications: Inj/Tab/Syp [Drug] [Dose] [Route] [Frequency]   │
│                                                              │
└──────────────────────────────────────────────────────────────┘

                                           Dr. ${userName || '_______________'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INTELLIGENCE GUIDELINES:

1. CHIEF CONCERN - Be CONTEXT-AWARE:
   Analyze the dictation and identify what TYPE of note this is:
   → Disease update: "RDS Day 3 - on CPAP, weaning FiO2"
   → Investigation: "Blood culture review - no growth at 48h"
   → Procedure: "Post surfactant administration"
   → Counselling: "Pre-discharge counselling with parents"
   → Routine: "Routine morning rounds - DOL 5"

2. HISTORY - Tell the STORY:
   → What is the background? (Birth weight, GA, mode of delivery)
   → What happened since admission/last note?
   → What interventions were done and how did baby respond?
   → Any significant events in the last 24 hours?

3. CLINICAL IMPRESSION - This is CRITICAL:
   Write 1-2 sentences that capture:
   → Overall trajectory (improving/stable/worsening)
   → Key clinical concerns right now
   → Expected course in next 24-48 hours

4. RESPIRATORY/OTHER SUPPORT - UNDERSTAND THE CONTEXT:
   ★ ALWAYS clarify the STATUS of any support mentioned:
     → "on CPAP" / "CPAP continuing" → Status: Continuing on CPAP
     → "started on CPAP" / "put on CPAP" / "intubated" → Status: Newly started
     → "CPAP to HFNC" / "weaning" / "stepped down" → Status: Changed/Weaning
     → "extubated" / "off CPAP" / "room air" → Status: Support removed
   ★ DO NOT include respiratory support section if NOT mentioned
   ★ Same logic for: Ventilator, HFNC, O2 therapy, IV fluids, TPN, phototherapy, etc.
   ★ Examples:
     → User says "baby on CPAP" → Write: "CPAP (Continuing) - [settings if mentioned]"
     → User says "started CPAP today" → Write: "CPAP (Newly initiated) - [settings]"
     → User says "weaning CPAP" → Write: "CPAP (Weaning) - FiO2 reduced from X to Y"

5. INTELLIGENT DEFAULTS - SYSTEM-FOCUSED EXAMINATION:
   ★ If user focuses on ONE SYSTEM (e.g., respiratory), assume OTHER systems are NORMAL:
     → User mentions only respiratory → Other systems: "WNL"
     → User mentions only CNS → CVS, Resp, Abdomen: assume normal
   ★ If user says "vitals stable" or doesn't mention vitals:
     → Neonate defaults: T:37°C HR:140/min RR:45/min SpO2:98% CRT:<2s
   ★ If user says "exam normal" without specifics:
     → General: Active | CNS: Normal tone | CVS: S1S2+ | Resp: B/L AE+ | Abd: Soft, BS+

6. PRONUNCIATION CORRECTION - ALL MEDICAL TERMS:
   Voice transcription often has errors. INTELLIGENTLY DECODE based on context:

   MEDICATIONS:
   → "Vanco mice in" / "Vanko my sin" → Vancomycin
   → "Amp a sill in" / "Ampi cillin" → Ampicillin
   → "Jenta mice in" / "Genta my sin" → Gentamicin
   → "Phenol barb a tone" / "Pheno barbi tone" → Phenobarbitone
   → "Dopa mean" / "Doppa meen" → Dopamine
   → "Cafe in" / "Caff een" → Caffeine
   → "Amino fill in" → Aminophylline
   → "Metro nida zole" → Metronidazole
   → "Cef o tax eem" / "Cefo taxime" → Cefotaxime
   → "Amika sin" → Amikacin
   → "Mero pen em" → Meropenem
   → "Pip taz" / "Piper a cillin" → Piperacillin-Tazobactam
   → "Surface tent" / "Sir fac tant" → Surfactant
   → "Leve tiara set am" → Levetiracetam
   → "Midazz o lam" → Midazolam

   DIAGNOSES:
   → "RD yes" / "R D S" → RDS (Respiratory Distress Syndrome)
   → "Neck" / "N E C" → NEC (Necrotizing Enterocolitis)
   → "PD A" / "Pee dee ay" → PDA (Patent Ductus Arteriosus)
   → "High E" / "H I E" → HIE (Hypoxic Ischemic Encephalopathy)
   → "Sepsis" / "Sep sis" → Sepsis
   → "Neo natal" / "Neonatal" → Neonatal
   → "Hyper bili" / "Jaundice" → Hyperbilirubinemia
   → "Meck onium" / "Meconium" → Meconium Aspiration

   PROCEDURES/EQUIPMENT:
   → "See pap" / "C pap" → CPAP
   → "High flow" / "HF NC" → HFNC
   → "You vee see" / "UVC" → Umbilical Venous Catheter
   → "You ay see" / "UAC" → Umbilical Arterial Catheter
   → "Lumber puncture" / "LP" → Lumbar Puncture
   → "Photo therapy" → Phototherapy
   → "Exchange transfusion" → Exchange Transfusion

   EXAMINATION FINDINGS:
   → "Crep it ations" / "Creps" → Crepitations
   → "Ron kai" / "Rhonchi" → Rhonchi
   → "Bi lateral" → Bilateral
   → "Hepato megaly" → Hepatomegaly
   → "Tachy cardia" → Tachycardia
   → "Brady cardia" → Bradycardia
   → "Hypo tonia" → Hypotonia

7. CONTEXT-BASED VALIDATION:
   ★ Only include items RELEVANT to the condition:
     → Sepsis → Antibiotics expected | RDS → Caffeine, Surfactant expected
     → Seizures → Anticonvulsants expected | HIE → Phenobarbitone expected
   ★ IF UNCLEAR: Write "Unable to appreciate" - DO NOT GUESS randomly
   ★ NEVER invent things not mentioned or implied by the dictation

8. ABBREVIATIONS:
   B/L=Bilateral | AE=Air Entry | BS=Bowel Sounds | S1S2+=Heart sounds normal
   CRT=Capillary Refill | GA=Gestational Age | DOL=Day of Life | EBM=Expressed Breast Milk
   TPN=Total Parenteral Nutrition | WNL=Within Normal Limits | NAD=No Abnormality Detected

CRITICAL RULES:
✓ One line per finding - be concise
✓ Use medical abbreviations
✓ Numbers with units (37°C, 140/min, 2.5kg)
✓ NO markdown formatting (no **, ##, *)
✓ CLINICAL IMPRESSION is mandatory - synthesize the case
✓ Plan should mirror what was dictated
✓ If a system is NOT mentioned, write "WNL" or skip it - DO NOT fabricate findings
✓ Respiratory support: MUST indicate status (Continuing/New/Changed/Weaning)
✓ All medical terms must be spelled correctly - use context to decode pronunciation errors`;

    try {
      console.log('🤖 Sending request to Gemini AI...');
      const response = await aiRef.current!.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      console.log('✅ Received response from Gemini');
      let noteText = response.text.trim();
      console.log('📝 Generated note length:', noteText.length, 'characters');

      // Post-processing: Clean up any markdown formatting
      noteText = noteText.replace(/```/g, '').replace(/\*\*/g, '');

      if (!noteText || noteText.length < 10) {
        console.error('⚠️ Generated note is too short or empty');
        setError('Generated note is empty. Please try again.');
        setIsProcessing(false);
        setProcessingStep('');
        return;
      }

      console.log('✅ Setting formatted note:', noteText.substring(0, 100) + '...');
      setFormattedNote(noteText);
      setEditableNote(noteText);
      setIsProcessing(false);
      setProcessingStep('');

    } catch (err) {
      console.error('❌ Formatting error:', err);
      setError('Failed to generate note. Please try again.');
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // Delete a recording session
  const deleteSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    // Recalculate combined transcript
    const remaining = sessions.filter(s => s.id !== sessionId);
    setCombinedTranscript(remaining.map(s => s.transcript).join(' '));
  };

  // Parse medications from clinical note text
  const parseMedications = (noteText: string) => {
    const medications: Array<{ name: string; dose: string; route?: string; frequency?: string; startDate?: string; isActive?: boolean; addedBy?: string; addedAt?: string }> = [];

    // Find the Medications section in the note
    const medicationsMatch = noteText.match(/Medications?:\s*([\s\S]*?)(?=\n\n|IV Fluids:|Feeds:|IMPRESSION|PLAN|$)/i);

    if (medicationsMatch && medicationsMatch[1]) {
      const medicationsText = medicationsMatch[1].trim();

      // Split by lines and parse each medication
      const lines = medicationsText.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.toLowerCase().includes('continue current')) continue;

        // Remove bullet points or dashes
        const cleanLine = trimmedLine.replace(/^[-•*]\s*/, '');

        // Match patterns like:
        // "Inj Vancomycin 15mg/kg IV q12h"
        // "Tab Phenobarbitone 20mg PO BD"
        // "Inj Ampicillin 100mg/kg/dose IV"
        // Key: Use greedy match for name, then look for dose pattern

        // Pattern: Optional prefix (Inj/Tab/Syp) + Name (greedy until dose or route) + Optional dose + Optional route + Optional frequency
        const medicationRegex = /^(?:Inj\.?|Tab\.?|Syp\.?|Cap\.?|Susp\.?)?\s*([A-Za-z][A-Za-z\s\-]+?)(?:\s+(\d+(?:\.\d+)?(?:\s*(?:mg|mcg|g|ml|units?))?(?:\s*\/\s*kg)?(?:\s*\/\s*dose)?(?:\s*\/\s*day)?))?\s*(?:(IV|PO|IM|SC|PR|Oral|Topical|Intravenous|Per\s*Oral))?\s*(?:(q\d+h|BD|TDS|TID|QID|OD|PRN|STAT|Once|Twice|Thrice|daily|twice\s+daily|thrice\s+daily))?/i;

        const match = cleanLine.match(medicationRegex);

        if (match) {
          let [, name, dose, route, frequency] = match;

          // Clean up the name - remove trailing spaces and common stop words
          name = name.trim().replace(/\s+(at|with|for|in|on|to|and|or|the)$/i, '');

          // Only add if we have a meaningful name (more than 2 characters)
          if (name && name.length > 2) {
            medications.push({
              name: name,
              dose: dose?.trim() || 'As per protocol',
              route: route?.trim(),
              frequency: frequency?.trim(),
              startDate: new Date().toISOString(),
              isActive: true,
              addedBy: userName || userEmail || 'Clinical Note',
              addedAt: new Date().toISOString()
            });
          }
        } else {
          // Fallback: Try to extract medication name more intelligently
          // Look for pattern: "Prefix DrugName" or just "DrugName"
          const fallbackMatch = cleanLine.match(/^(?:Inj\.?|Tab\.?|Syp\.?|Cap\.?|Susp\.?)?\s*([A-Za-z][A-Za-z\s\-]+?)(?:\s+\d|\s+IV|\s+PO|\s+IM|$)/i);

          if (fallbackMatch && fallbackMatch[1]) {
            const simpleName = fallbackMatch[1].trim();
            // Only add if name is reasonable length (3-40 characters)
            if (simpleName.length >= 3 && simpleName.length <= 40) {
              medications.push({
                name: simpleName,
                dose: 'As prescribed',
                route: undefined,
                frequency: undefined,
                startDate: new Date().toISOString(),
                isActive: true,
                addedBy: userName || userEmail || 'Clinical Note',
                addedAt: new Date().toISOString()
              });
            }
          }
        }
      }
    }

    return medications;
  };

  // Parse vitals from clinical note text
  const parseVitals = (noteText: string) => {
    const vitals: any = {};

    const vitalsMatch = noteText.match(/VITALS\s*-+\s*([\s\S]*?)(?=-{4,}|SYSTEMIC|$)/i);

    if (vitalsMatch && vitalsMatch[1]) {
      const vitalsText = vitalsMatch[1];

      // Extract temperature
      const tempMatch = vitalsText.match(/Temp(?:erature)?:\s*(\d+\.?\d*)/i);
      if (tempMatch) vitals.temperature = tempMatch[1];

      // Extract HR
      const hrMatch = vitalsText.match(/HR:\s*(\d+)/i);
      if (hrMatch) vitals.hr = hrMatch[1];

      // Extract RR
      const rrMatch = vitalsText.match(/RR:\s*(\d+)/i);
      if (rrMatch) vitals.rr = rrMatch[1];

      // Extract SpO2
      const spo2Match = vitalsText.match(/SpO2:\s*(\d+)/i);
      if (spo2Match) vitals.spo2 = spo2Match[1];

      // Extract BP
      const bpMatch = vitalsText.match(/BP:\s*(\d+\/\d+)/i);
      if (bpMatch) vitals.bp = bpMatch[1];

      // Extract CRT
      const crtMatch = vitalsText.match(/CRT:\s*([\d<>]+\s*sec)/i);
      if (crtMatch) vitals.crt = crtMatch[1];

      // Extract Weight
      const weightMatch = vitalsText.match(/Weight:\s*(\d+\.?\d*)/i);
      if (weightMatch) vitals.weight = weightMatch[1];
    }

    return vitals;
  };

  // Parse examination from clinical note text
  const parseExamination = (noteText: string) => {
    const examination: any = {};

    const examMatch = noteText.match(/SYSTEMIC EXAMINATION\s*-+\s*([\s\S]*?)(?=-{4,}|OTHER FINDINGS|$)/i);

    if (examMatch && examMatch[1]) {
      const examText = examMatch[1];

      // Extract CNS
      const cnsMatch = examText.match(/CNS\s*:\s*([^\n]+)/i);
      if (cnsMatch) examination.cns = cnsMatch[1].trim();

      // Extract CVS
      const cvsMatch = examText.match(/CVS\s*:\s*([^\n]+)/i);
      if (cvsMatch) examination.cvs = cvsMatch[1].trim();

      // Extract CHEST
      const chestMatch = examText.match(/CHEST\s*:\s*([^\n]+)/i);
      if (chestMatch) examination.chest = chestMatch[1].trim();

      // Extract P/A (Per Abdomen)
      const paMatch = examText.match(/P\/A\s*:\s*([^\n]+)/i);
      if (paMatch) examination.perAbdomen = paMatch[1].trim();
    }

    // Extract other findings
    const otherMatch = noteText.match(/OTHER FINDINGS\s*-+\s*([\s\S]*?)(?=-{4,}|TREATMENT|$)/i);
    if (otherMatch && otherMatch[1]) {
      const otherText = otherMatch[1].trim();
      if (otherText && !otherText.toLowerCase().includes('not documented')) {
        examination.otherFindings = otherText;
      }
    }

    return examination;
  };

  // Save note
  const handleSave = async () => {
    console.log('💾 handleSave called');
    console.log('   - isSaving:', isSaving);
    console.log('   - isEditing:', isEditing);
    console.log('   - formattedNote length:', formattedNote?.length || 0);
    console.log('   - editableNote length:', editableNote?.length || 0);

    // Prevent double save
    if (isSaving) {
      console.log('⚠️ Already saving, skipping...');
      return;
    }

    const noteToSave = isEditing ? editableNote : formattedNote;
    console.log('   - noteToSave length:', noteToSave?.length || 0);

    if (!noteToSave) {
      console.error('❌ No note to save! noteToSave is empty');
      setError('No note content to save. Please generate a note first.');
      return;
    }

    console.log('✅ Proceeding with save...');
    setIsSaving(true);

    // Parse structured data from the clinical note
    const vitals = parseVitals(noteToSave);
    const examination = parseExamination(noteToSave);

    try {
      // ============================================================================
      // NEOLINK AI-POWERED MEDICATION EXTRACTION & RECONCILIATION
      // ============================================================================

      let medicationsForNote: any[] = [];

      if (patient && onUpdatePatient) {
        try {
          // STEP 1: Extract medications using Neolink AI
          const extractionResult = await extractMedicationsFromNote(
            noteToSave,
            {
              age: patient.age,
              ageUnit: patient.ageUnit,
              unit: patient.unit,
              diagnosis: patient.diagnosis,
              currentMedications: patient.medications || []
            }
          );

          console.log('🔬 Medication Extraction:', {
            method: extractionResult.method,
            found: extractionResult.totalFound,
            confidence: extractionResult.confidence,
            time: extractionResult.processingTime + 'ms'
          });

          // Convert extracted medications for progress note
          medicationsForNote = extractionResult.medications.map(em => ({
            name: em.name,
            dose: em.dose,
            route: em.route,
            frequency: em.frequency,
            startDate: new Date().toISOString(),
            isActive: true,
            addedBy: userName || userEmail || 'Clinical Note',
            addedAt: new Date().toISOString()
          }));

          // STEP 2: Reconcile with patient medication list
          const reconciliationResult = await reconcileMedications(
            extractionResult.medications,
            patient.medications || [],
            extractionResult.stoppedMedications,
            {
              addedBy: userName || userEmail || 'System',
              addedAt: new Date().toISOString()
            }
          );

          console.log('💊 Medication Reconciliation:', {
            added: reconciliationResult.added.length,
            updated: reconciliationResult.updated.length,
            stopped: reconciliationResult.stopped.length,
            unchanged: reconciliationResult.unchanged.length,
            errors: reconciliationResult.errors.length
          });

          // STEP 3: Update patient if there are changes
          const hasChanges =
            reconciliationResult.added.length > 0 ||
            reconciliationResult.updated.length > 0 ||
            reconciliationResult.stopped.length > 0;

          if (hasChanges) {
            const allMedications = getMedicationsAfterReconciliation(reconciliationResult);

            const updatedPatient = {
              ...patient,
              medications: allMedications
            };

            // Save to Firestore IMMEDIATELY
            // Note: Patients are stored in the root 'patients' collection
            try {
              const patientRef = doc(db, 'patients', patient.id);
              await updateDoc(patientRef, {
                medications: allMedications
              });
              console.log('✅ Medications saved to Firestore');
            } catch (firestoreError) {
              console.error('❌ Failed to save medications to Firestore:', firestoreError);
              showToast('error', '❌ Failed to save medications');
              throw firestoreError;
            }

            // Update local state via callback
            onUpdatePatient(updatedPatient);

            // VISUAL FEEDBACK: Show toast notification
            const messages: string[] = [];
            if (reconciliationResult.added.length > 0) {
              messages.push(`${reconciliationResult.added.length} added`);
            }
            if (reconciliationResult.updated.length > 0) {
              messages.push(`${reconciliationResult.updated.length} updated`);
            }
            if (reconciliationResult.stopped.length > 0) {
              messages.push(`${reconciliationResult.stopped.length} stopped`);
            }

            showToast('success', `💊 ${messages.join(', ')}`);
          }

          // Log any errors
          if (reconciliationResult.errors.length > 0) {
            console.warn('⚠️ Reconciliation warnings:', reconciliationResult.errors);
          }

        } catch (medError) {
          console.error('❌ Medication extraction failed:', medError);

          // FALLBACK: Use existing regex-based extraction
          console.log('⚠️ Falling back to regex extraction');
          const medications = parseMedications(noteToSave);
          medicationsForNote = medications;

          // Simple duplicate prevention (old logic)
          if (medications.length > 0) {
            const existingMedications = patient.medications || [];
            const newMedications = medications.filter(newMed =>
              !existingMedications.find(existing =>
                existing.name.toLowerCase() === newMed.name.toLowerCase() &&
                existing.isActive !== false
              )
            );

            if (newMedications.length > 0) {
              const allMedications = [...existingMedications, ...newMedications];

              // Save to Firestore IMMEDIATELY
              // Note: Patients are stored in the root 'patients' collection
              try {
                const patientRef = doc(db, 'patients', patient.id);
                await updateDoc(patientRef, {
                  medications: allMedications
                });
                console.log('✅ Medications saved to Firestore (fallback mode)');
              } catch (firestoreError) {
                console.error('❌ Failed to save medications to Firestore:', firestoreError);
              }

              const updatedPatient = {
                ...patient,
                medications: allMedications
              };
              onUpdatePatient(updatedPatient);
              showToast('warning', `⚠️ ${newMedications.length} medication(s) added (fallback mode)`);
            }
          }
        }
      } else {
        // No patient or no update callback - use simple parsing
        medicationsForNote = parseMedications(noteToSave);
      }

      // ============================================================================
      // CREATE PROGRESS NOTE
      // ============================================================================

      const progressNote: ProgressNote = {
        id: existingNote?.id || Date.now().toString(),
        timestamp: new Date().toISOString(),
        note: noteToSave,
        authorEmail: userEmail || '',
        authorName: userName || userEmail || '',
        date: new Date().toISOString(),
        addedBy: userName || userEmail || '',
        vitals: vitals,
        examination: examination,
        medications: medicationsForNote.length > 0 ? medicationsForNote : undefined
      };

      // ============================================================================
      // SAVE NOTE
      // ============================================================================

      console.log('📤 Calling onSave with progress note...');
      console.log('   - Note preview:', progressNote.note.substring(0, 100) + '...');
      await onSave(progressNote);
      console.log('✅ Note saved successfully!');

      // Close after successful save
      setTimeout(() => {
        console.log('🚪 Closing note editor...');
        onCancel();
      }, 500);

    } catch (err) {
      console.error('❌ Failed to save note:', err);
      setError('Failed to save note: ' + (err as Error).message);
      setIsSaving(false);
    }
  };

  // Clear everything
  const handleClear = () => {
    setSessions([]);
    setCombinedTranscript('');
    setFormattedNote('');
    setEditableNote('');
    setLiveTranscript('');
    setError('');
    setIsEditing(false);
  };

  // Toggle edit mode
  const toggleEdit = () => {
    if (!isEditing) {
      setEditableNote(formattedNote);
    }
    setIsEditing(!isEditing);
  };

  const { date, time } = getCurrentDateTime();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 text-white px-4 py-4 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Voice Clinical Note</h1>
              <div className="flex items-center gap-2">
                <p className="text-blue-100 text-xs">{patient?.name} | {patient?.unit || 'NICU'} | {date}</p>
                <span className="px-1.5 py-0.5 bg-green-500/30 text-green-100 text-[10px] font-bold rounded uppercase tracking-wide">
                  Gemini
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 pb-32">
        {/* Recording Interface */}
        {!formattedNote && (
          <>
            {/* Audio Waveform Visualization - shows during init AND recording */}
            {(isInitializing || isRecording) && (
              <div className="mb-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                <div className="flex items-center justify-center gap-0.5 h-12">
                  {audioLevels.slice(0, 32).map((level, i) => (
                    <motion.div
                      key={i}
                      className={`w-1.5 rounded-full ${isInitializing ? 'bg-gradient-to-t from-violet-500 to-violet-400' : 'bg-gradient-to-t from-red-500 to-red-400'}`}
                      animate={{ height: isInitializing ? Math.max(4, Math.sin(Date.now() / 200 + i) * 20 + 20) : Math.max(4, level * 50) }}
                      transition={{ duration: 0.1 }}
                    />
                  ))}
                </div>
                <div className="text-center mt-2">
                  <span className="text-xl font-bold text-slate-800 font-mono">
                    {formatTime(recordingTime)}
                  </span>
                  <span className={`ml-2 text-xs font-medium animate-pulse ${isInitializing ? 'text-violet-500' : 'text-red-500'}`}>
                    {isInitializing ? 'STARTING' : 'REC'}
                  </span>
                </div>

                </div>
            )}

            {/* Recording indicator with DONE button */}
            {(isInitializing || isRecording) && !isProcessing && (
              <div className="flex flex-col items-center py-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  isInitializing ? 'bg-violet-500' : 'bg-red-500 animate-pulse'
                }`}>
                  {isInitializing ? (
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  ) : (
                    <Mic className="w-8 h-8 text-white" />
                  )}
                </div>
                <p className="mt-3 text-slate-500 text-sm">
                  {isInitializing ? 'Connecting...' : 'Speak now...'}
                </p>

                {/* Live transcript preview */}
                {liveTranscript && (
                  <div className="mt-3 px-4 py-2 bg-blue-50 rounded-lg max-w-md">
                    <p className="text-sm text-blue-800 italic">{liveTranscript}</p>
                  </div>
                )}

                {/* DONE Button - Stop, Generate, Save all in one */}
                {isRecording && !isInitializing && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={stopAndSaveNote}
                    className="mt-6 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-lg font-bold rounded-2xl shadow-xl flex items-center gap-3 transition-all"
                  >
                    <Save className="w-5 h-5" />
                    Done
                  </motion.button>
                )}
              </div>
            )}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="flex flex-col items-center py-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl">
                  <Loader2 className="w-10 h-10 text-white animate-spin" />
                </div>
                <p className="mt-4 text-lg font-semibold text-slate-700">
                  {processingStep === 'formatting' ? 'Generating note...' : 'Saving...'}
                </p>
                <p className="mt-1 text-sm text-slate-500">This will take a few seconds</p>
              </div>
            )}

            {/* Show record button only when not recording and no sessions */}
            {!isInitializing && !isRecording && !isProcessing && sessions.length === 0 && !formattedNote && (
              <div className="flex flex-col items-center py-6">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startRecording}
                  className="w-24 h-24 rounded-full shadow-xl flex flex-col items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-200 hover:shadow-2xl"
                >
                  <Mic className="w-8 h-8 text-white" />
                  <span className="text-white text-xs font-medium mt-1">REC</span>
                </motion.button>
              </div>
            )}

            {/* Recording Sessions */}
            {sessions.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    Recordings ({sessions.length})
                  </h3>
                  <button
                    onClick={() => setShowSessions(!showSessions)}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    {showSessions ? 'Hide' : 'Show'}
                  </button>
                </div>

                <AnimatePresence>
                  {showSessions && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-2"
                    >
                      {sessions.map((session, index) => (
                        <motion.div
                          key={session.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-blue-600">#{index + 1}</span>
                                <span className="text-xs text-slate-400">{formatTime(session.duration)}</span>
                              </div>
                              <p className="text-sm text-slate-700 leading-relaxed">{session.transcript}</p>
                            </div>
                            <button
                              onClick={() => deleteSession(session.id)}
                              className="ml-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Generate Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={generateFormattedNote}
                  disabled={isProcessing}
                  className="mt-4 w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-50 transition-all"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>
                        {processingStep === 'transcribing' ? 'Transcribing...' : 'Generating Note...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      Generate Clinical Note
                    </>
                  )}
                </motion.button>

                {/* Add More Recording Button */}
                {!isRecording && (
                  <button
                    onClick={startRecording}
                    disabled={isInitializing}
                    className={`mt-2 w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                      isInitializing
                        ? 'bg-slate-200 text-slate-400 cursor-wait'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {isInitializing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Add Another Recording
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Processing State - Gemini Transcription */}
        {isProcessing && (
          <div className="mt-8 flex flex-col items-center">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-blue-200 rounded-full" />
              <div className="absolute top-0 left-0 w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Radio className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            <p className="mt-6 text-slate-700 font-semibold">
              {processingStep === 'transcribing' ? 'Transcribing...' : 'Generating clinical note...'}
            </p>
            {transcriptionStatus && (
              <p className="mt-2 text-blue-600 text-sm font-medium">{transcriptionStatus}</p>
            )}
            <p className="mt-2 text-slate-500 text-sm">
              {processingStep === 'transcribing'
                ? 'Medical speech recognition in progress'
                : 'Formatting your clinical note'}
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Gemini Medical STT
            </div>
          </div>
        )}

        {/* Formatted Note Display */}
        {formattedNote && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 space-y-4"
          >
            {/* Combined Transcript */}
            {combinedTranscript && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Volume2 className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Voice Input</span>
                </div>
                <p className="text-sm text-blue-800 leading-relaxed">{combinedTranscript}</p>
              </div>
            )}

            {/* Clinical Note */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-300" />
                  <span className="text-sm font-semibold text-white">Clinical Progress Note</span>
                </div>
                <button
                  onClick={toggleEdit}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    isEditing
                      ? 'bg-amber-500 text-white'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {isEditing ? 'Editing' : 'Edit'}
                </button>
              </div>

              <div className="p-4 max-h-[55vh] overflow-y-auto">
                {isEditing ? (
                  <textarea
                    value={editableNote}
                    onChange={(e) => setEditableNote(e.target.value)}
                    className="w-full h-96 font-mono text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    spellCheck={false}
                  />
                ) : (
                  <pre className="font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {formattedNote}
                  </pre>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleClear}
                className="py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Start Over
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-3.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-green-200 disabled:opacity-50 transition-all"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Note
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-4 right-4 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl shadow-xl max-w-md mx-auto"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{error}</p>
              <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-4">
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoiceClinicalNote;
