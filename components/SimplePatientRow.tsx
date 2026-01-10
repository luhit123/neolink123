import React from 'react';
import { Patient } from '../types';

interface SimplePatientRowProps {
  patient: Patient;
  onClick: () => void;
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

const SimplePatientRow: React.FC<SimplePatientRowProps> = ({ patient, onClick }) => {
  // Get primary diagnosis from indication for admission or diagnosis field
  const getPrimaryDiagnosis = () => {
    if (patient.indicationsForAdmission && patient.indicationsForAdmission.length > 0) {
      return patient.indicationsForAdmission[0];
    }
    return patient.diagnosis || 'Not specified';
  };

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-4 bg-white hover:bg-sky-50 border-b border-sky-100 cursor-pointer transition-all duration-200 active:bg-sky-100"
    >
      {/* Patient Name & Diagnosis */}
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-slate-900 truncate">
          {patient.name}
        </h3>
        <p className="text-sm text-sky-600">
          {patient.age} {patient.ageUnit} • {patient.gender}
        </p>
        <p className="text-xs text-slate-700 font-medium mt-1 truncate">
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

      {/* Status */}
      <div className="flex-1 flex justify-end">
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(patient.outcome)}`}>
          {patient.outcome}
        </span>
      </div>

      {/* Arrow Icon */}
      <div className="ml-4">
        <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
};

export default SimplePatientRow;
