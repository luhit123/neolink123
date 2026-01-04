import React, { useState, useEffect, Suspense, lazy } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { handleRedirectResult } from './services/authService';
import Login from './components/Login';
import Header from './components/Header';
import { UserRole, UserProfile, Patient } from './types';

// Lazy load heavy components
const Dashboard = lazy(() => import('./components/Dashboard'));
const SuperAdminDashboard = lazy(() => import('./components/SuperAdminDashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const DistrictAdminDashboard = lazy(() => import('./components/DistrictAdminDashboard'));
const ReferralManagementPage = lazy(() => import('./components/ReferralManagementPage'));
const PatientForm = lazy(() => import('./components/PatientForm'));

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectChecked, setRedirectChecked] = useState(false);
  const [showSuperAdminPanel, setShowSuperAdminPanel] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showReferralManagement, setShowReferralManagement] = useState(false);
  const [showAddPatientPage, setShowAddPatientPage] = useState(false);
  const [patientToEdit, setPatientToEdit] = useState<any>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessMessage, setAccessMessage] = useState('');
  const [superAdminViewingInstitution, setSuperAdminViewingInstitution] = useState<{
    institutionId: string;
    institutionName: string;
  } | null>(null);
  const [districtAdminViewingInstitution, setDistrictAdminViewingInstitution] = useState<{
    institutionId: string;
    institutionName: string;
  } | null>(null);

  // Check for redirect result on app load (only once)
  useEffect(() => {
    const checkRedirect = async () => {
      if (!redirectChecked) {
        try {
          const user = await handleRedirectResult();
          if (user) {
            console.log('✅ User signed in via redirect:', user.email);
          }
        } catch (error: any) {
          console.error('❌ Redirect result error:', error);
        } finally {
          setRedirectChecked(true);
        }
      }
    };

    checkRedirect();
  }, [redirectChecked]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          if (!firebaseUser.email) {
            console.error('❌ User has no email');
            setAccessDenied(true);
            setAccessMessage('User account has no email address associated with it.');
            setUser(null);
            setUserProfile(null);
            setLoading(false);
            return;
          }
          setUser(firebaseUser);
          await loadUserProfile(firebaseUser);
        } else {
          setUser(null);
          setUserProfile(null);
          setAccessDenied(false);
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Auth state change error:', error);
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loadUserProfile = async (firebaseUser: User) => {
    try {
      console.log('👤 Loading profile for:', firebaseUser.email);
      const email = firebaseUser.email?.toLowerCase();

      if (!email) {
        throw new Error('User email is missing');
      }

      // Parallel check: users collection AND approved_users collection
      const [userDoc, approvedSnapshot] = await Promise.all([
        getDoc(doc(db, 'users', firebaseUser.uid)),
        getDocs(
          query(
            collection(db, 'approved_users'),
            where('email', '==', email),
            where('enabled', '==', true)
          )
        )
      ]);

      // Step 1: Quick check if SuperAdmin (single doc read)
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === UserRole.SuperAdmin) {
          const profile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'SuperAdmin',
            role: UserRole.SuperAdmin,
            createdAt: userData.createdAt || new Date().toISOString(),
            lastLoginAt: new Date().toISOString()
          };
          setUserProfile(profile);
          setAccessDenied(false);
          console.log('✅ SuperAdmin login');

          // Update last login
          setDoc(doc(db, 'users', firebaseUser.uid), { lastLoginAt: new Date().toISOString() }, { merge: true });
          return;
        }
      }

      // Step 2: Check approved_users for District Admin
      const districtAdminSnapshot = await getDocs(
        query(
          collection(db, 'approved_users'),
          where('email', '==', firebaseUser.email?.toLowerCase()),
          where('role', '==', UserRole.DistrictAdmin),
          where('enabled', '==', true)
        )
      );

      if (!districtAdminSnapshot.empty) {
        const adminData = districtAdminSnapshot.docs[0].data();
        const profile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: adminData.displayName || 'District Admin',
          role: UserRole.DistrictAdmin,
          institutionId: 'district-admin', // Placeholder
          institutionName: `${adminData.assignedDistrict} District`,
          createdAt: adminData.addedAt || new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          allRoles: [UserRole.DistrictAdmin]
        };
        setUserProfile(profile);
        setAccessDenied(false);
        console.log('✅ District Admin login');

        // Update user doc and approved user doc with UID
        setDoc(doc(db, 'users', firebaseUser.uid), {
          ...profile,
          assignedDistrict: adminData.assignedDistrict,
          lastLoginAt: new Date().toISOString()
        }, { merge: true });

        if (!adminData.uid) {
          updateDoc(doc(db, 'approved_users', districtAdminSnapshot.docs[0].id), { uid: firebaseUser.uid });
        }
        return;
      }

      // Step 3: Check approved_users for institution access (SuperAdmin not checked here)

      // Check if user found
      if (approvedSnapshot.empty) {
        console.log('❌ No approved user found');
        setAccessDenied(true);
        setAccessMessage(
          `Your email (${firebaseUser.email}) is not authorized to access any institution.\n\n` +
          'Please contact your institution administrator. If you recently had your email changed, ' +
          'you may need to use your new email address to login.'
        );
        setUserProfile(null);
        return;
      }

      // Get all enabled institutions (already filtered in query)
      const enabledInstitutions = approvedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as any));

      console.log('✅ Found', enabledInstitutions.length, 'enabled institution(s)');

      // Continue with regular role priority logic for non-SuperAdmin users

      // Sort by most recently added institution first (addedAt timestamp)
      // This ensures when a user is reassigned to a new institution, they see the new one
      const sortedInstitutions = enabledInstitutions.sort((a: any, b: any) => {
        // First, sort by addedAt timestamp (most recent first)
        const dateA = new Date(a.addedAt || a.approvedAt || 0).getTime();
        const dateB = new Date(b.addedAt || b.approvedAt || 0).getTime();

        // Most recent first (descending order)
        if (dateB !== dateA) {
          return dateB - dateA;
        }

        // If timestamps are equal, fall back to role priority (Admin > Doctor > Nurse)
        const rolePriority = {
          [UserRole.Admin]: 1,
          [UserRole.Doctor]: 2,
          [UserRole.Nurse]: 3
        };
        return (rolePriority[a.role as UserRole] || 999) - (rolePriority[b.role as UserRole] || 999);
      });

      const primaryRole = sortedInstitutions[0];

      console.log('📊 User has access to', sortedInstitutions.length, 'institution(s)');
      console.log('🏥 Selected institution:', primaryRole.institutionName, '(most recently added)');
      const allRoles = sortedInstitutions.map((inst: any) => inst.role);

      // Create user profile
      const profile: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: primaryRole.displayName || firebaseUser.displayName || 'User',
        role: primaryRole.role as UserRole,
        institutionId: primaryRole.institutionId,
        institutionName: primaryRole.institutionName,
        createdAt: primaryRole.approvedAt || new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        allRoles: allRoles // Add all roles the user has
      };

      setUserProfile(profile);
      setAccessDenied(false);
      console.log('✅ Logged in as', profile.role, '-', profile.institutionName);

      // Update users collection with current role and institution info
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      setDoc(userDocRef, {
        uid: firebaseUser.uid,
        email: firebaseUser.email?.toLowerCase(),
        displayName: profile.displayName,
        role: profile.role,
        institutionId: profile.institutionId,
        institutionName: profile.institutionName,
        lastLoginAt: new Date().toISOString(),
        allRoles: allRoles
      }, { merge: true }).catch(err => console.error('Error updating users collection:', err));

      // Update user UID in approved_users asynchronously (non-blocking) - only if missing
      if (!primaryRole.uid || primaryRole.uid === '') {
        // Update all approved_users entries with this email to set UID
        sortedInstitutions.forEach((inst: any) => {
          if (!inst.uid || inst.uid === '') {
            setDoc(
              doc(db, 'approved_users', inst.id),
              { uid: firebaseUser.uid, lastLoginAt: new Date().toISOString() },
              { merge: true }
            ).catch(err => console.error('Error updating UID:', err));
          }
        });
      }

    } catch (error: any) {
      console.error('❌ Error loading user profile:', error);
      setAccessDenied(true);
      setAccessMessage('Error loading user profile. Please try again or contact support.');
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleViewInstitutionDashboard = (institutionId: string, institutionName: string) => {
    setSuperAdminViewingInstitution({ institutionId, institutionName });
    setShowSuperAdminPanel(false); // Hide SuperAdmin panel when viewing institution
  };

  const handleBackFromInstitutionView = () => {
    setSuperAdminViewingInstitution(null);
    setShowSuperAdminPanel(true); // Show SuperAdmin panel again
  };

  const handleDistrictAdminViewInstitution = (institutionId: string, institutionName: string) => {
    setDistrictAdminViewingInstitution({ institutionId, institutionName });
  };

  const handleBackToDistrictDashboard = () => {
    setDistrictAdminViewingInstitution(null);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setUserProfile(null);
      setShowSuperAdminPanel(false);
      setShowAdminPanel(false);
      setAccessDenied(false);
      setAccessDenied(false);
      setSuperAdminViewingInstitution(null);
      setDistrictAdminViewingInstitution(null);
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-sky-100 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-teal"></div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Login />;
  }

  // Access denied
  if (accessDenied) {
    return (
      <div className="bg-sky-100 min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md border border-red-200">
          <div className="flex justify-center mb-6">
            <div className="bg-red-500/10 p-4 rounded-full">
              <svg className="w-16 h-16 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-4">
            Access Denied
          </h1>

          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-300 text-sm whitespace-pre-line">{accessMessage}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleLogout}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-lg transition-colors border border-slate-200"
            >
              Sign Out
            </button>
          </div>

          <div className="mt-6 text-center text-slate-400 text-xs">
            <p>Logged in as: <span className="text-cyan-400">{user.email}</span></p>
          </div>
        </div>
      </div>
    );
  }

  // User profile not loaded
  if (!userProfile) {
    return (
      <div className="bg-sky-100 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-teal"></div>
      </div>
    );
  }

  // Show SuperAdmin Dashboard
  if (showSuperAdminPanel && userProfile.role === UserRole.SuperAdmin) {
    return (
      <div className="min-h-screen bg-sky-100 text-slate-900">
        <Header
          userRole={UserRole.SuperAdmin}
          onLogout={handleLogout}
          collegeName="Super Admin Control System"
        />
        <main>
          <Suspense fallback={
            <div className="bg-sky-100 min-h-screen flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p className="text-slate-600 text-lg">Loading SuperAdmin Dashboard...</p>
              </div>
            </div>
          }>
            <SuperAdminDashboard
              userEmail={user.email!}
              onBack={() => setShowSuperAdminPanel(false)}
              onViewInstitutionDashboard={handleViewInstitutionDashboard}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  // Show Admin Dashboard
  if (showAdminPanel && userProfile.role === UserRole.Admin && userProfile.institutionId) {
    return (
      <div className="min-h-screen bg-sky-100 text-slate-900">
        <Header
          userRole={userProfile.role}
          onLogout={handleLogout}
          collegeName={userProfile.institutionName}
          onShowReferrals={() => setShowReferralManagement(true)}
        />
        <main>
          <div className="container mx-auto p-4 sm:p-6">
            <Suspense fallback={
              <div className="bg-sky-100 min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-medical-blue mx-auto mb-4"></div>
                  <p className="text-slate-600 text-lg">Loading Admin Dashboard...</p>
                </div>
              </div>
            }>
              <AdminDashboard
                institutionId={userProfile.institutionId}
                institutionName={userProfile.institutionName!}
                adminEmail={user.email!}
                onBack={() => setShowAdminPanel(false)}
              />
            </Suspense>
          </div>
        </main>
      </div>
    );
  }

  // Show District Admin Dashboard
  if (userProfile.role === UserRole.DistrictAdmin && !districtAdminViewingInstitution) {
    return (
      <div className="min-h-screen bg-sky-100 text-slate-900">
        <Header
          userRole={UserRole.DistrictAdmin}
          onLogout={handleLogout}
          collegeName={`${userProfile.institutionName} Dashboard`}
        />
        <main>
          <div className="container mx-auto p-4 sm:p-6">
            <Suspense fallback={
              <div className="bg-sky-100 min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                  <p className="text-slate-600 text-lg">Loading District Dashboard...</p>
                </div>
              </div>
            }>
              <DistrictAdminDashboard
                userEmail={user.email!}
                onLogout={handleLogout}
                onViewInstitution={handleDistrictAdminViewInstitution}
              />
            </Suspense>
          </div>
        </main>
      </div>
    );
  }

  // Show District Admin viewing specific Institution
  if (districtAdminViewingInstitution && userProfile.role === UserRole.DistrictAdmin) {
    return (
      <div className="min-h-screen bg-sky-100 text-slate-900">
        <Header
          userRole={UserRole.DistrictAdmin} // Pass as DistrictAdmin so they see correct header options
          onLogout={handleLogout}
          collegeName={districtAdminViewingInstitution.institutionName}
        />
        {/* Back Button Bar */}
        <div className="bg-indigo-900 text-white px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-medium">Viewing as District Admin: {districtAdminViewingInstitution.institutionName}</span>
          <button
            onClick={handleBackToDistrictDashboard}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to District Dashboard
          </button>
        </div>

        <main>
          <div className="container mx-auto p-4 sm:p-6">
            <Suspense fallback={
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-medical-teal mx-auto mb-4"></div>
                  <p className="text-slate-600 text-lg">Loading Dashboard...</p>
                </div>
              </div>
            }>
              <Dashboard
                userRole={UserRole.DistrictAdmin} // Treat as read-only or restricted view if needed
                institutionId={districtAdminViewingInstitution.institutionId}
                institutionName={districtAdminViewingInstitution.institutionName}
                userEmail={user.email || ''}
                allRoles={[UserRole.DistrictAdmin]}
                setShowSuperAdminPanel={() => { }} // No-op
                setShowAdminPanel={() => { }} // No-op
              />
            </Suspense>
          </div>
        </main>
      </div>
    );
  }

  // Show SuperAdmin viewing institution dashboard
  if (superAdminViewingInstitution && userProfile.role === UserRole.SuperAdmin) {
    return (
      <Suspense fallback={
        <div className="bg-sky-100 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-medical-blue mx-auto mb-4"></div>
            <p className="text-slate-600 text-lg">Loading Institution Dashboard...</p>
          </div>
        </div>
      }>
        <AdminDashboard
          institutionId={superAdminViewingInstitution.institutionId}
          institutionName={superAdminViewingInstitution.institutionName}
          adminEmail={user.email!}
          onBack={handleBackFromInstitutionView}
        />
      </Suspense>
    );
  }

  // Show Referral Management Page
  if (showReferralManagement && userProfile.institutionId) {
    return (
      <div className="min-h-screen bg-sky-100 text-slate-900">
        <Header
          userRole={userProfile.role}
          onLogout={handleLogout}
          collegeName={userProfile.institutionName}
          onShowReferrals={() => { }} // Already on referrals page
        />
        <main>
          <div className="container mx-auto p-4 sm:p-6">
            <Suspense fallback={
              <div className="bg-sky-100 min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            }>
              <ReferralManagementPage
                institutionId={userProfile.institutionId}
                institutionName={userProfile.institutionName || ''}
                userEmail={user.email || ''}
                userRole={userProfile.role}
                userName={userProfile.displayName || ''}
                onBack={() => setShowReferralManagement(false)}
              />
            </Suspense>
          </div>
        </main>
      </div>
    );
  }

  // Show Add/Edit Patient Page
  if (showAddPatientPage && userProfile.institutionId) {
    return (
      <div className="min-h-screen bg-slate-900">
        <Header
          userRole={UserRole.Doctor} // Default to Doctor role for adding patients usually, or use userProfile.role
          onLogout={handleLogout}
          collegeName={userProfile.institutionName}
        />
        <main>
          <Suspense fallback={
            <div className="bg-slate-900 min-h-screen flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-slate-300 text-lg">Loading Patient Form...</p>
              </div>
            </div>
          }>
            <PatientForm
              patientToEdit={patientToEdit}
              onSave={async (patientData: Patient) => {
                try {
                  console.log('💾 Saving patient from Add Patient page...');

                  // Clean the data: remove undefined values and ensure progress notes is always an array
                  const cleanedData = {
                    ...patientData,
                    progressNotes: patientData.progressNotes || [],
                  };

                  // Remove undefined fields to prevent Firestore errors
                  const sanitizedData = JSON.parse(JSON.stringify(cleanedData, (key, value) => {
                    return value === undefined ? null : value;
                  }));

                  if (patientToEdit) {
                    // Update existing patient
                    const patientRef = doc(db, 'patients', patientToEdit.id);
                    await updateDoc(patientRef, sanitizedData);
                    console.log('✅ Patient updated successfully:', patientData.id);
                  } else {
                    // Add new patient
                    const patientsRef = collection(db, 'patients');
                    const docRef = await addDoc(patientsRef, sanitizedData);
                    console.log('✅ Patient added successfully:', docRef.id);
                  }

                  // Close the page after successful save
                  setShowAddPatientPage(false);
                  setPatientToEdit(null);
                  alert('Patient saved successfully!');
                } catch (error: any) {
                  console.error('❌ Error saving patient:', error);
                  alert('Failed to save patient: ' + error.message);
                }
              }}
              onClose={() => {
                setShowAddPatientPage(false);
                setPatientToEdit(null);
              }}
              userRole={userProfile.role}
              defaultUnit={undefined}
              institutionId={userProfile.institutionId}
              institutionName={userProfile.institutionName || ''}
              userEmail={user.email || ''}
              userName={userProfile.displayName}
              availableUnits={undefined}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  // Main Application
  return (
    <div className="min-h-screen bg-sky-100 text-slate-900">
      <Header
        userRole={userProfile.role}
        onLogout={handleLogout}
        collegeName={userProfile.institutionName}
        onShowReferrals={() => setShowReferralManagement(true)}
      />

      <main>
        <div className="container mx-auto p-4 sm:p-6">
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-medical-teal mx-auto mb-4"></div>
                <p className="text-slate-600 text-lg">Loading Dashboard...</p>
              </div>
            </div>
          }>
            <Dashboard
              userRole={userProfile.role}
              institutionId={userProfile.institutionId}
              institutionName={userProfile.institutionName}
              userEmail={user.email || ''}
              allRoles={userProfile.allRoles}
              setShowSuperAdminPanel={setShowSuperAdminPanel}
              setShowAdminPanel={setShowAdminPanel}
              onShowReferrals={() => setShowReferralManagement(true)}
              onShowAddPatient={(patient: any) => {
                setPatientToEdit(patient || null);
                setShowAddPatientPage(true);
              }}
            />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

export default App;
