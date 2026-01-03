import React, { useState } from 'react';

export type ChartFilterPeriod = 'Today' | 'This Week' | 'This Month' | 'Last 3 Months' | 'Last 6 Months' | 'This Year' | 'All Time' | 'Custom';

interface ChartFilterProps {
  onFilterChange: (period: ChartFilterPeriod, startDate?: string, endDate?: string) => void;
  currentFilter: ChartFilterPeriod;
}

const ChartFilter: React.FC<ChartFilterProps> = ({ onFilterChange, currentFilter }) => {
  const [showCustom, setShowCustom] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const periods: { value: ChartFilterPeriod; label: string; icon: string }[] = [
    { value: 'Today', label: 'Today', icon: '📅' },
    { value: 'This Week', label: 'This Week', icon: '📆' },
    { value: 'This Month', label: 'This Month', icon: '🗓️' },
    { value: 'Last 3 Months', label: '3 Months', icon: '📊' },
    { value: 'Last 6 Months', label: '6 Months', icon: '📈' },
    { value: 'This Year', label: 'This Year', icon: '🗂️' },
    { value: 'All Time', label: 'All Time', icon: '∞' },
    { value: 'Custom', label: 'Custom', icon: '🎯' },
  ];

  const handlePeriodClick = (period: ChartFilterPeriod) => {
    if (period === 'Custom') {
      setShowCustom(!showCustom);
    } else {
      setShowCustom(false);
      onFilterChange(period);
    }
  };

  const handleCustomApply = () => {
    if (startDate && endDate) {
      onFilterChange('Custom', startDate, endDate);
      setShowCustom(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Quick Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {periods.map((period) => (
          <button
            key={period.value}
            onClick={() => handlePeriodClick(period.value)}
            className={`
              px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2
              ${currentFilter === period.value
                ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg scale-105'
                : 'bg-white text-sky-700 border-2 border-sky-200 hover:border-sky-400 hover:shadow-md'
              }
            `}
          >
            <span>{period.icon}</span>
            <span>{period.label}</span>
          </button>
        ))}
      </div>

      {/* Custom Date Range */}
      {showCustom && (
        <div className="bg-gradient-to-r from-sky-50 to-blue-50 border-2 border-sky-300 rounded-xl p-4 space-y-3 animate-slideDown">
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
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border-2 border-sky-200 rounded-lg focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-sky-700 mb-1 block">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full px-3 py-2 border-2 border-sky-200 rounded-lg focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none"
              />
            </div>
          </div>
          <button
            onClick={handleCustomApply}
            disabled={!startDate || !endDate}
            className="w-full bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white font-bold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            Apply Custom Range
          </button>
        </div>
      )}
    </div>
  );
};

export default ChartFilter;
