import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Patient, Unit } from '../../../types';
import AnalyticsCard from '../AnalyticsCard';
import { haptics } from '../../../utils/haptics';

interface CaseListCardProps {
  deceasedPatients: Patient[];
  onPatientSelect: (patient: Patient) => void;
}

type FilterType = 'all' | 'nicu' | 'picu' | 'sncu';

const CaseListCard: React.FC<CaseListCardProps> = ({
  deceasedPatients,
  onPatientSelect
}) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter patients
  const filteredPatients = useMemo(() => {
    let filtered = [...deceasedPatients];

    // Apply unit filter
    if (filter !== 'all') {
      const unitMap: Record<FilterType, Unit | null> = {
        all: null,
        nicu: Unit.NICU,
        picu: Unit.PICU,
        sncu: Unit.SNCU
      };
      const targetUnit = unitMap[filter];
      if (targetUnit) {
        filtered = filtered.filter(p => p.unit === targetUnit);
      }
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.aiInterpretedDeathDiagnosis?.toLowerCase().includes(query) ||
        p.diagnosisAtDeath?.toLowerCase().includes(query)
      );
    }

    // Sort by date (most recent first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.dateOfDeath || a.releaseDate || a.admissionDate);
      const dateB = new Date(b.dateOfDeath || b.releaseDate || b.admissionDate);
      return dateB.getTime() - dateA.getTime();
    });

    return filtered;
  }, [deceasedPatients, filter, searchQuery]);

  const getStatusColor = (patient: Patient) => {
    if (patient.aiInterpretedDeathDiagnosis) return 'bg-emerald-500';
    if (patient.diagnosisAtDeath) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getUnitBadge = (unit: Unit) => {
    const badges: Record<string, string> = {
      [Unit.NICU]: 'bg-blue-100 text-blue-700',
      [Unit.PICU]: 'bg-purple-100 text-purple-700',
      [Unit.SNCU]: 'bg-cyan-100 text-cyan-700',
      [Unit.HDU]: 'bg-amber-100 text-amber-700',
      [Unit.GENERAL_WARD]: 'bg-slate-100 text-slate-700'
    };
    const shortNames: Record<string, string> = {
      [Unit.NICU]: 'NICU',
      [Unit.PICU]: 'PICU',
      [Unit.SNCU]: 'SNCU',
      [Unit.HDU]: 'HDU',
      [Unit.GENERAL_WARD]: 'GW'
    };
    return { className: badges[unit] || badges[Unit.GENERAL_WARD], name: shortNames[unit] || 'GW' };
  };

  return (
    <AnalyticsCard
      title="Recent Cases"
      subtitle={`${filteredPatients.length} deceased patients`}
      headerGradient="from-rose-500 to-pink-600"
      icon={
        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      }
    >
      {/* Search Bar */}
      <div className="relative mb-3">
        <input
          type="text"
          placeholder="Search patients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2.5 pl-10 bg-slate-100 rounded-xl text-sm border-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
        />
        <svg
          className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[
          { id: 'all' as FilterType, label: 'All' },
          { id: 'nicu' as FilterType, label: 'NICU' },
          { id: 'picu' as FilterType, label: 'PICU' },
          { id: 'sncu' as FilterType, label: 'SNCU' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => {
              haptics.selection();
              setFilter(f.id);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filter === f.id
                ? 'bg-rose-600 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Patient List */}
      <div className="space-y-2 overflow-y-auto max-h-[calc(100%-120px)]">
        <AnimatePresence>
          {filteredPatients.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-slate-500"
            >
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-medium">No patients found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </motion.div>
          ) : (
            filteredPatients.slice(0, 20).map((patient, index) => {
              const badge = getUnitBadge(patient.unit);
              const deathDate = patient.dateOfDeath
                ? new Date(patient.dateOfDeath)
                : new Date(patient.releaseDate || patient.admissionDate);

              return (
                <motion.button
                  key={patient.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => onPatientSelect(patient)}
                  className="w-full bg-white rounded-xl p-3 border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 active:scale-[0.98] transition-all text-left"
                >
                  <div className="flex items-start gap-3">
                    {/* Status Indicator */}
                    <div className={`w-2 h-2 rounded-full mt-2 ${getStatusColor(patient)}`} />

                    {/* Patient Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-semibold text-slate-800 truncate">{patient.name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                          {badge.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                        <span>{patient.age} {patient.ageUnit}</span>
                        <span>•</span>
                        <span>{patient.gender}</span>
                        <span>•</span>
                        <span>{deathDate.toLocaleDateString()}</span>
                      </div>

                      {/* Diagnosis Preview */}
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {(patient.aiInterpretedDeathDiagnosis || patient.diagnosisAtDeath || 'No diagnosis recorded').replace(/^(Primary\s*Cause\s*[:\-]\s*)/i, '')}
                      </p>
                    </div>

                    {/* Arrow */}
                    <svg className="w-5 h-5 text-slate-400 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </motion.button>
              );
            })
          )}
        </AnimatePresence>

        {filteredPatients.length > 20 && (
          <p className="text-center text-xs text-slate-500 py-2">
            Showing 20 of {filteredPatients.length} patients
          </p>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-slate-500">AI</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs text-slate-500">Manual</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-xs text-slate-500">Missing</span>
        </div>
      </div>
    </AnalyticsCard>
  );
};

export default CaseListCard;
