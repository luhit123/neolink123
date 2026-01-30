import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Loader2,
  CheckCircle,
  AlertCircle,
  Database
} from 'lucide-react';
import { UserRole } from '../types';
import { isSupabaseConfigured } from '../services/supabaseConfig';
import {
  exportPatientsToCSV,
  getPatientHierarchy,
  getDeathRecords
} from '../services/supabaseService';

interface DataExportPageProps {
  institutionId: string;
  institutionName: string;
  onBack: () => void;
  userRole?: UserRole;
}

type ExportType = 'patients' | 'deaths' | 'hierarchy';

interface ExportOption {
  id: ExportType;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const exportOptions: ExportOption[] = [
  {
    id: 'patients',
    title: 'Patient Records',
    description: 'Export all patient data including demographics, diagnosis, and outcomes',
    icon: FileSpreadsheet,
    color: 'blue'
  },
  {
    id: 'deaths',
    title: 'Death Records',
    description: 'Export mortality data with diagnoses and AI interpretations',
    icon: FileText,
    color: 'red'
  },
  {
    id: 'hierarchy',
    title: 'Patient Hierarchy',
    description: 'Export patient data with note counts in hierarchical format',
    icon: Database,
    color: 'purple'
  }
];

const DataExportPage: React.FC<DataExportPageProps> = ({
  institutionId,
  institutionName,
  onBack,
  userRole
}) => {
  const [selectedExport, setSelectedExport] = useState<ExportType | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [exportAll, setExportAll] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);

  const isConfigured = isSupabaseConfigured();

  const downloadCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) {
      setExportResult({ success: false, message: 'No data to export' });
      return;
    }

    // Get all unique keys from data
    const headers = Array.from(
      new Set(data.flatMap(obj => Object.keys(obj)))
    ).filter(key => key !== 'institutions' && key !== 'units' && key !== 'patients');

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return JSON.stringify(value).replace(/,/g, ';');
          const stringValue = String(value);
          // Escape quotes and wrap in quotes if contains comma or newline
          if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ].join('\n');

    // Create and download blob
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${selectedMonth || 'all'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportResult({
      success: true,
      message: `Successfully exported ${data.length} records`,
      count: data.length
    });
  };

  const handleExport = async () => {
    if (!selectedExport || !isConfigured) return;

    setIsExporting(true);
    setExportResult(null);

    try {
      const yearMonth = exportAll ? undefined : selectedMonth;

      switch (selectedExport) {
        case 'patients': {
          const data = await exportPatientsToCSV(institutionId, yearMonth);
          downloadCSV(data, 'patients');
          break;
        }
        case 'deaths': {
          const startDate = exportAll ? undefined : `${selectedMonth}-01`;
          const endDate = exportAll ? undefined : (() => {
            const [year, month] = selectedMonth.split('-').map(Number);
            const lastDay = new Date(year, month, 0).getDate();
            return `${selectedMonth}-${lastDay}`;
          })();
          const data = await getDeathRecords(institutionId, startDate, endDate);
          downloadCSV(data as Record<string, unknown>[], 'death_records');
          break;
        }
        case 'hierarchy': {
          const data = await getPatientHierarchy(institutionId, yearMonth);
          downloadCSV(data as Record<string, unknown>[], 'patient_hierarchy');
          break;
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      setExportResult({
        success: false,
        message: error instanceof Error ? error.message : 'Export failed'
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-100">
        <header className="flex-shrink-0 bg-gradient-to-r from-emerald-600 to-emerald-800 text-white shadow-lg">
          <div className="px-4 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold">Data Export</h1>
                <p className="text-xs text-emerald-200">{institutionName}</p>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Supabase Not Configured</h2>
            <p className="text-slate-600 text-sm mb-4">
              To use data export features, please configure Supabase in your environment variables.
            </p>
            <div className="bg-slate-100 rounded-lg p-4 text-left text-sm font-mono">
              <p className="text-slate-600">VITE_SUPABASE_URL=your-url</p>
              <p className="text-slate-600">VITE_SUPABASE_ANON_KEY=your-key</p>
            </div>
            <button
              onClick={onBack}
              className="mt-6 px-6 py-3 bg-slate-800 text-white rounded-xl font-semibold"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100">
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-emerald-600 to-emerald-800 text-white shadow-lg">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold">Data Export</h1>
              <p className="text-xs text-emerald-200">{institutionName}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
          {/* Export Type Selection */}
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Select Data to Export</h2>
            <div className="space-y-3">
              {exportOptions.map(option => {
                const Icon = option.icon;
                const isSelected = selectedExport === option.id;
                return (
                  <motion.button
                    key={option.id}
                    onClick={() => setSelectedExport(option.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? `border-${option.color}-500 bg-${option.color}-50`
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${
                        isSelected ? `bg-${option.color}-100` : 'bg-slate-100'
                      }`}>
                        <Icon className={`w-6 h-6 ${
                          isSelected ? `text-${option.color}-600` : 'text-slate-600'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <h3 className={`font-semibold ${
                          isSelected ? `text-${option.color}-700` : 'text-slate-800'
                        }`}>
                          {option.title}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">{option.description}</p>
                      </div>
                      {isSelected && (
                        <CheckCircle className={`w-6 h-6 text-${option.color}-600`} />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Time Period Selection */}
          {selectedExport && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-lg p-4"
            >
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                Select Time Period
              </h2>

              <div className="space-y-4">
                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportAll}
                    onChange={(e) => setExportAll(e.target.checked)}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-medium text-slate-800">Export All Time</span>
                    <p className="text-xs text-slate-500">Include all records without time filter</p>
                  </div>
                </label>

                {!exportAll && (
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Select Month
                    </label>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Export Button */}
          {selectedExport && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <button
                onClick={handleExport}
                disabled={isExporting}
                className={`w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-3 transition-all ${
                  isExporting
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98'
                }`}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Export to CSV
                  </>
                )}
              </button>
            </motion.div>
          )}

          {/* Export Result */}
          {exportResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl ${
                exportResult.success
                  ? 'bg-emerald-50 border border-emerald-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {exportResult.success ? (
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-600" />
                )}
                <div>
                  <p className={`font-medium ${
                    exportResult.success ? 'text-emerald-700' : 'text-red-700'
                  }`}>
                    {exportResult.message}
                  </p>
                  {exportResult.count && (
                    <p className="text-sm text-emerald-600">
                      {exportResult.count} records exported
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Help Section */}
          <div className="bg-slate-50 rounded-xl p-4">
            <h3 className="font-semibold text-slate-700 mb-2">Export Tips</h3>
            <ul className="text-sm text-slate-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-emerald-600">•</span>
                CSV files can be opened in Excel, Google Sheets, or any spreadsheet application
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600">•</span>
                Large exports may take a moment to process
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-600">•</span>
                For the best results, ensure your data is synced to Supabase
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="text-sm text-slate-600">
            {selectedExport && (
              <>
                Selected: <span className="font-medium">
                  {exportOptions.find(o => o.id === selectedExport)?.title}
                </span>
                {!exportAll && <span> • {selectedMonth}</span>}
              </>
            )}
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-sm transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataExportPage;
