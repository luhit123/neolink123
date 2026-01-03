import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

// Firebase configuration for NeoLink PICU/NICU Medical Records System
// Configuration is loaded from environment variables for security
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validate that all required environment variables are present
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingEnvVars = requiredEnvVars.filter(varName => !import.meta.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please create a .env file based on .env.example and add your Firebase credentials.');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true
});

// Analytics loaded lazily only if needed
let analytics: any = null;
export const getAnalyticsInstance = async () => {
  if (!analytics && typeof window !== 'undefined') {
    const { getAnalytics } = await import('firebase/analytics');
    analytics = getAnalytics(app);
  }
  return analytics;
};

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Export all Firebase services
export { app, db, auth, analytics };

// Disable offline persistence to avoid errors
// Can be re-enabled later if needed with proper multi-tab handling
// if (typeof window !== 'undefined') {
//   enableIndexedDbPersistence(db).catch((err) => {
//     if (err.code === 'failed-precondition') {
//       console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
//     } else if (err.code === 'unimplemented') {
//       console.warn('The current browser does not support offline persistence');
//     }
//   });
// }

export default app;
