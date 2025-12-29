import React from 'react';
import { UserRole } from '../types';
import { AdminIcon, DoctorIcon, NurseIcon } from './common/Icons';

interface HeaderProps {
  userRole: UserRole;
  onLogout: () => void;
  collegeName?: string; // Make it optional
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

const Header: React.FC<HeaderProps> = ({ userRole, onLogout, collegeName }) => {
  const displayCollegeName = collegeName || localStorage.getItem('collegeName') || 'Medical Records System';

  return (
    <header className="bg-white backdrop-blur-sm p-4 sticky top-0 z-40 border-b border-medical-teal/20 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900">
              <span className="text-medical-teal">Neo</span>Link
            </div>
            <div className="text-xs text-slate-600">
              {displayCollegeName}
            </div>
          </div>
          <div className="hidden md:block text-xs text-slate-600 border-l border-slate-300 pl-3">
            PICU/NICU Medical Records
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-medical-teal/10 border border-medical-teal/30 px-4 py-2 rounded-lg text-sm">
            {getRoleIcon(userRole)}
            <span className="font-semibold text-medical-teal">{userRole}</span>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all text-sm font-semibold shadow-sm border border-slate-200"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
