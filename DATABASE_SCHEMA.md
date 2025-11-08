# 📊 NeoLink Firestore Database Schema

## 🏗️ Complete Database Architecture

This document provides a comprehensive overview of the Firestore database structure for NeoLink.

---

## 🎯 Schema Overview

```
firestore/
│
├── users/                          # User profiles and authentication data
│   └── {userId}/
│
└── colleges/                       # Medical colleges collection
    └── {collegeId}/
        ├── patients/               # Patients subcollection
        │   └── {patientId}/
        │       └── progressNotes/  # Progress notes subcollection
        │
        └── statistics/             # Cached statistics subcollection
            └── {period}/
```

---

## 📁 Collection: users/

### **Purpose:** Store user profiles, roles, and college associations

### **Document ID:** Firebase Auth UID (auto-generated)

### **Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | ✅ | User's email address |
| `displayName` | string | ✅ | User's full name |
| `role` | string | ✅ | User role: "Admin", "Doctor", or "Nurse" |
| `collegeName` | string | ✅ | Name of associated medical college |
| `collegeId` | string | ✅ | Reference to college document |
| `createdAt` | timestamp | ✅ | Account creation timestamp |
| `lastLogin` | timestamp | ✅ | Last login timestamp |

### **Example Document:**
```json
{
  "email": "dr.sharma@nalbari.edu",
  "displayName": "Dr. Rajesh Sharma",
  "role": "Doctor",
  "collegeName": "Nalbari Medical College and Hospital",
  "collegeId": "nalbari-medical-college",
  "createdAt": "2024-11-08T10:30:00Z",
  "lastLogin": "2024-11-08T14:15:00Z"
}
```

### **Security Rules:**
- ✅ Users can read all user profiles (for collaboration)
- ✅ Users can only write their own profile
- ✅ Authentication required

---

## 📁 Collection: colleges/

### **Purpose:** Store medical college information

### **Document ID:** Kebab-case college name (e.g., "nalbari-medical-college")

### **Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Full college name |
| `enabled` | boolean | ✅ | Whether college is active |
| `createdAt` | timestamp | ✅ | College registration date |
| `location` | map | ✅ | Location information |
| `location.district` | string | ✅ | District name |
| `location.state` | string | ✅ | State name |

### **Example Document:**
```json
{
  "name": "Nalbari Medical College and Hospital",
  "enabled": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "location": {
    "district": "Nalbari",
    "state": "Assam"
  }
}
```

### **Security Rules:**
- ✅ All authenticated users can read
- ✅ Only Admins can write

---

## 📁 Subcollection: colleges/{collegeId}/patients/

### **Purpose:** Store patient records for each college

### **Document ID:** Auto-generated unique ID

### **Fields:**

#### **Basic Information:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Patient ID (same as document ID) |
| `name` | string | ✅ | Patient's full name |
| `age` | number | ✅ | Patient's age |
| `ageUnit` | string | ✅ | "Days", "Months", or "Years" |
| `gender` | string | ✅ | "Male", "Female", or "Other" |
| `admissionDate` | timestamp | ✅ | Date and time of admission |
| `releaseDate` | timestamp | ❌ | Date and time of release/discharge |
| `diagnosis` | string | ✅ | Primary diagnosis |
| `outcome` | string | ✅ | "In Progress", "Discharged", "Referred", "Deceased", "Step Down" |
| `unit` | string | ✅ | "Neonatal Intensive Care Unit" or "Pediatric Intensive Care Unit" |

#### **NICU Specific (nicuSpecific map):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nicuSpecific.admissionType` | string | ❌ | "Inborn" or "Outborn" (NICU only) |
| `nicuSpecific.referringHospital` | string | ❌ | Name of referring hospital (Outborn only) |
| `nicuSpecific.referringDistrict` | string | ❌ | District of referring hospital (Outborn only) |

#### **Step Down Information (stepDownInfo map):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stepDownInfo.isStepDown` | boolean | ✅ | Currently in step down status |
| `stepDownInfo.stepDownDate` | timestamp | ❌ | When patient was stepped down |
| `stepDownInfo.stepDownFrom` | string | ❌ | "NICU" or "PICU" - origin unit |
| `stepDownInfo.readmissionFromStepDown` | boolean | ✅ | Was readmitted from step down |
| `stepDownInfo.readmissionDate` | timestamp | ❌ | When patient was readmitted |
| `stepDownInfo.readmissionReason` | string | ❌ | **Reason for readmission from step down** |
| `stepDownInfo.finalDischargeDate` | timestamp | ❌ | Final discharge from step down |

#### **Referral Information (referralInfo map):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `referralInfo.referredTo` | string | ❌ | Name of facility referred to |
| `referralInfo.referralReason` | string | ❌ | **Detailed reason for referral** |
| `referralInfo.referralDate` | timestamp | ❌ | When patient was referred |

#### **Metadata (metadata map):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `metadata.isDraft` | boolean | ✅ | Is this a draft (Nurse-created) |
| `metadata.createdBy` | string | ✅ | User ID who created record |
| `metadata.createdByRole` | string | ✅ | Role of creator |
| `metadata.createdAt` | timestamp | ✅ | Creation timestamp |
| `metadata.lastUpdatedBy` | string | ✅ | User ID who last updated |
| `metadata.lastUpdatedByRole` | string | ✅ | Role of last updater |
| `metadata.lastUpdatedAt` | timestamp | ✅ | Last update timestamp |

### **Example Patient Document:**
```json
{
  "id": "abc123xyz",
  "name": "Baby Kumar",
  "age": 15,
  "ageUnit": "Days",
  "gender": "Male",
  "admissionDate": "2024-11-01T08:30:00Z",
  "releaseDate": null,
  "diagnosis": "Respiratory Distress Syndrome",
  "outcome": "Step Down",
  "unit": "Neonatal Intensive Care Unit",
  
  "nicuSpecific": {
    "admissionType": "Inborn",
    "referringHospital": null,
    "referringDistrict": null
  },
  
  "stepDownInfo": {
    "isStepDown": true,
    "stepDownDate": "2024-11-05T10:00:00Z",
    "stepDownFrom": "Neonatal Intensive Care Unit",
    "readmissionFromStepDown": false,
    "readmissionDate": null,
    "readmissionReason": null,
    "finalDischargeDate": null
  },
  
  "referralInfo": {
    "referredTo": null,
    "referralReason": null,
    "referralDate": null
  },
  
  "metadata": {
    "isDraft": false,
    "createdBy": "user123",
    "createdByRole": "Doctor",
    "createdAt": "2024-11-01T08:30:00Z",
    "lastUpdatedBy": "user123",
    "lastUpdatedByRole": "Doctor",
    "lastUpdatedAt": "2024-11-05T10:00:00Z"
  }
}
```

### **Security Rules:**
- ✅ All authenticated users can read
- ✅ All authenticated users can create
- ✅ Admins and Doctors can update
- ✅ Only Admins can delete

---

## 📁 Subcollection: colleges/{collegeId}/patients/{patientId}/progressNotes/

### **Purpose:** Store clinical progress notes for each patient

### **Document ID:** Auto-generated unique ID

### **Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `note` | string | ✅ | Progress note content |
| `date` | timestamp | ✅ | When note was added |
| `addedBy` | string | ✅ | User ID who added note |
| `addedByName` | string | ✅ | Name of user who added note |
| `addedByRole` | string | ✅ | Role of user who added note |

### **Example Progress Note:**
```json
{
  "note": "Patient showing improvement in respiratory function. Oxygen saturation stable at 95%. Continue current treatment plan.",
  "date": "2024-11-03T14:30:00Z",
  "addedBy": "user123",
  "addedByName": "Dr. Rajesh Sharma",
  "addedByRole": "Doctor"
}
```

### **Security Rules:**
- ✅ All authenticated users can read
- ✅ Admins and Doctors can write

---

## 📁 Subcollection: colleges/{collegeId}/statistics/

### **Purpose:** Cache aggregated statistics for performance

### **Document ID:** Period identifier (e.g., "2024-11", "2024-Q4")

### **Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `totalAdmissions` | number | ✅ | Total admissions in period |
| `totalDischarges` | number | ✅ | Total discharges in period |
| `totalDeaths` | number | ✅ | Total deaths in period |
| `totalReferred` | number | ✅ | Total referrals in period |
| `totalStepDown` | number | ✅ | Total step downs in period |
| `nicuInborn` | number | ✅ | NICU inborn admissions |
| `nicuOutborn` | number | ✅ | NICU outborn admissions |
| `picuAdmissions` | number | ✅ | PICU admissions |
| `lastUpdated` | timestamp | ✅ | When statistics were last calculated |

### **Example Statistics Document:**
```json
{
  "totalAdmissions": 45,
  "totalDischarges": 32,
  "totalDeaths": 3,
  "totalReferred": 5,
  "totalStepDown": 8,
  "nicuInborn": 25,
  "nicuOutborn": 10,
  "picuAdmissions": 10,
  "lastUpdated": "2024-11-08T00:00:00Z"
}
```

### **Security Rules:**
- ✅ All authenticated users can read
- ✅ Only Admins can write

---

## 🔍 Query Patterns

### **Get all patients for a college:**
```typescript
const patientsRef = collection(db, 'colleges', collegeId, 'patients');
const snapshot = await getDocs(patientsRef);
```

### **Get NICU patients only:**
```typescript
const q = query(
  collection(db, 'colleges', collegeId, 'patients'),
  where('unit', '==', 'Neonatal Intensive Care Unit')
);
```

### **Get step down patients:**
```typescript
const q = query(
  collection(db, 'colleges', collegeId, 'patients'),
  where('stepDownInfo.isStepDown', '==', true)
);
```

### **Get patients readmitted from step down:**
```typescript
const q = query(
  collection(db, 'colleges', collegeId, 'patients'),
  where('stepDownInfo.readmissionFromStepDown', '==', true)
);
```

### **Get patients by date range:**
```typescript
const q = query(
  collection(db, 'colleges', collegeId, 'patients'),
  where('admissionDate', '>=', startDate),
  where('admissionDate', '<=', endDate),
  orderBy('admissionDate', 'desc')
);
```

### **Get referred patients:**
```typescript
const q = query(
  collection(db, 'colleges', collegeId, 'patients'),
  where('outcome', '==', 'Referred')
);
```

---

## 📈 Indexes Required

Firestore will automatically create single-field indexes. For composite queries, you may need to create these indexes:

### **Recommended Composite Indexes:**

1. **Unit + Admission Date:**
   - Collection: `patients`
   - Fields: `unit` (Ascending), `admissionDate` (Descending)

2. **Outcome + Admission Date:**
   - Collection: `patients`
   - Fields: `outcome` (Ascending), `admissionDate` (Descending)

3. **Step Down + Admission Date:**
   - Collection: `patients`
   - Fields: `stepDownInfo.isStepDown` (Ascending), `admissionDate` (Descending)

4. **Admission Type + Admission Date:**
   - Collection: `patients`
   - Fields: `nicuSpecific.admissionType` (Ascending), `admissionDate` (Descending)

**Note:** Firestore will prompt you to create these indexes when you first run the queries. Click the provided link to auto-create them.

---

## 🎯 Key Features of This Schema

### **1. Hierarchical Organization:**
- ✅ Clear parent-child relationships
- ✅ College-based data isolation
- ✅ Easy to add new colleges

### **2. Comprehensive Tracking:**
- ✅ **Step Down Journey:** Full tracking from ICU → Step Down → Discharge/Readmission
- ✅ **Readmission Tracking:** `readmissionFromStepDown` flag + `readmissionReason` field
- ✅ **Referral Details:** Complete referral information with reasons
- ✅ **Audit Trail:** Who created/updated and when

### **3. Performance Optimized:**
- ✅ Subcollections for related data
- ✅ Statistics caching
- ✅ Efficient querying with indexes

### **4. Security:**
- ✅ Role-based access control
- ✅ College-level data isolation
- ✅ Audit trail for accountability

### **5. Scalability:**
- ✅ Supports multiple colleges
- ✅ Handles large patient volumes
- ✅ Efficient data structure

---

## 💡 Best Practices

1. **Always use transactions** for critical updates
2. **Cache statistics** to reduce read operations
3. **Use batch writes** for multiple operations
4. **Enable offline persistence** for better UX
5. **Monitor Firestore usage** in Firebase Console
6. **Set up budget alerts** to avoid unexpected costs
7. **Regular backups** using Firestore export

---

## ✅ Schema Benefits

- 🏥 **Multi-college support** - Easy to scale
- 📊 **Comprehensive data** - Every detail tracked
- 🔒 **Secure** - Role-based permissions
- ⚡ **Fast** - Optimized queries
- 📱 **Real-time** - Instant updates
- 💾 **Reliable** - Automatic backups
- 🌐 **Offline** - Works without internet

---

This schema provides a solid foundation for NeoLink's data management needs while maintaining flexibility for future enhancements! 🚀
