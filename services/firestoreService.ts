import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Patient, UserRole } from '../types';

// Helper function to convert Firestore timestamp to ISO string
const timestampToISO = (timestamp: any): string => {
  if (!timestamp) return new Date().toISOString();
  if (timestamp.toDate) return timestamp.toDate().toISOString();
  return new Date(timestamp).toISOString();
};

// Helper function to convert ISO string to Firestore timestamp
const isoToTimestamp = (isoString?: string): Timestamp | null => {
  if (!isoString) return null;
  return Timestamp.fromDate(new Date(isoString));
};

// Helper function to extract year-month from ISO date string (for indexing)
const getYearMonth = (isoString?: string): string | null => {
  if (!isoString) return null;
  const date = new Date(isoString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

// Convert Patient object to Firestore format
export const patientToFirestore = (patient: Patient, userId: string, userRole: UserRole) => {
  return {
    id: patient.id,
    name: patient.name,
    age: patient.age,
    ageUnit: patient.ageUnit,
    gender: patient.gender,
    admissionDate: isoToTimestamp(patient.admissionDate),
    releaseDate: isoToTimestamp(patient.releaseDate),
    diagnosis: patient.diagnosis,
    outcome: patient.outcome,
    unit: patient.unit,

    // Indexed fields for efficient queries (Hybrid Architecture)
    admissionYearMonth: getYearMonth(patient.admissionDate),
    dischargeYearMonth: getYearMonth(patient.releaseDate),
    currentUnit: patient.currentUnit || patient.unit, // Current unit for step-downs
    supabaseId: patient.supabaseId || null, // Link to Supabase record

    // NICU specific
    nicuSpecific: {
      admissionType: patient.admissionType || null,
      referringHospital: patient.referringHospital || null,
      referringDistrict: patient.referringDistrict || null,
    },

    // Step Down Info
    stepDownInfo: {
      isStepDown: patient.isStepDown || false,
      stepDownDate: isoToTimestamp(patient.stepDownDate),
      stepDownFrom: patient.stepDownFrom || null,
      readmissionFromStepDown: patient.readmissionFromStepDown || false,
      readmissionDate: patient.readmissionFromStepDown ? serverTimestamp() : null,
      readmissionReason: patient.readmissionFromStepDown ? 'Condition deteriorated, required higher level care' : null,
      finalDischargeDate: isoToTimestamp(patient.finalDischargeDate),
    },

    // Referral Info
    referralInfo: {
      referredTo: patient.referredTo || null,
      referralReason: patient.referralReason || null,
      referralDate: patient.outcome === 'Referred' ? isoToTimestamp(patient.releaseDate) : null,
    },

    // Metadata
    metadata: {
      isDraft: patient.isDraft || false,
      createdBy: userId,
      createdByRole: userRole,
      createdAt: serverTimestamp(),
      lastUpdatedBy: userId,
      lastUpdatedByRole: userRole,
      lastUpdatedAt: serverTimestamp(),
    },

    // Progress notes stored separately in subcollection
  };
};

// Convert Firestore document to Patient object
export const firestoreToPatient = (docData: any): Patient => {
  return {
    id: docData.id,
    name: docData.name,
    age: docData.age,
    ageUnit: docData.ageUnit,
    gender: docData.gender,
    admissionDate: timestampToISO(docData.admissionDate),
    releaseDate: timestampToISO(docData.releaseDate),
    diagnosis: docData.diagnosis,
    progressNotes: [], // Loaded separately from subcollection
    outcome: docData.outcome,
    unit: docData.unit,

    // Indexed fields (Hybrid Architecture)
    admissionYearMonth: docData.admissionYearMonth || null,
    dischargeYearMonth: docData.dischargeYearMonth || null,
    currentUnit: docData.currentUnit || docData.unit,
    supabaseId: docData.supabaseId || null,

    // NICU specific
    admissionType: docData.nicuSpecific?.admissionType,
    referringHospital: docData.nicuSpecific?.referringHospital,
    referringDistrict: docData.nicuSpecific?.referringDistrict,

    // Step Down
    isStepDown: docData.stepDownInfo?.isStepDown || false,
    stepDownDate: timestampToISO(docData.stepDownInfo?.stepDownDate),
    stepDownFrom: docData.stepDownInfo?.stepDownFrom,
    readmissionFromStepDown: docData.stepDownInfo?.readmissionFromStepDown || false,
    finalDischargeDate: timestampToISO(docData.stepDownInfo?.finalDischargeDate),

    // Referral
    referredTo: docData.referralInfo?.referredTo,
    referralReason: docData.referralInfo?.referralReason,

    // Metadata
    isDraft: docData.metadata?.isDraft || false,
    createdBy: docData.metadata?.createdByRole,
    lastUpdatedBy: docData.metadata?.lastUpdatedByRole,
  } as Patient;
};

// Get all patients for a college
export const getPatients = async (collegeId: string): Promise<Patient[]> => {
  try {
    const patientsRef = collection(db, 'colleges', collegeId, 'patients');
    const q = query(patientsRef, orderBy('admissionDate', 'desc'));
    const snapshot = await getDocs(q);

    const patients: Patient[] = [];
    for (const docSnap of snapshot.docs) {
      const patient = firestoreToPatient(docSnap.data());

      // Load progress notes
      const notesRef = collection(db, 'colleges', collegeId, 'patients', docSnap.id, 'progressNotes');
      const notesSnapshot = await getDocs(query(notesRef, orderBy('date', 'asc')));
      patient.progressNotes = notesSnapshot.docs.map(noteDoc => {
        const data = noteDoc.data();
        return {
          date: timestampToISO(data.date),
          note: data.note,
          vitals: data.vitals,
          examination: data.examination,
          medications: data.medications,
          addedBy: data.addedBy,
          addedByEmail: data.addedByEmail,
        };
      });

      patients.push(patient);
    }

    return patients;
  } catch (error) {
    console.error('Error getting patients:', error);
    throw error;
  }
};

// Add a new patient
export const addPatient = async (
  collegeId: string,
  patient: Patient,
  userId: string,
  userRole: UserRole
): Promise<string> => {
  try {
    const patientsRef = collection(db, 'colleges', collegeId, 'patients');
    const patientData = patientToFirestore(patient, userId, userRole);

    const docRef = await addDoc(patientsRef, patientData);

    // Add progress notes as subcollection
    if (patient.progressNotes && patient.progressNotes.length > 0) {
      const batch = writeBatch(db);
      const notesRef = collection(db, 'colleges', collegeId, 'patients', docRef.id, 'progressNotes');

      patient.progressNotes.forEach((note) => {
        const noteRef = doc(notesRef);
        batch.set(noteRef, {
          date: isoToTimestamp(note.date),
          note: note.note,
          vitals: note.vitals,
          examination: note.examination,
          medications: note.medications,
          addedBy: note.addedBy || userId,
          addedByEmail: note.addedByEmail,
          addedByRole: userRole,
        });
      });

      await batch.commit();
    }

    return docRef.id;
  } catch (error) {
    console.error('Error adding patient:', error);
    throw error;
  }
};

// Update a patient
export const updatePatient = async (
  collegeId: string,
  patientId: string,
  patient: Patient,
  userId: string,
  userRole: UserRole
): Promise<void> => {
  try {
    const patientRef = doc(db, 'colleges', collegeId, 'patients', patientId);
    const patientData = patientToFirestore(patient, userId, userRole);

    // Update main patient document
    await updateDoc(patientRef, {
      ...patientData,
      'metadata.lastUpdatedBy': userId,
      'metadata.lastUpdatedByRole': userRole,
      'metadata.lastUpdatedAt': serverTimestamp(),
    });

    // Update progress notes
    const notesRef = collection(db, 'colleges', collegeId, 'patients', patientId, 'progressNotes');
    const existingNotes = await getDocs(notesRef);

    // Delete existing notes
    const batch = writeBatch(db);
    existingNotes.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Add new notes
    if (patient.progressNotes && patient.progressNotes.length > 0) {
      patient.progressNotes.forEach((note) => {
        const noteRef = doc(notesRef);
        batch.set(noteRef, {
          date: isoToTimestamp(note.date),
          note: note.note,
          vitals: note.vitals,
          examination: note.examination,
          medications: note.medications,
          addedBy: note.addedBy || userId,
          addedByEmail: note.addedByEmail,
          addedByRole: userRole,
        });
      });
    }

    await batch.commit();
  } catch (error) {
    console.error('Error updating patient:', error);
    throw error;
  }
};

// Delete a patient
export const deletePatient = async (collegeId: string, patientId: string): Promise<void> => {
  try {
    // Delete progress notes first
    const notesRef = collection(db, 'colleges', collegeId, 'patients', patientId, 'progressNotes');
    const notesSnapshot = await getDocs(notesRef);

    const batch = writeBatch(db);
    notesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Delete patient document
    const patientRef = doc(db, 'colleges', collegeId, 'patients', patientId);
    batch.delete(patientRef);

    await batch.commit();
  } catch (error) {
    console.error('Error deleting patient:', error);
    throw error;
  }
};

// Delete multiple patients (for admin bulk delete)
export const deleteMultiplePatients = async (collegeId: string, patientIds: string[]): Promise<{ success: number; failed: number }> => {
  let success = 0;
  let failed = 0;

  // Process in batches of 10 to avoid overwhelming Firestore
  const batchSize = 10;
  for (let i = 0; i < patientIds.length; i += batchSize) {
    const batchIds = patientIds.slice(i, i + batchSize);

    await Promise.all(
      batchIds.map(async (patientId) => {
        try {
          await deletePatient(collegeId, patientId);
          success++;
        } catch (error) {
          console.error(`Error deleting patient ${patientId}:`, error);
          failed++;
        }
      })
    );
  }

  return { success, failed };
};

// Get or create user profile
export const getUserProfile = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data();
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
};

// Save user profile
export async function saveUserProfile(userId: string, profile: {
  email: string;
  displayName: string;
  role: UserRole;
  collegeName?: string;
  collegeId?: string;
}) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      await updateDoc(userRef, {
        ...profile,
        lastLogin: serverTimestamp()
      });
    } else {
      // Create new user profile if doesn't exist
      await setDoc(userRef, {
        ...profile,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error saving user profile:', error);
    throw error;
  }
}

/**
 * Update user consent for DPDP compliance
 * @param userId - Firebase Auth UID
 * @param consentData - Consent details
 */
export async function updateUserConsent(userId: string, consentData: {
  consentAccepted: boolean;
  consentTimestamp: string;
  consentVersion: string;
  legitimateUseClauseAccepted?: boolean;
  aiConsentAccepted?: boolean;
  aiConsentTimestamp?: string;
}) {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      ...consentData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log('✅ User consent recorded in Firestore');
  } catch (error) {
    console.error('Error updating user consent:', error);
    throw error;
  }
}


// Update user role
export async function updateUserRole(userId: string, role: UserRole) {
  try {
    const userRef = doc(db, 'users', userId);
    // Use setDoc with merge to create or update
    await setDoc(userRef, {
      role: role,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
}

// ==================== DOCTORS MANAGEMENT ====================

/**
 * Get list of doctors for an institution
 * @param institutionId - The institution ID
 * @returns Array of doctor names
 */
export async function getDoctors(institutionId: string): Promise<string[]> {
  try {
    const institutionRef = doc(db, 'institutions', institutionId);
    const institutionDoc = await getDoc(institutionRef);

    if (institutionDoc.exists()) {
      const data = institutionDoc.data();
      if (data.doctors && Array.isArray(data.doctors)) {
        return data.doctors;
      }
    }
    return [];
  } catch (error) {
    console.error('Error fetching doctors:', error);
    return [];
  }
}

/**
 * Add a new doctor to an institution
 * @param institutionId - The institution ID
 * @param doctorName - The doctor's name
 */
export async function addDoctor(institutionId: string, doctorName: string): Promise<void> {
  try {
    const institutionRef = doc(db, 'institutions', institutionId);
    const institutionDoc = await getDoc(institutionRef);

    if (institutionDoc.exists()) {
      const data = institutionDoc.data();
      const currentDoctors = data.doctors || [];

      // Check for duplicates
      if (currentDoctors.some((d: string) => d.toLowerCase() === doctorName.toLowerCase())) {
        throw new Error('Doctor already exists');
      }

      await updateDoc(institutionRef, {
        doctors: [...currentDoctors, doctorName]
      });
    }
  } catch (error) {
    console.error('Error adding doctor:', error);
    throw error;
  }
}

/**
 * Remove a doctor from an institution
 * @param institutionId - The institution ID
 * @param doctorName - The doctor's name to remove
 */
export async function removeDoctor(institutionId: string, doctorName: string): Promise<void> {
  try {
    const institutionRef = doc(db, 'institutions', institutionId);
    const institutionDoc = await getDoc(institutionRef);

    if (institutionDoc.exists()) {
      const data = institutionDoc.data();
      const currentDoctors = data.doctors || [];
      const updatedDoctors = currentDoctors.filter((d: string) => d !== doctorName);

      await updateDoc(institutionRef, {
        doctors: updatedDoctors
      });
    }
  } catch (error) {
    console.error('Error removing doctor:', error);
    throw error;
  }
}

/**
 * Update a doctor's name in an institution
 * @param institutionId - The institution ID
 * @param oldName - The current doctor's name
 * @param newName - The new doctor's name
 */
export async function updateDoctor(institutionId: string, oldName: string, newName: string): Promise<void> {
  try {
    const institutionRef = doc(db, 'institutions', institutionId);
    const institutionDoc = await getDoc(institutionRef);

    if (institutionDoc.exists()) {
      const data = institutionDoc.data();
      const currentDoctors = data.doctors || [];

      // Check for duplicates (excluding old name)
      if (currentDoctors.some((d: string) => d !== oldName && d.toLowerCase() === newName.toLowerCase())) {
        throw new Error('Doctor with this name already exists');
      }

      const updatedDoctors = currentDoctors.map((d: string) => d === oldName ? newName : d);

      await updateDoc(institutionRef, {
        doctors: updatedDoctors
      });
    }
  } catch (error) {
    console.error('Error updating doctor:', error);
    throw error;
  }
}
