# Referral System - Quick Integration Guide

## Overview
The referral system has been successfully merged with your existing institution system! Institutions (hospitals) can now refer patients to each other with AI-powered referral letters, real-time notifications, and status tracking.

## What Changed
- ✅ Removed separate "Hospital" model - now using existing "Institution" system
- ✅ Institutions in your database are the hospital network for referrals
- ✅ Updated all referral components to use institutions
- ✅ Referral form with searchable institution dropdown (prevents self-referral)
- ✅ AI-powered referral letter generation with Gemini
- ✅ Real-time notifications and status tracking

## Setup Steps

### 1. Add Gemini API Key

Add this to your `.env` file:
```bash
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

Get your free API key: https://makersuite.google.com/app/apikey

### 2. Add Firestore Security Rules

Add these rules to your Firestore:

```javascript
// Referrals collection
match /referrals/{referralId} {
  // Allow read if user belongs to either the sending or receiving institution
  allow read: if request.auth != null && (
    resource.data.fromInstitutionId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.institutionId ||
    resource.data.toInstitutionId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.institutionId
  );

  // Allow create if user is Doctor or Admin
  allow create: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['Doctor', 'Admin'];

  // Allow update if user is from receiving institution (for accept/reject/status updates)
  allow update: if request.auth != null &&
    resource.data.toInstitutionId == get(/databases/$(database)/documents/users/$(request.auth.uid)).data.institutionId;
}
```

### 3. Integration Code

#### A. Add Referral Button to Patient Card/Modal

In your `CollapsiblePatientCard.tsx` or wherever you show patient details:

```typescript
import { useState } from 'react';
import ReferralForm from './ReferralForm';

// Inside your component, add state:
const [showReferralForm, setShowReferralForm] = useState(false);

// Add referral button (only show for Doctors/Admins):
{canEdit && patient.outcome === 'In Progress' && (
  <button
    onClick={() => setShowReferralForm(true)}
    className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-all font-semibold"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
    Refer Patient
  </button>
)}

// Add the referral form modal:
{showReferralForm && (
  <ReferralForm
    patient={patient}
    currentInstitutionId={institutionId}
    currentInstitutionName={institutionName}
    userEmail={userEmail}
    userRole={userRole}
    userName={userName || 'Doctor'}
    onClose={() => setShowReferralForm(false)}
    onSuccess={() => {
      setShowReferralForm(false);
      // Optionally refresh data
    }}
  />
)}
```

#### B. Add Referral Inbox to Dashboard Header

In your `Dashboard.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import ReferralInbox from './ReferralInbox';

// Add state:
const [showReferralInbox, setShowReferralInbox] = useState(false);
const [unreadReferrals, setUnreadReferrals] = useState(0);

// Add real-time unread count listener:
useEffect(() => {
  if (!institutionId) return;

  const q = query(
    collection(db, 'referrals'),
    where('toInstitutionId', '==', institutionId),
    where('isRead', '==', false),
    where('status', '==', 'Pending')
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    setUnreadReferrals(snapshot.size);
  });

  return () => unsubscribe();
}, [institutionId]);

// Add button in your header/navigation:
<button
  onClick={() => setShowReferralInbox(true)}
  className="relative flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg transition-all font-semibold"
>
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
  Referrals
  {unreadReferrals > 0 && (
    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
      {unreadReferrals}
    </span>
  )}
</button>

// Add the inbox modal:
{showReferralInbox && (
  <ReferralInbox
    institutionId={institutionId}
    institutionName={institutionName}
    userEmail={userEmail}
    userRole={userRole}
    userName={userName || 'User'}
    onBack={() => setShowReferralInbox(false)}
  />
)}
```

## Complete Workflow

### Referring Institution (Hospital A):
1. Doctor opens patient details
2. Clicks "Refer Patient" button
3. Searches and selects receiving institution
4. Fills in:
   - Reason for referral
   - Diagnosis at referral
   - Patient condition
   - Vital signs
   - Treatments provided
   - Priority level
5. Clicks "Create Referral"
6. AI generates professional referral letter
7. Receiving institution gets real-time notification

### Receiving Institution (Hospital B):
1. Sees notification badge on "Referrals" button
2. Opens Referral Inbox
3. Views incoming referral with full details
4. Sees AI-generated referral letter
5. Can Accept or Reject
6. If accepted, can update patient status
7. Referring institution sees updates in real-time

## Key Features

✅ **Smart Institution Search**: Dropdown with search by name, district, or type
✅ **Prevents Self-Referral**: Can't refer to same institution
✅ **AI-Generated Letters**: Professional referral letters via Gemini
✅ **Real-time Notifications**: Unread count badge
✅ **Status Tracking**: Full history of referral progress
✅ **Priority Levels**: Low, Medium, High, Critical
✅ **Vital Signs**: Record vitals at referral and during updates
✅ **Complete Audit Trail**: Track who did what and when

## Component Props Reference

### ReferralForm
```typescript
{
  patient: Patient,
  currentInstitutionId: string,
  currentInstitutionName: string,
  userEmail: string,
  userRole: UserRole,
  userName: string,
  onClose: () => void,
  onSuccess: () => void
}
```

### ReferralInbox
```typescript
{
  institutionId: string,
  institutionName: string,
  userEmail: string,
  userRole: UserRole,
  userName: string,
  onBack: () => void
}
```

## Files Created/Modified

### New Files:
- `utils/geminiService.ts` - AI letter generation
- `components/ReferralForm.tsx` - Create referrals
- `components/ReferralInbox.tsx` - View incoming/outgoing referrals
- `components/ReferralStatusUpdate.tsx` - Update patient status

### Modified Files:
- `types.ts` - Added Referral interfaces
- `components/SuperAdminDashboard.tsx` - Removed Hospital Network tab (institutions serve this purpose)

### Deleted Files:
- `components/HospitalManagement.tsx` - No longer needed (use existing institution management)

## Troubleshooting

**Q: Dropdown is empty when creating referral**
A: Make sure you have institutions created in SuperAdmin → Manage Institutions

**Q: Gemini API error**
A: Check that `VITE_GEMINI_API_KEY` is in your `.env` file and restart dev server

**Q: Permission denied in Firestore**
A: Update your Firestore security rules as shown in Step 2 above

**Q: Can't refer to other institutions**
A: Make sure institutions have facilities configured in SuperAdmin

## Next Steps

1. ✅ Add VITE_GEMINI_API_KEY to .env
2. ✅ Update Firestore rules
3. ✅ Add referral button to patient cards
4. ✅ Add referral inbox button to dashboard
5. ✅ Test complete workflow
6. ✅ Train staff on using the system

## Support

Existing institutions in your system are now part of the referral network. No data migration needed - just integrate the buttons and you're ready to go!

---

**Congratulations!** You have a world-class patient referral system integrated with your existing infrastructure. 🎉
