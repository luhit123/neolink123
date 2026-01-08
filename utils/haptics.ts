/**
 * Haptic Feedback Utility
 * Provides tactile feedback for user interactions
 * Uses Vibration API with graceful fallbacks
 * Respects user's reduced motion preferences
 */

type HapticIntensity = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

interface HapticPattern {
  vibrate?: number | number[];
  description: string;
}

// Haptic patterns based on Material Design guidelines
const HAPTIC_PATTERNS: Record<HapticIntensity, HapticPattern> = {
  light: {
    vibrate: 10,
    description: 'Light tap - for subtle interactions like hover or focus',
  },
  medium: {
    vibrate: 20,
    description: 'Medium tap - for standard button presses',
  },
  heavy: {
    vibrate: 40,
    description: 'Heavy tap - for important actions or confirmations',
  },
  success: {
    vibrate: [10, 50, 10],
    description: 'Success pattern - short-long-short',
  },
  warning: {
    vibrate: [20, 30, 20, 30, 20],
    description: 'Warning pattern - multiple quick pulses',
  },
  error: {
    vibrate: [50, 50, 50],
    description: 'Error pattern - three medium pulses',
  },
  selection: {
    vibrate: 5,
    description: 'Selection feedback - very light tap for swipes/scrolls',
  },
};

/**
 * Check if haptic feedback is supported and enabled
 */
const isHapticsSupported = (): boolean => {
  return (
    'vibrate' in navigator &&
    typeof navigator.vibrate === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
};

/**
 * Trigger haptic feedback
 * @param intensity - The intensity level of the haptic feedback
 * @param force - Force haptic even if reduced motion is preferred (use sparingly)
 */
export const haptic = (intensity: HapticIntensity, force: boolean = false): void => {
  // Respect reduced motion preference unless forced
  if (!force && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  // Check if vibration API is supported
  if (!isHapticsSupported()) {
    console.debug('Haptics not supported on this device');
    return;
  }

  const pattern = HAPTIC_PATTERNS[intensity];

  if (!pattern.vibrate) {
    console.warn(`No vibration pattern defined for intensity: ${intensity}`);
    return;
  }

  try {
    navigator.vibrate(pattern.vibrate);
  } catch (error) {
    console.error('Haptic feedback error:', error);
  }
};

/**
 * Stop all ongoing vibrations
 */
export const stopHaptic = (): void => {
  if (isHapticsSupported()) {
    try {
      navigator.vibrate(0);
    } catch (error) {
      console.error('Error stopping haptic:', error);
    }
  }
};

/**
 * Convenience functions for common haptic patterns
 */
export const haptics = {
  /**
   * Light tap for subtle interactions (hover, focus)
   */
  light: () => haptic('light'),

  /**
   * Medium tap for standard button presses
   */
  tap: () => haptic('medium'),

  /**
   * Heavy tap for important actions
   */
  impact: () => haptic('heavy'),

  /**
   * Success feedback (e.g., form submitted, patient saved)
   */
  success: () => haptic('success'),

  /**
   * Warning feedback (e.g., unsaved changes)
   */
  warning: () => haptic('warning'),

  /**
   * Error feedback (e.g., validation error, failed action)
   */
  error: () => haptic('error'),

  /**
   * Selection feedback for swipes, list scrolling, picker changes
   */
  selection: () => haptic('selection'),

  /**
   * Stop all vibrations
   */
  stop: stopHaptic,
};

/**
 * React hook for haptic feedback
 */
export const useHaptics = () => {
  return {
    isSupported: isHapticsSupported(),
    haptic,
    ...haptics,
  };
};

/**
 * Higher-order function to add haptic feedback to event handlers
 * @param handler - Original event handler
 * @param intensity - Haptic intensity to trigger
 * @returns Enhanced event handler with haptic feedback
 */
export const withHaptic = <T extends (...args: any[]) => any>(
  handler: T,
  intensity: HapticIntensity = 'medium'
): T => {
  return ((...args: any[]) => {
    haptic(intensity);
    return handler(...args);
  }) as T;
};

export default haptics;
