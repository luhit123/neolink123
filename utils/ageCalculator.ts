import { AgeUnit } from '../types';

/**
 * Calculate age from birth date and return the appropriate age and unit
 * Automatically selects the most appropriate unit based on the duration
 */
export function calculateAgeFromBirthDate(dateOfBirth: string): {
  age: number;
  ageUnit: AgeUnit;
} {
  if (!dateOfBirth) {
    return { age: 0, ageUnit: AgeUnit.Days };
  }

  const birthDate = new Date(dateOfBirth);
  const now = new Date();

  // Calculate difference in milliseconds
  const diffMs = now.getTime() - birthDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Less than 7 days old -> use Days
  if (diffDays < 7) {
    return {
      age: diffDays,
      ageUnit: AgeUnit.Days
    };
  }

  // Less than 4 weeks old -> use Weeks
  if (diffDays < 28) {
    const weeks = Math.floor(diffDays / 7);
    return {
      age: weeks,
      ageUnit: AgeUnit.Weeks
    };
  }

  // Less than 24 months old -> use Months
  const diffMonths = (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth());
  if (diffMonths < 24) {
    return {
      age: diffMonths,
      ageUnit: AgeUnit.Months
    };
  }

  // 24 months or older -> use Years
  let years = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();

  // Adjust if birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    years--;
  }

  return {
    age: years,
    ageUnit: AgeUnit.Years
  };
}

/**
 * Calculate age at a specific date from birth date
 */
export function calculateAgeAtDate(dateOfBirth: string, targetDate: string): {
  age: number;
  ageUnit: AgeUnit;
} {
  if (!dateOfBirth || !targetDate) {
    return { age: 0, ageUnit: AgeUnit.Days };
  }

  const birthDate = new Date(dateOfBirth);
  const target = new Date(targetDate);

  // Calculate difference in milliseconds
  const diffMs = target.getTime() - birthDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Less than 7 days old -> use Days
  if (diffDays < 7) {
    return {
      age: diffDays,
      ageUnit: AgeUnit.Days
    };
  }

  // Less than 4 weeks old -> use Weeks
  if (diffDays < 28) {
    const weeks = Math.floor(diffDays / 7);
    return {
      age: weeks,
      ageUnit: AgeUnit.Weeks
    };
  }

  // Less than 24 months old -> use Months
  const diffMonths = (target.getFullYear() - birthDate.getFullYear()) * 12 + (target.getMonth() - birthDate.getMonth());
  if (diffMonths < 24) {
    return {
      age: diffMonths,
      ageUnit: AgeUnit.Months
    };
  }

  // 24 months or older -> use Years
  let years = target.getFullYear() - birthDate.getFullYear();
  const monthDiff = target.getMonth() - birthDate.getMonth();

  // Adjust if birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && target.getDate() < birthDate.getDate())) {
    years--;
  }

  return {
    age: years,
    ageUnit: AgeUnit.Years
  };
}

/**
 * Get formatted age display string from date of birth
 * Calculates current age dynamically
 */
export function getFormattedAge(dateOfBirth: string | undefined, fallbackAge?: number, fallbackUnit?: AgeUnit): string {
  // If we have date of birth, calculate current age dynamically
  if (dateOfBirth) {
    const { age, ageUnit } = calculateAgeFromBirthDate(dateOfBirth);
    return `${age} ${ageUnit}`;
  }

  // Fall back to stored age if no DOB
  if (fallbackAge !== undefined && fallbackUnit) {
    return `${fallbackAge} ${fallbackUnit}`;
  }

  return 'Unknown';
}

/**
 * Get age value and unit from date of birth or fallback
 * Returns current calculated age if DOB available
 */
export function getCurrentAge(dateOfBirth: string | undefined, fallbackAge?: number, fallbackUnit?: AgeUnit): { age: number; ageUnit: AgeUnit } {
  if (dateOfBirth) {
    return calculateAgeFromBirthDate(dateOfBirth);
  }

  return {
    age: fallbackAge || 0,
    ageUnit: fallbackUnit || AgeUnit.Days
  };
}
