import React from 'react';
import { Patient } from '../types';
import { getFormattedAge } from '../utils/ageCalculator';

interface SimplePatientRowProps {
  patient: Patient;
  onClick: () => void;
  onQuickRecord?: (patient: Patient) => void; // Quick voice recording
  // Selection mode props
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (patientId: string) => void;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const getStatusColor = (outcome: string) => {
  switch (outcome) {
    case 'In Progress': return 'bg-blue-100 text-blue-700 border-blue-300';
    case 'Discharged': return 'bg-green-100 text-green-700 border-green-300';
    case 'Deceased': return 'bg-red-100 text-red-700 border-red-300';
    case 'Referred': return 'bg-orange-100 text-orange-700 border-orange-300';
    case 'Step Down': return 'bg-sky-100 text-sky-700 border-sky-300';
    default: return 'bg-gray-100 text-gray-700 border-gray-300';
  }
};

const SimplePatientRow: React.FC<SimplePatientRowProps> = ({
  patient,
  onClick,
  onQuickRecord,
  selectionMode,
  isSelected,
  onToggleSelection
}) => {
  // Get primary diagnosis from indication for admission or diagnosis field
  const getPrimaryDiagnosis = () => {
    if (patient.indicationsForAdmission && patient.indicationsForAdmission.length > 0) {
      return patient.indicationsForAdmission[0];
    }
    return patient.diagnosis || 'Not specified';
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelection) {
      onToggleSelection(patient.id);
    }
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between p-4 bg-white hover:bg-sky-50 border-b border-sky-100 cursor-pointer transition-all duration-200 active:bg-sky-100 ${
        isSelected ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500' : ''
      }`}
    >
      {/* Checkbox for selection mode */}
      {selectionMode && (
        <div className="mr-3" onClick={handleCheckboxClick}>
          <div
            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-red-500 border-red-500'
                : 'bg-white border-slate-300 hover:border-red-400'
            }`}
          >
            {isSelected && (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Patient Name & Diagnosis */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-semibold text-slate-900 break-words leading-tight">
            {patient.name}
          </h3>
          {patient.ntid && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono font-bold rounded whitespace-nowrap">
              {patient.ntid}
            </span>
          )}
        </div>
        <p className="text-sm text-sky-600">
          {getFormattedAge(patient.dateOfBirth, patient.age, patient.ageUnit)} • {patient.gender}
        </p>
        <p className="text-xs text-slate-700 font-medium mt-1 line-clamp-2">
          {getPrimaryDiagnosis()}
        </p>
      </div>

      {/* Date of Admission */}
      <div className="flex-1 text-center hidden md:block">
        <p className="text-xs text-sky-600 font-medium">DOA</p>
        <p className="text-sm font-semibold text-slate-800">
          {formatDate(patient.admissionDate)}
        </p>
      </div>

      {/* Quick Record Button - Only for In Progress patients */}
      {onQuickRecord && patient.outcome === 'In Progress' && !selectionMode && (
        <div className="flex-shrink-0 mx-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickRecord(patient);
            }}
            className="p-2.5 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200"
            title="Quick Voice Note"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        </div>
      )}

      {/* Status */}
      <div className="flex-1 flex justify-end">
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(patient.outcome)}`}>
          {patient.outcome}
        </span>
      </div>

      {/* Arrow Icon (hide in selection mode) */}
      {!selectionMode && (
        <div className="ml-4">
          <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default SimplePatientRow;
