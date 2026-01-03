import React, { useMemo, useState } from 'react';
import { Patient, Unit, AdmissionType } from '../types';
import { ChevronLeftIcon, BedIcon, HomeIcon, ArrowUpOnSquareIcon } from './common/Icons';
import DateFilter, { DateFilterValue } from './DateFilter';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';

interface DeathsAnalysisProps {
  patients: Patient[];
  onBack: () => void;
}

type TimeRange = '7days' | '30days' | '3months' | '6months' | '12months' | 'all';

const DeathsAnalysis: React.FC<DeathsAnalysisProps> = ({ patients, onBack }) => {
  const [selectedUnit, setSelectedUnit] = useState<'All' | 'NICU' | 'PICU'>('All');
  const [nicuFilter, setNicuFilter] = useState<'All' | 'Inborn' | 'Outborn'>('All');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ period: 'All Time' });
  const [timeRange, setTimeRange] = useState<TimeRange>('3months');

  const timeRanges = [
    { value: '7days' as TimeRange, label: 'Last 7 Days', icon: '📅' },
    { value: '30days' as TimeRange, label: 'Last 30 Days', icon: '📆' },
    { value: '3months' as TimeRange, label: 'Last 3 Months', icon: '🗓️' },
    { value: '6months' as TimeRange, label: 'Last 6 Months', icon: '📊' },
    { value: '12months' as TimeRange, label: 'Last 12 Months', icon: '📈' },
    { value: 'all' as TimeRange, label: 'All Time', icon: '∞' },
  ];

  const deceasedPatients = useMemo(() => {
    return patients.filter(p => p.outcome === 'Deceased');
  }, [patients]);

  const filteredDeaths = useMemo(() => {
    let filtered = deceasedPatients;

    // Filter by unit
    if (selectedUnit === 'NICU') {
      filtered = filtered.filter(p => p.unit === Unit.NICU);

      // Apply NICU sub-filter
      if (nicuFilter === 'Inborn') {
        filtered = filtered.filter(p => p.admissionType === AdmissionType.Inborn);
      } else if (nicuFilter === 'Outborn') {
        filtered = filtered.filter(p => p.admissionType === AdmissionType.Outborn);
      }
    } else if (selectedUnit === 'PICU') {
      filtered = filtered.filter(p => p.unit === Unit.PICU);
    }

    // Apply date filter
    if (dateFilter.period !== 'All Time') {
      let startDate: Date;
      let endDate: Date;

      const periodIsMonth = /\d{4}-\d{2}/.test(dateFilter.period);

      if (periodIsMonth) {
        const [year, month] = dateFilter.period.split('-').map(Number);
        startDate = new Date(year, month - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(year, month, 0);
        endDate.setHours(23, 59, 59, 999);
      } else {
        const now = new Date();
        switch (dateFilter.period) {
          case 'Today':
            startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'This Week':
            const firstDayOfWeek = new Date(now);
            firstDayOfWeek.setDate(now.getDate() - now.getDay());
            startDate = new Date(firstDayOfWeek);
            startDate.setHours(0, 0, 0, 0);
            const lastDayOfWeek = new Date(firstDayOfWeek);
            lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
            endDate = new Date(lastDayOfWeek);
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'This Month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'Custom':
            if (!dateFilter.startDate || !dateFilter.endDate) return filtered;
            startDate = new Date(dateFilter.startDate);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(dateFilter.endDate);
            endDate.setHours(23, 59, 59, 999);
            break;
          default:
            return filtered;
        }
      }

      filtered = filtered.filter(p => {
        // Use death date (releaseDate) for filtering if available, otherwise admission date
        const deathDate = p.releaseDate ? new Date(p.releaseDate) : new Date(p.admissionDate);
        return deathDate >= startDate && deathDate <= endDate;
      });
    }

    return filtered;
  }, [deceasedPatients, selectedUnit, nicuFilter, dateFilter]);

  const stats = useMemo(() => {
    const totalDeaths = deceasedPatients.length;
    const nicuDeaths = deceasedPatients.filter(p => p.unit === Unit.NICU).length;
    const picuDeaths = deceasedPatients.filter(p => p.unit === Unit.PICU).length;
    const nicuInbornDeaths = deceasedPatients.filter(p => p.unit === Unit.NICU && p.admissionType === AdmissionType.Inborn).length;
    const nicuOutbornDeaths = deceasedPatients.filter(p => p.unit === Unit.NICU && p.admissionType === AdmissionType.Outborn).length;

    return { totalDeaths, nicuDeaths, picuDeaths, nicuInbornDeaths, nicuOutbornDeaths };
  }, [deceasedPatients]);

  // Trend data for time range
  const trendData = useMemo(() => {
    const now = new Date();
    const dataPoints = [];

    let days = 0;
    let stepDays = 1;

    switch (timeRange) {
      case '7days':
        days = 7;
        stepDays = 1;
        break;
      case '30days':
        days = 30;
        stepDays = 1;
        break;
      case '3months':
        days = 90;
        stepDays = 3;
        break;
      case '6months':
        days = 180;
        stepDays = 7;
        break;
      case '12months':
        days = 365;
        stepDays = 15;
        break;
      case 'all':
        // For all time, use monthly data
        const years = new Map<string, { NICU: number; PICU: number }>();
        deceasedPatients.forEach(p => {
          const deathDate = p.releaseDate ? new Date(p.releaseDate) : new Date(p.admissionDate);
          const monthKey = `${deathDate.getFullYear()}-${String(deathDate.getMonth() + 1).padStart(2, '0')}`;
          if (!years.has(monthKey)) {
            years.set(monthKey, { NICU: 0, PICU: 0 });
          }
          const data = years.get(monthKey)!;
          if (p.unit === Unit.NICU) data.NICU++;
          else data.PICU++;
        });

        return Array.from(years.entries())
          .map(([monthKey, data]) => ({
            date: monthKey,
            NICU: data.NICU,
            PICU: data.PICU,
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-12); // Last 12 months
    }

    // Generate data points for specific time ranges
    for (let i = days; i >= 0; i -= stepDays) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + stepDays);

      const deathsInRange = deceasedPatients.filter(p => {
        const deathDate = p.releaseDate ? new Date(p.releaseDate) : new Date(p.admissionDate);
        return deathDate >= date && deathDate < nextDate;
      });

      dataPoints.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        NICU: deathsInRange.filter(p => p.unit === Unit.NICU).length,
        PICU: deathsInRange.filter(p => p.unit === Unit.PICU).length,
      });
    }

    return dataPoints;
  }, [deceasedPatients, timeRange]);

  // Top diagnoses leading to death
  const diagnosisData = useMemo(() => {
    const diagnosisCounts: { [key: string]: number } = {};
    deceasedPatients.forEach(p => {
      const diagnosis = p.diagnosis || 'Unknown';
      diagnosisCounts[diagnosis] = (diagnosisCounts[diagnosis] || 0) + 1;
    });

    return Object.entries(diagnosisCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [deceasedPatients]);

  // Unit breakdown pie chart
  const unitBreakdown = useMemo(() => [
    { name: 'NICU', value: stats.nicuDeaths, color: '#0ea5e9' },
    { name: 'PICU', value: stats.picuDeaths, color: '#8b5cf6' },
  ], [stats]);

  const getAgeDisplay = (patient: Patient) => {
    return `${patient.age} ${patient.ageUnit}`;
  };

  const getAdmissionDuration = (patient: Patient) => {
    const admission = new Date(patient.admissionDate);
    const release = patient.releaseDate ? new Date(patient.releaseDate) : new Date();
    const days = Math.floor((release.getTime() - admission.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-xl border-2 border-sky-200 p-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-sky-600 hover:text-sky-800 transition-colors p-2 -ml-2 hover:bg-sky-50 rounded-lg">
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-sky-900 flex items-center gap-2">
              <span className="text-2xl">💔</span>
              Deaths Analysis
            </h1>
            <p className="text-xs sm:text-sm text-sky-600">Detailed analysis of deceased patients across all units</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl shadow-lg border-2 border-red-200 p-4 sm:p-6 hover:shadow-xl transition-all duration-200">
          <div className="text-xs sm:text-sm text-red-600 font-medium mb-1">Total Deaths</div>
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-red-600">{stats.totalDeaths}</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg border-2 border-sky-200 p-4 sm:p-6 hover:shadow-xl transition-all duration-200">
          <div className="text-xs sm:text-sm text-sky-600 font-medium mb-1">NICU Deaths</div>
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-sky-600">{stats.nicuDeaths}</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg border-2 border-blue-200 p-4 sm:p-6 hover:shadow-xl transition-all duration-200">
          <div className="text-xs sm:text-sm text-blue-600 font-medium mb-1">NICU Inborn</div>
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-600">{stats.nicuInbornDeaths}</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg border-2 border-orange-200 p-4 sm:p-6 hover:shadow-xl transition-all duration-200">
          <div className="text-xs sm:text-sm text-orange-600 font-medium mb-1">NICU Outborn</div>
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-orange-600">{stats.nicuOutbornDeaths}</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg border-2 border-purple-200 p-4 sm:p-6 hover:shadow-xl transition-all duration-200">
          <div className="text-xs sm:text-sm text-purple-600 font-medium mb-1">PICU Deaths</div>
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-purple-600">{stats.picuDeaths}</div>
        </div>
      </div>

      {/* Time Range Filter for Charts */}
      <div className="bg-gradient-to-r from-sky-50 to-blue-50 border-2 border-sky-200 rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-bold text-sky-900">Mortality Trend Analysis</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {timeRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`
                px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2
                ${timeRange === range.value
                  ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg scale-105'
                  : 'bg-white text-sky-700 border-2 border-sky-200 hover:border-sky-400 hover:shadow-md'
                }
              `}
            >
              <span>{range.icon}</span>
              <span>{range.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mortality Trend Chart */}
        <div className="bg-white rounded-xl shadow-xl border-2 border-sky-200 p-6 transition-all duration-200 hover:shadow-2xl">
          <h3 className="text-xl font-bold text-sky-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">📉</span>
            Mortality Trend
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                <XAxis dataKey="date" stroke="#0369a1" tick={{ fontSize: 11, fill: '#0369a1' }} angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="#0369a1" tick={{ fontSize: 11, fill: '#0369a1' }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '2px solid #0ea5e9', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="NICU" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 5, fill: '#0ea5e9' }} activeDot={{ r: 7 }} />
                <Line type="monotone" dataKey="PICU" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5, fill: '#8b5cf6' }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Diagnoses */}
        <div className="bg-white rounded-xl shadow-xl border-2 border-sky-200 p-6 transition-all duration-200 hover:shadow-2xl">
          <h3 className="text-xl font-bold text-sky-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">🦠</span>
            Top Causes of Death
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diagnosisData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" horizontal={false} />
                <XAxis type="number" stroke="#0369a1" tick={{ fontSize: 11, fill: '#0369a1' }} />
                <YAxis dataKey="name" type="category" stroke="#0369a1" tick={{ fontSize: 11, fill: '#0369a1' }} width={150} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '2px solid #0ea5e9', borderRadius: '8px' }} />
                <Bar dataKey="count" name="Deaths" fill="#ef4444" radius={[0, 8, 8, 0]} barSize={25} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <DateFilter onFilterChange={setDateFilter} />

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-xl border-2 border-sky-200 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-sky-900 mb-4">Filter by Unit & Type</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Unit Filter */}
          <div className="flex-1">
            <label className="block text-xs sm:text-sm font-medium text-sky-700 mb-2">Unit</label>
            <div className="flex bg-sky-50 p-1 rounded-lg border-2 border-sky-200">
              {['All', 'NICU', 'PICU'].map(unit => (
                <button
                  key={unit}
                  onClick={() => setSelectedUnit(unit as 'All' | 'NICU' | 'PICU')}
                  className={`flex-1 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all ${
                    selectedUnit === unit
                      ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-md'
                      : 'text-sky-700 hover:bg-sky-100'
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>

          {/* NICU Sub-filter */}
          {selectedUnit === 'NICU' && (
            <div className="flex-1">
              <label className="block text-xs sm:text-sm font-medium text-sky-700 mb-2">NICU Type</label>
              <div className="flex bg-sky-50 p-1 rounded-lg border-2 border-sky-200">
                {['All', 'Inborn', 'Outborn'].map(type => (
                  <button
                    key={type}
                    onClick={() => setNicuFilter(type as 'All' | 'Inborn' | 'Outborn')}
                    className={`flex-1 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all ${
                      nicuFilter === type
                        ? 'bg-gradient-to-r from-blue-500 to-sky-500 text-white shadow-md'
                        : 'text-sky-700 hover:bg-sky-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deaths List */}
      <div className="bg-white rounded-xl shadow-xl border-2 border-sky-200 p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base sm:text-lg font-bold text-sky-900">
            Deceased Patients ({filteredDeaths.length})
          </h3>
        </div>

        {filteredDeaths.length === 0 ? (
          <div className="text-center py-12 text-sky-600">
            <p className="text-lg">No deceased patients found for the selected filters.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDeaths.map(patient => (
              <div
                key={patient.id}
                className="bg-gradient-to-r from-sky-50 to-blue-50 p-4 sm:p-5 rounded-lg border-2 border-sky-200 hover:border-sky-400 hover:shadow-lg transition-all"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column */}
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-base sm:text-lg font-bold text-sky-900 mb-1">{patient.name}</h4>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-sky-100 text-sky-700 rounded text-xs font-medium border border-sky-300">
                          {patient.gender}
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium border border-blue-300">
                          {getAgeDisplay(patient)}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${
                          patient.unit === Unit.NICU
                            ? 'bg-sky-100 text-sky-700 border-sky-300'
                            : 'bg-purple-100 text-purple-700 border-purple-300'
                        }`}>
                          {patient.unit === Unit.NICU ? 'NICU' : 'PICU'}
                        </span>
                        {patient.admissionType && (
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${
                            patient.admissionType === AdmissionType.Inborn
                              ? 'bg-blue-100 text-blue-700 border-blue-300'
                              : 'bg-orange-100 text-orange-700 border-orange-300'
                          }`}>
                            {patient.admissionType}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-sky-600 mb-1 font-semibold">Diagnosis</p>
                      <p className="text-sm text-sky-900">{patient.diagnosis}</p>
                    </div>

                    {patient.admissionType === AdmissionType.Outborn && patient.referringHospital && (
                      <div>
                        <p className="text-xs text-sky-600 mb-1 font-semibold">Referred From</p>
                        <p className="text-sm text-sky-900">
                          {patient.referringHospital}
                          {patient.referringDistrict && `, ${patient.referringDistrict}`}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Column */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-sky-600 mb-1 font-semibold">Admission Date</p>
                        <p className="text-sm text-sky-900">
                          {new Date(patient.admissionDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-red-600 mb-1 font-semibold">Death Date</p>
                        <p className="text-sm text-red-600 font-bold">
                          {patient.releaseDate
                            ? new Date(patient.releaseDate).toLocaleDateString()
                            : 'Not recorded'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-sky-600 mb-1 font-semibold">Duration of Stay</p>
                        <p className="text-sm text-sky-900">{getAdmissionDuration(patient)} days</p>
                      </div>
                    </div>

                    {patient.progressNotes && patient.progressNotes.length > 0 && (
                      <div>
                        <p className="text-xs text-sky-600 mb-2 font-semibold">Latest Progress Note</p>
                        <div className="bg-white p-3 rounded border-2 border-sky-200">
                          <p className="text-xs text-sky-900">
                            {patient.progressNotes[patient.progressNotes.length - 1].note}
                          </p>
                          <p className="text-xs text-sky-500 mt-1">
                            {new Date(patient.progressNotes[patient.progressNotes.length - 1].date).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeathsAnalysis;
