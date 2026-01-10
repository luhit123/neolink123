/**
 * Password Reset Service
 * Handles password reset requests for institution admins
 */

import { collection, addDoc, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { PasswordResetRequest } from '../types';

/**
 * Submit a password reset request
 * @param userID - User's UserID
 * @param userEmail - User's email address
 */
export const submitPasswordResetRequest = async (
  userID: string,
  userEmail: string
): Promise<void> => {
  try {
    let institutionId = '';
    let institutionName = '';
    let userName = '';
    let userRole = null;
    let foundEmail = '';

    // First, try to find in institutions collection (for institution admins)
    const institutionsRef = collection(db, 'institutions');
    const instQuery = query(institutionsRef, where('userID', '==', userID));
    const instSnapshot = await getDocs(instQuery);

    if (!instSnapshot.empty) {
      // Found in institutions - this is an institution admin
      const institutionDoc = instSnapshot.docs[0];
      const institution = institutionDoc.data();

      institutionId = institutionDoc.id;
      institutionName = institution.name;
      foundEmail = institution.adminEmail;
      userName = `${institution.name} Admin`;
      userRole = 'Admin' as any;
    } else {
      // Not found in institutions, try approved_users collection
      const usersRef = collection(db, 'approved_users');
      const userQuery = query(usersRef, where('userID', '==', userID));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        throw new Error('User not found with this UserID');
      }

      // Found in approved_users
      const user = userSnapshot.docs[0].data();
      institutionId = user.institutionId;
      institutionName = user.institutionName;
      foundEmail = user.email;
      userName = user.displayName;
      userRole = user.role;
    }

    // Verify the email matches
    if (foundEmail.toLowerCase() !== userEmail.toLowerCase()) {
      throw new Error('Email does not match user records');
    }

    // Check if there's already a pending request
    const requestsRef = collection(db, 'passwordResetRequests');
    const existingQ = query(
      requestsRef,
      where('userID', '==', userID),
      where('status', '==', 'pending')
    );
    const existingSnapshot = await getDocs(existingQ);

    if (!existingSnapshot.empty) {
      throw new Error('A password reset request is already pending for this account');
    }

    // Create the password reset request
    const resetRequest: Omit<PasswordResetRequest, 'id'> = {
      institutionId,
      institutionName,
      userID,
      userEmail: foundEmail,
      userName,
      userRole,
      requestedAt: new Date().toISOString(),
      requestedBy: foundEmail,
      status: 'pending',
    };

    await addDoc(requestsRef, resetRequest);
    console.log('✅ Password reset request submitted');
  } catch (error: any) {
    console.error('❌ Error submitting password reset request:', error);
    throw error;
  }
};

/**
 * Get all password reset requests (for SuperAdmin)
 */
export const getPasswordResetRequests = async (): Promise<PasswordResetRequest[]> => {
  try {
    const requestsRef = collection(db, 'passwordResetRequests');
    const snapshot = await getDocs(requestsRef);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as PasswordResetRequest));
  } catch (error: any) {
    console.error('❌ Error fetching password reset requests:', error);
    throw error;
  }
};

/**
 * Approve password reset request and set new password (SuperAdmin only)
 */
export const approvePasswordResetRequest = async (
  requestId: string,
  newPassword: string,
  superAdminEmail: string
): Promise<void> => {
  try {
    // Get the reset request
    const requestRef = doc(db, 'passwordResetRequests', requestId);
    const requestSnapshot = await getDocs(
      query(collection(db, 'passwordResetRequests'), where('__name__', '==', requestId))
    );

    if (requestSnapshot.empty) {
      throw new Error('Password reset request not found');
    }

    const request = { id: requestSnapshot.docs[0].id, ...requestSnapshot.docs[0].data() } as PasswordResetRequest;

    // Determine if this is an institution admin or individual user
    // Try to find in institutions first
    const institutionsRef = collection(db, 'institutions');
    const instQuery = query(institutionsRef, where('userID', '==', request.userID));
    const instSnapshot = await getDocs(instQuery);

    if (!instSnapshot.empty) {
      // This is an institution admin - update institution password
      const institutionRef = doc(db, 'institutions', instSnapshot.docs[0].id);
      await updateDoc(institutionRef, {
        password: newPassword
      });
    } else {
      // This is an individual user (doctor/nurse) - update approved_users password
      const usersRef = collection(db, 'approved_users');
      const userQuery = query(usersRef, where('userID', '==', request.userID));
      const userSnapshot = await getDocs(userQuery);

      if (!userSnapshot.empty) {
        const userRef = doc(db, 'approved_users', userSnapshot.docs[0].id);
        await updateDoc(userRef, {
          password: newPassword
        });
      } else {
        throw new Error('User not found for password update');
      }
    }

    // Update Firebase Auth password
    // Note: This would require Firebase Admin SDK in a Cloud Function
    // For now, we'll update Firestore only

    // Update the reset request status
    await updateDoc(requestRef, {
      status: 'approved',
      newPassword, // Store for reference
      approvedAt: new Date().toISOString(),
      approvedBy: superAdminEmail
    });

    console.log('✅ Password reset request approved');
  } catch (error: any) {
    console.error('❌ Error approving password reset request:', error);
    throw error;
  }
};

/**
 * Reject password reset request (SuperAdmin only)
 */
export const rejectPasswordResetRequest = async (
  requestId: string,
  superAdminEmail: string
): Promise<void> => {
  try {
    const requestRef = doc(db, 'passwordResetRequests', requestId);
    await updateDoc(requestRef, {
      status: 'rejected',
      approvedAt: new Date().toISOString(),
      approvedBy: superAdminEmail
    });

    console.log('✅ Password reset request rejected');
  } catch (error: any) {
    console.error('❌ Error rejecting password reset request:', error);
    throw error;
  }
};

/**
 * Delete password reset request (cleanup)
 */
export const deletePasswordResetRequest = async (requestId: string): Promise<void> => {
  try {
    const requestRef = doc(db, 'passwordResetRequests', requestId);
    await deleteDoc(requestRef);
    console.log('✅ Password reset request deleted');
  } catch (error: any) {
    console.error('❌ Error deleting password reset request:', error);
    throw error;
  }
};
