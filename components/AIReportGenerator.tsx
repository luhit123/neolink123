import React, { useState } from 'react';
import { Patient } from '../types';
import { generateMonthlyReport, generateMortalityReview } from '../services/geminiService';

interface AIReportGeneratorProps {
  patients: Patient[];
  unit: string;
  institutionName: string;
  onClose: () => void;
}

const AIReportGenerator: React.FC<AIReportGeneratorProps> = ({
  patients,
  unit,
  institutionName,
  onClose,
}) => {
  const [reportType, setReportType] = useState<'monthly' | 'mortality'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [generatedReport, setGeneratedReport] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    setGeneratedReport('');

    try {
      if (reportType === 'monthly') {
        // Filter patients by selected month
        const [year, month] = selectedMonth.split('-').map(Number);
        const monthPatients = patients.filter(p => {
          const admissionDate = new Date(p.admissionDate);
          return admissionDate.getFullYear() === year && admissionDate.getMonth() === month - 1;
        });

        const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
        const report = await generateMonthlyReport(monthPatients, monthName, unit, institutionName);
        setGeneratedReport(report);
      } else {
        // Mortality report
        const deceasedPatients = patients.filter(p => p.outcome === 'Deceased');
        if (deceasedPatients.length === 0) {
          setGeneratedReport('No deceased patients found in the dataset.');
        } else {
          const report = await generateMortalityReview(deceasedPatients);
          setGeneratedReport(report);
        }
      }
    } catch (error) {
      setGeneratedReport('Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedReport);
    alert('Report copied to clipboard!');
  };

  const printReport = () => {
    window.print();
  };

  const exportAsText = () => {
    const blob = new Blob([generatedReport], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}-report-${selectedMonth}-${unit}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return date.toISOString().slice(0, 7);
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl border border-sky-500/30 my-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-900/50 to-blue-900/50 p-3 sm:p-4 border-b border-sky-500/20 flex justify-between items-center">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">📊</span>
              AI Report Generator
            </h2>
            <p className="text-xs sm:text-sm text-sky-300 mt-1">
              {institutionName} • {unit}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Configuration */}
        <div className="p-4 sm:p-6 border-b border-slate-700">
          <div className="space-y-4">
            {/* Report Type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Report Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setReportType('monthly')}
                  className={`p-4 rounded-lg border-2 transition-all text-left min-h-[80px] ${
                    reportType === 'monthly'
                      ? 'border-sky-500 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📅</span>
                    <div>
                      <div className="font-bold text-white text-sm sm:text-base">Monthly Report</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Comprehensive monthly statistics and analysis
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setReportType('mortality')}
                  className={`p-4 rounded-lg border-2 transition-all text-left min-h-[80px] ${
                    reportType === 'mortality'
                      ? 'border-red-500 bg-red-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📋</span>
                    <div>
                      <div className="font-bold text-white text-sm sm:text-base">M&M Review</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Morbidity & Mortality analysis
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Month Selection (for monthly reports) */}
            {reportType === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Select Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500 text-sm min-h-[48px]"
                >
                  {monthOptions.map(month => {
                    const date = new Date(month + '-01');
                    const label = date.toLocaleString('default', { month: 'long', year: 'numeric' });
                    return (
                      <option key={month} value={month}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={generateReport}
              disabled={loading}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors text-sm sm:text-base min-h-[48px] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Generating Report...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Generate {reportType === 'monthly' ? 'Monthly' : 'M&M'} Report</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Generated Report */}
        {generatedReport && (
          <div className="p-4 sm:p-6">
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <button
                onClick={copyToClipboard}
                className="flex-1 sm:flex-none px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm min-h-[44px] flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
              <button
                onClick={printReport}
                className="flex-1 sm:flex-none px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm min-h-[44px] flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
              <button
                onClick={exportAsText}
                className="flex-1 sm:flex-none px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm min-h-[44px] flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>
            </div>

            {/* Report Content */}
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4 sm:p-6 max-h-[500px] overflow-y-auto">
              <div className="prose prose-invert prose-sm sm:prose-base max-w-none">
                <div className="whitespace-pre-line text-slate-300 text-sm sm:text-base leading-relaxed">
                  {generatedReport}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-700 p-3 bg-slate-800/50">
          <p className="text-xs text-slate-400 italic text-center">
            ⚠️ AI-generated reports should be reviewed and verified before official use or distribution.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIReportGenerator;
