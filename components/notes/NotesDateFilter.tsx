import React from 'react';
import { haptics } from '../../utils/haptics';

export interface DateFilterState {
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

interface NotesDateFilterProps {
  dateFilter: DateFilterState;
  totalNotes: number;
  filteredCount: number;
  onFilterChange: (filter: DateFilterState) => void;
  className?: string;
}

const NotesDateFilter: React.FC<NotesDateFilterProps> = ({
  dateFilter,
  totalNotes,
  filteredCount,
  onFilterChange,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleQuickFilter = (days: number | null) => {
    haptics.tap();
    if (days === null) {
      // Clear filter
      onFilterChange({ startDate: null, endDate: null, isActive: false });
    } else {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      onFilterChange({
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        isActive: true,
      });
    }
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    onFilterChange({
      ...dateFilter,
      [type === 'start' ? 'startDate' : 'endDate']: value || null,
      isActive: !!(dateFilter.startDate || dateFilter.endDate || value),
    });
  };

  const handleClear = () => {
    haptics.tap();
    onFilterChange({ startDate: null, endDate: null, isActive: false });
  };

  return (
    <div className={`bg-slate-50 border border-slate-200 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => {
          haptics.tap();
          setIsExpanded(!isExpanded);
        }}
        className="w-full flex items-center justify-between p-3 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="text-sm font-semibold text-slate-700">Date Filter</span>
          {dateFilter.isActive && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
              {filteredCount} of {totalNotes}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dateFilter.isActive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="text-xs text-red-600 hover:text-red-700 font-semibold px-2 py-1 hover:bg-red-50 rounded transition-colors"
            >
              Clear
            </button>
          )}
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-3 border-t border-slate-200 space-y-3">
          {/* Quick Filters */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Quick Filters</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleQuickFilter(7)}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-xs font-medium text-slate-700 rounded-lg transition-colors"
              >
                Last 7 Days
              </button>
              <button
                onClick={() => handleQuickFilter(30)}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-xs font-medium text-slate-700 rounded-lg transition-colors"
              >
                Last 30 Days
              </button>
              <button
                onClick={() => handleQuickFilter(null)}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-xs font-medium text-slate-700 rounded-lg transition-colors"
              >
                All Time
              </button>
            </div>
          </div>

          {/* Custom Date Range */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Custom Range</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">From</label>
                <input
                  type="date"
                  value={dateFilter.startDate || ''}
                  onChange={(e) => handleDateChange('start', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">To</label>
                <input
                  type="date"
                  value={dateFilter.endDate || ''}
                  onChange={(e) => handleDateChange('end', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesDateFilter;
