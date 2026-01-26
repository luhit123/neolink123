import React, { useState } from 'react';
import { Patient } from '../types';
import { generateHandoffNote, generateRoundingSheet } from '../services/openaiService';

interface SmartHandoffProps {
  patients: Patient[];
  unit: string;
  onClose: () => void;
}

const SmartHandoff: React.FC<SmartHandoffProps> = ({ patients, unit, onClose }) => {
  const [shiftType, setShiftType] = useState<'day' | 'night'>('day');
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(new Set());
  const [generatedHandoffs, setGeneratedHandoffs] = useState<Record<string, string>>({});
  const [roundingSheet, setRoundingSheet] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'individual' | 'rounding'>('individual');

  const activePatients = patients.filter(p => p.outcome === 'In Progress');

  const togglePatientSelection = (patientId: string) => {
    const newSelected = new Set(selectedPatients);
    if (newSelected.has(patientId)) {
      newSelected.delete(patientId);
    } else {
      newSelected.add(patientId);
    }
    setSelectedPatients(newSelected);
  };

  const selectAll = () => {
    setSelectedPatients(new Set(activePatients.map(p => p.id)));
  };

  const clearAll = () => {
    setSelectedPatients(new Set());
  };

  const generateIndividualHandoffs = async () => {
    setLoading(true);
    const handoffs: Record<string, string> = {};

    const patientsToProcess = activePatients.filter(p => selectedPatients.has(p.id));

    for (const patient of patientsToProcess) {
      try {
        const handoff = await generateHandoffNote(patient, shiftType);
        handoffs[patient.id] = handoff;
        setGeneratedHandoffs({ ...handoffs });
        // Small delay between requests
        if (patientsToProcess.indexOf(patient) < patientsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      } catch (error) {
        handoffs[patient.id] = 'Failed to generate handoff. Please try again.';
      }
    }

    setGeneratedHandoffs(handoffs);
    setLoading(false);
  };

  const generateRoundingList = async () => {
    setLoading(true);
    try {
      const sheet = await generateRoundingSheet(activePatients, unit);
      setRoundingSheet(sheet);
    } catch (error) {
      setRoundingSheet('Failed to generate rounding sheet. Please try again.');
    }
    setLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const copyAllHandoffs = () => {
    const allHandoffs = Object.entries(generatedHandoffs)
      .map(([patientId, handoff]) => {
        const patient = activePatients.find(p => p.id === patientId);
        return `=== ${patient?.name} ===\n${handoff}\n\n`;
      })
      .join('\n');

    copyToClipboard(allHandoffs);
  };

  const printHandoffs = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl border border-sky-500/30 my-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-900/50 to-blue-900/50 p-3 sm:p-4 border-b border-sky-500/20 flex justify-between items-center">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">📝</span>
              Smart Handoff Generator - {unit}
            </h2>
            <p className="text-xs sm:text-sm text-sky-300 mt-1">
              AI-powered SBAR handoff notes for {activePatients.length} active patients
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* View Selector */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView('individual')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium transition-colors text-sm min-h-[44px] ${
                activeView === 'individual'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Individual Handoffs
            </button>
            <button
              onClick={() => setActiveView('rounding')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium transition-colors text-sm min-h-[44px] ${
                activeView === 'rounding'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Rounding Sheet
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
          {activeView === 'individual' ? (
            <>
              {/* Shift Type & Controls */}
              <div className="mb-4 sm:mb-6 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Shift Type</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShiftType('day')}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors text-sm min-h-[44px] ${
                          shiftType === 'day'
                            ? 'bg-yellow-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        ☀️ Day Shift
                      </button>
                      <button
                        onClick={() => setShiftType('night')}
                        className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors text-sm min-h-[44px] ${
                          shiftType === 'night'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        🌙 Night Shift
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="px-3 sm:px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm min-h-[44px]"
                    >
                      Select All
                    </button>
                    <button
                      onClick={clearAll}
                      className="px-3 sm:px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm min-h-[44px]"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <button
                  onClick={generateIndividualHandoffs}
                  disabled={selectedPatients.size === 0 || loading}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors text-sm sm:text-base min-h-[48px]"
                >
                  {loading
                    ? 'Generating Handoffs...'
                    : `Generate Handoffs for ${selectedPatients.size} Patient${selectedPatients.size !== 1 ? 's' : ''}`}
                </button>
              </div>

              {/* Patient Selection List */}
              <div className="space-y-2 mb-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Select Patients:</h3>
                {activePatients.map(patient => (
                  <label
                    key={patient.id}
                    className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-sky-500/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPatients.has(patient.id)}
                      onChange={() => togglePatientSelection(patient.id)}
                      className="w-5 h-5 rounded border-slate-600 text-sky-600 focus:ring-blue-400"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white text-sm sm:text-base truncate">{patient.name}</div>
                      <div className="text-xs sm:text-sm text-slate-400 truncate">
                        {patient.age} {patient.ageUnit} • {patient.diagnosis}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Generated Handoffs */}
              {Object.keys(generatedHandoffs).length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <button
                      onClick={copyAllHandoffs}
                      className="flex-1 sm:flex-none px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm min-h-[44px]"
                    >
                      📋 Copy All
                    </button>
                    <button
                      onClick={printHandoffs}
                      className="flex-1 sm:flex-none px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm min-h-[44px]"
                    >
                      🖨️ Print
                    </button>
                  </div>

                  {Object.entries(generatedHandoffs).map(([patientId, handoff]) => {
                    const patient = activePatients.find(p => p.id === patientId);
                    return (
                      <div key={patientId} className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-bold text-sky-400 text-sm sm:text-base">{patient?.name}</h4>
                          <button
                            onClick={() => copyToClipboard(handoff)}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium transition-colors min-h-[36px]"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="prose prose-invert prose-sm sm:prose-base max-w-none">
                          <div className="whitespace-pre-line text-slate-300 text-sm sm:text-base leading-relaxed">
                            {handoff}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Rounding Sheet View */}
              <div className="space-y-4">
                <button
                  onClick={generateRoundingList}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors text-sm sm:text-base min-h-[48px]"
                >
                  {loading ? 'Generating Rounding Sheet...' : 'Generate Prioritized Rounding List'}
                </button>

                {roundingSheet && (
                  <div>
                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                      <button
                        onClick={() => copyToClipboard(roundingSheet)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm min-h-[44px]"
                      >
                        📋 Copy
                      </button>
                      <button
                        onClick={printHandoffs}
                        className="flex-1 sm:flex-none px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm min-h-[44px]"
                      >
                        🖨️ Print
                      </button>
                    </div>

                    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
                      <h3 className="font-bold text-sky-400 mb-3 text-sm sm:text-base">Prioritized Rounding List</h3>
                      <div className="prose prose-invert prose-sm sm:prose-base max-w-none">
                        <div className="whitespace-pre-line text-slate-300 text-sm sm:text-base leading-relaxed">
                          {roundingSheet}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 p-3 bg-slate-800/50">
          <p className="text-xs text-slate-400 italic text-center">
            ⚠️ AI-generated handoff notes should be reviewed and verified by clinical staff before use.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SmartHandoff;
