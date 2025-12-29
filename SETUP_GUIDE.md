# NeoLink PICU/NICU Multi-Institution Setup Guide

## 🚀 System Overview

This is a **multi-institutional medical records system** where:

- **SuperAdmin** can manage multiple institutions and assign institutional admins
- **Institutional Admins** can manage user access (add/remove doctors and nurses) for their specific institution
- **All patient data is isolated by institution** - users can only see their institution's data
- **Doctors and Nurses** can only access their assigned institution's patient records

---

## 📋 Step 1: Create SuperAdmin Account

### 1.1 Set SuperAdmin Email in Firebase

To create a SuperAdmin account, you need to manually add a user document in Firestore:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **medilink-f2b56**
3. Click **Firestore Database** in the left menu
4. Click **+ Start collection**
5. Collection ID: `users`
6. Click **Next**
7. Document ID: (Leave auto-generated or use your Firebase UID)
8. Add fields:
   - **email**: `your-superadmin-email@example.com` (string)
   - **displayName**: `Your Name` (string)
   - **role**: `SuperAdmin` (string)
   - **createdAt**: `2025-11-14T00:00:00.000Z` (string - use current date)
9. Click **Save**

### 1.2 Login as SuperAdmin

1. Visit: https://medilink-f2b56.web.app
2. Click **Sign in with Google**
3. Use the Google account that matches your SuperAdmin email
4. You should see the **SuperAdmin Dashboard** button

---

## 📋 Step 2: Add Institutions

Once logged in as SuperAdmin:

1. Click **SuperAdmin Dashboard** button
2. Click **Add New Institution**
3. Fill in the form:
   - **Institution Name**: e.g., "Nalbari Medical College & Hospital"
   - **Admin Email**: The email address of the person who will manage this institution
4. Click **Create Institution**

The admin email you specified will become the **Institutional Admin** for that institution.

---

## 📋 Step 3: Institutional Admin Access

### 3.1 Add the Admin to the Institution

After creating an institution, you need to add the admin to `institution_users` collection:

1. In Firebase Console → Firestore Database
2. Create or go to collection: `institution_users`
3. Click **+ Add document**
4. Add fields:
   - **uid**: (Leave empty for now - will be filled on first login)
   - **email**: `admin@institution.com` (lowercase)
   - **displayName**: `Admin Name`
   - **role**: `Admin`
   - **institutionId**: (Copy the ID from institutions collection)
   - **institutionName**: `Name of Institution`
   - **addedBy**: `your-superadmin-email@example.com`
   - **addedAt**: `2025-11-14T00:00:00.000Z`
   - **enabled**: `true` (boolean)
5. Click **Save**

### 3.2 Admin Login

1. Admin visits https://medilink-f2b56.web.app
2. Signs in with their Google account
3. They will see **Manage Users** button
4. They can now add Doctors and Nurses to their institution

---

## 📋 Step 4: Admin Adds Users (Doctors/Nurses)

Institutional Admins can add users directly from the app:

1. Login as Admin
2. Click **Manage Users** button
3. Click **Add New User**
4. Fill in the form:
   - **Email Address**: User's email
   - **Full Name**: User's full name
   - **Role**: Admin / Doctor / Nurse
5. Click **Add User**

Users can now login with their email and access the institution's patient data.

---

## 📋 Step 5: Add Patient Data

### 5.1 Patient Data Structure

All patient records must include:

- `institutionId`: The institution this patient belongs to
- `institutionName`: Name of the institution
- All other standard patient fields (name, age, diagnosis, etc.)

### 5.2 Adding Patients via UI

1. Login as Doctor or Admin
2. Select NICU or PICU unit
3. Click **+ Add Patient**
4. Fill in patient details
5. Click **Save Patient**

The patient will automatically be assigned to your institution.

---

## 🔒 Access Control Summary

| Role | Can Do |
|------|--------|
| **SuperAdmin** | • View all institutions<br>• Add new institutions<br>• Assign institutional admins<br>• Change admin emails<br>• Delete institutions |
| **Institutional Admin** | • Add/remove users (Doctors, Nurses, other Admins) for their institution<br>• Enable/disable user accounts<br>• Change user roles<br>• View and manage all patient data in their institution |
| **Doctor** | • View all patient records in their institution<br>• Add new patients<br>• Edit patient records<br>• Add progress notes<br>• Update outcomes |
| **Nurse** | • View patient records in their institution<br>• Add basic patient information (saved as draft)<br>• Add progress notes<br>• Limited editing capabilities |

---

## 📊 Data Isolation

**Important:** Each institution's data is completely isolated:

- Users can ONLY see patients from their assigned institution
- Patient records are filtered by `institutionId`
- SuperAdmin can see all institutions but not individual patient data (unless they're also assigned to an institution)

---

## 🔧 Firestore Collections Structure

```
/users
  /{uid}
    - email: string
    - displayName: string
    - role: "SuperAdmin"
    - createdAt: string
    - lastLoginAt: string

/institutions
  /{institutionId}
    - name: string
    - adminEmail: string
    - createdAt: string
    - createdBy: string (SuperAdmin email)

/institution_users
  /{docId}
    - uid: string (Firebase UID)
    - email: string
    - displayName: string
    - role: "Admin" | "Doctor" | "Nurse"
    - institutionId: string
    - institutionName: string
    - addedBy: string (email of who added)
    - addedAt: string
    - enabled: boolean

/patients
  /{patientId}
    - institutionId: string (REQUIRED - which institution this patient belongs to)
    - institutionName: string (REQUIRED - institution name for display)
    - name: string
    - age: number
    - ageUnit: "days" | "weeks" | "months" | "years"
    - gender: "Male" | "Female" | "Other"
    - unit: "Neonatal Intensive Care Unit" | "Pediatric Intensive Care Unit"
    - admissionDate: string (ISO)
    - releaseDate: string (ISO, optional)
    - diagnosis: string
    - outcome: "In Progress" | "Discharged" | "Referred" | "Deceased" | "Step Down"
    - progressNotes: array of {date: string, note: string}
    - admissionType: "Inborn" | "Outborn" (for NICU)
    - createdBy: string (user role)
    - createdByEmail: string
    - lastUpdatedBy: string (user role)
    - lastUpdatedByEmail: string
    - lastEditedAt: string (ISO)
    - ... (other patient-specific fields)
```

**Important:** All patient data is stored in Firestore in the `/patients` collection. Each patient record MUST have `institutionId` and `institutionName` fields for proper institution-based data isolation.

---

## 🚨 Security Rules

Current Firestore rules are in **DEVELOPMENT MODE** (allow all read/write).

**⚠️ IMPORTANT:** Before production, update `firestore.rules` to restrict access:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // SuperAdmin access to users collection
    match /users/{userId} {
      allow read, write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'SuperAdmin';
    }

    // SuperAdmin and institution admins can manage institutions
    match /institutions/{institutionId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'SuperAdmin';
    }

    // Users can read their own institution_users record
    // Admins can manage users in their institution
    match /institution_users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

---

## 📱 Application URL

**Production URL:** https://medilink-f2b56.web.app

---

## 🆘 Support

For issues or questions:
1. Check browser console for detailed error messages
2. Verify Firestore collections are set up correctly
3. Ensure user emails match exactly (case-sensitive)
4. Check that `enabled: true` for all users

---

## ✅ Quick Start Checklist

- [ ] Create SuperAdmin user in Firestore `users` collection
- [ ] Login as SuperAdmin
- [ ] Add first institution via SuperAdmin Dashboard
- [ ] Add institutional admin to `institution_users` collection
- [ ] Admin logs in and adds doctors/nurses
- [ ] Users login and start adding patient records

---

**System Version:** 2.0 - Multi-Institution Architecture
**Last Updated:** November 14, 2025
