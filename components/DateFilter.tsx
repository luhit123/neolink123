import React, { useState, useEffect, useMemo } from 'react';

type Period = string; // Support for 'All Time', 'Today', 'YYYY-MM', 'Custom', etc.
export type DateFilterValue = {
  period: Period;
  startDate?: string;
  endDate?: string;
};

interface DateFilterProps {
  onFilterChange: (filter: DateFilterValue) => void;
}

const DateFilter: React.FC<DateFilterProps> = ({ onFilterChange }) => {
  const [period, setPeriod] = useState<Period>('All Time');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filterOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [
      { value: 'All Time', label: 'All Time' },
      { value: 'Today', label: 'Today' },
      { value: 'This Week', label: 'This Week' },
      { value: 'This Month', label: 'This Month (Current)' },
    ];

    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      options.push({
        value: `${year}-${month}`,
        label: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
      });
    }

    options.push({ value: 'Custom', label: 'Custom' });
    return options;
  }, []);


  useEffect(() => {
    if (period !== 'Custom') {
      onFilterChange({ period });
      setStartDate('');
      setEndDate('');
    } else {
      // For custom, only trigger update if both dates are set
      if (startDate && endDate) {
        onFilterChange({ period: 'Custom', startDate, endDate });
      } else {
        // If one date is cleared, we might want to stop filtering
        onFilterChange({ period: 'Custom', startDate: undefined, endDate: undefined });
      }
    }
  }, [period, startDate, endDate, onFilterChange]);

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPeriod(e.target.value as Period);
  };
  
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value;
    setStartDate(newStartDate);
    // If end date is before new start date, clear it
    if (endDate && new Date(newStartDate) > new Date(endDate)) {
      setEndDate('');
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndDate(e.target.value);
  };

  return (
    <div className="bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <label htmlFor="date-filter" className="text-md font-semibold text-slate-300 whitespace-nowrap">
          Filter by Admission Date:
        </label>
        <select
          id="date-filter"
          value={period}
          onChange={handlePeriodChange}
          className="form-input w-full sm:w-auto"
        >
          {filterOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        {period === 'Custom' && (
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <input
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
              className="form-input"
              aria-label="Start Date"
            />
            <span className="text-slate-400 hidden sm:inline">to</span>
            <input
              type="date"
              value={endDate}
              onChange={handleEndDateChange}
              min={startDate}
              className="form-input"
              aria-label="End Date"
              disabled={!startDate}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DateFilter;