# Unified Authentication System

## Overview

The Neolink app now supports **flexible, unified authentication** that allows users to sign in using **EITHER** method:
- **Google Sign-In** (One-click with Google account)
- **UserID + Password** (Institution-based credentials)

Both methods work seamlessly for the same account without conflicts.

---

## How It Works

### For ALL Users (Doctors, Nurses, Institution Admins, etc.)

Users can choose **any** login method they prefer:

#### Option 1: Google Sign-In
- Click "Sign in with Google"
- Choose your Google account
- Done! ✅

#### Option 2: UserID + Password
- Enter your UserID (e.g., GUW001)
- Enter your password
- Click "Sign In"
- Done! ✅

**Important**: The same user can use BOTH methods! If you sign in with Google today and UserID+Password tomorrow, it's the same account.

---

## How Users Are Created

### 1. SuperAdmin Creates User

When SuperAdmin creates a user (doctor, nurse, admin):

1. SuperAdmin enters:
   - Email (e.g., doctor@hospital.com)
   - Name
   - Role
   - District
   - **Optionally**: Custom UserID and Password

2. System automatically generates (if not manually provided):
   - UserID (e.g., GUW001, GUW002)
   - 8-character alphanumeric password

3. User receives credentials via email or admin notification

### 2. User First Login

**Method A: Using UserID + Password**
- Enter UserID and the password SuperAdmin provided
- System creates Firebase Auth account automatically
- Login successful! ✅

**Method B: Using Google Sign-In**
- Click "Sign in with Google"
- Choose Google account that matches the email in system
- Login successful! ✅

### 3. Switching Between Methods

Users can freely switch:
- Monday: Sign in with Google
- Tuesday: Sign in with UserID + Password
- Wednesday: Back to Google

**No problem!** Both methods link to the same account because they use the same email address.

---

## Password Management

### Self-Service Password Reset (For Users)

Users can reset their OWN passwords without SuperAdmin:

1. Click "Forgot Password?" on login screen
2. Choose reset method:
   - **Use UserID**: Enter UserID (e.g., GUW001)
   - **Use Email**: Enter email address
3. Click "Send Reset Email"
4. Check email inbox
5. Click the password reset link in email
6. Set new password
7. Done! ✅

**Email Provider**: Firebase Authentication sends the password reset email automatically.

### How Password Reset Works

1. User requests password reset
2. Firebase sends email with secure reset link
3. User clicks link (opens Firebase-hosted page)
4. User enters new password
5. Password updated in Firebase Auth
6. User can log in with new password

**Note**: This only affects UserID+Password login. Google Sign-In uses your Google account password (managed separately).

---

## SuperAdmin Password Control (Optional)

SuperAdmin can still manage passwords if needed:

### In SuperAdmin Dashboard:

#### For Institutions:
- View institution card
- See current UserID and Password
- Edit institution → Change password
- Password updated for that admin

#### For Individual Users:
- View user list in institution
- See UserID and Password for each user
- **Future Enhancement**: Add "Reset Password" button to set new password manually

### When SuperAdmin Sets Password

When SuperAdmin manually sets a password:
- Password stored in Firestore (for reference)
- **BUT**: Firebase Auth is the real password system
- If user hasn't logged in yet, Firebase Auth account is created on first login
- If user has logged in, they should use self-service reset

---

## Technical Details

### Authentication Flow

```
User Login with UserID + Password:
1. User enters UserID (e.g., GUW001) and password
2. System looks up UserID in Firestore → finds email (e.g., doctor@hospital.com)
3. System calls Firebase Auth: signInWithEmailAndPassword(email, password)
4. Firebase validates password
5. If Firebase account doesn't exist: Create it automatically
6. Login successful!

User Login with Google:
1. User clicks "Sign in with Google"
2. Google OAuth popup
3. User chooses Google account
4. Firebase Auth validates with Google
5. Login successful!
```

### Password Storage

**Old System** (Removed):
- ❌ Passwords stored in Firestore
- ❌ Firestore password checked first
- ❌ Firebase password separate
- ❌ Conflicts and sync issues

**New System** (Current):
- ✅ **Firebase Auth is the ONLY password source**
- ✅ Firestore only stores UserID (for lookup)
- ✅ No password sync issues
- ✅ Works seamlessly

### UserID to Email Mapping

Firestore stores:
```json
{
  "userID": "GUW001",
  "email": "doctor@hospital.com",
  "displayName": "Dr. Smith",
  "role": "Doctor",
  "institutionId": "xyz123"
}
```

When user logs in with UserID:
1. Look up "GUW001" → Find email "doctor@hospital.com"
2. Use email for Firebase Auth login

---

## User Scenarios

### Scenario 1: New Doctor Added

1. **SuperAdmin**: Adds Dr. Smith with email dr.smith@hospital.com
2. **System**: Generates UserID "GUW003" and password "aB3kL9pQ"
3. **SuperAdmin**: Sends credentials to Dr. Smith via email
4. **Dr. Smith**: Receives email with UserID and password
5. **Dr. Smith - Option A**: Logs in with UserID "GUW003" + password
   - Firebase Auth account created automatically
   - Login successful! ✅
6. **Dr. Smith - Option B**: Logs in with Google using dr.smith@hospital.com
   - Firebase recognizes email
   - Login successful! ✅

### Scenario 2: User Forgets Password

1. **User**: Clicks "Forgot Password?"
2. **User**: Enters UserID "GUW003" (or email dr.smith@hospital.com)
3. **System**: Sends password reset email to dr.smith@hospital.com
4. **User**: Checks email inbox
5. **User**: Clicks reset link
6. **User**: Sets new password
7. **User**: Logs in with UserID + new password
8. **Success!** ✅

**Alternative**: User can also just use Google Sign-In to bypass password entirely!

### Scenario 3: Switching Between Methods

**Monday**:
- User logs in with Google Sign-In ✅

**Tuesday**:
- User logs in with UserID + Password ✅

**Wednesday**:
- User forgets password
- Uses Google Sign-In instead ✅

**Thursday**:
- Wants to use password again
- Resets password via email
- Logs in with UserID + new password ✅

**All the same account, no conflicts!**

---

## Benefits

### For Users:
- ✅ **Flexibility**: Choose Google OR UserID+Password
- ✅ **Self-Service**: Reset own password without admin
- ✅ **No Conflicts**: Both methods work together seamlessly
- ✅ **Convenience**: Use Google for quick login, password for security

### For SuperAdmin:
- ✅ **Less Support**: Users reset own passwords
- ✅ **Visibility**: Still see UserIDs and initial passwords
- ✅ **Control**: Can manually set passwords if needed
- ✅ **Simplicity**: One user = one account (regardless of login method)

### For System:
- ✅ **No Sync Issues**: Firebase Auth is single source of truth
- ✅ **Security**: Proper password encryption by Firebase
- ✅ **Reliability**: Firebase handles password resets professionally
- ✅ **Scalability**: Works for thousands of users

---

## Migration from Old System

### If You Have Existing Users:

**Problem**: Old users have passwords in Firestore but not in Firebase Auth

**Solution**: On first login with UserID+Password:
1. System tries Firebase Auth login
2. If account doesn't exist: Creates it automatically
3. Uses the password user entered
4. Login successful!

**No manual migration needed!** ✅

---

## Common Questions

### Q: Can a user have both Google and Password login?
**A**: Yes! The same user can use both methods. They're linked by email address.

### Q: What if user forgets their UserID?
**A**: They can use "Forgot Password" → "Use Email" option and enter their email directly.

### Q: Can users change their own password?
**A**: Yes! Use the "Forgot Password" flow to receive a reset email from Firebase.

### Q: Do users need to remember their UserID?
**A**: No! They can always use Google Sign-In instead. UserID is optional.

### Q: What if SuperAdmin changes a user's password?
**A**: Best practice: User should use "Forgot Password" to set their own. If SuperAdmin must set it, they should inform the user of the new password.

### Q: Can institution admins reset passwords for their users?
**A**: Currently no - only SuperAdmin. Future enhancement: Institution admins could have this capability.

### Q: What happens if someone uses the wrong email with Google Sign-In?
**A**: Firebase will create a separate account. They won't have access to the institution's data unless their email is added by SuperAdmin.

---

## Security Notes

- ✅ Passwords are encrypted by Firebase (bcrypt)
- ✅ Password reset emails are time-limited (1 hour expiry)
- ✅ Password reset links are single-use
- ✅ Firebase enforces minimum password requirements
- ✅ Rate limiting on password reset requests (prevents abuse)
- ✅ Google Sign-In uses OAuth 2.0 (industry standard)

---

## Future Enhancements

1. **Institution Admin Password Reset**: Allow institution admins to reset passwords for their own users
2. **2FA (Two-Factor Authentication)**: Add optional 2FA for extra security
3. **Password Strength Requirements**: Customize minimum password requirements
4. **Login History**: Show users their recent login activity
5. **Session Management**: Allow users to see and revoke active sessions

---

## Quick Reference

| Task | Method |
|------|--------|
| **First time login** | Use UserID + password from SuperAdmin OR Google Sign-In |
| **Forgot password** | Click "Forgot Password?" → Reset via email |
| **Switch login method** | Just use the other method - both work! |
| **Reset own password** | "Forgot Password?" → Email reset link |
| **See my UserID** | Ask your institution admin |
| **Use Google instead of password** | Click "Sign in with Google" |

---

## Support

If you have issues:
1. Check your email for password reset link
2. Try Google Sign-In as alternative
3. Contact your institution admin
4. Contact SuperAdmin if still stuck

**Remember**: You can always use Google Sign-In if you forget your password! 🚀
