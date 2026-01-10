/**
 * Password Utilities for Professional Authentication
 * Handles password generation, validation, and strength checking
 */

export interface PasswordStrength {
  score: number; // 0-4 (weak to strong)
  feedback: string;
  isValid: boolean;
}

/**
 * Generates a secure random password
 * @param length - Length of password (default: 12)
 * @param includeSpecialChars - Whether to include special characters
 */
export const generateSecurePassword = (
  length: number = 12,
  includeSpecialChars: boolean = true
): string => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let chars = lowercase + uppercase + numbers;
  if (includeSpecialChars) {
    chars += specialChars;
  }

  let password = '';

  // Ensure at least one character from each required set
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  if (includeSpecialChars) {
    password += specialChars[Math.floor(Math.random() * specialChars.length)];
  }

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
};

/**
 * Generates a simple alphanumeric password (no special characters)
 * Used for institution admins, doctors, and nurses
 * @param length - Length of password (default: 8)
 */
export const generateAlphanumericPassword = (length: number = 8): string => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';

  const chars = lowercase + uppercase + numbers;
  let password = '';

  // Ensure at least one of each type
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
};

/**
 * Validates password strength
 * @param password - Password to validate
 */
export const validatePasswordStrength = (password: string): PasswordStrength => {
  let score = 0;
  const feedback: string[] = [];

  // Minimum length check
  if (password.length < 8) {
    return {
      score: 0,
      feedback: 'Password must be at least 8 characters long',
      isValid: false
    };
  }

  // Length scoring
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;

  // Complexity checks
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password);

  if (hasLowercase && hasUppercase) score += 1;
  if (hasNumbers) score += 1;
  if (hasSpecialChars) score += 1;

  // Generate feedback
  if (!hasUppercase) feedback.push('Add uppercase letters');
  if (!hasLowercase) feedback.push('Add lowercase letters');
  if (!hasNumbers) feedback.push('Add numbers');
  if (!hasSpecialChars) feedback.push('Add special characters (!@#$%^&*)');

  // Determine overall feedback
  let finalFeedback = '';
  if (score === 0 || score === 1) {
    finalFeedback = 'Weak password. ' + feedback.join(', ');
  } else if (score === 2) {
    finalFeedback = 'Fair password. ' + (feedback.length > 0 ? feedback.join(', ') : 'Consider making it longer');
  } else if (score === 3) {
    finalFeedback = 'Good password. ' + (feedback.length > 0 ? feedback.join(', ') : 'Well done!');
  } else if (score >= 4) {
    finalFeedback = 'Strong password!';
  }

  return {
    score,
    feedback: finalFeedback,
    isValid: score >= 3 // Require at least "Good" password
  };
};

/**
 * Validates email format
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Password strength requirements for display
 */
export const PASSWORD_REQUIREMENTS = [
  'At least 8 characters long',
  'Contains uppercase letter (A-Z)',
  'Contains lowercase letter (a-z)',
  'Contains number (0-9)',
  'Contains special character (!@#$%^&*)',
];

/**
 * Get password strength color for UI
 */
export const getPasswordStrengthColor = (score: number): string => {
  if (score === 0 || score === 1) return 'red';
  if (score === 2) return 'orange';
  if (score === 3) return 'yellow';
  return 'green';
};

/**
 * Get password strength label
 */
export const getPasswordStrengthLabel = (score: number): string => {
  if (score === 0 || score === 1) return 'Weak';
  if (score === 2) return 'Fair';
  if (score === 3) return 'Good';
  return 'Strong';
};
