import React, { useState, useEffect, useMemo } from 'react';

type Period = string;
export type DateFilterValue = {
  period: Period;
  startDate?: string;
  endDate?: string;
};

interface DateFilterProps {
  onFilterChange: (filter: DateFilterValue) => void;
}

const DateFilter: React.FC<DateFilterProps> = ({ onFilterChange }) => {
  const [period, setPeriod] = useState<Period>('Today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filterOptions = useMemo(() => {
    return [
      { value: 'Today', label: 'Today' },
      { value: 'This Week', label: 'Week' },
      { value: 'This Month', label: 'Month' },
      { value: 'All Time', label: 'All' },
      { value: 'Custom', label: 'Custom' },
    ];
  }, []);

  useEffect(() => {
    if (period !== 'Custom') {
      onFilterChange({ period });
      setStartDate('');
      setEndDate('');
    } else {
      if (startDate && endDate) {
        onFilterChange({ period: 'Custom', startDate, endDate });
      } else {
        onFilterChange({ period: 'Custom', startDate: undefined, endDate: undefined });
      }
    }
  }, [period, startDate, endDate, onFilterChange]);

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
        <span className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">📅</span>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="bg-transparent border-0 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold focus:ring-0 cursor-pointer"
        >
          {filterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {period === 'Custom' && (
        <div className="flex flex-col sm:flex-row items-stretch gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-700 rounded-lg px-2 py-1.5">
            <span className="text-slate-600 dark:text-slate-300 text-[10px] sm:text-xs font-semibold">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 text-slate-900 dark:text-white text-xs sm:text-sm font-medium rounded px-1.5 py-0.5 w-[100px] sm:w-[130px]"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-700 rounded-lg px-2 py-1.5">
            <span className="text-slate-600 dark:text-slate-300 text-[10px] sm:text-xs font-semibold">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="bg-white dark:bg-slate-600 border border-slate-300 dark:border-slate-500 text-slate-900 dark:text-white text-xs sm:text-sm font-medium rounded px-1.5 py-0.5 w-[100px] sm:w-[130px]"
              disabled={!startDate}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DateFilter;