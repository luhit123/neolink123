/**
 * Utility functions for detecting PWA mode
 */

/**
 * Detects if the app is running in PWA standalone mode
 * @returns true if running as installed PWA, false if in browser
 */
export const isPWAMode = (): boolean => {
  // Check if running in standalone mode (iOS/Android)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  // Check for iOS PWA mode
  const isIOSStandalone = (window.navigator as any).standalone === true;

  // Check for Android/Chrome PWA mode
  const isAndroidStandalone = document.referrer.includes('android-app://');

  return isStandalone || isIOSStandalone || isAndroidStandalone;
};

/**
 * Gets the appropriate auth method based on environment
 * @returns 'redirect' for PWA mode, 'popup' for browser
 */
export const getAuthMethod = (): 'redirect' | 'popup' => {
  return isPWAMode() ? 'redirect' : 'popup';
};
