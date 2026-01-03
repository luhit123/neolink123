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
      case 'Discharged': return 'text-green-700 bg-green-50 border-green-300';
      case 'Deceased': return 'text-red-700 bg-red-50 border-red-300';
      case 'Referred': return 'text-orange-700 bg-orange-50 border-orange-300';
      case 'Step Down': return 'text-sky-700 bg-sky-50 border-sky-300';
      default: return 'text-blue-700 bg-blue-50 border-blue-300';
    }
  };

  const getAgeDisplay = () => {
    return `${patient.age} ${patient.ageUnit}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-md border-2 border-sky-200 hover:border-sky-400 hover:shadow-xl transition-all duration-200 overflow-hidden">
      {/* Collapsed View - Always Visible */}
      <div
        className="p-5 cursor-pointer bg-gradient-to-r from-white to-sky-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: Patient Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-sky-100 p-2 rounded-full">
                <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-sky-900 truncate">{patient.name}</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${getOutcomeColor(patient.outcome)}`}>
                {patient.outcome}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-sky-700 ml-12">
              <span className="flex items-center gap-2 font-medium">
                <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {getAgeDisplay()} • {patient.gender}
              </span>
              <span className="flex items-center gap-2 font-medium">
                <svg className="w-4 h-4 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="mt-3 ml-12 flex items-center gap-2 text-xs text-amber-600 hover:text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 hover:border-amber-300 transition-all font-medium"
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
            className="flex-shrink-0 p-3 bg-sky-100 hover:bg-sky-200 rounded-lg transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <svg
              className={`w-6 h-6 text-sky-600 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
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
        <div className="px-5 pb-5 pt-3 bg-sky-50/50 border-t-2 border-sky-200 space-y-4">
          {/* Diagnosis */}
          <div className="bg-white rounded-lg p-4 border border-sky-200">
            <label className="text-xs font-bold text-sky-600 uppercase tracking-wide mb-2 block">Diagnosis</label>
            <p className="text-sm text-sky-900 font-medium">{patient.diagnosis}</p>
          </div>

          {/* NICU Specific Info */}
          {patient.unit === 'Neonatal Intensive Care Unit' && patient.admissionType && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-4 border border-sky-200">
                <label className="text-xs font-bold text-sky-600 uppercase tracking-wide mb-2 block">Admission Type</label>
                <p className="text-sm text-sky-900 font-medium">{patient.admissionType}</p>
              </div>
              {patient.admissionType === 'Outborn' && patient.referringHospital && (
                <div className="bg-white rounded-lg p-4 border border-sky-200">
                  <label className="text-xs font-bold text-sky-600 uppercase tracking-wide mb-2 block">Referring Hospital</label>
                  <p className="text-sm text-sky-900 font-medium">{patient.referringHospital}</p>
                </div>
              )}
            </div>
          )}

          {/* Step Down Info */}
          {patient.isStepDown && (
            <div className="bg-gradient-to-r from-sky-50 to-blue-50 border-2 border-sky-300 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <label className="text-sm font-bold text-sky-700 uppercase tracking-wide">Step Down</label>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-sky-600 font-semibold">From:</span>
                  <span className="text-sky-900 ml-2 font-medium">{patient.stepDownFrom}</span>
                </div>
                {patient.stepDownDate && (
                  <div>
                    <span className="text-sky-600 font-semibold">Date:</span>
                    <span className="text-sky-900 ml-2 font-medium">{formatDate(patient.stepDownDate)}</span>
                  </div>
                )}
              </div>
              {patient.readmissionFromStepDown && (
                <div className="mt-3 pt-3 border-t border-sky-300">
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">⚠️ Readmitted from Step Down</span>
                </div>
              )}
            </div>
          )}

          {/* Referral Info */}
          {patient.outcome === 'Referred' && patient.referredTo && (
            <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-300 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <label className="text-sm font-bold text-orange-700 uppercase tracking-wide">Referral</label>
              </div>
              <div className="text-sm space-y-2">
                <div>
                  <span className="text-orange-600 font-semibold">Referred to:</span>
                  <span className="text-orange-900 ml-2 font-medium">{patient.referredTo}</span>
                </div>
                {patient.referralReason && (
                  <div>
                    <span className="text-orange-600 font-semibold">Reason:</span>
                    <p className="text-orange-900 mt-1 font-medium">{patient.referralReason}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Progress Notes Count */}
          {patient.progressNotes && patient.progressNotes.length > 0 && (
            <div className="flex items-center gap-2 text-sm bg-white rounded-lg p-3 border border-sky-200">
              <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sky-900 font-semibold">{patient.progressNotes.length} Progress Note{patient.progressNotes.length !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Edit History */}
          {showEditHistory && patient.editHistory && patient.editHistory.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <label className="text-sm font-bold text-amber-700 uppercase tracking-wide">Edit History</label>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {patient.editHistory.map((edit, index) => (
                  <div key={index} className="bg-white rounded-lg p-3 text-xs border border-amber-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex flex-col">
                        <span className="text-amber-700 font-bold">{edit.editedBy}</span>
                        <span className="text-amber-600 text-xs">{edit.editedByEmail}</span>
                      </div>
                      <span className="text-sky-600 font-semibold">{formatDate(edit.timestamp)}</span>
                    </div>
                    <p className="text-sky-900">{edit.changes}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onView(patient);
              }}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white rounded-lg transition-all duration-200 text-sm font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Full Details
            </button>
            {canEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(patient);
                }}
                className="flex-1 px-6 py-3 bg-white border-2 border-sky-500 text-sky-600 hover:bg-sky-50 hover:border-sky-600 rounded-lg transition-all duration-200 text-sm font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
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
