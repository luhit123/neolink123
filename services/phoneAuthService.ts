import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  PhoneAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';

let recaptchaVerifier: RecaptchaVerifier | null = null;
let confirmationResult: ConfirmationResult | null = null;

// Initialize reCAPTCHA verifier
export const initializeRecaptcha = (elementId: string): RecaptchaVerifier => {
  // Clear existing verifier if any
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
  }

  recaptchaVerifier = new RecaptchaVerifier(auth, elementId, {
    size: 'invisible',
    callback: () => {
      console.log('✅ reCAPTCHA verified');
    },
    'expired-callback': () => {
      console.warn('⚠️ reCAPTCHA expired');
    }
  });

  return recaptchaVerifier;
};

// Send OTP to phone number
export const sendOTP = async (phoneNumber: string): Promise<ConfirmationResult> => {
  try {
    if (!recaptchaVerifier) {
      throw new Error('reCAPTCHA verifier not initialized. Call initializeRecaptcha first.');
    }

    console.log('📱 Sending OTP to:', phoneNumber);

    const result = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    confirmationResult = result;

    console.log('✅ OTP sent successfully');
    return result;
  } catch (error: any) {
    console.error('❌ Error sending OTP:', error);

    // Reset reCAPTCHA on error
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }

    let errorMessage = 'Failed to send OTP';

    switch (error.code) {
      case 'auth/invalid-app-credential':
        errorMessage = 'Phone Authentication not configured. Please enable Phone Auth in Firebase Console: Authentication → Sign-in method → Phone.';
        break;
      case 'auth/invalid-phone-number':
        errorMessage = 'Invalid phone number format. Please use international format (e.g., +91 1234567890)';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many attempts. Please try again later.';
        break;
      case 'auth/quota-exceeded':
        errorMessage = 'SMS quota exceeded. Please try again later.';
        break;
      case 'auth/captcha-check-failed':
        errorMessage = 'reCAPTCHA verification failed. Please try again.';
        break;
      default:
        errorMessage = error.message || 'Failed to send OTP';
    }

    throw new Error(errorMessage);
  }
};

// Verify OTP and sign in
export const verifyOTP = async (otp: string) => {
  try {
    if (!confirmationResult) {
      throw new Error('No OTP was sent. Please request an OTP first.');
    }

    console.log('🔐 Verifying OTP...');

    const result = await confirmationResult.confirm(otp);

    console.log('✅ OTP verified, user signed in:', result.user.phoneNumber);
    return result.user;
  } catch (error: any) {
    console.error('❌ Error verifying OTP:', error);

    let errorMessage = 'Failed to verify OTP';

    switch (error.code) {
      case 'auth/invalid-verification-code':
        errorMessage = 'Invalid OTP. Please check and try again.';
        break;
      case 'auth/code-expired':
        errorMessage = 'OTP has expired. Please request a new one.';
        break;
      default:
        errorMessage = error.message || 'Failed to verify OTP';
    }

    throw new Error(errorMessage);
  }
};

// Find user's phone number by UserID
export const findPhoneByUserID = async (userID: string): Promise<string> => {
  try {
    // Import here to avoid circular dependency
    const approvedUsersRef = collection(db, 'approved_users');
    const userQuery = query(approvedUsersRef, where('userID', '==', userID));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      throw new Error('UserID not found');
    }

    const userData = userSnapshot.docs[0].data();

    if (!userData.phoneNumber) {
      throw new Error('No phone number registered for this UserID. Please contact your administrator.');
    }

    return userData.phoneNumber;
  } catch (error: any) {
    console.error('Error finding phone by UserID:', error);
    throw error;
  }
};

// Sign in with UserID and OTP (lookup phone number first)
export const signInWithUserIDAndOTP = async (userID: string) => {
  try {
    // Find phone number for this UserID
    const phoneNumber = await findPhoneByUserID(userID);

    // Send OTP to the phone number
    const confirmationResult = await sendOTP(phoneNumber);

    return {
      phoneNumber,
      confirmationResult
    };
  } catch (error: any) {
    console.error('Error signing in with UserID and OTP:', error);
    throw error;
  }
};

// Cleanup reCAPTCHA
export const cleanupRecaptcha = () => {
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
  confirmationResult = null;
};
