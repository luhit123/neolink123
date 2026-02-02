import React, { useState, useEffect, Suspense, lazy } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc, onSnapshot } from 'firebase/firestore';
import { MotionConfig, motion } from 'framer-motion';
import { auth, db, authReady } from './firebaseConfig';
import { handleRedirectResult } from './services/authService';
import ErrorBoundary from './components/core/ErrorBoundary';
import Login from './components/Login';
import Header from './components/Header';
import { UserRole, UserProfile, Patient, Unit, InstitutionUser, Official } from './types';
import { animations } from './theme/material3Theme';
import SharedBottomNav from './components/SharedBottomNav';
import { ChatProvider } from './contexts/ChatContext';
import { BackgroundSaveProvider } from './contexts/BackgroundSaveContext';
import BackgroundSaveIndicator from './components/BackgroundSaveIndicator';
import AutoUpdatePrompt from './components/AutoUpdatePrompt';
import { QueryProvider } from './providers/QueryProvider';

// Lazy load heavy components
const Dashboard = lazy(() => import('./components/Dashboard'));
const SuperAdminDashboard = lazy(() => import('./components/SuperAdminDashboardEnhanced'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const DistrictAdminDashboard = lazy(() => import('./components/DistrictAdminDashboard'));
const OfficialDashboard = lazy(() => import('./components/OfficialDashboard'));
const ReferralManagementPage = lazy(() => import('./components/ReferralManagementPage'));
const PatientForm = lazy(() => import('./components/PatientForm'));
const AnalyticsPage = lazy(() => import('./components/AnalyticsPage'));
const AIReportsPage = lazy(() => import('./components/AIReportsPage'));
const PasswordSetup = lazy(() => import('./components/PasswordSetup'));

// Module-level flag to ensure redirect is handled only once per page load
let redirectHandled = false;

// Helper to get document using onSnapshot (handles offline gracefully)
const getDocWithSnapshot = (docRef: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onSnapshot(
      docRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        unsubscribe(); // Only need first result
        if (snapshot.metadata.fromCache) {
          console.log('📦 Got document from cache:', docRef.path);
        } else {
          console.log('🌐 Got document from server:', docRef.path);
        }
        resolve(snapshot);
      },
      (error) => {
        unsubscribe();
        // For "unavailable" errors, don't reject - return empty doc
        if (error.code === 'unavailable') {
          console.warn('⚠️ Firestore temporarily offline for:', docRef.path);
          resolve({ exists: () => false, data: () => null, metadata: { fromCache: true } });
        } else {
          reject(error);
        }
      }
    );

    // Timeout fallback - if no response in 10s, return empty
    setTimeout(() => {
      unsubscribe();
      console.warn('⚠️ Timeout waiting for document:', docRef.path);
      resolve({ exists: () => false, data: () => null, metadata: { fromCache: true } });
    }, 10000);
  });
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [institutionUserData, setInstitutionUserData] = useState<InstitutionUser | null>(null); // Full user data with allowedDashboards
  const [officialData, setOfficialData] = useState<Official | null>(null); // For Official role
  const [loading, setLoading] = useState(true);
  const [redirectChecked, setRedirectChecked] = useState(false);
  const [showSuperAdminPanel, setShowSuperAdminPanel] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showReferralManagement, setShowReferralManagement] = useState(false);
  const [showAddPatientPage, setShowAddPatientPage] = useState(false);
  const [showAnalyticsPage, setShowAnalyticsPage] = useState(false);
  const [showAIReportsPage, setShowAIReportsPage] = useState(false);
  const [patientToEdit, setPatientToEdit] = useState<any>(null);
  const [defaultUnitForAdd, setDefaultUnitForAdd] = useState<Unit | undefined>(undefined);
  const [dashboardSelectedUnit, setDashboardSelectedUnit] = useState<Unit>(Unit.NICU);
  const [dashboardEnabledFacilities, setDashboardEnabledFacilities] = useState<Unit[]>([Unit.NICU, Unit.PICU]);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessMessage, setAccessMessage] = useState('');
  const [accessRequestSent, setAccessRequestSent] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [requestName, setRequestName] = useState('');
  const [requestRole, setRequestRole] = useState('Doctor');
  const [superAdminViewingInstitution, setSuperAdminViewingInstitution] = useState<{
    institutionId: string;
    institutionName: string;
  } | null>(null);
  const [districtAdminViewingInstitution, setDistrictAdminViewingInstitution] = useState<{
    institutionId: string;
    institutionName: string;
  } | null>(null);

  // Navigation State
  const [showPatientList, setShowPatientList] = useState(false);
  const [triggerAnalyticsScroll, setTriggerAnalyticsScroll] = useState(0);
  const [triggerQuickActions, setTriggerQuickActions] = useState(0);
  const [institutionDoctors, setInstitutionDoctors] = useState<string[]>([]);

  // Refs for checking state inside popstate listener without re-binding
  const stateRef = React.useRef({
    showSuperAdminPanel,
    showAdminPanel,
    showReferralManagement,
    showAddPatientPage,
    showAnalyticsPage,
    showAIReportsPage,
    superAdminViewingInstitution,
    districtAdminViewingInstitution,
    showPatientList,
  });

  // Update refs when state changes
  useEffect(() => {
    stateRef.current = {
      showSuperAdminPanel,
      showAdminPanel,
      showReferralManagement,
      showAddPatientPage,
      showAnalyticsPage,
      showAIReportsPage,
      superAdminViewingInstitution,
      districtAdminViewingInstitution,
      showPatientList
    };
  }, [showSuperAdminPanel, showAdminPanel, showReferralManagement, showAddPatientPage, showAnalyticsPage, showAIReportsPage, superAdminViewingInstitution, districtAdminViewingInstitution, showPatientList]);

  // Load institution doctors when user profile is available
  useEffect(() => {
    const loadDoctors = async () => {
      if (userProfile?.institutionId) {
        try {
          const institutionDoc = await getDoc(doc(db, 'institutions', userProfile.institutionId));
          if (institutionDoc.exists()) {
            const data = institutionDoc.data();
            if (data.doctors && Array.isArray(data.doctors)) {
              setInstitutionDoctors(data.doctors);
            }
          }
        } catch (error) {
          console.error('❌ Error loading doctors:', error);
        }
      }
    };
    loadDoctors();
  }, [userProfile?.institutionId]);

  // Access control for AI Reports page
  // Allow Admin, Doctor, Nurse, and SuperAdmin roles
  useEffect(() => {
    if (showAIReportsPage && userProfile) {
      const canAccess = userProfile.role === UserRole.Admin ||
        userProfile.role === UserRole.Doctor ||
        userProfile.role === UserRole.Nurse ||
        userProfile.role === UserRole.SuperAdmin;
      if (!canAccess) {
        console.log('🚫 Access denied to AI Reports for role:', userProfile.role);
        setShowAIReportsPage(false);
      }
    }
  }, [showAIReportsPage, userProfile]);

  // Smart back navigation
  useEffect(() => {
    // Ensure we have a history entry to "back" into
    // We push a 'trap' state if we don't have one
    if (!window.history.state) {
      window.history.replaceState({ page: 'root' }, '', window.location.pathname);
      window.history.pushState({ page: 'app' }, '', window.location.pathname);
    }

    const handlePopState = (event: PopStateEvent) => {
      // Skip if Dashboard already handled this popstate (e.g., closing patient view)
      if ((window as any).__patientViewBackHandled) {
        console.log('App: Skipping popstate - already handled by Dashboard');
        return;
      }

      const state = stateRef.current;

      // Check for any open modals/panels in priority order
      if (state.showAddPatientPage) {
        setShowAddPatientPage(false);
        setPatientToEdit(null);
        // Restore the 'app' state so the back button is "reset"
        window.history.pushState({ page: 'app' }, '', window.location.pathname);
        return;
      }

      if (state.showAnalyticsPage) {
        setShowAnalyticsPage(false);
        window.history.pushState({ page: 'app' }, '', window.location.pathname);
        return;
      }

      if (state.showAIReportsPage) {
        setShowAIReportsPage(false);
        window.history.pushState({ page: 'app' }, '', window.location.pathname);
        return;
      }

      if (state.showReferralManagement) {
        setShowReferralManagement(false);
        window.history.pushState({ page: 'app' }, '', window.location.pathname);
        return;
      }

      if (state.showAdminPanel) {
        setShowAdminPanel(false);
        window.history.pushState({ page: 'app' }, '', window.location.pathname);
        return;
      }

      if (state.superAdminViewingInstitution) {
        setSuperAdminViewingInstitution(null);
        setShowSuperAdminPanel(true);
        window.history.pushState({ page: 'app' }, '', window.location.pathname);
        return;
      }

      if (state.showSuperAdminPanel) {
        setShowSuperAdminPanel(false);
        window.history.pushState({ page: 'app' }, '', window.location.pathname);
        return;
      }

      if (state.districtAdminViewingInstitution) {
        setDistrictAdminViewingInstitution(null);
        window.history.pushState({ page: 'app' }, '', window.location.pathname);
        return;
      }

      if (state.showPatientList) {
        setShowPatientList(false);
        // Don't push new state - we're already at 'app' state after the pop
        return;
      }

      // If nothing is open (Main Dashboard)
      // We are now technically at 'root' state because 'app' was popped
      const confirmExit = window.confirm('Are you sure you want to close the app?');
      if (!confirmExit) {
        // User cancelled exit, push 'app' state back to trap them
        window.history.pushState({ page: 'app' }, '', window.location.pathname);
      } else {
        // User confirmed exit
        // We are already at 'root', so if there's history before this, they go there.
        // If this was a fresh tab, 'root' might be the end. 
        // We can try to navigate back one more time to truly close/leave if possible, 
        // or just let them stay at 'root' (which renders the same app but next back exits).
        // Usually, just letting the pop happen is enough if they have history.
        // If we want to force close:
        // window.close(); // Scripts may not be allowed to close windows they didn't open.
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []); // Empty dependency array - relies on refs

  // Track if we're on the main dashboard (for rendering conditional UI if needed)
  const isOnMainPage = !showSuperAdminPanel && !showAdminPanel && !showReferralManagement &&
    !showAddPatientPage && !showAnalyticsPage && !showAIReportsPage && !superAdminViewingInstitution && !districtAdminViewingInstitution;

  // Combined auth initialization effect
  // IMPORTANT: Set up onAuthStateChanged BEFORE checking redirect result
  // This ensures the listener is ready when Firebase updates auth state from redirect
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Step 1: Wait for auth persistence to be ready
        console.log('🔄 Waiting for auth persistence...');
        await authReady;
        console.log('✅ Auth persistence ready');

        if (!mounted) return;

        // Step 2: Set up auth state listener FIRST
        // This listener will fire when:
        // - User is already logged in (from localStorage)
        // - Redirect completes and Firebase updates auth state
        // - User logs out
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (!mounted) return;

          try {
            if (firebaseUser) {
              console.log('👤 Auth state changed - user:', firebaseUser.email);
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
              console.log('👤 Auth state changed - no user');
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

        // Step 3: Check for redirect result
        // The auth state listener above will handle the user when redirect completes
        // This call ensures we process any pending redirect and catch errors
        if (!redirectHandled) {
          redirectHandled = true;

          try {
            console.log('🔄 Checking for redirect result...');
            const user = await handleRedirectResult();
            if (user) {
              console.log('✅ User signed in via redirect:', user.email);
              // Auth state listener will handle the rest
            } else {
              console.log('ℹ️ No redirect result');
            }
          } catch (error: any) {
            console.error('❌ Redirect result error:', error);
            // Only show error if it's not a cancelled/closed popup
            if (!error.message?.includes('cancelled')) {
              setAuthError(error.message || 'Failed to complete sign in.');
            }
          } finally {
            if (mounted) {
              setRedirectChecked(true);
              // Ensure loading is set to false if no user is logged in after redirect check
              // Give Firebase a moment to update auth state
              setTimeout(() => {
                if (mounted && !auth.currentUser) {
                  setLoading(false);
                }
              }, 500);
            }
          }
        } else {
          if (mounted && !redirectChecked) {
            setRedirectChecked(true);
          }
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        if (mounted) {
          setLoading(false);
          setRedirectChecked(true);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const loadUserProfile = async (firebaseUser: User) => {
    try {
      console.log('👤 Loading profile for:', firebaseUser.email);
      const email = firebaseUser.email?.toLowerCase();

      if (!email) {
        throw new Error('User email is missing');
      }

      // Initial SuperAdmin emails (hardcoded for first-time setup)
      const INITIAL_SUPER_ADMINS = [
        'luhitdhungel6@gmail.com'
      ];

      // Parallel check: users collection, superAdmins collection, AND approved_users collection
      console.log('🔍 Loading profile for email:', email);

      let userDoc, superAdminDoc, approvedSnapshot;

      // Fetch documents using onSnapshot (handles offline gracefully)
      console.log('📡 Fetching user documents...');

      try {
        // Fetch user doc and superAdmin doc in parallel
        [userDoc, superAdminDoc] = await Promise.all([
          getDocWithSnapshot(doc(db, 'users', firebaseUser.uid)),
          getDocWithSnapshot(doc(db, 'superAdmins', email))
        ]);
        console.log('✅ User doc exists:', userDoc.exists(), '| SuperAdmin doc exists:', superAdminDoc.exists());
      } catch (e: any) {
        // Only warn for offline - it's a temporary state
        if (e.code === 'unavailable') {
          console.warn('⚠️ Firestore temporarily offline, using defaults');
          userDoc = { exists: () => false, data: () => null };
          superAdminDoc = { exists: () => false, data: () => null };
        } else {
          console.error('❌ Failed to fetch user docs:', e.code, e.message);
          throw e;
        }
      }

      try {
        console.log('📡 Fetching approved_users...');
        approvedSnapshot = await getDocs(
          query(
            collection(db, 'approved_users'),
            where('email', '==', email)
          )
        );
        console.log('✅ Approved users fetched:', approvedSnapshot.size);
      } catch (e: any) {
        // Offline is temporary - don't crash, just warn and return
        if (e.code === 'unavailable' || e.message?.includes('offline')) {
          console.warn('⚠️ Firestore temporarily offline for approved_users query');
          // Set loading false and let Firestore auto-recover
          setLoading(false);
          return; // Exit early - Firestore will call onAuthStateChanged again when back online
        }
        console.error('❌ Failed to fetch approved_users:', e.code, e.message);
        throw new Error(`Failed to fetch approved_users: ${e.message}`);
      }

      console.log('📋 Query results - users:', userDoc.exists(), 'superAdmin:', superAdminDoc.exists(), 'approved_users:', approvedSnapshot.size);

      // Debug logging
      console.log('📋 SuperAdmin doc exists:', superAdminDoc.exists());
      if (superAdminDoc.exists()) {
        console.log('📋 SuperAdmin doc data:', superAdminDoc.data());
      }

      // Check if email is in initial super admins list
      const isInitialSuperAdmin = INITIAL_SUPER_ADMINS.includes(email);
      console.log('🔐 Is initial SuperAdmin:', isInitialSuperAdmin);

      // Auto-create superAdmin document if in initial list but doesn't exist
      if (isInitialSuperAdmin && !superAdminDoc.exists()) {
        console.log('📝 Creating SuperAdmin document for initial admin...');
        await setDoc(doc(db, 'superAdmins', email), {
          email: email,
          name: firebaseUser.displayName || 'Super Admin',
          enabled: true,
          createdAt: new Date().toISOString(),
          autoCreated: true
        });
        console.log('✅ SuperAdmin document created!');
      }

      // Step 1: Quick check if SuperAdmin (check both users collection, superAdmins collection, or initial list)
      const isSuperAdminInUsers = userDoc.exists() && userDoc.data()?.role === UserRole.SuperAdmin;
      const isSuperAdminInCollection = superAdminDoc.exists() && superAdminDoc.data()?.enabled !== false;

      console.log('🔐 isSuperAdminInUsers:', isSuperAdminInUsers);
      console.log('🔐 isSuperAdminInCollection:', isSuperAdminInCollection);

      if (isSuperAdminInUsers || isSuperAdminInCollection || isInitialSuperAdmin) {
        const superAdminData = superAdminDoc.exists() ? superAdminDoc.data() : {};
        const profile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: superAdminData.name || firebaseUser.displayName || 'SuperAdmin',
          role: UserRole.SuperAdmin,
          createdAt: superAdminData.createdAt || new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };
        setUserProfile(profile);
        setAccessDenied(false);
        setShowSuperAdminPanel(true); // Automatically show SuperAdmin dashboard
        console.log('✅ SuperAdmin login - showing SuperAdmin dashboard');

        // Update users collection with SuperAdmin role
        setDoc(doc(db, 'users', firebaseUser.uid), {
          ...profile,
          role: UserRole.SuperAdmin,
          lastLoginAt: new Date().toISOString()
        }, { merge: true });
        setLoading(false); // Important: Set loading to false for SuperAdmin
        return;
      }

      // Step 2: Check approved_users for District Admin
      const districtAdminSnapshot = await getDocs(
        query(
          collection(db, 'approved_users'),
          where('email', '==', firebaseUser.email?.toLowerCase()),
          where('role', '==', UserRole.DistrictAdmin)
        )
      );

      // Check if found and enabled
      const districtAdminDoc = districtAdminSnapshot.docs.find(d => d.data().enabled !== false);
      if (districtAdminDoc) {
        const adminData = districtAdminDoc.data();
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
          updateDoc(doc(db, 'approved_users', districtAdminDoc.id), { uid: firebaseUser.uid });
        }
        return;
      }

      // Step 2.5: Check officials collection for Official role
      const officialSnapshot = await getDocs(
        query(
          collection(db, 'officials'),
          where('email', '==', firebaseUser.email?.toLowerCase())
        )
      );

      const officialDoc = officialSnapshot.docs.find(d => d.data().enabled !== false);
      if (officialDoc) {
        const officialDocData = officialDoc.data();
        const profile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: officialDocData.displayName || 'Official',
          role: UserRole.Official,
          createdAt: officialDocData.addedAt || new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          allRoles: [UserRole.Official]
        };
        setUserProfile(profile);
        setOfficialData({
          ...officialDocData,
          id: officialDoc.id
        } as Official);
        setAccessDenied(false);
        console.log('✅ Official login - showing Official dashboard');

        // Update users collection with Official role
        setDoc(doc(db, 'users', firebaseUser.uid), {
          ...profile,
          role: UserRole.Official,
          designation: officialDocData.designation,
          department: officialDocData.department,
          canViewAllInstitutions: officialDocData.canViewAllInstitutions,
          assignedInstitutionIds: officialDocData.assignedInstitutionIds,
          lastLoginAt: new Date().toISOString()
        }, { merge: true });

        // Update lastLoginAt in officials collection
        updateDoc(doc(db, 'officials', officialDoc.id), {
          lastLoginAt: new Date().toISOString()
        });

        setLoading(false);
        return;
      }

      // Step 3: Check approved_users for institution access (SuperAdmin not checked here)

      // Check if user found
      if (approvedSnapshot.empty) {
        console.log('❌ No approved user found for email:', email);
        setAccessDenied(true);
        setAccessMessage(
          `Your email (${firebaseUser.email}) is not authorized to access any institution.\n\n` +
          'Please contact your institution administrator. If you recently had your email changed, ' +
          'you may need to use your new email address to login.'
        );
        setUserProfile(null);
        return;
      }

      // Get all institutions and filter out disabled ones (enabled !== false means enabled)
      const allInstitutions = approvedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as any));

      console.log('📋 Found', allInstitutions.length, 'institution(s) for user');

      // Filter to only enabled institutions (enabled field missing or true)
      const enabledInstitutions = allInstitutions.filter((inst: any) => inst.enabled !== false);

      if (enabledInstitutions.length === 0) {
        console.log('❌ All institutions are disabled for this user');
        setAccessDenied(true);
        setAccessMessage(
          `Your account has been disabled. Please contact your institution administrator.`
        );
        setUserProfile(null);
        return;
      }

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

      // Store full institution user data (includes allowedDashboards)
      setInstitutionUserData(primaryRole as InstitutionUser);

      setUserProfile(profile);
      setAccessDenied(false);
      console.log('✅ Logged in as', profile.role, '-', profile.institutionName);
      console.log('📋 Allowed Dashboards:', primaryRole.allowedDashboards || 'All (no restriction)');

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
      // Offline/unavailable is temporary - don't treat as error
      if (error.code === 'unavailable' || error.message?.includes('offline')) {
        console.warn('⚠️ Firestore temporarily offline - will auto-recover');
        // Don't set accessDenied - just wait for auto-recovery
        setLoading(false);
        return;
      }

      console.error('❌ Error loading user profile:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      setAccessDenied(true);

      // Show specific error for real errors (not offline)
      let errorMsg = 'Error loading user profile. ';
      if (error.code === 'permission-denied') {
        errorMsg += 'Permission denied - check Firestore rules.';
      } else if (error.code === 'failed-precondition') {
        errorMsg += 'Missing Firestore index - check console for link.';
      } else if (error.message) {
        errorMsg += error.message;
      } else {
        errorMsg += 'Please try again or contact support.';
      }
      setAccessMessage(errorMsg);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBottomNavAction = (tab: 'home' | 'patients' | 'analytics' | 'more') => {
    // Reset secondary pages to show Dashboard
    if (tab === 'home') {
      setShowReferralManagement(false);
      setShowAddPatientPage(false);
      setShowAnalyticsPage(false);
      setShowPatientList(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'patients') {
      setShowReferralManagement(false);
      setShowAddPatientPage(false);
      setShowAnalyticsPage(false);
      setShowPatientList(true);
      // Push history state for back button
      window.history.pushState({ page: 'patientList' }, '', window.location.pathname);
    } else if (tab === 'analytics') {
      // Navigate to dedicated analytics page
      setShowReferralManagement(false);
      setShowAddPatientPage(false);
      setShowPatientList(false);
      setShowAnalyticsPage(true);
      window.history.pushState({ page: 'analytics' }, '', window.location.pathname);
    } else if (tab === 'more') {
      console.log('🔘 App: More tab clicked calling setTriggerQuickActions');
      setShowReferralManagement(false);
      setShowAddPatientPage(false);
      setShowAnalyticsPage(false);
      setShowPatientList(false);
      // Trigger quick actions in dashboard
      setTimeout(() => {
        console.log('🔘 App: Setting triggerQuickActions');
        setTriggerQuickActions(prev => prev + 1);
      }, 100);
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
      setInstitutionUserData(null);
      setOfficialData(null);
      setShowSuperAdminPanel(false);
      setShowAdminPanel(false);
      setAccessDenied(false);
      setSuperAdminViewingInstitution(null);
      setDistrictAdminViewingInstitution(null);
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  // Loading state - wait for BOTH loading to complete AND redirect check to finish
  // This prevents showing Login screen briefly before redirect auth is processed
  if (loading || !redirectChecked) {
    return (
      <div className="bg-sky-100 min-h-screen flex items-center justify-center pwa-full-height">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-teal"></div>
          <p className="text-slate-600 text-sm">Loading...</p>
        </motion.div>
      </div>
    );
  }

  // Check for password setup page (accessible without login)
  if (window.location.pathname === '/setup-password') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div></div>}>
        <PasswordSetup />
      </Suspense>
    );
  }

  // Not logged in (only show after redirect check is complete)
  if (!user) {
    return <Login initialError={authError} />;
  }

  // Handle access request submission
  const handleRequestAccess = async () => {
    const nameToUse = requestName || user?.displayName || '';
    if (!user?.email || !nameToUse) return;

    setRequestingAccess(true);
    try {
      // Store access request in Firestore
      const requestRef = doc(collection(db, 'pending_access_requests'));
      await setDoc(requestRef, {
        email: user.email.toLowerCase(),
        displayName: nameToUse,
        requestedRole: requestRole,
        uid: user.uid,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        photoURL: user.photoURL || null
      });
      setAccessRequestSent(true);
      console.log('✅ Access request submitted');
    } catch (error) {
      console.error('Error submitting access request:', error);
      alert('Failed to submit request. Please try again.');
    } finally {
      setRequestingAccess(false);
    }
  };

  // Access denied - improved UI with request access functionality
  if (accessDenied) {
    return (
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-screen flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full border border-slate-700">
          {!accessRequestSent ? (
            <>
              <div className="flex justify-center mb-6">
                <div className="bg-amber-500/20 p-4 rounded-full">
                  <svg className="w-16 h-16 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>

              <h1 className="text-2xl font-bold text-white text-center mb-2">
                Access Required
              </h1>
              <p className="text-slate-400 text-center text-sm mb-6">
                Your account needs to be approved by an administrator
              </p>

              <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                      <span className="text-white font-bold">{user?.email?.[0]?.toUpperCase()}</span>
                    </div>
                  )}
                  <div>
                    <p className="text-white font-medium">{user?.displayName || 'User'}</p>
                    <p className="text-slate-400 text-sm">{user?.email}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-slate-300 text-sm block mb-2">Your Name</label>
                  <input
                    type="text"
                    value={requestName || user?.displayName || ''}
                    onChange={(e) => setRequestName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 text-sm block mb-2">Your Role</label>
                  <select
                    value={requestRole}
                    onChange={(e) => setRequestRole(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="Doctor">Doctor</option>
                    <option value="Nurse">Nurse</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleRequestAccess}
                  disabled={requestingAccess || (!requestName && !user?.displayName)}
                  className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-slate-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {requestingAccess ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Request Access
                    </>
                  )}
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-3 px-4 rounded-lg transition-colors border border-slate-600"
                >
                  Sign Out & Use Different Account
                </button>
              </div>

              <p className="mt-6 text-center text-slate-500 text-xs">
                Your request will be sent to the system administrator for approval.
              </p>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-6">
                <div className="bg-green-500/20 p-4 rounded-full">
                  <svg className="w-16 h-16 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <h1 className="text-2xl font-bold text-white text-center mb-2">
                Request Submitted!
              </h1>
              <p className="text-slate-400 text-center text-sm mb-6">
                Your access request has been sent to the administrator.
              </p>

              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
                <p className="text-green-300 text-sm text-center">
                  You will receive access once your request is approved. Please check back later.
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Sign Out
              </button>

              <p className="mt-6 text-center text-slate-500 text-xs">
                Requested as: <span className="text-sky-400">{user?.email}</span>
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // User profile not loaded
  if (!userProfile) {
    return (
      <div className="bg-sky-100 min-h-screen flex items-center justify-center pwa-full-height">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-teal"></div>
          <p className="text-slate-600 text-sm">Loading profile...</p>
        </motion.div>
      </div>
    );
  }

  // Show SuperAdmin Dashboard - SuperAdmins ONLY see this dashboard
  if (userProfile.role === UserRole.SuperAdmin && !superAdminViewingInstitution) {
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
              onBack={handleLogout} // SuperAdmin logs out instead of going to regular dashboard
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

  // Show Official Dashboard (view-only access to institutions)
  if (userProfile.role === UserRole.Official && officialData) {
    return (
      <Suspense fallback={
        <div className="bg-slate-100 dark:bg-slate-900 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400 text-lg">Loading Official Dashboard...</p>
          </div>
        </div>
      }>
        <OfficialDashboard
          official={officialData}
          userEmail={user.email!}
          onLogout={handleLogout}
        />
      </Suspense>
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
                displayName={userProfile.displayName}
                allowedDashboards={undefined} // District Admin sees all dashboards for institution
                allRoles={[UserRole.DistrictAdmin]}
                setShowSuperAdminPanel={() => { }} // No-op
                setShowAdminPanel={() => { }} // No-op
                showPatientList={showPatientList}
                setShowPatientList={setShowPatientList}
                doctors={institutionDoctors}
                onShowReferrals={() => setShowReferralManagement(true)}
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
      <div className="min-h-screen bg-sky-100 text-slate-900 pb-20">
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
        <SharedBottomNav
          activeTab="more" // Referrals is kind of 'more' or we can just leave it unset
          onTabChange={handleBottomNavAction}
          onAddPatient={() => {
            if (userProfile.role === UserRole.Doctor || userProfile.role === UserRole.Nurse) {
              setPatientToEdit(null);
              setDefaultUnitForAdd(undefined);
              setShowAddPatientPage(true);
            }
          }}
          showAddButton={false} // Use FAB if desired, or here we can show FAB? 
        // Actually user removed Add button from bar, so keep false
        />
      </div>
    );
  }

  // Show Analytics Page - Full dedicated analytics view (lazy loaded with its own data fetching)
  if (showAnalyticsPage && userProfile.institutionId) {
    return (
      <div className="min-h-screen bg-sky-100 text-slate-900">
        <Suspense fallback={
          <div className="bg-sky-100 min-h-screen flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-slate-600 text-lg">Loading Analytics...</p>
            </div>
          </div>
        }>
          <AnalyticsPage
            institutionId={userProfile.institutionId}
            selectedUnit={dashboardSelectedUnit}
            onSelectUnit={setDashboardSelectedUnit}
            enabledFacilities={dashboardEnabledFacilities}
            onBack={() => {
              setShowAnalyticsPage(false);
              window.history.back();
            }}
            institutionName={userProfile.institutionName}
          />
        </Suspense>
      </div>
    );
  }

  // Show AI Reports Page - Full dedicated AI reports view
  // Admin, Doctor, Nurse, and SuperAdmin roles can access AI Reports
  const canAccessAIReports = userProfile.role === UserRole.Admin ||
    userProfile.role === UserRole.Doctor ||
    userProfile.role === UserRole.Nurse ||
    userProfile.role === UserRole.SuperAdmin;

  if (showAIReportsPage && userProfile.institutionId && canAccessAIReports) {
    return (
      <div className="min-h-screen bg-slate-900 text-white">
        <Suspense fallback={
          <div className="bg-slate-900 min-h-screen flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-slate-400 text-lg">Loading AI Reports...</p>
            </div>
          </div>
        }>
          <AIReportsPage
            institutionId={userProfile.institutionId}
            institutionName={userProfile.institutionName}
            selectedUnit={dashboardSelectedUnit}
            onSelectUnit={setDashboardSelectedUnit}
            enabledFacilities={dashboardEnabledFacilities}
            onBack={() => {
              setShowAIReportsPage(false);
              window.history.back();
            }}
          />
        </Suspense>
      </div>
    );
  }

  // Show Add/Edit Patient Page - Full screen without app header for maximum space
  if (showAddPatientPage && userProfile.institutionId) {
    return (
      <Suspense fallback={
        <div className="bg-slate-100 h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-slate-600 text-lg">Loading Patient Form...</p>
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

              // Check if there are more siblings to add (for twins/triplets)
              const hasMoreSiblings = (patientData as any)._hasMoreSiblings;

              if (!hasMoreSiblings) {
                // Close the page after successful save (single birth or last sibling)
                setShowAddPatientPage(false);
                setPatientToEdit(null);
              }
              // Don't show alert for multiple births - the form handles its own UI
            } catch (error: any) {
              console.error('❌ Error saving patient:', error);
              alert('Failed to save patient: ' + error.message);
            }
          }}
          onClose={() => {
            setShowAddPatientPage(false);
            setPatientToEdit(null);
            setDefaultUnitForAdd(undefined);
          }}
          userRole={userProfile.role}
          defaultUnit={defaultUnitForAdd}
          institutionId={userProfile.institutionId}
          institutionName={userProfile.institutionName || ''}
          userEmail={user.email || ''}
          userName={userProfile.displayName}
          availableUnits={undefined}
          doctors={institutionDoctors}
        />
      </Suspense>
    );
  }

  // Main Application - Wrapped with QueryProvider, ErrorBoundary and MotionConfig
  return (
    <QueryProvider>
      <BackgroundSaveProvider>
        <ChatProvider>
          {/* Auto-update prompt for instant updates */}
          <AutoUpdatePrompt />

          {/* Background save indicator for clinical notes */}
          <BackgroundSaveIndicator />

          <ErrorBoundary>
            <MotionConfig
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
              }}
              reducedMotion="user"
            >
              <div className="min-h-screen bg-sky-100 text-slate-900 no-double-tap-zoom">
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
                        displayName={institutionUserData?.displayName || userProfile.displayName}
                        allowedDashboards={institutionUserData?.allowedDashboards}
                        allRoles={userProfile.allRoles}
                        setShowSuperAdminPanel={setShowSuperAdminPanel}
                        setShowAdminPanel={setShowAdminPanel}
                        onShowReferrals={() => setShowReferralManagement(true)}
                        onShowAddPatient={(patient: any, unit?: Unit) => {
                          setPatientToEdit(patient || null);
                          setDefaultUnitForAdd(unit);
                          setShowAddPatientPage(true);
                        }}
                        onShowAnalytics={() => {
                          setShowAnalyticsPage(true);
                          window.history.pushState({ page: 'analytics' }, '', window.location.pathname);
                        }}
                        onShowAIReports={() => {
                          setShowAIReportsPage(true);
                          window.history.pushState({ page: 'aiReports' }, '', window.location.pathname);
                        }}
                        showPatientList={showPatientList}
                        setShowPatientList={setShowPatientList}
                        triggerAnalyticsScroll={triggerAnalyticsScroll}
                        triggerQuickActions={triggerQuickActions}
                        doctors={institutionDoctors}
                        onUnitChange={setDashboardSelectedUnit}
                        onFacilitiesLoaded={setDashboardEnabledFacilities}
                      />
                    </Suspense>
                  </div>
                </main>

                <SharedBottomNav
                  activeTab={showPatientList ? 'patients' : 'home'}
                  onTabChange={handleBottomNavAction}
                  onAddPatient={() => {
                    // Add button removed from bar per user request, but handler kept if we re-enable
                    setPatientToEdit(null);
                    setDefaultUnitForAdd(undefined);
                    setShowAddPatientPage(true);
                  }}
                  showAddButton={false}
                />
              </div>
            </MotionConfig>
          </ErrorBoundary>
        </ChatProvider>
      </BackgroundSaveProvider>
    </QueryProvider>
  );
}

export default App;
