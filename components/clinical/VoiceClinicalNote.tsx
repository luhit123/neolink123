import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProgressNote, Patient } from '../../types';
import { GoogleGenAI } from '@google/genai';
import { audioRecorder } from '../../utils/audioRecorder';
import { transcribeWithMedAsr, isMedAsrConfigured } from '../../services/medAsrService';
import {
  Mic, Square, FileText, RefreshCw, X, Plus, Edit3,
  Volume2, Pause, Play, Trash2, Save, Wand2, Stethoscope, Radio
} from 'lucide-react';

interface VoiceClinicalNoteProps {
  patient?: Patient;
  onSave: (note: ProgressNote) => void;
  onCancel: () => void;
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
 * - RunPod MedASR for medical speech-to-text (serverless)
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

  // Initialize Gemini AI and check MedASR
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey) {
      aiRef.current = new GoogleGenAI({ apiKey });
    }

    // Check MedASR configuration
    if (!isMedAsrConfigured()) {
      console.warn('MedASR not configured. Check RunPod API key and endpoint ID.');
    } else {
      console.log('MedASR configured and ready');
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

  // Start recording
  const startRecording = async () => {
    setError('');
    setLiveTranscript('');
    setRecordingTime(0);
    setTranscriptionStatus('');

    // Check MedASR configuration
    if (!isMedAsrConfigured()) {
      setError('MedASR not configured. Please check RunPod API settings.');
      return;
    }

    try {
      // Start audio recording
      await audioRecorder.start({
        onError: (err) => {
          setError(err);
          setIsRecording(false);
        }
      });

      // Get media stream for visualization
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      await startAudioVisualization(stream);

      setIsRecording(true);
      setIsPaused(false);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
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

  // Stop recording and transcribe with MedASR
  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    stopAudioVisualization();

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }

    setIsRecording(false);
    setIsPaused(false);

    const currentDuration = recordingTime;

    try {
      const audioBlob = await audioRecorder.stop();

      if (!audioBlob || audioBlob.size < 1000) {
        setError('Recording too short. Please speak for at least 3 seconds.');
        return;
      }

      // Transcribe with RunPod MedASR
      setIsProcessing(true);
      setProcessingStep('transcribing');

      const audioBase64 = await audioRecorder.blobToBase64(audioBlob);

      const finalTranscript = await transcribeWithMedAsr(audioBase64, (status) => {
        setTranscriptionStatus(status);
      });

      setIsProcessing(false);
      setProcessingStep('');
      setTranscriptionStatus('');

      if (finalTranscript && finalTranscript.trim()) {
        // Create new session
        const newSession: RecordingSession = {
          id: Date.now().toString(),
          transcript: finalTranscript.trim(),
          duration: currentDuration,
          timestamp: new Date()
        };

        setSessions(prev => [...prev, newSession]);

        // Update combined transcript
        setCombinedTranscript(prev =>
          prev ? `${prev} ${finalTranscript.trim()}` : finalTranscript.trim()
        );

        setLiveTranscript(finalTranscript.trim());
      } else {
        setError('No speech detected. Please try again.');
      }

      setRecordingTime(0);

    } catch (err) {
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

================================================================================
                          CLINICAL PROGRESS NOTE
================================================================================
Date: ${date}                                              Time: ${time}
${dayInfo || ''}
--------------------------------------------------------------------------------

VITALS
--------------------------------------------------------------------------------
Temp:           HR:             RR:             SpO2:
BP:             CRT:            Weight:
--------------------------------------------------------------------------------

SYSTEMIC EXAMINATION
--------------------------------------------------------------------------------
CNS   : [findings]
CVS   : [findings]
CHEST : [findings]
P/A   : [findings]
--------------------------------------------------------------------------------

OTHER FINDINGS
--------------------------------------------------------------------------------
[any additional findings - skin, jaundice, access, urine output, etc.]
--------------------------------------------------------------------------------

TREATMENT
--------------------------------------------------------------------------------
[Structure as applicable:]

Respiratory Support:
[CPAP/Ventilator/O2/Room air with parameters]

Inotropic Support:
[Dopamine/Dobutamine/Adrenaline/Noradrenaline with doses in mcg/kg/min]

Medications:
[Antibiotics and other drugs with doses]

IV Fluids:
[Type and rate]

Feeds:
[Type, volume, frequency]

[If nothing mentioned: "Continue current treatment"]
--------------------------------------------------------------------------------

IMPRESSION
--------------------------------------------------------------------------------
[Clinical status summary]
--------------------------------------------------------------------------------

PLAN
--------------------------------------------------------------------------------
[Management plan items]
--------------------------------------------------------------------------------

ADVICE
--------------------------------------------------------------------------------
[Any advice/counseling points]
--------------------------------------------------------------------------------

                                                    Dr. ${userName || '_____________'}
================================================================================

EXTRACTION RULES:
1. VITALS: Extract ALL numbers - temp (37.5, 38), HR (140, 160), RR (48, 60), SpO2 (95%, 98%), BP (70/40), CRT (2 sec, <3 sec)
   - "vitals normal/stable" = Temp: 36.8C  HR: 140/min  RR: 48/min  SpO2: 98%

2. CNS: Look for - alert, active, tone (normal/hypo/hyper), fontanelle (flat/bulging), reflexes
   - "CNS normal" = Alert, active, normal tone, AF flat, reflexes present

3. CVS: Look for - S1 S2, murmur, perfusion, pulses, CRT
   - "CVS normal" = S1S2 heard, no murmur, well perfused, pulses palpable

4. CHEST: Look for - air entry (AE), breath sounds, retractions, added sounds
   - "Chest clear" = B/L AE equal, no added sounds, no retractions

5. P/A: Look for - soft/distended, bowel sounds, organomegaly, feeds
   - "Abdomen normal" = Soft, non-distended, BS present, no organomegaly

6. RESPIRATORY SUPPORT - ALWAYS under TREATMENT:
   - CPAP: "CPAP PEEP 5 FiO2 50" → CPAP with PEEP 5 cmH2O, FiO2 50%
   - Ventilator: Include Mode, PIP, PEEP, FiO2, Rate
   - O2: "2 liters" → O2 @ 2 L/min
   - Room air: Mention if stated

7. INOTROPES - ALWAYS under TREATMENT:
   - Dopamine/Dobutamine: dose in mcg/kg/min
   - Adrenaline/Noradrenaline: dose in mcg/kg/min

8. Empty sections: Leave blank or write "Not documented"

CRITICAL RULES:
- Extract EVERY piece of clinical information
- RESPIRATORY SUPPORT goes under TREATMENT, never in OTHER FINDINGS
- INOTROPES go under TREATMENT
- NO emojis, NO assumptions beyond what is stated
- Preserve exact values mentioned
- If "all normal" or "vitals stable" - fill standard normal values`;

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

  // Save note
  const handleSave = async () => {
    const noteToSave = isEditing ? editableNote : formattedNote;
    if (!noteToSave) return;

    setIsSaving(true);

    const progressNote: ProgressNote = {
      id: existingNote?.id || Date.now().toString(),
      timestamp: new Date().toISOString(),
      note: noteToSave,
      authorEmail: userEmail || '',
      authorName: userName || userEmail || '',
      vitals: {},
      examination: {}
    };

    try {
      await onSave(progressNote);
    } catch (err) {
      setError('Failed to save note');
    } finally {
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
