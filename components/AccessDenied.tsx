import React from 'react';
import { logout } from '../services/authService';

const AccessDenied: React.FC = () => {
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-sm rounded-3xl p-8 text-center border border-red-500/20 shadow-2xl">
        {/* Icon */}
        <div className="mb-6">
          <div className="w-24 h-24 mx-auto bg-red-500/10 rounded-full flex items-center justify-center border-4 border-red-500/30">
            <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white mb-3">Access Denied</h1>
        
        {/* Message */}
        <p className="text-slate-300 mb-2">
          Your email address is not approved by the institution administrator.
        </p>
        <p className="text-slate-400 text-sm mb-8">
          Please contact your institution administrator to request access to this system.
        </p>

        {/* Info Box */}
        <div className="bg-slate-700/50 rounded-lg p-4 mb-6 text-left">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">What to do:</h3>
          <ul className="text-sm text-slate-400 space-y-1">
            <li>• Contact your institution administrator</li>
            <li>• Provide your email address</li>
            <li>• Wait for approval</li>
            <li>• Try logging in again</li>
          </ul>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full px-6 py-3 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-sky-500/50"
        >
          Logout
        </button>

        {/* Footer */}
        <p className="text-xs text-slate-500 mt-6">
          NeoLink Medical Records System
        </p>
      </div>
    </div>
  );
};

export default AccessDenied;
