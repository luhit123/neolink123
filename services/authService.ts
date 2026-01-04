import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../firebaseConfig';
import { saveUserProfile, getUserProfile } from './firestoreService';
import { UserRole } from '../types';
import { isPWAMode } from '../utils/pwaDetection';

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    // Use redirect flow for PWA mode, popup for browser
    if (isPWAMode()) {
      // In PWA mode, use redirect (this doesn't return immediately)
      await signInWithRedirect(auth, googleProvider);
      // The page will redirect and come back - result handled in handleRedirectResult
      return null;
    } else {
      // In browser mode, use popup
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    }
  } catch (error: any) {
    console.error('Error signing in with Google:', error);
    throw new Error(error.message || 'Failed to sign in with Google');
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
