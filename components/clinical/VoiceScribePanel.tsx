import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassModal } from '../premium/GlassModal';
import { PremiumButton } from '../premium/PremiumButton';
import { glassmorphism, glassClasses } from '../../theme/glassmorphism';
import { getVoiceScribeService } from '../../services/voiceScribeService';
import { ProgressNote, Patient } from '../../types';
import { PatientContext } from '../../types/medgemma';

export interface VoiceScribePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (data: Partial<ProgressNote>) => void;
  patientAge?: number;
  patientUnit?: string;
  patient?: Patient;
}

/**
 * VoiceScribePanel - Gemini Audio powered voice recording interface
 *
 * Records audio and sends to Gemini for:
 * - Speech-to-text transcription
 * - Clinical data extraction
 * - Structured documentation
 */
export const VoiceScribePanel: React.FC<VoiceScribePanelProps> = ({
  isOpen,
  onClose,
  onInsert,
  patientAge,
  patientUnit,
  patient,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [structuredData, setStructuredData] = useState<Partial<ProgressNote> | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [recordingTime, setRecordingTime] = useState(0);

  const voiceScribe = getVoiceScribeService();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Build patient context for Gemini
  const getPatientContext = (): PatientContext | undefined => {
    if (patient) {
      return {
        age: patient.age,
        ageUnit: patient.ageUnit,
        gender: patient.gender,
        weight: patient.birthWeight || patient.weightOnAdmission,
        diagnosis: patient.diagnosis,
        unit: patient.unit || patientUnit || 'NICU'
      };
    }
    if (patientAge !== undefined) {
      return {
        age: patientAge,
        ageUnit: 'days',
        unit: patientUnit || 'NICU'
      };
    }
    return undefined;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (isRecording) {
        voiceScribe.abort();
      }
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    setError('');
    setTranscript('');
    setStructuredData(null);
    setConfidence(0);
    setRecordingTime(0);

    try {
      await voiceScribe.startScribe(
        (data) => {
          if (data.rawTranscript) {
            setTranscript(data.rawTranscript);
          }

          // Check if we have structured data
          if (data.vitals || data.examination || data.medications) {
            setIsProcessing(false);
            setStructuredData(data);
            setConfidence((data as any).confidence || 0);
          }
        },
        (errorMsg) => {
          setError(errorMsg);
          setIsRecording(false);
          setIsProcessing(false);
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
        },
        getPatientContext()
      );

      setIsRecording(true);

      // Start recording timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      setError((err as Error).message);
      setIsRecording(false);
    }
  };

  const handleStopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setIsRecording(false);
    setIsProcessing(true);
    setTranscript('⏳ Processing audio with Gemini AI...');

    await voiceScribe.stop();
  };

  const handleInsert = () => {
    if (structuredData) {
      onInsert(structuredData);
      handleClose();
    }
  };

  const handleClose = () => {
    if (isRecording) {
      voiceScribe.abort();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    setIsRecording(false);
    setIsProcessing(false);
    setTranscript('');
    setStructuredData(null);
    setError('');
    setRecordingTime(0);
    onClose();
  };

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={handleClose}
      title="🎙️ Voice Scribe (Gemini Audio)"
      size="lg"
      variant="center"
      closeOnBackdropClick={false}
    >
      <div className="space-y-6">
        {/* Recording Visualization */}
        <div className="relative h-40 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-sky-50 rounded-2xl border-2 border-dashed border-sky-200">
          <AnimatePresence mode="wait">
            {isRecording && (
              <motion.div
                key="recording"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center"
              >
                {/* Animated Recording Indicator */}
                <div className="relative mb-4">
                  <motion.div
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
                      <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.93V21h-3a1 1 0 100 2h8a1 1 0 100-2h-3v-3.07A7 7 0 0019 11z" />
                    </svg>
                  </motion.div>
                  {/* Pulsing ring */}
                  <motion.div
                    className="absolute inset-0 rounded-full border-4 border-red-400"
                    animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                </div>

                {/* Recording Time */}
                <div className="text-2xl font-bold text-red-600 font-mono">
                  {formatTime(recordingTime)}
                </div>
                <p className="text-sm text-slate-600 mt-1">Recording... Speak clearly</p>
              </motion.div>
            )}

            {isProcessing && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center"
              >
                <motion.div
                  className="w-16 h-16 mb-3"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <svg className="w-full h-full text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </motion.div>
                <p className="text-sm font-medium text-blue-600">Processing with Gemini AI...</p>
                <p className="text-xs text-slate-500 mt-1">Transcribing & extracting clinical data</p>
              </motion.div>
            )}

            {!isRecording && !isProcessing && !structuredData && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-gradient-to-br from-sky-100 to-blue-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-700">Ready to Record</p>
                <p className="text-xs text-slate-500 mt-1">Click Start to begin voice documentation</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recording Controls */}
        <div className="flex justify-center gap-4">
          {!isRecording && !isProcessing ? (
            <PremiumButton
              variant="primary"
              size="lg"
              onClick={handleStartRecording}
              disabled={isProcessing}
              icon={
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
                  <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.93V21h-3a1 1 0 100 2h8a1 1 0 100-2h-3v-3.07A7 7 0 0019 11z" />
                </svg>
              }
            >
              Start Recording
            </PremiumButton>
          ) : isRecording ? (
            <PremiumButton
              variant="danger"
              size="lg"
              onClick={handleStopRecording}
              icon={
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              }
            >
              Stop & Process
            </PremiumButton>
          ) : null}
        </div>

        {/* Transcript Display */}
        {transcript && !structuredData && (
          <div className={glassClasses(glassmorphism.backdrop.light, glassmorphism.border.light, 'p-4 rounded-2xl')}>
            <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Status
            </h4>
            <p className="text-sm text-slate-600">{transcript}</p>
          </div>
        )}

        {/* Structured Data Preview */}
        {structuredData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Transcript */}
            {(structuredData as any).rawTranscript && (
              <div className={glassClasses(glassmorphism.backdrop.light, 'p-3 rounded-xl border border-slate-200')}>
                <h5 className="text-xs font-semibold text-slate-700 mb-2">📝 Transcript</h5>
                <p className="text-sm text-slate-600 italic">"{(structuredData as any).rawTranscript}"</p>
              </div>
            )}

            {/* Confidence Meter */}
            {confidence > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600">AI Confidence</span>
                  <span className="font-semibold text-slate-800">{Math.round(confidence * 100)}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${
                      confidence > 0.8
                        ? 'bg-gradient-to-r from-emerald-500 to-green-600'
                        : confidence > 0.5
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-600'
                        : 'bg-gradient-to-r from-red-500 to-rose-600'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${confidence * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}

            {/* Vitals Preview */}
            {structuredData.vitals && Object.values(structuredData.vitals).some(v => v) && (
              <div className={glassClasses(glassmorphism.backdrop.tintedGreen, 'p-3 rounded-xl border border-emerald-200')}>
                <h5 className="text-xs font-semibold text-emerald-800 mb-2">📊 Vital Signs Extracted</h5>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {structuredData.vitals.temperature && (
                    <div><span className="text-slate-600">Temp:</span> <span className="font-medium">{structuredData.vitals.temperature}°C</span></div>
                  )}
                  {structuredData.vitals.hr && (
                    <div><span className="text-slate-600">HR:</span> <span className="font-medium">{structuredData.vitals.hr} bpm</span></div>
                  )}
                  {structuredData.vitals.rr && (
                    <div><span className="text-slate-600">RR:</span> <span className="font-medium">{structuredData.vitals.rr}/min</span></div>
                  )}
                  {structuredData.vitals.bp && (
                    <div><span className="text-slate-600">BP:</span> <span className="font-medium">{structuredData.vitals.bp}</span></div>
                  )}
                  {structuredData.vitals.spo2 && (
                    <div><span className="text-slate-600">SpO₂:</span> <span className="font-medium">{structuredData.vitals.spo2}%</span></div>
                  )}
                  {structuredData.vitals.crt && (
                    <div><span className="text-slate-600">CRT:</span> <span className="font-medium">{structuredData.vitals.crt}s</span></div>
                  )}
                </div>
              </div>
            )}

            {/* Examination Preview */}
            {structuredData.examination && Object.values(structuredData.examination).some(v => v) && (
              <div className={glassClasses(glassmorphism.backdrop.tinted, 'p-3 rounded-xl border border-sky-200')}>
                <h5 className="text-xs font-semibold text-sky-800 mb-2">🩺 Examination Findings</h5>
                <div className="space-y-1 text-xs">
                  {structuredData.examination.cns && (
                    <div><span className="text-slate-600 font-medium">CNS:</span> <span className="text-slate-700">{structuredData.examination.cns}</span></div>
                  )}
                  {structuredData.examination.cvs && (
                    <div><span className="text-slate-600 font-medium">CVS:</span> <span className="text-slate-700">{structuredData.examination.cvs}</span></div>
                  )}
                  {structuredData.examination.chest && (
                    <div><span className="text-slate-600 font-medium">Chest:</span> <span className="text-slate-700">{structuredData.examination.chest}</span></div>
                  )}
                  {structuredData.examination.perAbdomen && (
                    <div><span className="text-slate-600 font-medium">Abdomen:</span> <span className="text-slate-700">{structuredData.examination.perAbdomen}</span></div>
                  )}
                </div>
              </div>
            )}

            {/* Medications Preview */}
            {structuredData.medications && structuredData.medications.length > 0 && (
              <div className={glassClasses(glassmorphism.backdrop.tintedPurple, 'p-3 rounded-xl border border-purple-200')}>
                <h5 className="text-xs font-semibold text-purple-800 mb-2">💊 Medications ({structuredData.medications.length})</h5>
                <div className="space-y-1 text-xs">
                  {structuredData.medications.map((med, i) => (
                    <div key={i} className="text-slate-700">
                      <span className="font-medium">{med.name}</span> {med.dose} {med.route} {med.frequency}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Clinical Note Preview */}
            {structuredData.note && (
              <div className={glassClasses(glassmorphism.backdrop.light, 'p-3 rounded-xl border border-slate-200')}>
                <h5 className="text-xs font-semibold text-slate-700 mb-2">📋 Clinical Summary</h5>
                <p className="text-xs text-slate-700 leading-relaxed">{structuredData.note}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-700 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-white/20">
          <PremiumButton variant="secondary" fullWidth onClick={handleClose}>
            Cancel
          </PremiumButton>
          <PremiumButton
            variant="success"
            fullWidth
            onClick={handleInsert}
            disabled={!structuredData || confidence < 0.3}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            }
          >
            Insert into Note
          </PremiumButton>
        </div>

        {/* Tips */}
        {!isRecording && !isProcessing && !structuredData && (
          <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3 space-y-1">
            <p className="font-semibold text-slate-700">💡 Tips for best results:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-1">
              <li>Speak clearly at a moderate pace</li>
              <li>State vitals with units: "temperature 37.2 celsius, heart rate 145"</li>
              <li>Describe examination by system: "CNS - alert, active, good tone"</li>
              <li>For medications: "Ampicillin 50 mg per kg IV twice daily"</li>
              <li>Record for at least 5-10 seconds for best accuracy</li>
            </ul>
          </div>
        )}
      </div>
    </GlassModal>
  );
};

export default VoiceScribePanel;
