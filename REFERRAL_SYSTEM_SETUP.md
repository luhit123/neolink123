# Referral System Setup Guide

## Overview
A world-class patient referral system with AI-powered referral letter generation, real-time notifications, and comprehensive status tracking has been successfully implemented in your medical records application.

## Features Implemented

### 1. Hospital Management (SuperAdmin)
- Add, edit, and manage hospitals in the referral network
- Search hospitals by name, district, or state
- Configure hospital facilities and bed capacity
- Activate/deactivate hospitals
- **Access**: SuperAdmin Dashboard → Hospital Network tab

### 2. Referral Creation
- Select receiving hospital from searchable dropdown
- Prevents self-referral (hospital cannot refer to itself)
- Comprehensive referral form with:
  - Reason for referral
  - Diagnosis at referral
  - Patient condition
  - Vital signs
  - Treatments provided
  - Investigations performed
  - Priority levels (Low, Medium, High, Critical)
- **AI-powered referral letter generation using Google Gemini**

### 3. Referral Notifications & Inbox
- Real-time incoming referral notifications
- Separate tabs for incoming and outgoing referrals
- Unread count badge
- View detailed referral information
- Accept or reject referrals
- Auto-generated professional referral letters

### 4. Status Tracking
- Real-time status updates visible to both hospitals
- Status options:
  - Pending
  - Accepted
  - Rejected
  - Patient Admitted
  - Patient Discharged
  - Patient Deceased
- Comprehensive status history
- Condition updates with vital signs
- Additional notes for each update

## Setup Instructions

### Step 1: Configure Gemini API Key

1. **Get your Gemini API key**:
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Sign in with your Google account
   - Click "Get API Key" or "Create API Key"
   - Copy the generated API key

2. **Add to your .env file**:
   ```bash
   # Add this line to your .env file
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Restart your development server** after adding the API key

### Step 2: Initialize Firestore Collections

The referral system uses two main Firestore collections:

1. **`hospitals`** - Stores hospital information
   - Structure: See `Hospital` interface in `types.ts`
   - Managed through SuperAdmin → Hospital Network

2. **`referrals`** - Stores all patient referrals
   - Structure: See `Referral` interface in `types.ts`
   - Auto-created when first referral is made

### Step 3: Firestore Security Rules

Add these security rules to your Firestore:

```javascript
// Hospitals collection
match /hospitals/{hospitalId} {
  // SuperAdmins can read/write
  allow read, write: if request.auth != null &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'SuperAdmin';

  // All authenticated users can read active hospitals (for referral dropdown)
  allow read: if request.auth != null && resource.data.isActive == true;
}

// Referrals collection
match /referrals/{referralId} {
  // Allow read if user belongs to either the sending or receiving hospital
  allow read: if request.auth != null && (
    resource.data.fromHospitalId == request.auth.token.institutionId ||
    resource.data.toHospitalId == request.auth.token.institutionId
  );

  // Allow create if user is from the sending hospital and is a Doctor
  allow create: if request.auth != null &&
    request.resource.data.fromHospitalId == request.auth.token.institutionId &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['Doctor', 'Admin'];

  // Allow update if user is from receiving hospital (for accept/reject/status updates)
  allow update: if request.auth != null &&
    resource.data.toHospitalId == request.auth.token.institutionId;
}
```

### Step 4: Integration into Your Application

You need to integrate the referral components into your main application. Here's how:

#### A. Add Referral Button to Patient Details

In your patient detail modal or patient card component:

```typescript
import ReferralForm from './components/ReferralForm';

// Add state
const [showReferralForm, setShowReferralForm] = useState(false);

// Add button (only for Doctors/Admins)
{userRole === UserRole.Doctor || userRole === UserRole.Admin && (
  <button
    onClick={() => setShowReferralForm(true)}
    className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg"
  >
    Refer Patient
  </button>
)}

// Add modal
{showReferralForm && (
  <ReferralForm
    patient={selectedPatient}
    currentHospitalId={institutionId}
    currentHospitalName={institutionName}
    userEmail={userEmail}
    userRole={userRole}
    userName={userName}
    onClose={() => setShowReferralForm(false)}
    onSuccess={() => {
      // Refresh data if needed
      setShowReferralForm(false);
    }}
  />
)}
```

#### B. Add Referral Inbox to Dashboard

In your main Dashboard component:

```typescript
import ReferralInbox from './components/ReferralInbox';

// Add state
const [showReferralInbox, setShowReferralInbox] = useState(false);
const [unreadReferrals, setUnreadReferrals] = useState(0);

// Add listener for unread count (optional)
useEffect(() => {
  const q = query(
    collection(db, 'referrals'),
    where('toHospitalId', '==', institutionId),
    where('isRead', '==', false),
    where('status', '==', 'Pending')
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    setUnreadReferrals(snapshot.size);
  });

  return () => unsubscribe();
}, [institutionId]);

// Add button to header/navigation
<button
  onClick={() => setShowReferralInbox(true)}
  className="relative px-4 py-2 bg-sky-600 text-white rounded-lg"
>
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
  Referrals
  {unreadReferrals > 0 && (
    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
      {unreadReferrals}
    </span>
  )}
</button>

// Add inbox modal
{showReferralInbox && (
  <ReferralInbox
    institutionId={institutionId}
    institutionName={institutionName}
    userEmail={userEmail}
    userRole={userRole}
    userName={userName}
    onBack={() => setShowReferralInbox(false)}
  />
)}
```

#### C. SuperAdmin Hospital Management

The Hospital Management is already integrated into the SuperAdmin Dashboard under the "Hospital Network" tab. No additional steps needed.

## Usage Workflow

### For Referring Hospital:
1. Open patient details
2. Click "Refer Patient" button
3. Search and select receiving hospital
4. Fill in referral details
5. Click "Create Referral"
6. AI generates professional referral letter automatically
7. Receiving hospital is notified immediately

### For Receiving Hospital:
1. Click "Referrals" button in dashboard (shows unread count)
2. View incoming referrals
3. Click "View Details" to see full referral letter
4. Accept or Reject the referral
5. If accepted, update patient status as they progress
6. Referring hospital sees all updates in real-time

### For SuperAdmin:
1. Go to SuperAdmin Dashboard → Hospital Network
2. Add hospitals to the referral network
3. Configure facilities and bed capacity
4. Activate/deactivate hospitals as needed

## Troubleshooting

### Gemini API Errors

**Error**: "Gemini API key is not configured"
- **Solution**: Make sure you added `VITE_GEMINI_API_KEY` to your `.env` file and restarted the dev server

**Error**: "Gemini API request failed: 429"
- **Solution**: You've hit the API rate limit. Wait a few moments or upgrade your Gemini API quota

**Error**: "Gemini API request failed: 403"
- **Solution**: Your API key is invalid. Generate a new one from Google AI Studio

### Firestore Permission Errors

**Error**: "Missing or insufficient permissions"
- **Solution**: Update your Firestore security rules as shown in Step 3 above

### No Hospitals in Dropdown

- **Issue**: Dropdown is empty when creating referral
- **Solution**:
  1. Make sure SuperAdmin has added hospitals in Hospital Network tab
  2. Ensure hospitals are marked as "Active"
  3. Check that you're not trying to refer to your own hospital (self-referral is blocked)

## API Costs

### Google Gemini API Pricing (as of 2024):
- **Free tier**: 60 requests per minute
- **Paid tier**: Very affordable ($0.00025 per 1K characters)
- Each referral letter generation costs approximately $0.001-0.005

**Recommendation**: Start with the free tier. For a hospital generating 100 referrals/month, the cost would be less than $1/month on paid tier.

## File Structure

```
components/
├── HospitalManagement.tsx        # SuperAdmin hospital management
├── ReferralForm.tsx               # Create new referrals
├── ReferralInbox.tsx              # View incoming/outgoing referrals
└── ReferralStatusUpdate.tsx       # Update referral status

utils/
└── geminiService.ts               # AI letter generation service

types.ts                           # Hospital, Referral interfaces
```

## Next Steps

1. ✅ Add `VITE_GEMINI_API_KEY` to your `.env` file
2. ✅ Update Firestore security rules
3. ✅ Integrate referral components into your Dashboard
4. ✅ Test the complete workflow
5. ✅ Train your staff on using the referral system

## Support

For issues or questions:
- Check Firestore console for data
- Check browser console for errors
- Verify Gemini API key is correct
- Ensure all imports are correct in your components

---

**Congratulations!** You now have a world-class patient referral system with AI-powered letter generation, real-time notifications, and comprehensive tracking. 🎉
