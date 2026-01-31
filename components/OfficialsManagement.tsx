import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Official, Institution } from '../types';
import { generateAlphanumericPassword } from '../utils/passwordUtils';
import CredentialsModal from './CredentialsModal';

interface OfficialsManagementProps {
  userEmail: string;
  institutions: Institution[];
}

const OfficialsManagement: React.FC<OfficialsManagementProps> = ({ userEmail, institutions }) => {
  const [officials, setOfficials] = useState<Official[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingOfficial, setEditingOfficial] = useState<Official | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    designation: '',
    department: '',
    district: '',
    state: '',
    phoneNumber: '',
    userID: '',
    password: '',
    canViewAllInstitutions: true,
    assignedInstitutionIds: [] as string[],
  });

  // Credentials modal
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState({
    userName: '',
    userEmail: '',
    userID: '',
    password: '',
    userType: 'Official'
  });

  // Load officials
  useEffect(() => {
    const officialsRef = collection(db, 'officials');
    const unsubscribe = onSnapshot(
      officialsRef,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
        } as Official));
        setOfficials(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading officials:', err);
        setError('Failed to load officials');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Auto-generate UserID and Password
  useEffect(() => {
    if (showAddForm && !editingOfficial) {
      // Generate UserID (OFF001, OFF002, etc.)
      const existingUserIDs = officials.map(o => o.userID).filter(Boolean);
      let nextNum = 1;
      while (existingUserIDs.includes(`OFF${String(nextNum).padStart(3, '0')}`)) {
        nextNum++;
      }
      const generatedUserID = `OFF${String(nextNum).padStart(3, '0')}`;
      const generatedPassword = generateAlphanumericPassword();

      setFormData(prev => ({
        ...prev,
        userID: generatedUserID,
        password: generatedPassword
      }));
    }
  }, [showAddForm, editingOfficial, officials]);

  const resetForm = () => {
    setFormData({
      email: '',
      displayName: '',
      designation: '',
      department: '',
      district: '',
      state: '',
      phoneNumber: '',
      userID: '',
      password: '',
      canViewAllInstitutions: true,
      assignedInstitutionIds: [],
    });
    setEditingOfficial(null);
    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.displayName.trim()) {
      setError('Name is required');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Valid email is required');
      return;
    }
    if (!formData.designation.trim()) {
      setError('Designation is required');
      return;
    }
    if (!formData.userID.trim()) {
      setError('UserID is required');
      return;
    }
    if (!formData.password.trim() || formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      if (editingOfficial) {
        // Update existing official
        const officialRef = doc(db, 'officials', editingOfficial.id);
        await updateDoc(officialRef, {
          email: formData.email.trim().toLowerCase(),
          displayName: formData.displayName.trim(),
          designation: formData.designation.trim(),
          department: formData.department.trim(),
          district: formData.district.trim(),
          state: formData.state.trim(),
          phoneNumber: formData.phoneNumber.trim(),
          userID: formData.userID.trim(),
          password: formData.password,
          canViewAllInstitutions: formData.canViewAllInstitutions,
          assignedInstitutionIds: formData.canViewAllInstitutions ? [] : formData.assignedInstitutionIds,
          updatedAt: new Date().toISOString(),
          updatedBy: userEmail
        });
        setSuccess(`Official "${formData.displayName}" updated successfully!`);
        resetForm();
      } else {
        // Create new official
        const officialsRef = collection(db, 'officials');
        const newOfficial = {
          email: formData.email.trim().toLowerCase(),
          displayName: formData.displayName.trim(),
          designation: formData.designation.trim(),
          department: formData.department.trim(),
          district: formData.district.trim(),
          state: formData.state.trim(),
          phoneNumber: formData.phoneNumber.trim(),
          userID: formData.userID.trim(),
          password: formData.password,
          canViewAllInstitutions: formData.canViewAllInstitutions,
          assignedInstitutionIds: formData.canViewAllInstitutions ? [] : formData.assignedInstitutionIds,
          enabled: true,
          addedBy: userEmail,
          addedAt: new Date().toISOString()
        };

        await addDoc(officialsRef, newOfficial);

        // Show credentials modal
        setCreatedCredentials({
          userName: formData.displayName.trim(),
          userEmail: formData.email.trim().toLowerCase(),
          userID: formData.userID.trim(),
          password: formData.password,
          userType: 'Official'
        });
        setShowCredentialsModal(true);

        setSuccess(`Official "${formData.displayName}" added successfully!`);
        resetForm();
      }
    } catch (err: any) {
      console.error('Error saving official:', err);
      setError('Failed to save official: ' + err.message);
    }
  };

  const handleEdit = (official: Official) => {
    setFormData({
      email: official.email,
      displayName: official.displayName,
      designation: official.designation,
      department: official.department || '',
      district: official.district || '',
      state: official.state || '',
      phoneNumber: official.phoneNumber || '',
      userID: official.userID,
      password: official.password,
      canViewAllInstitutions: official.canViewAllInstitutions,
      assignedInstitutionIds: official.assignedInstitutionIds || [],
    });
    setEditingOfficial(official);
    setShowAddForm(true);
  };

  const handleToggleStatus = async (official: Official) => {
    try {
      const officialRef = doc(db, 'officials', official.id);
      await updateDoc(officialRef, {
        enabled: !official.enabled,
        updatedAt: new Date().toISOString(),
        updatedBy: userEmail
      });
      setSuccess(`Official ${official.enabled ? 'disabled' : 'enabled'} successfully`);
    } catch (err: any) {
      setError('Failed to update status: ' + err.message);
    }
  };

  const handleDelete = async (official: Official) => {
    if (!confirm(`Are you sure you want to permanently delete "${official.displayName}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'officials', official.id));
      setSuccess(`Official "${official.displayName}" deleted successfully`);
    } catch (err: any) {
      setError('Failed to delete official: ' + err.message);
    }
  };

  const handleInstitutionToggle = (institutionId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedInstitutionIds: prev.assignedInstitutionIds.includes(institutionId)
        ? prev.assignedInstitutionIds.filter(id => id !== institutionId)
        : [...prev.assignedInstitutionIds, institutionId]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Officials Management</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Manage government and health officials with read-only access to institution dashboards
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowAddForm(true);
          }}
          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Official
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-500">
          {success}
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
            {editingOfficial ? 'Edit Official' : 'Add New Official'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Dr. John Doe"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="official@health.gov.in"
                />
              </div>

              {/* Designation */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Designation *
                </label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="District Health Officer"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Health Department"
                />
              </div>

              {/* District */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  District
                </label>
                <input
                  type="text"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Kamrup"
                />
              </div>

              {/* State */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="Assam"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="+91 9876543210"
                />
              </div>

              {/* UserID */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  UserID *
                </label>
                <input
                  type="text"
                  value={formData.userID}
                  onChange={(e) => setFormData({ ...formData, userID: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="OFF001"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    placeholder="Auto-generated"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, password: generateAlphanumericPassword() })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-sky-500 hover:text-sky-600 text-sm"
                  >
                    Generate
                  </button>
                </div>
              </div>
            </div>

            {/* Access Control */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
              <h4 className="font-semibold text-slate-800 dark:text-white mb-3">Access Control</h4>

              <label className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  checked={formData.canViewAllInstitutions}
                  onChange={(e) => setFormData({ ...formData, canViewAllInstitutions: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                />
                <span className="text-slate-700 dark:text-slate-300">
                  Can view ALL institutions (recommended for state/national level officials)
                </span>
              </label>

              {!formData.canViewAllInstitutions && (
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                    Select specific institutions this official can view:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    {institutions.map((inst) => (
                      <label key={inst.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.assignedInstitutionIds.includes(inst.id)}
                          onChange={() => handleInstitutionToggle(inst.id)}
                          className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                          {inst.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg font-semibold hover:from-sky-600 hover:to-blue-700 transition-all"
              >
                {editingOfficial ? 'Update Official' : 'Add Official'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Officials List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Official
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Designation
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Credentials
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Access
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {officials.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No officials added yet. Click "Add Official" to get started.
                  </td>
                </tr>
              ) : (
                officials.map((official) => (
                  <tr key={official.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-medium text-slate-800 dark:text-white">
                          {official.displayName}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {official.email}
                        </div>
                        {official.phoneNumber && (
                          <div className="text-xs text-slate-400 dark:text-slate-500">
                            {official.phoneNumber}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-medium text-slate-700 dark:text-slate-300">
                          {official.designation}
                        </div>
                        {official.department && (
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {official.department}
                          </div>
                        )}
                        {official.district && (
                          <div className="text-xs text-slate-400 dark:text-slate-500">
                            {official.district}, {official.state}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        <div className="text-slate-700 dark:text-slate-300">
                          <span className="text-slate-500">ID:</span> {official.userID}
                        </div>
                        <div className="text-slate-700 dark:text-slate-300">
                          <span className="text-slate-500">Pass:</span> {official.password}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {official.canViewAllInstitutions ? (
                        <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded text-xs font-medium">
                          All Institutions
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-xs font-medium">
                          {official.assignedInstitutionIds?.length || 0} Institutions
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        official.enabled
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        {official.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(official)}
                          className="p-2 text-slate-500 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleToggleStatus(official)}
                          className={`p-2 rounded-lg transition-colors ${
                            official.enabled
                              ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                              : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                          }`}
                          title={official.enabled ? 'Disable' : 'Enable'}
                        >
                          {official.enabled ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(official)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-indigo-100 dark:border-indigo-800/30">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
            <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-indigo-900 dark:text-indigo-300">About Officials</h4>
            <p className="text-sm text-indigo-700 dark:text-indigo-400 mt-1">
              Officials are government or health department personnel who need <strong>view-only access</strong> to institution dashboards for monitoring purposes.
              They can:
            </p>
            <ul className="text-sm text-indigo-700 dark:text-indigo-400 mt-2 space-y-1 list-disc list-inside">
              <li>View dashboards of assigned institutions</li>
              <li>Request reports from institution admins</li>
              <li>Receive PDF reports and notes from admins</li>
            </ul>
            <p className="text-sm text-indigo-700 dark:text-indigo-400 mt-2">
              They <strong>cannot</strong> modify any data, add patients, or export raw data.
            </p>
          </div>
        </div>
      </div>

      {/* Credentials Modal */}
      {showCredentialsModal && (
        <CredentialsModal
          userName={createdCredentials.userName}
          userEmail={createdCredentials.userEmail}
          userID={createdCredentials.userID}
          password={createdCredentials.password}
          userType={createdCredentials.userType}
          onClose={() => setShowCredentialsModal(false)}
        />
      )}
    </div>
  );
};

export default OfficialsManagement;
