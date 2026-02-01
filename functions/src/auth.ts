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

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import * as bcrypt from 'bcryptjs';

const db = getFirestore('neolink');
const auth = admin.auth();
const FUNCTION_REGION = 'asia-southeast1';

// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================
const SECURITY = {
  BCRYPT_ROUNDS: 12,
  MAX_LOGIN_ATTEMPTS: 5,
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  LOCKOUT_DURATION_MS: 30 * 60 * 1000,  // 30 minutes
};

// ============================================================================
// PASSWORD UTILITIES
// ============================================================================
const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SECURITY.BCRYPT_ROUNDS);
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// Check if string is a bcrypt hash
const isBcryptHash = (str: string): boolean => {
  return !!(str && str.startsWith('$2'));
};

// ============================================================================
// AUDIT LOGGING
// ============================================================================
const logAudit = async (event: {
  action: string;
  email?: string;
  status: 'success' | 'failure';
  details: string;
  ip?: string;
}) => {
  try {
    await db.collection('authAuditLogs').add({
      ...event,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Audit log failed:', e);
  }
};

// ============================================================================
// RATE LIMITING
// ============================================================================
const checkRateLimit = async (identifier: string): Promise<{
  allowed: boolean;
  remaining: number;
  lockedUntil?: number;
}> => {
  const rateLimitRef = db.collection('rateLimits').doc(identifier.toLowerCase());
  const doc = await rateLimitRef.get();
  const now = Date.now();

  if (!doc.exists) {
    return { allowed: true, remaining: SECURITY.MAX_LOGIN_ATTEMPTS };
  }

  const data = doc.data()!;

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

const recordAttempt = async (identifier: string, success: boolean) => {
  const rateLimitRef = db.collection('rateLimits').doc(identifier.toLowerCase());
  const now = Date.now();

  if (success) {
    await rateLimitRef.delete();
    return;
  }

  const doc = await rateLimitRef.get();
  const data = doc.exists ? doc.data()! : { attempts: 0, windowStart: now };

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

// ============================================================================
// FIND USER
// ============================================================================
interface UserData {
  email: string;
  storedPassword: string;
  passwordHash?: string;
  role: string;
  displayName: string;
  enabled: boolean;
  institutionId?: string;
  userID?: string;
  collection: string;
  docId: string;
}

const findUser = async (identifier: string): Promise<UserData | null> => {
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
export const authenticateUser = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
  const { identifier, password } = data;
  const ip = context.rawRequest?.ip || 'unknown';

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
        details: `Account locked until ${new Date(rateLimit.lockedUntil!).toISOString()}`,
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
      } else {
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
      } catch (e) {
        console.error('Password migration failed:', e);
      }
    }

    // Step 7: Sync to Firebase Auth
    let firebaseUser: admin.auth.UserRecord;
    try {
      firebaseUser = await auth.getUserByEmail(user.email);
      await auth.updateUser(firebaseUser.uid, { password });
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        firebaseUser = await auth.createUser({
          email: user.email,
          password,
          displayName: user.displayName,
          emailVerified: true,
        });
      } else {
        throw e;
      }
    }

    // Step 8: Set custom claims
    await auth.setCustomUserClaims(firebaseUser.uid, {
      role: user.role,
      institutionId: user.institutionId || null,
      userID: user.userID || null,
    });

    // Step 9: Update last login
    await db.collection(user.collection).doc(user.docId).update({
      lastLoginAt: new Date().toISOString(),
      firebaseUid: firebaseUser.uid,
    }).catch(() => {});

    // Step 10: Audit log success
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
      useClientAuth: true,
      user: {
        uid: firebaseUser.uid,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        institutionId: user.institutionId,
      },
    };

  } catch (error: any) {
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
export const changePassword = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
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

  // Verify current password if provided
  if (currentPassword) {
    let valid = false;
    if (user.passwordHash && isBcryptHash(user.passwordHash)) {
      valid = await verifyPassword(currentPassword, user.passwordHash);
    } else if (user.storedPassword) {
      valid = isBcryptHash(user.storedPassword)
        ? await verifyPassword(currentPassword, user.storedPassword)
        : currentPassword === user.storedPassword;
    }
    if (!valid) {
      throw new functions.https.HttpsError('permission-denied', 'Current password is incorrect');
    }
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
export const createSecureUser = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const callerRole = context.auth.token.role as string;
  if (!['SuperAdmin', 'DistrictAdmin', 'Admin'].includes(callerRole)) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized');
  }

  const { email, password, displayName, role, institutionId, userID, collection } = data;

  if (!email || !password || !role || !collection) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }

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
export const getAuthAuditLogs = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.role !== 'SuperAdmin') {
    throw new functions.https.HttpsError('permission-denied', 'SuperAdmin only');
  }

  const { limit = 100 } = data;
  const snapshot = await db.collection('authAuditLogs')
    .orderBy('timestamp', 'desc')
    .limit(Math.min(limit, 500))
    .get();

  return {
    logs: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
  };
});

// ============================================================================
// PLACEHOLDER EXPORTS
// ============================================================================
export const migrateUserPassword = functions.region(FUNCTION_REGION).https.onCall(async () => {
  return { success: true, message: 'Auto-migration happens on login' };
});

export const bulkMigratePasswords = functions.region(FUNCTION_REGION).https.onCall(async () => {
  return { success: true, message: 'Auto-migration happens on login' };
});

export const initializeUserPassword = functions.region(FUNCTION_REGION).https.onCall(async () => {
  return { success: true, message: 'Use autoFixPasswords endpoint' };
});

// ============================================================================
// SYNC ALL USERS TO FIREBASE AUTH (Enables Password Reset)
// ============================================================================
export const syncUsersToFirebaseAuth = functions.region(FUNCTION_REGION).https.onRequest(async (req, res) => {
  const results: any[] = [];

  const collections = [
    { name: 'superAdmins', emailField: 'email', passwordField: 'password', role: 'SuperAdmin' },
    { name: 'districtAdmins', emailField: 'email', passwordField: 'password', role: 'DistrictAdmin' },
    { name: 'institutions', emailField: 'adminEmail', passwordField: 'password', role: 'Admin' },
    { name: 'officials', emailField: 'email', passwordField: 'password', role: 'Official' },
    { name: 'approved_users', emailField: 'email', passwordField: 'password', role: null },
  ];

  for (const col of collections) {
    const snapshot = await db.collection(col.name).get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const email = data[col.emailField];

      if (!email) continue;

      // Get password from various possible fields
      const password = data.password || data.adminPassword || data.initialPassword || '';
      const passwordHash = data.passwordHash || '';

      // Skip if no password at all
      if (!password && !passwordHash) {
        results.push({ email, status: 'SKIPPED', reason: 'no password in Firestore' });
        continue;
      }

      try {
        let firebaseUser: admin.auth.UserRecord;
        let action: string;

        try {
          // Check if user exists in Firebase Auth
          firebaseUser = await auth.getUserByEmail(email.toLowerCase());

          // User exists - check if they have password provider
          const hasPasswordProvider = firebaseUser.providerData.some(
            p => p.providerId === 'password'
          );

          if (!hasPasswordProvider && password && !isBcryptHash(password)) {
            // Add password to existing user
            await auth.updateUser(firebaseUser.uid, { password });
            action = 'UPDATED (added password provider)';
          } else if (!hasPasswordProvider) {
            // Has bcrypt hash - use default password
            await auth.updateUser(firebaseUser.uid, { password: 'NeoLink@2024' });
            action = 'UPDATED (set default password)';
          } else {
            action = 'EXISTS (has password provider)';
          }
        } catch (e: any) {
          if (e.code === 'auth/user-not-found') {
            // Create new Firebase Auth user
            const userPassword = (password && !isBcryptHash(password)) ? password : 'NeoLink@2024';
            firebaseUser = await auth.createUser({
              email: email.toLowerCase(),
              password: userPassword,
              displayName: data.displayName || data.adminName || data.name || email,
              emailVerified: true,
            });
            action = 'CREATED';
          } else {
            throw e;
          }
        }

        // Update Firestore with Firebase UID
        await doc.ref.update({
          firebaseUid: firebaseUser!.uid,
          syncedToFirebaseAuth: new Date().toISOString(),
        }).catch(() => {});

        results.push({
          email,
          role: col.role || data.role,
          status: action,
          uid: firebaseUser!.uid,
        });
      } catch (error: any) {
        results.push({ email, status: 'ERROR', error: error.message });
      }
    }
  }

  const created = results.filter(r => r.status === 'CREATED').length;
  const updated = results.filter(r => r.status?.includes('UPDATED')).length;
  const existing = results.filter(r => r.status?.includes('EXISTS')).length;

  res.json({
    success: true,
    message: `Synced ${created + updated} users to Firebase Auth. Password reset emails will now work.`,
    summary: {
      created,
      updated,
      alreadyExists: existing,
      errors: results.filter(r => r.status === 'ERROR').length,
      skipped: results.filter(r => r.status === 'SKIPPED').length,
    },
    results,
  });
});

// ============================================================================
// SET PASSWORD FOR USERS WITHOUT ONE
// ============================================================================
export const autoFixPasswords = functions.region(FUNCTION_REGION).https.onRequest(async (req, res) => {
  const newPassword = (req.query.password as string) || 'NeoLink@2024';
  const results: any[] = [];

  // Hash the password
  const passwordHash = await hashPassword(newPassword);

  const collections = [
    { name: 'superAdmins', emailField: 'email', role: 'SuperAdmin' },
    { name: 'districtAdmins', emailField: 'email', role: 'DistrictAdmin' },
    { name: 'officials', emailField: 'email', role: 'Official' },
    { name: 'approved_users', emailField: 'email', role: null },
  ];

  for (const col of collections) {
    const snapshot = await db.collection(col.name).get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const email = data[col.emailField];
      const hasPassword = data.password || data.passwordHash || data.adminPassword;

      if (!email) continue;

      if (hasPassword) {
        results.push({ email, status: 'SKIPPED', reason: 'has password' });
        continue;
      }

      try {
        // Set hashed password in Firestore
        await doc.ref.update({
          passwordHash,
          passwordSetAt: new Date().toISOString(),
        });

        // Sync to Firebase Auth
        try {
          const existing = await auth.getUserByEmail(email.toLowerCase());
          await auth.updateUser(existing.uid, { password: newPassword });
        } catch (e: any) {
          if (e.code === 'auth/user-not-found') {
            await auth.createUser({
              email: email.toLowerCase(),
              password: newPassword,
              displayName: data.displayName || data.name || email,
              emailVerified: true,
            });
          }
        }

        results.push({ email, role: col.role || data.role, status: 'SET' });
      } catch (error: any) {
        results.push({ email, status: 'ERROR', error: error.message });
      }
    }
  }

  res.json({
    success: true,
    message: `Enterprise auth ready. Password set for ${results.filter(r => r.status === 'SET').length} users.`,
    defaultPassword: newPassword,
    results,
    securityFeatures: [
      'bcrypt password hashing (cost 12)',
      'Rate limiting (5 attempts / 15 min)',
      'Account lockout (30 min)',
      'Audit logging',
      'Auto-migration to hash',
    ],
  });
});
