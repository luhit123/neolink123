import React from 'react';
import { UserRole } from '../types';
import { AdminIcon, DoctorIcon, NurseIcon } from './common/Icons';

interface RoleSelectionProps {
  onSelectRole: (role: UserRole) => void;
  userName: string;
}

const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelectRole, userName }) => {
  const roles: { role: UserRole; icon: React.ReactNode; description: string; color: string }[] = [
    {
      role: UserRole.Admin,
      icon: <AdminIcon className="w-16 h-16" />,
      description: 'Full access to all features, manage users and data',
      color: 'from-purple-500 to-purple-700'
    },
    {
      role: UserRole.Doctor,
      icon: <DoctorIcon className="w-16 h-16" />,
      description: 'Add, edit patients and manage clinical notes',
      color: 'from-cyan-500 to-cyan-700'
    },
    {
      role: UserRole.Nurse,
      icon: <NurseIcon className="w-16 h-16" />,
      description: 'Create patient drafts for doctor review',
      color: 'from-green-500 to-green-700'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Welcome, {userName}! 👋</h1>
          <p className="text-slate-300 text-lg">Select your role to continue</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {roles.map(({ role, icon, description, color }) => (
            <button
              key={role}
              onClick={() => onSelectRole(role)}
              className="group relative bg-slate-800 rounded-2xl p-8 border-2 border-slate-700 hover:border-cyan-500 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/20"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`}></div>
              
              <div className="relative z-10">
                <div className="flex justify-center mb-4 text-slate-400 group-hover:text-cyan-400 transition-colors">
                  {icon}
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-3">{role}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
                
                <div className="mt-6 flex items-center justify-center text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-sm font-semibold">Select Role</span>
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">
            Your role determines your access level and permissions in the system
          </p>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
