/**
 * ============================================================================
 * SCALABLE USER LOOKUP SYSTEM
 * ============================================================================
 *
 * This module provides O(1) user lookup using a unified lookup table.
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                    UNIFIED USER LOOKUP TABLE                            │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │                                                                         │
 * │  Collection: userLookup                                                 │
 * │  Document ID: email (lowercase) or userID                               │
 * │                                                                         │
 * │  {                                                                      │
 * │    "identifier": "user@example.com",     // email or userID             │
 * │    "type": "email",                      // "email" or "userID"         │
 * │    "targetCollection": "officials",      // where actual data lives     │
 * │    "targetDocId": "abc123",              // document ID in collection   │
 * │    "role": "Official",                   // cached role for quick access│
 * │    "enabled": true,                      // cached enabled status       │
 * │    "createdAt": "2024-01-01T00:00:00Z",                                 │
 * │    "updatedAt": "2024-01-01T00:00:00Z"                                  │
 * │  }                                                                      │
 * │                                                                         │
 * │  SINGLE QUERY = O(1) LOOKUP! ✅                                         │
 * │                                                                         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ============================================================================
 */

import * as functions from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';

// CRITICAL: Use the named database "neolink" - NOT the default database
const db = getFirestore('neolink');

// ============================================================================
// REGION CONFIGURATION - MUST MATCH CLIENT (firebaseConfig.ts)
// ============================================================================
const FUNCTION_REGION = 'asia-southeast1'; // Singapore - matches database region

// ============================================================================
// TYPES
// ============================================================================

export interface UserLookupEntry {
  identifier: string;          // email (lowercase) or userID
  type: 'email' | 'userID';    // identifier type
  targetCollection: string;    // collection where user data lives
  targetDocId: string;         // document ID in target collection
  role: string;                // cached role
  enabled: boolean;            // cached enabled status
  email: string;               // always store email for reference
  displayName?: string;        // cached display name
  institutionId?: string;      // cached institution ID
  passwordHash?: string;       // password hash (only in lookup, not exposed)
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// LOOKUP FUNCTIONS
// ============================================================================

/**
 * Fast O(1) user lookup by email or userID
 */
export const lookupUser = async (identifier: string): Promise<UserLookupEntry | null> => {
  const normalizedId = identifier.toLowerCase().trim();

  // Single query - O(1) lookup
  const lookupDoc = await db.collection('userLookup').doc(normalizedId).get();

  if (!lookupDoc.exists) {
    return null;
  }

  return lookupDoc.data() as UserLookupEntry;
};

/**
 * Create or update user lookup entry
 */
export const upsertUserLookup = async (
  email: string,
  userID: string | undefined,
  targetCollection: string,
  targetDocId: string,
  role: string,
  enabled: boolean,
  displayName?: string,
  institutionId?: string,
  passwordHash?: string
): Promise<void> => {
  const now = new Date().toISOString();
  const normalizedEmail = email.toLowerCase().trim();

  // Create email-based lookup entry (only include defined values to avoid Firestore errors)
  const emailEntry: Partial<UserLookupEntry> = {
    identifier: normalizedEmail,
    type: 'email',
    targetCollection,
    targetDocId,
    role,
    enabled,
    email: normalizedEmail,
    createdAt: now,
    updatedAt: now,
  };

  // Only add optional fields if they have values
  if (displayName) emailEntry.displayName = displayName;
  if (institutionId) emailEntry.institutionId = institutionId;
  if (passwordHash) emailEntry.passwordHash = passwordHash;

  await db.collection('userLookup').doc(normalizedEmail).set(emailEntry, { merge: true });

  // Also create userID-based lookup entry if userID exists
  if (userID) {
    const userIdEntry: Partial<UserLookupEntry> = {
      identifier: userID.toUpperCase().trim(),
      type: 'userID',
      targetCollection,
      targetDocId,
      role,
      enabled,
      email: normalizedEmail,
      createdAt: now,
      updatedAt: now,
    };

    // Only add optional fields if they have values
    if (displayName) userIdEntry.displayName = displayName;
    if (institutionId) userIdEntry.institutionId = institutionId;
    if (passwordHash) userIdEntry.passwordHash = passwordHash;

    await db.collection('userLookup').doc(userID.toUpperCase().trim()).set(userIdEntry, { merge: true });
  }
};

/**
 * Delete user lookup entries
 */
export const deleteUserLookup = async (email: string, userID?: string): Promise<void> => {
  const normalizedEmail = email.toLowerCase().trim();

  // Delete email entry
  await db.collection('userLookup').doc(normalizedEmail).delete();

  // Delete userID entry if exists
  if (userID) {
    await db.collection('userLookup').doc(userID.toUpperCase().trim()).delete();
  }
};

/**
 * Update enabled status in lookup
 */
export const updateLookupStatus = async (email: string, userID: string | undefined, enabled: boolean): Promise<void> => {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date().toISOString();

  await db.collection('userLookup').doc(normalizedEmail).update({
    enabled,
    updatedAt: now,
  });

  if (userID) {
    await db.collection('userLookup').doc(userID.toUpperCase().trim()).update({
      enabled,
      updatedAt: now,
    });
  }
};

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Migrate all existing users to the lookup table
 * This should be run once to populate the lookup table
 */
export const migrateAllUsersToLookup = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
  // Only SuperAdmin can run migration
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const callerToken = context.auth.token;
  if (callerToken.role !== 'SuperAdmin') {
    throw new functions.https.HttpsError('permission-denied', 'Only SuperAdmin can run migration');
  }

  const collections = [
    { name: 'superAdmins', emailField: 'email', userIdField: null, role: 'SuperAdmin' },
    { name: 'districtAdmins', emailField: 'email', userIdField: 'userID', role: 'DistrictAdmin' },
    { name: 'institutions', emailField: 'adminEmail', userIdField: 'userID', role: 'Admin' },
    { name: 'officials', emailField: 'email', userIdField: 'userID', role: 'Official' },
    { name: 'approved_users', emailField: 'email', userIdField: 'userID', role: null }, // role from doc
  ];

  let migratedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (const col of collections) {
    try {
      const snapshot = await db.collection(col.name).get();

      for (const doc of snapshot.docs) {
        try {
          const data = doc.data();
          const email = data[col.emailField];
          const userID = col.userIdField ? data[col.userIdField] : undefined;
          const role = col.role || data.role || 'Unknown';
          const enabled = col.name === 'institutions' ? data.isActive !== false : data.enabled !== false;
          const displayName = data.displayName || data.adminName || data.name;
          const institutionId = col.name === 'institutions' ? doc.id : data.institutionId;
          const passwordHash = data.passwordHash;

          if (!email) {
            console.warn(`Skipping ${col.name}/${doc.id} - no email`);
            continue;
          }

          await upsertUserLookup(
            email,
            userID,
            col.name,
            doc.id,
            role,
            enabled,
            displayName,
            institutionId,
            passwordHash
          );

          migratedCount++;
        } catch (docError: any) {
          errorCount++;
          errors.push(`${col.name}/${doc.id}: ${docError.message}`);
        }
      }
    } catch (colError: any) {
      errorCount++;
      errors.push(`Collection ${col.name}: ${colError.message}`);
    }
  }

  console.log(`Migration complete: ${migratedCount} migrated, ${errorCount} errors`);

  return {
    success: errorCount === 0,
    migratedCount,
    errorCount,
    errors: errors.slice(0, 10), // Return first 10 errors
  };
});

/**
 * Sync a single user to the lookup table
 * Called via Firestore trigger or manually
 */
export const syncUserToLookup = async (
  collection: string,
  docId: string,
  data: any,
  deleted: boolean = false
): Promise<void> => {
  const collectionConfig: Record<string, { emailField: string; userIdField: string | null; role: string | null }> = {
    superAdmins: { emailField: 'email', userIdField: null, role: 'SuperAdmin' },
    districtAdmins: { emailField: 'email', userIdField: 'userID', role: 'DistrictAdmin' },
    institutions: { emailField: 'adminEmail', userIdField: 'userID', role: 'Admin' },
    officials: { emailField: 'email', userIdField: 'userID', role: 'Official' },
    approved_users: { emailField: 'email', userIdField: 'userID', role: null },
  };

  const config = collectionConfig[collection];
  if (!config) return;

  const email = data[config.emailField];
  const userID = config.userIdField ? data[config.userIdField] : undefined;

  if (!email) return;

  if (deleted) {
    await deleteUserLookup(email, userID);
  } else {
    const role = config.role || data.role || 'Unknown';
    const enabled = collection === 'institutions' ? data.isActive !== false : data.enabled !== false;
    const displayName = data.displayName || data.adminName || data.name;
    const institutionId = collection === 'institutions' ? docId : data.institutionId;
    const passwordHash = data.passwordHash;

    await upsertUserLookup(
      email,
      userID,
      collection,
      docId,
      role,
      enabled,
      displayName,
      institutionId,
      passwordHash
    );
  }
};

// ============================================================================
// FIRESTORE TRIGGERS - Auto-sync lookup table
// ============================================================================

// Trigger for officials collection
export const onOfficialWrite = functions.firestore
  .document('officials/{docId}')
  .onWrite(async (change, context) => {
    const docId = context.params.docId;

    if (!change.after.exists) {
      // Document deleted
      const oldData = change.before.data()!;
      await syncUserToLookup('officials', docId, oldData, true);
    } else {
      // Document created or updated
      const newData = change.after.data()!;
      await syncUserToLookup('officials', docId, newData, false);
    }
  });

// Trigger for approved_users collection
export const onApprovedUserWrite = functions.firestore
  .document('approved_users/{docId}')
  .onWrite(async (change, context) => {
    const docId = context.params.docId;

    if (!change.after.exists) {
      const oldData = change.before.data()!;
      await syncUserToLookup('approved_users', docId, oldData, true);
    } else {
      const newData = change.after.data()!;
      await syncUserToLookup('approved_users', docId, newData, false);
    }
  });

// Trigger for institutions collection
export const onInstitutionWrite = functions.firestore
  .document('institutions/{docId}')
  .onWrite(async (change, context) => {
    const docId = context.params.docId;

    if (!change.after.exists) {
      const oldData = change.before.data()!;
      await syncUserToLookup('institutions', docId, oldData, true);
    } else {
      const newData = change.after.data()!;
      await syncUserToLookup('institutions', docId, newData, false);
    }
  });

// Trigger for districtAdmins collection
export const onDistrictAdminWrite = functions.firestore
  .document('districtAdmins/{docId}')
  .onWrite(async (change, context) => {
    const docId = context.params.docId;

    if (!change.after.exists) {
      const oldData = change.before.data()!;
      await syncUserToLookup('districtAdmins', docId, oldData, true);
    } else {
      const newData = change.after.data()!;
      await syncUserToLookup('districtAdmins', docId, newData, false);
    }
  });

// Trigger for superAdmins collection
export const onSuperAdminWrite = functions.firestore
  .document('superAdmins/{docId}')
  .onWrite(async (change, context) => {
    const docId = context.params.docId;

    if (!change.after.exists) {
      const oldData = change.before.data()!;
      await syncUserToLookup('superAdmins', docId, oldData, true);
    } else {
      const newData = change.after.data()!;
      await syncUserToLookup('superAdmins', docId, newData, false);
    }
  });
