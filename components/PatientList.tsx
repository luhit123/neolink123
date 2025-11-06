import React, { useState, useMemo } from 'react';
import { Patient, Unit, UserRole } from '../types';
import { EditIcon, TrashIcon, EyeIcon } from './common/Icons';

interface PatientListProps {
  patients: Patient[];
  userRole: UserRole;
  onEdit: (patient: Patient) => void;
  onDelete: (id: string) => void;
  onViewDetails: (patient: Patient) => void;
}

const PatientList: React.FC<PatientListProps> = ({ patients, userRole, onEdit, onDelete, onViewDetails }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPatients = useMemo(() => {
    return patients
      .filter(p => {
        return p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               p.diagnosis.toLowerCase().includes(searchTerm.toLowerCase());
      });
  }, [patients, searchTerm]);
  
  const getOutcomeColor = (outcome: string) => {
    switch(outcome) {
        case 'Discharged': return 'bg-green-500/20 text-green-300';
        case 'In Progress': return 'bg-blue-500/20 text-blue-300';
        case 'Referred': return 'bg-yellow-500/20 text-yellow-300';
        case 'Deceased': return 'bg-red-500/20 text-red-300';
        default: return 'bg-slate-500/20 text-slate-300';
    }
  };

  const canEdit = userRole === UserRole.Admin || userRole === UserRole.Doctor;
  const canDelete = userRole === UserRole.Admin || userRole === UserRole.Doctor;

  return (
    <div className="bg-slate-800 p-3 sm:p-6 rounded-xl shadow-lg border border-slate-700">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 gap-3 sm:gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Patient Records</h2>
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <input
                type="text"
                placeholder="Search by name or diagnosis..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 sm:px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
        </div>
      </div>
      <div className="overflow-x-auto -mx-3 sm:mx-0">
        <table className="w-full text-xs sm:text-sm text-left text-slate-300">
          <thead className="text-xs text-slate-400 uppercase bg-slate-700/50">
            <tr>
              <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3">Name</th>
              <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3">Age</th>
              <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 hidden md:table-cell">Admission Date</th>
              <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 hidden lg:table-cell">Diagnosis</th>
              <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3">Status</th>
              <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.map(patient => (
              <tr key={patient.id} className={`bg-slate-800 border-b border-slate-700 hover:bg-slate-700/50 active:bg-slate-700 transition-colors ${patient.isDraft ? 'border-l-4 border-l-yellow-500' : ''}`}>
                <td className="px-3 sm:px-6 py-3 sm:py-4 font-medium text-white">
                  <div className="flex flex-col">
                    <span className="truncate max-w-[120px] sm:max-w-none">{patient.name}</span>
                    {patient.isDraft && <span className="mt-1 text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded inline-block w-fit">DRAFT</span>}
                  </div>
                </td>
                <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">{`${patient.age} ${patient.ageUnit}`}</td>
                <td className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell whitespace-nowrap">{new Date(patient.admissionDate).toLocaleDateString()}</td>
                <td className="px-3 sm:px-6 py-3 sm:py-4 hidden lg:table-cell max-w-xs truncate">{patient.diagnosis || <span className="text-slate-500 italic">Pending diagnosis</span>}</td>
                <td className="px-3 sm:px-6 py-3 sm:py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getOutcomeColor(patient.outcome)}`}>
                    {patient.outcome}
                  </span>
                </td>
                <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                  <div className="flex items-center justify-end space-x-1 sm:space-x-2">
                    <button onClick={() => onViewDetails(patient)} className="p-1.5 sm:p-2 text-slate-400 hover:text-cyan-400 active:text-cyan-300 transition-colors"><EyeIcon className="w-4 h-4 sm:w-5 sm:h-5"/></button>
                    {canEdit && <button onClick={() => onEdit(patient)} className="p-1.5 sm:p-2 text-slate-400 hover:text-yellow-400 active:text-yellow-300 transition-colors"><EditIcon className="w-4 h-4 sm:w-5 sm:h-5"/></button>}
                    {canDelete && <button onClick={() => onDelete(patient.id)} className="p-1.5 sm:p-2 text-slate-400 hover:text-red-400 active:text-red-300 transition-colors"><TrashIcon className="w-4 h-4 sm:w-5 sm:h-5"/></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
         {filteredPatients.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">
            No patients found for the current filter.
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientList;
