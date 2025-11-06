import React, { useMemo, useState } from 'react';
import { Patient, Unit, AdmissionType } from '../types';
import { ChevronLeftIcon, BedIcon, HomeIcon, ArrowUpOnSquareIcon } from './common/Icons';
import DateFilter, { DateFilterValue } from './DateFilter';

interface DeathsAnalysisProps {
  patients: Patient[];
  onBack: () => void;
}

const DeathsAnalysis: React.FC<DeathsAnalysisProps> = ({ patients, onBack }) => {
  const [selectedUnit, setSelectedUnit] = useState<'All' | 'NICU' | 'PICU'>('All');
  const [nicuFilter, setNicuFilter] = useState<'All' | 'Inborn' | 'Outborn'>('All');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ period: 'All Time' });

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
    <div className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-300 hover:text-white active:text-white transition-colors p-2 -ml-2">
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">💔</span>
            Deaths Analysis
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">Detailed analysis of deceased patients across all units</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 p-4 sm:p-6 rounded-xl border border-red-500/30">
          <div className="text-xs sm:text-sm text-red-300 font-medium mb-1">Total Deaths</div>
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-red-400">{stats.totalDeaths}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 p-4 sm:p-6 rounded-xl border border-blue-500/30">
          <div className="text-xs sm:text-sm text-blue-300 font-medium mb-1">NICU Deaths</div>
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-400">{stats.nicuDeaths}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 p-4 sm:p-6 rounded-xl border border-purple-500/30">
          <div className="text-xs sm:text-sm text-purple-300 font-medium mb-1">NICU Inborn</div>
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-purple-400">{stats.nicuInbornDeaths}</div>
        </div>
        <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 p-4 sm:p-6 rounded-xl border border-orange-500/30">
          <div className="text-xs sm:text-sm text-orange-300 font-medium mb-1">NICU Outborn</div>
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-orange-400">{stats.nicuOutbornDeaths}</div>
        </div>
        <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 p-4 sm:p-6 rounded-xl border border-cyan-500/30">
          <div className="text-xs sm:text-sm text-cyan-300 font-medium mb-1">PICU Deaths</div>
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-cyan-400">{stats.picuDeaths}</div>
        </div>
      </div>

      {/* Date Filter */}
      <DateFilter onFilterChange={setDateFilter} />

      {/* Filters */}
      <div className="bg-slate-800 p-4 sm:p-6 rounded-xl border border-slate-700">
        <h3 className="text-base sm:text-lg font-bold text-white mb-4">Filter by Unit & Type</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Unit Filter */}
          <div className="flex-1">
            <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">Unit</label>
            <div className="flex bg-slate-700/50 p-1 rounded-lg border border-slate-600">
              {['All', 'NICU', 'PICU'].map(unit => (
                <button
                  key={unit}
                  onClick={() => setSelectedUnit(unit as 'All' | 'NICU' | 'PICU')}
                  className={`flex-1 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all ${
                    selectedUnit === unit
                      ? 'bg-red-500 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-600/50 active:bg-slate-600'
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
              <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">NICU Type</label>
              <div className="flex bg-slate-700/50 p-1 rounded-lg border border-slate-600">
                {['All', 'Inborn', 'Outborn'].map(type => (
                  <button
                    key={type}
                    onClick={() => setNicuFilter(type as 'All' | 'Inborn' | 'Outborn')}
                    className={`flex-1 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all ${
                      nicuFilter === type
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'text-slate-300 hover:bg-slate-600/50 active:bg-slate-600'
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
      <div className="bg-slate-800 p-4 sm:p-6 rounded-xl border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-base sm:text-lg font-bold text-white">
            Deceased Patients ({filteredDeaths.length})
          </h3>
        </div>

        {filteredDeaths.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-lg">No deceased patients found for the selected filters.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDeaths.map(patient => (
              <div
                key={patient.id}
                className="bg-slate-700/30 p-4 sm:p-5 rounded-lg border border-slate-600 hover:border-red-500/50 transition-all"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column */}
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-base sm:text-lg font-bold text-white mb-1">{patient.name}</h4>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-slate-600 text-slate-200 rounded text-xs font-medium">
                          {patient.gender}
                        </span>
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-medium">
                          {getAgeDisplay(patient)}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          patient.unit === Unit.NICU ? 'bg-purple-500/20 text-purple-300' : 'bg-cyan-500/20 text-cyan-300'
                        }`}>
                          {patient.unit === Unit.NICU ? 'NICU' : 'PICU'}
                        </span>
                        {patient.admissionType && (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            patient.admissionType === AdmissionType.Inborn
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'bg-orange-500/20 text-orange-300'
                          }`}>
                            {patient.admissionType}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 mb-1">Diagnosis</p>
                      <p className="text-sm text-slate-200">{patient.diagnosis}</p>
                    </div>

                    {patient.admissionType === AdmissionType.Outborn && patient.referringHospital && (
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Referred From</p>
                        <p className="text-sm text-slate-200">
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
                        <p className="text-xs text-slate-400 mb-1">Admission Date</p>
                        <p className="text-sm text-slate-200">
                          {new Date(patient.admissionDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Death Date</p>
                        <p className="text-sm text-red-300">
                          {patient.releaseDate
                            ? new Date(patient.releaseDate).toLocaleDateString()
                            : 'Not recorded'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Duration of Stay</p>
                        <p className="text-sm text-slate-200">{getAdmissionDuration(patient)} days</p>
                      </div>
                    </div>

                    {patient.progressNotes && patient.progressNotes.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 mb-2">Latest Progress Note</p>
                        <div className="bg-slate-800/50 p-3 rounded border border-slate-600">
                          <p className="text-xs text-slate-300">
                            {patient.progressNotes[patient.progressNotes.length - 1].note}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
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
