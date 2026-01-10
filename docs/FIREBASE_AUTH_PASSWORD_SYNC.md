# Firebase Auth Password Sync Issue

## Problem

You're seeing this error when users try to log in:
```
Account exists but password is incorrect. This usually means the Firebase Auth password is out of sync.
```

## Why This Happens

The Neolink app stores user credentials in **two places**:
1. **Firestore** - Where SuperAdmin sets the UserID and Password
2. **Firebase Authentication** - The actual login system

When you create a user in the SuperAdmin dashboard, the system:
1. ✅ Creates/updates the Firestore document with password
2. ✅ Tries to create a Firebase Auth account

But if a Firebase Auth account **already exists** (from old Google Sign-In or previous setup), it has a different password than what you set in Firestore.

## How to Fix It

### Option 1: Delete Firebase Auth User (RECOMMENDED - Fastest)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click **Authentication** in left sidebar
4. Click **Users** tab
5. Find the user by email address
6. Click the ⋮ menu on the right
7. Click **Delete account**
8. Confirm deletion

**That's it!** When the user tries to log in again, the system will automatically create a new Firebase Auth account with the correct password from Firestore.

### Option 2: Use Password Reset Flow

1. User clicks "Forgot Password" on login screen
2. They enter their UserID and Email
3. Request is sent to SuperAdmin
4. SuperAdmin approves and sets new password in Password Resets tab
5. System updates Firestore password
6. User can try logging in again

⚠️ **Note**: This still might have the same sync issue if Firebase Auth password doesn't get updated. Use Option 1 if possible.

### Option 3: Future - Cloud Function (Best Long-term Solution)

Implement a Firebase Cloud Function with Firebase Admin SDK that automatically syncs passwords when you create/update users.

**File location**: `/functions/src/syncPassword.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const syncUserPassword = functions.firestore
  .document('institutions/{institutionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Check if password changed
    if (before.password !== after.password) {
      try {
        // Update Firebase Auth password
        const users = await admin.auth().getUserByEmail(after.adminEmail);
        await admin.auth().updateUser(users.uid, {
          password: after.password
        });
        console.log('✅ Firebase Auth password synced');
      } catch (error) {
        console.error('❌ Failed to sync password:', error);
      }
    }
  });
```

## Prevention

To avoid this issue in the future:

1. **Don't use Google Sign-In for institution users** - Only use UserID + Password
2. **Delete old Firebase Auth accounts** before creating institutions
3. **Implement Cloud Function** (Option 3 above) for automatic sync

## Current Workaround

For now, whenever you see a "password mismatch" error:

1. Note the user's email address from the error logs
2. Go to Firebase Console > Authentication
3. Delete that user
4. Ask them to try logging in again

The system will automatically create a fresh Firebase Auth account with the correct password.

---

**Need help?** Check the browser console for detailed error messages showing which email/UserID has the password mismatch.
