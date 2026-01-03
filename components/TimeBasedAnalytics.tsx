import React, { useMemo, useState } from 'react';
import { Patient } from '../types';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface TimeBasedAnalyticsProps {
  patients: Patient[];
}

type TimeRange = '7days' | '30days' | '3months' | '6months' | '12months' | 'all' | 'custom';

const TimeBasedAnalytics: React.FC<TimeBasedAnalyticsProps> = ({ patients }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('12months');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const timeRanges = [
    { value: '7days' as TimeRange, label: 'Last 7 Days', icon: '📅' },
    { value: '30days' as TimeRange, label: 'Last 30 Days', icon: '📆' },
    { value: '3months' as TimeRange, label: 'Last 3 Months', icon: '🗓️' },
    { value: '6months' as TimeRange, label: 'Last 6 Months', icon: '📊' },
    { value: '12months' as TimeRange, label: 'Last 12 Months', icon: '📈' },
    { value: 'all' as TimeRange, label: 'All Time', icon: '∞' },
  ];

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  const handleTimeRangeClick = (range: TimeRange) => {
    if (range === 'custom') {
      setShowCustomRange(!showCustomRange);
      setShowMonthYearPicker(false);
    } else {
      setShowCustomRange(false);
      setShowMonthYearPicker(false);
      setTimeRange(range);
    }
  };

  const handleCustomApply = () => {
    if (customStartDate && customEndDate) {
      setTimeRange('custom');
      setShowCustomRange(false);
    }
  };

  const handleMonthYearToggle = () => {
    setShowMonthYearPicker(!showMonthYearPicker);
    setShowCustomRange(false);
  };

  const handleMonthYearApply = () => {
    // Set custom dates for the selected month/year
    const startDate = new Date(selectedYear, selectedMonth, 1);
    const endDate = new Date(selectedYear, selectedMonth + 1, 0);

    setCustomStartDate(startDate.toISOString().split('T')[0]);
    setCustomEndDate(endDate.toISOString().split('T')[0]);
    setTimeRange('custom');
    setShowMonthYearPicker(false);
  };

  // Month-wise data based on selected range
  const monthWiseData = useMemo(() => {
    const months = [];
    const now = new Date();

    let startDate: Date;
    let endDate: Date;

    if (timeRange === 'custom' && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);

      // Generate monthly data for custom range
      const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

      while (current <= last) {
        const monthName = current.toLocaleString('default', { month: 'short', year: '2-digit' });

        const monthPatients = patients.filter(p => {
          const admissionDate = new Date(p.admissionDate);
          return admissionDate.getFullYear() === current.getFullYear() &&
            admissionDate.getMonth() === current.getMonth();
        });

        months.push({
          month: monthName,
          admissions: monthPatients.length,
          discharged: monthPatients.filter(p => p.outcome === 'Discharged').length,
          referred: monthPatients.filter(p => p.outcome === 'Referred').length,
          deaths: monthPatients.filter(p => p.outcome === 'Deceased').length,
          inProgress: monthPatients.filter(p => p.outcome === 'In Progress').length
        });

        current.setMonth(current.getMonth() + 1);
      }

      return months;
    }

    const monthCount = timeRange === '3months' ? 2 : timeRange === '6months' ? 5 : timeRange === '12months' ? 11 : 11;

    for (let i = monthCount; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = date.toLocaleString('default', { month: 'short', year: '2-digit' });

      const monthPatients = patients.filter(p => {
        const admissionDate = new Date(p.admissionDate);
        return admissionDate.getFullYear() === date.getFullYear() &&
          admissionDate.getMonth() === date.getMonth();
      });

      months.push({
        month: monthName,
        admissions: monthPatients.length,
        discharged: monthPatients.filter(p => p.outcome === 'Discharged').length,
        referred: monthPatients.filter(p => p.outcome === 'Referred').length,
        deaths: monthPatients.filter(p => p.outcome === 'Deceased').length,
        inProgress: monthPatients.filter(p => p.outcome === 'In Progress').length
      });
    }

    return months;
  }, [patients, timeRange, customStartDate, customEndDate]);

  // Day-wise data for short ranges
  const dayWiseData = useMemo(() => {
    const days = [];
    const now = new Date();

    if (timeRange === 'custom' && customStartDate && customEndDate) {
      const startDate = new Date(customStartDate);
      const endDate = new Date(customEndDate);
      const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      // Only use daily data if range is 60 days or less
      if (daysDiff <= 60) {
        for (let i = 0; i <= daysDiff; i++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + i);
          date.setHours(0, 0, 0, 0);

          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);

          const dayPatients = patients.filter(p => {
            const admissionDate = new Date(p.admissionDate);
            return admissionDate >= date && admissionDate < nextDate;
          });

          days.push({
            day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            admissions: dayPatients.length,
            discharged: dayPatients.filter(p => p.outcome === 'Discharged').length,
            deaths: dayPatients.filter(p => p.outcome === 'Deceased').length
          });
        }

        return days;
      }

      return [];
    }

    const dayCount = timeRange === '7days' ? 6 : timeRange === '30days' ? 29 : 0;

    if (dayCount === 0) return [];

    for (let i = dayCount; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayPatients = patients.filter(p => {
        const admissionDate = new Date(p.admissionDate);
        return admissionDate >= date && admissionDate < nextDate;
      });

      days.push({
        day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        admissions: dayPatients.length,
        discharged: dayPatients.filter(p => p.outcome === 'Discharged').length,
        deaths: dayPatients.filter(p => p.outcome === 'Deceased').length
      });
    }

    return days;
  }, [patients, timeRange, customStartDate, customEndDate]);

  // Year-wise data for all-time view
  const yearWiseData = useMemo(() => {
    if (timeRange !== 'all') return [];

    const years = new Map<number, { admissions: number; discharged: number; referred: number; deaths: number }>();

    patients.forEach(p => {
      const year = new Date(p.admissionDate).getFullYear();
      if (!years.has(year)) {
        years.set(year, { admissions: 0, discharged: 0, referred: 0, deaths: 0 });
      }
      const yearData = years.get(year)!;
      yearData.admissions++;
      if (p.outcome === 'Discharged') yearData.discharged++;
      if (p.outcome === 'Referred') yearData.referred++;
      if (p.outcome === 'Deceased') yearData.deaths++;
    });

    return Array.from(years.entries())
      .map(([year, data]) => ({ year: year.toString(), ...data }))
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));
  }, [patients, timeRange]);

  // Diagnosis Distribution
  const diagnosisData = useMemo(() => {
    const diagnosisCounts: { [key: string]: number } = {};
    patients.forEach(p => {
      const diagnosis = p.diagnosis || 'Unknown';
      diagnosisCounts[diagnosis] = (diagnosisCounts[diagnosis] || 0) + 1;
    });

    return Object.entries(diagnosisCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [patients]);

  // Length of Stay Histogram
  const lengthOfStayData = useMemo(() => {
    const ranges = [
      { range: '0-3 Days', count: 0 },
      { range: '4-7 Days', count: 0 },
      { range: '8-14 Days', count: 0 },
      { range: '15-30 Days', count: 0 },
      { range: '30+ Days', count: 0 },
    ];

    patients.forEach(p => {
      const start = new Date(p.admissionDate);
      const end = p.releaseDate ? new Date(p.releaseDate) : new Date();
      const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (days <= 3) ranges[0].count++;
      else if (days <= 7) ranges[1].count++;
      else if (days <= 14) ranges[2].count++;
      else if (days <= 30) ranges[3].count++;
      else ranges[4].count++;
    });

    return ranges;
  }, [patients]);

  const chartData = useMemo(() => {
    if (timeRange === 'custom' && customStartDate && customEndDate) {
      const startDate = new Date(customStartDate);
      const endDate = new Date(customEndDate);
      const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      // Use daily data if 60 days or less, otherwise monthly
      return daysDiff <= 60 ? dayWiseData : monthWiseData;
    }

    return timeRange === '7days' || timeRange === '30days' ? dayWiseData : timeRange === 'all' ? yearWiseData : monthWiseData;
  }, [timeRange, dayWiseData, yearWiseData, monthWiseData, customStartDate, customEndDate]);

  const xAxisKey = useMemo(() => {
    if (timeRange === 'custom' && customStartDate && customEndDate) {
      const startDate = new Date(customStartDate);
      const endDate = new Date(customEndDate);
      const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      return daysDiff <= 60 ? 'day' : 'month';
    }

    return timeRange === 'all' ? 'year' : timeRange === '7days' || timeRange === '30days' ? 'day' : 'month';
  }, [timeRange, customStartDate, customEndDate]);

  return (
    <div className="space-y-6">
      {/* Time Range Filter */}
      <div className="bg-gradient-to-r from-sky-50 to-blue-50 border-2 border-sky-200 rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-bold text-sky-900">Time-Based Analytics</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {timeRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => handleTimeRangeClick(range.value)}
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

          {/* Month/Year Selector Button */}
          <button
            onClick={handleMonthYearToggle}
            className={`
              px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2
              ${showMonthYearPicker
                ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg scale-105'
                : 'bg-white text-sky-700 border-2 border-sky-200 hover:border-sky-400 hover:shadow-md'
              }
            `}
          >
            <span>📆</span>
            <span>Select Month</span>
          </button>

          {/* Custom Range Button */}
          <button
            onClick={() => handleTimeRangeClick('custom')}
            className={`
              px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2
              ${showCustomRange
                ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg scale-105'
                : 'bg-white text-sky-700 border-2 border-sky-200 hover:border-sky-400 hover:shadow-md'
              }
            `}
          >
            <span>🎯</span>
            <span>Custom Range</span>
          </button>
        </div>

        {/* Month/Year Picker */}
        {showMonthYearPicker && (
          <div className="mt-4 bg-white border-2 border-sky-300 rounded-xl p-6 space-y-4 animate-slideDown shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h4 className="font-bold text-sky-900 text-lg">Select Month & Year</h4>
            </div>

            <div className="space-y-4">
              {/* Year Selector */}
              <div>
                <label className="text-sm font-bold text-sky-700 mb-2 block">Year</label>
                <div className="grid grid-cols-5 gap-2">
                  {years.map(year => (
                    <button
                      key={year}
                      onClick={() => setSelectedYear(year)}
                      className={`
                        px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200
                        ${selectedYear === year
                          ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-md scale-105'
                          : 'bg-sky-50 text-sky-700 border-2 border-sky-200 hover:border-sky-400 hover:shadow-sm'
                        }
                      `}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>

              {/* Month Selector */}
              <div>
                <label className="text-sm font-bold text-sky-700 mb-2 block">Month</label>
                <div className="grid grid-cols-4 gap-2">
                  {months.map((month, index) => (
                    <button
                      key={month}
                      onClick={() => setSelectedMonth(index)}
                      className={`
                        px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-200
                        ${selectedMonth === index
                          ? 'bg-gradient-to-r from-blue-500 to-sky-500 text-white shadow-md scale-105'
                          : 'bg-sky-50 text-sky-700 border-2 border-sky-200 hover:border-sky-400 hover:shadow-sm'
                        }
                      `}
                    >
                      {month.substring(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Display */}
              <div className="bg-gradient-to-r from-sky-50 to-blue-50 border-2 border-sky-200 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-xs text-sky-600 font-semibold mb-1">Selected Period</div>
                  <div className="text-xl font-bold text-sky-900">
                    {months[selectedMonth]} {selectedYear}
                  </div>
                </div>
              </div>

              {/* Apply Button */}
              <button
                onClick={handleMonthYearApply}
                className="w-full bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white font-bold py-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Apply Selection
              </button>
            </div>
          </div>
        )}

        {/* Custom Date Range Picker */}
        {showCustomRange && (
          <div className="mt-4 bg-white border-2 border-sky-300 rounded-xl p-4 space-y-3 animate-slideDown">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h4 className="font-bold text-sky-900">Custom Date Range</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-sky-700 mb-1 block">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-sky-200 rounded-lg focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-sky-700 mb-1 block">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  min={customStartDate}
                  className="w-full px-3 py-2 border-2 border-sky-200 rounded-lg focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none"
                />
              </div>
            </div>
            <button
              onClick={handleCustomApply}
              disabled={!customStartDate || !customEndDate}
              className="w-full bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white font-bold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              Apply Custom Range
            </button>
          </div>
        )}
      </div>

      {/* Main Trend Chart */}
      <div className="bg-white rounded-xl shadow-xl border-2 border-sky-200 p-6 transition-all duration-200 hover:shadow-2xl">
        <h3 className="text-xl font-bold text-sky-900 mb-4 flex items-center gap-2">
          <span className="text-2xl">📈</span>
          {timeRange === 'all' ? 'Year-wise Trends' : timeRange === '7days' || timeRange === '30days' ? 'Daily Trends' : 'Monthly Trends'}
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Admissions Trend */}
          <div className="bg-gradient-to-br from-sky-50 to-blue-50 p-4 rounded-lg border border-sky-200">
            <h4 className="text-base font-semibold text-sky-800 mb-3">Admissions Trend</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                <XAxis dataKey={xAxisKey} stroke="#0369a1" tick={{ fontSize: 11, fill: '#0369a1' }} angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="#0369a1" tick={{ fontSize: 11, fill: '#0369a1' }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '2px solid #0ea5e9', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="admissions" name="Admissions" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 5, fill: '#0ea5e9' }} activeDot={{ r: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Outcomes Breakdown */}
          <div className="bg-gradient-to-br from-sky-50 to-blue-50 p-4 rounded-lg border border-sky-200">
            <h4 className="text-base font-semibold text-sky-800 mb-3">Outcomes Breakdown</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                <XAxis dataKey={xAxisKey} stroke="#0369a1" tick={{ fontSize: 11, fill: '#0369a1' }} angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="#0369a1" tick={{ fontSize: 11, fill: '#0369a1' }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '2px solid #0ea5e9', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="discharged" name="Discharged" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="referred" name="Referred" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="deaths" name="Deaths" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Diagnosis & Length of Stay */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Diagnoses */}
        <div className="bg-white rounded-xl shadow-xl border-2 border-sky-200 p-6 transition-all duration-200 hover:shadow-2xl">
          <h3 className="text-xl font-bold text-sky-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">🦠</span> Top 5 Diagnoses
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diagnosisData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" horizontal={false} />
                <XAxis type="number" stroke="#0369a1" tick={{ fontSize: 11, fill: '#0369a1' }} />
                <YAxis dataKey="name" type="category" stroke="#0369a1" tick={{ fontSize: 11, fill: '#0369a1' }} width={150} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '2px solid #0ea5e9', borderRadius: '8px' }} />
                <Bar dataKey="count" name="Patients" fill="#8b5cf6" radius={[0, 8, 8, 0]} barSize={25} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Length of Stay */}
        <div className="bg-white rounded-xl shadow-xl border-2 border-sky-200 p-6 transition-all duration-200 hover:shadow-2xl">
          <h3 className="text-xl font-bold text-sky-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">⏱️</span> Length of Stay Distribution
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lengthOfStayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
                <XAxis dataKey="range" stroke="#0369a1" tick={{ fontSize: 11, fill: '#0369a1' }} />
                <YAxis stroke="#0369a1" tick={{ fontSize: 11, fill: '#0369a1' }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '2px solid #0ea5e9', borderRadius: '8px' }} />
                <Bar dataKey="count" name="Patients" fill="#f43f5e" radius={[8, 8, 0, 0]} barSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeBasedAnalytics;
