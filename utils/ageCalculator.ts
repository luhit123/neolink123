import { AgeUnit, Unit } from '../types';

/**
 * Calculate age from birth date and time - ALWAYS returns age in DAYS
 * @param dateOfBirth - ISO string of birth date and time
 * @param forceUnit - Ignored, always returns days
 */
export function calculateAgeFromBirthDate(dateOfBirth: string, forceUnit?: AgeUnit): {
  age: number;
  ageUnit: AgeUnit;
} {
  if (!dateOfBirth) {
    return { age: 0, ageUnit: AgeUnit.Days };
  }

  const birthDate = new Date(dateOfBirth);
  const now = new Date();

  // Calculate difference in milliseconds (includes time component)
  const diffMs = now.getTime() - birthDate.getTime();

  // Calculate days - floor to get completed days
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Always return age in days
  return {
    age: Math.max(0, diffDays), // Ensure non-negative
    ageUnit: AgeUnit.Days
  };
}

/**
 * Calculate age in days from birth date - specifically for NICU/SNCU
 */
export function calculateAgeInDays(dateOfBirth: string): number {
  if (!dateOfBirth) return 0;

  const birthDate = new Date(dateOfBirth);
  const now = new Date();
  const diffMs = now.getTime() - birthDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determine if age should always be shown in days based on unit type
 */
export function shouldUseAgeInDays(unit: Unit): boolean {
  return unit === Unit.NICU || unit === Unit.SNCU;
}

/**
 * Calculate age at a specific date from birth date - ALWAYS returns age in DAYS
 * @param dateOfBirth - ISO string of birth date and time
 * @param targetDate - ISO string of target date and time
 * @param forceUnit - Ignored, always returns days
 */
export function calculateAgeAtDate(dateOfBirth: string, targetDate: string, forceUnit?: AgeUnit): {
  age: number;
  ageUnit: AgeUnit;
} {
  if (!dateOfBirth || !targetDate) {
    return { age: 0, ageUnit: AgeUnit.Days };
  }

  const birthDate = new Date(dateOfBirth);
  const target = new Date(targetDate);

  // Calculate difference in milliseconds (includes time component)
  const diffMs = target.getTime() - birthDate.getTime();

  // Calculate days - floor to get completed days
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Always return age in days
  return {
    age: Math.max(0, diffDays), // Ensure non-negative
    ageUnit: AgeUnit.Days
  };
}

/**
 * Get formatted age display string from date of birth
 * Calculates current age dynamically - ALWAYS in DAYS
 */
export function getFormattedAge(dateOfBirth: string | undefined, fallbackAge?: number, fallbackUnit?: AgeUnit): string {
  // If we have date of birth, calculate current age dynamically in days
  if (dateOfBirth) {
    const { age } = calculateAgeFromBirthDate(dateOfBirth);
    return `${age} Days`;
  }

  // Fall back to stored age if no DOB - convert to days if possible
  if (fallbackAge !== undefined && fallbackUnit) {
    // Convert to days for consistency
    let ageInDays = fallbackAge;
    if (fallbackUnit === AgeUnit.Weeks) {
      ageInDays = fallbackAge * 7;
    } else if (fallbackUnit === AgeUnit.Months) {
      ageInDays = fallbackAge * 30; // Approximate
    } else if (fallbackUnit === AgeUnit.Years) {
      ageInDays = fallbackAge * 365; // Approximate
    }
    return `${ageInDays} Days`;
  }

  return 'Unknown';
}

/**
 * Get age value and unit from date of birth or fallback
 * Returns current calculated age - ALWAYS in DAYS
 */
export function getCurrentAge(dateOfBirth: string | undefined, fallbackAge?: number, fallbackUnit?: AgeUnit): { age: number; ageUnit: AgeUnit } {
  if (dateOfBirth) {
    return calculateAgeFromBirthDate(dateOfBirth);
  }

  // Convert fallback to days for consistency
  let ageInDays = fallbackAge || 0;
  if (fallbackUnit === AgeUnit.Weeks) {
    ageInDays = (fallbackAge || 0) * 7;
  } else if (fallbackUnit === AgeUnit.Months) {
    ageInDays = (fallbackAge || 0) * 30; // Approximate
  } else if (fallbackUnit === AgeUnit.Years) {
    ageInDays = (fallbackAge || 0) * 365; // Approximate
  }

  return {
    age: ageInDays,
    ageUnit: AgeUnit.Days
  };
}

/**
 * Calculate Expected Date of Delivery (EDD) from Last Menstrual Period (LMP)
 * Using Naegele's Rule: LMP + 280 days (40 weeks)
 * Adjusted for cycle length if different from 28 days
 */
export function calculateEDDFromLMP(lmp: string, cycleLength: number = 28): string {
  if (!lmp) return '';

  const lmpDate = new Date(lmp);
  // Standard: LMP + 280 days, adjusted for cycle length
  // Formula: LMP + 280 + (cycleLength - 28)
  const daysToAdd = 280 + (cycleLength - 28);
  const eddDate = new Date(lmpDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

  return eddDate.toISOString();
}

/**
 * Calculate Gestational Age at a given date from LMP
 * Returns weeks and days (standard obstetric format)
 */
export function calculateGestationalAge(lmp: string, targetDate: string): {
  weeks: number;
  days: number;
  totalDays: number;
  category: 'Extremely Preterm' | 'Very Preterm' | 'Moderate to Late Preterm' | 'Early Term' | 'Full Term' | 'Late Term' | 'Post Term';
  displayString: string;
} {
  if (!lmp || !targetDate) {
    return { weeks: 0, days: 0, totalDays: 0, category: 'Full Term', displayString: 'Unknown' };
  }

  const lmpDate = new Date(lmp);
  const target = new Date(targetDate);

  // Calculate difference in days
  const diffMs = target.getTime() - lmpDate.getTime();
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Calculate completed weeks and remaining days
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;

  // Determine gestational age category based on WHO classification
  let category: 'Extremely Preterm' | 'Very Preterm' | 'Moderate to Late Preterm' | 'Early Term' | 'Full Term' | 'Late Term' | 'Post Term';

  if (weeks < 28) {
    category = 'Extremely Preterm';
  } else if (weeks < 32) {
    category = 'Very Preterm';
  } else if (weeks < 37) {
    category = 'Moderate to Late Preterm';
  } else if (weeks < 39) {
    category = 'Early Term';
  } else if (weeks < 41) {
    category = 'Full Term';
  } else if (weeks < 42) {
    category = 'Late Term';
  } else {
    category = 'Post Term';
  }

  const displayString = `${weeks} weeks ${days} days`;

  return { weeks, days, totalDays, category, displayString };
}

/**
 * Get gestational age category color for UI display
 */
export function getGestationalAgeCategoryColor(category: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (category) {
    case 'Extremely Preterm':
      return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-400' };
    case 'Very Preterm':
      return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-400' };
    case 'Moderate to Late Preterm':
      return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-400' };
    case 'Early Term':
      return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-400' };
    case 'Full Term':
      return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-400' };
    case 'Late Term':
      return { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-400' };
    case 'Post Term':
      return { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-400' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-400' };
  }
}

/**
 * Format date for display (DD/MM/YYYY)
 */
export function formatDateForDisplay(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
