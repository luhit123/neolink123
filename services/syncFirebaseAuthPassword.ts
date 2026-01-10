/**
 * Firebase Auth Password Sync Service
 *
 * NOTE: This file contains functions that REQUIRE Firebase Admin SDK
 * These functions should be implemented as Cloud Functions in the future
 *
 * For now, we provide workarounds using client-side Firebase Auth
 */

import { signInWithEmailAndPassword, updatePassword, signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';

/**
 * Attempts to sync Firestore password to Firebase Auth
 *
 * LIMITATION: This only works if we know the CURRENT Firebase Auth password
 * If we don't know it, this will fail and we need Admin SDK (Cloud Function)
 *
 * @param email - User email
 * @param oldPassword - Current Firebase Auth password (if known)
 * @param newPassword - New password from Firestore
 */
export const attemptPasswordSync = async (
  email: string,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> => {
  try {
    // Try to sign in with old password
    const userCredential = await signInWithEmailAndPassword(auth, email, oldPassword);

    // If successful, update to new password
    if (userCredential.user) {
      await updatePassword(userCredential.user, newPassword);
      await signOut(auth); // Sign out after updating

      return {
        success: true,
        message: 'Password synced successfully'
      };
    }

    return {
      success: false,
      message: 'Failed to update password'
    };
  } catch (error: any) {
    console.error('Password sync failed:', error);

    return {
      success: false,
      message: `Password sync failed: ${error.message}`
    };
  }
};

/**
 * Instructions for SuperAdmin to manually fix password mismatch
 */
export const getPasswordMismatchInstructions = () => {
  return `
🔧 PASSWORD MISMATCH DETECTED

The Firebase Auth account exists but has a different password than Firestore.

SOLUTIONS:

1. RECOMMENDED: Delete the Firebase Auth user
   - Go to Firebase Console > Authentication
   - Find the user by email
   - Delete the user
   - The system will recreate it automatically on next login

2. User can use "Forgot Password" to reset
   - They submit a password reset request
   - You (SuperAdmin) approve it and set new password
   - System will sync the password

3. FUTURE: Implement Cloud Function
   - Set up Firebase Admin SDK in Cloud Functions
   - Automatically sync passwords when you create/update users
  `;
};
