/**
 * Edit Tracking Service
 * Tracks all edits made to patient records for audit purposes
 */

import { collection, addDoc, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Patient, EditHistory } from '../types';

export interface PatientEditRecord {
  patientId: string;
  patientNtid?: string;
  patientName: string;
  institutionId: string;
  institutionName: string;
  editedBy: string;
  editedByEmail: string;
  editedByRole: string;
  editedAt: string;
  changes: PatientChange[];
  changesSummary: string;
  editType: 'create' | 'update' | 'status_change';
  previousOutcome?: string;
  newOutcome?: string;
}

export interface PatientChange {
  field: string;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
}

// Field labels for display
const FIELD_LABELS: Record<string, string> = {
  name: 'Patient Name',
  motherName: 'Mother Name',
  fatherName: 'Father Name',
  gender: 'Gender',
  dateOfBirth: 'Date of Birth',
  birthWeight: 'Birth Weight',
  age: 'Age',
  ageUnit: 'Age Unit',
  diagnosis: 'Diagnosis',
  outcome: 'Outcome',
  unit: 'Unit',
  admissionType: 'Admission Type',
  admissionDateTime: 'Admission Date/Time',
  dischargeDateTime: 'Discharge Date/Time',
  weightOnAdmission: 'Weight on Admission',
  weightOnDischarge: 'Weight on Discharge',
  doctorInCharge: 'Doctor In Charge',
  modeOfDelivery: 'Mode of Delivery',
  placeOfDelivery: 'Place of Delivery',
  placeOfDeliveryName: 'Place of Delivery Name',
  referringHospital: 'Referring Hospital',
  referringDistrict: 'Referring District',
  modeOfTransport: 'Mode of Transport',
  address: 'Address',
  village: 'Village',
  postOffice: 'Post Office',
  district: 'District',
  state: 'State',
  category: 'Category',
  contactNo1: 'Primary Contact',
  contactNo2: 'Secondary Contact',
  indicationsForAdmission: 'Indications for Admission',
  customIndication: 'Custom Indication',
  gestationalAgeWeeks: 'Gestational Age (Weeks)',
  gestationalAgeDays: 'Gestational Age (Days)',
  sncuRegNo: 'SNCU Registration No.',
  mctsNo: 'MCTS No.',
  diagnosisAtDeath: 'Diagnosis at Death',
  dateOfDeath: 'Date of Death',
  referralReason: 'Referral Reason',
  referredTo: 'Referred To',
};

// Fields to track for changes
const TRACKED_FIELDS = [
  'name', 'motherName', 'fatherName', 'gender', 'dateOfBirth', 'birthWeight',
  'age', 'ageUnit', 'diagnosis', 'outcome', 'unit', 'admissionType',
  'admissionDateTime', 'dischargeDateTime', 'weightOnAdmission', 'weightOnDischarge',
  'doctorInCharge', 'modeOfDelivery', 'placeOfDelivery', 'placeOfDeliveryName',
  'referringHospital', 'referringDistrict', 'modeOfTransport', 'address',
  'village', 'postOffice', 'district', 'state', 'category',
  'contactNo1', 'contactNo2', 'indicationsForAdmission', 'customIndication',
  'gestationalAgeWeeks', 'gestationalAgeDays', 'sncuRegNo', 'mctsNo',
  'diagnosisAtDeath', 'dateOfDeath', 'referralReason', 'referredTo'
];

/**
 * Compare two patient records and return the changes
 */
export function comparePatients(oldPatient: Partial<Patient> | null, newPatient: Patient): PatientChange[] {
  const changes: PatientChange[] = [];

  for (const field of TRACKED_FIELDS) {
    const oldValue = oldPatient ? (oldPatient as any)[field] : undefined;
    const newValue = (newPatient as any)[field];

    // Handle arrays (like indicationsForAdmission)
    if (Array.isArray(oldValue) || Array.isArray(newValue)) {
      const oldArr = Array.isArray(oldValue) ? oldValue : [];
      const newArr = Array.isArray(newValue) ? newValue : [];

      if (JSON.stringify(oldArr) !== JSON.stringify(newArr)) {
        changes.push({
          field,
          fieldLabel: FIELD_LABELS[field] || field,
          oldValue: oldArr.join(', ') || '(none)',
          newValue: newArr.join(', ') || '(none)'
        });
      }
    } else {
      // Handle regular values
      const oldStr = oldValue !== undefined && oldValue !== null && oldValue !== ''
        ? String(oldValue) : undefined;
      const newStr = newValue !== undefined && newValue !== null && newValue !== ''
        ? String(newValue) : undefined;

      if (oldStr !== newStr) {
        changes.push({
          field,
          fieldLabel: FIELD_LABELS[field] || field,
          oldValue: oldStr || '(empty)',
          newValue: newStr || '(empty)'
        });
      }
    }
  }

  return changes;
}

/**
 * Generate a summary of changes
 */
export function generateChangesSummary(changes: PatientChange[]): string {
  if (changes.length === 0) return 'No changes detected';
  if (changes.length === 1) {
    return `Updated ${changes[0].fieldLabel}`;
  }
  if (changes.length <= 3) {
    return `Updated ${changes.map(c => c.fieldLabel).join(', ')}`;
  }
  return `Updated ${changes.length} fields: ${changes.slice(0, 3).map(c => c.fieldLabel).join(', ')} and ${changes.length - 3} more`;
}

/**
 * Track an edit to a patient record
 */
export async function trackPatientEdit(
  oldPatient: Partial<Patient> | null,
  newPatient: Patient,
  editedBy: string,
  editedByEmail: string,
  editedByRole: string,
  institutionId: string,
  institutionName: string
): Promise<void> {
  try {
    const changes = comparePatients(oldPatient, newPatient);

    // Only track if there are actual changes or it's a new record
    if (changes.length === 0 && oldPatient) return;

    const editType = oldPatient ? 'update' : 'create';
    const isStatusChange = changes.some(c => c.field === 'outcome');

    const editRecord: PatientEditRecord = {
      patientId: newPatient.id,
      patientNtid: newPatient.ntid,
      patientName: newPatient.name,
      institutionId,
      institutionName,
      editedBy,
      editedByEmail,
      editedByRole,
      editedAt: new Date().toISOString(),
      changes,
      changesSummary: oldPatient ? generateChangesSummary(changes) : 'Patient record created',
      editType: isStatusChange ? 'status_change' : editType,
      ...(isStatusChange && {
        previousOutcome: oldPatient?.outcome,
        newOutcome: newPatient.outcome
      })
    };

    // Save to Firebase
    const editHistoryRef = collection(db, 'patientEditHistory');
    await addDoc(editHistoryRef, editRecord);

    console.log('📝 Edit tracked:', editRecord.changesSummary);
  } catch (error) {
    console.error('❌ Error tracking edit:', error);
    // Don't throw - edit tracking should not block saving
  }
}

/**
 * Get edit history for a patient
 */
export async function getPatientEditHistory(patientId: string): Promise<PatientEditRecord[]> {
  try {
    const editHistoryRef = collection(db, 'patientEditHistory');
    const q = query(
      editHistoryRef,
      where('patientId', '==', patientId),
      orderBy('editedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      ...doc.data() as PatientEditRecord
    }));
  } catch (error) {
    console.error('❌ Error fetching edit history:', error);
    return [];
  }
}

/**
 * Create EditHistory entry for patient record (inline tracking)
 */
export function createEditHistoryEntry(
  editedBy: string,
  editedByEmail: string,
  changes: string
): EditHistory {
  return {
    timestamp: new Date().toISOString(),
    editedBy,
    editedByEmail,
    changes
  };
}

/**
 * Add edit history entry to patient's editHistory array
 */
export function addEditHistoryToPatient(
  patient: Patient,
  editedBy: string,
  editedByEmail: string,
  oldPatient: Partial<Patient> | null
): Patient {
  const changes = comparePatients(oldPatient, patient);
  const summary = oldPatient ? generateChangesSummary(changes) : 'Patient record created';

  const newEntry = createEditHistoryEntry(editedBy, editedByEmail, summary);

  return {
    ...patient,
    editHistory: [...(patient.editHistory || []), newEntry],
    lastEditedAt: new Date().toISOString()
  };
}
