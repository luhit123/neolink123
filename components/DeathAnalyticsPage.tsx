import React, { useState, useEffect, useMemo } from 'react';
import { Patient, Unit, UserRole } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Calendar, Filter, BarChart3, TrendingDown, FileText, Download, PieChart, Activity, ArrowUpRight, Settings2 } from 'lucide-react';
import DeathDiagnosisAnalytics from './DeathDiagnosisAnalytics';
import MortalityReportsSection from './MortalityReportsSection';

interface DeathAnalyticsPageProps {
  patients: Patient[];
  institutionName: string;
  selectedUnit: Unit;
  onBack: () => void;
  userRole?: UserRole;
}

type BirthType = 'all' | 'inborn' | 'outborn';
type ViewTab = 'analytics' | 'reports';

const DeathAnalyticsPage: React.FC<DeathAnalyticsPageProps> = ({
  patients,
  institutionName,
  selectedUnit,
  onBack,
  userRole
}) => {
  const [deceasedPatients, setDeceasedPatients] = useState<Patient[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'all' | 'month' | 'year' | 'custom'>('month');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<Unit | 'all'>(selectedUnit);
  const [birthTypeFilter, setBirthTypeFilter] = useState<BirthType>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('analytics');

  useEffect(() => {
    let filtered = patients.filter(p => p.outcome === 'Deceased');

    // Filter by unit
    if (selectedUnitFilter !== 'all') {
      filtered = filtered.filter(p => p.unit === selectedUnitFilter);
    }

    // Filter by birth type (NICU only)
    if (birthTypeFilter !== 'all') {
      if (birthTypeFilter === 'inborn') {
        filtered = filtered.filter(p => {
          const birthType = (p as any).birthType?.toLowerCase();
          const admissionType = p.admissionType?.toLowerCase();
          return (
            p.unit === Unit.NICU &&
            (birthType === 'inborn' || admissionType === 'inborn' || admissionType?.includes('inborn'))
          );
        });
      } else if (birthTypeFilter === 'outborn') {
        filtered = filtered.filter(p => {
          const birthType = (p as any).birthType?.toLowerCase();
          const admissionType = p.admissionType?.toLowerCase();
          return (
            p.unit === Unit.NICU &&
            (birthType === 'outborn' ||
             admissionType?.includes('outborn') ||
             admissionType === 'outborn (health facility referred)' ||
             admissionType === 'outborn (community referred)')
          );
        });
      }
    }

    // Filter by time range
    if (selectedTimeRange === 'month' && selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      filtered = filtered.filter(p => {
        const deathDate = p.dateOfDeath ? new Date(p.dateOfDeath) : new Date(p.releaseDate || p.admissionDate);
        return deathDate.getFullYear() === parseInt(year) &&
               deathDate.getMonth() === parseInt(month) - 1;
      });
    } else if (selectedTimeRange === 'year' && selectedYear) {
      filtered = filtered.filter(p => {
        const deathDate = p.dateOfDeath ? new Date(p.dateOfDeath) : new Date(p.releaseDate || p.admissionDate);
        return deathDate.getFullYear() === parseInt(selectedYear);
      });
    } else if (selectedTimeRange === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(p => {
        const deathDate = p.dateOfDeath ? new Date(p.dateOfDeath) : new Date(p.releaseDate || p.admissionDate);
        return deathDate >= start && deathDate <= end;
      });
    }

    setDeceasedPatients(filtered);
  }, [patients, selectedTimeRange, selectedUnitFilter, birthTypeFilter, customStartDate, customEndDate, selectedMonth, selectedYear]);

  const mortalityRate = patients.length > 0
    ? ((deceasedPatients.length / patients.length) * 100).toFixed(1)
    : '0.0';

  const getTimeRangeLabel = () => {
    if (selectedTimeRange === 'month' && selectedMonth) {
      const date = new Date(selectedMonth);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (selectedTimeRange === 'year' && selectedYear) {
      return selectedYear;
    }
    if (selectedTimeRange === 'custom' && customStartDate && customEndDate) {
      return `${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`;
    }
    return 'All Time';
  };

  const aiAnalyzedCount = deceasedPatients.filter(p => p.aiInterpretedDeathDiagnosis).length;
  const manualCount = deceasedPatients.filter(p => !p.aiInterpretedDeathDiagnosis && p.diagnosisAtDeath).length;
  const missingCount = deceasedPatients.filter(p => !p.diagnosisAtDeath).length;

  // Calculate quick stats for compact display
  const totalAdmissions = patients.length;
  const totalDeaths = deceasedPatients.length;
  const calculatedMortalityRate = totalAdmissions > 0 ? ((totalDeaths / totalAdmissions) * 100).toFixed(1) : '0.0';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      {/* Compact Professional Header */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="px-3 sm:px-4 py-2.5">
          <div className="flex items-center justify-between gap-2">
            {/* Left: Back + Title + Quick Stats */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <button
                onClick={onBack}
                className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>

              <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg font-bold text-slate-800 truncate">Mortality Analytics</h1>
                  <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-500">
                    <span className="truncate max-w-[100px] sm:max-w-none">{institutionName}</span>
                    <span className="hidden sm:inline">•</span>
                    <span className="hidden sm:flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {getTimeRangeLabel()}
                    </span>
                  </div>
                </div>

                {/* Inline Quick Stats - Desktop */}
                <div className="hidden md:flex items-center gap-3 border-l border-slate-200 pl-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm font-semibold text-slate-800">{totalDeaths}</span>
                    <span className="text-xs text-slate-500">deaths</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    <span className="text-sm font-semibold text-red-600">{calculatedMortalityRate}%</span>
                    <span className="text-xs text-slate-500">rate</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span className="text-sm font-semibold text-emerald-600">{aiAnalyzedCount}</span>
                    <span className="text-xs text-slate-500">analyzed</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Tab Toggle + Filter */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Tab Toggle */}
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'analytics'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Analytics</span>
                </button>
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
                    activeTab === 'reports'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reports</span>
                </button>
              </div>

              {/* Filter Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-1.5 sm:p-2 rounded-lg transition-all flex-shrink-0 flex items-center gap-1.5 ${
                  showFilters
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-medium">Filters</span>
              </button>
            </div>
          </div>

          {/* Mobile Quick Stats Bar */}
          <div className="flex md:hidden items-center justify-between mt-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-800">{totalDeaths}</span>
                <span className="text-slate-500">deaths</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-red-600">{calculatedMortalityRate}%</span>
                <span className="text-slate-500">rate</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-emerald-600">{aiAnalyzedCount}</span>
                <span className="text-slate-500">AI</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500 sm:hidden">
              <Calendar className="w-3 h-3" />
              {getTimeRangeLabel()}
            </div>
          </div>
        </div>
      </header>

      {/* Compact Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-shrink-0 bg-slate-50 border-b border-slate-200"
          >
            <div className="px-3 sm:px-4 py-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Time Period */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1.5">Period</label>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { value: 'all', label: 'All' },
                      { value: 'month', label: 'Month' },
                      { value: 'year', label: 'Year' },
                      { value: 'custom', label: 'Custom' }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => setSelectedTimeRange(option.value as any)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                          selectedTimeRange === option.value
                            ? 'bg-slate-800 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {selectedTimeRange === 'month' && (
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="mt-2 w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white"
                    />
                  )}
                  {selectedTimeRange === 'year' && (
                    <input
                      type="number"
                      value={selectedYear || new Date().getFullYear()}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      min="2000"
                      max={new Date().getFullYear()}
                      className="mt-2 w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white"
                    />
                  )}
                  {selectedTimeRange === 'custom' && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white"
                      />
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white"
                      />
                    </div>
                  )}
                </div>

                {/* Unit Filter */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1.5">Unit</label>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setSelectedUnitFilter('all')}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        selectedUnitFilter === 'all'
                          ? 'bg-slate-800 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      All
                    </button>
                    {Object.values(Unit).map(unit => (
                      <button
                        key={unit}
                        onClick={() => setSelectedUnitFilter(unit)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                          selectedUnitFilter === unit
                            ? 'bg-slate-800 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Birth Type Filter */}
                {(selectedUnitFilter === Unit.NICU || selectedUnitFilter === 'all') && (
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1.5">Birth Type</label>
                    <div className="flex gap-1">
                      {[
                        { value: 'all', label: 'All' },
                        { value: 'inborn', label: 'Inborn' },
                        { value: 'outborn', label: 'Outborn' }
                      ].map(option => (
                        <button
                          key={option.value}
                          onClick={() => setBirthTypeFilter(option.value as BirthType)}
                          className={`flex-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            birthTypeFilter === option.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Apply Button */}
                <div className="flex items-end">
                  <button
                    onClick={() => setShowFilters(false)}
                    className="w-full py-2 bg-slate-800 text-white rounded-lg font-semibold text-xs hover:bg-slate-700 transition-colors"
                  >
                    Apply & Close
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 sm:px-4 py-4 sm:py-6 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'analytics' ? (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                {deceasedPatients.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 sm:p-12 text-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BarChart3 className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-2">
                      No Mortality Data
                    </h3>
                    <p className="text-slate-600 max-w-md mx-auto text-sm">
                      No mortality records found for the selected filters.
                    </p>
                    <button
                      onClick={() => setShowFilters(true)}
                      className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg font-semibold text-sm"
                    >
                      Adjust Filters
                    </button>
                  </div>
                ) : (
                  <DeathDiagnosisAnalytics
                    patients={deceasedPatients}
                    allPatients={patients}
                    institutionName={institutionName}
                    totalAdmissions={patients.length}
                    timeRangeLabel={getTimeRangeLabel()}
                    unitFilter={selectedUnitFilter === 'all' ? 'All Units' : selectedUnitFilter}
                    birthTypeFilter={birthTypeFilter}
                    startDate={customStartDate}
                    endDate={customEndDate}
                  />
                )}
              </motion.div>
            ) : (
              <motion.div
                key="reports"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <MortalityReportsSection
                  patients={patients}
                  deceasedPatients={deceasedPatients}
                  institutionName={institutionName}
                  selectedTimeRange={selectedTimeRange}
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  customStartDate={customStartDate}
                  customEndDate={customEndDate}
                  selectedUnitFilter={selectedUnitFilter}
                  birthTypeFilter={birthTypeFilter}
                  timeRangeLabel={getTimeRangeLabel()}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default DeathAnalyticsPage;
