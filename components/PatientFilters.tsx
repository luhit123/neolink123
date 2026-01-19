import React from 'react';

export type OutcomeFilter = 'All' | 'Admission' | 'In Progress' | 'Discharged' | 'Referred' | 'Deceased' | 'Step Down';

interface PatientFiltersProps {
  selectedOutcome: OutcomeFilter;
  onOutcomeChange: (outcome: OutcomeFilter) => void;
  counts: {
    all: number;
    admission: number;
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
      color: 'text-slate-600',
      bgColor: 'bg-slate-100 hover:bg-slate-200'
    },
    {
      label: 'Admission',
      count: counts.admission,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50 hover:bg-cyan-100'
    },
    {
      label: 'In Progress',
      count: counts.inProgress,
      icon: <div className="w-5 h-5 rounded-full border-2 border-current animate-pulse" />,
      color: 'text-medical-blue',
      bgColor: 'bg-blue-50 hover:bg-blue-100'
    },
    {
      label: 'Discharged',
      count: counts.discharged,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-medical-green',
      bgColor: 'bg-emerald-50 hover:bg-emerald-100'
    },
    {
      label: 'Step Down',
      count: counts.stepDown,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      ),
      color: 'text-medical-teal',
      bgColor: 'bg-teal-50 hover:bg-teal-100'
    },
    {
      label: 'Referred',
      count: counts.referred,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      ),
      color: 'text-medical-orange',
      bgColor: 'bg-orange-50 hover:bg-orange-100'
    },
    {
      label: 'Deceased',
      count: counts.deceased,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-medical-red',
      bgColor: 'bg-red-50 hover:bg-red-100'
    }
  ];

  return (
    <div className="bg-white backdrop-blur-sm rounded-xl p-4 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-5 h-5 text-medical-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <h3 className="text-sm font-semibold text-slate-700">Filter by Status</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {filters.map(({ label, count, icon, color, bgColor }) => (
          <button
            key={label}
            onClick={() => onOutcomeChange(label)}
            className={`
              relative p-3 rounded-lg border-2 transition-all duration-200
              ${selectedOutcome === label
                ? `${bgColor} border-current ${color} shadow-md`
                : `bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-100`
              }
            `}
          >
            <div className="flex flex-col items-center gap-1">
              <div className={selectedOutcome === label ? color : 'text-slate-500'}>
                {icon}
              </div>
              <span className="text-xs font-medium truncate w-full text-center">
                {label}
              </span>
              <span className={`text-lg font-bold ${selectedOutcome === label ? color : 'text-slate-700'}`}>
                {count}
              </span>
            </div>

            {selectedOutcome === label && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-medical-teal rounded-full animate-pulse" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PatientFilters;
