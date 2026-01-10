import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassModal } from '../premium/GlassModal';
import { PremiumButton } from '../premium/PremiumButton';
import { glassmorphism, glassClasses } from '../../theme/glassmorphism';
import { getVoiceScribeService } from '../../services/voiceScribeService';
import { ProgressNote } from '../../types';

export interface VoiceScribePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (data: Partial<ProgressNote>) => void;
  patientAge?: number;
  patientUnit?: string;
}

/**
 * VoiceScribePanel - Beautiful voice recording interface
 *
 * Features:
 * - Animated waveform during recording
 * - Real-time transcript display
 * - AI processing indicator
 * - Confidence meter
 * - Preview of structured data
 * - Manual correction interface
 *
 * @example
 * <VoiceScribePanel
 *   isOpen={showVoicePanel}
 *   onClose={() => setShowVoicePanel(false)}
 *   onInsert={(data) => handleInsertNote(data)}
 *   patientAge={5}
 *   patientUnit="NICU"
 * />
 */
export const VoiceScribePanel: React.FC<VoiceScribePanelProps> = ({
  isOpen,
  onClose,
  onInsert,
  patientAge,
  patientUnit,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [structuredData, setStructuredData] = useState<Partial<ProgressNote> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confidence, setConfidence] = useState<number>(0);
  const [error, setError] = useState<string>('');

  const voiceScribe = getVoiceScribeService();

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (isListening) {
        voiceScribe.stop();
      }
    };
  }, []);

  const handleStartRecording = async () => {
    setError('');
    setTranscript('');
    setStructuredData(null);
    setConfidence(0);
    setIsListening(true);

    try {
      await voiceScribe.startScribe(
        (data) => {
          // Update UI with interim or final results
          if (data.rawTranscript) {
            setTranscript(data.rawTranscript);
          }

          // If structured data is available
          if (data.vitals || data.examination || data.medications) {
            setIsProcessing(false);
            setStructuredData(data);
            setConfidence((data as any).confidence || 0);
          } else if (data.note && !data.vitals) {
            // Interim transcript only
            setIsProcessing(true);
          }
        },
        (errorMsg) => {
          setError(errorMsg);
          setIsListening(false);
          setIsProcessing(false);
        }
      );
    } catch (err) {
      setError((err as Error).message);
      setIsListening(false);
    }
  };

  const handleStopRecording = () => {
    voiceScribe.stop();
    setIsListening(false);
    setIsProcessing(false);
  };

  const handleInsert = () => {
    if (structuredData) {
      onInsert(structuredData);
      handleClose();
    }
  };

  const handleClose = () => {
    if (isListening) {
      voiceScribe.stop();
    }
    setIsListening(false);
    setTranscript('');
    setStructuredData(null);
    setError('');
    onClose();
  };

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Voice Scribe"
      size="lg"
      variant="center"
      closeOnBackdropClick={false}
    >
      <div className="space-y-6">
        {/* Waveform Visualization */}
        <div className="relative h-32 flex items-center justify-center">
          <AnimatePresence>
            {isListening && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1"
              >
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 bg-gradient-to-t from-sky-500 to-blue-600 rounded-full"
                    animate={{
                      height: [20, 60, 30, 80, 40, 60, 20],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.05,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {!isListening && !structuredData && (
            <div className="text-center">
              <svg
                className="w-16 h-16 mx-auto text-slate-300 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              <p className="text-sm text-slate-600">Click to start recording</p>
            </div>
          )}
        </div>

        {/* Recording Controls */}
        <div className="flex justify-center gap-4">
          {!isListening ? (
            <PremiumButton
              variant="primary"
              size="lg"
              onClick={handleStartRecording}
              icon={
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14a2 2 0 100-4 2 2 0 000 4z" />
                  <path
                    fillRule="evenodd"
                    d="M12 2a5 5 0 00-5 5v6a5 5 0 0010 0V7a5 5 0 00-5-5zM8 7a4 4 0 118 0v6a4 4 0 11-8 0V7z"
                    clipRule="evenodd"
                  />
                </svg>
              }
            >
              Start Recording
            </PremiumButton>
          ) : (
            <PremiumButton
              variant="danger"
              size="lg"
              onClick={handleStopRecording}
              icon={
                <motion.svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </motion.svg>
              }
            >
              Stop Recording
            </PremiumButton>
          )}
        </div>

        {/* Status */}
        {isListening && (
          <div className="text-center">
            <motion.p
              className="text-sm font-medium text-sky-600"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              🎤 Listening...
            </motion.p>
          </div>
        )}

        {/* Transcript Display */}
        {transcript && (
          <div className={glassClasses(glassmorphism.backdrop.light, glassmorphism.border.light, 'p-4 rounded-2xl')}>
            <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Transcript
            </h4>
            <p className="text-sm text-slate-800 leading-relaxed">{transcript}</p>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 text-sm text-blue-600"
          >
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            AI is structuring your note...
          </motion.div>
        )}

        {/* Structured Data Preview */}
        {structuredData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Confidence Meter */}
            {confidence > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600">AI Confidence</span>
                  <span className="font-semibold text-slate-800">{Math.round(confidence * 100)}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    className={glassClasses(
                      'h-full',
                      confidence > 0.8
                        ? 'bg-gradient-to-r from-emerald-500 to-green-600'
                        : confidence > 0.5
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-600'
                        : 'bg-gradient-to-r from-red-500 to-rose-600'
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${confidence * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}

            {/* Vitals Preview */}
            {structuredData.vitals && Object.keys(structuredData.vitals).length > 0 && (
              <div className={glassClasses(glassmorphism.backdrop.tintedGreen, 'p-3 rounded-xl border border-emerald-200')}>
                <h5 className="text-xs font-semibold text-emerald-800 mb-2">📊 Vital Signs</h5>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {structuredData.vitals.temperature && (
                    <div>
                      <span className="text-slate-600">Temp:</span>{' '}
                      <span className="font-medium text-slate-800">{structuredData.vitals.temperature}°C</span>
                    </div>
                  )}
                  {structuredData.vitals.hr && (
                    <div>
                      <span className="text-slate-600">HR:</span>{' '}
                      <span className="font-medium text-slate-800">{structuredData.vitals.hr} bpm</span>
                    </div>
                  )}
                  {structuredData.vitals.rr && (
                    <div>
                      <span className="text-slate-600">RR:</span>{' '}
                      <span className="font-medium text-slate-800">{structuredData.vitals.rr}/min</span>
                    </div>
                  )}
                  {structuredData.vitals.bp && (
                    <div>
                      <span className="text-slate-600">BP:</span>{' '}
                      <span className="font-medium text-slate-800">{structuredData.vitals.bp}</span>
                    </div>
                  )}
                  {structuredData.vitals.spo2 && (
                    <div>
                      <span className="text-slate-600">SpO₂:</span>{' '}
                      <span className="font-medium text-slate-800">{structuredData.vitals.spo2}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Medications Preview */}
            {structuredData.medications && structuredData.medications.length > 0 && (
              <div className={glassClasses(glassmorphism.backdrop.tintedPurple, 'p-3 rounded-xl border border-purple-200')}>
                <h5 className="text-xs font-semibold text-purple-800 mb-2">💊 Medications ({structuredData.medications.length})</h5>
                <div className="space-y-1 text-xs">
                  {structuredData.medications.slice(0, 3).map((med, i) => (
                    <div key={i} className="text-slate-700">
                      <span className="font-medium">{med.name}</span> {med.dose} {med.route} {med.frequency}
                    </div>
                  ))}
                  {structuredData.medications.length > 3 && (
                    <div className="text-purple-600 font-medium">+{structuredData.medications.length - 3} more</div>
                  )}
                </div>
              </div>
            )}

            {/* Clinical Note Preview */}
            {structuredData.note && (
              <div className={glassClasses(glassmorphism.backdrop.tinted, 'p-3 rounded-xl border border-sky-200')}>
                <h5 className="text-xs font-semibold text-sky-800 mb-2">📝 Clinical Note</h5>
                <p className="text-xs text-slate-700 leading-relaxed line-clamp-3">{structuredData.note}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-700">❌ {error}</p>
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
        {!isListening && !structuredData && (
          <div className="text-xs text-slate-500 space-y-1">
            <p className="font-semibold">💡 Tips for best results:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Speak clearly and at a moderate pace</li>
              <li>Mention vital signs with units (e.g., "heart rate 145 beats per minute")</li>
              <li>Use standard medical terminology</li>
              <li>State medication doses clearly (e.g., "Ampicillin 50 milligrams per kilogram")</li>
            </ul>
          </div>
        )}
      </div>
    </GlassModal>
  );
};

export default VoiceScribePanel;
