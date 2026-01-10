import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Patient } from '../types';
import { generateMortalityPDF, exportMortalityCSV, exportMortalityJSON } from '../services/mortalityPdfService';

interface CustomizableExportModalProps {
  patients: Patient[];
  institutionName: string;
  totalAdmissions?: number;
  timeRange: string;
  unit: string;
  birthType?: string;
  startDate?: string;
  endDate?: string;
  analysisType?: string;
  analysisData?: any;
  onClose: () => void;
  aiAnalysis?: string;
}

const CustomizableExportModal: React.FC<CustomizableExportModalProps> = ({
  patients,
  institutionName,
  totalAdmissions,
  timeRange,
  unit,
  birthType,
  startDate,
  endDate,
  analysisType,
  analysisData,
  onClose,
  aiAnalysis
}) => {
  const [exportOptions, setExportOptions] = useState({
    includeSummary: true,
    includeCharts: true,
    includePatientList: true,
    includeCausesBreakdown: true,
    includeAIAnalysis: !!aiAnalysis,
  });

  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'json'>('pdf');
  const [isExporting, setIsExporting] = useState(false);

  const toggleOption = (key: keyof typeof exportOptions) => {
    setExportOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (exportFormat === 'pdf') {
        const pdf = await generateMortalityPDF({
          patients,
          institutionName,
          totalAdmissions,
          timeRange,
          unit,
          birthType,
          analysisType,
          analysisData,
          ...exportOptions,
          aiAnalysis: exportOptions.includeAIAnalysis ? aiAnalysis : undefined
        });
        pdf.save(`Mortality_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      } else if (exportFormat === 'csv') {
        exportMortalityCSV(patients, `Mortality_Data_${new Date().toISOString().split('T')[0]}.csv`);
      } else if (exportFormat === 'json') {
        exportMortalityJSON(patients, `Mortality_Data_${new Date().toISOString().split('T')[0]}.json`);
      }

      // Close modal after successful export
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('Error generating export:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Customize Export
              </h2>
              <p className="text-sky-100 text-sm mt-1">Select data to include in your export</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Export Format */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Format
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { format: 'pdf', label: 'PDF', icon: '📄' },
                  { format: 'csv', label: 'CSV', icon: '📊' },
                  { format: 'json', label: 'JSON', icon: '{ }' }
                ].map(({ format, label, icon }) => (
                  <button
                    key={format}
                    onClick={() => setExportFormat(format as any)}
                    className={`p-4 rounded-xl font-semibold transition-all border-2 flex flex-col items-center gap-2 ${
                      exportFormat === format
                        ? 'bg-sky-500 text-white border-sky-600 shadow-lg scale-105'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300 hover:scale-105'
                    }`}
                  >
                    <span className="text-2xl">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* PDF Options (only visible when PDF is selected) */}
            {exportFormat === 'pdf' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Include in Report
                </h3>
                <div className="space-y-3">
                  {[
                    { key: 'includeSummary', label: 'Summary Statistics', desc: 'Key metrics and totals' },
                    { key: 'includeCharts', label: 'Charts & Graphs', desc: 'Visual data representations' },
                    { key: 'includePatientList', label: 'Detailed Patient List', desc: 'Individual patient records' },
                    { key: 'includeCausesBreakdown', label: 'Causes Breakdown', desc: 'Top causes of death analysis' },
                    { key: 'includeAIAnalysis', label: 'AI Analysis', desc: 'AI-powered insights', disabled: !aiAnalysis },
                  ].map(({ key, label, desc, disabled }) => (
                    <div
                      key={key}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                        exportOptions[key as keyof typeof exportOptions]
                          ? 'bg-sky-50 border-sky-300'
                          : 'bg-slate-50 border-slate-200'
                      } ${disabled ? 'opacity-50' : 'cursor-pointer hover:border-sky-300'}`}
                      onClick={() => !disabled && toggleOption(key as keyof typeof exportOptions)}
                    >
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                        exportOptions[key as keyof typeof exportOptions]
                          ? 'bg-sky-500 border-sky-600'
                          : 'bg-white border-slate-300'
                      }`}>
                        {exportOptions[key as keyof typeof exportOptions] && (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{label}</div>
                        <div className="text-sm text-slate-500">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Export Summary */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border-2 border-slate-200">
              <h4 className="font-bold text-slate-900 mb-2">Export Summary</h4>
              <div className="space-y-1 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Format:</span>
                  <span className="font-semibold">{exportFormat.toUpperCase()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Patients:</span>
                  <span className="font-semibold">{patients.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Time Range:</span>
                  <span className="font-semibold">{timeRange}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Unit:</span>
                  <span className="font-semibold">{unit}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-6 py-3 bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-600 hover:to-purple-700 text-white rounded-lg font-bold flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg"
          >
            {isExporting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export {exportFormat.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CustomizableExportModal;
