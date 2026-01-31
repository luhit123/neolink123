import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { InstitutionUser, UserRole, BedCapacity, Unit, ReportRequest, ReportResponse, ReportRequestStatus, ReportType } from '../types';
import { SCHEDULED_LANGUAGES, ScheduledLanguage } from '../utils/dischargeLanguageService';
import { generateUserID, getNextSequenceNumber } from '../utils/userIdGenerator';
import { generateAlphanumericPassword } from '../utils/passwordUtils';
import { signUpWithEmail } from '../services/authService';
import CredentialsModal from './CredentialsModal';
import ReportsPage from './ReportsPage';
import DataExportPage from './DataExportPage';
import DataMigrationPanel from './DataMigrationPanel';

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

  // Bed capacity state
  const [bedCapacity, setBedCapacity] = useState<BedCapacity>({ PICU: 0, NICU: 0, NICU_INBORN: 0, NICU_OUTBORN: 0, SNCU: 0, HDU: 0, GENERAL_WARD: 0 });
  const [showBedManagement, setShowBedManagement] = useState(false);
  const [editingBeds, setEditingBeds] = useState(false);

  // Doctors management state
  const [doctors, setDoctors] = useState<string[]>([]);
  const [showDoctorsManagement, setShowDoctorsManagement] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState('');
  const [editingDoctorIndex, setEditingDoctorIndex] = useState<number | null>(null);
  const [editDoctorName, setEditDoctorName] = useState('');

  // Form state
  const [newInstitutionName, setNewInstitutionName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRoles, setNewUserRoles] = useState<UserRole[]>([]);

  // User credentials state
  const [manualUserID, setManualUserID] = useState('');
  const [manualUserPassword, setManualUserPassword] = useState('');
  const [showManualUserPassword, setShowManualUserPassword] = useState(false);

  // Credentials modal state
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [createdUserCredentials, setCreatedUserCredentials] = useState({
    userName: '',
    userEmail: '',
    userID: '',
    password: '',
    userType: ''
  });

  // Dashboard access control
  const [selectedDashboards, setSelectedDashboards] = useState<Unit[]>([Unit.NICU, Unit.PICU]);

  // Supabase Reports & Analytics pages
  const [showReportsPage, setShowReportsPage] = useState(false);
  const [showExportPage, setShowExportPage] = useState(false);
  const [showMigrationPanel, setShowMigrationPanel] = useState(false);

  // Institution Settings
  const [showInstitutionSettings, setShowInstitutionSettings] = useState(false);
  const [dischargeLanguage, setDischargeLanguage] = useState<string>('english');

  // Report Requests from Officials
  const [showReportRequests, setShowReportRequests] = useState(false);
  const [reportRequests, setReportRequests] = useState<ReportRequest[]>([]);
  const [loadingReportRequests, setLoadingReportRequests] = useState(false);
  const [selectedReportRequest, setSelectedReportRequest] = useState<ReportRequest | null>(null);
  const [responseNote, setResponseNote] = useState('');
  const [responsePdfFile, setResponsePdfFile] = useState<File | null>(null);
  const [submittingResponse, setSubmittingResponse] = useState(false);

  // Auto-generate UserID and Password when Add User form opens
  useEffect(() => {
    if (showAddForm) {
      // Get institution data for district name
      const loadInstitutionData = async () => {
        try {
          const institutionDoc = await getDoc(doc(db, 'institutions', institutionId));
          if (institutionDoc.exists()) {
            const data = institutionDoc.data();
            const districtName = data.district || institutionName;
            const districtPrefix = districtName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();

            // Get existing UserIDs
            const existingUserIDs = users
              .map(u => u.userID)
              .filter(id => id);
            if (data.userID) existingUserIDs.push(data.userID);

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
        } catch (error) {
          console.error('❌ Error loading institution data:', error);
        }
      };

      loadInstitutionData();
    }
  }, [showAddForm, institutionId, institutionName, users]);

  // Real-time listener for users
  useEffect(() => {
    setLoading(true);

    const usersRef = collection(db, 'approved_users');
    const q = query(usersRef, where('institutionId', '==', institutionId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
        } as InstitutionUser & { id: string }));

        setUsers(data);
        setLoading(false);
        console.log('✅ Real-time update: Loaded', data.length, 'institution users');
      },
      (err) => {
        console.error('❌ Error loading users:', err);
        setError('Failed to load users: ' + err.message);
        setLoading(false);
      }
    );

    loadBedCapacity();
    loadDoctors();
    loadDischargeLanguage();

    return () => unsubscribe();
  }, [institutionId]);

  const loadDischargeLanguage = async () => {
    try {
      const institutionDoc = await getDoc(doc(db, 'institutions', institutionId));
      if (institutionDoc.exists()) {
        const data = institutionDoc.data();
        if (data.dischargeLanguage) {
          setDischargeLanguage(data.dischargeLanguage);
        } else {
          setDischargeLanguage('english');
        }
      }
    } catch (err: any) {
      console.error('❌ Error loading discharge language:', err);
    }
  };

  const saveDischargeLanguage = async (language: string) => {
    try {
      const institutionRef = doc(db, 'institutions', institutionId);
      await updateDoc(institutionRef, { dischargeLanguage: language });
      setDischargeLanguage(language);
      setSuccess('Discharge language updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('❌ Error saving discharge language:', err);
      setError('Failed to save discharge language: ' + err.message);
    }
  };

  // Load report requests from officials
  const loadReportRequests = async () => {
    setLoadingReportRequests(true);
    try {
      const requestsRef = collection(db, 'reportRequests');
      const q = query(
        requestsRef,
        where('institutionId', '==', institutionId)
      );
      const snapshot = await getDocs(q);
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ReportRequest));

      // Sort by creation date (newest first)
      requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReportRequests(requests);
      console.log('✅ Loaded', requests.length, 'report requests');
    } catch (err: any) {
      console.error('❌ Error loading report requests:', err);
      setError('Failed to load report requests: ' + err.message);
    } finally {
      setLoadingReportRequests(false);
    }
  };

  // Update report request status
  const updateReportRequestStatus = async (requestId: string, status: ReportRequestStatus) => {
    try {
      const requestRef = doc(db, 'reportRequests', requestId);
      await updateDoc(requestRef, {
        status,
        updatedAt: new Date().toISOString()
      });

      // Update local state
      setReportRequests(prev => prev.map(req =>
        req.id === requestId ? { ...req, status, updatedAt: new Date().toISOString() } : req
      ));

      console.log('✅ Report request status updated to:', status);
    } catch (err: any) {
      console.error('❌ Error updating request status:', err);
      setError('Failed to update request status: ' + err.message);
    }
  };

  // Submit response to a report request
  const submitReportResponse = async () => {
    if (!selectedReportRequest) return;
    if (!responseNote.trim() && !responsePdfFile) {
      setError('Please provide a note or upload a PDF file');
      return;
    }

    setSubmittingResponse(true);
    setError('');

    try {
      let pdfUrl = '';
      let pdfFileName = '';
      let pdfSize = 0;

      // Upload PDF if provided
      if (responsePdfFile) {
        const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
        const storage = getStorage();
        const fileName = `report_responses/${institutionId}/${Date.now()}_${responsePdfFile.name}`;
        const storageRef = ref(storage, fileName);

        const snapshot = await uploadBytes(storageRef, responsePdfFile);
        pdfUrl = await getDownloadURL(snapshot.ref);
        pdfFileName = responsePdfFile.name;
        pdfSize = responsePdfFile.size;
        console.log('✅ PDF uploaded:', pdfFileName);
      }

      // Create the response document
      const responseData: Omit<ReportResponse, 'id'> = {
        requestId: selectedReportRequest.id,
        responderId: institutionId,
        responderEmail: adminEmail,
        responderName: institutionName + ' Admin',
        responderRole: UserRole.Admin,
        responseType: responsePdfFile && responseNote.trim() ? 'Both' : responsePdfFile ? 'PDF' : 'Note',
        note: responseNote.trim() || undefined,
        pdfUrl: pdfUrl || undefined,
        pdfFileName: pdfFileName || undefined,
        pdfSize: pdfSize || undefined,
        createdAt: new Date().toISOString(),
        isRead: false
      };

      const responsesRef = collection(db, 'reportResponses');
      await addDoc(responsesRef, responseData);

      // Update request status to Completed
      await updateReportRequestStatus(selectedReportRequest.id, ReportRequestStatus.Completed);

      setSuccess('Response sent successfully!');
      setSelectedReportRequest(null);
      setResponseNote('');
      setResponsePdfFile(null);

      // Refresh the requests list
      await loadReportRequests();

      console.log('✅ Response submitted successfully');
    } catch (err: any) {
      console.error('❌ Error submitting response:', err);
      setError('Failed to submit response: ' + err.message);
    } finally {
      setSubmittingResponse(false);
    }
  };

  // Load report requests when showing the panel
  useEffect(() => {
    if (showReportRequests) {
      loadReportRequests();
    }
  }, [showReportRequests, institutionId]);

  const loadBedCapacity = async () => {
    try {
      const institutionDoc = await getDoc(doc(db, 'institutions', institutionId));
      if (institutionDoc.exists()) {
        const data = institutionDoc.data();
        if (data.bedCapacity) {
          setBedCapacity({
            ...data.bedCapacity,
            NICU_INBORN: data.bedCapacity.NICU_INBORN || 0,
            NICU_OUTBORN: data.bedCapacity.NICU_OUTBORN || 0
          });
        } else {
          // Set default if not exists
          setBedCapacity({ PICU: 0, NICU: 0, NICU_INBORN: 0, NICU_OUTBORN: 0, SNCU: 0, HDU: 0, GENERAL_WARD: 0 });
        }
      }
    } catch (err: any) {
      console.error('❌ Error loading bed capacity:', err);
    }
  };

  const loadDoctors = async () => {
    try {
      const institutionDoc = await getDoc(doc(db, 'institutions', institutionId));
      if (institutionDoc.exists()) {
        const data = institutionDoc.data();
        if (data.doctors && Array.isArray(data.doctors)) {
          setDoctors(data.doctors);
        } else {
          setDoctors([]);
        }
      }
    } catch (err: any) {
      console.error('❌ Error loading doctors:', err);
    }
  };

  const handleAddDoctor = async () => {
    if (!newDoctorName.trim()) {
      setError('Doctor name is required');
      return;
    }

    // Check for duplicates
    if (doctors.some(d => d.toLowerCase() === newDoctorName.trim().toLowerCase())) {
      setError('This doctor name already exists');
      return;
    }

    try {
      const updatedDoctors = [...doctors, newDoctorName.trim()];
      await updateDoc(doc(db, 'institutions', institutionId), {
        doctors: updatedDoctors
      });
      setDoctors(updatedDoctors);
      setNewDoctorName('');
      setSuccess(`Doctor "${newDoctorName.trim()}" added successfully`);
      console.log('✅ Doctor added:', newDoctorName.trim());
    } catch (err: any) {
      console.error('❌ Error adding doctor:', err);
      setError('Failed to add doctor: ' + err.message);
    }
  };

  const handleUpdateDoctor = async (index: number) => {
    if (!editDoctorName.trim()) {
      setError('Doctor name is required');
      return;
    }

    // Check for duplicates (excluding current doctor)
    if (doctors.some((d, i) => i !== index && d.toLowerCase() === editDoctorName.trim().toLowerCase())) {
      setError('This doctor name already exists');
      return;
    }

    try {
      const updatedDoctors = [...doctors];
      const oldName = updatedDoctors[index];
      updatedDoctors[index] = editDoctorName.trim();
      await updateDoc(doc(db, 'institutions', institutionId), {
        doctors: updatedDoctors
      });
      setDoctors(updatedDoctors);
      setEditingDoctorIndex(null);
      setEditDoctorName('');
      setSuccess(`Doctor name updated from "${oldName}" to "${editDoctorName.trim()}"`);
      console.log('✅ Doctor updated:', editDoctorName.trim());
    } catch (err: any) {
      console.error('❌ Error updating doctor:', err);
      setError('Failed to update doctor: ' + err.message);
    }
  };

  const handleDeleteDoctor = async (index: number) => {
    const doctorName = doctors[index];
    if (!confirm(`Are you sure you want to remove "${doctorName}" from the doctors list?`)) {
      return;
    }

    try {
      const updatedDoctors = doctors.filter((_, i) => i !== index);
      await updateDoc(doc(db, 'institutions', institutionId), {
        doctors: updatedDoctors
      });
      setDoctors(updatedDoctors);
      setSuccess(`Doctor "${doctorName}" removed successfully`);
      console.log('✅ Doctor removed:', doctorName);
    } catch (err: any) {
      console.error('❌ Error removing doctor:', err);
      setError('Failed to remove doctor: ' + err.message);
    }
  };

  const handleUpdateBedCapacity = async () => {
    try {
      setError('');
      setSuccess('');

      // Validate all bed capacities are non-negative
      const allCapacities = [
        bedCapacity.PICU,
        bedCapacity.NICU_INBORN || 0,
        bedCapacity.NICU_OUTBORN || 0,
        bedCapacity.SNCU || 0,
        bedCapacity.HDU || 0,
        bedCapacity.GENERAL_WARD || 0
      ];

      if (allCapacities.some(cap => cap < 0)) {
        setError('Bed capacity cannot be negative');
        return;
      }

      // Calculate total NICU for backward compatibility
      const totalNICU = (bedCapacity.NICU_INBORN || 0) + (bedCapacity.NICU_OUTBORN || 0);

      await updateDoc(doc(db, 'institutions', institutionId), {
        bedCapacity: {
          ...bedCapacity,
          NICU: totalNICU // Keep legacy field updated
        }
      });

      setSuccess(`✅ Bed capacity updated: PICU: ${bedCapacity.PICU}, NICU Inborn: ${bedCapacity.NICU_INBORN || 0}, NICU Outborn: ${bedCapacity.NICU_OUTBORN || 0}, SNCU: ${bedCapacity.SNCU || 0}, HDU: ${bedCapacity.HDU || 0}, General: ${bedCapacity.GENERAL_WARD || 0}`);
      setEditingBeds(false);
      console.log('✅ Bed capacity updated:', bedCapacity);
    } catch (err: any) {
      console.error('❌ Error updating bed capacity:', err);
      setError('Failed to update bed capacity: ' + err.message);
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
      // Use manual UserID if provided, otherwise keep auto-generated
      const finalUserID = manualUserID.trim();
      // Use manual password if provided, otherwise keep auto-generated
      const finalPassword = manualUserPassword.trim();

      // NOTE: We do NOT create Firebase Auth account here anymore
      // Creating Firebase Auth account signs in as the new user, which breaks admin permissions
      // The Firebase Auth account will be created automatically when the user first logs in
      // via signInWithUserID function in authService.ts
      console.log('📝 Adding user to approved_users (Firebase Auth will be created on first login)');

      const usersRef = collection(db, 'approved_users');
      const addPromises = newUserRoles.map(async (role) => {
        const newUser: Omit<InstitutionUser, 'uid'> & { uid: string } = {
          uid: '', // Will be set when user first logs in
          email: newUserEmail.trim().toLowerCase(),
          phoneNumber: newUserPhone.trim(), // Add phone number for OTP login
          displayName: newUserName.trim(),
          role: role,
          institutionId,
          institutionName,
          addedBy: adminEmail,
          addedAt: new Date().toISOString(),
          enabled: true,
          userID: finalUserID, // Add UserID
          password: finalPassword, // Add Password
          allowedDashboards: selectedDashboards.length > 0 ? selectedDashboards : [Unit.NICU, Unit.PICU] // Default to NICU and PICU if none selected
        };

        return addDoc(usersRef, newUser);
      });

      await Promise.all(addPromises);
      console.log('✅ User added with roles:', newUserRoles);

      // Show credentials modal
      setCreatedUserCredentials({
        userName: newUserName.trim(),
        userEmail: newUserEmail.trim().toLowerCase(),
        userID: finalUserID,
        password: finalPassword,
        userType: newUserRoles[0] === UserRole.Doctor ? 'Doctor' :
          newUserRoles[0] === UserRole.Nurse ? 'Nurse' : 'Admin'
      });
      setShowCredentialsModal(true);

      setNewUserEmail('');
      setNewUserPhone('');
      setNewUserName('');
      setNewUserRoles([]);
      setManualUserID('');
      setManualUserPassword('');
      setSelectedDashboards([Unit.NICU, Unit.PICU]); // Reset to default
      setShowManualUserPassword(false);
      setShowAddForm(false);

      // Real-time listener will automatically update
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
      // Real-time listener will automatically update
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
      // Real-time listener will automatically update
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
      // Real-time listener will automatically update
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

      // Real-time listener will automatically update
    } catch (err: any) {
      console.error('❌ Error updating user email:', err);
      setError('Failed to update user email: ' + err.message);
    }
  };

  // Render Reports Page
  if (showReportsPage) {
    return (
      <ReportsPage
        institutionId={institutionId}
        institutionName={institutionName}
        onBack={() => setShowReportsPage(false)}
      />
    );
  }

  // Render Export Page
  if (showExportPage) {
    return (
      <DataExportPage
        institutionId={institutionId}
        institutionName={institutionName}
        onBack={() => setShowExportPage(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-sky-600 dark:from-blue-900 dark:to-sky-900 border-b border-blue-500 dark:border-blue-700 transition-colors duration-200">
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

        {/* Action Buttons */}
        {!showAddForm && !showBedManagement && !showDoctorsManagement && !showMigrationPanel && !showInstitutionSettings && !showReportRequests && (
          <div className="mb-6 flex flex-wrap gap-4">
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New User
            </button>
            <button
              onClick={() => setShowBedManagement(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Manage Beds
            </button>
            <button
              onClick={() => setShowDoctorsManagement(true)}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Manage Doctors
            </button>
            <button
              onClick={() => setShowReportsPage(true)}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Reports & Analytics
            </button>
            <button
              onClick={() => setShowExportPage(true)}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Data
            </button>
            <button
              onClick={() => setShowMigrationPanel(true)}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
              Sync to Supabase
            </button>
            <button
              onClick={() => setShowInstitutionSettings(true)}
              className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Institution Settings
            </button>
            <button
              onClick={() => setShowReportRequests(true)}
              className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2 relative"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Report Requests
              {reportRequests.filter(r => r.status === ReportRequestStatus.Pending).length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {reportRequests.filter(r => r.status === ReportRequestStatus.Pending).length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Bed Management Form */}
        {showBedManagement && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-8 border border-blue-500/20 shadow-lg transition-colors duration-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Bed Capacity Management</h2>
              <button
                onClick={() => {
                  setShowBedManagement(false);
                  setEditingBeds(false);
                  loadBedCapacity(); // Reset to saved values
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Configure the number of beds available in each unit. This will help track bed occupancy and capacity.
            </p>

            <div className="space-y-6">
              {/* PICU Beds */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    PICU (Pediatric Intensive Care Unit)
                  </label>
                  {!editingBeds && (
                    <button
                      onClick={() => setEditingBeds(true)}
                      className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                    >
                      Edit
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="0"
                    value={bedCapacity.PICU}
                    onChange={(e) => setBedCapacity({ ...bedCapacity, PICU: parseInt(e.target.value) || 0 })}
                    disabled={!editingBeds}
                    className="w-32 px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <span className="text-slate-600 dark:text-slate-400">beds</span>
                </div>
              </div>

              {/* NICU Inborn Beds */}
              <div className="bg-sky-50 dark:bg-sky-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    NICU Inborn
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(Babies born in this hospital)</span>
                  </label>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="0"
                    value={bedCapacity.NICU_INBORN || 0}
                    onChange={(e) => setBedCapacity({ ...bedCapacity, NICU_INBORN: parseInt(e.target.value) || 0 })}
                    disabled={!editingBeds}
                    className="w-32 px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-lg font-bold text-center focus:outline-none focus:ring-1 focus:ring-sky-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <span className="text-slate-600 dark:text-slate-400">beds</span>
                </div>
              </div>

              {/* NICU Outborn Beds */}
              <div className="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    NICU Outborn
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(Referred from other hospitals)</span>
                  </label>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="0"
                    value={bedCapacity.NICU_OUTBORN || 0}
                    onChange={(e) => setBedCapacity({ ...bedCapacity, NICU_OUTBORN: parseInt(e.target.value) || 0 })}
                    disabled={!editingBeds}
                    className="w-32 px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-lg font-bold text-center focus:outline-none focus:ring-1 focus:ring-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <span className="text-slate-600 dark:text-slate-400">beds</span>
                </div>
              </div>


              {/* SNCU Beds */}
              <div className="bg-blue-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    SNCU (Special New Born Care Unit)
                  </label>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="0"
                    value={bedCapacity.SNCU || 0}
                    onChange={(e) => setBedCapacity({ ...bedCapacity, SNCU: parseInt(e.target.value) || 0 })}
                    disabled={!editingBeds}
                    className="w-32 px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-lg font-bold text-center focus:outline-none focus:ring-1 focus:ring-green-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <span className="text-slate-600 dark:text-slate-400">beds</span>
                </div>
              </div>

              {/* HDU Beds */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    HDU (High Dependency Unit)
                  </label>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="0"
                    value={bedCapacity.HDU || 0}
                    onChange={(e) => setBedCapacity({ ...bedCapacity, HDU: parseInt(e.target.value) || 0 })}
                    disabled={!editingBeds}
                    className="w-32 px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-lg font-bold text-center focus:outline-none focus:ring-1 focus:ring-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <span className="text-slate-600 dark:text-slate-400">beds</span>
                </div>
              </div>

              {/* General Ward Beds */}
              <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <svg className="w-6 h-6 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    General Ward
                  </label>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="0"
                    value={bedCapacity.GENERAL_WARD || 0}
                    onChange={(e) => setBedCapacity({ ...bedCapacity, GENERAL_WARD: parseInt(e.target.value) || 0 })}
                    disabled={!editingBeds}
                    className="w-32 px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-lg font-bold text-center focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <span className="text-slate-600 dark:text-slate-400">beds</span>
                </div>
              </div>

              {/* Action Buttons */}
              {editingBeds && (
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleUpdateBedCapacity}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Save Bed Capacity
                  </button>
                  <button
                    onClick={() => {
                      setEditingBeds(false);
                      loadBedCapacity(); // Reset to saved values
                    }}
                    className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Doctors Management Panel */}
        {showDoctorsManagement && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-8 border border-teal-500/20 shadow-lg transition-colors duration-200">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Doctors Management</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Add doctors who will appear in dropdown menus throughout the app</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDoctorsManagement(false);
                  setNewDoctorName('');
                  setEditingDoctorIndex(null);
                  setEditDoctorName('');
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Add New Doctor Form */}
            <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-xl border border-teal-200 dark:border-teal-800 mb-6">
              <h3 className="text-sm font-semibold text-teal-800 dark:text-teal-300 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add New Doctor
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newDoctorName}
                  onChange={(e) => setNewDoctorName(e.target.value)}
                  placeholder="Enter doctor's name (e.g., Dr. John Smith)"
                  className="flex-1 px-4 py-3 bg-white dark:bg-slate-700 border border-teal-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddDoctor();
                    }
                  }}
                />
                <button
                  onClick={handleAddDoctor}
                  disabled={!newDoctorName.trim()}
                  className="px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Doctor
                </button>
              </div>
            </div>

            {/* Doctors List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Registered Doctors ({doctors.length})
                </h3>
                {doctors.length > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    These names will appear in doctor selection dropdowns
                  </span>
                )}
              </div>

              {doctors.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-slate-700/50 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600">
                  <svg className="w-12 h-12 mx-auto text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">No doctors added yet</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Add doctors above to populate selection dropdowns</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 divide-y divide-slate-200 dark:divide-slate-600">
                  {doctors.map((doctor, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      {editingDoctorIndex === index ? (
                        // Edit mode
                        <div className="flex-1 flex items-center gap-3">
                          <input
                            type="text"
                            value={editDoctorName}
                            onChange={(e) => setEditDoctorName(e.target.value)}
                            className="flex-1 px-3 py-2 bg-white dark:bg-slate-600 border border-teal-400 dark:border-teal-500 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleUpdateDoctor(index);
                              } else if (e.key === 'Escape') {
                                setEditingDoctorIndex(null);
                                setEditDoctorName('');
                              }
                            }}
                          />
                          <button
                            onClick={() => handleUpdateDoctor(index)}
                            className="p-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors"
                            title="Save"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setEditingDoctorIndex(null);
                              setEditDoctorName('');
                            }}
                            className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-white rounded-lg transition-colors"
                            title="Cancel"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        // View mode
                        <>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                              {doctor.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">{doctor}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Doctor #{index + 1}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingDoctorIndex(index);
                                setEditDoctorName(doctor);
                              }}
                              className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteDoctor(index)}
                              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Usage Info */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Where doctors appear
              </h4>
              <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                <li>• Patient admission form (Doctor in Charge)</li>
                <li>• Discharge summary (Prepared by / Verified by)</li>
                <li>• Progress notes (Recording doctor)</li>
                <li>• Death certificate (Certifying physician)</li>
              </ul>
            </div>
          </div>
        )}

        {/* Data Migration Panel */}
        {showMigrationPanel && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Data Sync & Migration</h2>
              <button
                onClick={() => setShowMigrationPanel(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
            <DataMigrationPanel
              institutionId={institutionId}
              institutionName={institutionName}
            />
          </div>
        )}

        {/* Institution Settings Panel */}
        {showInstitutionSettings && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-8 border border-amber-500/20 shadow-lg transition-colors duration-200">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Institution Settings</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Configure institution-wide settings</p>
                </div>
              </div>
              <button
                onClick={() => setShowInstitutionSettings(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {/* Discharge Language Setting */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-6 rounded-xl border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    AI-Powered Discharge Advice
                    <span className="px-2 py-0.5 bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-xs rounded-full">State-of-the-Art</span>
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Select from all <strong>22 Scheduled Languages</strong> of India (8th Schedule of Constitution).
                    AI generates bilingual discharge advice in English + your selected regional language.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {SCHEDULED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => saveDischargeLanguage(lang.code)}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${dischargeLanguage === lang.code
                        ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/40 shadow-lg'
                        : 'border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700 bg-white dark:bg-slate-800'
                      }`}
                  >
                    <p className={`font-bold text-sm ${dischargeLanguage === lang.code ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-white'
                      }`}>
                      {lang.nativeName}
                    </p>
                    <p className={`text-xs ${dischargeLanguage === lang.code ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'
                      }`}>
                      {lang.name}
                    </p>
                    {dischargeLanguage === lang.code && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Selected
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-4 p-4 bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-900/20 dark:to-indigo-900/20 rounded-lg border border-sky-200 dark:border-sky-800">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-sky-800 dark:text-sky-300 mb-1">
                      How AI-Powered Bilingual Advice Works
                    </p>
                    <ul className="text-xs text-sky-700 dark:text-sky-400 space-y-1">
                      <li>• AI generates 10 essential discharge instructions based on diagnosis</li>
                      <li>• Each advice item is provided in <strong>English + Regional Language</strong></li>
                      <li>• Uses simple, clear language that any parent can understand</li>
                      <li>• Includes danger signs to watch for and follow-up advice</li>
                      <li>• Printed on discharge summary for parents to take home</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report Requests Panel */}
        {showReportRequests && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-8 border border-rose-500/20 shadow-lg transition-colors duration-200">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Report Requests</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Respond to report requests from government officials</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowReportRequests(false);
                  setSelectedReportRequest(null);
                  setResponseNote('');
                  setResponsePdfFile(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {loadingReportRequests ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
                <span className="ml-3 text-slate-600 dark:text-slate-400">Loading requests...</span>
              </div>
            ) : reportRequests.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-slate-500 dark:text-slate-400">No report requests yet</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">When government officials request reports, they will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Request List */}
                {!selectedReportRequest && (
                  <div className="space-y-3">
                    {reportRequests.map(request => (
                      <div
                        key={request.id}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${request.status === ReportRequestStatus.Pending
                            ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
                            : request.status === ReportRequestStatus.InProgress
                              ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                              : request.status === ReportRequestStatus.Completed
                                ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                                : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                          }`}
                        onClick={() => setSelectedReportRequest(request)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${request.status === ReportRequestStatus.Pending
                                  ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                                  : request.status === ReportRequestStatus.InProgress
                                    ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                                    : request.status === ReportRequestStatus.Completed
                                      ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                      : 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                                }`}>
                                {request.status}
                              </span>
                              <span className="px-2 py-0.5 text-xs rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                {request.reportType}
                              </span>
                            </div>
                            <h4 className="font-semibold text-slate-900 dark:text-white">{request.requesterName}</h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{request.requesterDesignation}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                              {request.dateRangeStart && request.dateRangeEnd
                                ? `Period: ${new Date(request.dateRangeStart).toLocaleDateString()} - ${new Date(request.dateRangeEnd).toLocaleDateString()}`
                                : 'No date range specified'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500 dark:text-slate-500">
                              {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-600">
                              {new Date(request.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        {request.additionalNotes && (
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 italic line-clamp-2">
                            "{request.additionalNotes}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected Request Detail & Response Form */}
                {selectedReportRequest && (
                  <div className="space-y-6">
                    <button
                      onClick={() => {
                        setSelectedReportRequest(null);
                        setResponseNote('');
                        setResponsePdfFile(null);
                      }}
                      className="text-sm text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      Back to all requests
                    </button>

                    {/* Request Details */}
                    <div className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-xl">
                      <h3 className="font-bold text-slate-900 dark:text-white mb-3">Request Details</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">Requester</p>
                          <p className="font-medium text-slate-900 dark:text-white">{selectedReportRequest.requesterName}</p>
                          <p className="text-slate-600 dark:text-slate-400">{selectedReportRequest.requesterDesignation}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">Report Type</p>
                          <p className="font-medium text-slate-900 dark:text-white">{selectedReportRequest.reportType}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">Date Range</p>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {selectedReportRequest.dateRangeStart && selectedReportRequest.dateRangeEnd
                              ? `${new Date(selectedReportRequest.dateRangeStart).toLocaleDateString()} - ${new Date(selectedReportRequest.dateRangeEnd).toLocaleDateString()}`
                              : 'Not specified'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">Unit</p>
                          <p className="font-medium text-slate-900 dark:text-white">{selectedReportRequest.unit || 'All Units'}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">Status</p>
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${selectedReportRequest.status === ReportRequestStatus.Pending
                              ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                              : selectedReportRequest.status === ReportRequestStatus.InProgress
                                ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                                : selectedReportRequest.status === ReportRequestStatus.Completed
                                  ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                  : 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                            }`}>
                            {selectedReportRequest.status}
                          </span>
                        </div>
                        <div>
                          <p className="text-slate-500 dark:text-slate-400">Requested On</p>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {new Date(selectedReportRequest.createdAt).toLocaleDateString()} at {new Date(selectedReportRequest.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      {selectedReportRequest.additionalNotes && (
                        <div className="mt-4">
                          <p className="text-slate-500 dark:text-slate-400">Additional Notes</p>
                          <p className="mt-1 p-3 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white">
                            {selectedReportRequest.additionalNotes}
                          </p>
                        </div>
                      )}
                      {selectedReportRequest.customReportDescription && (
                        <div className="mt-4">
                          <p className="text-slate-500 dark:text-slate-400">Custom Report Description</p>
                          <p className="mt-1 p-3 bg-white dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white">
                            {selectedReportRequest.customReportDescription}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Status Update Buttons */}
                    {selectedReportRequest.status !== ReportRequestStatus.Completed && (
                      <div className="flex gap-2">
                        {selectedReportRequest.status === ReportRequestStatus.Pending && (
                          <button
                            onClick={() => updateReportRequestStatus(selectedReportRequest.id, ReportRequestStatus.InProgress)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            Mark as In Progress
                          </button>
                        )}
                        <button
                          onClick={() => updateReportRequestStatus(selectedReportRequest.id, ReportRequestStatus.Rejected)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Reject Request
                        </button>
                      </div>
                    )}

                    {/* Response Form */}
                    {selectedReportRequest.status !== ReportRequestStatus.Completed && selectedReportRequest.status !== ReportRequestStatus.Rejected && (
                      <div className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 p-6 rounded-xl border border-rose-200 dark:border-rose-800">
                        <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                          <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          Send Response
                        </h3>

                        <div className="space-y-4">
                          {/* Note Input */}
                          <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                              Response Note (optional)
                            </label>
                            <textarea
                              value={responseNote}
                              onChange={(e) => setResponseNote(e.target.value)}
                              placeholder="Add a message to accompany your response..."
                              rows={4}
                              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 transition-colors"
                            />
                          </div>

                          {/* PDF Upload */}
                          <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                              Upload PDF Report (optional)
                            </label>
                            <div className="flex items-center gap-4">
                              <input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => setResponsePdfFile(e.target.files?.[0] || null)}
                                className="hidden"
                                id="pdf-upload"
                              />
                              <label
                                htmlFor="pdf-upload"
                                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                              >
                                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <span className="text-slate-700 dark:text-slate-300">Choose PDF</span>
                              </label>
                              {responsePdfFile && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">
                                    {responsePdfFile.name} ({(responsePdfFile.size / 1024 / 1024).toFixed(2)} MB)
                                  </span>
                                  <button
                                    onClick={() => setResponsePdfFile(null)}
                                    className="text-red-500 hover:text-red-600"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Submit Button */}
                          <button
                            onClick={submitReportResponse}
                            disabled={submittingResponse || (!responseNote.trim() && !responsePdfFile)}
                            className="w-full px-6 py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                          >
                            {submittingResponse ? (
                              <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Sending Response...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                                Send Response
                              </>
                            )}
                          </button>

                          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                            You must provide either a note or a PDF file (or both) to respond
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Already Responded Message */}
                    {selectedReportRequest.status === ReportRequestStatus.Completed && (
                      <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-xl border border-green-300 dark:border-green-700">
                        <div className="flex items-center gap-3">
                          <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="font-medium text-green-800 dark:text-green-300">Response Already Sent</p>
                            <p className="text-sm text-green-700 dark:text-green-400">This request has been completed.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Rejected Message */}
                    {selectedReportRequest.status === ReportRequestStatus.Rejected && (
                      <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-xl border border-red-300 dark:border-red-700">
                        <div className="flex items-center gap-3">
                          <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="font-medium text-red-800 dark:text-red-300">Request Rejected</p>
                            <p className="text-sm text-red-700 dark:text-red-400">This request has been rejected.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Add User Form */}
        {showAddForm && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 mb-8 border border-sky-500/20 shadow-lg transition-colors duration-200">
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
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-2">
                  Phone Number (for OTP login) *
                </label>
                <input
                  type="tel"
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  placeholder="+91 1234567890"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
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
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
                  required
                />
              </div>

              {/* UserID Field */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-2 flex items-center justify-between">
                  <span>UserID (Auto-generated)</span>
                  <button
                    type="button"
                    onClick={() => {
                      const existingUserIDs = users.map(u => u.userID).filter(id => id);
                      const districtName = institutionName;
                      const districtPrefix = districtName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
                      const sequenceNumber = getNextSequenceNumber(existingUserIDs, districtPrefix);
                      setManualUserID(generateUserID(districtName, sequenceNumber));
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate
                  </button>
                </label>
                <input
                  type="text"
                  value={manualUserID}
                  onChange={(e) => setManualUserID(e.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="e.g., GUW002"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors font-mono"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Auto-generated based on institution. Edit if needed.
                </p>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-2 flex items-center justify-between">
                  <span>Password (Auto-generated)</span>
                  <button
                    type="button"
                    onClick={() => setManualUserPassword(generateAlphanumericPassword())}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate
                  </button>
                </label>
                <div className="relative">
                  <input
                    type={showManualUserPassword ? 'text' : 'password'}
                    value={manualUserPassword}
                    onChange={(e) => setManualUserPassword(e.target.value)}
                    placeholder="8-character password"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors font-mono pr-10"
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
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  8-character alphanumeric password. Edit if needed.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border-2 border-slate-200 dark:border-slate-600">
                <label className="block text-slate-900 dark:text-white font-bold mb-3">
                  Roles *
                </label>
                <div className="space-y-3">
                  <div className="flex items-center p-2 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-blue-400 transition-colors">
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
                      className="w-5 h-5 text-blue-600 bg-white border-2 border-slate-400 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                    />
                    <label htmlFor="role-admin" className="ml-3 text-slate-800 dark:text-slate-100 cursor-pointer flex-1">
                      <span className="font-bold text-blue-700 dark:text-blue-400">Admin</span>
                      <span className="text-slate-600 dark:text-slate-300"> - Can manage users and access all data</span>
                    </label>
                  </div>
                  <div className="flex items-center p-2 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-green-400 transition-colors">
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
                      className="w-5 h-5 text-green-600 bg-white border-2 border-slate-400 rounded focus:ring-green-500 focus:ring-2 cursor-pointer"
                    />
                    <label htmlFor="role-doctor" className="ml-3 text-slate-800 dark:text-slate-100 cursor-pointer flex-1">
                      <span className="font-bold text-green-700 dark:text-green-400">Doctor</span>
                      <span className="text-slate-600 dark:text-slate-300"> - Can view and edit all patient records</span>
                    </label>
                  </div>
                  <div className="flex items-center p-2 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-purple-400 transition-colors">
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
                      className="w-5 h-5 text-purple-600 bg-white border-2 border-slate-400 rounded focus:ring-purple-500 focus:ring-2 cursor-pointer"
                    />
                    <label htmlFor="role-nurse" className="ml-3 text-slate-800 dark:text-slate-100 cursor-pointer flex-1">
                      <span className="font-bold text-purple-700 dark:text-purple-400">Nurse</span>
                      <span className="text-slate-600 dark:text-slate-300"> - Can view records and add patient notes</span>
                    </label>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                  ℹ️ Select one or more roles for this user. They will have access to all selected role capabilities.
                </p>
              </div>

              {/* Dashboard Access Selection */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto"></div>
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
                  userIds: [],
                  userID: user.userID, // Add userID
                  password: user.password // Add password
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
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : role === UserRole.Doctor
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-blue-500/20 text-sky-400'
                                  }`}>
                                  {role}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1 text-sm">
                            <p className="text-slate-600 dark:text-slate-300">
                              <span className="text-slate-500">Email:</span>{' '}
                              <span className="text-sky-600 dark:text-sky-400">{user.email}</span>
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

                            {/* Login Credentials */}
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
                        </div>

                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleChangeUserRole(user.userIds[0], user.displayName, user.roles[0])}
                            className="px-4 py-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors text-sm font-medium"
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

    </div >
  );
};

export default AdminDashboard;
