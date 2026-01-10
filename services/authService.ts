import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, googleProvider } from '../firebaseConfig';
import { saveUserProfile, getUserProfile } from './firestoreService';
import { UserRole } from '../types';
import { isPWAMode, isMobileDevice } from '../utils/pwaDetection';

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    // Use redirect flow for mobile devices and PWA mode
    // Popup doesn't work reliably on mobile browsers
    if (isPWAMode() || isMobileDevice()) {
      console.log('🔄 Using redirect flow for mobile/PWA');
      // In mobile/PWA mode, use redirect (this doesn't return immediately)
      await signInWithRedirect(auth, googleProvider);
      // The page will redirect and come back - result handled in handleRedirectResult
      return null;
    } else {
      console.log('🔄 Using popup flow for desktop');
      // In desktop browser mode, use popup
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    }
  } catch (error: any) {
    console.error('❌ Error signing in with Google:', error);

    // Handle specific error cases
    let errorMessage = 'Failed to sign in with Google';

    if (error.code === 'auth/popup-closed-by-user') {
      errorMessage = 'Sign-in was cancelled. Please try again.';
    } else if (error.code === 'auth/popup-blocked') {
      errorMessage = 'Pop-up was blocked by your browser. Please allow pop-ups and try again.';
    } else if (error.code === 'auth/cancelled-popup-request') {
      errorMessage = 'Sign-in cancelled. Please try again.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Network error. Please check your internet connection.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
};

// Handle redirect result (call this on app load)
export const handleRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      // User successfully signed in via redirect
      return result.user;
    }
    return null;
  } catch (error: any) {
    console.error('Error handling redirect result:', error);
    throw new Error(error.message || 'Failed to complete sign in');
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
    console.log('✅ Password reset email sent to:', email);
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
    console.log('✅ Password reset email sent to:', userEmail);

    return userEmail; // Return email for confirmation message
  } catch (error: any) {
    console.error('Error sending password reset by UserID:', error);
    throw error;
  }
};

// Sign in with UserID and Password (for all users: Institution Admins, Doctors, Nurses)
export const signInWithUserID = async (userID: string, password: string) => {
  try {
    // Import here to avoid circular dependency
    const { db } = await import('../firebaseConfig');
    const { collection, query, where, getDocs } = await import('firebase/firestore');

    let userEmail = '';

    // First, try to find in institutions collection (for institution admins)
    const institutionsRef = collection(db, 'institutions');
    const instQuery = query(institutionsRef, where('userID', '==', userID));
    const instSnapshot = await getDocs(instQuery);

    if (!instSnapshot.empty) {
      // Found in institutions - this is an institution admin
      const institution = instSnapshot.docs[0].data();
      userEmail = institution.adminEmail;
    } else {
      // Not found in institutions, try approved_users collection (for doctors, nurses, etc.)
      const usersRef = collection(db, 'approved_users');
      const userQuery = query(usersRef, where('userID', '==', userID));
      const userSnapshot = await getDocs(userQuery);

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
