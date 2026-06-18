"use strict";
/**
 * ============================================================================
 * NEOLINK ENTERPRISE AUTHENTICATION SYSTEM
 * ============================================================================
 *
 * Security Features:
 * ✅ bcrypt password hashing (cost factor 12)
 * ✅ Server-side password verification (never exposed to client)
 * ✅ Rate limiting (5 attempts per 15 minutes)
 * ✅ Account lockout (30 minutes after 5 failed attempts)
 * ✅ Comprehensive audit logging
 * ✅ Auto-migration from plain text to hashed passwords
 * ✅ Custom claims for role-based access control
 *
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeUserPassword = exports.bulkMigratePasswords = exports.migrateUserPassword = exports.getAuthAuditLogs = exports.createSecureUser = exports.changePassword = exports.authenticateUser = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const bcrypt = require("bcryptjs");
const db = (0, firestore_1.getFirestore)('neolink');
const auth = admin.auth();
const FUNCTION_REGION = 'asia-southeast1';
// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================
const SECURITY = {
    BCRYPT_ROUNDS: 12,
    MAX_LOGIN_ATTEMPTS: 5,
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    LOCKOUT_DURATION_MS: 30 * 60 * 1000, // 30 minutes
};
// ============================================================================
// PASSWORD UTILITIES
// ============================================================================
const hashPassword = async (password) => {
    return bcrypt.hash(password, SECURITY.BCRYPT_ROUNDS);
};
const verifyPassword = async (password, hash) => {
    return bcrypt.compare(password, hash);
};
// Check if string is a bcrypt hash
const isBcryptHash = (str) => {
    return !!(str && str.startsWith('$2'));
};
// ============================================================================
// AUDIT LOGGING
// ============================================================================
const logAudit = async (event) => {
    try {
        await db.collection('authAuditLogs').add(Object.assign(Object.assign({}, event), { timestamp: new Date().toISOString() }));
    }
    catch (e) {
        console.error('Audit log failed:', e);
    }
};
// ============================================================================
// RATE LIMITING
// ============================================================================
const checkRateLimit = async (identifier) => {
    const rateLimitRef = db.collection('rateLimits').doc(identifier.toLowerCase());
    const doc = await rateLimitRef.get();
    const now = Date.now();
    if (!doc.exists) {
        return { allowed: true, remaining: SECURITY.MAX_LOGIN_ATTEMPTS };
    }
    const data = doc.data();
    // Check if locked
    if (data.lockedUntil && now < data.lockedUntil) {
        return { allowed: false, remaining: 0, lockedUntil: data.lockedUntil };
    }
    // Check if window expired
    if (data.windowStart && now - data.windowStart > SECURITY.RATE_LIMIT_WINDOW_MS) {
        await rateLimitRef.set({ attempts: 0, windowStart: now });
        return { allowed: true, remaining: SECURITY.MAX_LOGIN_ATTEMPTS };
    }
    const remaining = Math.max(0, SECURITY.MAX_LOGIN_ATTEMPTS - (data.attempts || 0));
    return { allowed: remaining > 0, remaining };
};
const recordAttempt = async (identifier, success) => {
    const rateLimitRef = db.collection('rateLimits').doc(identifier.toLowerCase());
    const now = Date.now();
    if (success) {
        await rateLimitRef.delete();
        return;
    }
    const doc = await rateLimitRef.get();
    const data = doc.exists ? doc.data() : { attempts: 0, windowStart: now };
    // Reset if window expired
    if (data.windowStart && now - data.windowStart > SECURITY.RATE_LIMIT_WINDOW_MS) {
        data.attempts = 0;
        data.windowStart = now;
    }
    data.attempts = (data.attempts || 0) + 1;
    // Lock if too many attempts
    if (data.attempts >= SECURITY.MAX_LOGIN_ATTEMPTS) {
        data.lockedUntil = now + SECURITY.LOCKOUT_DURATION_MS;
    }
    await rateLimitRef.set(data);
};
const findUser = async (identifier) => {
    const isEmail = identifier.includes('@');
    const searchValue = isEmail ? identifier.toLowerCase().trim() : identifier.toUpperCase().trim();
    const collections = [
        { name: 'superAdmins', emailField: 'email', userIdField: 'userID', role: 'SuperAdmin' },
        { name: 'districtAdmins', emailField: 'email', userIdField: 'userID', role: 'DistrictAdmin' },
        { name: 'institutions', emailField: 'adminEmail', userIdField: 'userID', role: 'Admin' },
        { name: 'officials', emailField: 'email', userIdField: 'userID', role: 'Official' },
        { name: 'approved_users', emailField: 'email', userIdField: 'userID', role: null },
    ];
    for (const col of collections) {
        const field = isEmail ? col.emailField : col.userIdField;
        const snapshot = await db.collection(col.name).where(field, '==', searchValue).limit(1).get();
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = doc.data();
            return {
                email: (data.email || data.adminEmail || '').toLowerCase(),
                storedPassword: data.password || data.adminPassword || data.initialPassword || '',
                passwordHash: data.passwordHash || '',
                role: col.role || data.role || 'Doctor',
                displayName: data.displayName || data.adminName || data.name || '',
                enabled: col.name === 'institutions' ? data.isActive !== false : data.enabled !== false,
                institutionId: col.name === 'institutions' ? doc.id : data.institutionId,
                userID: data.userID,
                collection: col.name,
                docId: doc.id,
            };
        }
    }
    return null;
};
// ============================================================================
// MAIN AUTHENTICATION FUNCTION
// ============================================================================
exports.authenticateUser = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
    var _a;
    const { identifier, password } = data;
    const ip = ((_a = context.rawRequest) === null || _a === void 0 ? void 0 : _a.ip) || 'unknown';
    if (!identifier || !password) {
        return { success: false, error: 'Email/UserID and password are required' };
    }
    const rateLimitId = `${ip}_${identifier.toLowerCase()}`;
    try {
        // Step 1: Check rate limit
        const rateLimit = await checkRateLimit(rateLimitId);
        if (!rateLimit.allowed) {
            await logAudit({
                action: 'LOGIN_RATE_LIMITED',
                email: identifier,
                status: 'failure',
                details: `Account locked until ${new Date(rateLimit.lockedUntil).toISOString()}`,
                ip,
            });
            return {
                success: false,
                error: 'Too many failed attempts. Please try again in 30 minutes.',
                lockedUntil: rateLimit.lockedUntil,
            };
        }
        // Step 2: Find user
        const user = await findUser(identifier);
        if (!user) {
            await recordAttempt(rateLimitId, false);
            await logAudit({
                action: 'LOGIN_FAILED',
                email: identifier,
                status: 'failure',
                details: 'User not found',
                ip,
            });
            return { success: false, error: 'Invalid credentials', remaining: rateLimit.remaining - 1 };
        }
        console.log(`🔐 Auth attempt: ${user.email} (${user.role})`);
        // Step 3: Check if enabled
        if (!user.enabled) {
            await logAudit({
                action: 'LOGIN_DISABLED',
                email: user.email,
                status: 'failure',
                details: 'Account disabled',
                ip,
            });
            return { success: false, error: 'Account is disabled. Contact your administrator.' };
        }
        // Step 4: Verify password
        let passwordValid = false;
        let needsMigration = false;
        // Check for bcrypt hash first
        if (user.passwordHash && isBcryptHash(user.passwordHash)) {
            passwordValid = await verifyPassword(password, user.passwordHash);
            console.log(`🔐 Verified with bcrypt hash: ${passwordValid}`);
        }
        // Fall back to plain text password
        else if (user.storedPassword) {
            if (isBcryptHash(user.storedPassword)) {
                // Password field contains hash
                passwordValid = await verifyPassword(password, user.storedPassword);
                console.log(`🔐 Verified with bcrypt (in password field): ${passwordValid}`);
            }
            else {
                // Plain text comparison
                passwordValid = password === user.storedPassword;
                needsMigration = passwordValid; // Migrate to hash on success
                console.log(`🔐 Verified with plain text: ${passwordValid}`);
            }
        }
        if (!passwordValid) {
            await recordAttempt(rateLimitId, false);
            await logAudit({
                action: 'LOGIN_FAILED',
                email: user.email,
                status: 'failure',
                details: 'Invalid password',
                ip,
            });
            return { success: false, error: 'Invalid credentials', remaining: rateLimit.remaining - 1 };
        }
        // Step 5: Clear rate limit on success
        await recordAttempt(rateLimitId, true);
        // Step 6: Auto-migrate plain text to hash
        if (needsMigration) {
            try {
                const newHash = await hashPassword(password);
                await db.collection(user.collection).doc(user.docId).update({
                    passwordHash: newHash,
                    password: admin.firestore.FieldValue.delete(), // Remove plain text
                    passwordMigratedAt: new Date().toISOString(),
                });
                console.log(`✅ Password migrated to bcrypt for: ${user.email}`);
            }
            catch (e) {
                console.error('Password migration failed:', e);
            }
        }
        // Step 7: Sync to Firebase Auth
        let firebaseUser;
        try {
            firebaseUser = await auth.getUserByEmail(user.email);
            // Update the password to ensure Firebase Auth is in sync
            await auth.updateUser(firebaseUser.uid, {
                password,
                displayName: user.displayName || firebaseUser.displayName,
            });
        }
        catch (e) {
            if (e.code === 'auth/user-not-found') {
                firebaseUser = await auth.createUser({
                    email: user.email,
                    password,
                    displayName: user.displayName,
                    emailVerified: true,
                });
            }
            else {
                throw e;
            }
        }
        // Step 8: Set custom claims
        await auth.setCustomUserClaims(firebaseUser.uid, {
            role: user.role,
            institutionId: user.institutionId || null,
            userID: user.userID || null,
        });
        // Step 9: Generate custom token for reliable sign-in
        // This avoids timing issues with password propagation
        const customToken = await auth.createCustomToken(firebaseUser.uid, {
            role: user.role,
            institutionId: user.institutionId || null,
            userID: user.userID || null,
        });
        // Step 10: Update last login
        await db.collection(user.collection).doc(user.docId).update({
            lastLoginAt: new Date().toISOString(),
            firebaseUid: firebaseUser.uid,
        }).catch(() => { });
        // Step 11: Audit log success
        await logAudit({
            action: 'LOGIN_SUCCESS',
            email: user.email,
            status: 'success',
            details: `Logged in as ${user.role}`,
            ip,
        });
        console.log(`✅ Login success: ${user.email} (${user.role})`);
        return {
            success: true,
            token: customToken, // Return custom token for reliable sign-in
            user: {
                uid: firebaseUser.uid,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                institutionId: user.institutionId,
            },
        };
    }
    catch (error) {
        console.error('❌ Auth error:', error);
        await logAudit({
            action: 'LOGIN_ERROR',
            email: identifier,
            status: 'failure',
            details: error.message,
            ip,
        });
        return { success: false, error: 'Authentication failed. Please try again.' };
    }
});
// ============================================================================
// CHANGE PASSWORD
// ============================================================================
exports.changePassword = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }
    const { currentPassword, newPassword } = data;
    if (!newPassword || newPassword.length < 8) {
        throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 8 characters');
    }
    const userEmail = context.auth.token.email;
    if (!userEmail) {
        throw new functions.https.HttpsError('invalid-argument', 'User email not found');
    }
    const user = await findUser(userEmail);
    if (!user) {
        throw new functions.https.HttpsError('not-found', 'User not found');
    }
    // SECURITY: the current password is MANDATORY. Previously it was only checked
    // "if provided", so anyone who hijacked a live session (e.g. a shared/unlocked
    // terminal) could set a new password without knowing the old one and lock the
    // legitimate owner out — converting a transient session into permanent takeover.
    if (!currentPassword) {
        throw new functions.https.HttpsError('invalid-argument', 'Current password is required');
    }
    let valid = false;
    if (user.passwordHash && isBcryptHash(user.passwordHash)) {
        valid = await verifyPassword(currentPassword, user.passwordHash);
    }
    else if (user.storedPassword) {
        valid = isBcryptHash(user.storedPassword)
            ? await verifyPassword(currentPassword, user.storedPassword)
            : currentPassword === user.storedPassword;
    }
    if (!valid) {
        throw new functions.https.HttpsError('permission-denied', 'Current password is incorrect');
    }
    // Hash new password
    const newHash = await hashPassword(newPassword);
    // Update Firestore
    await db.collection(user.collection).doc(user.docId).update({
        passwordHash: newHash,
        password: admin.firestore.FieldValue.delete(),
        passwordChangedAt: new Date().toISOString(),
    });
    // Update Firebase Auth
    await auth.updateUser(context.auth.uid, { password: newPassword });
    // SECURITY: invalidate all existing refresh tokens so other sessions cannot
    // continue using the old credential after a password change.
    await auth.revokeRefreshTokens(context.auth.uid);
    await logAudit({
        action: 'PASSWORD_CHANGED',
        email: userEmail,
        status: 'success',
        details: 'Password changed successfully',
    });
    return { success: true };
});
// ============================================================================
// CREATE USER (for admins)
// ============================================================================
exports.createSecureUser = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    const callerRole = context.auth.token.role;
    if (!['SuperAdmin', 'DistrictAdmin', 'Admin'].includes(callerRole)) {
        throw new functions.https.HttpsError('permission-denied', 'Not authorized');
    }
    const { email, password, displayName, role, institutionId, userID, collection } = data;
    if (!email || !password || !role || !collection) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }
    // ---------------------------------------------------------------------------
    // SECURITY: privilege-escalation guard.
    // Previously a caller could pass ANY role/collection/institutionId, so an
    // institution Admin could create a SuperAdmin (write into the `superAdmins`
    // collection with role 'SuperAdmin'). Constrain what each caller role may mint.
    // ---------------------------------------------------------------------------
    const PRIVILEGED_COLLECTIONS = ['superAdmins', 'districtAdmins'];
    const PRIVILEGED_ROLES = ['SuperAdmin', 'DistrictAdmin'];
    if (callerRole === 'Admin') {
        // Institution admins may only create non-privileged users inside THEIR institution.
        const callerInstitutionId = context.auth.token.institutionId;
        if (PRIVILEGED_ROLES.includes(role) || PRIVILEGED_COLLECTIONS.includes(collection)
            || ['officials', 'institutions'].includes(collection)) {
            throw new functions.https.HttpsError('permission-denied', 'Admins cannot create privileged accounts');
        }
        if (!callerInstitutionId || institutionId !== callerInstitutionId) {
            throw new functions.https.HttpsError('permission-denied', 'Admins can only create users in their own institution');
        }
    }
    else if (callerRole === 'DistrictAdmin') {
        // District admins may not create SuperAdmins.
        if (role === 'SuperAdmin' || collection === 'superAdmins') {
            throw new functions.https.HttpsError('permission-denied', 'District admins cannot create SuperAdmins');
        }
    }
    // SuperAdmin: unrestricted (intended).
    // Hash password
    const passwordHash = await hashPassword(password);
    // Create Firebase Auth user
    const firebaseUser = await auth.createUser({
        email: email.toLowerCase(),
        password,
        displayName: displayName || email,
        emailVerified: true,
    });
    // Set custom claims
    await auth.setCustomUserClaims(firebaseUser.uid, {
        role,
        institutionId: institutionId || null,
        userID: userID || null,
    });
    // Create Firestore document with HASHED password
    await db.collection(collection).add({
        email: email.toLowerCase(),
        passwordHash, // Store hash, NOT plain text
        displayName: displayName || email,
        role,
        institutionId: institutionId || null,
        userID: userID || null,
        enabled: true,
        firebaseUid: firebaseUser.uid,
        createdAt: new Date().toISOString(),
        createdBy: context.auth.uid,
    });
    await logAudit({
        action: 'USER_CREATED',
        email: email.toLowerCase(),
        status: 'success',
        details: `Created ${role} by ${context.auth.token.email}`,
    });
    return { success: true, uid: firebaseUser.uid };
});
// ============================================================================
// GET AUDIT LOGS (SuperAdmin only)
// ============================================================================
exports.getAuthAuditLogs = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.role !== 'SuperAdmin') {
        throw new functions.https.HttpsError('permission-denied', 'SuperAdmin only');
    }
    const { limit = 100 } = data;
    const snapshot = await db.collection('authAuditLogs')
        .orderBy('timestamp', 'desc')
        .limit(Math.min(limit, 500))
        .get();
    return {
        logs: snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data()))),
    };
});
// ============================================================================
// PLACEHOLDER EXPORTS
// ============================================================================
exports.migrateUserPassword = functions.region(FUNCTION_REGION).https.onCall(async () => {
    return { success: true, message: 'Auto-migration happens on login' };
});
exports.bulkMigratePasswords = functions.region(FUNCTION_REGION).https.onCall(async () => {
    return { success: true, message: 'Auto-migration happens on login' };
});
exports.initializeUserPassword = functions.region(FUNCTION_REGION).https.onCall(async () => {
    return { success: true, message: 'Auto-migration happens on login' };
});
// ============================================================================
// REMOVED FOR SECURITY (2026-05): `syncUsersToFirebaseAuth` and `autoFixPasswords`
// were UNAUTHENTICATED onRequest HTTP endpoints. Anyone who knew the function URL
// could set/overwrite the password (to an attacker-chosen or hardcoded default) for
// any account that lacked one — including SuperAdmins/Officials — and then log in.
// This was a full, internet-facing account-takeover vector. Run any one-off password
// migration locally with the Admin SDK (a script that is never deployed as a function).
// ============================================================================
//# sourceMappingURL=auth.js.map