import React, { useState, useEffect } from 'react';
import { Institution } from '../types';
import { getAllInstitutions, addInstitution, updateInstitution } from '../services/adminService';

interface SuperAdminDashboardProps {
  userEmail: string;
  onBack: () => void;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ userEmail, onBack }) => {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingInstitution, setEditingInstitution] = useState<Institution | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    district: '',
    state: 'Assam',
    adminEmail: ''
  });

  useEffect(() => {
    loadInstitutions();
  }, []);

  const loadInstitutions = async () => {
    setLoading(true);
    const data = await getAllInstitutions();
    setInstitutions(data);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingInstitution) {
        await updateInstitution(editingInstitution.id, {
          name: formData.name,
          location: { district: formData.district, state: formData.state },
          adminEmail: formData.adminEmail
        });
      } else {
        await addInstitution(
          formData.name,
          formData.district,
          formData.state,
          formData.adminEmail,
          userEmail
        );
      }
      
      setFormData({ name: '', district: '', state: 'Assam', adminEmail: '' });
      setShowAddForm(false);
      setEditingInstitution(null);
      loadInstitutions();
    } catch (error) {
      console.error('Error saving institution:', error);
      alert('Error saving institution');
    }
  };

  const handleEdit = (institution: Institution) => {
    setEditingInstitution(institution);
    setFormData({
      name: institution.name,
      district: institution.location.district,
      state: institution.location.state,
      adminEmail: institution.adminEmail
    });
    setShowAddForm(true);
  };

  const handleToggleEnabled = async (institution: Institution) => {
    try {
      await updateInstitution(institution.id, { enabled: !institution.enabled });
      loadInstitutions();
    } catch (error) {
      console.error('Error toggling institution:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Super Administrator Dashboard</h1>
            <p className="text-slate-400">Manage institutions and system settings</p>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            ← Back to App
          </button>
        </div>

        {/* Add Institution Button */}
        <div className="mb-6">
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setEditingInstitution(null);
              setFormData({ name: '', district: '', state: 'Assam', adminEmail: '' });
            }}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors"
          >
            + Add New Institution
          </button>
        </div>

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingInstitution ? 'Edit Institution' : 'Add New Institution'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Institution Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="e.g., Nalbari Medical College"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    District *
                  </label>
                  <input
                    type="text"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="e.g., Nalbari"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Administrator Email *
                  </label>
                  <input
                    type="email"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="admin@institution.edu"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors"
                >
                  {editingInstitution ? 'Update Institution' : 'Add Institution'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingInstitution(null);
                  }}
                  className="px-6 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Institutions List */}
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-bold text-white">All Institutions</h2>
            <p className="text-sm text-slate-400 mt-1">{institutions.length} institutions</p>
          </div>
          
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
              <p className="text-slate-400 mt-4">Loading institutions...</p>
            </div>
          ) : institutions.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-400">No institutions added yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {institutions.map((institution) => (
                <div key={institution.id} className="p-6 hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{institution.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          institution.enabled 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {institution.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-slate-400">
                        <p>📍 {institution.location.district}, {institution.location.state}</p>
                        <p>👤 Admin: {institution.adminEmail}</p>
                        <p className="text-xs">Created: {new Date(institution.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(institution)}
                        className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleEnabled(institution)}
                        className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                          institution.enabled
                            ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400'
                            : 'bg-green-600/20 hover:bg-green-600/30 text-green-400'
                        }`}
                      >
                        {institution.enabled ? 'Disable' : 'Enable'}
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

export default SuperAdminDashboard;
