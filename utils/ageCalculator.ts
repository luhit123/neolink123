import { AgeUnit, Unit } from '../types';

/**
 * Calculate age from birth date and return the appropriate age and unit
 * Automatically selects the most appropriate unit based on the duration
 * @param dateOfBirth - ISO string of birth date
 * @param forceUnit - If specified, always return age in this unit (used for NICU/SNCU which need days)
 */
export function calculateAgeFromBirthDate(dateOfBirth: string, forceUnit?: AgeUnit): {
  age: number;
  ageUnit: AgeUnit;
} {
  if (!dateOfBirth) {
    return { age: 0, ageUnit: forceUnit || AgeUnit.Days };
  }

  const birthDate = new Date(dateOfBirth);
  const now = new Date();

  // Calculate difference in milliseconds
  const diffMs = now.getTime() - birthDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // If force unit is specified (for NICU/SNCU), always return days
  if (forceUnit === AgeUnit.Days) {
    return {
      age: diffDays,
      ageUnit: AgeUnit.Days
    };
  }

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
 * Calculate age at a specific date from birth date
 * @param dateOfBirth - ISO string of birth date
 * @param targetDate - ISO string of target date
 * @param forceUnit - If specified, always return age in this unit (used for NICU/SNCU which need days)
 */
export function calculateAgeAtDate(dateOfBirth: string, targetDate: string, forceUnit?: AgeUnit): {
  age: number;
  ageUnit: AgeUnit;
} {
  if (!dateOfBirth || !targetDate) {
    return { age: 0, ageUnit: forceUnit || AgeUnit.Days };
  }

  const birthDate = new Date(dateOfBirth);
  const target = new Date(targetDate);

  // Calculate difference in milliseconds
  const diffMs = target.getTime() - birthDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // If force unit is specified (for NICU/SNCU), always return days
  if (forceUnit === AgeUnit.Days) {
    return {
      age: diffDays,
      ageUnit: AgeUnit.Days
    };
  }

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
