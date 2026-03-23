import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence, getRedirectResult, UserCredential } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

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
  // Always show this error — missing Firebase config is a hard failure
  throw new Error(
    `Missing required Firebase environment variables: ${missingEnvVars.join(', ')}. ` +
    'Create a .env file based on .env.example and add your Firebase credentials.'
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Use the named database "neolink" (asia-south1 Mumbai)
// Your data lives in this database - do not use the default database
// Using the NEW persistence API (not the deprecated enableMultiTabIndexedDbPersistence)
const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  // Modern persistence API - replaces deprecated enableMultiTabIndexedDbPersistence
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, 'neolink');

// CRITICAL FIX: Set persistence FIRST, then check redirect result
// The order matters - persistence must be configured before getRedirectResult
// so Firebase can properly retrieve the stored auth state from the redirect
export const authReady: Promise<void> = (async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
    if (import.meta.env.DEV) console.log('✅ Auth persistence set to localStorage');
  } catch (error) {
    if (import.meta.env.DEV) console.warn('⚠️ Failed to set auth persistence:', error);
    // Continue anyway - Firebase will use default persistence
  }
})();

// Check for redirect result AFTER persistence is ready
export const pendingRedirectResult: Promise<UserCredential | null> = authReady
  .then(() => getRedirectResult(auth))
  .then((result) => {
    if (import.meta.env.DEV) {
      if (result?.user) console.log('✅ Redirect result found:', result.user.email);
      else console.log('ℹ️ No pending redirect result');
    }
    return result;
  })
  .catch((error: Error & { code?: string }) => {
    console.error('❌ Error getting redirect result:', (error as { code?: string }).code, error.message);
    throw error;
  });

// Analytics loaded lazily only if needed
import type { Analytics } from 'firebase/analytics';
let analytics: Analytics | null = null;
export const getAnalyticsInstance = async (): Promise<Analytics | null> => {
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

// Ensure redirect works for both browser and PWA mode
// Firebase handles redirect URIs automatically, but you should verify
// in Firebase Console > Authentication > Settings > Authorized domains
// that your domain (including localhost for testing) is listed

// Initialize Firebase Functions
// Functions are deployed to asia-southeast1 (Singapore) to match database region
const functions = getFunctions(app, 'asia-southeast1');

// For local development, connect to Functions emulator
// Uncomment the line below when running `firebase emulators:start`
// connectFunctionsEmulator(functions, 'localhost', 5001);

// Export all Firebase services
export { app, db, auth, functions };
// analytics is exported via getAnalyticsInstance to avoid eager loading

export default app;
