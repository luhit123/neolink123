/**
 * Script to set up a Super Admin in the new Neolink database
 * Run with: npx ts-node --esm scripts/setupSuperAdmin.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin with default credentials
// You'll need to run this from Firebase Console instead

const SUPER_ADMIN_EMAIL = 'luhitdhungel6@gmail.com';

console.log(`
============================================
  SET UP SUPER ADMIN IN FIREBASE CONSOLE
============================================

Since this is a fresh database, the easiest way is to add the super admin directly in Firebase Console:

1. Go to: https://console.firebase.google.com/project/medilink-f2b56/firestore/databases/Neolink/data

2. Click "+ Start collection"

3. Collection ID: superAdmins

4. Click "Next"

5. Document ID: ${SUPER_ADMIN_EMAIL}

6. Add these fields:
   - Field: email       | Type: string  | Value: ${SUPER_ADMIN_EMAIL}
   - Field: name        | Type: string  | Value: Luhit Dhungel
   - Field: createdAt   | Type: string  | Value: ${new Date().toISOString()}
   - Field: enabled     | Type: boolean | Value: true

7. Click "Save"

============================================
  DONE! You are now a Super Admin.
============================================
`);
