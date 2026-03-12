import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let testEnv: RulesTestEnvironment | null = null;

/**
 * Initialize the Firestore test environment
 *
 * This sets up an isolated Firestore emulator for testing security rules.
 * Must be called before running any security rules tests.
 *
 * @param projectId - Optional custom project ID (default: neolink-test-{timestamp})
 * @returns The test environment instance
 *
 * @example
 * beforeAll(async () => {
 *   await setupFirestoreTests();
 * });
 */
export async function setupFirestoreTests(projectId?: string): Promise<RulesTestEnvironment> {
  // Read the firestore.rules file from project root
  const rulesPath = resolve(process.cwd(), 'firestore.rules');
  let rules: string;

  try {
    rules = readFileSync(rulesPath, 'utf8');
  } catch (error) {
    throw new Error(
      `Could not read firestore.rules at ${rulesPath}. ` +
      `Make sure the file exists and you're running tests from the project root.`
    );
  }

  testEnv = await initializeTestEnvironment({
    projectId: projectId || `neolink-test-${Date.now()}`,
    firestore: {
      rules,
      host: 'localhost',
      port: 8080 // Default Firestore emulator port
    }
  });

  return testEnv;
}

/**
 * Clean up the Firestore test environment
 *
 * Call this after all tests are complete to properly close connections.
 *
 * @example
 * afterAll(async () => {
 *   await cleanupFirestoreTests();
 * });
 */
export async function cleanupFirestoreTests(): Promise<void> {
  if (testEnv) {
    await testEnv.cleanup();
    testEnv = null;
  }
}

/**
 * Clear all data in the Firestore emulator
 *
 * Call this between tests to ensure test isolation.
 *
 * @example
 * beforeEach(async () => {
 *   await clearFirestoreData();
 * });
 */
export async function clearFirestoreData(): Promise<void> {
  if (!testEnv) {
    throw new Error('Test environment not initialized. Call setupFirestoreTests first.');
  }
  await testEnv.clearFirestore();
}

/**
 * Get an authenticated Firestore context for testing
 *
 * @param userId - The user ID to authenticate as
 * @param customClaims - Custom claims to attach to the auth token
 * @returns A Firestore instance authenticated as the specified user
 *
 * @example
 * const doctorContext = getAuthenticatedContext('doctor-123', {
 *   role: 'Doctor',
 *   institutionId: 'hospital-a'
 * });
 * await doctorContext.firestore().collection('patients').add({...});
 */
export function getAuthenticatedContext(
  userId: string,
  customClaims: Record<string, any> = {}
) {
  if (!testEnv) {
    throw new Error('Test environment not initialized. Call setupFirestoreTests first.');
  }
  return testEnv.authenticatedContext(userId, customClaims);
}

/**
 * Get an unauthenticated Firestore context for testing
 *
 * Use this to verify that unauthenticated users are properly denied access.
 *
 * @returns A Firestore instance with no authentication
 *
 * @example
 * const unauthedContext = getUnauthenticatedContext();
 * await assertFails(unauthedContext.firestore().collection('patients').get());
 */
export function getUnauthenticatedContext() {
  if (!testEnv) {
    throw new Error('Test environment not initialized. Call setupFirestoreTests first.');
  }
  return testEnv.unauthenticatedContext();
}

/**
 * Get the test environment instance
 *
 * Useful for advanced test scenarios.
 */
export function getTestEnv(): RulesTestEnvironment | null {
  return testEnv;
}

// Re-export assertion utilities from Firebase testing library
export { assertFails, assertSucceeds };

// ============ PREDEFINED TEST CONTEXTS ============

/**
 * Predefined test contexts for common user roles
 *
 * These match the mockUsers in testUtils.tsx
 */
export const testContexts = {
  /**
   * Get a Doctor context for Hospital A
   */
  getDoctorHospitalA: () => getAuthenticatedContext('doctor-a-123', {
    role: 'Doctor',
    institutionId: 'hospital-a',
    email: 'doctor@hospital-a.com'
  }),

  /**
   * Get a Doctor context for Hospital B
   */
  getDoctorHospitalB: () => getAuthenticatedContext('doctor-b-456', {
    role: 'Doctor',
    institutionId: 'hospital-b',
    email: 'doctor@hospital-b.com'
  }),

  /**
   * Get a Nurse context for Hospital A
   */
  getNurseHospitalA: () => getAuthenticatedContext('nurse-a-111', {
    role: 'Nurse',
    institutionId: 'hospital-a',
    email: 'nurse@hospital-a.com'
  }),

  /**
   * Get an Admin context for Hospital A
   */
  getAdminHospitalA: () => getAuthenticatedContext('admin-a-789', {
    role: 'Admin',
    institutionId: 'hospital-a',
    email: 'admin@hospital-a.com'
  }),

  /**
   * Get a SuperAdmin context
   */
  getSuperAdmin: () => getAuthenticatedContext('super-admin-000', {
    role: 'SuperAdmin',
    email: 'super@neolink.com'
  }),

  /**
   * Get an Official (government) context
   */
  getOfficial: () => getAuthenticatedContext('official-111', {
    role: 'Official',
    email: 'official@health.gov',
    canViewAllInstitutions: true
  }),

  /**
   * Get a District Admin context
   */
  getDistrictAdmin: () => getAuthenticatedContext('district-admin-222', {
    role: 'DistrictAdmin',
    institutionId: 'district-guwahati',
    email: 'district@health.gov',
    assignedDistrict: 'Kamrup Metropolitan'
  })
};

// ============ SEED DATA UTILITIES ============

/**
 * Seed test data for security rules testing
 *
 * Uses SuperAdmin context to bypass security rules during seeding.
 *
 * @param data - Object containing collections and documents to seed
 *
 * @example
 * await seedTestData({
 *   patients: [
 *     { id: 'patient-1', name: 'Baby Test', institutionId: 'hospital-a' }
 *   ],
 *   users: [
 *     { id: 'user-1', email: 'test@test.com', role: 'Doctor' }
 *   ]
 * });
 */
export async function seedTestData(data: {
  [collection: string]: Array<{ id: string; [key: string]: any }>;
}): Promise<void> {
  if (!testEnv) {
    throw new Error('Test environment not initialized. Call setupFirestoreTests first.');
  }

  // Use SuperAdmin context to seed data (bypasses rules)
  const adminContext = testEnv.authenticatedContext('seed-admin', { role: 'SuperAdmin' });
  const db = adminContext.firestore();

  for (const [collectionName, documents] of Object.entries(data)) {
    for (const doc of documents) {
      const { id, ...docData } = doc;
      await db.collection(collectionName).doc(id).set(docData);
    }
  }
}

/**
 * Seed a single patient for testing
 */
export async function seedPatient(patient: {
  id: string;
  name: string;
  institutionId: string;
  [key: string]: any;
}): Promise<void> {
  await seedTestData({ patients: [patient] });
}

/**
 * Seed a single user for testing
 */
export async function seedUser(user: {
  id: string;
  email: string;
  role: string;
  institutionId?: string;
  [key: string]: any;
}): Promise<void> {
  await seedTestData({ users: [user] });
}

/**
 * Seed a referral for testing
 */
export async function seedReferral(referral: {
  id: string;
  fromInstitutionId: string;
  toInstitutionId: string;
  status: string;
  [key: string]: any;
}): Promise<void> {
  await seedTestData({ referrals: [referral] });
}

// ============ RULE TESTING HELPERS ============

/**
 * Test that a read operation succeeds
 */
export async function expectReadSucceeds(
  context: ReturnType<typeof getAuthenticatedContext>,
  collection: string,
  docId: string
): Promise<void> {
  await assertSucceeds(
    context.firestore().collection(collection).doc(docId).get()
  );
}

/**
 * Test that a read operation fails
 */
export async function expectReadFails(
  context: ReturnType<typeof getAuthenticatedContext>,
  collection: string,
  docId: string
): Promise<void> {
  await assertFails(
    context.firestore().collection(collection).doc(docId).get()
  );
}

/**
 * Test that a write operation succeeds
 */
export async function expectWriteSucceeds(
  context: ReturnType<typeof getAuthenticatedContext>,
  collection: string,
  docId: string,
  data: Record<string, any>
): Promise<void> {
  await assertSucceeds(
    context.firestore().collection(collection).doc(docId).set(data)
  );
}

/**
 * Test that a write operation fails
 */
export async function expectWriteFails(
  context: ReturnType<typeof getAuthenticatedContext>,
  collection: string,
  docId: string,
  data: Record<string, any>
): Promise<void> {
  await assertFails(
    context.firestore().collection(collection).doc(docId).set(data)
  );
}

/**
 * Test that an update operation fails
 */
export async function expectUpdateFails(
  context: ReturnType<typeof getAuthenticatedContext>,
  collection: string,
  docId: string,
  data: Record<string, any>
): Promise<void> {
  await assertFails(
    context.firestore().collection(collection).doc(docId).update(data)
  );
}

/**
 * Test that a delete operation fails
 */
export async function expectDeleteFails(
  context: ReturnType<typeof getAuthenticatedContext>,
  collection: string,
  docId: string
): Promise<void> {
  await assertFails(
    context.firestore().collection(collection).doc(docId).delete()
  );
}
