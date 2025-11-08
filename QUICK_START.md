# 🚀 Quick Start Guide - Firebase Setup

## ✅ Step 1: Firebase SDK Installed!

The Firebase SDK has been successfully installed! ✨

---

## 🔧 Step 2: Get Your Firebase Configuration (REQUIRED)

### **Option A: If you already have a web app registered:**

1. Go to: https://console.firebase.google.com/project/medilink-f2b56/settings/general
2. Scroll to "Your apps" section
3. Click on your web app (</> icon)
4. Copy the `firebaseConfig` object

### **Option B: If you need to register a new web app:**

1. Go to: https://console.firebase.google.com/project/medilink-f2b56/overview
2. Click the **</> (Web)** icon to add a web app
3. Nickname: "NeoLink Web"
4. ✅ Check "Also set up Firebase Hosting"
5. Click "Register app"
6. Copy the `firebaseConfig` object shown

### **What you'll get:**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "medilink-f2b56.firebaseapp.com",
  projectId: "medilink-f2b56",
  storageBucket: "medilink-f2b56.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};
```

### **Update firebaseConfig.ts:**

Open `/firebaseConfig.ts` and replace the placeholder values:
- Replace `YOUR_API_KEY_HERE` with your actual `apiKey`
- Replace `YOUR_SENDER_ID_HERE` with your actual `messagingSenderId`
- Replace `YOUR_APP_ID_HERE` with your actual `appId`

---

## 🔐 Step 3: Enable Authentication

1. Go to: https://console.firebase.google.com/project/medilink-f2b56/authentication
2. Click **Get Started** (if not already enabled)
3. Go to **Sign-in method** tab

### **Enable Email/Password:**
- Click on **Email/Password**
- Toggle **Enable** to ON
- Click **Save**

### **Enable Google Sign-In:**
- Click on **Google**
- Toggle **Enable** to ON
- Enter your support email
- Click **Save**

---

## 💾 Step 4: Enable Firestore Database

1. Go to: https://console.firebase.google.com/project/medilink-f2b56/firestore
2. Click **Create database**
3. Select **Start in production mode**
4. Choose location: **asia-south1 (Mumbai)** (recommended for India)
5. Click **Enable**

---

## 🔒 Step 5: Set Firestore Security Rules

1. In Firestore, go to **Rules** tab
2. Replace the existing rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && request.auth.uid == userId;
    }
    
    // Colleges collection
    match /colleges/{collegeId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && getUserRole() == 'Admin';
      
      // Patients subcollection
      match /patients/{patientId} {
        allow read: if isAuthenticated();
        allow create: if isAuthenticated();
        allow update: if isAuthenticated() && 
                      (getUserRole() == 'Admin' || getUserRole() == 'Doctor');
        allow delete: if isAuthenticated() && getUserRole() == 'Admin';
        
        // Progress notes subcollection
        match /progressNotes/{noteId} {
          allow read: if isAuthenticated();
          allow write: if isAuthenticated() && 
                       (getUserRole() == 'Admin' || getUserRole() == 'Doctor');
        }
      }
      
      // Statistics subcollection
      match /statistics/{statId} {
        allow read: if isAuthenticated();
        allow write: if isAuthenticated() && getUserRole() == 'Admin';
      }
    }
  }
}
```

3. Click **Publish**

---

## 🏥 Step 6: Create College Document

1. In Firestore, click **Start collection**
2. Collection ID: `colleges`
3. Document ID: `nalbari-medical-college`
4. Add these fields:

| Field | Type | Value |
|-------|------|-------|
| `name` | string | "Nalbari Medical College and Hospital" |
| `enabled` | boolean | `true` |
| `createdAt` | timestamp | (Click "Use server timestamp") |

5. Add a map field called `location`:
   - Click "Add field" → Field type: "map"
   - Field path: `location`
   - Inside the map, add:
     - `district` (string): "Nalbari"
     - `state` (string): "Assam"

6. Click **Save**

---

## ✅ Step 7: Verify Everything Works

### **Test Build:**
```bash
npm run build
```

If it builds successfully, you're ready!

### **Test Locally:**
```bash
npm run dev
```

---

## 📋 What's Been Set Up

### **✅ Installed:**
- Firebase SDK (v10.x)
- All necessary Firebase modules

### **✅ Created Files:**
- `firebaseConfig.ts` - Firebase initialization
- `services/authService.ts` - Authentication functions
- `services/firestoreService.ts` - Database operations

### **✅ Features Ready:**
- Google Sign-In
- Email/Password authentication
- Firestore database operations
- Real-time sync
- Offline support
- Role-based access control

---

## 🎯 Next Steps After Setup

Once you've completed Steps 2-6 above, you can:

1. **Test Authentication:**
   - Try Google Sign-In
   - Try Email/Password login
   - Create a test account

2. **Test Database:**
   - Add a test patient
   - View patient list
   - Edit patient details

3. **Deploy:**
   ```bash
   npm run build
   firebase deploy
   ```

---

## 🆘 Troubleshooting

### **Issue: Build fails with Firebase errors**
**Solution:** Make sure you've updated `firebaseConfig.ts` with your actual Firebase config values

### **Issue: "Permission denied" in Firestore**
**Solution:** Check that you've published the security rules in Step 5

### **Issue: Authentication not working**
**Solution:** Verify that you've enabled both Email/Password and Google sign-in methods in Step 3

### **Issue: Can't find college**
**Solution:** Make sure you've created the college document in Step 6

---

## 📚 Documentation Available

- `FIREBASE_SETUP_GUIDE.md` - Detailed setup instructions
- `IMPLEMENTATION_STEPS.md` - Complete implementation guide
- `DATABASE_SCHEMA.md` - Database structure documentation
- `FIREBASE_IMPLEMENTATION_SUMMARY.md` - Feature overview

---

## ✨ Summary

**What's Done:**
- ✅ Firebase SDK installed
- ✅ Service files created
- ✅ Documentation complete

**What You Need to Do:**
1. ⏳ Get Firebase config and update `firebaseConfig.ts`
2. ⏳ Enable Authentication (Email + Google)
3. ⏳ Enable Firestore Database
4. ⏳ Set Security Rules
5. ⏳ Create College document
6. ⏳ Test and deploy

**Estimated Time:** 10-15 minutes

---

**Ready to go! Follow Steps 2-6 and you'll have a fully functional Firebase-powered NeoLink! 🚀**
