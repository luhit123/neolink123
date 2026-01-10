# 🔐 Firebase Phone Authentication Setup Guide

## ❌ Current Error

```
auth/invalid-app-credential
```

This means **Phone Authentication is not enabled** in your Firebase project.

---

## ✅ Complete Setup Instructions

### Step 1: Enable Phone Authentication Provider

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **neolink-picu-nicu-medical-records**
3. Click **Authentication** in the left sidebar
4. Go to **Sign-in method** tab
5. Scroll to **Phone** provider
6. Click on **Phone**
7. Toggle **Enable**
8. Click **Save**

**Screenshot locations:**
- Authentication → Sign-in method → Phone → Enable

---

### Step 2: Verify Authorized Domains

While in **Sign-in method**:

1. Scroll down to **Authorized domains**
2. Verify these domains are listed:
   - `localhost` (for testing)
   - Your production domain (e.g., `neolink-picu.web.app`)
   - Your custom domain if any

If missing, click **Add domain** and add them.

---

### Step 3: Add Test Phone Numbers (For Development)

**Important:** Use test numbers during development to avoid SMS charges and rate limits.

1. In **Authentication** → **Sign-in method** → **Phone**
2. Scroll to **Phone numbers for testing**
3. Click **Add phone number**
4. Add test numbers:

| Phone Number | Verification Code |
|--------------|------------------|
| `+1 555 555 5555` | `123456` |
| `+91 9999999999` | `123456` |
| `+44 7700 900000` | `123456` |

5. Click **Add**

**How it works:**
- These test numbers will **always accept the specified OTP**
- **No real SMS is sent** (free testing!)
- Perfect for development and demos

---

### Step 4: Configure reCAPTCHA (Optional)

For production, configure App Check to prevent abuse:

1. Go to **Build** → **App Check**
2. Click **Get started**
3. Select **reCAPTCHA v3** for web
4. Register your site
5. Copy the **Site Key**
6. Add to your `.env` file:
   ```
   VITE_RECAPTCHA_SITE_KEY=your_site_key_here
   ```

---

## 🧪 Testing the OTP Login

### Method 1: Using Test Phone Numbers (Recommended)

1. **Create a test user:**
   - Go to SuperAdmin Dashboard
   - Add a new user (Doctor/Nurse/Admin)
   - Enter email: `test@example.com`
   - **Phone number:** `+1 555 555 5555` (or your configured test number)
   - Submit

2. **Login with OTP:**
   - Go to Login page
   - Enter the UserID for the test user
   - Toggle to **"OTP"** method
   - Click **"Send OTP"**
   - Enter OTP: `123456` (the test verification code)
   - Click **"Verify OTP"**
   - ✅ Should login successfully!

### Method 2: Using Real Phone Numbers

**⚠️ Warning:** This will send real SMS and incur charges!

1. **Enable billing** in Firebase Console (required for SMS)
2. **Add a user with real phone number:**
   - Phone: `+91 9876543210` (your real number with country code)
3. **Login:**
   - Enter UserID
   - Toggle to OTP
   - Send OTP
   - **Check your phone for SMS**
   - Enter the 6-digit OTP you received
   - Verify and login

---

## 📱 Phone Number Format

**Always use international format:**

```
+[country code][number]
```

**Examples:**
- India: `+91 9876543210`
- USA: `+1 5551234567`
- UK: `+44 7700900000`

**Invalid formats:**
- ❌ `9876543210` (missing country code)
- ❌ `919876543210` (missing +)
- ❌ `+91-9876543210` (no dashes)

---

## 🐛 Common Errors & Solutions

### Error: `auth/invalid-app-credential`
**Solution:** Phone auth not enabled. Follow Step 1 above.

### Error: `auth/invalid-phone-number`
**Solution:** Use international format: `+91 1234567890`

### Error: `auth/too-many-requests`
**Solution:**
- Wait 1 hour
- Use test phone numbers instead
- Enable App Check

### Error: `auth/captcha-check-failed`
**Solution:**
- Refresh the page
- Check browser console for errors
- Verify domain is in authorized domains list

### Error: `auth/quota-exceeded`
**Solution:**
- You've exceeded SMS quota
- Use test phone numbers
- Enable billing in Firebase Console

### Error: `auth/code-expired`
**Solution:**
- OTP expired (10 minutes)
- Click "Resend OTP"
- Enter new OTP

---

## 💰 Pricing & Quotas

### Free Tier (Spark Plan)
- **Phone verifications:** Limited
- **SMS:** Not included (test numbers are free)

### Blaze Plan (Pay-as-you-go)
- **Phone verifications:** ~$0.01 - $0.06 per verification
- **SMS costs:** Varies by country
  - India: ~$0.01 - $0.02 per SMS
  - USA: ~$0.01 per SMS
  - International: Varies

### Recommendation
- **Development:** Use test phone numbers (free!)
- **Production:** Enable billing + App Check

---

## 🔒 Security Best Practices

### 1. Enable App Check
Prevents abuse and bot attacks on phone auth endpoint.

### 2. Rate Limiting
Firebase automatically limits:
- 10 SMS per day per phone number
- 5 attempts per IP per hour

### 3. Use Test Numbers for Development
Don't waste SMS quota on testing!

### 4. Verify Phone Numbers
Before sending SMS, validate format in your backend.

### 5. Monitor Usage
Check Firebase Console → Usage tab regularly.

---

## 📋 Quick Checklist

Before deploying to production:

- [ ] Phone authentication enabled in Firebase Console
- [ ] Test phone numbers configured (at least 2-3)
- [ ] Tested OTP flow with test numbers
- [ ] Authorized domains configured correctly
- [ ] App Check enabled (optional but recommended)
- [ ] Billing enabled if using real SMS
- [ ] Rate limiting understood
- [ ] Error handling tested
- [ ] User documentation created

---

## 🎯 Current Implementation Status

✅ **Completed:**
- Phone number field in user creation forms
- Phone numbers stored in Firestore
- OTP login UI with toggle (Password/OTP)
- Firebase Phone Auth integration
- reCAPTCHA setup
- Error handling with clear messages
- Resend OTP functionality (60s timer)
- Copy credentials from user cards

⏳ **Pending:**
- Firebase Console configuration (you need to do this)
- Testing with real/test phone numbers

---

## 🚀 Next Steps

1. **Go to Firebase Console NOW**
2. **Enable Phone Authentication** (takes 2 minutes)
3. **Add test phone numbers** (3 test numbers recommended)
4. **Test the OTP login** with test number `+1 555 555 5555` and OTP `123456`
5. **Deploy and celebrate!** 🎉

---

## 📞 Support

If you encounter issues:
1. Check Firebase Console → Authentication → Usage tab
2. Check browser console for detailed error messages
3. Verify all steps above are completed
4. Test with test phone numbers first

**Firebase Phone Auth Documentation:**
https://firebase.google.com/docs/auth/web/phone-auth

---

**Remember:** Phone authentication is powerful but requires proper Firebase configuration. Follow the steps above carefully! 🔐
