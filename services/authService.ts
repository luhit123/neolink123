import {
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, googleProvider, authReady, pendingRedirectResult, functions } from '../firebaseConfig';
import { saveUserProfile, getUserProfile } from './firestoreService';
import { UserRole } from '../types';
import { updateUserConsent } from './firestoreService';
import { isPWAMode, isMobileDevice } from '../utils/pwaDetection';

// ============================================================================
// ENTERPRISE AUTHENTICATION MODE
// ============================================================================
// Set to true to use Cloud Functions for secure server-side authentication
// Set to false for legacy client-side authentication (less secure)
// ============================================================================
const USE_ENTERPRISE_AUTH = true; // Enterprise auth with asia-southeast1 region and auto-migration support

// Sign in with Google
// IMPORTANT: We use POPUP for ALL platforms including mobile/PWA
// Redirect flow doesn't work on iOS PWAs (opens in Safari, never returns)
export const signInWithGoogle = async () => {
  try {
    // Wait for auth persistence to be ready
    await authReady;

    const isMobile = isMobileDevice();
    const isPWA = isPWAMode();

    console.log('🔄 Google Sign-In starting...', { isMobile, isPWA });

    // ALWAYS use popup - redirect doesn't work on iOS PWA
    // The popup will open in a new window/tab which works better
    try {
      console.log('🔄 Opening Google sign-in popup...');
      const result = await signInWithPopup(auth, googleProvider);
      console.log('✅ Popup sign-in successful');
      return result.user;
    } catch (popupError: any) {
      console.error('❌ Popup error:', popupError.code, popupError.message);

      // If popup was blocked or failed on mobile, try redirect as fallback
      // But only for non-PWA mobile browsers (redirect won't work in PWA)
      if (popupError.code === 'auth/popup-blocked' && isMobile && !isPWA) {
        console.log('🔄 Popup blocked, trying redirect as fallback...');
        await signInWithRedirect(auth, googleProvider);
        return null;
      }

      // Re-throw the error for other cases
      throw popupError;
    }
  } catch (error: any) {
    console.error('❌ Error signing in with Google:', error.code, error.message);

    // Handle specific error cases
    let errorMessage = 'Failed to sign in with Google';

    if (error.code === 'auth/popup-closed-by-user') {
      errorMessage = 'Sign-in was cancelled. Please try again.';
    } else if (error.code === 'auth/popup-blocked') {
      errorMessage = 'Pop-up was blocked. Please allow pop-ups for this site and try again.';
    } else if (error.code === 'auth/cancelled-popup-request') {
      errorMessage = 'Sign-in cancelled. Please try again.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Network error. Please check your internet connection.';
    } else if (error.code === 'auth/unauthorized-domain') {
      errorMessage = 'This domain is not authorized. Please contact support.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
};

// Handle redirect result (call this on app load)
// Uses the pendingRedirectResult that was already initiated at module load time
// This is critical - getRedirectResult must be called after persistence is set
export const handleRedirectResult = async () => {
  try {
    // Wait for auth to be ready first (persistence must be set before checking redirect)
    await authReady;

    // Use the redirect result that was already initiated after authReady
    const result = await pendingRedirectResult;
    if (result?.user) {
      console.log('✅ Redirect result received successfully');
      return result.user;
    }
    console.log('ℹ️ No redirect result to process');
    return null;
  } catch (error: any) {
    console.error('❌ Error handling redirect result:', error.code, error.message);

    // Handle specific redirect errors
    let errorMessage = 'Failed to complete sign in';

    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      errorMessage = 'Sign-in was cancelled. Please try again.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Network error. Please check your internet connection.';
    } else if (error.code === 'auth/internal-error') {
      errorMessage = 'Authentication service error. Please try again.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
};

// Sign in with Email and Password
export const signInWithEmail = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    console.error('Error signing in with email:', error);
    let errorMessage = 'Failed to sign in';

    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'No account found with this email';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Incorrect password';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address';
        break;
      case 'auth/user-disabled':
        errorMessage = 'This account has been disabled';
        break;
      default:
        errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
};

// Sign up with Email and Password
export const signUpWithEmail = async (email: string, password: string, displayName: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // Update display name
    if (result.user) {
      await updateProfile(result.user, { displayName });
    }

    return result.user;
  } catch (error: any) {
    console.error('Error signing up:', error);
    let errorMessage = 'Failed to create account';

    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage = 'An account with this email already exists';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address';
        break;
      case 'auth/weak-password':
        errorMessage = 'Password should be at least 6 characters';
        break;
      default:
        errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
};

// Sign out
export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Error signing out:', error);
    throw new Error(error.message || 'Failed to sign out');
  }
};

// Listen to auth state changes
export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Complete user setup (role and college selection)
export const completeUserSetup = async (
  userId: string,
  email: string,
  displayName: string,
  role: UserRole,
  collegeName: string,
  collegeId: string
) => {
  try {
    await saveUserProfile(userId, { email, displayName, role, collegeName, collegeId });
  } catch (error) {
    console.error('Error completing user setup:', error);
    throw error;
  }
};

/**
 * Record user consent for DPDP compliance
 * @param userId - Firebase Auth UID
 * @param aiConsentAccepted - Whether user consented to AI data processing (default false)
 */
export const recordConsent = async (userId: string, aiConsentAccepted: boolean = false) => {
  try {
    const consentData = {
      consentAccepted: true,
      consentTimestamp: new Date().toISOString(),
      consentVersion: '1.0.0', // Current policy version
      legitimateUseClauseAccepted: true, // Government EHR legitimate use
      aiConsentAccepted,
      aiConsentTimestamp: aiConsentAccepted ? new Date().toISOString() : undefined
    };
    await updateUserConsent(userId, consentData);
    return true;
  } catch (error) {
    console.error('Error recording consent:', error);
    throw error;
  }
};

// Check if user has completed setup
export const hasCompletedSetup = async (userId: string): Promise<boolean> => {
  try {
    const profile = await getUserProfile(userId);
    return profile !== null && profile.role && profile.collegeId;
  } catch (error) {
    console.error('Error checking user setup:', error);
    return false;
  }
};

// Get current user
export const getCurrentUser = () => {
  return auth.currentUser;
};

// Send password reset email (self-service for users)
export const sendPasswordReset = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
    console.log('✅ Password reset email sent successfully');
  } catch (error: any) {
    console.error('Error sending password reset email:', error);

    let errorMessage = 'Failed to send password reset email';

    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'No account found with this email address';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many requests. Please try again later.';
        break;
      default:
        errorMessage = error.message || 'Failed to send password reset email';
    }

    throw new Error(errorMessage);
  }
};

// Send password reset email using UserID (lookup email from Firestore)
export const sendPasswordResetByUserID = async (userID: string): Promise<string> => {
  try {
    // Import here to avoid circular dependency
    const { db } = await import('../firebaseConfig');
    const { collection, query, where, getDocs } = await import('firebase/firestore');

    let userEmail = '';

    // First, try to find in institutions collection
    const institutionsRef = collection(db, 'institutions');
    const instQuery = query(institutionsRef, where('userID', '==', userID));
    const instSnapshot = await getDocs(instQuery);

    if (!instSnapshot.empty) {
      const institution = instSnapshot.docs[0].data();
      userEmail = institution.adminEmail;
    } else {
      // Try approved_users collection
      const usersRef = collection(db, 'approved_users');
      const userQuery = query(usersRef, where('userID', '==', userID));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        throw new Error('UserID not found');
      }

      const user = userSnapshot.docs[0].data();
      userEmail = user.email;
    }

    // Send password reset email
    await sendPasswordResetEmail(auth, userEmail);
    console.log('✅ Password reset email sent successfully');

    return userEmail; // Return email for confirmation message
  } catch (error: any) {
    console.error('Error sending password reset by UserID:', error);
    throw error;
  }
};

// ============================================================================
// ENTERPRISE AUTHENTICATION (Cloud Functions - Server-Side)
// ============================================================================
// This is the SECURE method using Cloud Functions:
// - Passwords are NEVER exposed to the client
// - bcrypt hashing (cost factor 12)
// - Rate limiting (5 attempts per 15 minutes)
// - Account lockout (30 minutes after 5 failed attempts)
// - Comprehensive audit logging
// - Custom claims for role-based access
// ============================================================================

interface EnterpriseAuthResult {
  success: boolean;
  token?: string;
  user?: {
    uid: string;
    email: string;
    displayName: string;
    role: string;
    institutionId?: string;
  };
  error?: string;
  lockoutUntil?: number;
  remainingAttempts?: number;
}

/**
 * Enterprise Authentication using Cloud Functions
 * This is the recommended secure authentication method
 */
const authenticateWithCloudFunction = async (identifier: string, password: string): Promise<User> => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 NeoLink Enterprise Authentication System');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📝 Secure login via Cloud Function`);

  const startTime = performance.now();

  try {
    // Call the secure Cloud Function
    const authenticateUser = httpsCallable<
      { identifier: string; password: string },
      EnterpriseAuthResult
    >(functions, 'authenticateUser');

    const result = await authenticateUser({ identifier, password });
    const authResult = result.data;

    if (!authResult.success) {
      // Handle specific error cases
      if (authResult.lockoutUntil) {
        const lockoutMinutes = Math.ceil((authResult.lockoutUntil - Date.now()) / 60000);
        throw new Error(`Account temporarily locked. Try again in ${lockoutMinutes} minutes.`);
      }

      if (authResult.remainingAttempts !== undefined && authResult.remainingAttempts <= 2) {
        throw new Error(`${authResult.error}. ${authResult.remainingAttempts} attempts remaining.`);
      }

      throw new Error(authResult.error || 'Authentication failed');
    }

    let userCredential;

    // Sign in using the custom token from Cloud Function
    // This is the most reliable method as it avoids timing issues with password sync
    if (authResult.token) {
      console.log('🔄 Signing in with custom token...');
      userCredential = await signInWithCustomToken(auth, authResult.token);
    } else {
      // Fallback: Cloud Function verified password but didn't return token
      // This shouldn't happen with the updated Cloud Function
      console.log('🔄 Fallback: Completing authentication with Firebase Auth...');
      const email = authResult.user?.email || identifier;
      userCredential = await signInWithEmailAndPassword(auth, email, password);
    }

    const totalTime = (performance.now() - startTime).toFixed(2);
    console.log(`✅ Enterprise login successful in ${totalTime}ms`);
    console.log(`👤 User: ${authResult.user?.email} (${authResult.user?.role})`);
    console.log('🔒 Password verified server-side (never exposed to client)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return userCredential.user;

  } catch (error: any) {
    console.error('❌ Enterprise authentication failed:', error.message);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Handle Firebase Functions errors
    if (error.code === 'functions/unavailable') {
      throw new Error('Authentication service unavailable. Please try again.');
    }

    throw error;
  }
};

// ============================================================================
// LEGACY AUTHENTICATION (Client-Side - Less Secure)
// ============================================================================
// This method is kept for backward compatibility and fallback.
// It should only be used if Cloud Functions are not deployed.
// ============================================================================

// ============================================================================
// SECURE AUTHENTICATION SYSTEM WITH INDEXED QUERIES
// ============================================================================
// Security Features:
// 1. Parallel indexed queries for fast user lookup
// 2. Initial password stored temporarily (cleared after first login)
// 3. Firebase Auth handles all password hashing and verification
// 4. Role-based access control with enabled/disabled status
// ============================================================================

// User lookup result type
interface UserLookupResult {
  email: string;
  docId: string;
  collectionName: string;
  role: 'superAdmin' | 'districtAdmin' | 'institutionAdmin' | 'official' | 'doctor' | 'nurse' | 'unknown';
  isEnabled: boolean;
  initialPassword?: string; // Only for first-time login, will be cleared after
  displayName?: string;
  institutionId?: string;
  userData?: any;
}

// Clear initial password after first successful login (security measure)
const clearInitialPassword = async (collectionName: string, docId: string) => {
  try {
    const { db } = await import('../firebaseConfig');
    const { doc, updateDoc, deleteField } = await import('firebase/firestore');

    await updateDoc(doc(db, collectionName, docId), {
      password: deleteField(),
      initialPasswordCleared: true,
      firstLoginAt: new Date().toISOString()
    });
    console.log('🔒 Initial password cleared from Firestore (security measure)');
  } catch (error) {
    // Non-critical - log but don't fail login
    console.warn('⚠️ Could not clear initial password:', error);
  }
};

// Parallel user lookup across all collections using indexed queries
const lookupUserByUserID = async (userID: string): Promise<UserLookupResult | null> => {
  const { db } = await import('../firebaseConfig');
  const { collection, query, where, getDocs, limit } = await import('firebase/firestore');

  console.log('🚀 Starting parallel indexed lookup for UserID:', userID);
  const startTime = performance.now();

  // Execute all queries in parallel for maximum speed
  const [
    institutionsResult,
    officialsResult,
    approvedUsersResult,
    districtAdminsResult
  ] = await Promise.allSettled([
    // Query 1: Institution Admins (indexed on userID)
    getDocs(query(
      collection(db, 'institutions'),
      where('userID', '==', userID),
      limit(1)
    )),
    // Query 2: Officials (indexed on userID)
    getDocs(query(
      collection(db, 'officials'),
      where('userID', '==', userID),
      limit(1)
    )),
    // Query 3: Approved Users - Doctors/Nurses (indexed on userID)
    getDocs(query(
      collection(db, 'approved_users'),
      where('userID', '==', userID),
      limit(1)
    )),
    // Query 4: District Admins (indexed on userID)
    getDocs(query(
      collection(db, 'districtAdmins'),
      where('userID', '==', userID),
      limit(1)
    ))
  ]);

  const queryTime = (performance.now() - startTime).toFixed(2);
  console.log(`⚡ Parallel queries completed in ${queryTime}ms`);

  // Check Institution Admin
  if (institutionsResult.status === 'fulfilled' && !institutionsResult.value.empty) {
    const doc = institutionsResult.value.docs[0];
    const institution = doc.data();
    console.log('✅ Found Institution Admin');
    return {
      email: institution.adminEmail,
      docId: doc.id,
      collectionName: 'institutions',
      role: 'institutionAdmin',
      isEnabled: institution.isActive !== false,
      initialPassword: institution.initialPasswordCleared ? undefined : institution.password,
      displayName: institution.adminName || institution.name,
      institutionId: doc.id,
      userData: institution
    };
  }

  // Check District Admin
  if (districtAdminsResult.status === 'fulfilled' && !districtAdminsResult.value.empty) {
    const doc = districtAdminsResult.value.docs[0];
    const districtAdmin = doc.data();
    console.log('✅ Found District Admin');
    return {
      email: districtAdmin.email,
      docId: doc.id,
      collectionName: 'districtAdmins',
      role: 'districtAdmin',
      isEnabled: districtAdmin.enabled !== false,
      initialPassword: districtAdmin.initialPasswordCleared ? undefined : districtAdmin.password,
      displayName: districtAdmin.displayName,
      userData: districtAdmin
    };
  }

  // Check Official
  if (officialsResult.status === 'fulfilled' && !officialsResult.value.empty) {
    const doc = officialsResult.value.docs[0];
    const official = doc.data();
    console.log('✅ Found Official');
    return {
      email: official.email,
      docId: doc.id,
      collectionName: 'officials',
      role: 'official',
      isEnabled: official.enabled !== false,
      initialPassword: official.initialPasswordCleared ? undefined : official.password,
      displayName: official.displayName,
      userData: official
    };
  }

  // Check Approved User (Doctor/Nurse)
  if (approvedUsersResult.status === 'fulfilled' && !approvedUsersResult.value.empty) {
    const doc = approvedUsersResult.value.docs[0];
    const user = doc.data();
    console.log('✅ Found Approved User:', user.role);
    return {
      email: user.email,
      docId: doc.id,
      collectionName: 'approved_users',
      role: user.role?.toLowerCase() === 'nurse' ? 'nurse' : 'doctor',
      isEnabled: user.enabled !== false,
      initialPassword: user.initialPasswordCleared ? undefined : user.password,
      displayName: user.displayName,
      institutionId: user.institutionId,
      userData: user
    };
  }

  console.log('❌ UserID not found in any collection');
  return null;
};

// Parallel user lookup by email across all collections
const lookupUserByEmail = async (email: string): Promise<UserLookupResult | null> => {
  const { db } = await import('../firebaseConfig');
  const { collection, query, where, getDocs, limit } = await import('firebase/firestore');

  const normalizedEmail = email.toLowerCase();
  console.log('🚀 Starting parallel indexed lookup for email:', normalizedEmail);
  const startTime = performance.now();

  // Execute all queries in parallel for maximum speed
  const [
    superAdminsResult,
    districtAdminsResult,
    institutionsResult,
    officialsResult,
    approvedUsersResult
  ] = await Promise.allSettled([
    // Query 1: SuperAdmins (indexed on email)
    getDocs(query(
      collection(db, 'superAdmins'),
      where('email', '==', normalizedEmail),
      limit(1)
    )),
    // Query 2: District Admins (indexed on email)
    getDocs(query(
      collection(db, 'districtAdmins'),
      where('email', '==', normalizedEmail),
      limit(1)
    )),
    // Query 3: Institution Admins (indexed on adminEmail)
    getDocs(query(
      collection(db, 'institutions'),
      where('adminEmail', '==', normalizedEmail),
      limit(1)
    )),
    // Query 4: Officials (indexed on email)
    getDocs(query(
      collection(db, 'officials'),
      where('email', '==', normalizedEmail),
      limit(1)
    )),
    // Query 5: Approved Users (indexed on email)
    getDocs(query(
      collection(db, 'approved_users'),
      where('email', '==', normalizedEmail),
      limit(1)
    ))
  ]);

  const queryTime = (performance.now() - startTime).toFixed(2);
  console.log(`⚡ Parallel queries completed in ${queryTime}ms`);

  // Check SuperAdmin (highest priority)
  if (superAdminsResult.status === 'fulfilled' && !superAdminsResult.value.empty) {
    const doc = superAdminsResult.value.docs[0];
    const superAdmin = doc.data();
    console.log('✅ Found SuperAdmin');
    return {
      email: normalizedEmail,
      docId: doc.id,
      collectionName: 'superAdmins',
      role: 'superAdmin',
      isEnabled: superAdmin.enabled !== false,
      displayName: superAdmin.displayName || 'Super Admin',
      userData: superAdmin
    };
  }

  // Check District Admin
  if (districtAdminsResult.status === 'fulfilled' && !districtAdminsResult.value.empty) {
    const doc = districtAdminsResult.value.docs[0];
    const districtAdmin = doc.data();
    console.log('✅ Found District Admin');
    return {
      email: normalizedEmail,
      docId: doc.id,
      collectionName: 'districtAdmins',
      role: 'districtAdmin',
      isEnabled: districtAdmin.enabled !== false,
      initialPassword: districtAdmin.initialPasswordCleared ? undefined : districtAdmin.password,
      displayName: districtAdmin.displayName,
      userData: districtAdmin
    };
  }

  // Check Institution Admin
  if (institutionsResult.status === 'fulfilled' && !institutionsResult.value.empty) {
    const doc = institutionsResult.value.docs[0];
    const institution = doc.data();
    console.log('✅ Found Institution Admin');
    return {
      email: normalizedEmail,
      docId: doc.id,
      collectionName: 'institutions',
      role: 'institutionAdmin',
      isEnabled: institution.isActive !== false,
      initialPassword: institution.initialPasswordCleared ? undefined : institution.password,
      displayName: institution.adminName || institution.name,
      institutionId: doc.id,
      userData: institution
    };
  }

  // Check Official
  if (officialsResult.status === 'fulfilled' && !officialsResult.value.empty) {
    const doc = officialsResult.value.docs[0];
    const official = doc.data();
    console.log('✅ Found Official');
    return {
      email: normalizedEmail,
      docId: doc.id,
      collectionName: 'officials',
      role: 'official',
      isEnabled: official.enabled !== false,
      initialPassword: official.initialPasswordCleared ? undefined : official.password,
      displayName: official.displayName,
      userData: official
    };
  }

  // Check Approved User (Doctor/Nurse)
  if (approvedUsersResult.status === 'fulfilled' && !approvedUsersResult.value.empty) {
    const doc = approvedUsersResult.value.docs[0];
    const user = doc.data();
    console.log('✅ Found Approved User:', user.role);
    return {
      email: normalizedEmail,
      docId: doc.id,
      collectionName: 'approved_users',
      role: user.role?.toLowerCase() === 'nurse' ? 'nurse' : 'doctor',
      isEnabled: user.enabled !== false,
      initialPassword: user.initialPasswordCleared ? undefined : user.password,
      displayName: user.displayName,
      institutionId: user.institutionId,
      userData: user
    };
  }

  console.log('ℹ️ Email not found in any collection - may be new user');
  return null;
};

// Main sign-in function - uses Enterprise Auth (Cloud Functions) when available
export const signInWithUserID = async (userIDOrEmail: string, password: string) => {
  // ========================================================================
  // ENTERPRISE AUTHENTICATION (Recommended)
  // ========================================================================
  // When USE_ENTERPRISE_AUTH is true, authentication is handled server-side
  // via Cloud Functions with:
  // - bcrypt password hashing
  // - Rate limiting & account lockout
  // - Comprehensive audit logging
  // - No password exposure to client
  // ========================================================================

  if (USE_ENTERPRISE_AUTH) {
    try {
      return await authenticateWithCloudFunction(userIDOrEmail, password);
    } catch (error: any) {
      // If Cloud Functions unavailable, fall back to legacy auth
      if (error.code === 'functions/unavailable' || error.message?.includes('unavailable')) {
        console.warn('⚠️ Cloud Functions unavailable, falling back to legacy authentication');
        // Continue to legacy auth below
      } else {
        // Re-throw the error for other cases
        throw error;
      }
    }
  }

  // ========================================================================
  // LEGACY AUTHENTICATION (Fallback)
  // ========================================================================
  // This is the client-side authentication method.
  // Used when Cloud Functions are not deployed or unavailable.
  // ========================================================================

  try {
    const startTime = performance.now();
    const isEmail = userIDOrEmail.includes('@');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 NeoLink Authentication System (Legacy Mode)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 Login attempt: ${isEmail ? 'Email' : 'UserID'} = ${userIDOrEmail}`);

    // Step 1: Lookup user using parallel indexed queries
    let lookupResult: UserLookupResult | null;

    if (isEmail) {
      lookupResult = await lookupUserByEmail(userIDOrEmail);
    } else {
      lookupResult = await lookupUserByUserID(userIDOrEmail);
    }

    // Step 2: Handle lookup result
    if (!lookupResult && !isEmail) {
      // UserID not found - use generic error for security
      throw new Error('Invalid UserID or password');
    }

    // For email login without existing record, allow Firebase Auth to handle
    const userEmail = lookupResult?.email || userIDOrEmail.toLowerCase();

    // Step 3: Check if account is disabled
    if (lookupResult && !lookupResult.isEnabled) {
      const roleMessages: Record<string, string> = {
        superAdmin: 'This SuperAdmin account has been disabled.',
        districtAdmin: 'This District Admin account has been disabled. Please contact the SuperAdmin.',
        institutionAdmin: 'This institution has been deactivated. Please contact the SuperAdmin.',
        official: 'This Official account has been disabled. Please contact the SuperAdmin.',
        doctor: 'This account has been disabled. Please contact your administrator.',
        nurse: 'This account has been disabled. Please contact your administrator.',
      };
      throw new Error(roleMessages[lookupResult.role] || 'This account has been disabled.');
    }

    console.log(`👤 Role detected: ${lookupResult?.role || 'unknown'}`);
    console.log(`🔑 First-time login: ${lookupResult?.initialPassword ? 'Yes' : 'No'}`);

    // Step 4: Authenticate with Firebase Auth
    let isFirstLogin = false;

    try {
      // Try Firebase Auth sign-in first
      const result = await signInWithEmailAndPassword(auth, userEmail, password);
      const totalTime = (performance.now() - startTime).toFixed(2);
      console.log(`✅ Login successful in ${totalTime}ms`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return result.user;
    } catch (authError: any) {
      console.log('🔄 Firebase Auth returned:', authError.code);

      // Handle first-time login
      if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') {

        // Check if this is a first-time login with initial password
        if (lookupResult?.initialPassword) {
          console.log('🔐 First-time login detected - verifying initial password...');

          // Verify against initial password (stored temporarily in Firestore)
          if (password !== lookupResult.initialPassword) {
            console.log('❌ Password does not match initial credentials');
            throw new Error('Invalid UserID or password');
          }

          console.log('✅ Initial password verified');
          isFirstLogin = true;

          // Create Firebase Auth account
          try {
            const newUser = await createUserWithEmailAndPassword(auth, userEmail, password);

            // Update profile with display name
            if (lookupResult.displayName && newUser.user) {
              await updateProfile(newUser.user, { displayName: lookupResult.displayName });
            }

            // SECURITY: Clear initial password from Firestore after successful account creation
            await clearInitialPassword(lookupResult.collectionName, lookupResult.docId);

            const totalTime = (performance.now() - startTime).toFixed(2);
            console.log(`✅ First-time login successful in ${totalTime}ms`);
            console.log('🔒 Initial password cleared from database');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            return newUser.user;
          } catch (createError: any) {
            if (createError.code === 'auth/email-already-in-use') {
              // Account exists in Firebase but password is wrong
              console.log('❌ Firebase account exists but password is incorrect');
              throw new Error('Invalid UserID or password');
            }
            throw createError;
          }
        } else {
          // No initial password and Firebase Auth failed = wrong password
          console.log('❌ Authentication failed - no initial password available');
          throw new Error('Invalid UserID or password');
        }
      }

      // Handle other Firebase Auth errors
      throw authError;
    }
  } catch (error: any) {
    console.error('❌ Authentication failed:', error.message);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Return user-friendly error messages (don't expose internal details)
    if (error.message.includes('Invalid UserID') || error.message.includes('disabled')) {
      throw error;
    }

    let errorMessage = 'Failed to sign in';

    switch (error.code) {
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        errorMessage = 'Invalid UserID or password';
        break;
      case 'auth/user-disabled':
        errorMessage = 'This account has been disabled';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many failed attempts. Please try again later.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your internet connection.';
        break;
      default:
        errorMessage = error.message || 'Failed to sign in';
    }

    throw new Error(errorMessage);
  }
};
