import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Institution, UserRole } from '../types';
// import { initializeDatabase } from '../databaseInit';

interface SuperAdminDashboardProps {
  userEmail: string;
  onBack: () => void;
  onViewInstitutionDashboard?: (institutionId: string, institutionName: string) => void;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ userEmail, onBack, onViewInstitutionDashboard }) => {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [initLoading, setInitLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'institutions' | 'data'>('institutions');
  const [selectedInstitution, setSelectedInstitution] = useState<string | 'all'>('all');
  const [patients, setPatients] = useState<any[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);

  // Form state
  const [newInstitutionName, setNewInstitutionName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRoles, setNewAdminRoles] = useState<UserRole[]>([UserRole.Admin]);

  useEffect(() => {
    loadInstitutions();
  }, []);

  useEffect(() => {
    if (activeTab === 'data') {
      loadPatients();
    }
  }, [activeTab, selectedInstitution]);

  const loadInstitutions = async () => {
    try {
      setLoading(true);
      const institutionsRef = collection(db, 'institutions');
      const snapshot = await getDocs(institutionsRef);
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
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
      // Step 1: Create the institution
      const institutionsRef = collection(db, 'institutions');
      const newInstitution = {
        name: newInstitutionName.trim(),
        adminEmail: newAdminEmail.trim().toLowerCase(),
        createdAt: new Date().toISOString(),
        createdBy: userEmail
      };

      const institutionDoc = await addDoc(institutionsRef, newInstitution);
      console.log('✅ Institution added:', newInstitution);

      // Step 2: Automatically add the admin to approved_users collection with selected roles
      const approvedUsersRef = collection(db, 'approved_users');
      const addPromises = newAdminRoles.map(async (role) => {
        const adminUser = {
          uid: '', // Will be set when admin first logs in
          email: newAdminEmail.trim().toLowerCase(),
          displayName: 'Admin', // Default name, can be updated later
          role: role,
          institutionId: institutionDoc.id,
          institutionName: newInstitutionName.trim(),
          addedBy: userEmail,
          addedAt: new Date().toISOString(),
          enabled: true
        };

        return addDoc(approvedUsersRef, adminUser);
      });

      await Promise.all(addPromises);
      console.log('✅ Admin added to approved_users with roles:', newAdminRoles);

      setSuccess(`✅ Institution "${newInstitutionName}" added successfully!\n\nAdmin "${newAdminEmail}" can now log in with roles: ${newAdminRoles.join(', ')}.`);
      setNewInstitutionName('');
      setNewAdminEmail('');
      setNewAdminRoles([UserRole.Admin]); // Reset to default
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
    // Get current admin email from institution
    const institution = institutions.find(inst => inst.id === institutionId);
    const currentEmail = institution?.adminEmail;

    if (!currentEmail) {
      alert('Institution not found or no admin email set');
      return;
    }

    const newEmail = prompt(`Enter new admin email for "${institutionName}":\n\nCurrent email: ${currentEmail}`, currentEmail)?.trim().toLowerCase();

    if (!newEmail || !newEmail.includes('@')) {
      alert('Invalid email address');
      return;
    }

    if (newEmail === currentEmail) {
      alert('Email is the same as current email');
      return;
    }

    if (!confirm(`⚠️ WARNING: This will update the admin email for "${institutionName}" and revoke access for the old email "${currentEmail}".\n\nUsers with the old email will no longer be able to access the system.\n\nContinue?`)) {
      return;
    }

    try {
      // 1. Update institution admin email
      const institutionRef = doc(db, 'institutions', institutionId);
      await updateDoc(institutionRef, {
        adminEmail: newEmail
      });

      // 2. Find all approved_users entries with the old email for this institution
      const approvedUsersRef = collection(db, 'approved_users');
      const q = query(
        approvedUsersRef,
        where('email', '==', currentEmail),
        where('institutionId', '==', institutionId)
      );
      const snapshot = await getDocs(q);

      // 3. Update all role entries to the new email
      const updatePromises = snapshot.docs.map(document => {
        const docRef = doc(db, 'approved_users', document.id);
        return updateDoc(docRef, {
          email: newEmail,
          updatedAt: new Date().toISOString(),
          updatedBy: 'SuperAdmin'
        });
      });

      await Promise.all(updatePromises);

      setSuccess(`✅ Admin email updated successfully!\n\nOld email: ${currentEmail}\nNew email: ${newEmail}\n\nThe old email can no longer access this institution.`);
      console.log(`✅ Updated ${updatePromises.length} role entries for admin email change`);

      // Reload institutions to show updated email
      loadInstitutions();

    } catch (err: any) {
      console.error('❌ Error updating admin email:', err);
      setError('Failed to update admin email: ' + err.message);
    }
  };

  const handleInitializeDatabase = async () => {
    alert('Database initialization is only available in local development environment.');
  };

  const loadPatients = async () => {
    try {
      setPatientsLoading(true);

      // Query top-level patients collection
      const patientsRef = collection(db, 'patients');

      const patientsSnapshot = selectedInstitution === 'all'
        ? await getDocs(patientsRef)
        : await getDocs(query(patientsRef, where('institutionId', '==', selectedInstitution)));

      const allPatients = patientsSnapshot.docs.map(doc => ({
        ...(doc.data() as any),
        id: doc.id,
      }));

      setPatients(allPatients);
      console.log(`✅ Loaded ${allPatients.length} patients for ${selectedInstitution === 'all' ? 'all institutions' : 'selected institution'}`);
    } catch (err: any) {
      console.error('❌ Error loading patients:', err);
      setError('Failed to load patients: ' + err.message);
    } finally {
      setPatientsLoading(false);
    }
  };

  const handleMigratePatients = async () => {
    if (!confirm('⚠️ MIGRATION WARNING\n\nThis will migrate all patient data from the old nested collection structure to the new top-level "patients" collection.\n\nThis is a ONE-TIME operation needed after the recent update.\n\nContinue?')) {
      return;
    }

    try {
      setPatientsLoading(true);
      setError('');
      console.log('🚀 Starting patient data migration...\n');

      // Get all institutions
      const institutionsSnapshot = await getDocs(collection(db, 'institutions'));
      console.log(`📋 Found ${institutionsSnapshot.size} institution(s)\n`);

      let totalMigrated = 0;
      let totalErrors = 0;

      // For each institution
      for (const institutionDoc of institutionsSnapshot.docs) {
        const institutionId = institutionDoc.id;
        const institutionName = institutionDoc.data().name;
        console.log(`\n🏥 Processing institution: ${institutionName} (${institutionId})`);

        try {
          // Get PICU patients (direct subcollection)
          const picuRef = collection(db, 'institutions', institutionId, 'patientsAdmitted', 'picu');
          const picuSnapshot = await getDocs(picuRef);

          if (!picuSnapshot.empty) {
            console.log(`  📊 Found ${picuSnapshot.size} PICU patients`);

            for (const patientDoc of picuSnapshot.docs) {
              try {
                const patientData = patientDoc.data();
                const patientId = patientDoc.id;

                // Ensure institutionId and institutionName are set
                const migratedData = {
                  ...patientData,
                  institutionId: institutionId,
                  institutionName: institutionName
                };

                // Write to new top-level patients collection
                await setDoc(doc(db, 'patients', patientId), migratedData);
                totalMigrated++;
                console.log(`    ✅ Migrated PICU patient: ${patientData.name || patientId}`);
              } catch (error: any) {
                console.error(`    ❌ Error migrating PICU patient ${patientDoc.id}:`, error.message);
                totalErrors++;
              }
            }
          }

          // Get NICU patients (nested in admission type subcollections)
          for (const admissionType of ['inborn', 'outborn']) {
            const nicuRef = collection(db, 'institutions', institutionId, 'patientsAdmitted', 'nicu', admissionType);
            const nicuSnapshot = await getDocs(nicuRef);

            if (!nicuSnapshot.empty) {
              console.log(`  📊 Found ${nicuSnapshot.size} NICU ${admissionType} patients`);

              for (const patientDoc of nicuSnapshot.docs) {
                try {
                  const patientData = patientDoc.data();
                  const patientId = patientDoc.id;

                  // Ensure institutionId, institutionName, and admissionType are set
                  const migratedData = {
                    ...patientData,
                    institutionId: institutionId,
                    institutionName: institutionName,
                    admissionType: admissionType.charAt(0).toUpperCase() + admissionType.slice(1) // Capitalize
                  };

                  // Write to new top-level patients collection
                  await setDoc(doc(db, 'patients', patientId), migratedData);
                  totalMigrated++;
                  console.log(`    ✅ Migrated NICU ${admissionType} patient: ${patientData.name || patientId}`);
                } catch (error: any) {
                  console.error(`    ❌ Error migrating NICU ${admissionType} patient ${patientDoc.id}:`, error.message);
                  totalErrors++;
                }
              }
            }
          }
        } catch (error: any) {
          console.error(`  ❌ Error processing institution ${institutionId}:`, error.message);
          totalErrors++;
        }
      }

      console.log('\n' + '='.repeat(60));
      console.log('✅ Migration complete!');
      console.log(`📊 Total patients migrated: ${totalMigrated}`);
      console.log(`❌ Total errors: ${totalErrors}`);
      console.log('='.repeat(60) + '\n');

      if (totalMigrated > 0) {
        setSuccess(`✅ Migration successful!\n\n${totalMigrated} patient(s) migrated to the new collection.\n${totalErrors} error(s) encountered.\n\nThe old nested collection data still exists as backup. You can now edit patients normally!`);
        // Reload patients to show migrated data
        await loadPatients();
      } else {
        setSuccess('✅ No patients found to migrate. Your data is already in the new format!');
      }

    } catch (error: any) {
      console.error('❌ Migration failed:', error);
      setError('Migration failed: ' + error.message);
    } finally {
      setPatientsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-900 dark:to-indigo-900 border-b border-purple-500 dark:border-purple-700 transition-colors duration-200">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                SuperAdmin Dashboard
              </h1>
              <p className="text-purple-100 dark:text-purple-300 mt-1">Manage institutions and assign admins</p>
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

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-slate-700 transition-colors duration-200">
          <button
            onClick={() => setActiveTab('institutions')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${activeTab === 'institutions'
              ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Manage Institutions
            </div>
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${activeTab === 'data'
              ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View All Data
            </div>
          </button>
        </div>

        {/* Institutions Management Tab */}
        {activeTab === 'institutions' && (
          <>
            {/* Add Institution Button */}
            {!showAddForm && (
              <div className="mb-6 flex gap-4 flex-wrap">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add New Institution
                </button>

                <button
                  onClick={handleInitializeDatabase}
                  disabled={initLoading}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                  {initLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Initializing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                      Initialize Database
                    </>
                  )}
                </button>

                <button
                  onClick={handleMigratePatients}
                  disabled={patientsLoading}
                  className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                  title="Migrate existing patient data to new collection structure"
                >
                  {patientsLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Migrating...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Migrate Patient Data
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Add Institution Form */}
            {showAddForm && (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-8 border border-cyan-500/20 shadow-lg transition-colors duration-200">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Add New Institution</h2>
                <form onSubmit={handleAddInstitution} className="space-y-4">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-2">
                      Institution Name *
                    </label>
                    <input
                      type="text"
                      value={newInstitutionName}
                      onChange={(e) => setNewInstitutionName(e.target.value)}
                      placeholder="e.g., City Medical Center"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-2">
                      Admin Email *
                    </label>
                    <input
                      type="email"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="admin@example.com"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                      required
                    />
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      This email will be assigned as the Admin for this institution
                    </p>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-2">
                      Admin Roles *
                    </label>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="admin-role-admin"
                          checked={newAdminRoles.includes(UserRole.Admin)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewAdminRoles(prev => [...prev, UserRole.Admin]);
                            } else {
                              // Don't allow removing Admin role
                              if (newAdminRoles.length > 1) {
                                setNewAdminRoles(prev => prev.filter(role => role !== UserRole.Admin));
                              }
                            }
                          }}
                          className="w-4 h-4 text-cyan-600 bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded focus:ring-cyan-500 focus:ring-2"
                          disabled={true} // Always checked, cannot be unchecked
                        />
                        <label htmlFor="admin-role-admin" className="ml-2 text-slate-700 dark:text-slate-300">
                          <span className="font-medium">Admin</span> - Can manage users and access all data
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="admin-role-doctor"
                          checked={newAdminRoles.includes(UserRole.Doctor)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewAdminRoles(prev => [...prev, UserRole.Doctor]);
                            } else {
                              setNewAdminRoles(prev => prev.filter(role => role !== UserRole.Doctor));
                            }
                          }}
                          className="w-4 h-4 text-cyan-600 bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded focus:ring-cyan-500 focus:ring-2"
                        />
                        <label htmlFor="admin-role-doctor" className="ml-2 text-slate-700 dark:text-slate-300">
                          <span className="font-medium">Doctor</span> - Can add/edit patient records and view all data
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="admin-role-nurse"
                          checked={newAdminRoles.includes(UserRole.Nurse)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewAdminRoles(prev => [...prev, UserRole.Nurse]);
                            } else {
                              setNewAdminRoles(prev => prev.filter(role => role !== UserRole.Nurse));
                            }
                          }}
                          className="w-4 h-4 text-cyan-600 bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded focus:ring-cyan-500 focus:ring-2"
                        />
                        <label htmlFor="admin-role-nurse" className="ml-2 text-slate-700 dark:text-slate-300">
                          <span className="font-medium">Nurse</span> - Can add patient drafts and view records
                        </label>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-yellow-400 font-medium">
                      ⚠️ Important: Admin-only users cannot add/edit patients. Check Doctor or Nurse to enable patient management.
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
                        setNewAdminRoles([UserRole.Admin]);
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

            {/* Institutions List */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg transition-colors duration-200">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Institutions</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  {institutions.length} institution{institutions.length !== 1 ? 's' : ''} total
                </p>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
                  <p className="text-slate-500 dark:text-slate-400 mt-4">Loading institutions...</p>
                </div>
              ) : institutions.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <p>No institutions added yet</p>
                  <p className="text-sm mt-2">Click "Add New Institution" to get started</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {institutions.map((institution) => (
                    <div key={institution.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                            {institution.name}
                          </h3>
                          <div className="space-y-1 text-sm">
                            <p className="text-slate-600 dark:text-slate-300">
                              <span className="text-slate-500">Admin Email:</span>{' '}
                              <span className="text-cyan-600 dark:text-cyan-400">{institution.adminEmail}</span>
                            </p>
                            <p className="text-slate-500 dark:text-slate-400">
                              <span className="text-slate-500">Created:</span>{' '}
                              {new Date(institution.createdAt).toLocaleString()}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400">
                              <span className="text-slate-500">Created By:</span> {institution.createdBy}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => onViewInstitutionDashboard?.(institution.id, institution.name)}
                            className="px-4 py-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors text-sm font-medium"
                            title="View full dashboard for this institution"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </button>
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
          </>
        )}

        {/* View All Data Tab */}
        {activeTab === 'data' && (
          <>
            {/* Institution Selector */}
            <div className="mb-6">
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-2">Select Institution</label>
              <select
                value={selectedInstitution}
                onChange={(e) => setSelectedInstitution(e.target.value)}
                className="w-full max-w-md px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
              >
                <option value="all">All Institutions</option>
                {institutions.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </div>

            {/* Patients List */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg transition-colors duration-200">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Patient Records</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  {selectedInstitution === 'all' ? 'Viewing all institutions' : institutions.find(i => i.id === selectedInstitution)?.name || 'Selected institution'}
                </p>
                <p className="text-slate-600 dark:text-slate-300 mt-1">
                  {patients.length} patient{patients.length !== 1 ? 's' : ''} found
                </p>
              </div>

              {patientsLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto"></div>
                  <p className="text-slate-500 dark:text-slate-400 mt-4">Loading patients...</p>
                </div>
              ) : patients.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>No patient records found</p>
                  <p className="text-sm mt-2">Patients will appear here once added by institution admins/doctors</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-100 dark:bg-slate-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Patient Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Age</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Gender</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Diagnosis</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Unit</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Institution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {patients.map((patient: any) => (
                        <tr key={patient.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">{patient.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{patient.age} {patient.ageUnit}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{patient.gender}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{patient.diagnosis}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                            <span className="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400">{patient.unit}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs ${patient.outcome === 'In Progress' ? 'bg-yellow-500/20 text-yellow-400' :
                              patient.outcome === 'Discharged' ? 'bg-green-500/20 text-green-400' :
                                patient.outcome === 'Referred' ? 'bg-blue-500/20 text-blue-400' :
                                  patient.outcome === 'Deceased' ? 'bg-red-500/20 text-red-400' :
                                    'bg-purple-500/20 text-purple-400'
                              }`}>
                              {patient.outcome}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                            {institutions.find(i => i.id === patient.institutionId)?.name || 'Unknown'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
