# 🔥 Firestore Database Setup Required

## Problem
Your app is showing **400 Bad Request** errors because the Firestore database hasn't been created in your Firebase project yet.

## Solution: Create Firestore Database

Follow these steps to set up your Firestore database:

### Step 1: Go to Firebase Console
1. Open your browser and go to: **https://console.firebase.google.com/**
2. Sign in with your Google account

### Step 2: Select Your Project
1. Click on your project: **`medilink-f2b56`**
2. You'll be taken to the project dashboard

### Step 3: Create Firestore Database
1. In the left sidebar, click **"Build"** to expand the menu
2. Click **"Firestore Database"**
3. Click the **"Create database"** button

### Step 4: Choose Security Rules
You'll see two options:

#### Option A: Test Mode (Recommended for Development)
- **Select**: "Start in test mode"
- This allows read/write access for 30 days
- **Best for**: Development and testing
- **Security**: ⚠️ Anyone can read/write your data (temporary)

#### Option B: Production Mode
- **Select**: "Start in production mode"
- Uses the security rules from your `firestore.rules` file
- **Best for**: Production deployment
- **Security**: ✅ Uses your configured rules

**For now, choose Test Mode** since you're developing.

### Step 5: Select Location
1. Choose a Firestore location closest to your users
   - For India: `asia-south1` (Mumbai)
   - For US: `us-central1`
   - For Europe: `europe-west1`
2. ⚠️ **Important**: You cannot change this location later!
3. Click **"Enable"**

### Step 6: Wait for Database Creation
- The database will be created in 1-2 minutes
- You'll see a success message when done

### Step 7: Verify the Database
1. You should now see the Firestore console
2. It will be empty initially (no collections)
3. Collections will be created automatically when your app runs

---

## After Setup: Test Your App

1. **Refresh your app** in the browser (hard refresh: Cmd+Shift+R on Mac, Ctrl+Shift+F5 on Windows)
2. The errors should be gone
3. Try logging in with Google
4. Check the Firestore console - you should see a `users` collection created

---

## Security Rules (Already Configured)

Your `firestore.rules` file is already set to allow all reads/writes for development:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

⚠️ **Before going to production**, update these rules to restrict access based on user authentication and roles.

---

## Troubleshooting

### Still Getting 400 Errors?
1. **Clear browser cache** and reload
2. **Check Firebase Console** - ensure database is "Active"
3. **Verify project ID** matches: `medilink-f2b56`
4. **Check browser console** for detailed error messages

### Database Not Showing Up?
- Wait a few minutes - database creation can take time
- Refresh the Firebase Console page
- Ensure you're in the correct project

---

## Need Help?

If you continue to have issues:
1. Check the browser console (F12) for detailed error messages
2. Verify your Firebase configuration in `firebaseConfig.ts`
3. Ensure you have the correct permissions on the Firebase project
