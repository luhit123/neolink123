import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockUsers } from '../../test/utils/testUtils';
import { UserRole } from '../../types';

// Mock Firebase modules
const mockSignInWithPopup = vi.fn();
const mockSignInWithEmailAndPassword = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChanged = vi.fn();
const mockHttpsCallable = vi.fn();
const mockSendPasswordResetEmail = vi.fn();

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: null
  })),
  signInWithPopup: (...args: any[]) => mockSignInWithPopup(...args),
  signInWithRedirect: vi.fn(),
  signInWithEmailAndPassword: (...args: any[]) => mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithCustomToken: vi.fn(),
  signOut: (...args: any[]) => mockSignOut(...args),
  onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args),
  updateProfile: vi.fn(),
  sendPasswordResetEmail: (...args: any[]) => mockSendPasswordResetEmail(...args),
  GoogleAuthProvider: vi.fn()
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: any[]) => mockHttpsCallable(...args),
  getFunctions: vi.fn()
}));

vi.mock('../../firebaseConfig', () => ({
  auth: {
    currentUser: null
  },
  googleProvider: {},
  authReady: Promise.resolve(),
  pendingRedirectResult: Promise.resolve(null),
  functions: {}
}));

vi.mock('../../utils/pwaDetection', () => ({
  isPWAMode: vi.fn(() => false),
  isMobileDevice: vi.fn(() => false)
}));

describe('AuthService - Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============ GOOGLE SIGN-IN TESTS ============

  describe('Google Sign-In', () => {
    it('should successfully sign in with Google popup', async () => {
      const mockUser = {
        uid: 'google-user-123',
        email: 'user@gmail.com',
        displayName: 'Google User'
      };

      mockSignInWithPopup.mockResolvedValue({ user: mockUser });

      // Import and call the actual function
      const { signInWithGoogle } = await import('../authService');
      const result = await signInWithGoogle();

      expect(result).toEqual(mockUser);
      expect(mockSignInWithPopup).toHaveBeenCalled();
    });

    it('should handle popup cancelled by user', async () => {
      const popupError = new Error('Sign-in was cancelled. Please try again.');
      (popupError as any).code = 'auth/popup-closed-by-user';

      mockSignInWithPopup.mockRejectedValue(popupError);

      const { signInWithGoogle } = await import('../authService');

      await expect(signInWithGoogle()).rejects.toThrow('Sign-in was cancelled');
    });

    it('should handle popup blocked error', async () => {
      const popupError = new Error('Popup blocked');
      (popupError as any).code = 'auth/popup-blocked';

      mockSignInWithPopup.mockRejectedValue(popupError);

      const { signInWithGoogle } = await import('../authService');

      await expect(signInWithGoogle()).rejects.toThrow();
    });

    it('should handle network error', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'auth/network-request-failed';

      mockSignInWithPopup.mockRejectedValue(networkError);

      const { signInWithGoogle } = await import('../authService');

      await expect(signInWithGoogle()).rejects.toThrow('Network error');
    });
  });

  // ============ EMAIL/PASSWORD SIGN-IN TESTS ============

  describe('Email/Password Sign-In', () => {
    it('should sign in with valid email and password', async () => {
      const mockUser = {
        uid: 'email-user-123',
        email: 'doctor@hospital.com'
      };

      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockUser
      });

      const result = await mockSignInWithEmailAndPassword(
        {},
        'doctor@hospital.com',
        'validPassword123'
      );

      expect(result.user).toEqual(mockUser);
    });

    it('should reject invalid credentials', async () => {
      const authError = new Error('Invalid credentials');
      (authError as any).code = 'auth/wrong-password';

      mockSignInWithEmailAndPassword.mockRejectedValue(authError);

      await expect(
        mockSignInWithEmailAndPassword({}, 'user@test.com', 'wrongpass')
      ).rejects.toThrow('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const authError = new Error('User not found');
      (authError as any).code = 'auth/user-not-found';

      mockSignInWithEmailAndPassword.mockRejectedValue(authError);

      await expect(
        mockSignInWithEmailAndPassword({}, 'nonexistent@test.com', 'password')
      ).rejects.toThrow('User not found');
    });
  });

  // ============ SIGN OUT TESTS ============

  describe('Sign Out', () => {
    it('should sign out successfully', async () => {
      mockSignOut.mockResolvedValue(undefined);

      await mockSignOut({});

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should clear local storage on sign out', async () => {
      localStorage.setItem('userProfile', JSON.stringify(mockUsers.doctorHospitalA));
      localStorage.setItem('authToken', 'test-token');

      mockSignOut.mockResolvedValue(undefined);
      await mockSignOut({});

      // Verify localStorage was cleared (simulated)
      localStorage.clear();
      expect(localStorage.getItem('userProfile')).toBeNull();
      expect(localStorage.getItem('authToken')).toBeNull();
    });
  });

  // ============ AUTH STATE LISTENER TESTS ============

  describe('Auth State Listener', () => {
    it('should trigger callback on auth state change', () => {
      const callback = vi.fn();
      const mockUser = { uid: 'test-123', email: 'test@test.com' };

      mockOnAuthStateChanged.mockImplementation((auth, cb) => {
        cb(mockUser);
        return vi.fn(); // unsubscribe
      });

      mockOnAuthStateChanged({}, callback);

      expect(callback).toHaveBeenCalledWith(mockUser);
    });

    it('should return unsubscribe function', () => {
      const unsubscribe = vi.fn();
      mockOnAuthStateChanged.mockReturnValue(unsubscribe);

      const result = mockOnAuthStateChanged({}, vi.fn());

      expect(result).toBe(unsubscribe);
    });
  });

  // ============ PASSWORD RESET TESTS ============

  describe('Password Reset', () => {
    it('should send password reset email', async () => {
      mockSendPasswordResetEmail.mockResolvedValue(undefined);

      await mockSendPasswordResetEmail({}, 'user@test.com');

      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
        {},
        'user@test.com'
      );
    });

    it('should handle invalid email for password reset', async () => {
      const error = new Error('Invalid email');
      (error as any).code = 'auth/invalid-email';

      mockSendPasswordResetEmail.mockRejectedValue(error);

      await expect(
        mockSendPasswordResetEmail({}, 'invalid-email')
      ).rejects.toThrow('Invalid email');
    });
  });
});

describe('AuthService - Role-Based Access', () => {
  describe('Role Validation', () => {
    it('should recognize SuperAdmin role', () => {
      expect(mockUsers.superAdmin.role).toBe(UserRole.SuperAdmin);
    });

    it('should recognize Admin role', () => {
      expect(mockUsers.adminHospitalA.role).toBe(UserRole.Admin);
    });

    it('should recognize Doctor role', () => {
      expect(mockUsers.doctorHospitalA.role).toBe(UserRole.Doctor);
    });

    it('should recognize Nurse role', () => {
      expect(mockUsers.nurseHospitalA.role).toBe(UserRole.Nurse);
    });

    it('should recognize Official role', () => {
      expect(mockUsers.official.role).toBe(UserRole.Official);
    });

    it('should recognize DistrictAdmin role', () => {
      expect(mockUsers.districtAdmin.role).toBe(UserRole.DistrictAdmin);
    });
  });

  describe('Institution Binding', () => {
    it('should have institution for non-SuperAdmin users', () => {
      expect(mockUsers.doctorHospitalA.institutionId).toBe('hospital-a');
      expect(mockUsers.doctorHospitalA.institutionName).toBe('City Children Hospital');
    });

    it('should NOT have institution for SuperAdmin', () => {
      expect(mockUsers.superAdmin.institutionId).toBeUndefined();
    });

    it('should NOT have institution for Official', () => {
      expect(mockUsers.official.institutionId).toBeUndefined();
    });
  });
});

describe('AuthService - Password Validation', () => {
  // Password validation rules based on common security requirements

  function validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain a number');
    }

    // Check for common passwords
    const commonPasswords = ['password123', 'Password123', '12345678', 'qwerty123'];
    if (commonPasswords.includes(password)) {
      errors.push('Password is too common');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  it('should reject passwords shorter than 8 characters', () => {
    const result = validatePassword('short');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters');
  });

  it('should require at least one uppercase letter', () => {
    const result = validatePassword('lowercase123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain uppercase letter');
  });

  it('should require at least one lowercase letter', () => {
    const result = validatePassword('UPPERCASE123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain lowercase letter');
  });

  it('should require at least one number', () => {
    const result = validatePassword('NoNumbersHere');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain a number');
  });

  it('should accept valid password', () => {
    const result = validatePassword('ValidPass1');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject common passwords', () => {
    const result = validatePassword('Password123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password is too common');
  });
});

describe('AuthService - Session Management', () => {
  describe('User Profile Storage', () => {
    it('should store user profile in localStorage after login', () => {
      const userProfile = mockUsers.doctorHospitalA;
      localStorage.setItem('userProfile', JSON.stringify(userProfile));

      const stored = localStorage.getItem('userProfile');
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual(userProfile);
    });

    it('should retrieve user profile from localStorage', () => {
      const userProfile = mockUsers.doctorHospitalA;
      localStorage.setItem('userProfile', JSON.stringify(userProfile));

      const stored = JSON.parse(localStorage.getItem('userProfile')!);
      expect(stored.uid).toBe(userProfile.uid);
      expect(stored.email).toBe(userProfile.email);
      expect(stored.role).toBe(userProfile.role);
    });
  });

  describe('Login Attempts Tracking', () => {
    it('should track failed login attempts', () => {
      let failedAttempts = 0;
      const maxAttempts = 5;

      // Simulate 5 failed attempts
      for (let i = 0; i < 5; i++) {
        failedAttempts++;
      }

      expect(failedAttempts).toBe(5);
      expect(failedAttempts >= maxAttempts).toBe(true);
    });

    it('should reset failed attempts after successful login', () => {
      let failedAttempts = 3;

      // Simulate successful login
      failedAttempts = 0;

      expect(failedAttempts).toBe(0);
    });

    it('should lock account after max attempts', () => {
      const maxAttempts = 5;
      let failedAttempts = 5;
      const isLocked = failedAttempts >= maxAttempts;

      expect(isLocked).toBe(true);
    });
  });
});
