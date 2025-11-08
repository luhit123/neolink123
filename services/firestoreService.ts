import {
  collection,
  doc,
  getDocs,
  getDoc,
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
  };
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
      patient.progressNotes = notesSnapshot.docs.map(noteDoc => ({
        note: noteDoc.data().note,
        date: timestampToISO(noteDoc.data().date),
      }));
      
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
          note: note.note,
          date: isoToTimestamp(note.date),
          addedBy: userId,
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
          note: note.note,
          date: isoToTimestamp(note.date),
          addedBy: userId,
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

// Create or update user profile
export const saveUserProfile = async (
  userId: string,
  email: string,
  displayName: string,
  role: UserRole,
  collegeName: string,
  collegeId: string
) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      email,
      displayName,
      role,
      collegeName,
      collegeId,
      lastLogin: serverTimestamp(),
    }).catch(async () => {
      // If document doesn't exist, create it
      await addDoc(collection(db, 'users'), {
        email,
        displayName,
        role,
        collegeName,
        collegeId,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      });
    });
  } catch (error) {
    console.error('Error saving user profile:', error);
    throw error;
  }
};
