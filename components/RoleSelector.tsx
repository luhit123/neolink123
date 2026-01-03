import React, { useState } from 'react';
import { UserRole } from '../types';
import { updateUserRole } from '../services/firestoreService';

interface RoleSelectorProps {
  userId: string;
  currentRole: UserRole;
  userEmail: string;
  onRoleUpdated: (newRole: UserRole) => void;
}

const RoleSelector: React.FC<RoleSelectorProps> = ({ userId, currentRole, userEmail, onRoleUpdated }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const [updating, setUpdating] = useState(false);

  const handleUpdateRole = async () => {
    if (selectedRole === currentRole) return;
    
    setUpdating(true);
    try {
      await updateUserRole(userId, selectedRole);
      // Success - reload page to apply new role
      window.location.reload();
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Error updating role. Please try again.');
      setUpdating(false);
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">User Role</h3>
          <p className="text-sm text-slate-400">{userEmail}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as UserRole)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            disabled={updating}
          >
            <option value={UserRole.SuperAdmin}>Super Administrator</option>
            <option value={UserRole.InstitutionAdmin}>Institution Administrator</option>
            <option value={UserRole.Admin}>Administrator</option>
            <option value={UserRole.Doctor}>Doctor</option>
            <option value={UserRole.Nurse}>Nurse</option>
          </select>
          {selectedRole !== currentRole && (
            <button
              onClick={handleUpdateRole}
              disabled={updating}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {updating ? 'Updating...' : 'Update Role'}
            </button>
          )}
        </div>
      </div>
      {selectedRole !== currentRole && (
        <div className="mt-4 p-3 bg-blue-500/10 border border-sky-500/30 rounded-lg">
          <p className="text-sm text-sky-300">
            ℹ️ Click "Update Role" to save. The page will automatically refresh to apply the changes.
          </p>
        </div>
      )}
    </div>
  );
};

export default RoleSelector;
