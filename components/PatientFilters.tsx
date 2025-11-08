import React from 'react';

export type OutcomeFilter = 'All' | 'In Progress' | 'Discharged' | 'Referred' | 'Deceased' | 'Step Down';

interface PatientFiltersProps {
  selectedOutcome: OutcomeFilter;
  onOutcomeChange: (outcome: OutcomeFilter) => void;
  counts: {
    all: number;
    inProgress: number;
    discharged: number;
    referred: number;
    deceased: number;
    stepDown: number;
  };
}

const PatientFilters: React.FC<PatientFiltersProps> = ({ selectedOutcome, onOutcomeChange, counts }) => {
  const filters: { label: OutcomeFilter; count: number; icon: React.ReactNode; color: string; bgColor: string }[] = [
    {
      label: 'All',
      count: counts.all,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      ),
      color: 'text-slate-300',
      bgColor: 'bg-slate-700/50 hover:bg-slate-700'
    },
    {
      label: 'In Progress',
      count: counts.inProgress,
      icon: <div className="w-5 h-5 rounded-full border-2 border-current animate-pulse" />,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10 hover:bg-blue-500/20'
    },
    {
      label: 'Discharged',
      count: counts.discharged,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-green-400',
      bgColor: 'bg-green-500/10 hover:bg-green-500/20'
    },
    {
      label: 'Step Down',
      count: counts.stepDown,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      ),
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10 hover:bg-cyan-500/20'
    },
    {
      label: 'Referred',
      count: counts.referred,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      ),
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10 hover:bg-yellow-500/20'
    },
    {
      label: 'Deceased',
      count: counts.deceased,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-red-400',
      bgColor: 'bg-red-500/10 hover:bg-red-500/20'
    }
  ];

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <h3 className="text-sm font-semibold text-slate-300">Filter by Status</h3>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {filters.map(({ label, count, icon, color, bgColor }) => (
          <button
            key={label}
            onClick={() => onOutcomeChange(label)}
            className={`
              relative p-3 rounded-lg border-2 transition-all duration-200
              ${selectedOutcome === label
                ? `${bgColor} border-current ${color} shadow-lg`
                : `bg-slate-700/30 border-slate-600/50 text-slate-400 hover:border-slate-500`
              }
            `}
          >
            <div className="flex flex-col items-center gap-1">
              <div className={selectedOutcome === label ? color : 'text-slate-400'}>
                {icon}
              </div>
              <span className="text-xs font-medium truncate w-full text-center">
                {label}
              </span>
              <span className={`text-lg font-bold ${selectedOutcome === label ? color : 'text-slate-300'}`}>
                {count}
              </span>
            </div>
            
            {selectedOutcome === label && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full animate-pulse" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PatientFilters;
