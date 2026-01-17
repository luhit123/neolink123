import React, { useState } from 'react';
import { Patient } from '../types';
import SwipeableListItem from './gestures/SwipeableListItem';
import { haptics } from '../utils/haptics';
import { getFormattedAge } from '../utils/ageCalculator';

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

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
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
    return getFormattedAge(patient.dateOfBirth, patient.age, patient.ageUnit);
  };

  return (
    <SwipeableListItem
      onSwipeLeft={() => {
        if (canEdit) {
          haptics.tap();
          onEdit(patient);
        }
      }}
      onSwipeRight={() => {
        haptics.tap();
        onView(patient);
      }}
      leftAction={{
        label: 'View',
        color: 'bg-blue-500',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        ),
      }}
      rightAction={
        canEdit
          ? {
              label: 'Edit',
              color: 'bg-emerald-500',
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              ),
            }
          : undefined
      }
    >
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border-2 border-sky-200 hover:border-sky-400 hover:shadow-2xl transition-all duration-300 overflow-hidden active:scale-[0.98] mx-2 sm:mx-0">
        {/* Collapsed View - Always Visible */}
        <div
          className="p-3 sm:p-5 md:p-6 cursor-pointer bg-gradient-to-br from-white via-sky-50/30 to-blue-50/40 relative overflow-hidden"
          onClick={() => setIsExpanded(!isExpanded)}
        >
        {/* Material Design Ripple Effect Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-sky-400/0 via-sky-400/5 to-blue-400/0 opacity-0 hover:opacity-100 transition-opacity duration-500" />

        <div className="flex items-start justify-between gap-2 sm:gap-4 relative z-10">
          {/* Left: Patient Info */}
          <div className="flex-1 min-w-0">
            {/* Mobile: Name + Icon on top row, badge below */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 mb-3">
              <div className="flex items-start gap-2 sm:gap-3 w-full">
                <div className="bg-gradient-to-br from-sky-400 to-blue-600 p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-md flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-base sm:text-xl md:text-2xl font-bold text-slate-900 break-words flex-1 min-w-0 leading-tight">{patient.name}</h3>
                {/* View Patient Details Icon - Material FAB Style */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(patient);
                  }}
                  className="flex-shrink-0 p-2 sm:p-3 bg-gradient-to-br from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-xl sm:rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center group active:scale-95 min-h-[40px] min-w-[40px] sm:min-h-[48px] sm:min-w-[48px]"
                  title="View Full Details"
                  aria-label="View patient details"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
              </div>
              {/* Outcome badge on separate line on mobile */}
              <span className={`px-2 sm:px-4 py-1 sm:py-2 rounded-full text-[10px] sm:text-xs md:text-sm font-bold border-2 shadow-sm whitespace-nowrap self-start ml-0 sm:ml-0 ${getOutcomeColor(patient.outcome)}`}>
                {patient.outcome}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm md:text-base ml-0 sm:ml-1 md:ml-3">
              <div className="flex items-center gap-1.5 sm:gap-2 bg-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl shadow-sm border border-sky-100">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-semibold text-slate-700">{getAgeDisplay()}</span>
                <span className="text-slate-400">•</span>
                <span className="font-semibold text-slate-700">{patient.gender}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 bg-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl shadow-sm border border-sky-100">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[10px] sm:text-xs font-bold text-sky-600 uppercase">Admitted:</span>
                <span className="font-semibold text-slate-700">{formatDate(patient.admissionDate)}</span>
              </div>
            </div>

            {/* Edit Indicator - Material Chip Style */}
            {patient.lastEditedAt && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEditHistory(!showEditHistory);
                }}
                className="mt-3 ml-1 md:ml-3 flex items-center gap-2 text-xs md:text-sm text-amber-700 hover:text-amber-800 bg-amber-50 px-4 py-2 rounded-xl border-2 border-amber-200 hover:border-amber-300 hover:bg-amber-100 transition-all font-bold shadow-sm active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Edited {formatDate(patient.lastEditedAt)}</span>
                <svg className={`w-4 h-4 transition-transform duration-300 ${showEditHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>

          {/* Right: Expand Button - Material Design */}
          <button
            className="flex-shrink-0 p-3 md:p-4 bg-gradient-to-br from-sky-100 to-blue-100 hover:from-sky-200 hover:to-blue-200 rounded-2xl transition-all duration-300 shadow-md hover:shadow-lg active:scale-95 min-h-[48px] min-w-[48px]"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            aria-label={isExpanded ? "Collapse details" : "Expand details"}
          >
            <svg
              className={`w-6 h-6 text-sky-700 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded View - Details */}
      {isExpanded && (
        <div className="px-3 sm:px-5 pb-3 sm:pb-5 pt-2 sm:pt-3 bg-sky-50/50 border-t-2 border-sky-200 space-y-3 sm:space-y-4">
          {/* Diagnosis */}
          <div className="bg-white rounded-lg p-3 sm:p-4 border border-sky-200">
            <label className="text-xs font-bold text-sky-600 uppercase tracking-wide mb-2 block">Diagnosis</label>
            <p className="text-sm text-sky-900 font-medium">{patient.diagnosis}</p>
          </div>

          {/* NICU Specific Info */}
          {patient.unit === 'Neonatal Intensive Care Unit' && patient.admissionType && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <div className="bg-white rounded-lg p-3 sm:p-4 border border-sky-200">
                <label className="text-xs font-bold text-sky-600 uppercase tracking-wide mb-2 block">Admission Type</label>
                <p className="text-sm text-sky-900 font-medium">{patient.admissionType}</p>
              </div>
              {patient.admissionType === 'Outborn' && patient.referringHospital && (
                <div className="bg-white rounded-lg p-3 sm:p-4 border border-sky-200">
                  <label className="text-xs font-bold text-sky-600 uppercase tracking-wide mb-2 block">Referring Hospital</label>
                  <p className="text-sm text-sky-900 font-medium">{patient.referringHospital}</p>
                </div>
              )}
            </div>
          )}

          {/* Step Down Info */}
          {patient.isStepDown && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-lg p-3 sm:p-4 shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <label className="text-base font-bold text-purple-700 uppercase tracking-wide">Step Down Status</label>
              </div>
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3 border border-purple-200">
                  <span className="text-xs text-purple-600 font-semibold uppercase block mb-1">Stepped Down From:</span>
                  <span className="text-lg text-purple-900 font-bold">{patient.stepDownFrom}</span>
                </div>
                {patient.stepDownDate && (
                  <div className="bg-white rounded-lg p-3 border border-purple-200">
                    <span className="text-xs text-purple-600 font-semibold uppercase block mb-1">Step Down Date & Time:</span>
                    <span className="text-base text-purple-900 font-bold">{formatDateTime(patient.stepDownDate)}</span>
                  </div>
                )}
              </div>
              {patient.readmissionFromStepDown && (
                <div className="mt-3 pt-3 border-t-2 border-red-300">
                  <div className="flex items-center gap-2 bg-red-50 border-2 border-red-400 px-3 py-2 rounded-lg">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-sm font-bold text-red-700">⚠️ Readmitted from Step Down</span>
                  </div>
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
          <div className="flex gap-2 sm:gap-3 pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onView(patient);
              }}
              className="flex-1 px-3 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white rounded-lg transition-all duration-200 text-xs sm:text-sm font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 sm:gap-2 active:scale-95"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span className="hidden sm:inline">View Full Details</span>
              <span className="sm:hidden">View Details</span>
            </button>
            {canEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(patient);
                }}
                className="flex-1 px-3 sm:px-6 py-2.5 sm:py-3 bg-white border-2 border-sky-500 text-sky-600 hover:bg-sky-50 hover:border-sky-600 rounded-lg transition-all duration-200 text-xs sm:text-sm font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 sm:gap-2 active:scale-95"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="hidden sm:inline">Edit Patient</span>
                <span className="sm:hidden">Edit</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
    </SwipeableListItem>
  );
};

export default CollapsiblePatientCard;
