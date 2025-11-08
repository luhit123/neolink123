import React, { useState } from 'react';
import { Patient } from '../types';

interface CollapsiblePatientCardProps {
  patient: Patient;
  onEdit: (patient: Patient) => void;
  onView: (patient: Patient) => void;
  canEdit: boolean;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const CollapsiblePatientCard: React.FC<CollapsiblePatientCardProps> = ({ patient, onEdit, onView, canEdit }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEditHistory, setShowEditHistory] = useState(false);

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'Discharged': return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'Deceased': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'Referred': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'Step Down': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      default: return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    }
  };

  const getAgeDisplay = () => {
    return `${patient.age} ${patient.ageUnit}`;
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg border border-slate-700/50 hover:border-slate-600 transition-all duration-200 overflow-hidden">
      {/* Collapsed View - Always Visible */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: Patient Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-white truncate">{patient.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getOutcomeColor(patient.outcome)}`}>
                {patient.outcome}
              </span>
            </div>
            
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {getAgeDisplay()} • {patient.gender}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Admitted: {formatDate(patient.admissionDate)}
              </span>
            </div>
            
            {/* Edit Indicator */}
            {patient.lastEditedAt && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEditHistory(!showEditHistory);
                }}
                className="mt-2 flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Edited {formatDate(patient.lastEditedAt)}</span>
                <svg className={`w-3 h-3 transition-transform ${showEditHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>

          {/* Right: Expand Button */}
          <button
            className="flex-shrink-0 p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <svg 
              className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded View - Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-700/50 space-y-3 animate-fadeIn">
          {/* Diagnosis */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Diagnosis</label>
            <p className="text-sm text-slate-200 mt-1">{patient.diagnosis}</p>
          </div>

          {/* NICU Specific Info */}
          {patient.unit === 'Neonatal Intensive Care Unit' && patient.admissionType && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Admission Type</label>
                <p className="text-sm text-slate-200 mt-1">{patient.admissionType}</p>
              </div>
              {patient.admissionType === 'Outborn' && patient.referringHospital && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Referring Hospital</label>
                  <p className="text-sm text-slate-200 mt-1">{patient.referringHospital}</p>
                </div>
              )}
            </div>
          )}

          {/* Step Down Info */}
          {patient.isStepDown && (
            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <label className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">Step Down</label>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-slate-400">From:</span>
                  <span className="text-slate-200 ml-1">{patient.stepDownFrom}</span>
                </div>
                {patient.stepDownDate && (
                  <div>
                    <span className="text-slate-400">Date:</span>
                    <span className="text-slate-200 ml-1">{formatDate(patient.stepDownDate)}</span>
                  </div>
                )}
              </div>
              {patient.readmissionFromStepDown && (
                <div className="mt-2 pt-2 border-t border-cyan-500/20">
                  <span className="text-xs font-semibold text-red-400">⚠️ Readmitted from Step Down</span>
                </div>
              )}
            </div>
          )}

          {/* Referral Info */}
          {patient.outcome === 'Referred' && patient.referredTo && (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <label className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">Referral</label>
              </div>
              <div className="text-sm">
                <div>
                  <span className="text-slate-400">Referred to:</span>
                  <span className="text-slate-200 ml-1">{patient.referredTo}</span>
                </div>
                {patient.referralReason && (
                  <div className="mt-1">
                    <span className="text-slate-400">Reason:</span>
                    <p className="text-slate-200 mt-1">{patient.referralReason}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Progress Notes Count */}
          {patient.progressNotes && patient.progressNotes.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>{patient.progressNotes.length} Progress Note{patient.progressNotes.length !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Edit History */}
          {showEditHistory && patient.editHistory && patient.editHistory.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <label className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Edit History</label>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {patient.editHistory.map((edit, index) => (
                  <div key={index} className="bg-slate-800/50 rounded p-2 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex flex-col">
                        <span className="text-amber-300 font-medium">{edit.editedBy}</span>
                        <span className="text-amber-400/70 text-xs">{edit.editedByEmail}</span>
                      </div>
                      <span className="text-slate-400">{formatDate(edit.timestamp)}</span>
                    </div>
                    <p className="text-slate-300">{edit.changes}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onView(patient);
              }}
              className="flex-1 px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 rounded-lg transition-colors text-sm font-medium"
            >
              View Full Details
            </button>
            {canEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(patient);
                }}
                className="flex-1 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors text-sm font-medium"
              >
                Edit Patient
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CollapsiblePatientCard;
