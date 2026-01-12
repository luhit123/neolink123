import React, { useState, useEffect } from 'react';
import { Patient, Unit, UserRole } from '../types';
import { motion } from 'framer-motion';
import DeathDiagnosisAnalytics from './DeathDiagnosisAnalytics';

interface DeathAnalyticsPageProps {
  patients: Patient[];
  institutionName: string;
  selectedUnit: Unit;
  onClose: () => void;
  userRole?: UserRole;
}

type BirthType = 'all' | 'inborn' | 'outborn';

const DeathAnalyticsPage: React.FC<DeathAnalyticsPageProps> = ({
  patients,
  institutionName,
  selectedUnit,
  onClose,
  userRole
}) => {
  const [deceasedPatients, setDeceasedPatients] = useState<Patient[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'all' | 'month' | 'year' | 'custom'>('all');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<Unit | 'all'>(selectedUnit);
  const [birthTypeFilter, setBirthTypeFilter] = useState<BirthType>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [isHeaderMinimized, setIsHeaderMinimized] = useState(false);

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
          // Check both birthType and admissionType fields
          const birthType = (p as any).birthType?.toLowerCase();
          const admissionType = p.admissionType?.toLowerCase();
          return (
            p.unit === Unit.NICU &&
            (birthType === 'inborn' || admissionType === 'inborn' || admissionType?.includes('inborn'))
          );
        });
      } else if (birthTypeFilter === 'outborn') {
        filtered = filtered.filter(p => {
          // Check both birthType and admissionType fields
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
      // Filter by specific month and year
      const [year, month] = selectedMonth.split('-');
      filtered = filtered.filter(p => {
        const deathDate = p.dateOfDeath ? new Date(p.dateOfDeath) : new Date(p.releaseDate || p.admissionDate);
        return deathDate.getFullYear() === parseInt(year) &&
               deathDate.getMonth() === parseInt(month) - 1;
      });
    } else if (selectedTimeRange === 'year' && selectedYear) {
      // Filter by specific year
      filtered = filtered.filter(p => {
        const deathDate = p.dateOfDeath ? new Date(p.dateOfDeath) : new Date(p.releaseDate || p.admissionDate);
        return deathDate.getFullYear() === parseInt(selectedYear);
      });
    } else if (selectedTimeRange === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999); // Include entire end date
      filtered = filtered.filter(p => {
        const deathDate = p.dateOfDeath ? new Date(p.dateOfDeath) : new Date(p.releaseDate || p.admissionDate);
        return deathDate >= start && deathDate <= end;
      });
    }

    setDeceasedPatients(filtered);
  }, [patients, selectedTimeRange, selectedUnitFilter, birthTypeFilter, customStartDate, customEndDate, selectedMonth, selectedYear]);

  // Handle scroll to minimize header
  useEffect(() => {
    const contentArea = document.getElementById('mortality-content-area');
    if (!contentArea) return;

    const handleScroll = () => {
      const scrollTop = contentArea.scrollTop;
      setIsHeaderMinimized(scrollTop > 100);
    };

    contentArea.addEventListener('scroll', handleScroll);
    return () => contentArea.removeEventListener('scroll', handleScroll);
  }, []);

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

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 to-slate-800 z-50 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Compact Header with Scroll Collapse */}
        <motion.div
          animate={{
            height: isHeaderMinimized ? '60px' : 'auto',
            paddingTop: isHeaderMinimized ? '12px' : '24px',
            paddingBottom: isHeaderMinimized ? '12px' : '24px'
          }}
          transition={{ duration: 0.3 }}
          className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-2xl overflow-hidden"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Minimized Header View */}
            {isHeaderMinimized ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </button>
                  <h1 className="text-lg font-bold text-white">Mortality Analytics</h1>
                  <div className="hidden md:flex items-center gap-3 ml-4">
                    <span className="px-3 py-1 bg-white/20 text-white rounded-full text-xs font-semibold">
                      {deceasedPatients.length} Patients
                    </span>
                    <span className="px-3 py-1 bg-white/20 text-white rounded-full text-xs font-semibold">
                      {mortalityRate}% Rate
                    </span>
                    <span className="px-3 py-1 bg-white/20 text-white rounded-full text-xs font-semibold">
                      {getTimeRangeLabel()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsHeaderMinimized(false)}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  Filters
                </button>
              </div>
            ) : (
              /* Full Header View */
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={onClose}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                    </button>
                    <div>
                      <h1 className="text-2xl font-bold text-white">Mortality Analytics</h1>
                      <p className="text-blue-100 text-xs mt-0.5">{institutionName}</p>
                    </div>
                  </div>

                  {/* Compact Stats */}
                  <div className="hidden md:flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-3xl font-bold text-white">{deceasedPatients.length}</div>
                      <div className="text-blue-100 text-xs">Patients</div>
                    </div>
                    <div className="h-10 w-px bg-blue-400/50"></div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-white">{mortalityRate}%</div>
                      <div className="text-blue-100 text-xs">Rate</div>
                    </div>
                  </div>
                </div>

                {/* Compact Filters */}
                <div className="mt-4 space-y-2">
                  {/* Time Range Filter Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-blue-100 text-xs font-medium">Period:</span>
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => {
                          setSelectedTimeRange('all');
                          setShowCustomDatePicker(false);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          selectedTimeRange === 'all'
                            ? 'bg-white text-blue-700 shadow-lg'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        All Time
                      </button>

                      {/* Month Calendar Picker */}
                      <button
                        onClick={() => {
                          setSelectedTimeRange('month');
                          setShowCustomDatePicker(false);
                          // Set current month if not set
                          if (!selectedMonth) {
                            const now = new Date();
                            setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          selectedTimeRange === 'month'
                            ? 'bg-white text-blue-700 shadow-lg'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        {selectedTimeRange === 'month' && selectedMonth ?
                          new Date(selectedMonth).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                          : 'Month'
                        }
                      </button>
                      {selectedTimeRange === 'month' && (
                        <input
                          type="month"
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="px-3 py-1.5 rounded-lg bg-white text-slate-900 font-semibold text-xs border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}

                      {/* Year Calendar Picker */}
                      <button
                        onClick={() => {
                          setSelectedTimeRange('year');
                          setShowCustomDatePicker(false);
                          // Set current year if not set
                          if (!selectedYear) {
                            setSelectedYear(new Date().getFullYear().toString());
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          selectedTimeRange === 'year'
                            ? 'bg-white text-blue-700 shadow-lg'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        {selectedTimeRange === 'year' && selectedYear ? selectedYear : 'Year'}
                      </button>
                      {selectedTimeRange === 'year' && (
                        <input
                          type="number"
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(e.target.value)}
                          min="2000"
                          max={new Date().getFullYear()}
                          className="px-3 py-1.5 rounded-lg bg-white text-slate-900 font-semibold text-xs border border-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500 w-24"
                        />
                      )}

                      <button
                        onClick={() => {
                          setSelectedTimeRange('custom');
                          setShowCustomDatePicker(!showCustomDatePicker);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                          selectedTimeRange === 'custom'
                            ? 'bg-white text-blue-700 shadow-lg'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {selectedTimeRange === 'custom' && customStartDate ?
                          `${new Date(customStartDate).toLocaleDateString()} - ${customEndDate ? new Date(customEndDate).toLocaleDateString() : 'Present'}`
                          : 'Custom'
                        }
                      </button>
                    </div>
                  </div>

                  {/* Custom Date Picker */}
                  {showCustomDatePicker && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex flex-wrap items-center gap-2 bg-white/10 backdrop-blur-xl rounded-lg p-3 border border-white/20"
                    >
                      <div className="flex items-center gap-2">
                        <label className="text-blue-100 text-xs font-medium">From:</label>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="px-3 py-1.5 rounded-lg bg-white text-slate-900 font-semibold text-xs border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-blue-100 text-xs font-medium">To:</label>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="px-3 py-1.5 rounded-lg bg-white text-slate-900 font-semibold text-xs border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                        />
                      </div>
                      {customStartDate && customEndDate && (
                        <button
                          onClick={() => {
                            setCustomStartDate('');
                            setCustomEndDate('');
                          }}
                          className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold transition-all"
                        >
                          Clear
                        </button>
                      )}
                    </motion.div>
                  )}

                  {/* Unit and Birth Type Filter Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Unit Filter */}
                    <div className="flex items-center gap-1">
                      <span className="text-blue-100 text-xs font-medium">Unit:</span>
                      <select
                        value={selectedUnitFilter}
                        onChange={(e) => setSelectedUnitFilter(e.target.value as Unit | 'all')}
                        className="px-3 py-1.5 bg-white/20 text-white rounded-lg text-xs font-semibold border border-white/30 focus:outline-none focus:border-white transition-all"
                      >
                        <option value="all" className="text-slate-900">All</option>
                        {Object.values(Unit).map(unit => (
                          <option key={unit} value={unit} className="text-slate-900">{unit}</option>
                        ))}
                      </select>
                    </div>

                    {/* Birth Type Filter (NICU only) */}
                    {(selectedUnitFilter === Unit.NICU || selectedUnitFilter === 'all') && (
                      <div className="flex items-center gap-1">
                        <span className="text-blue-100 text-xs font-medium">Birth:</span>
                        <div className="flex gap-1">
                          {[
                            { value: 'all', label: 'All' },
                            { value: 'inborn', label: 'In' },
                            { value: 'outborn', label: 'Out' }
                          ].map(option => (
                            <button
                              key={option.value}
                              onClick={() => setBirthTypeFilter(option.value as BirthType)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                birthTypeFilter === option.value
                                  ? 'bg-white text-blue-700 shadow-lg'
                                  : 'bg-white/20 text-white hover:bg-white/30'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>

        {/* Content Area */}
        <div id="mortality-content-area" className="flex-1 overflow-y-auto bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {deceasedPatients.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-xl p-12 text-center"
              >
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  No Deceased Patients in Selected Period
                </h3>
                <p className="text-slate-600 max-w-md mx-auto">
                  There are no mortality records for the selected time range and filters. Try adjusting your filters.
                </p>
              </motion.div>
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
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-slate-600">
                    <strong>{deceasedPatients.filter(p => p.aiInterpretedDeathDiagnosis).length}</strong> AI Interpreted
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm text-slate-600">
                    <strong>{deceasedPatients.filter(p => !p.aiInterpretedDeathDiagnosis && p.diagnosisAtDeath).length}</strong> Manual Only
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-slate-600">
                    <strong>{deceasedPatients.filter(p => !p.diagnosisAtDeath).length}</strong> Missing Data
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeathAnalyticsPage;
