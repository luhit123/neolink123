import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Patient } from '../../../types';
import AnalyticsCard from '../AnalyticsCard';
import { analyzeDeathDiagnosisPatterns } from '../../../services/openaiService';
import { haptics } from '../../../utils/haptics';

interface AIInsightsCardProps {
  deceasedPatients: Patient[];
  institutionName: string;
}

const AIInsightsCard: React.FC<AIInsightsCardProps> = ({
  deceasedPatients,
  institutionName
}) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleGenerateAnalysis = async () => {
    if (deceasedPatients.length === 0) {
      setError('No deceased patient data available for analysis.');
      return;
    }

    haptics.tap();
    setIsLoading(true);
    setError('');

    try {
      const result = await analyzeDeathDiagnosisPatterns(deceasedPatients);
      setAnalysis(result);
      haptics.success();
    } catch (err) {
      console.error('Error generating AI analysis:', err);
      setError('Failed to generate analysis. Please try again.');
      haptics.error();
    } finally {
      setIsLoading(false);
    }
  };

  const formatMarkdown = (text: string) => {
    return text
      .replace(/## (.*?)$/gm, '<h3 class="text-base font-bold text-slate-800 mt-4 mb-2">$1</h3>')
      .replace(/### (.*?)$/gm, '<h4 class="text-sm font-semibold text-slate-700 mt-3 mb-1">$1</h4>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-800">$1</strong>')
      .replace(/- (.*?)$/gm, '<li class="ml-3 text-slate-600 text-sm leading-relaxed">• $1</li>')
      .replace(/\n\n/g, '</p><p class="mt-2">')
      .replace(/\n/g, '<br/>');
  };

  const clearAnalysis = () => {
    haptics.tap();
    setAnalysis('');
    setError('');
  };

  return (
    <AnalyticsCard
      title="AI Insights"
      subtitle="Powered by Gemini AI"
      headerGradient="from-sky-500 to-cyan-600"
      icon={
        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      }
    >
      <AnimatePresence mode="wait">
        {/* Initial State - No Analysis */}
        {!analysis && !isLoading && !error && (
          <motion.div
            key="initial"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-full py-8"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-sky-100 to-cyan-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">AI-Powered Analysis</h3>
            <p className="text-sm text-slate-500 text-center mb-6 px-4">
              Get comprehensive mortality pattern insights, trends, and quality improvement recommendations.
            </p>
            <button
              onClick={handleGenerateAnalysis}
              className="px-6 py-3 bg-gradient-to-r from-sky-500 to-cyan-600 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Analysis
            </button>

            {/* Quick Info */}
            <div className="mt-8 grid grid-cols-2 gap-3 w-full">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-slate-700">{deceasedPatients.length}</div>
                <div className="text-xs text-slate-500">Cases to Analyze</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-slate-700">
                  {deceasedPatients.filter(p => p.aiInterpretedDeathDiagnosis).length}
                </div>
                <div className="text-xs text-slate-500">AI Interpreted</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-full py-8"
          >
            <div className="relative">
              <div className="w-16 h-16 border-4 border-sky-200 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full absolute top-0 left-0 animate-spin"></div>
            </div>
            <p className="mt-4 text-slate-600 font-medium">Analyzing mortality patterns...</p>
            <p className="text-sm text-slate-400 mt-1">This may take a moment</p>

            {/* Progress hints */}
            <div className="mt-6 space-y-2">
              {['Reviewing patient data...', 'Identifying patterns...', 'Generating insights...'].map((step, idx) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 1.5 }}
                  className="flex items-center gap-2 text-xs text-slate-500"
                >
                  <div className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse" />
                  {step}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-full py-8"
          >
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Analysis Failed</h3>
            <p className="text-sm text-slate-500 text-center mb-4 px-4">{error}</p>
            <button
              onClick={handleGenerateAnalysis}
              className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 active:scale-95 transition-all"
            >
              Try Again
            </button>
          </motion.div>
        )}

        {/* Analysis Results */}
        {analysis && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col"
          >
            {/* Analysis Content */}
            <div className="flex-1 overflow-y-auto">
              <div
                className="prose prose-sm prose-slate max-w-none"
                dangerouslySetInnerHTML={{ __html: formatMarkdown(analysis) }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
              <button
                onClick={clearAnalysis}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 active:scale-95 transition-all text-sm"
              >
                Clear
              </button>
              <button
                onClick={handleGenerateAnalysis}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-cyan-600 text-white rounded-xl font-semibold hover:shadow-lg active:scale-95 transition-all text-sm flex items-center justify-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerate
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnalyticsCard>
  );
};

export default AIInsightsCard;
