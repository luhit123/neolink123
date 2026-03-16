import React from 'react';
import { UserRole } from '../types';
import { AdminIcon, DoctorIcon, NurseIcon } from './common/Icons';
import NotificationBell from './NotificationBell';
import DigitalClock from './DigitalClock';
import { glassClasses } from '../theme/glassmorphism';

interface HeaderProps {
  userRole: UserRole;
  onLogout: () => void;
  collegeName?: string;
  onShowReferrals?: () => void;
  institutionId?: string;
  userEmail?: string;
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

const Header: React.FC<HeaderProps> = ({ userRole, onLogout, collegeName, onShowReferrals, institutionId, userEmail }) => {
  const displayCollegeName = collegeName || localStorage.getItem('collegeName') || 'Medical Records System';
  const storedInstitutionId = institutionId || localStorage.getItem('institutionId') || '';
  const storedUserEmail = userEmail || localStorage.getItem('userEmail') || '';

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/55 dark:bg-slate-900/55 border-b border-white/30 dark:border-white/10 shadow-[0_12px_50px_rgba(236,72,153,0.12)] p-2 sm:p-3">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img
            src="/neolink-logo.png"
            alt="NeoLink"
            className="w-10 h-10 rounded-xl object-cover shadow-sm ring-1 ring-white/40"
          />
          <div className="flex flex-col">
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              <span className="bg-gradient-to-r from-fuchsia-600 to-rose-500 bg-clip-text text-transparent">Neo</span>Link
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300">
              {displayCollegeName}
            </div>
          </div>
          <div className="hidden md:block text-xs text-slate-600 dark:text-slate-300 border-l border-white/30 dark:border-white/10 pl-3">
            Advanced Healthcare Analytics
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden md:block scale-90 origin-right">
            <DigitalClock />
          </div>
          <div className="flex items-center gap-2 bg-white/35 dark:bg-slate-800/45 border border-white/30 dark:border-white/10 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm shadow-sm">
            {getRoleIcon(userRole)}
            <span className="font-semibold text-fuchsia-700 dark:text-fuchsia-300">{userRole}</span>
          </div>

          {/* Notification Bell */}
          {storedInstitutionId && (
            <NotificationBell
              institutionId={storedInstitutionId}
              userEmail={storedUserEmail}
            />
          )}

          <button
            onClick={() => window.location.reload()}
            className={glassClasses(
              'px-3 sm:px-4 py-2 rounded-lg transition-all text-xs sm:text-sm font-semibold shadow-sm',
              'backdrop-blur-xl bg-white/35 dark:bg-slate-800/45 border border-white/30 dark:border-white/10',
              'text-fuchsia-700 dark:text-fuchsia-300 hover:bg-white/50 dark:hover:bg-slate-800/60'
            )}
            title="Refresh to load latest data"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={onLogout}
            className={glassClasses(
              'px-3 sm:px-4 py-2 rounded-lg transition-all text-xs sm:text-sm font-semibold shadow-sm',
              'backdrop-blur-xl bg-white/35 dark:bg-slate-800/45 border border-red-200/70 dark:border-red-400/20',
              'text-red-700 dark:text-red-300 hover:bg-red-50/60 dark:hover:bg-slate-800/60'
            )}
          >
            Logout
          </button >
        </div >
      </div >
    </header >
  );
};

export default Header;
