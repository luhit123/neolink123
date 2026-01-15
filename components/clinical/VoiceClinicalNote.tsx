import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProgressNote, Patient } from '../../types';
import { GoogleGenAI } from '@google/genai';
import { audioRecorder } from '../../utils/audioRecorder';
import {
  transcribeWithDeepgram,
  isDeepgramConfigured,
  startLiveTranscription,
  stopLiveTranscription
} from '../../services/deepgramService';
import {
  Mic, Square, FileText, RefreshCw, X, Plus, Edit3,
  Volume2, Pause, Play, Trash2, Save, Wand2, Stethoscope, Radio
} from 'lucide-react';

interface VoiceClinicalNoteProps {
  patient?: Patient;
  onSave: (note: ProgressNote) => void;
  onCancel: () => void;
  onUpdatePatient?: (patient: Patient) => void; // Callback to update patient data (e.g., medications)
  existingNote?: ProgressNote;
  userEmail?: string;
  userName?: string;
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
  userName
}) => {
  // Core states
  const [isRecording, setIsRecording] = useState(false);
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
  const finalTranscriptRef = useRef<string>(''); // Accumulate final results
  const interimTranscriptRef = useRef<string>(''); // Track interim results

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

  // Audio visualization
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

  // Start recording with live transcription
  const startRecording = async () => {
    setError('');
    setLiveTranscript('');
    setRecordingTime(0);
    setTranscriptionStatus('');
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';

    // Check Deepgram configuration
    if (!isDeepgramConfigured()) {
      setError('Deepgram not configured. Please check Deepgram API key in settings.');
      return;
    }

    try {
      console.log('🎤 Starting recording with Deepgram Nova-3 live streaming...');

      // Start live transcription with Deepgram streaming
      await startLiveTranscription(
        (transcript: string, isFinal: boolean) => {
          console.log(`📝 Transcript ${isFinal ? 'FINAL' : 'interim'}:`, transcript);

          if (isFinal) {
            // Final result - add to accumulated final text
            finalTranscriptRef.current = finalTranscriptRef.current
              ? `${finalTranscriptRef.current} ${transcript}`
              : transcript;
            interimTranscriptRef.current = ''; // Clear interim

            // Update display with final text only
            setLiveTranscript(finalTranscriptRef.current);
            console.log('✅ Final accumulated:', finalTranscriptRef.current);
          } else {
            // Interim result - temporary text
            interimTranscriptRef.current = transcript;

            // Display: final + interim (with separator)
            const displayText = finalTranscriptRef.current
              ? `${finalTranscriptRef.current} ${transcript}`
              : transcript;
            setLiveTranscript(displayText);
          }
        },
        (error: string) => {
          console.error('❌ Live transcription error:', error);
          setError(`Transcription error: ${error}`);
        }
      );

      console.log('✅ Live transcription started successfully');

      // Start audio recording (for backup)
      await audioRecorder.start({
        onError: (err) => {
          setError(err);
          setIsRecording(false);
        }
      });

      // Get media stream for visualization (separate from streaming)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      await startAudioVisualization(stream);

      setIsRecording(true);
      setIsPaused(false);
      setTranscriptionStatus('🎤 Listening...');

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('❌ Failed to start recording:', err);
      setError((err as Error).message);
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

  // Stop recording and transcribe with Deepgram
  const stopRecording = async () => {
    console.log('🛑 Stopping recording...');

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    stopAudioVisualization();

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Stop live transcription
    stopLiveTranscription();

    setIsRecording(false);
    setIsPaused(false);
    setTranscriptionStatus('');

    const currentDuration = recordingTime;
    // Use the final accumulated transcript from ref
    const finalTranscript = finalTranscriptRef.current.trim();

    console.log('📝 Final transcript from Deepgram:', finalTranscript);
    console.log('⏱️ Recording duration:', currentDuration, 'seconds');

    try {
      // Stop audio recorder
      await audioRecorder.stop();

      if (!finalTranscript || finalTranscript.length < 3) {
        console.warn('⚠️ No speech detected or recording too short');
        setError('No speech detected. Please speak clearly and try again.');
        setLiveTranscript('');
        finalTranscriptRef.current = '';
        interimTranscriptRef.current = '';
        return;
      }

      // Create new session with the live transcript
      const newSession: RecordingSession = {
        id: Date.now().toString(),
        transcript: finalTranscript,
        duration: currentDuration,
        timestamp: new Date()
      };

      setSessions(prev => [...prev, newSession]);

      // Update combined transcript
      setCombinedTranscript(prev =>
        prev ? `${prev} ${finalTranscript}` : finalTranscript
      );

      setLiveTranscript('');
      setRecordingTime(0);
      finalTranscriptRef.current = '';
      interimTranscriptRef.current = '';

      console.log('✅ Recording session saved:', newSession);

    } catch (err) {
      console.error('❌ Error stopping recording:', err);
      setError((err as Error).message);
      setIsProcessing(false);
      setProcessingStep('');
      setTranscriptionStatus('');
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

    const { date, time } = getCurrentDateTime();
    const dayInfo = getDayOfAdmission();

    const prompt = `You are an expert NICU/PICU medical scribe with 20 years experience. Your task is to convert voice dictation into a perfectly structured clinical progress note.

VOICE DICTATION:
"${fullTranscript}"

PATIENT CONTEXT:
- Name: ${patient?.name || 'N/A'}
- Age: ${patient?.age || ''} ${patient?.ageUnit || 'days'}
- Unit: ${patient?.unit || 'NICU'}
- Primary Diagnosis: ${patient?.diagnosis || 'N/A'}
- Date: ${date}
- Time: ${time}
${dayInfo ? `- ${dayInfo}` : ''}

GENERATE THIS EXACT FORMAT:

CLINICAL PROGRESS NOTE

Date: ${date}                                              Time: ${time}
${dayInfo || ''}

VITALS
Temp:           HR:             RR:             SpO2:
BP:             CRT:            Weight:

SYSTEMIC EXAMINATION
CNS   :
CVS   :
CHEST :
P/A   :

OTHER FINDINGS


TREATMENT

Respiratory Support:

Inotropic Support:

Medications:

IV Fluids:

Feeds:

IMPRESSION


PLAN AND ADVICE


                                                    Dr. ${userName || '_____________'}

STATE-OF-THE-ART DOCUMENTATION RULES:

GOLDEN RULE: Only write what is SAID. If a specific finding is mentioned, write ONLY that finding.
If a system is "normal" or not mentioned, write concise standard normal findings.

1. VITALS - BE PRECISE:
   If specific numbers mentioned → Write EXACTLY those numbers
   Example: "Temp 38, HR 150" → Temp: 38°C  HR: 150/min

   If "vitals stable/normal" → Write age-appropriate normals:
   - Neonate: Temp: 37°C, HR: 140/min, RR: 48/min, SpO2: 98%
   - Infant: Temp: 37°C, HR: 120/min, RR: 35/min, SpO2: 98%
   - Toddler: Temp: 37°C, HR: 100/min, RR: 25/min, SpO2: 99%

2. CNS - BRAIN/NEUROLOGICAL ONLY:
   Specific finding mentioned → Write ONLY that finding:
   - "Baby has seizures" → CNS: Seizure activity noted
   - "Fontanelle bulging" → CNS: AF bulging
   - "Tone decreased" → CNS: Hypotonia
   - "Lethargy" → CNS: Lethargic
   - "Irritable" → CNS: Irritable

   If "CNS normal" or not mentioned → Write:
   CNS: Alert and active
   OR
   CNS: WNL

3. CVS - HEART/CARDIAC ONLY:
   Specific finding mentioned → Write ONLY that finding:
   - "Murmur present" → CVS: Murmur heard
   - "Tachycardia" → CVS: Tachycardia
   - "CRT delayed" → CVS: CRT >3 sec

   DO NOT write extremity findings (cold/clammy) here - those go in OTHER FINDINGS

   If "CVS normal" or not mentioned → Write:
   CVS: S1S2+, no murmur

4. CHEST - CONCISE & SMART:
   Specific finding mentioned → Write ONLY that finding:
   - "Subcostal retractions present" → CHEST: Subcostal retractions present
   - "Grunting" → CHEST: Expiratory grunting
   - "Decreased air entry left" → CHEST: Decreased AE left side
   - "Bilateral crackles" → CHEST: B/L crackles

   If "Chest clear/normal" or not mentioned → Write standard normal:
   CHEST: B/L AE equal, no retractions

5. P/A (PER ABDOMEN) - CONCISE & SMART:
   Specific finding mentioned → Write ONLY that finding:
   - "Abdomen distended" → P/A: Distended
   - "Vomiting" → P/A: Vomiting noted
   - "Tender" → P/A: Tender on palpation

   If "Abdomen normal/soft" or not mentioned → Write standard normal:
   P/A: Soft, BS+

MEDICAL ABBREVIATIONS TO USE:
- AE = Air Entry
- B/L = Bilateral
- BS = Bowel Sounds
- AF = Anterior Fontanelle
- S1S2+ = Heart sounds present
- CRT = Capillary Refill Time
- RR = Respiratory Rate
- HR = Heart Rate
- SpO2 = Oxygen Saturation
- P/A = Per Abdomen

6. OTHER FINDINGS - For Non-System Specific:
   Use for findings that don't fit CNS/CVS/CHEST/P/A:
   - Extremities: "Cold extremities", "Clammy", "Mottled", "Edema"
   - Skin: "Jaundice", "Rash", "Cyanosis", "Petechiae"
   - Access: "PIV in situ", "UVC in place", "UAC in situ"
   - Urine: "Adequate urine output", "Oliguria", "Anuria"
   - Perfusion: "Poor perfusion", "Mottling" (if mentioned as extremity finding)

   Be concise: "Jaundice present" NOT "Jaundice is present in the baby"

   If nothing specific mentioned, leave blank or write nothing

7. MEDICATIONS - Professional Format:
   Remove action words, use proper prefixes:
   - "started vancomycin 15mg/kg" → "Inj Vancomycin 15mg/kg IV"
   - "given ampicillin" → "Inj Ampicillin [dose]"
   - "oral phenobarbitone 20mg" → "Syp Phenobarbitone 20mg PO"
   - "paracetamol IV" → "Inj Paracetamol [dose]"

   Format: Inj/Tab/Syp/Cap [Drug] [dose] [route] [frequency]

8. RESPIRATORY SUPPORT - Under TREATMENT Only:
   - "On CPAP" → TREATMENT: CPAP with PEEP X cmH2O, FiO2 X%
   - "Ventilator" → TREATMENT: Ventilator mode [SIMV/AC], PIP X, PEEP X, FiO2 X%, Rate X
   - "O2 via nasal cannula" → TREATMENT: O2 @ X L/min via nasal cannula
   - NEVER write respiratory support in OTHER FINDINGS

9. INOTROPES - Under TREATMENT Only:
   - "On dopamine" → TREATMENT: Dopamine @ X mcg/kg/min
   - "Adrenaline" → TREATMENT: Adrenaline @ X mcg/kg/min
   Always include dose if mentioned

10. BE SMART, BE CONCISE:
    - Don't write verbose sentences
    - Use medical abbreviations
    - Be precise and professional
    - If not mentioned, use standard concise normals
    - If mentioned, write ONLY what's said

11. IMPRESSION - STATE-OF-THE-ART CLINICAL SYNTHESIS:
    The IMPRESSION is the MOST IMPORTANT section - it synthesizes all findings into a clear diagnosis.

    GOLDEN RULES FOR IMPRESSIVE IMPRESSIONS:

    a) START WITH PRIMARY DIAGNOSIS:
       - Lead with the main diagnosis or chief problem
       - Use proper medical terminology
       - Be specific and definitive

    b) ADD SEVERITY/STATUS:
       - Include severity: mild/moderate/severe
       - Include trend: improving/worsening/stable
       - Include treatment response if mentioned

    c) LIST COMPLICATIONS/CONCERNS:
       - List secondary diagnoses or complications
       - Numbered or bulleted format for clarity
       - Each on a new line for readability

    d) BE CONCISE BUT COMPLETE:
       - No unnecessary words
       - Include all significant problems
       - Prioritize by clinical importance

    STRUCTURE:
    Primary Diagnosis (severity/status)
    1. Complication/concern #1
    2. Complication/concern #2
    3. Additional problems

    EXAMPLES OF STELLAR IMPRESSIONS:

    Example A - Respiratory Distress Syndrome:
    IMPRESSION:
    Respiratory Distress Syndrome (moderate, improving on CPAP)
    1. Prematurity (32 weeks GA)
    2. Rule out early onset sepsis - on antibiotics
    3. Hyperbilirubinemia - under phototherapy

    Example B - Neonatal Sepsis:
    IMPRESSION:
    Early Onset Neonatal Sepsis (culture positive - E.coli, improving)
    1. Respiratory distress - resolved
    2. Metabolic acidosis - corrected
    3. Thrombocytopenia - recovering

    Example C - Meconium Aspiration:
    IMPRESSION:
    Meconium Aspiration Syndrome (severe, on mechanical ventilation)
    1. Persistent Pulmonary Hypertension
    2. Acute Kidney Injury - oliguria present
    3. Perinatal asphyxia

    Example D - Seizures:
    IMPRESSION:
    Neonatal Seizures (controlled on phenobarbitone)
    1. Hypoxic Ischemic Encephalopathy - Grade II
    2. Metabolic derangements - corrected

    Example E - Simple stable case:
    IMPRESSION:
    Transient Tachypnea of Newborn (resolved)
    Clinically stable

    WHAT MAKES AN IMPRESSION AWESOME:
    ✓ Clear primary diagnosis at the top
    ✓ Clinical status/severity included
    ✓ Complications listed systematically
    ✓ Easy to understand at a glance
    ✓ No vague terms like "sick baby" or "unwell"
    ✓ Proper medical terminology
    ✓ Prioritized by importance
    ✓ Treatment response if mentioned

    AVOID IN IMPRESSION:
    ✗ Vague statements: "Baby is sick", "Not doing well"
    ✗ Too much detail: Save details for examination
    ✗ Repeating vitals: Already documented above
    ✗ Long paragraphs: Use structured list
    ✗ Uncertainty without reason: Instead of "? Sepsis", write "Rule out sepsis"

CRITICAL RULES FOR STATE-OF-THE-ART DOCUMENTATION:

✓ BE LITERAL: If a specific finding is mentioned → Write ONLY that finding, nothing more
✓ BE SMART: If "normal" or not mentioned → Write concise standard normal findings
✓ USE ABBREVIATIONS: AE, B/L, BS, S1S2+, CRT, WNL (professional & concise)
✓ BE CONCISE: "Soft, BS+" not "Soft, non-distended, bowel sounds present, no organomegaly"
✓ DON'T ADD: If user says "subcostal retractions", write ONLY that, don't add other findings
✓ DON'T REPEAT: Don't write "normal" - use specific abbreviated findings
✓ NO PLACEHOLDERS: Remove all [brackets], template text, "any advice/counseling", etc.
✓ CLEAN SECTIONS: If section empty, leave blank - don't write placeholder text
✓ CNS NORMAL: Just "Alert and active" or "WNL" - NO fontanelle in normal
✓ EXTREMITIES: Cold/clammy extremities → OTHER FINDINGS, NOT CVS
✓ SYSTEM-SPECIFIC: CVS = heart only, CHEST = lungs only, CNS = brain only
✓ MEDICATIONS: Inj/Tab/Syp format, remove "started/given"
✓ NO EMOJIS, NO MARKDOWN, CLEAN PROFESSIONAL DOCUMENTATION

PERFECT EXAMPLES:

Example 1 - Mixed findings:
Voice: "Subcostal retractions present, other systems normal, vitals stable"
CORRECT:
VITALS: Temp: 37°C  HR: 140/min  RR: 48/min  SpO2: 98%
CNS   : Alert and active
CVS   : S1S2+, no murmur
CHEST : Subcostal retractions present
P/A   : Soft, BS+

Example 2 - All normal:
Voice: "Baby is stable, all systems normal"
CORRECT:
VITALS: Temp: 37°C  HR: 140/min  RR: 48/min  SpO2: 98%
CNS   : WNL
CVS   : S1S2+, no murmur
CHEST : B/L AE equal, no retractions
P/A   : Soft, BS+

Example 3 - Cold extremities (goes to OTHER FINDINGS):
Voice: "Cold and clammy extremities, jaundice present, CVS normal"
CORRECT:
CVS: S1S2+, no murmur
OTHER FINDINGS: Cold and clammy extremities, jaundice present

Example 4 - Specific findings with empty sections:
Voice: "Baby has seizures, abdomen distended, started phenobarbitone"
CORRECT:
CNS: Seizure activity noted
CVS: S1S2+, no murmur
CHEST: B/L AE equal, no retractions
P/A: Distended
OTHER FINDINGS:
(leave blank if nothing to write)
TREATMENT
Medications: Inj Phenobarbitone [dose]

Example 5 - Clean sections, no placeholders:
Voice: "Respiratory distress with grunting, on CPAP PEEP 5 FiO2 40"
CORRECT:
CHEST: Expiratory grunting, tachypnea
TREATMENT
Respiratory Support: CPAP with PEEP 5 cmH2O, FiO2 40%

Example 6 - Complete Note with IMPRESSION and PLAN AND ADVICE:
Voice: "Baby has respiratory distress, grunting present, on CPAP PEEP 5, SpO2 92%, continue surfactant, chest X-ray needed"
CORRECT:
VITALS: SpO2: 92%
CNS: Alert and active
CVS: S1S2+, no murmur
CHEST: Expiratory grunting, subcostal retractions
P/A: Soft, BS+

TREATMENT
Respiratory Support: CPAP with PEEP 5 cmH2O
Medications: Inj Surfactant (given)

IMPRESSION:
Respiratory Distress Syndrome (moderate, on CPAP)
1. Prematurity
2. Rule out pneumonia

PLAN AND ADVICE:
- Continue CPAP, wean as tolerated
- Chest X-ray to assess lung fields
- Monitor SpO2 closely
- If worsening, consider intubation
- Counsel parents regarding progress

REMEMBER:
- NO placeholder text like "[any findings]" or "any advice/counseling"
- Empty sections stay empty - don't fill with template text
- CNS normal = "Alert and active" or "WNL" (NOT "AF flat")
- Cold/clammy extremities = OTHER FINDINGS (NOT CVS)
- System-specific only (CVS = heart, CHEST = lungs, CNS = brain)
- IMPRESSION must be concise, structured, and state primary diagnosis clearly
- PLAN AND ADVICE should be actionable bullet points`;

    try {
      const response = await aiRef.current!.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      let noteText = response.text.trim();

      // Post-processing: Clean up any markdown formatting
      noteText = noteText.replace(/```/g, '').replace(/\*\*/g, '');

      setFormattedNote(noteText);
      setEditableNote(noteText);
      setIsProcessing(false);
      setProcessingStep('');

    } catch (err) {
      console.error('Formatting error:', err);
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
    // Prevent double save
    if (isSaving) return;

    const noteToSave = isEditing ? editableNote : formattedNote;
    if (!noteToSave) return;

    setIsSaving(true);

    // Parse structured data from the clinical note
    const medications = parseMedications(noteToSave);
    const vitals = parseVitals(noteToSave);
    const examination = parseExamination(noteToSave);

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
      medications: medications.length > 0 ? medications : undefined
    };

    // Auto-add medications to patient's medication management
    if (medications.length > 0 && patient && onUpdatePatient) {
      const existingMedications = patient.medications || [];
      const newMedications: Medication[] = [];

      // Check each parsed medication
      for (const newMed of medications) {
        // Check if medication already exists and is active
        const existingMed = existingMedications.find(
          (med) =>
            med.name.toLowerCase() === newMed.name.toLowerCase() &&
            med.isActive !== false
        );

        if (!existingMed) {
          // Add new medication if it doesn't exist or is not active
          newMedications.push(newMed);
        }
      }

      // Merge new medications with existing ones
      if (newMedications.length > 0) {
        const updatedPatient = {
          ...patient,
          medications: [...existingMedications, ...newMedications]
        };
        onUpdatePatient(updatedPatient);
      }
    }

    try {
      await onSave(progressNote);
      // Close after successful save
      setTimeout(() => {
        onCancel();
      }, 500);
    } catch (err) {
      setError('Failed to save note');
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
            {/* Audio Waveform Visualization */}
            {isRecording && (
              <div className="mb-6 bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                <div className="flex items-center justify-center gap-0.5 h-16">
                  {audioLevels.slice(0, 32).map((level, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 bg-gradient-to-t from-blue-500 to-blue-400 rounded-full"
                      animate={{ height: Math.max(4, level * 60) }}
                      transition={{ duration: 0.05 }}
                    />
                  ))}
                </div>
                <div className="text-center mt-2">
                  <span className="text-2xl font-bold text-slate-800 font-mono">
                    {formatTime(recordingTime)}
                  </span>
                  <span className="ml-2 text-xs text-red-500 animate-pulse font-medium">RECORDING</span>
                </div>
              </div>
            )}

            {/* Live Transcription */}
            {isRecording && liveTranscript && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Volume2 className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Live Transcription</span>
                </div>
                <p className="text-sm text-blue-800 leading-relaxed">{liveTranscript}</p>
              </motion.div>
            )}

            {/* Recording Controls */}
            <div className="flex flex-col items-center py-8">
              {!isRecording ? (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startRecording}
                  className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 shadow-xl shadow-blue-200 flex flex-col items-center justify-center transition-all hover:shadow-2xl"
                >
                  <Mic className="w-10 h-10 text-white" />
                  <span className="text-white text-xs font-medium mt-1">TAP TO RECORD</span>
                </motion.button>
              ) : (
                <div className="flex items-center gap-4">
                  {/* Pause/Resume */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    className="w-16 h-16 rounded-full bg-amber-500 shadow-lg flex items-center justify-center"
                  >
                    {isPaused ? (
                      <Play className="w-7 h-7 text-white" />
                    ) : (
                      <Pause className="w-7 h-7 text-white" />
                    )}
                  </motion.button>

                  {/* Stop */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={stopRecording}
                    className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-xl shadow-red-200 flex flex-col items-center justify-center"
                  >
                    <Square className="w-8 h-8 text-white" />
                    <span className="text-white text-xs font-medium mt-1">STOP</span>
                  </motion.button>
                </div>
              )}

              <p className="mt-6 text-slate-500 text-sm text-center max-w-xs">
                {isRecording
                  ? isPaused
                    ? 'Recording paused. Tap play to continue.'
                    : 'Speak your clinical findings clearly. Tap stop when done.'
                  : sessions.length > 0
                    ? 'Tap to add another recording or generate note below.'
                    : 'Tap to start recording your clinical note.'
                }
              </p>
            </div>

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
                    className="mt-2 w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add Another Recording
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
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
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
