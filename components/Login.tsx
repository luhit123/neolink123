import React, { useState } from 'react';
import { UserRole } from '../types';
import { AdminIcon, DoctorIcon, NurseIcon } from './common/Icons';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

const RoleCard: React.FC<{
  role: UserRole;
  icon: React.ReactNode;
  selectedRole: UserRole;
  setSelectedRole: (role: UserRole) => void;
}> = ({ role, icon, selectedRole, setSelectedRole }) => {
  const isSelected = role === selectedRole;
  return (
    <div
      onClick={() => setSelectedRole(role)}
      className={`p-6 rounded-lg border-2 text-center cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'bg-cyan-500/20 border-cyan-500 scale-105'
          : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
      }`}
    >
      <div className={`mx-auto w-16 h-16 flex items-center justify-center rounded-full mb-4 ${isSelected ? 'bg-cyan-500/30' : 'bg-slate-600/50'}`}>
        {icon}
      </div>
      <h3 className={`font-bold text-lg ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`}>{role}</h3>
    </div>
  );
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.Nurse);
  const collegeName = localStorage.getItem('collegeName') || 'Nalbari Medical College and Hospital';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(selectedRole);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl p-10 space-y-8 bg-slate-800/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-cyan-500/20">
        <div className="text-center">
            <div className="inline-block p-4 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl mb-4">
              <h1 className="text-5xl font-bold text-white">
                  <span className="text-cyan-400">Neo</span>Link
              </h1>
            </div>
          <p className="mt-3 text-lg text-slate-300 font-medium">
            🏥 {collegeName}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            PICU/NICU Medical Records Management System
          </p>
          <h2 className="mt-8 text-2xl font-bold text-white">
            Select Your Role to Continue
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Choose your role to access the appropriate features
          </p>
        </div>
        <form className="mt-8 space-y-8" onSubmit={handleLogin}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <RoleCard role={UserRole.Admin} icon={<AdminIcon className="w-8 h-8 text-cyan-300"/>} selectedRole={selectedRole} setSelectedRole={setSelectedRole}/>
            <RoleCard role={UserRole.Doctor} icon={<DoctorIcon className="w-8 h-8 text-cyan-300"/>} selectedRole={selectedRole} setSelectedRole={setSelectedRole}/>
            <RoleCard role={UserRole.Nurse} icon={<NurseIcon className="w-8 h-8 text-cyan-300"/>} selectedRole={selectedRole} setSelectedRole={setSelectedRole}/>
          </div>
          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-base font-semibold rounded-xl text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-slate-800 transition-all shadow-lg hover:shadow-cyan-500/50"
            >
              ✓ Sign In as {selectedRole}
            </button>
          </div>
        </form>
        <div className="text-center text-xs text-slate-500 pt-4 border-t border-slate-700">
          © 2024 NeoLink - Advanced Medical Records System
        </div>
      </div>
    </div>
  );
};

export default Login;
