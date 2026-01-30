import React from 'react';
import { Patient, PatientOutcome } from '../types';
import { getFormattedAge } from '../utils/ageCalculator';
import PatientActionMenu from './PatientActionMenu';

interface SimplePatientRowProps {
  patient: Patient;
  onClick: () => void;
  onQuickRecord?: (patient: Patient) => void;
  onUpdateStatus?: (patient: Patient, status: PatientOutcome) => void;
  onGenerateDischarge?: (patient: Patient) => void;
  onViewDischargeCertificate?: (patient: Patient) => void;
  onPreviewDischarge?: (patient: Patient) => void;
  onDownloadDischarge?: (patient: Patient) => void;
  onDeathCertificate?: (patient: Patient) => void;
  onStepDown?: (patient: Patient) => void;
  onRefer?: (patient: Patient) => void;
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
    case 'In Progress': return 'bg-blue-100 text-blue-700';
    case 'Discharged': return 'bg-green-100 text-green-700';
    case 'Deceased': return 'bg-red-100 text-red-700';
    case 'Referred': return 'bg-orange-100 text-orange-700';
    case 'Step Down': return 'bg-sky-100 text-sky-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const SimplePatientRow: React.FC<SimplePatientRowProps> = ({
  patient,
  onClick,
  onQuickRecord,
  onUpdateStatus,
  onGenerateDischarge,
  onViewDischargeCertificate,
  onPreviewDischarge,
  onDownloadDischarge,
  onDeathCertificate,
  onStepDown,
  onRefer,
  selectionMode,
  isSelected,
  onToggleSelection
}) => {
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
      className={`
        flex items-center gap-2 sm:gap-3 p-3 sm:p-4
        bg-white hover:bg-slate-50 border-b border-slate-100
        cursor-pointer transition-colors w-full max-w-full overflow-hidden
        ${isSelected ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500' : ''}
      `}
    >
      {/* Checkbox for selection mode */}
      {selectionMode && (
        <div className="flex-shrink-0" onClick={handleCheckboxClick}>
          <div
            className={`w-5 h-5 sm:w-6 sm:h-6 rounded border-2 flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-red-500 border-red-500'
                : 'bg-white border-slate-300'
            }`}
          >
            {isSelected && (
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Patient Info - Main Column */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {/* Name Row */}
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
            {patient.name}
          </h3>
          {patient.ntid && (
            <span className="flex-shrink-0 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] sm:text-xs font-mono font-bold rounded">
              {patient.ntid}
            </span>
          )}
        </div>
        {/* Details Row */}
        <p className="text-xs sm:text-sm text-slate-500 truncate">
          {getFormattedAge(patient.dateOfBirth, patient.age, patient.ageUnit)} • {patient.gender}
          <span className="hidden sm:inline"> • {formatDate(patient.admissionDate)}</span>
        </p>
        {/* Diagnosis - Hidden on very small screens */}
        <p className="hidden sm:block text-xs text-slate-600 truncate mt-0.5">
          {getPrimaryDiagnosis()}
        </p>
      </div>

      {/* Status Badge */}
      <div className="flex-shrink-0">
        <span className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap ${getStatusColor(patient.outcome)}`}>
          {patient.outcome === 'In Progress' ? 'Active' : patient.outcome}
        </span>
      </div>

      {/* Action Menu */}
      {!selectionMode && (
        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <PatientActionMenu
            patient={patient}
            onQuickRecord={onQuickRecord}
            onUpdateStatus={onUpdateStatus}
            onGenerateDischarge={onGenerateDischarge}
            onViewDischargeCertificate={onViewDischargeCertificate}
            onPreviewDischarge={onPreviewDischarge}
            onDownloadDischarge={onDownloadDischarge}
            onDeathCertificate={onDeathCertificate}
            onStepDown={onStepDown}
            onRefer={onRefer}
            onViewDetails={() => onClick()}
          />
        </div>
      )}

      {/* Arrow - Desktop only */}
      {!selectionMode && (
        <div className="flex-shrink-0 hidden sm:block">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default SimplePatientRow;
