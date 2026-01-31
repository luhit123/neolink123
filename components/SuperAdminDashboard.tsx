import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, where, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Institution, UserRole, Unit } from '../types';
import { INSTITUTION_TYPES } from '../constants';
import AdmissionIndicationsManager from './AdmissionIndicationsManager';
import MedicationManagementPanel from './MedicationManagementPanel';
import OfficialsManagement from './OfficialsManagement';
import PremiumStatCard from './superadmin/PremiumStatCard';
import SystemHealthPanel from './superadmin/SystemHealthPanel';
import AIInsightsPanel from './superadmin/AIInsightsPanel';
import AdvancedAnalyticsDashboard from './superadmin/AdvancedAnalyticsDashboard';
import STTSettingsPanel from './superadmin/STTSettingsPanel';
import ClinicalNoteAISettingsPanel from './superadmin/ClinicalNoteAISettingsPanel';
import AddressInput, { AddressData } from './forms/AddressInput';
import { generateUserID, getNextSequenceNumber } from '../utils/userIdGenerator';
import { generateSecurePassword, generateAlphanumericPassword } from '../utils/passwordUtils';
import { signUpWithEmail } from '../services/authService';
import { getPasswordResetRequests, approvePasswordResetRequest, rejectPasswordResetRequest, deletePasswordResetRequest } from '../services/passwordResetService';
import { PasswordResetRequest } from '../types';
import CredentialsModal from './CredentialsModal';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'institutions' | 'analytics' | 'indications' | 'medications' | 'officials' | 'passwordReset' | 'settings'>('overview');
  const [showMedicationPanel, setShowMedicationPanel] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<string | 'all'>('all');
  const [patients, setPatients] = useState<any[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalMedications, setTotalMedications] = useState(0);

  // Form state
  const [newInstitutionName, setNewInstitutionName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newAdminRoles, setNewAdminRoles] = useState<UserRole[]>([UserRole.Admin]);
  const [selectedFacilities, setSelectedFacilities] = useState<Unit[]>([Unit.NICU, Unit.PICU]);
  const [institutionAddress, setInstitutionAddress] = useState<AddressData>({});
  const [institutionType, setInstitutionType] = useState(INSTITUTION_TYPES[0]);
  const [customInstitutionType, setCustomInstitutionType] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [editingInstitution, setEditingInstitution] = useState<Institution | null>(null);
  const [managingUsersFor, setManagingUsersFor] = useState<Institution | null>(null);
  const [institutionUsers, setInstitutionUsers] = useState<any[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);

  // Password reset requests state
  const [passwordResetRequests, setPasswordResetRequests] = useState<PasswordResetRequest[]>([]);
  const [resetRequestsLoading, setResetRequestsLoading] = useState(false);
  const [newPasswordForReset, setNewPasswordForReset] = useState<{ [key: string]: string }>({});

  // Manual user credentials state
  const [manualUserID, setManualUserID] = useState('');
  const [manualUserPassword, setManualUserPassword] = useState('');
  const [showManualUserPassword, setShowManualUserPassword] = useState(false);

  // Dashboard access control
  const [selectedDashboards, setSelectedDashboards] = useState<Unit[]>([Unit.NICU, Unit.PICU]);

  // Credentials modal state
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [createdUserCredentials, setCreatedUserCredentials] = useState({
    userName: '',
    userEmail: '',
    userID: '',
    password: '',
    userType: ''
  });

  // Auto-generate UserID and Password when managing users for an institution
  useEffect(() => {
    if (managingUsersFor) {
      // Auto-generate UserID
      const institution = institutions.find(inst => inst.id === managingUsersFor.id);
      const districtName = institution?.district || managingUsersFor.name;
      const districtPrefix = districtName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
      const existingUserIDs = institutionUsers
        .map(u => u.userID)
        .filter(id => id);
      if (institution?.userID) existingUserIDs.push(institution.userID);
      const sequenceNumber = getNextSequenceNumber(existingUserIDs, districtPrefix);
      const generatedUserID = generateUserID(districtName, sequenceNumber);
      setManualUserID(generatedUserID);

      // Auto-generate Password (8-character alphanumeric)
      const generatedPassword = generateAlphanumericPassword();
      setManualUserPassword(generatedPassword);

      console.log('✅ Auto-generated credentials for new user:', {
        userID: generatedUserID,
        password: generatedPassword
      });
    }
  }, [managingUsersFor, institutions, institutionUsers]);

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

  // Real-time listener for overview stats
  useEffect(() => {
    if (activeTab !== 'overview' && activeTab !== 'analytics') return;

    const loadOverviewStats = async () => {
      try {
        setPatientsLoading(true);
        const [patientsSnap, usersSnap, medicationsSnap] = await Promise.all([
          getDocs(collection(db, 'patients')),
          getDocs(collection(db, 'approved_users')),
          getDocs(collection(db, 'medications')),
        ]);

        const allPatients = patientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPatients(allPatients);
        setTotalUsers(usersSnap.size);
        setTotalMedications(medicationsSnap.size);
        setPatientsLoading(false);
      } catch (err) {
        console.error('Error loading overview stats:', err);
        setPatientsLoading(false);
      }
    };

    loadOverviewStats();
  }, [activeTab]);

  // Real-time listener for patients (when viewing data tab)
  useEffect(() => {
    if (activeTab !== 'analytics') return;

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

  // Load password reset requests
  useEffect(() => {
    if (activeTab !== 'passwordReset') return;

    const loadResetRequests = async () => {
      setResetRequestsLoading(true);
      try {
        const requests = await getPasswordResetRequests();
        setPasswordResetRequests(requests);
      } catch (err) {
        console.error('Error loading password reset requests:', err);
      }
      setResetRequestsLoading(false);
    };

    loadResetRequests();
  }, [activeTab]);

  const handleApprovePasswordReset = async (requestId: string) => {
    const password = newPasswordForReset[requestId];
    if (!password || password.length < 8) {
      setError('Please enter a valid password (at least 8 characters)');
      return;
    }

    try {
      await approvePasswordResetRequest(requestId, password, userEmail);
      setSuccess('Password reset approved successfully!');
      setNewPasswordForReset({ ...newPasswordForReset, [requestId]: '' });

      // Reload requests
      const requests = await getPasswordResetRequests();
      setPasswordResetRequests(requests);
    } catch (err: any) {
      setError('Failed to approve password reset: ' + err.message);
    }
  };

  const handleRejectPasswordReset = async (requestId: string) => {
    if (!confirm('Are you sure you want to reject this password reset request?')) {
      return;
    }

    try {
      await rejectPasswordResetRequest(requestId, userEmail);
      setSuccess('Password reset request rejected');

      // Reload requests
      const requests = await getPasswordResetRequests();
      setPasswordResetRequests(requests);
    } catch (err: any) {
      setError('Failed to reject password reset: ' + err.message);
    }
  };

  const handleDeletePasswordReset = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this request?')) {
      return;
    }

    try {
      await deletePasswordResetRequest(requestId);
      setSuccess('Password reset request deleted');

      // Reload requests
      const requests = await getPasswordResetRequests();
      setPasswordResetRequests(requests);
    } catch (err: any) {
      setError('Failed to delete password reset: ' + err.message);
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
      if (editingInstitution) {
        // Edit Mode
        const institutionRef = doc(db, 'institutions', editingInstitution.id);
        const updatedInstitution = {
          name: newInstitutionName.trim(),
          facilities: selectedFacilities,
          address: institutionAddress.address || '',
          village: institutionAddress.village || '',
          postOffice: institutionAddress.postOffice || '',
          pinCode: institutionAddress.pinCode || '',
          district: institutionAddress.district || '',
          state: institutionAddress.state || '',
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
        setInstitutionAddress({});
        setInstitutionType(INSTITUTION_TYPES[0]);
        setCustomInstitutionType('');
        setShowAddForm(false);
      } else {
        // Create Mode
        // Step 1: Generate UserID and Password
        const districtName = institutionAddress.district || 'UNK';
        const existingUserIDs = institutions
          .filter(inst => inst.userID)
          .map(inst => inst.userID!);

        const districtPrefix = districtName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
        const sequenceNumber = getNextSequenceNumber(existingUserIDs, districtPrefix);
        const generatedUserID = generateUserID(districtName, sequenceNumber);

        // Use SuperAdmin-provided password or generate if empty (8-character alphanumeric)
        const finalPassword = adminPassword.trim() || generateAlphanumericPassword();

        const institutionsRef = collection(db, 'institutions');
        const newInstitution = {
          name: newInstitutionName.trim(),
          adminEmail: newAdminEmail.trim().toLowerCase(),
          userID: generatedUserID,
          password: finalPassword, // Store password (SuperAdmin controlled)
          facilities: selectedFacilities,
          address: institutionAddress.address || '',
          village: institutionAddress.village || '',
          postOffice: institutionAddress.postOffice || '',
          pinCode: institutionAddress.pinCode || '',
          district: institutionAddress.district || '',
          state: institutionAddress.state || '',
          institutionType: institutionType === 'Other' ? customInstitutionType.trim() : institutionType,
          createdAt: new Date().toISOString(),
          createdBy: userEmail
        };

        const institutionDoc = await addDoc(institutionsRef, newInstitution);
        console.log('✅ Institution added:', newInstitution);

        // Step 2: Create Firebase Auth account for the admin
        try {
          await signUpWithEmail(
            newAdminEmail.trim().toLowerCase(),
            finalPassword,
            `${newInstitutionName.trim()} Admin`
          );
          console.log('✅ Firebase Auth account created for admin');
        } catch (authError: any) {
          // If account already exists (user signed up with Google), that's OK
          if (!authError.message.includes('already exists')) {
            console.warn('⚠️ Could not create Firebase Auth account:', authError.message);
            // Don't fail the whole process, just log it
          }
        }

        // Step 3: Automatically add the admin to approved_users collection with selected roles
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

        setSuccess(`✅ Institution "${newInstitutionName}" added successfully!\n\n📋 LOGIN CREDENTIALS:\nUserID: ${generatedUserID}\nPassword: ${finalPassword}\n\n⚠️ IMPORTANT: Share these credentials with the admin. They cannot change the password themselves.`);
        setNewInstitutionName('');
        setNewAdminEmail('');
        setNewAdminRoles([UserRole.Admin]); // Reset to default
        setSelectedFacilities([Unit.NICU, Unit.PICU]);
        setInstitutionAddress({});
        setInstitutionType(INSTITUTION_TYPES[0]);
        setCustomInstitutionType('');
        setAdminPassword(''); // Reset password field
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
    setInstitutionAddress({
      address: institution.address || '',
      village: institution.village || '',
      postOffice: institution.postOffice || '',
      pinCode: institution.pinCode || '',
      district: institution.district || '',
      state: institution.state || ''
    });
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
      // Get all existing users in this institution to determine sequence number
      const usersRef = collection(db, 'approved_users');
      const usersQuery = query(usersRef, where('institutionId', '==', managingUsersFor.id));
      const usersSnapshot = await getDocs(usersQuery);

      // Get all existing UserIDs for this institution
      const existingUserIDs = usersSnapshot.docs
        .map(doc => doc.data().userID)
        .filter(id => id); // Filter out undefined/null

      // Also get institution admin's UserID if it exists
      const institution = institutions.find(inst => inst.id === managingUsersFor.id);
      if (institution?.userID) {
        existingUserIDs.push(institution.userID);
      }

      // Generate UserID using institution's district or name prefix
      const districtName = institution?.district || managingUsersFor.name;
      const districtPrefix = districtName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
      const sequenceNumber = getNextSequenceNumber(existingUserIDs, districtPrefix);
      // Use manual UserID if provided, otherwise generate
      const finalUserID = manualUserID.trim() || generateUserID(districtName, sequenceNumber);

      // Use manual password if provided, otherwise generate (8-character alphanumeric)
      const finalPassword = manualUserPassword.trim() || generateAlphanumericPassword();

      // Create Firebase Auth account
      try {
        await signUpWithEmail(
          newAdminEmail.trim().toLowerCase(),
          finalPassword,
          newAdminRoles[0] === UserRole.Doctor ? 'Doctor' :
            newAdminRoles[0] === UserRole.Nurse ? 'Nurse' : 'Staff'
        );
        console.log('✅ Firebase Auth account created for user');
      } catch (authError: any) {
        // If account already exists, that's OK
        if (!authError.message.includes('already exists')) {
          console.warn('⚠️ Could not create Firebase Auth account:', authError.message);
        }
      }

      const approvedUsersRef = collection(db, 'approved_users');
      const addPromises = newAdminRoles.map(async (role) => {
        const adminUser = {
          uid: '',
          email: newAdminEmail.trim().toLowerCase(),
          phoneNumber: newAdminPhone.trim(), // Add phone number for OTP login
          displayName: newAdminRoles[0] === UserRole.Doctor ? 'Doctor' :
            newAdminRoles[0] === UserRole.Nurse ? 'Nurse' : 'Staff',
          role: role,
          institutionId: managingUsersFor.id,
          institutionName: managingUsersFor.name,
          addedBy: userEmail,
          addedAt: new Date().toISOString(),
          enabled: true,
          userID: finalUserID,
          password: finalPassword,
          allowedDashboards: selectedDashboards.length > 0 ? selectedDashboards : [Unit.NICU, Unit.PICU] // Default to NICU and PICU if none selected
        };
        return addDoc(approvedUsersRef, adminUser);
      });
      await Promise.all(addPromises);

      // Show credentials modal
      setCreatedUserCredentials({
        userName: newAdminRoles[0] === UserRole.Doctor ? 'Doctor' :
          newAdminRoles[0] === UserRole.Nurse ? 'Nurse' : 'Staff',
        userEmail: newAdminEmail.trim().toLowerCase(),
        userID: finalUserID,
        password: finalPassword,
        userType: newAdminRoles[0] === UserRole.Doctor ? 'Doctor' :
          newAdminRoles[0] === UserRole.Nurse ? 'Nurse' : 'Admin'
      });
      setShowCredentialsModal(true);

      setNewAdminEmail('');
      setNewAdminPhone('');
      setNewAdminRoles([UserRole.Admin]);
      setManualUserID('');
      setManualUserPassword('');
      setSelectedDashboards([Unit.NICU, Unit.PICU]); // Reset to default
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
    setNewAdminPhone('');
    setManualUserID('');
    setManualUserPassword('');
    setSelectedDashboards([Unit.NICU, Unit.PICU]);
    setShowManualUserPassword(false);
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
        <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-slate-700 transition-colors duration-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'overview'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
              </svg>
              Overview
            </div>
          </button>
          <button
            onClick={() => setActiveTab('institutions')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'institutions'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Institutions
            </div>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'analytics'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analytics
            </div>
          </button>
          <button
            onClick={() => setActiveTab('indications')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'indications'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Indications
            </div>
          </button>
          <button
            onClick={() => setActiveTab('medications')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'medications'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              Medications
            </div>
          </button>
          <button
            onClick={() => setActiveTab('officials')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'officials'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Officials
            </div>
          </button>
          <button
            onClick={() => setActiveTab('passwordReset')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'passwordReset'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Password Resets
              {passwordResetRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                  {passwordResetRequests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${activeTab === 'settings'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </div>
          </button>
        </div>

        {/* Overview Tab - World-Class Dashboard */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <PremiumStatCard
                title="Total Institutions"
                value={institutions.length}
                subtitle={`Across ${new Set(institutions.map(i => i.district)).size} districts`}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
                color="blue"
              />

              <PremiumStatCard
                title="Total Patients"
                value={patients.length}
                subtitle={`${patients.filter((p: any) => p.outcome === 'In Progress').length} active`}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                }
                color="green"
                trend={{
                  value: 12.5,
                  isPositive: true,
                  label: 'vs last month'
                }}
              />

              <PremiumStatCard
                title="System Users"
                value={totalUsers}
                subtitle="Active healthcare professionals"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                }
                color="purple"
              />

              <PremiumStatCard
                title="Medications DB"
                value={totalMedications}
                subtitle="Available in autocomplete"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                }
                color="orange"
                trend={{
                  value: totalMedications >= 100 ? 100 : (totalMedications / 100) * 100,
                  isPositive: totalMedications >= 50,
                  label: totalMedications >= 100 ? 'Complete' : 'Seed more'
                }}
              />
            </div>

            {/* System Health and AI Insights Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SystemHealthPanel />
              <AIInsightsPanel />
            </div>

            {/* Quick Actions Panel */}
            <div className="backdrop-blur-xl bg-white/90 rounded-2xl border-2 border-slate-200 shadow-xl p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  onClick={() => setActiveTab('institutions')}
                  className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 border-2 border-blue-200 rounded-xl transition-all hover:shadow-lg group"
                >
                  <svg className="w-8 h-8 text-blue-600 mx-auto mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <p className="text-sm font-semibold text-slate-700">Add Institution</p>
                </button>

                <button
                  onClick={() => setActiveTab('medications')}
                  className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 border-2 border-purple-200 rounded-xl transition-all hover:shadow-lg group"
                >
                  <svg className="w-8 h-8 text-purple-600 mx-auto mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  <p className="text-sm font-semibold text-slate-700">Manage Meds</p>
                </button>

                <button
                  onClick={() => setActiveTab('analytics')}
                  className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border-2 border-green-200 rounded-xl transition-all hover:shadow-lg group"
                >
                  <svg className="w-8 h-8 text-green-600 mx-auto mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-sm font-semibold text-slate-700">View Analytics</p>
                </button>

                <button
                  onClick={() => setActiveTab('indications')}
                  className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 border-2 border-orange-200 rounded-xl transition-all hover:shadow-lg group"
                >
                  <svg className="w-8 h-8 text-orange-600 mx-auto mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <p className="text-sm font-semibold text-slate-700">Indications</p>
                </button>
              </div>
            </div>
          </div>
        )}

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

                  {/* Address Information with PIN Code Lookup */}
                  <div className="bg-gradient-to-r from-sky-50 to-blue-50 dark:from-slate-700 dark:to-slate-800 p-6 rounded-xl border-2 border-sky-200 dark:border-slate-600">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Institution Address
                    </h3>
                    <AddressInput
                      address={institutionAddress}
                      onChange={setInstitutionAddress}
                      required={true}
                      showVillage={true}
                    />
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Admin Email */}
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
                        Contact email for notifications
                      </p>
                    </div>

                    {/* Admin Password */}
                    {!editingInstitution && (
                      <div>
                        <label className="block text-slate-700 dark:text-slate-300 font-medium mb-2 flex items-center justify-between">
                          <span>Admin Password</span>
                          <button
                            type="button"
                            onClick={() => setAdminPassword(generateAlphanumericPassword())}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Auto-generate
                          </button>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            placeholder="8-char alphanumeric (auto-generate recommended)"
                            className="w-full px-4 py-3 pr-12 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          >
                            {showPassword ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          Leave empty to auto-generate. UserID will be created automatically.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border-2 border-slate-200 dark:border-slate-600">
                    <label className="block text-slate-900 dark:text-white font-bold mb-3">
                      Admin Roles *
                    </label>
                    <div className="space-y-3">
                      <div className="flex items-center p-2 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-blue-400 transition-colors">
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
                          className="w-5 h-5 text-blue-600 bg-white border-2 border-slate-400 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                          disabled={true} // Always checked, cannot be unchecked
                        />
                        <label htmlFor="admin-role-admin" className="ml-3 text-slate-800 dark:text-slate-100 cursor-pointer flex-1">
                          <span className="font-bold text-blue-700 dark:text-blue-400">Admin</span>
                          <span className="text-slate-600 dark:text-slate-300"> - Can manage users and access all data</span>
                        </label>
                      </div>
                      <div className="flex items-center p-2 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-green-400 transition-colors">
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
                          className="w-5 h-5 text-green-600 bg-white border-2 border-slate-400 rounded focus:ring-green-500 focus:ring-2 cursor-pointer"
                        />
                        <label htmlFor="admin-role-doctor" className="ml-3 text-slate-800 dark:text-slate-100 cursor-pointer flex-1">
                          <span className="font-bold text-green-700 dark:text-green-400">Doctor</span>
                          <span className="text-slate-600 dark:text-slate-300"> - Can add/edit patient records and view all data</span>
                        </label>
                      </div>
                      <div className="flex items-center p-2 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-purple-400 transition-colors">
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
                          className="w-5 h-5 text-purple-600 bg-white border-2 border-slate-400 rounded focus:ring-purple-500 focus:ring-2 cursor-pointer"
                        />
                        <label htmlFor="admin-role-nurse" className="ml-3 text-slate-800 dark:text-slate-100 cursor-pointer flex-1">
                          <span className="font-bold text-purple-700 dark:text-purple-400">Nurse</span>
                          <span className="text-slate-600 dark:text-slate-300"> - Can add patient drafts and view records</span>
                        </label>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg font-medium">
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
                            {institution.userID && (
                              <div className="bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 border-2 border-sky-200 dark:border-sky-700 rounded-lg p-3 my-2">
                                <p className="text-slate-700 dark:text-slate-200 font-semibold mb-1 flex items-center gap-1">
                                  <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                  </svg>
                                  Login Credentials
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">UserID:</span>
                                    <p className="font-mono font-bold text-slate-900 dark:text-white">{institution.userID}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">Password:</span>
                                    <p className="font-mono font-bold text-slate-900 dark:text-white">{institution.password}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                            <p className="text-slate-500 dark:text-slate-400">
                              <span className="text-slate-500">Created:</span>{' '}
                              {new Date(institution.createdAt).toLocaleString()}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400">
                              <span className="text-slate-500">Created By:</span> {institution.createdBy}
                            </p>
                            {(institution.district || institution.state || institution.address) && (
                              <div className="mt-2">
                                <p className="text-slate-500 dark:text-slate-400 font-semibold mb-1 flex items-center gap-1">
                                  <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  Location:
                                </p>
                                <div className="text-sm text-slate-600 dark:text-slate-400 ml-5">
                                  {institution.address && <p>{institution.address}</p>}
                                  {institution.village && <p>Village/Ward: {institution.village}</p>}
                                  <p>
                                    {institution.postOffice && `${institution.postOffice} - `}
                                    {institution.pinCode && `PIN: ${institution.pinCode}`}
                                  </p>
                                  <p>
                                    {institution.district && institution.state ? `${institution.district}, ${institution.state}` :
                                      institution.district || institution.state || ''}
                                  </p>
                                  {institution.institutionType && (
                                    <p className="mt-1 text-sky-600 dark:text-sky-400 font-semibold">
                                      Type: {institution.institutionType}
                                    </p>
                                  )}
                                </div>
                              </div>
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

        {/* Analytics Tab - Advanced Data Visualizations */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="backdrop-blur-xl bg-white/90 rounded-2xl border-2 border-slate-200 shadow-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                    <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Advanced Analytics Dashboard
                  </h2>
                  <p className="text-slate-500 mt-1">
                    Comprehensive data visualization and insights across all institutions
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-cyan-50 px-4 py-2 rounded-lg border-2 border-blue-200">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold text-slate-700">Live Data</span>
                </div>
              </div>

              {patientsLoading ? (
                <div className="py-16 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-slate-500">Loading analytics data...</p>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl p-4">
                  <AdvancedAnalyticsDashboard />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Admission Indications Management Tab */}
        {activeTab === 'indications' && (
          <AdmissionIndicationsManager userEmail={userEmail} />
        )}

        {/* Medications Database Management Tab */}
        {activeTab === 'medications' && showMedicationPanel && (
          <MedicationManagementPanel
            userEmail={userEmail}
            onClose={() => setShowMedicationPanel(false)}
          />
        )}

        {activeTab === 'medications' && !showMedicationPanel && (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl shadow-lg">
            <div className="max-w-2xl mx-auto px-4">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">
                Medications Database Management
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-6">
                Manage the central medication database used across all institutions. Add, edit, and organize
                medications that will appear as autocomplete suggestions when doctors and nurses enter medication
                orders.
              </p>
              <div className="bg-sky-50 dark:bg-sky-900/30 border-2 border-sky-200 dark:border-sky-700 rounded-xl p-4 mb-6 text-left">
                <h3 className="font-bold text-sky-800 dark:text-sky-300 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Features
                </h3>
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>100+ pre-loaded NICU/PICU medications with common doses, routes, and frequencies</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Real-time autocomplete suggestions as clinicians type</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Add custom medications specific to your institutions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Edit existing medications and add warnings/contraindications</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 font-bold">✓</span>
                    <span>Organize by category, unit, and age group</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => setShowMedicationPanel(true)}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all flex items-center gap-3 mx-auto"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Manage Medications Database
              </button>
            </div>
          </div>
        )}

        {/* Password Reset Requests Tab */}
        {activeTab === 'passwordReset' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-sky-500/20 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Password Reset Requests</h2>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">
                    Review and approve password reset requests from institution admins
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Requests</p>
                  <p className="text-3xl font-bold text-sky-600">{passwordResetRequests.length}</p>
                </div>
              </div>

              {resetRequestsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-teal mx-auto"></div>
                  <p className="mt-4 text-slate-600 dark:text-slate-400">Loading password reset requests...</p>
                </div>
              ) : passwordResetRequests.length === 0 ? (
                <div className="text-center py-16">
                  <svg className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No Password Reset Requests</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">All clear! There are no pending password reset requests.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Pending Requests */}
                  {passwordResetRequests.filter(r => r.status === 'pending').length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                        <span className="bg-yellow-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                          {passwordResetRequests.filter(r => r.status === 'pending').length}
                        </span>
                        Pending Requests
                      </h3>
                      <div className="space-y-3">
                        {passwordResetRequests
                          .filter(r => r.status === 'pending')
                          .map(request => (
                            <div key={request.id} className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white">
                                      {request.userName || request.institutionName}
                                    </h4>
                                    <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded">PENDING</span>
                                    {request.userRole && (
                                      <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">
                                        {request.userRole}
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                    <div>
                                      <span className="text-slate-600 dark:text-slate-400">UserID:</span>
                                      <span className="font-mono font-semibold text-slate-900 dark:text-white ml-2">{request.userID}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-600 dark:text-slate-400">Email:</span>
                                      <span className="text-slate-900 dark:text-white ml-2">{request.userEmail}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-600 dark:text-slate-400">Institution:</span>
                                      <span className="text-slate-900 dark:text-white ml-2">{request.institutionName}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-600 dark:text-slate-400">Requested:</span>
                                      <span className="text-slate-900 dark:text-white ml-2">
                                        {new Date(request.requestedAt).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>

                                  {/* New Password Input */}
                                  <div className="flex gap-2 items-end">
                                    <div className="flex-1">
                                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        New Password
                                      </label>
                                      <input
                                        type="text"
                                        value={newPasswordForReset[request.id] || ''}
                                        onChange={(e) => setNewPasswordForReset({ ...newPasswordForReset, [request.id]: e.target.value })}
                                        placeholder="Enter new password"
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-medical-teal focus:border-transparent dark:bg-slate-700 dark:text-white text-sm"
                                      />
                                    </div>
                                    <button
                                      onClick={() => {
                                        const password = generateAlphanumericPassword();
                                        setNewPasswordForReset({ ...newPasswordForReset, [request.id]: password });
                                      }}
                                      className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap"
                                    >
                                      Generate
                                    </button>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-col gap-2">
                                  <button
                                    onClick={() => handleApprovePasswordReset(request.id)}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleRejectPasswordReset(request.id)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Reject
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Approved/Rejected Requests */}
                  {passwordResetRequests.filter(r => r.status !== 'pending').length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                        Processed Requests
                      </h3>
                      <div className="space-y-3">
                        {passwordResetRequests
                          .filter(r => r.status !== 'pending')
                          .map(request => (
                            <div key={request.id} className={`border-2 rounded-xl p-4 ${request.status === 'approved'
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                                : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                              }`}>
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h4 className="font-bold text-slate-900 dark:text-white">
                                      {request.userName || request.institutionName}
                                    </h4>
                                    <span className={`text-white text-xs font-bold px-2 py-1 rounded ${request.status === 'approved' ? 'bg-green-600' : 'bg-red-600'
                                      }`}>
                                      {request.status.toUpperCase()}
                                    </span>
                                    {request.userRole && (
                                      <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">
                                        {request.userRole}
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                      <span className="text-slate-600 dark:text-slate-400">UserID:</span>
                                      <span className="font-mono font-semibold text-slate-900 dark:text-white ml-2">{request.userID}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-600 dark:text-slate-400">Institution:</span>
                                      <span className="text-slate-900 dark:text-white ml-2">{request.institutionName}</span>
                                    </div>
                                    <div className="col-span-2">
                                      <span className="text-slate-600 dark:text-slate-400">Processed:</span>
                                      <span className="text-slate-900 dark:text-white ml-2">
                                        {request.approvedAt ? new Date(request.approvedAt).toLocaleString() : 'N/A'}
                                      </span>
                                    </div>
                                    {request.status === 'approved' && request.newPassword && (
                                      <div className="col-span-2">
                                        <span className="text-slate-600 dark:text-slate-400">New Password:</span>
                                        <span className="font-mono font-semibold text-slate-900 dark:text-white ml-2">{request.newPassword}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDeletePasswordReset(request.id)}
                                  className="px-3 py-1 bg-slate-500 hover:bg-slate-600 text-white rounded text-xs"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Officials Tab */}
        {activeTab === 'officials' && (
          <OfficialsManagement userEmail={userEmail} institutions={institutions} />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Clinical Note AI Settings */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-sky-500/20 shadow-lg">
              <ClinicalNoteAISettingsPanel userEmail={userEmail} />
            </div>

            {/* STT Settings */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-sky-500/20 shadow-lg">
              <STTSettingsPanel userEmail={userEmail} />
            </div>
          </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="user@example.com"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Phone Number (for OTP login)</label>
                    <input
                      type="tel"
                      placeholder="+91 1234567890"
                      value={newAdminPhone}
                      onChange={(e) => setNewAdminPhone(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                      <span>UserID (optional)</span>
                      <button
                        type="button"
                        onClick={() => {
                          const institution = institutions.find(inst => inst.id === managingUsersFor?.id);
                          const districtName = institution?.district || managingUsersFor?.name || 'USR';
                          const districtPrefix = districtName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
                          const existingUserIDs = institutionUsers
                            .map(u => u.userID)
                            .filter(id => id);
                          if (institution?.userID) existingUserIDs.push(institution.userID);
                          const sequenceNumber = getNextSequenceNumber(existingUserIDs, districtPrefix);
                          setManualUserID(generateUserID(districtName, sequenceNumber));
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Auto-fill
                      </button>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., GUW002 (auto-generated if empty)"
                      value={manualUserID}
                      onChange={(e) => setManualUserID(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 flex items-center justify-between">
                      <span>Password (optional)</span>
                      <button
                        type="button"
                        onClick={() => setManualUserPassword(generateAlphanumericPassword())}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Generate
                      </button>
                    </label>
                    <div className="relative">
                      <input
                        type={showManualUserPassword ? 'text' : 'password'}
                        placeholder="8-char alphanumeric (auto-generated if empty)"
                        value={manualUserPassword}
                        onChange={(e) => setManualUserPassword(e.target.value)}
                        className="w-full px-4 py-2 pr-12 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowManualUserPassword(!showManualUserPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        {showManualUserPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Dashboard Access Selection */}
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                    Dashboard Access (Select which dashboards this user can access)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {[Unit.PICU, Unit.NICU, Unit.SNCU, Unit.HDU, Unit.GENERAL_WARD].map(unit => (
                      <label
                        key={unit}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${selectedDashboards.includes(unit)
                            ? 'bg-medical-teal text-white shadow-md'
                            : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDashboards.includes(unit)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDashboards([...selectedDashboards, unit]);
                            } else {
                              setSelectedDashboards(selectedDashboards.filter(d => d !== unit));
                            }
                          }}
                          className="sr-only"
                        />
                        <div className="flex-1 text-sm font-medium">
                          {unit === Unit.PICU ? 'PICU' :
                            unit === Unit.NICU ? 'NICU' :
                              unit === Unit.SNCU ? 'SNCU' :
                                unit === Unit.HDU ? 'HDU' :
                                  'Ward'}
                        </div>
                        {selectedDashboards.includes(unit) && (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                    ℹ️ User will only see selected dashboards after login. At least one must be selected (defaults to NICU & PICU).
                  </p>
                </div>

                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleAddUserToInstitution}
                    disabled={!newAdminEmail}
                    className="bg-sky-500 hover:bg-sky-600 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add User
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  Leave UserID and password empty to auto-generate. Manual credentials useful for specific requirements.
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
                      <li key={user.id} className="bg-white dark:bg-slate-700 p-4 rounded-lg border border-slate-200 dark:border-slate-600">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 dark:text-white">{user.email}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-500">
                                {user.role}
                              </span>
                              {user.displayName && <span className="text-xs text-slate-500">({user.displayName})</span>}
                            </div>
                            {user.userID && user.password && (
                              <div className="mt-3 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 border border-sky-200 dark:border-sky-700 rounded-lg p-3">
                                <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold mb-2 flex items-center gap-1">
                                  <svg className="w-3 h-3 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                  </svg>
                                  Login Credentials
                                </p>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                      <span className="text-xs text-slate-500 dark:text-slate-400">UserID:</span>
                                      <p className="font-mono font-bold text-slate-900 dark:text-white text-sm">{user.userID}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await navigator.clipboard.writeText(user.userID);
                                        setSuccess('UserID copied to clipboard!');
                                        setTimeout(() => setSuccess(''), 2000);
                                      }}
                                      className="px-2 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded text-xs flex items-center gap-1 transition-colors"
                                      title="Copy UserID"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                      Copy
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                      <span className="text-xs text-slate-500 dark:text-slate-400">Password:</span>
                                      <p className="font-mono font-bold text-slate-900 dark:text-white text-sm">{user.password}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await navigator.clipboard.writeText(user.password);
                                        setSuccess('Password copied to clipboard!');
                                        setTimeout(() => setSuccess(''), 2000);
                                      }}
                                      className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs flex items-center gap-1 transition-colors"
                                      title="Copy Password"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                      Copy
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
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
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      <CredentialsModal
        isOpen={showCredentialsModal}
        onClose={() => setShowCredentialsModal(false)}
        userName={createdUserCredentials.userName}
        userEmail={createdUserCredentials.userEmail}
        userID={createdUserCredentials.userID}
        password={createdUserCredentials.password}
        userType={createdUserCredentials.userType}
      />

    </div>
  );
};

export default SuperAdminDashboard;
