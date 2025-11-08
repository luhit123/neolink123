import React, { useState, useEffect } from 'react';
import { ApprovedUser, UserRole } from '../types';
import { getApprovedUsers, addApprovedUser, updateApprovedUser, deleteApprovedUser, getInstitution } from '../services/adminService';

interface InstitutionAdminPanelProps {
  institutionId: string;
  userEmail: string;
  onBack: () => void;
}

const InstitutionAdminPanel: React.FC<InstitutionAdminPanelProps> = ({ institutionId, userEmail, onBack }) => {
  const [users, setUsers] = useState<ApprovedUser[]>([]);
  const [institutionName, setInstitutionName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    role: UserRole.Doctor
  });

  useEffect(() => {
    loadData();
  }, [institutionId]);

  const loadData = async () => {
    setLoading(true);
    const [usersData, institution] = await Promise.all([
      getApprovedUsers(institutionId),
      getInstitution(institutionId)
    ]);
    setUsers(usersData);
    setInstitutionName(institution?.name || '');
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addApprovedUser(institutionId, formData.email, formData.role, userEmail);
      setFormData({ email: '', role: UserRole.Doctor });
      setShowAddForm(false);
      loadData();
    } catch (error) {
      console.error('Error adding user:', error);
      alert('Error adding user. Email may already exist.');
    }
  };

  const handleToggleEnabled = async (user: ApprovedUser) => {
    try {
      await updateApprovedUser(institutionId, user.email, { enabled: !user.enabled });
      loadData();
    } catch (error) {
      console.error('Error toggling user:', error);
    }
  };

  const handleDelete = async (email: string) => {
    if (window.confirm(`Remove access for ${email}?`)) {
      try {
        await deleteApprovedUser(institutionId, email);
        loadData();
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Institution Administrator Panel</h1>
            <p className="text-slate-400">{institutionName}</p>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            ← Back to App
          </button>
        </div>

        {/* Add User Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors"
          >
            + Add New User
          </button>
        </div>

        {/* Add User Form */}
        {showAddForm && (
          <div className="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Add New User</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value={UserRole.Admin}>Administrator</option>
                    <option value={UserRole.Doctor}>Doctor</option>
                    <option value={UserRole.Nurse}>Nurse</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Add User
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users List */}
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-bold text-white">Approved Users</h2>
            <p className="text-sm text-slate-400 mt-1">{users.length} users</p>
          </div>
          
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
              <p className="text-slate-400 mt-4">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-400">No users added yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {users.map((user) => (
                <div key={user.email} className="p-6 hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{user.email}</h3>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          {user.role}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.enabled 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {user.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-slate-400">
                        <p>Approved by: {user.approvedBy}</p>
                        <p className="text-xs">Approved: {new Date(user.approvedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleEnabled(user)}
                        className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                          user.enabled
                            ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400'
                            : 'bg-green-600/20 hover:bg-green-600/30 text-green-400'
                        }`}
                      >
                        {user.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleDelete(user.email)}
                        className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstitutionAdminPanel;
