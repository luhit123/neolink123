import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Institution, ApprovedUser, UserRole } from '../types';

// Check if user is SuperAdmin
export async function checkSuperAdmin(email: string, userId?: string): Promise<boolean> {
  try {
    // First check superAdmins collection
    const docRef = doc(db, 'superAdmins', email);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return true;
    
    // Also check user profile role
    if (userId) {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        return userData.role === 'Super Administrator';
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking super admin:', error);
    return false;
  }
}

// Check if user is Institution Admin
export async function checkInstitutionAdmin(email: string): Promise<string | null> {
  try {
    const institutionsRef = collection(db, 'institutions');
    const q = query(institutionsRef, where('adminEmail', '==', email), where('enabled', '==', true));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].id;
    }
    return null;
  } catch (error) {
    console.error('Error checking institution admin:', error);
    return null;
  }
}

// Check if user is approved
export async function checkApprovedUser(email: string): Promise<ApprovedUser | null> {
  try {
    const institutionsRef = collection(db, 'institutions');
    const institutionsSnap = await getDocs(institutionsRef);
    
    for (const institutionDoc of institutionsSnap.docs) {
      const approvedUserRef = doc(db, 'institutions', institutionDoc.id, 'approvedUsers', email);
      const approvedUserSnap = await getDoc(approvedUserRef);
      
      if (approvedUserSnap.exists()) {
        const data = approvedUserSnap.data();
        return {
          email,
          role: data.role as UserRole,
          institutionId: institutionDoc.id,
          institutionName: institutionDoc.data().name,
          approvedBy: data.approvedBy,
          approvedAt: data.approvedAt,
          enabled: data.enabled
        };
      }
    }
    return null;
  } catch (error) {
    console.error('Error checking approved user:', error);
    return null;
  }
}

// Get all institutions (SuperAdmin only)
export async function getAllInstitutions(): Promise<Institution[]> {
  try {
    const institutionsRef = collection(db, 'institutions');
    const querySnapshot = await getDocs(institutionsRef);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Institution));
  } catch (error) {
    console.error('Error getting institutions:', error);
    return [];
  }
}

// Add new institution (SuperAdmin only)
export async function addInstitution(
  name: string,
  district: string,
  state: string,
  adminEmail: string,
  createdBy: string
): Promise<string> {
  try {
    const institutionRef = doc(collection(db, 'institutions'));
    const institution: Institution = {
      id: institutionRef.id,
      name,
      location: { district, state },
      enabled: true,
      adminEmail,
      createdAt: new Date().toISOString(),
      createdBy
    };
    
    await setDoc(institutionRef, institution);
    return institutionRef.id;
  } catch (error) {
    console.error('Error adding institution:', error);
    throw error;
  }
}

// Update institution (SuperAdmin only)
export async function updateInstitution(
  institutionId: string,
  updates: Partial<Institution>
): Promise<void> {
  try {
    const institutionRef = doc(db, 'institutions', institutionId);
    await updateDoc(institutionRef, updates);
  } catch (error) {
    console.error('Error updating institution:', error);
    throw error;
  }
}

// Get approved users for an institution
export async function getApprovedUsers(institutionId: string): Promise<ApprovedUser[]> {
  try {
    const approvedUsersRef = collection(db, 'institutions', institutionId, 'approvedUsers');
    const querySnapshot = await getDocs(approvedUsersRef);
    
    const institutionDoc = await getDoc(doc(db, 'institutions', institutionId));
    const institutionName = institutionDoc.data()?.name || '';
    
    return querySnapshot.docs.map(doc => ({
      email: doc.id,
      institutionId,
      institutionName,
      ...doc.data()
    } as ApprovedUser));
  } catch (error) {
    console.error('Error getting approved users:', error);
    return [];
  }
}

// Add approved user (Institution Admin)
export async function addApprovedUser(
  institutionId: string,
  email: string,
  role: UserRole,
  approvedBy: string
): Promise<void> {
  try {
    const approvedUserRef = doc(db, 'institutions', institutionId, 'approvedUsers', email);
    await setDoc(approvedUserRef, {
      role,
      enabled: true,
      approvedBy,
      approvedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error adding approved user:', error);
    throw error;
  }
}

// Update approved user
export async function updateApprovedUser(
  institutionId: string,
  email: string,
  updates: Partial<ApprovedUser>
): Promise<void> {
  try {
    const approvedUserRef = doc(db, 'institutions', institutionId, 'approvedUsers', email);
    await updateDoc(approvedUserRef, updates);
  } catch (error) {
    console.error('Error updating approved user:', error);
    throw error;
  }
}

// Delete approved user
export async function deleteApprovedUser(
  institutionId: string,
  email: string
): Promise<void> {
  try {
    const approvedUserRef = doc(db, 'institutions', institutionId, 'approvedUsers', email);
    await deleteDoc(approvedUserRef);
  } catch (error) {
    console.error('Error deleting approved user:', error);
    throw error;
  }
}

// Get institution details
export async function getInstitution(institutionId: string): Promise<Institution | null> {
  try {
    const institutionRef = doc(db, 'institutions', institutionId);
    const institutionSnap = await getDoc(institutionRef);
    
    if (institutionSnap.exists()) {
      return {
        id: institutionSnap.id,
        ...institutionSnap.data()
      } as Institution;
    }
    return null;
  } catch (error) {
    console.error('Error getting institution:', error);
    return null;
  }
}

// Initialize demo institution if none exists (for first-time setup)
export async function initializeDemoInstitution(userEmail: string): Promise<void> {
  try {
    const institutionsRef = collection(db, 'institutions');
    const querySnapshot = await getDocs(institutionsRef);
    
    // If no institutions exist, create a demo one
    if (querySnapshot.empty) {
      console.log('No institutions found, creating demo institution...');
      await addInstitution(
        'Demo Medical College',
        'Demo District',
        'Demo State',
        'admin@demo.edu',
        userEmail
      );
      console.log('Demo institution created successfully');
    }
  } catch (error) {
    console.error('Error initializing demo institution:', error);
  }
}
