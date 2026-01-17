import React, { useState, useMemo } from 'react';
import { Patient, Unit, UserRole, AdmissionType } from '../types';
import { EditIcon, TrashIcon, EyeIcon, ArrowUpOnSquareIcon, ArrowUpIcon } from './common/Icons';
import { getFormattedAge } from '../utils/ageCalculator';

interface PatientListProps {
  patients: Patient[];
  userRole: UserRole;
  onEdit: (patient: Patient) => void;
  onDelete: (id: string) => void;
  onViewDetails: (patient: Patient) => void;
  onStepDownDischarge?: (patient: Patient) => void;
  onReadmitFromStepDown?: (patient: Patient) => void;
}

type AdmissionFilter = 'all' | 'inborn' | 'outborn-hf' | 'outborn-com';

const PatientList: React.FC<PatientListProps> = ({ patients, userRole, onEdit, onDelete, onViewDetails, onStepDownDischarge, onReadmitFromStepDown }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [admissionFilter, setAdmissionFilter] = useState<AdmissionFilter>('all');

  const filteredPatients = useMemo(() => {
    return patients
      .filter(p => {
        // Search filter
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               p.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
               (p.ntid && p.ntid.toLowerCase().includes(searchTerm.toLowerCase()));

        // Admission type filter
        let matchesAdmission = true;
        if (admissionFilter === 'inborn') {
          matchesAdmission = p.admissionType === AdmissionType.Inborn;
        } else if (admissionFilter === 'outborn-hf') {
          matchesAdmission = p.admissionType === AdmissionType.OutbornHealthFacility;
        } else if (admissionFilter === 'outborn-com') {
          matchesAdmission = p.admissionType === AdmissionType.OutbornCommunity;
        }

        return matchesSearch && matchesAdmission;
      });
  }, [patients, searchTerm, admissionFilter]);
  
  const getOutcomeColor = (outcome: string) => {
    switch(outcome) {
        case 'Discharged': return 'bg-green-500/20 text-green-300';
        case 'In Progress': return 'bg-blue-500/20 text-blue-300';
        case 'Step Down': return 'bg-blue-500/20 text-blue-300';
        case 'Referred': return 'bg-yellow-500/20 text-yellow-300';
        case 'Deceased': return 'bg-red-500/20 text-red-300';
        default: return 'bg-slate-500/20 text-slate-300';
    }
  };

  const canEdit = userRole === UserRole.Admin || userRole === UserRole.Doctor;
  const canDelete = userRole === UserRole.Admin || userRole === UserRole.Doctor;

  // Count by admission type
  const admissionCounts = useMemo(() => {
    return {
      all: patients.length,
      inborn: patients.filter(p => p.admissionType === AdmissionType.Inborn).length,
      outbornHF: patients.filter(p => p.admissionType === AdmissionType.OutbornHealthFacility).length,
      outbornCom: patients.filter(p => p.admissionType === AdmissionType.OutbornCommunity).length,
    };
  }, [patients]);

  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-blue-200">
      {/* Header with Search */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 rounded-t-xl">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white">Patient Records</h2>
          <input
            type="text"
            placeholder="Search by name, diagnosis or NTID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-80 bg-white border-2 border-blue-300 text-black rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-500"
          />
        </div>
      </div>

      {/* Admission Type Filter */}
      <div className="p-3 bg-blue-50 border-b border-blue-200">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAdmissionFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              admissionFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-black border-2 border-gray-300 hover:border-blue-600'
            }`}
          >
            All ({admissionCounts.all})
          </button>
          <button
            onClick={() => setAdmissionFilter('inborn')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              admissionFilter === 'inborn'
                ? 'bg-green-600 text-white'
                : 'bg-white text-black border-2 border-gray-300 hover:border-green-600'
            }`}
          >
            Inborn ({admissionCounts.inborn})
          </button>
          <button
            onClick={() => setAdmissionFilter('outborn-hf')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              admissionFilter === 'outborn-hf'
                ? 'bg-orange-600 text-white'
                : 'bg-white text-black border-2 border-gray-300 hover:border-orange-600'
            }`}
          >
            Outborn-HF ({admissionCounts.outbornHF})
          </button>
          <button
            onClick={() => setAdmissionFilter('outborn-com')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              admissionFilter === 'outborn-com'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-black border-2 border-gray-300 hover:border-purple-600'
            }`}
          >
            Outborn-Com ({admissionCounts.outbornCom})
          </button>
        </div>
      </div>

      {/* Quick Access Patient Names - Horizontal Scrollable */}
      <div className="p-3 bg-gray-50 border-b border-gray-200">
        <p className="text-xs font-bold text-gray-600 mb-2">Quick Access ({filteredPatients.length} patients):</p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {filteredPatients.slice(0, 20).map(patient => (
            <button
              key={patient.id}
              onClick={() => onViewDetails(patient)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                patient.outcome === 'In Progress'
                  ? 'bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-200'
                  : patient.outcome === 'Discharged'
                  ? 'bg-green-100 text-green-800 border border-green-300 hover:bg-green-200'
                  : patient.outcome === 'Deceased'
                  ? 'bg-red-100 text-red-800 border border-red-300 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              <span className="break-words">{patient.name}</span>
              {patient.ntid && <span className="ml-1 opacity-70 font-mono whitespace-nowrap">({patient.ntid.slice(-4)})</span>}
            </button>
          ))}
          {filteredPatients.length > 20 && (
            <span className="flex-shrink-0 px-3 py-1.5 text-xs text-gray-500">
              +{filteredPatients.length - 20} more
            </span>
          )}
        </div>
      </div>

      {/* Patient Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm text-left">
          <thead className="text-xs text-white uppercase bg-blue-600">
            <tr>
              <th scope="col" className="px-3 sm:px-4 py-3">NTID</th>
              <th scope="col" className="px-3 sm:px-4 py-3">Name</th>
              <th scope="col" className="px-3 sm:px-4 py-3">Age</th>
              <th scope="col" className="px-3 sm:px-4 py-3 hidden md:table-cell">Admission</th>
              <th scope="col" className="px-3 sm:px-4 py-3 hidden lg:table-cell">Type</th>
              <th scope="col" className="px-3 sm:px-4 py-3">Status</th>
              <th scope="col" className="px-3 sm:px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.map((patient, index) => (
              <tr
                key={patient.id}
                className={`border-b border-gray-200 hover:bg-blue-50 transition-colors cursor-pointer ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                } ${patient.isDraft ? 'border-l-4 border-l-yellow-500' : ''}`}
                onClick={() => onViewDetails(patient)}
              >
                <td className="px-3 sm:px-4 py-3 font-mono text-xs text-blue-600">
                  {patient.ntid || '-'}
                </td>
                <td className="px-3 sm:px-4 py-3 font-bold text-black">
                  <div className="flex flex-col">
                    <span className="break-words leading-tight">{patient.name}</span>
                    {patient.isDraft && <span className="mt-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded inline-block w-fit">DRAFT</span>}
                  </div>
                </td>
                <td className="px-3 sm:px-4 py-3 text-black whitespace-nowrap">{getFormattedAge(patient.dateOfBirth, patient.age, patient.ageUnit)}</td>
                <td className="px-3 sm:px-4 py-3 hidden md:table-cell text-black whitespace-nowrap">
                  {new Date(patient.admissionDate).toLocaleDateString()}
                </td>
                <td className="px-3 sm:px-4 py-3 hidden lg:table-cell">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    patient.admissionType === AdmissionType.Inborn
                      ? 'bg-green-100 text-green-800'
                      : patient.admissionType === AdmissionType.OutbornHealthFacility
                      ? 'bg-orange-100 text-orange-800'
                      : patient.admissionType === AdmissionType.OutbornCommunity
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {patient.admissionType === AdmissionType.Inborn ? 'Inborn' :
                     patient.admissionType === AdmissionType.OutbornHealthFacility ? 'Out-HF' :
                     patient.admissionType === AdmissionType.OutbornCommunity ? 'Out-Com' : '-'}
                  </span>
                </td>
                <td className="px-3 sm:px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    patient.outcome === 'Discharged' ? 'bg-green-100 text-green-800' :
                    patient.outcome === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                    patient.outcome === 'Step Down' ? 'bg-cyan-100 text-cyan-800' :
                    patient.outcome === 'Referred' ? 'bg-yellow-100 text-yellow-800' :
                    patient.outcome === 'Deceased' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {patient.outcome}
                  </span>
                </td>
                <td className="px-3 sm:px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end space-x-1">
                    <button onClick={() => onViewDetails(patient)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors">
                      <EyeIcon className="w-4 h-4"/>
                    </button>
                    {canEdit && (
                      <button onClick={() => onEdit(patient)} className="p-1.5 text-yellow-600 hover:bg-yellow-100 rounded transition-colors">
                        <EditIcon className="w-4 h-4"/>
                      </button>
                    )}
                    {patient.isStepDown && onStepDownDischarge && (
                      <button
                        onClick={() => onStepDownDischarge(patient)}
                        className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors"
                        title="Final Discharge"
                      >
                        <ArrowUpOnSquareIcon className="w-4 h-4"/>
                      </button>
                    )}
                    {patient.isStepDown && onReadmitFromStepDown && (
                      <button
                        onClick={() => onReadmitFromStepDown(patient)}
                        className="p-1.5 text-orange-600 hover:bg-orange-100 rounded transition-colors"
                        title="Readmit"
                      >
                        <ArrowUpIcon className="w-4 h-4"/>
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => onDelete(patient.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors">
                        <TrashIcon className="w-4 h-4"/>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredPatients.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium">No patients found</p>
            <p className="text-sm">Try adjusting your search or filter</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientList;
