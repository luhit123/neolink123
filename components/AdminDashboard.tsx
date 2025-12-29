import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { InstitutionUser, UserRole } from '../types';

interface AdminDashboardProps {
  institutionId: string;
  institutionName: string;
  adminEmail: string;
  onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  institutionId,
  institutionName,
  adminEmail,
  onBack
}) => {
  const [users, setUsers] = useState<InstitutionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [newInstitutionName, setNewInstitutionName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRoles, setNewUserRoles] = useState<UserRole[]>([]);

  useEffect(() => {
    loadUsers();
  }, [institutionId]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'approved_users');
      const q = query(usersRef, where('institutionId', '==', institutionId));
      const snapshot = await getDocs(q);

      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      } as InstitutionUser & { id: string }));

      setUsers(data);
      console.log('✅ Loaded institution users:', data.length);
    } catch (err: any) {
      console.error('❌ Error loading users:', err);
      setError('Failed to load users: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newUserEmail.trim() || !newUserEmail.includes('@')) {
      setError('Valid email is required');
      return;
    }

    if (!newUserName.trim()) {
      setError('User name is required');
      return;
    }

    if (newUserRoles.length === 0) {
      setError('At least one role must be selected');
      return;
    }

    // Check if user already exists with ANY of the selected roles
    const existingUsers = users.filter(u => u.email.toLowerCase() === newUserEmail.toLowerCase().trim());
    const conflictingRoles = newUserRoles.filter(role =>
      existingUsers.some(user => user.role === role)
    );

    if (conflictingRoles.length > 0) {
      setError(`This email already has the following role(s): ${conflictingRoles.join(', ')}`);
      return;
    }

    try {
      const usersRef = collection(db, 'approved_users');
      const addPromises = newUserRoles.map(async (role) => {
        const newUser: Omit<InstitutionUser, 'uid'> & { uid: string } = {
          uid: '', // Will be set when user first logs in
          email: newUserEmail.trim().toLowerCase(),
          displayName: newUserName.trim(),
          role: role,
          institutionId,
          institutionName,
          addedBy: adminEmail,
          addedAt: new Date().toISOString(),
          enabled: true
        };

        return addDoc(usersRef, newUser);
      });

      await Promise.all(addPromises);
      console.log('✅ User added with roles:', newUserRoles);

      setSuccess(`User "${newUserName}" (${newUserEmail}) added successfully with roles: ${newUserRoles.join(', ')}!`);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserRoles([]);
      setShowAddForm(false);

      loadUsers();
    } catch (err: any) {
      console.error('❌ Error adding user:', err);
      setError('Failed to add user: ' + err.message);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean, userName: string) => {
    const action = currentStatus ? 'disable' : 'enable';
    if (!confirm(`Are you sure you want to ${action} user "${userName}"?`)) {
      return;
    }

    try {
      const userRef = doc(db, 'approved_users', userId);
      await updateDoc(userRef, {
        enabled: !currentStatus
      });
      setSuccess(`User "${userName}" ${action}d successfully`);
      console.log(`✅ User ${action}d:`, userId);
      loadUsers();
    } catch (err: any) {
      console.error('❌ Error updating user status:', err);
      setError('Failed to update user status: ' + err.message);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to permanently remove user "${userName}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'approved_users', userId));
      setSuccess(`User "${userName}" removed successfully`);
      console.log('✅ User deleted:', userId);
      loadUsers();
    } catch (err: any) {
      console.error('❌ Error deleting user:', err);
      setError('Failed to remove user: ' + err.message);
    }
  };

  const handleChangeUserRole = async (userId: string, userName: string, currentRole: UserRole) => {
    const newRole = prompt(`Change role for "${userName}"\n\nCurrent: ${currentRole}\n\nEnter new role (Admin, Doctor, or Nurse):`)?.trim();

    if (!newRole) return;

    if (!['Admin', 'Doctor', 'Nurse'].includes(newRole)) {
      alert('Invalid role. Please enter: Admin, Doctor, or Nurse');
      return;
    }

    try {
      const userRef = doc(db, 'approved_users', userId);
      await updateDoc(userRef, {
        role: newRole as UserRole,
        updatedAt: new Date().toISOString(),
        updatedBy: adminEmail
      });
      setSuccess(`Role updated for "${userName}" to ${newRole}`);
      console.log('✅ User role updated:', userId);
      loadUsers();
    } catch (err: any) {
      console.error('❌ Error updating user role:', err);
      setError('Failed to update user role: ' + err.message);
    }
  };

  const handleChangeUserEmail = async (userId: string, userName: string, currentEmail: string) => {
    const newEmail = prompt(`Change email for "${userName}"\n\nCurrent email: ${currentEmail}`, currentEmail)?.trim().toLowerCase();

    if (!newEmail || !newEmail.includes('@')) {
      alert('Invalid email address');
      return;
    }

    if (newEmail === currentEmail) {
      alert('Email is the same as current email');
      return;
    }

    if (!confirm(`⚠️ WARNING: This will change the email for "${userName}" and revoke access for the old email "${currentEmail}".\n\nThe user will need to login with the new email: ${newEmail}\n\nContinue?`)) {
      return;
    }

    try {
      const userRef = doc(db, 'approved_users', userId);
      await updateDoc(userRef, {
        email: newEmail,
        updatedAt: new Date().toISOString(),
        updatedBy: adminEmail
      });

      setSuccess(`✅ Email updated successfully!\n\nOld email: ${currentEmail}\nNew email: ${newEmail}\n\nThe old email can no longer access the system.`);
      console.log('✅ User email updated:', userId);

      loadUsers();
    } catch (err: any) {
      console.error('❌ Error updating user email:', err);
      setError('Failed to update user email: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-900 dark:to-cyan-900 border-b border-blue-500 dark:border-blue-700 transition-colors duration-200">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Admin Dashboard
              </h1>
              <p className="text-blue-100 dark:text-blue-300 mt-1">{institutionName} - Manage Users</p>
            </div>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2"
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

        {/* Add User Button */}
        {!showAddForm && (
          <div className="mb-6">
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New User
            </button>
          </div>
        )}

        {/* Add User Form */}
        {showAddForm && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-8 border border-cyan-500/20 shadow-lg transition-colors duration-200">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Add New User</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Dr. John Doe"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-2">
                  Roles *
                </label>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="role-admin"
                      checked={newUserRoles.includes(UserRole.Admin)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewUserRoles(prev => [...prev, UserRole.Admin]);
                        } else {
                          setNewUserRoles(prev => prev.filter(role => role !== UserRole.Admin));
                        }
                      }}
                      className="w-4 h-4 text-cyan-600 bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded focus:ring-cyan-500 focus:ring-2"
                    />
                    <label htmlFor="role-admin" className="ml-2 text-slate-700 dark:text-slate-300">
                      <span className="font-medium">Admin</span> - Can manage users and access all data
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="role-doctor"
                      checked={newUserRoles.includes(UserRole.Doctor)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewUserRoles(prev => [...prev, UserRole.Doctor]);
                        } else {
                          setNewUserRoles(prev => prev.filter(role => role !== UserRole.Doctor));
                        }
                      }}
                      className="w-4 h-4 text-cyan-600 bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded focus:ring-cyan-500 focus:ring-2"
                    />
                    <label htmlFor="role-doctor" className="ml-2 text-slate-700 dark:text-slate-300">
                      <span className="font-medium">Doctor</span> - Can view and edit all patient records
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="role-nurse"
                      checked={newUserRoles.includes(UserRole.Nurse)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewUserRoles(prev => [...prev, UserRole.Nurse]);
                        } else {
                          setNewUserRoles(prev => prev.filter(role => role !== UserRole.Nurse));
                        }
                      }}
                      className="w-4 h-4 text-cyan-600 bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded focus:ring-cyan-500 focus:ring-2"
                    />
                    <label htmlFor="role-nurse" className="ml-2 text-slate-700 dark:text-slate-300">
                      <span className="font-medium">Nurse</span> - Can view records and add patient notes
                    </label>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Select one or more roles for this user. They will have access to all selected role capabilities.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Add User
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewUserEmail('');
                    setNewUserName('');
                    setNewUserRoles([]);
                    setError('');
                  }}
                  className="px-6 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users List */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg transition-colors duration-200">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Authorized Users</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {(() => {
                // Group users by email to show multiple roles
                const groupedUsers = users.reduce((acc: any, user) => {
                  const email = user.email;
                  if (!acc[email]) {
                    acc[email] = {
                      id: user.id,
                      email: user.email,
                      displayName: user.displayName,
                      roles: [],
                      enabled: user.enabled,
                      addedAt: user.addedAt,
                      addedBy: user.addedBy,
                      userIds: []
                    };
                  }
                  acc[email].roles.push(user.role);
                  acc[email].userIds.push(user.id);
                  return acc;
                }, {});
                return Object.keys(groupedUsers).length;
              })()} user{(() => {
                const groupedUsers = users.reduce((acc: any, user) => {
                  const email = user.email;
                  if (!acc[email]) {
                    acc[email] = {
                      id: user.id,
                      email: user.email,
                      displayName: user.displayName,
                      roles: [],
                      enabled: user.enabled,
                      addedAt: user.addedAt,
                      addedBy: user.addedBy,
                      userIds: []
                    };
                  }
                  acc[email].roles.push(user.role);
                  acc[email].userIds.push(user.id);
                  return acc;
                }, {});
                return Object.keys(groupedUsers).length !== 1 ? 's' : '';
              })()} in your institution
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
              <p className="text-slate-500 dark:text-slate-400 mt-4">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p>No users added yet</p>
              <p className="text-sm mt-2">Click "Add New User" to get started</p>
            </div>
          ) : (() => {
            // Group users by email to show multiple roles
            const groupedUsers = users.reduce((acc: any, user) => {
              const email = user.email;
              if (!acc[email]) {
                acc[email] = {
                  id: user.id,
                  email: user.email,
                  displayName: user.displayName,
                  roles: [],
                  enabled: user.enabled,
                  addedAt: user.addedAt,
                  addedBy: user.addedBy,
                  userIds: []
                };
              }
              acc[email].roles.push(user.role);
              acc[email].userIds.push(user.id);
              return acc;
            }, {});

            return (
              <>
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {Object.values(groupedUsers).map((user: any) => (
                    <div key={user.email} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                              {user.displayName}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${user.enabled
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                              }`}>
                              {user.enabled ? 'Active' : 'Disabled'}
                            </span>
                            <div className="flex gap-1">
                              {user.roles.map((role: UserRole) => (
                                <span key={role} className={`px-3 py-1 rounded-full text-xs font-semibold ${role === UserRole.Admin
                                  ? 'bg-purple-500/20 text-purple-400'
                                  : role === UserRole.Doctor
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-cyan-500/20 text-cyan-400'
                                  }`}>
                                  {role}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1 text-sm">
                            <p className="text-slate-600 dark:text-slate-300">
                              <span className="text-slate-500">Email:</span>{' '}
                              <span className="text-cyan-600 dark:text-cyan-400">{user.email}</span>
                            </p>
                            <p className="text-slate-500 dark:text-slate-400">
                              <span className="text-slate-500">Roles:</span>{' '}
                              <span className="text-slate-700 dark:text-slate-300">{user.roles.join(', ')}</span>
                            </p>
                            <p className="text-slate-500 dark:text-slate-400">
                              <span className="text-slate-500">Added:</span>{' '}
                              {new Date(user.addedAt).toLocaleString()}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400">
                              <span className="text-slate-500">Added By:</span> {user.addedBy}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleChangeUserRole(user.userIds[0], user.displayName, user.roles[0])}
                            className="px-4 py-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors text-sm font-medium"
                            title="Change role"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleChangeUserEmail(user.userIds[0], user.displayName, user.email)}
                            className="px-4 py-2 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded-lg transition-colors text-sm font-medium"
                            title="Change email"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(user.userIds[0], user.enabled, user.displayName)}
                            className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${user.enabled
                              ? 'text-orange-400 hover:text-orange-300 hover:bg-orange-500/10'
                              : 'text-green-400 hover:text-green-300 hover:bg-green-500/10'
                              }`}
                            title={user.enabled ? 'Disable all roles' : 'Enable all roles'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {user.enabled ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              )}
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.userIds[0], user.displayName)}
                            className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium"
                            title="Remove all roles"
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
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
