import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Institution, UserRole, Unit } from '../types';
import { ASSAM_DISTRICTS, INSTITUTION_TYPES } from '../constants';

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
  const [selectedFacilities, setSelectedFacilities] = useState<Unit[]>([Unit.NICU, Unit.PICU]);
  const [selectedDistrict, setSelectedDistrict] = useState(ASSAM_DISTRICTS[0]);
  const [institutionType, setInstitutionType] = useState(INSTITUTION_TYPES[0]);
  const [customInstitutionType, setCustomInstitutionType] = useState('');
  const [editingInstitution, setEditingInstitution] = useState<Institution | null>(null);
  const [managingUsersFor, setManagingUsersFor] = useState<Institution | null>(null);
  const [institutionUsers, setInstitutionUsers] = useState<any[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);

  // Real-time listener for institutions
  useEffect(() => {
    setLoading(true);
    const institutionsRef = collection(db, 'institutions');

    const unsubscribe = onSnapshot(
      institutionsRef,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
        } as Institution));
        setInstitutions(data);
        setLoading(false);
        console.log('✅ Real-time update: Loaded', data.length, 'institutions');
      },
      (err) => {
        console.error('❌ Error loading institutions:', err);
        setError('Failed to load institutions: ' + err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time listener for patients (when viewing data tab)
  useEffect(() => {
    if (activeTab !== 'data') return;

    setPatientsLoading(true);
    const patientsRef = collection(db, 'patients');

    const q = selectedInstitution === 'all'
      ? patientsRef
      : query(patientsRef, where('institutionId', '==', selectedInstitution));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
        }));
        setPatients(data);
        setPatientsLoading(false);
        console.log('✅ Real-time update: Loaded', data.length, 'patients');
      },
      (err) => {
        console.error('❌ Error loading patients:', err);
        setPatientsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeTab, selectedInstitution]);

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
      if (editingInstitution) {
        // Edit Mode
        const institutionRef = doc(db, 'institutions', editingInstitution.id);
        const updatedInstitution = {
          name: newInstitutionName.trim(),
          facilities: selectedFacilities,
          district: selectedDistrict,
          institutionType: institutionType === 'Other' ? customInstitutionType.trim() : institutionType,
          // Admin email and roles not updated here for simplicity, focusing on institution details
        };

        await updateDoc(institutionRef, updatedInstitution);
        setSuccess(`✅ Institution "${updatedInstitution.name}" updated successfully!`);

        // Reset and close
        setEditingInstitution(null);
        setNewInstitutionName('');
        setNewAdminEmail('');
        setNewAdminRoles([UserRole.Admin]);
        setSelectedFacilities([Unit.NICU, Unit.PICU]);
        setSelectedDistrict(ASSAM_DISTRICTS[0]);
        setInstitutionType(INSTITUTION_TYPES[0]);
        setCustomInstitutionType('');
        setShowAddForm(false);
      } else {
        // Create Mode
        const institutionsRef = collection(db, 'institutions');
        const newInstitution = {
          name: newInstitutionName.trim(),
          adminEmail: newAdminEmail.trim().toLowerCase(),
          facilities: selectedFacilities,
          district: selectedDistrict,
          institutionType: institutionType === 'Other' ? customInstitutionType.trim() : institutionType,
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

        setSuccess(`✅ Institution "${newInstitutionName}" added successfully!\n\nAdmin "${newAdminEmail}" can now log in with roles: ${newAdminRoles.join(', ')}.\n\n⚠️ If this admin was previously assigned to another institution, they must LOG OUT completely and LOG BACK IN to see the new institution.`);
        setNewInstitutionName('');
        setNewAdminEmail('');
        setNewAdminRoles([UserRole.Admin]); // Reset to default
        setSelectedFacilities([Unit.NICU, Unit.PICU]);
        setSelectedDistrict(ASSAM_DISTRICTS[0]);
        setInstitutionType(INSTITUTION_TYPES[0]);
        setCustomInstitutionType('');
        setShowAddForm(false);

        // Reload institutions
        // Real-time listener will automatically update
      }
    } catch (err: any) {
      console.error('❌ Error saving institution:', err);
      setError('Failed to save institution: ' + err.message);
    }
  };

  const handleEditInstitution = (institution: Institution) => {
    setEditingInstitution(institution);
    setNewInstitutionName(institution.name);
    setNewAdminEmail(institution.adminEmail); // Read-only in edit usually, but populating
    setSelectedFacilities(institution.facilities || [Unit.NICU, Unit.PICU]);
    setSelectedDistrict(institution.district || ASSAM_DISTRICTS[0]);
    if (institution.institutionType && INSTITUTION_TYPES.includes(institution.institutionType)) {
      setInstitutionType(institution.institutionType);
    } else if (institution.institutionType) {
      setInstitutionType('Other');
      setCustomInstitutionType(institution.institutionType);
    } else {
      setInstitutionType(INSTITUTION_TYPES[0]);
    }
    setShowAddForm(true);
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteInstitution = async (institutionId: string, institutionName: string) => {
    if (!confirm(`Are you sure you want to delete "${institutionName}"? This will delete ALL associated data including approved users and patient records. This action cannot be undone.`)) {
      return;
    }

    try {
      console.log('🗑️ Starting cascade deletion for institution:', institutionId);

      // Step 1: Delete all approved_users entries for this institution
      const approvedUsersQuery = query(
        collection(db, 'approved_users'),
        where('institutionId', '==', institutionId)
      );
      const approvedUsersSnapshot = await getDocs(approvedUsersQuery);

      console.log(`📋 Found ${approvedUsersSnapshot.size} approved users to delete`);

      // Collect UIDs before deleting to clear user cache
      const userUIDs = approvedUsersSnapshot.docs
        .map(userDoc => userDoc.data().uid)
        .filter(uid => uid); // Filter out undefined/empty UIDs

      const userDeletePromises = approvedUsersSnapshot.docs.map(userDoc =>
        deleteDoc(doc(db, 'approved_users', userDoc.id))
      );
      await Promise.all(userDeletePromises);
      console.log('✅ Deleted all approved users');

      // Step 1.5: Clear cached user profiles in users collection
      if (userUIDs.length > 0) {
        console.log(`🧹 Clearing cached profiles for ${userUIDs.length} user(s)`);
        const userCacheClearPromises = userUIDs.map(uid =>
          updateDoc(doc(db, 'users', uid), {
            institutionId: null,
            institutionName: null,
            role: null
          }).catch(err => {
            // Ignore errors if user document doesn't exist
            console.log(`Note: Could not clear cache for UID ${uid}:`, err.message);
          })
        );
        await Promise.all(userCacheClearPromises);
        console.log('✅ Cleared user profile cache');
      }

      // Step 2: Delete all patient records for this institution
      const patientsQuery = query(
        collection(db, 'patients'),
        where('institutionId', '==', institutionId)
      );
      const patientsSnapshot = await getDocs(patientsQuery);

      console.log(`📋 Found ${patientsSnapshot.size} patient records to delete`);

      const patientDeletePromises = patientsSnapshot.docs.map(patientDoc =>
        deleteDoc(doc(db, 'patients', patientDoc.id))
      );
      await Promise.all(patientDeletePromises);
      console.log('✅ Deleted all patient records');

      // Step 3: Delete the institution document itself
      await deleteDoc(doc(db, 'institutions', institutionId));
      console.log('✅ Deleted institution document');

      setSuccess(`Institution "${institutionName}" and all associated data deleted successfully.\n\n⚠️ IMPORTANT: Users who were part of this institution must LOG OUT and LOG BACK IN to see the changes.`);
    } catch (err: any) {
      console.error('❌ Error deleting institution:', err);
      setError('Failed to delete institution: ' + err.message);
    }
  };

  const handleManageUsers = async (institution: Institution) => {
    setManagingUsersFor(institution);
    setIsUsersLoading(true);
    await fetchInstitutionUsers(institution.id);
    setIsUsersLoading(false);
    setError('');
    setSuccess('');
  };

  const fetchInstitutionUsers = async (institutionId: string) => {
    try {
      const q = query(
        collection(db, 'approved_users'),
        where('institutionId', '==', institutionId)
      );
      const snapshot = await getDocs(q);
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInstitutionUsers(users);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const handleAddUserToInstitution = async () => {
    if (!managingUsersFor || !newAdminEmail) return;
    try {
      const approvedUsersRef = collection(db, 'approved_users');
      const addPromises = newAdminRoles.map(async (role) => {
        const adminUser = {
          uid: '',
          email: newAdminEmail.trim().toLowerCase(),
          displayName: role === UserRole.Admin ? 'Admin' : 'Staff',
          role: role,
          institutionId: managingUsersFor.id,
          institutionName: managingUsersFor.name,
          addedBy: userEmail,
          addedAt: new Date().toISOString(),
          enabled: true
        };
        return addDoc(approvedUsersRef, adminUser);
      });
      await Promise.all(addPromises);
      setNewAdminEmail('');
      setNewAdminRoles([UserRole.Admin]);
      setSuccess('User added successfully');
      fetchInstitutionUsers(managingUsersFor.id);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRemoveUser = async (userId: string, uid?: string) => {
    if (!confirm("Remove this user? They will lose access immediately.")) return;
    try {
      await deleteDoc(doc(db, 'approved_users', userId));
      if (uid) {
        await updateDoc(doc(db, 'users', uid), {
          institutionId: null,
          institutionName: null,
          role: null
        }).catch(err => console.log("Cache clear warn", err));
      }
      if (managingUsersFor) fetchInstitutionUsers(managingUsersFor.id);
      setSuccess("User removed.");
    } catch (e: any) {
      console.error(e);
      setError("Failed to remove: " + e.message);
    }
  };

  const closeManageUsers = () => {
    setManagingUsersFor(null);
    setInstitutionUsers([]);
    setNewAdminEmail('');
    setSuccess('');
    setError('');
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
      // Real-time listener will automatically update

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
        // Real-time listener will automatically update
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
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-900 dark:to-indigo-900 border-b border-blue-500 dark:border-blue-700 transition-colors duration-200">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                SuperAdmin Dashboard
              </h1>
              <p className="text-blue-100 dark:text-blue-300 mt-1">Manage institutions and assign admins</p>
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
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
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
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
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
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
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
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-8 border border-sky-500/20 shadow-lg transition-colors duration-200">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                  {editingInstitution ? 'Edit Institution' : 'Add New Institution'}
                </h2>
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
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* District Selection */}
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-medium mb-2">
                        District (Assam) *
                      </label>
                      <select
                        value={selectedDistrict}
                        onChange={(e) => setSelectedDistrict(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
                      >
                        {ASSAM_DISTRICTS.map(district => (
                          <option key={district} value={district}>{district}</option>
                        ))}
                      </select>
                    </div>

                    {/* Institution Type */}
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-medium mb-2">
                        Institution Type *
                      </label>
                      <select
                        value={institutionType}
                        onChange={(e) => setInstitutionType(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors mb-2"
                      >
                        {INSTITUTION_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                        <option value="Other">Other (Custom)</option>
                      </select>
                      {institutionType === 'Other' && (
                        <input
                          type="text"
                          value={customInstitutionType}
                          onChange={(e) => setCustomInstitutionType(e.target.value)}
                          placeholder="Enter custom type"
                          className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
                          required
                        />
                      )}
                    </div>
                  </div>

                  {/* Facilities Selection */}
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-medium mb-2">
                      Available Facilities *
                    </label>
                    <div className="flex flex-wrap gap-4">
                      {Object.values(Unit).map(unit => (
                        <div key={unit} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`facility-${unit}`}
                            checked={selectedFacilities.includes(unit)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedFacilities(prev => [...prev, unit]);
                              } else {
                                // Prevent removing last facility
                                if (selectedFacilities.length > 1) {
                                  setSelectedFacilities(prev => prev.filter(f => f !== unit));
                                } else {
                                  alert('At least one facility must be selected');
                                }
                              }
                            }}
                            className="w-4 h-4 text-blue-600 bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-400 focus:ring-2"
                          />
                          <label htmlFor={`facility-${unit}`} className="ml-2 text-slate-700 dark:text-slate-300 font-medium">
                            {unit === Unit.SNCU ? 'SNCU' : unit === Unit.NICU ? 'NICU' : 'PICU'}
                          </label>
                        </div>
                      ))}
                    </div>
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
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
                      required={!editingInstitution}
                      disabled={!!editingInstitution} // Disable email field in edit mode
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
                          className="w-4 h-4 text-sky-600 bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-400 focus:ring-2"
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
                          className="w-4 h-4 text-sky-600 bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-400 focus:ring-2"
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
                          className="w-4 h-4 text-sky-600 bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-400 focus:ring-2"
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
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      {editingInstitution ? 'Update Institution' : 'Create Institution'}
                    </button>

                    {editingInstitution && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingInstitution(null);
                          setNewInstitutionName('');
                          setNewAdminEmail('');
                          setNewAdminRoles([UserRole.Admin]);
                          setSelectedFacilities([Unit.NICU, Unit.PICU]);
                          setSelectedDistrict(ASSAM_DISTRICTS[0]);
                          setInstitutionType(INSTITUTION_TYPES[0]);
                          setCustomInstitutionType('');
                          setShowAddForm(false);
                          setError('');
                        }}
                        className="px-6 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-semibold transition-colors"
                      >
                        Cancel Edit
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setNewInstitutionName('');
                        setNewAdminEmail('');
                        setNewAdminRoles([UserRole.Admin]);
                        setSelectedFacilities([Unit.NICU, Unit.PICU]);
                        setSelectedDistrict(ASSAM_DISTRICTS[0]);
                        setInstitutionType(INSTITUTION_TYPES[0]);
                        setCustomInstitutionType('');
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
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto"></div>
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
                              <span className="text-sky-600 dark:text-sky-400">{institution.adminEmail}</span>
                            </p>
                            <p className="text-slate-500 dark:text-slate-400">
                              <span className="text-slate-500">Created:</span>{' '}
                              {new Date(institution.createdAt).toLocaleString()}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400">
                              <span className="text-slate-500">Created By:</span> {institution.createdBy}
                            </p>
                            {institution.district && (
                              <p className="text-slate-500 dark:text-slate-400">
                                <span className="text-slate-500">Location:</span> {institution.district}
                                {institution.institutionType && ` • ${institution.institutionType}`}
                              </p>
                            )}
                            {institution.facilities && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {institution.facilities.map(facility => (
                                  <span key={facility} className={`text-xs px-2 py-0.5 rounded border ${facility === Unit.NICU ? 'bg-sky-50 text-sky-600 border-sky-200' :
                                    facility === Unit.PICU ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                      'bg-green-50 text-green-600 border-green-200'
                                    }`}>
                                    {facility === Unit.SNCU ? 'SNCU' : facility === Unit.NICU ? 'NICU' : 'PICU'}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleEditInstitution(institution)}
                            className="px-4 py-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors text-sm font-medium"
                            title="Edit institution details"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
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
                className="w-full max-w-md px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
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
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto"></div>
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
                                    'bg-blue-500/20 text-blue-400'
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
      {/* Manage Users Modal */}
      {managingUsersFor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Manage Users: <span className="text-sky-500">{managingUsersFor.name}</span>
              </h2>
              <button
                onClick={closeManageUsers}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {error && (
                <div className="mb-4 bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-300 p-4 rounded-lg flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 bg-green-50 dark:bg-green-500/20 text-green-600 dark:text-green-300 p-4 rounded-lg flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {success}
                </div>
              )}

              {/* Add User Section */}
              <div className="mb-8 bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">Add New User</h3>
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    type="email"
                    placeholder="User Email Address"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                  <div className="flex gap-2">
                    {/* Simple Role Select - just defaulting to Admin for now or reusing existing state */}
                    <button
                      onClick={handleAddUserToInstitution}
                      disabled={!newAdminEmail}
                      className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add User
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Adding a user will give them access to this institution immediately. They must log in with this email.
                </p>
              </div>

              {/* User List */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">Existing Users</h3>
                {isUsersLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500 mx-auto"></div>
                  </div>
                ) : institutionUsers.length === 0 ? (
                  <p className="text-slate-500 text-center italic">No users found for this institution.</p>
                ) : (
                  <ul className="space-y-3">
                    {institutionUsers.map(user => (
                      <li key={user.id} className="bg-white dark:bg-slate-700 p-3 rounded-lg border border-slate-200 dark:border-slate-600 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{user.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-500">
                              {user.role}
                            </span>
                            {user.displayName && <span className="text-xs text-slate-500">({user.displayName})</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveUser(user.id, user.uid)}
                          className="text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                          title="Remove User"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SuperAdminDashboard;
