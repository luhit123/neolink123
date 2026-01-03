import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import {
  generatePatientSummary,
  getClinicalInsights,
  predictRisk,
  recommendTreatmentProtocol,
  checkDrugInteractions,
  findSimilarPatients,
  detectClinicalDeterioration,
  predictLengthOfStay,
  assessStepDownReadiness,
  generateHandoffNote,
  generateDischargeInstructions,
  explainDiagnosis,
  suggestClinicalGuidelines,
  answerClinicalQuestion
} from '../services/geminiService';
import { SparklesIcon, XIcon, ChatBubbleLeftRightIcon, ClipboardDocumentCheckIcon, ShieldExclamationIcon } from './common/Icons';

interface AIClinicalAssistantProps {
  patient: Patient;
  onClose: () => void;
  allPatients?: Patient[];
}

type TabType =
  | 'summary'
  | 'insights'
  | 'risk'
  | 'treatment'
  | 'medication'
  | 'similar'
  | 'predictive'
  | 'documentation'
  | 'knowledge';

const AIClinicalAssistant: React.FC<AIClinicalAssistantProps> = ({ patient, onClose, allPatients = [] }) => {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [riskData, setRiskData] = useState<{ riskLevel: string; justification: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [clinicalQuestion, setClinicalQuestion] = useState('');

  const tabs = [
    { id: 'summary' as TabType, label: 'Smart Summary', icon: '📋', color: 'cyan' },
    { id: 'insights' as TabType, label: 'Clinical Insights', icon: '💡', color: 'purple' },
    { id: 'risk' as TabType, label: 'Risk Assessment', icon: '⚠️', color: 'red' },
    { id: 'treatment' as TabType, label: 'Treatment Plan', icon: '💊', color: 'green' },
    { id: 'medication' as TabType, label: 'Medication Guide', icon: '💉', color: 'blue' },
    { id: 'similar' as TabType, label: 'Similar Cases', icon: '🔍', color: 'orange' },
    { id: 'predictive' as TabType, label: 'Predictive Analytics', icon: '📊', color: 'indigo' },
    { id: 'documentation' as TabType, label: 'Documentation', icon: '📝', color: 'pink' },
    { id: 'knowledge' as TabType, label: 'Knowledge Base', icon: '🎓', color: 'yellow' },
  ];

  const getTabColor = (color: string, active: boolean) => {
    const colors: Record<string, { active: string; hover: string }> = {
      cyan: { active: 'bg-medical-teal text-white', hover: 'hover:bg-medical-teal-light' },
      purple: { active: 'bg-blue-600 text-white', hover: 'hover:bg-blue-700' },
      red: { active: 'bg-medical-red text-white', hover: 'hover:bg-red-700' },
      green: { active: 'bg-medical-green text-white', hover: 'hover:bg-emerald-700' },
      blue: { active: 'bg-medical-blue text-white', hover: 'hover:bg-medical-blue-light' },
      orange: { active: 'bg-medical-orange text-white', hover: 'hover:bg-orange-700' },
      indigo: { active: 'bg-medical-blue text-white', hover: 'hover:bg-medical-blue-light' },
      pink: { active: 'bg-medical-teal-light text-white', hover: 'hover:bg-medical-teal' },
      yellow: { active: 'bg-yellow-600 text-white', hover: 'hover:bg-yellow-700' },
    };
    return active ? colors[color].active : `text-slate-600 ${colors[color].hover} hover:text-white`;
  };

  const handleGenerate = async (type: TabType) => {
    setLoading(true);
    setActiveTab(type);
    setContent(null);
    setRiskData(null);

    try {
      switch (type) {
        case 'summary':
          const summary = await generatePatientSummary(patient);
          setContent(summary);
          break;

        case 'insights':
          const insights = await getClinicalInsights(patient);
          setContent(insights);
          break;

        case 'risk':
          const risk = await predictRisk(patient);
          setRiskData(risk);
          break;

        case 'treatment':
          const treatment = await recommendTreatmentProtocol(
            patient.diagnosis,
            patient.age,
            patient.ageUnit
          );
          setContent(treatment);
          break;

        case 'medication':
          const medications = ['Common medications for ' + patient.diagnosis];
          const conditions = [patient.diagnosis];
          const drugInfo = await checkDrugInteractions(medications, conditions);
          setContent(drugInfo);
          break;

        case 'similar':
          const similar = await findSimilarPatients(patient, allPatients);
          setContent(similar);
          break;

        case 'predictive':
          const deterioration = await detectClinicalDeterioration(patient);
          const los = await predictLengthOfStay(patient);
          const stepDown = await assessStepDownReadiness(patient);
          setContent(`**Clinical Deterioration Assessment:**\n${deterioration}\n\n**Length of Stay Prediction:**\n${los}\n\n**Step-Down Readiness:**\n${stepDown}`);
          break;

        case 'documentation':
          const handoff = await generateHandoffNote(patient, 'day');
          const discharge = await generateDischargeInstructions(patient);
          setContent(`**Shift Handoff Note:**\n${handoff}\n\n**Discharge Instructions:**\n${discharge}`);
          break;

        case 'knowledge':
          const explanation = await explainDiagnosis(patient.diagnosis, 'doctor');
          const guidelines = await suggestClinicalGuidelines(patient.diagnosis);
          setContent(`**Diagnosis Explanation:**\n${explanation}\n\n**Clinical Guidelines:**\n${guidelines}`);
          break;

        default:
          setContent("Feature not implemented yet.");
      }
    } catch (error) {
      setContent("Failed to generate content. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!clinicalQuestion.trim()) return;
    setLoading(true);
    try {
      const answer = await answerClinicalQuestion(clinicalQuestion, patient);
      setContent(answer);
      setClinicalQuestion('');
    } catch (error) {
      setContent("Failed to answer question. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  // Auto-load summary on first open
  useEffect(() => {
    handleGenerate('summary');
  }, []);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-2 sm:p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl border border-sky-500/30 overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-900/50 to-blue-900/50 p-3 sm:p-4 border-b border-sky-500/20 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-medical-teal/20 rounded-lg">
              <SparklesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-medical-teal" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">AI Clinical Assistant</h2>
              <p className="text-xs text-teal-200 hidden sm:block">Powered by Gemini 2.5 Flash</p>
              <p className="text-xs text-teal-200 sm:hidden">Patient: {patient.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-slate-400 hover:text-white transition-colors p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
              <XIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - Collapsible on mobile */}
          <div
            className={`${
              sidebarOpen ? 'w-full' : 'w-0'
            } lg:w-1/4 bg-slate-800/50 border-r border-slate-700 p-2 space-y-1.5 overflow-y-auto transition-all duration-300 ${
              sidebarOpen ? 'absolute lg:relative z-10 h-full' : 'hidden lg:block'
            }`}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  handleGenerate(tab.id);
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={`w-full text-left p-2.5 sm:p-3 rounded-lg flex items-center gap-2 transition-all text-sm font-medium min-h-[44px] ${
                  activeTab === tab.id ? getTabColor(tab.color, true) : getTabColor(tab.color, false)
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Display Area */}
          <div className="flex-1 p-3 sm:p-6 overflow-y-auto bg-slate-900/50 relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-sky-500 mb-3"></div>
                  <p className="text-medical-teal animate-pulse text-xs sm:text-sm">Analyzing patient data...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Knowledge Base - Special UI for asking questions */}
                {activeTab === 'knowledge' && (
                  <div className="mb-4 p-3 sm:p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <h3 className="text-medical-teal font-semibold mb-3 text-sm sm:text-base">Ask a Clinical Question</h3>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={clinicalQuestion}
                        onChange={(e) => setClinicalQuestion(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                        placeholder="e.g., What are the latest guidelines for managing RDS?"
                        className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500 min-h-[44px]"
                      />
                      <button
                        onClick={handleAskQuestion}
                        disabled={!clinicalQuestion.trim()}
                        className="px-4 py-2 bg-medical-teal hover:bg-medical-teal-light disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm min-h-[44px] whitespace-nowrap"
                      >
                        Ask AI
                      </button>
                    </div>
                  </div>
                )}

                {/* Risk Assessment - Special UI */}
                {activeTab === 'risk' && riskData ? (
                  <div className="space-y-4 sm:space-y-6">
                    <div
                      className={`p-4 sm:p-6 rounded-xl border-2 text-center ${
                        riskData.riskLevel === 'High'
                          ? 'border-red-500 bg-red-500/10'
                          : riskData.riskLevel === 'Medium'
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-green-500 bg-green-500/10'
                      }`}
                    >
                      <h3 className="text-sm sm:text-lg font-semibold text-slate-300 uppercase tracking-widest mb-2">
                        Estimated Risk Level
                      </h3>
                      <div
                        className={`text-4xl sm:text-5xl font-black ${
                          riskData.riskLevel === 'High'
                            ? 'text-red-500'
                            : riskData.riskLevel === 'Medium'
                            ? 'text-orange-500'
                            : 'text-green-500'
                        }`}
                      >
                        {riskData.riskLevel.toUpperCase()}
                      </div>
                    </div>
                    <div className="bg-slate-800 p-3 sm:p-4 rounded-lg border border-slate-700">
                      <h4 className="text-medical-teal font-semibold mb-2 text-sm sm:text-base">AI Justification</h4>
                      <p className="text-slate-300 leading-relaxed text-sm sm:text-base">{riskData.justification}</p>
                    </div>
                    <p className="text-xs text-slate-500 italic text-center">
                      Disclaimer: This is an AI-generated assessment. Always rely on professional clinical judgment.
                    </p>
                  </div>
                ) : (
                  /* Regular Content Display */
                  content && (
                    <div>
                      <div className="prose prose-invert max-w-none prose-sm sm:prose-base">
                        <div className="whitespace-pre-line text-slate-300 leading-relaxed text-sm sm:text-base">
                          {content}
                        </div>
                      </div>
                      {/* Copy Button */}
                      <div className="mt-4 flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => copyToClipboard(content)}
                          className="w-full sm:w-auto px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm min-h-[44px]"
                        >
                          📋 Copy to Clipboard
                        </button>
                        <button
                          onClick={() => window.print()}
                          className="w-full sm:w-auto px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm min-h-[44px]"
                        >
                          🖨️ Print
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Patient Info Footer - Mobile */}
        <div className="bg-slate-800/50 border-t border-slate-700 p-2 sm:hidden flex-shrink-0">
          <div className="text-xs text-slate-400 text-center">
            {patient.name} • {patient.age} {patient.ageUnit} • {patient.diagnosis}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIClinicalAssistant;
