import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Institution } from '../types';

interface SuperAdminDashboardProps {
  userEmail: string;
  onBack: () => void;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ userEmail, onBack }) => {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [newInstitutionName, setNewInstitutionName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');

  useEffect(() => {
    loadInstitutions();
  }, []);

  const loadInstitutions = async () => {
    try {
      setLoading(true);
      const institutionsRef = collection(db, 'institutions');
      const snapshot = await getDocs(institutionsRef);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Institution));
      setInstitutions(data);
      console.log('✅ Loaded institutions:', data.length);
    } catch (err: any) {
      console.error('❌ Error loading institutions:', err);
      setError('Failed to load institutions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newInstitutionName.trim()) {
      setError('Institution name is required');
      return;
    }

    if (!newAdminEmail.trim() || !newAdminEmail.includes('@')) {
      setError('Valid admin email is required');
      return;
    }

    try {
      const institutionsRef = collection(db, 'institutions');
      const newInstitution = {
        name: newInstitutionName.trim(),
        adminEmail: newAdminEmail.trim().toLowerCase(),
        createdAt: new Date().toISOString(),
        createdBy: userEmail
      };

      await addDoc(institutionsRef, newInstitution);
      console.log('✅ Institution added:', newInstitution);

      setSuccess(`Institution "${newInstitutionName}" added successfully!`);
      setNewInstitutionName('');
      setNewAdminEmail('');
      setShowAddForm(false);

      // Reload institutions
      loadInstitutions();
    } catch (err: any) {
      console.error('❌ Error adding institution:', err);
      setError('Failed to add institution: ' + err.message);
    }
  };

  const handleDeleteInstitution = async (institutionId: string, institutionName: string) => {
    if (!confirm(`Are you sure you want to delete "${institutionName}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'institutions', institutionId));
      setSuccess(`Institution "${institutionName}" deleted successfully`);
      console.log('✅ Institution deleted:', institutionId);
      loadInstitutions();
    } catch (err: any) {
      console.error('❌ Error deleting institution:', err);
      setError('Failed to delete institution: ' + err.message);
    }
  };

  const handleUpdateAdminEmail = async (institutionId: string, institutionName: string) => {
    const newEmail = prompt(`Enter new admin email for "${institutionName}":`)?.trim().toLowerCase();

    if (!newEmail || !newEmail.includes('@')) {
      alert('Invalid email');
      return;
    }

    try {
      const institutionRef = doc(db, 'institutions', institutionId);
      await updateDoc(institutionRef, {
        adminEmail: newEmail
      });
      setSuccess(`Admin email updated for "${institutionName}"`);
      console.log('✅ Admin email updated for institution:', institutionId);
      loadInstitutions();
    } catch (err: any) {
      console.error('❌ Error updating admin email:', err);
      setError('Failed to update admin email: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 border-b border-purple-700">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                SuperAdmin Dashboard
              </h1>
              <p className="text-purple-300 mt-1">Manage institutions and assign admins</p>
            </div>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/50 rounded-lg flex items-center justify-between">
            <p className="text-green-400">{success}</p>
            <button onClick={() => setSuccess('')} className="text-green-400 hover:text-green-300">✕</button>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center justify-between">
            <p className="text-red-400">{error}</p>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">✕</button>
          </div>
        )}

        {/* Add Institution Button */}
        {!showAddForm && (
          <div className="mb-6">
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New Institution
            </button>
          </div>
        )}

        {/* Add Institution Form */}
        {showAddForm && (
          <div className="bg-slate-800 rounded-xl p-6 mb-8 border border-cyan-500/20">
            <h2 className="text-2xl font-bold text-white mb-4">Add New Institution</h2>
            <form onSubmit={handleAddInstitution} className="space-y-4">
              <div>
                <label className="block text-slate-300 font-medium mb-2">
                  Institution Name *
                </label>
                <input
                  type="text"
                  value={newInstitutionName}
                  onChange={(e) => setNewInstitutionName(e.target.value)}
                  placeholder="e.g., Nalbari Medical College & Hospital"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-2">
                  Admin Email *
                </label>
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  required
                />
                <p className="mt-1 text-sm text-slate-400">
                  This email will be assigned as the Admin for this institution
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Create Institution
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewInstitutionName('');
                    setNewAdminEmail('');
                    setError('');
                  }}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
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
            <h2 className="text-2xl font-bold text-white">Institutions</h2>
            <p className="text-slate-400 mt-1">
              {institutions.length} institution{institutions.length !== 1 ? 's' : ''} total
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
              <p className="text-slate-400 mt-4">Loading institutions...</p>
            </div>
          ) : institutions.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p>No institutions added yet</p>
              <p className="text-sm mt-2">Click "Add New Institution" to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {institutions.map((institution) => (
                <div key={institution.id} className="p-6 hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-white mb-2">
                        {institution.name}
                      </h3>
                      <div className="space-y-1 text-sm">
                        <p className="text-slate-300">
                          <span className="text-slate-500">Admin Email:</span>{' '}
                          <span className="text-cyan-400">{institution.adminEmail}</span>
                        </p>
                        <p className="text-slate-400">
                          <span className="text-slate-500">Created:</span>{' '}
                          {new Date(institution.createdAt).toLocaleString()}
                        </p>
                        <p className="text-slate-400">
                          <span className="text-slate-500">Created By:</span> {institution.createdBy}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleUpdateAdminEmail(institution.id, institution.name)}
                        className="px-4 py-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors text-sm font-medium"
                        title="Change admin email"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteInstitution(institution.id, institution.name)}
                        className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium"
                        title="Delete institution"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
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
