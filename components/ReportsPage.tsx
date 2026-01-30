import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Calendar,
  Filter,
  BarChart3,
  TrendingUp,
  Users,
  FileText,
  Download,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Unit, UserRole } from '../types';
import { isSupabaseConfigured } from '../services/supabaseConfig';
import {
  getMonthlyPatientSummary,
  getPatientHierarchy,
  getOutcomeStatistics,
  type MonthlyPatientSummary,
  type PatientHierarchy
} from '../services/supabaseService';

interface ReportsPageProps {
  institutionId: string;
  institutionName: string;
  onBack: () => void;
  userRole?: UserRole;
}

type TimeRange = 'month' | 'quarter' | 'year' | 'custom';

const ReportsPage: React.FC<ReportsPageProps> = ({
  institutionId,
  institutionName,
  onBack,
  userRole
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('month');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    return new Date().getFullYear().toString();
  });
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Data states
  const [summaryData, setSummaryData] = useState<MonthlyPatientSummary[]>([]);
  const [hierarchyData, setHierarchyData] = useState<PatientHierarchy[]>([]);
  const [outcomeStats, setOutcomeStats] = useState<{
    total: number;
    inProgress: number;
    discharged: number;
    deceased: number;
    referred: number;
    stepDown: number;
  } | null>(null);

  const isConfigured = isSupabaseConfigured();

  const getYearMonthRange = useCallback(() => {
    if (selectedTimeRange === 'month') {
      return { start: selectedMonth, end: selectedMonth };
    } else if (selectedTimeRange === 'quarter') {
      const [year, month] = selectedMonth.split('-').map(Number);
      const quarterStart = Math.floor((month - 1) / 3) * 3 + 1;
      const quarterEnd = quarterStart + 2;
      return {
        start: `${year}-${String(quarterStart).padStart(2, '0')}`,
        end: `${year}-${String(quarterEnd).padStart(2, '0')}`
      };
    } else if (selectedTimeRange === 'year') {
      return {
        start: `${selectedYear}-01`,
        end: `${selectedYear}-12`
      };
    } else if (selectedTimeRange === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      return {
        start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
        end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`
      };
    }
    return { start: selectedMonth, end: selectedMonth };
  }, [selectedTimeRange, selectedMonth, selectedYear, customStartDate, customEndDate]);

  const fetchData = useCallback(async () => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { start, end } = getYearMonthRange();

      // Fetch all data in parallel
      const [summary, hierarchy, stats] = await Promise.all([
        getMonthlyPatientSummary(institutionId, start),
        getPatientHierarchy(institutionId, start, selectedUnit !== 'all' ? selectedUnit : undefined),
        getOutcomeStatistics(institutionId, start, end)
      ]);

      setSummaryData(summary);
      setHierarchyData(hierarchy);
      setOutcomeStats(stats);
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError('Failed to load report data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [institutionId, isConfigured, selectedUnit, getYearMonthRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getTimeRangeLabel = () => {
    if (selectedTimeRange === 'month' && selectedMonth) {
      const date = new Date(selectedMonth);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (selectedTimeRange === 'quarter') {
      const [year, month] = selectedMonth.split('-').map(Number);
      const quarter = Math.ceil(month / 3);
      return `Q${quarter} ${year}`;
    }
    if (selectedTimeRange === 'year' && selectedYear) {
      return selectedYear;
    }
    if (selectedTimeRange === 'custom' && customStartDate && customEndDate) {
      return `${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`;
    }
    return 'All Time';
  };

  // Calculate totals from summary data
  const totals = summaryData.reduce((acc, item) => ({
    total: acc.total + (item.total_patients || 0),
    discharged: acc.discharged + (item.discharged || 0),
    deceased: acc.deceased + (item.deceased || 0),
    inProgress: acc.inProgress + (item.in_progress || 0)
  }), { total: 0, discharged: 0, deceased: 0, inProgress: 0 });

  if (!isConfigured) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-100">
        <header className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
          <div className="px-4 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold">Reports & Analytics</h1>
                <p className="text-xs text-blue-200">{institutionName}</p>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Supabase Not Configured</h2>
            <p className="text-slate-600 text-sm mb-4">
              To use reports and analytics, please configure Supabase in your environment variables.
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
      <header className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                onClick={onBack}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold truncate">Reports & Analytics</h1>
                <p className="text-xs text-blue-200 truncate">{institutionName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                disabled={isLoading}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-all ${
                  showFilters ? 'bg-white text-blue-800' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <Filter className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl sm:text-3xl font-bold">{outcomeStats?.total || totals.total}</div>
              <div className="text-[10px] sm:text-xs text-blue-200">Total</div>
            </div>
            <div className="bg-emerald-500/20 rounded-xl p-3 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-emerald-300">
                {outcomeStats?.discharged || totals.discharged}
              </div>
              <div className="text-[10px] sm:text-xs text-emerald-200">Discharged</div>
            </div>
            <div className="bg-amber-500/20 rounded-xl p-3 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-amber-300">
                {outcomeStats?.inProgress || totals.inProgress}
              </div>
              <div className="text-[10px] sm:text-xs text-amber-200">In Progress</div>
            </div>
            <div className="bg-red-500/20 rounded-xl p-3 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-red-300">
                {outcomeStats?.deceased || totals.deceased}
              </div>
              <div className="text-[10px] sm:text-xs text-red-200">Deceased</div>
            </div>
          </div>

          {/* Period Label */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4 text-blue-300" />
            <span className="text-sm text-blue-200">{getTimeRangeLabel()}</span>
          </div>
        </div>
      </header>

      {/* Filters Panel */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm"
        >
          <div className="px-4 py-4 space-y-4">
            {/* Time Period */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">TIME PERIOD</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'month', label: 'Month' },
                  { value: 'quarter', label: 'Quarter' },
                  { value: 'year', label: 'Year' },
                  { value: 'custom', label: 'Custom' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedTimeRange(option.value as TimeRange)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      selectedTimeRange === option.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Month Picker */}
              {(selectedTimeRange === 'month' || selectedTimeRange === 'quarter') && (
                <div className="mt-3">
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Year Picker */}
              {selectedTimeRange === 'year' && (
                <div className="mt-3">
                  <input
                    type="number"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    min="2000"
                    max={new Date().getFullYear()}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter year"
                  />
                </div>
              )}

              {/* Custom Date Range */}
              {selectedTimeRange === 'custom' && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">From</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">To</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Unit Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">UNIT</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedUnit('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    selectedUnit === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Units
                </button>
                {['NICU', 'PICU', 'SNCU', 'HDU'].map(unit => (
                  <button
                    key={unit}
                    onClick={() => setSelectedUnit(unit)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      selectedUnit === unit
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowFilters(false)}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm"
            >
              Apply Filters
            </button>
          </div>
        </motion.div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-6 max-w-7xl mx-auto space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-slate-600">Loading report data...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-red-700 font-medium">{error}</p>
              <button
                onClick={fetchData}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Summary by Unit */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    Summary by Unit
                  </h2>
                </div>
                <div className="p-4">
                  {summaryData.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No data available for the selected period</p>
                  ) : (
                    <div className="space-y-3">
                      {summaryData.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                        >
                          <div>
                            <p className="font-semibold text-slate-800">{item.unit_name || 'Unknown'}</p>
                            <p className="text-xs text-slate-500">{item.admission_year_month}</p>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="text-center">
                              <p className="font-bold text-slate-800">{item.total_patients}</p>
                              <p className="text-[10px] text-slate-500">Total</p>
                            </div>
                            <div className="text-center">
                              <p className="font-bold text-emerald-600">{item.discharged}</p>
                              <p className="text-[10px] text-slate-500">Discharged</p>
                            </div>
                            <div className="text-center">
                              <p className="font-bold text-amber-600">{item.in_progress}</p>
                              <p className="text-[10px] text-slate-500">Active</p>
                            </div>
                            <div className="text-center">
                              <p className="font-bold text-red-600">{item.deceased}</p>
                              <p className="text-[10px] text-slate-500">Deceased</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Patient List */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Patient List ({hierarchyData.length})
                  </h2>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {hierarchyData.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No patients found for the selected filters</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">Patient</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">Unit</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">Outcome</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {hierarchyData.slice(0, 50).map((patient, index) => (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800">{patient.patient_name}</p>
                              <p className="text-xs text-slate-500">{patient.ip_number || patient.ntid || '-'}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{patient.unit || '-'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                patient.outcome === 'Discharged' ? 'bg-emerald-100 text-emerald-700' :
                                patient.outcome === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                                patient.outcome === 'Deceased' ? 'bg-red-100 text-red-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {patient.outcome || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {patient.note_count || 0} notes
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {hierarchyData.length > 50 && (
                    <p className="text-center py-3 text-sm text-slate-500">
                      Showing first 50 of {hierarchyData.length} patients
                    </p>
                  )}
                </div>
              </div>

              {/* Outcome Statistics */}
              {outcomeStats && (
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                  <div className="p-4 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      Outcome Distribution
                    </h2>
                  </div>
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-emerald-50 rounded-xl">
                      <p className="text-3xl font-bold text-emerald-600">{outcomeStats.discharged}</p>
                      <p className="text-sm text-emerald-700">Discharged</p>
                      <p className="text-xs text-emerald-500 mt-1">
                        {outcomeStats.total > 0 ? ((outcomeStats.discharged / outcomeStats.total) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                    <div className="text-center p-4 bg-amber-50 rounded-xl">
                      <p className="text-3xl font-bold text-amber-600">{outcomeStats.inProgress}</p>
                      <p className="text-sm text-amber-700">In Progress</p>
                      <p className="text-xs text-amber-500 mt-1">
                        {outcomeStats.total > 0 ? ((outcomeStats.inProgress / outcomeStats.total) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-xl">
                      <p className="text-3xl font-bold text-red-600">{outcomeStats.deceased}</p>
                      <p className="text-sm text-red-700">Deceased</p>
                      <p className="text-xs text-red-500 mt-1">
                        {outcomeStats.total > 0 ? ((outcomeStats.deceased / outcomeStats.total) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-xl">
                      <p className="text-3xl font-bold text-blue-600">{outcomeStats.referred}</p>
                      <p className="text-sm text-blue-700">Referred</p>
                      <p className="text-xs text-blue-500 mt-1">
                        {outcomeStats.total > 0 ? ((outcomeStats.referred / outcomeStats.total) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-xl">
                      <p className="text-3xl font-bold text-purple-600">{outcomeStats.stepDown}</p>
                      <p className="text-sm text-purple-700">Step Down</p>
                      <p className="text-xs text-purple-500 mt-1">
                        {outcomeStats.total > 0 ? ((outcomeStats.stepDown / outcomeStats.total) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="text-sm text-slate-600">
            <span className="font-medium">{getTimeRangeLabel()}</span>
            {selectedUnit !== 'all' && <span> • {selectedUnit}</span>}
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

export default ReportsPage;
