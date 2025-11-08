import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Firebase configuration for NeoLink PICU/NICU Medical Records System
const firebaseConfig = {
  apiKey: "AIzaSyC3K4ZXLpQmRX0sfngQlCESpLPk7dGNGnw",
  authDomain: "medilink-f2b56.firebaseapp.com",
  projectId: "medilink-f2b56",
  storageBucket: "medilink-f2b56.firebasestorage.app",
  messagingSenderId: "484787149271",
  appId: "1:484787149271:web:fa62d0b4740bb37fc99392",
  measurementId: "G-E2BG4Q4V1J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Analytics
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize Cloud Firestore
export const db = getFirestore(app);

// Enable offline persistence
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
      console.warn('The current browser does not support offline persistence');
    }
  });
}

export default app;
