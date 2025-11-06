import React from 'react';
import { UserRole } from '../types';
import { AdminIcon, DoctorIcon, NurseIcon } from './common/Icons';

interface HeaderProps {
  userRole: UserRole;
  onLogout: () => void;
}

const getRoleIcon = (role: UserRole) => {
    switch (role) {
        case UserRole.Admin:
            return <AdminIcon className="w-5 h-5" />;
        case UserRole.Doctor:
            return <DoctorIcon className="w-5 h-5" />;
        case UserRole.Nurse:
            return <NurseIcon className="w-5 h-5" />;
        default:
            return null;
    }
}

const Header: React.FC<HeaderProps> = ({ userRole, onLogout }) => {
  const collegeName = localStorage.getItem('collegeName') || 'Nalbari Medical College and Hospital';
  
  return (
    <header className="bg-gradient-to-r from-slate-800 via-slate-800 to-slate-700 backdrop-blur-sm p-4 sticky top-0 z-40 border-b border-cyan-500/20 shadow-lg">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="text-2xl sm:text-3xl font-bold text-white">
              <span className="text-cyan-400">Neo</span>Link
            </div>
            <div className="text-xs text-slate-400">
              {collegeName}
            </div>
          </div>
          <div className="hidden md:block text-xs text-slate-400 border-l border-slate-600 pl-3">
            PICU/NICU Medical Records
          </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 px-4 py-2 rounded-lg text-sm">
                {getRoleIcon(userRole)}
                <span className="font-semibold text-cyan-300">{userRole}</span>
            </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg hover:from-slate-500 hover:to-slate-600 transition-all text-sm font-semibold shadow-md"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
