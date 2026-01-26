import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeIndividualMortality } from '../services/openaiService';
import { generateIndividualMortalityPDF } from '../services/mortalityPdfService';

interface IndividualMortalityViewerProps {
  patient: Patient;
  institutionName: string;
  onClose: () => void;
}

const IndividualMortalityViewer: React.FC<IndividualMortalityViewerProps> = ({
  patient,
  institutionName,
  onClose
}) => {
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [showFullDiagnosis, setShowFullDiagnosis] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const daysInUnit = patient.dateOfDeath && patient.admissionDate
    ? Math.ceil((new Date(patient.dateOfDeath).getTime() - new Date(patient.admissionDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const handleGenerateAnalysis = async () => {
    setIsLoadingAnalysis(true);
    try {
      const analysis = await analyzeIndividualMortality(patient);
      setAiAnalysis(analysis);
    } catch (error) {
      console.error('Error generating analysis:', error);
      setAiAnalysis('Failed to generate analysis. Please try again.');
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const pdf = await generateIndividualMortalityPDF(patient, institutionName, aiAnalysis);
      pdf.save(`Mortality_Analysis_${patient.name.replace(/\s/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const formatMarkdown = (text: string) => {
    return text
      .replace(/## (.*?)$/gm, '<h3 class="text-lg font-bold text-slate-900 mt-6 mb-3 flex items-center gap-2"><span class="text-2xl">$1</span></h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
      .replace(/- (.*?)$/gm, '<li class="ml-4 text-slate-700 mb-2">$1</li>')
      .replace(/\n\n/g, '<br/><br/>');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Death Summary</h2>
              <p className="text-red-100 text-xs mt-0.5">{institutionName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Compact Patient Info */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border-2 border-slate-200 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-500 font-medium">Name</div>
                <div className="font-bold text-slate-900">{patient.name}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">Age</div>
                <div className="font-bold text-slate-900">{patient.age} {patient.ageUnit}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">Gender</div>
                <div className="font-bold text-slate-900">{patient.gender}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">Unit</div>
                <div className="font-bold text-slate-900">{patient.unit}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">Admission</div>
                <div className="font-semibold text-slate-800">
                  {new Date(patient.admissionDate).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 font-medium">Death</div>
                <div className="font-semibold text-red-700">
                  {patient.dateOfDeath ? (
                    <>
                      <div>{new Date(patient.dateOfDeath).toLocaleDateString()}</div>
                      <div className="text-xs text-red-600">{new Date(patient.dateOfDeath).toLocaleTimeString()}</div>
                    </>
                  ) : 'Not recorded'}
                </div>
              </div>
              {daysInUnit !== null && (
                <div>
                  <div className="text-xs text-slate-500 font-medium">Days in Unit</div>
                  <div className="font-semibold text-slate-800">{daysInUnit} days</div>
                </div>
              )}
              {patient.birthType && (
                <div>
                  <div className="text-xs text-slate-500 font-medium">Birth Type</div>
                  <div className="font-semibold text-slate-800">{patient.birthType}</div>
                </div>
              )}
            </div>
          </div>

          {/* Diagnosis Section */}
          <div className="space-y-4">
            {/* AI Interpreted Diagnosis */}
            {patient.aiInterpretedDeathDiagnosis && (
              <div className="bg-sky-50 border-l-4 border-sky-500 p-4 rounded-r-lg">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-sky-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sky-900 mb-2">AI-Interpreted Diagnosis</h4>
                    <p className="text-slate-700 leading-relaxed">{patient.aiInterpretedDeathDiagnosis}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Full Diagnosis */}
            {patient.diagnosisAtDeath && (
              <div className="bg-white border-2 border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Complete Diagnosis at Time of Death
                  </h4>
                  <button
                    onClick={() => setShowFullDiagnosis(!showFullDiagnosis)}
                    className="text-sm text-sky-600 hover:text-sky-700 font-medium"
                  >
                    {showFullDiagnosis ? 'Show Less' : 'Show More'}
                  </button>
                </div>
                <div className={`text-slate-700 leading-relaxed ${showFullDiagnosis ? '' : 'line-clamp-3'}`}>
                  {patient.diagnosisAtDeath}
                </div>
              </div>
            )}
          </div>

          {/* AI Analysis Section */}
          <div className="mt-6">
            {!aiAnalysis && !isLoadingAnalysis && (
              <button
                onClick={handleGenerateAnalysis}
                className="w-full bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-600 hover:to-purple-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate AI Analysis
              </button>
            )}

            {isLoadingAnalysis && (
              <div className="bg-gradient-to-br from-sky-50 to-purple-50 rounded-xl p-12 text-center border-2 border-sky-200">
                <div className="w-16 h-16 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-700 font-semibold">AI is analyzing this case...</p>
                <p className="text-sm text-slate-500 mt-2">Reviewing clinical timeline, pathophysiology, and preventability</p>
              </div>
            )}

            {aiAnalysis && (
              <div className="bg-white border-2 border-sky-300 rounded-xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI Analysis Summary
                  </h3>
                  <button
                    onClick={() => setAiAnalysis('')}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    Clear
                  </button>
                </div>
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(aiAnalysis) }}
                />
              </div>
            )}
          </div>

          {/* Indication for Admission */}
          {patient.indicationsForAdmission && patient.indicationsForAdmission.length > 0 && (
            <div className="mt-4 bg-sky-50 rounded-xl p-4 border-l-4 border-sky-500">
              <h4 className="font-bold text-sky-900 mb-2 text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Indication(s) for Admission
              </h4>
              <ul className="list-disc list-inside space-y-1">
                {patient.indicationsForAdmission.map((indication, index) => (
                  <li key={index} className="text-sm text-slate-700">{indication}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {isGeneratingPDF ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Summary PDF
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default IndividualMortalityViewer;
