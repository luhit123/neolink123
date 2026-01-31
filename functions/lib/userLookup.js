"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.onSuperAdminWrite = exports.onDistrictAdminWrite = exports.onInstitutionWrite = exports.onApprovedUserWrite = exports.onOfficialWrite = exports.syncUserToLookup = exports.migrateAllUsersToLookup = exports.updateLookupStatus = exports.deleteUserLookup = exports.upsertUserLookup = exports.lookupUser = void 0;
const functions = require("firebase-functions");
const firestore_1 = require("firebase-admin/firestore");
// CRITICAL: Use the named database "neolink" - NOT the default database
const db = (0, firestore_1.getFirestore)('neolink');
// ============================================================================
// REGION CONFIGURATION - MUST MATCH CLIENT (firebaseConfig.ts)
// ============================================================================
const FUNCTION_REGION = 'asia-southeast1'; // Singapore - matches database region
// ============================================================================
// LOOKUP FUNCTIONS
// ============================================================================
/**
 * Fast O(1) user lookup by email or userID
 */
const lookupUser = async (identifier) => {
    const normalizedId = identifier.toLowerCase().trim();
    // Single query - O(1) lookup
    const lookupDoc = await db.collection('userLookup').doc(normalizedId).get();
    if (!lookupDoc.exists) {
        return null;
    }
    return lookupDoc.data();
};
exports.lookupUser = lookupUser;
/**
 * Create or update user lookup entry
 */
const upsertUserLookup = async (email, userID, targetCollection, targetDocId, role, enabled, displayName, institutionId, passwordHash) => {
    const now = new Date().toISOString();
    const normalizedEmail = email.toLowerCase().trim();
    // Create email-based lookup entry (only include defined values to avoid Firestore errors)
    const emailEntry = {
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
    if (displayName)
        emailEntry.displayName = displayName;
    if (institutionId)
        emailEntry.institutionId = institutionId;
    if (passwordHash)
        emailEntry.passwordHash = passwordHash;
    await db.collection('userLookup').doc(normalizedEmail).set(emailEntry, { merge: true });
    // Also create userID-based lookup entry if userID exists
    if (userID) {
        const userIdEntry = {
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
        if (displayName)
            userIdEntry.displayName = displayName;
        if (institutionId)
            userIdEntry.institutionId = institutionId;
        if (passwordHash)
            userIdEntry.passwordHash = passwordHash;
        await db.collection('userLookup').doc(userID.toUpperCase().trim()).set(userIdEntry, { merge: true });
    }
};
exports.upsertUserLookup = upsertUserLookup;
/**
 * Delete user lookup entries
 */
const deleteUserLookup = async (email, userID) => {
    const normalizedEmail = email.toLowerCase().trim();
    // Delete email entry
    await db.collection('userLookup').doc(normalizedEmail).delete();
    // Delete userID entry if exists
    if (userID) {
        await db.collection('userLookup').doc(userID.toUpperCase().trim()).delete();
    }
};
exports.deleteUserLookup = deleteUserLookup;
/**
 * Update enabled status in lookup
 */
const updateLookupStatus = async (email, userID, enabled) => {
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
exports.updateLookupStatus = updateLookupStatus;
// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================
/**
 * Migrate all existing users to the lookup table
 * This should be run once to populate the lookup table
 */
exports.migrateAllUsersToLookup = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
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
    const errors = [];
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
                    await (0, exports.upsertUserLookup)(email, userID, col.name, doc.id, role, enabled, displayName, institutionId, passwordHash);
                    migratedCount++;
                }
                catch (docError) {
                    errorCount++;
                    errors.push(`${col.name}/${doc.id}: ${docError.message}`);
                }
            }
        }
        catch (colError) {
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
const syncUserToLookup = async (collection, docId, data, deleted = false) => {
    const collectionConfig = {
        superAdmins: { emailField: 'email', userIdField: null, role: 'SuperAdmin' },
        districtAdmins: { emailField: 'email', userIdField: 'userID', role: 'DistrictAdmin' },
        institutions: { emailField: 'adminEmail', userIdField: 'userID', role: 'Admin' },
        officials: { emailField: 'email', userIdField: 'userID', role: 'Official' },
        approved_users: { emailField: 'email', userIdField: 'userID', role: null },
    };
    const config = collectionConfig[collection];
    if (!config)
        return;
    const email = data[config.emailField];
    const userID = config.userIdField ? data[config.userIdField] : undefined;
    if (!email)
        return;
    if (deleted) {
        await (0, exports.deleteUserLookup)(email, userID);
    }
    else {
        const role = config.role || data.role || 'Unknown';
        const enabled = collection === 'institutions' ? data.isActive !== false : data.enabled !== false;
        const displayName = data.displayName || data.adminName || data.name;
        const institutionId = collection === 'institutions' ? docId : data.institutionId;
        const passwordHash = data.passwordHash;
        await (0, exports.upsertUserLookup)(email, userID, collection, docId, role, enabled, displayName, institutionId, passwordHash);
    }
};
exports.syncUserToLookup = syncUserToLookup;
// ============================================================================
// FIRESTORE TRIGGERS - Auto-sync lookup table
// ============================================================================
// Trigger for officials collection
exports.onOfficialWrite = functions.firestore
    .document('officials/{docId}')
    .onWrite(async (change, context) => {
    const docId = context.params.docId;
    if (!change.after.exists) {
        // Document deleted
        const oldData = change.before.data();
        await (0, exports.syncUserToLookup)('officials', docId, oldData, true);
    }
    else {
        // Document created or updated
        const newData = change.after.data();
        await (0, exports.syncUserToLookup)('officials', docId, newData, false);
    }
});
// Trigger for approved_users collection
exports.onApprovedUserWrite = functions.firestore
    .document('approved_users/{docId}')
    .onWrite(async (change, context) => {
    const docId = context.params.docId;
    if (!change.after.exists) {
        const oldData = change.before.data();
        await (0, exports.syncUserToLookup)('approved_users', docId, oldData, true);
    }
    else {
        const newData = change.after.data();
        await (0, exports.syncUserToLookup)('approved_users', docId, newData, false);
    }
});
// Trigger for institutions collection
exports.onInstitutionWrite = functions.firestore
    .document('institutions/{docId}')
    .onWrite(async (change, context) => {
    const docId = context.params.docId;
    if (!change.after.exists) {
        const oldData = change.before.data();
        await (0, exports.syncUserToLookup)('institutions', docId, oldData, true);
    }
    else {
        const newData = change.after.data();
        await (0, exports.syncUserToLookup)('institutions', docId, newData, false);
    }
});
// Trigger for districtAdmins collection
exports.onDistrictAdminWrite = functions.firestore
    .document('districtAdmins/{docId}')
    .onWrite(async (change, context) => {
    const docId = context.params.docId;
    if (!change.after.exists) {
        const oldData = change.before.data();
        await (0, exports.syncUserToLookup)('districtAdmins', docId, oldData, true);
    }
    else {
        const newData = change.after.data();
        await (0, exports.syncUserToLookup)('districtAdmins', docId, newData, false);
    }
});
// Trigger for superAdmins collection
exports.onSuperAdminWrite = functions.firestore
    .document('superAdmins/{docId}')
    .onWrite(async (change, context) => {
    const docId = context.params.docId;
    if (!change.after.exists) {
        const oldData = change.before.data();
        await (0, exports.syncUserToLookup)('superAdmins', docId, oldData, true);
    }
    else {
        const newData = change.after.data();
        await (0, exports.syncUserToLookup)('superAdmins', docId, newData, false);
    }
});
//# sourceMappingURL=userLookup.js.map