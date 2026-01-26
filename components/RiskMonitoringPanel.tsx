import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import { predictRisk } from '../services/openaiService';

interface RiskMonitoringPanelProps {
  patients: Patient[];
  unit: string;
}

interface PatientRisk {
  patient: Patient;
  riskLevel: 'Low' | 'Medium' | 'High';
  justification: string;
  loading: boolean;
}

const RiskMonitoringPanel: React.FC<RiskMonitoringPanelProps> = ({ patients, unit }) => {
  const [patientRisks, setPatientRisks] = useState<PatientRisk[]>([]);
  const [filter, setFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const activePatients = patients.filter(p => p.outcome === 'In Progress');

  useEffect(() => {
    assessAllPatients();
  }, [patients]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      assessAllPatients();
    }, 15 * 60 * 1000); // Refresh every 15 minutes

    return () => clearInterval(interval);
  }, [autoRefresh, patients]);

  const assessAllPatients = async () => {
    const risks: PatientRisk[] = activePatients.map(p => ({
      patient: p,
      riskLevel: 'Medium' as const,
      justification: 'Assessing...',
      loading: true,
    }));

    setPatientRisks(risks);

    // Assess patients in batches to avoid rate limiting
    for (let i = 0; i < activePatients.length; i++) {
      const patient = activePatients[i];
      try {
        const risk = await predictRisk(patient);
        setPatientRisks(prev =>
          prev.map(pr =>
            pr.patient.id === patient.id
              ? { ...pr, ...risk, loading: false }
              : pr
          )
        );
        // Small delay between requests
        if (i < activePatients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        setPatientRisks(prev =>
          prev.map(pr =>
            pr.patient.id === patient.id
              ? { ...pr, loading: false, justification: 'Assessment failed' }
              : pr
          )
        );
      }
    }
  };

  const filteredRisks = patientRisks.filter(pr =>
    filter === 'All' || pr.riskLevel === filter
  );

  const sortedRisks = [...filteredRisks].sort((a, b) => {
    const riskOrder = { High: 3, Medium: 2, Low: 1 };
    return riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
  });

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'High':
        return 'bg-red-500/20 border-red-500 text-red-300';
      case 'Medium':
        return 'bg-orange-500/20 border-orange-500 text-orange-300';
      case 'Low':
        return 'bg-green-500/20 border-green-500 text-green-300';
      default:
        return 'bg-slate-500/20 border-slate-500 text-slate-300';
    }
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'High':
        return 'bg-red-600 text-white';
      case 'Medium':
        return 'bg-orange-600 text-white';
      case 'Low':
        return 'bg-green-600 text-white';
      default:
        return 'bg-slate-600 text-white';
    }
  };

  const stats = {
    high: patientRisks.filter(pr => pr.riskLevel === 'High').length,
    medium: patientRisks.filter(pr => pr.riskLevel === 'Medium').length,
    low: patientRisks.filter(pr => pr.riskLevel === 'Low').length,
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 transition-colors duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            AI Risk Monitoring - {unit}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Real-time risk assessment for {activePatients.length} active patients
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => assessAllPatients()}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-xs sm:text-sm min-h-[40px]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm min-h-[40px] ${
              autoRefresh
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-slate-600 hover:bg-slate-700 text-white'
            }`}
          >
            <span className="hidden sm:inline">{autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}</span>
            <span className="sm:hidden">{autoRefresh ? 'Auto ON' : 'Auto OFF'}</span>
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-red-500/10 border border-red-500/30 p-3 sm:p-4 rounded-lg text-center">
          <div className="text-xl sm:text-3xl font-bold text-red-500">{stats.high}</div>
          <div className="text-xs sm:text-sm text-red-300 mt-1">High Risk</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/30 p-3 sm:p-4 rounded-lg text-center">
          <div className="text-xl sm:text-3xl font-bold text-orange-500">{stats.medium}</div>
          <div className="text-xs sm:text-sm text-orange-300 mt-1">Medium Risk</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/30 p-3 sm:p-4 rounded-lg text-center">
          <div className="text-xl sm:text-3xl font-bold text-green-500">{stats.low}</div>
          <div className="text-xs sm:text-sm text-green-300 mt-1">Low Risk</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {(['All', 'High', 'Medium', 'Low'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm whitespace-nowrap min-h-[40px] ${
              filter === f
                ? 'bg-sky-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {f} {f !== 'All' && `(${f === 'High' ? stats.high : f === 'Medium' ? stats.medium : stats.low})`}
          </button>
        ))}
      </div>

      {/* Patient Risk Cards */}
      <div className="space-y-3">
        {sortedRisks.length === 0 ? (
          <div className="text-center py-8 sm:py-12 text-slate-500">
            {activePatients.length === 0
              ? 'No active patients to monitor'
              : 'No patients match the selected filter'
            }
          </div>
        ) : (
          sortedRisks.map(pr => (
            <div
              key={pr.patient.id}
              className={`p-3 sm:p-4 rounded-lg border-2 transition-all ${getRiskColor(pr.riskLevel)}`}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-2">
                    <h4 className="font-bold text-white text-sm sm:text-base truncate">
                      {pr.patient.name}
                    </h4>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${getRiskBadgeColor(pr.riskLevel)}`}>
                      {pr.riskLevel.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm space-y-1">
                    <p className="text-slate-300">
                      <span className="font-semibold">Age:</span> {pr.patient.age} {pr.patient.ageUnit} •
                      <span className="font-semibold ml-1">Gender:</span> {pr.patient.gender}
                    </p>
                    <p className="text-slate-300">
                      <span className="font-semibold">Diagnosis:</span> {pr.patient.diagnosis}
                    </p>
                    {pr.loading ? (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-500"></div>
                        <span className="text-slate-400 text-xs">Analyzing patient data...</span>
                      </div>
                    ) : (
                      <p className="text-slate-200 mt-2 text-xs sm:text-sm">
                        <span className="font-semibold">AI Assessment:</span> {pr.justification}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Disclaimer */}
      <div className="mt-4 sm:mt-6 p-3 bg-slate-700/30 rounded-lg border border-slate-600">
        <p className="text-xs text-slate-400 italic">
          ⚠️ AI Risk Assessments are assistive tools and should not replace clinical judgment.
          Always verify with current patient status and consult with senior clinicians for critical decisions.
          Auto-refresh occurs every 15 minutes when enabled.
        </p>
      </div>
    </div>
  );
};

export default RiskMonitoringPanel;
