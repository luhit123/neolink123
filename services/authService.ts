import {
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, googleProvider, authReady, pendingRedirectResult } from '../firebaseConfig';
import { saveUserProfile, getUserProfile } from './firestoreService';
import { UserRole } from '../types';
import { isPWAMode, isMobileDevice } from '../utils/pwaDetection';

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
    await saveUserProfile(userId, email, displayName, role, collegeName, collegeId);
  } catch (error) {
    console.error('Error completing user setup:', error);
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

// Sign in with UserID/Email and Password (for all users: Institution Admins, Doctors, Nurses)
export const signInWithUserID = async (userIDOrEmail: string, password: string) => {
  try {
    // Import here to avoid circular dependency
    const { db } = await import('../firebaseConfig');
    const { collection, query, where, getDocs } = await import('firebase/firestore');

    let userEmail = '';
    const isEmail = userIDOrEmail.includes('@');

    console.log('🔄 Looking up:', isEmail ? 'Email' : 'UserID', userIDOrEmail);

    if (isEmail) {
      // Input is an email - query by email field directly
      console.log('🔍 Querying approved_users by email...');
      const usersRef = collection(db, 'approved_users');
      const userQuery = query(usersRef, where('email', '==', userIDOrEmail.toLowerCase()));
      let userSnapshot;
      try {
        userSnapshot = await getDocs(userQuery);
        console.log('✅ approved_users query successful, found:', userSnapshot.size, 'documents');
      } catch (usersError: any) {
        console.error('❌ Error querying approved_users:', usersError.code, usersError.message);
        throw usersError;
      }

      if (userSnapshot.empty) {
        throw new Error('Invalid email or password');
      }

      const user = userSnapshot.docs[0].data();
      userEmail = user.email;

      // Check if user is enabled
      if (user.enabled === false) {
        throw new Error('This account has been disabled. Please contact your administrator.');
      }
    } else {
      // Input is a UserID - query by userID field
      // First, try to find in institutions collection (for institution admins)
      console.log('🔍 Querying institutions collection...');
      const institutionsRef = collection(db, 'institutions');
      const instQuery = query(institutionsRef, where('userID', '==', userIDOrEmail));
      let instSnapshot;
      try {
        instSnapshot = await getDocs(instQuery);
        console.log('✅ Institutions query successful, found:', instSnapshot.size, 'documents');
      } catch (instError: any) {
        console.error('❌ Error querying institutions:', instError.code, instError.message);
        throw instError;
      }

      if (!instSnapshot.empty) {
        // Found in institutions - this is an institution admin
        const institution = instSnapshot.docs[0].data();
        userEmail = institution.adminEmail;
        console.log('✅ Found institution admin, email:', userEmail);
      } else {
        // Not found in institutions, try approved_users collection (for doctors, nurses, etc.)
        console.log('🔍 Querying approved_users by userID...');
        const usersRef = collection(db, 'approved_users');
        const userQuery = query(usersRef, where('userID', '==', userIDOrEmail));
        let userSnapshot;
        try {
          userSnapshot = await getDocs(userQuery);
          console.log('✅ approved_users query successful, found:', userSnapshot.size, 'documents');
        } catch (usersError: any) {
          console.error('❌ Error querying approved_users:', usersError.code, usersError.message);
          throw usersError;
        }

        if (userSnapshot.empty) {
          throw new Error('Invalid UserID or password');
        }

        // Found in approved_users
        const user = userSnapshot.docs[0].data();
        userEmail = user.email;

        // Check if user is enabled
        if (user.enabled === false) {
          throw new Error('This account has been disabled. Please contact your administrator.');
        }
      }
    }

    // Sign in with Firebase Auth (let Firebase handle password validation)
    try {
      const result = await signInWithEmailAndPassword(auth, userEmail, password);
      return result.user;
    } catch (authError: any) {
      // If Firebase Auth account doesn't exist, create it
      if (authError.code === 'auth/user-not-found') {
        console.log('Firebase Auth account not found, creating new account...');
        const newUser = await createUserWithEmailAndPassword(auth, userEmail, password);
        console.log('✅ Firebase Auth account created successfully');
        return newUser.user;
      }

      // For any other auth errors, throw them as-is
      throw authError;
    }
  } catch (error: any) {
    console.error('Error signing in with UserID:', error);

    // Don't expose specific errors for security
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
      default:
        errorMessage = error.message || 'Failed to sign in';
    }

    throw new Error(errorMessage);
  }
};
