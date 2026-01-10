/**
 * Utility functions for detecting PWA mode and mobile devices
 */

/**
 * Detects if the app is running on a mobile device
 * @returns true if on mobile, false if on desktop
 */
export const isMobileDevice = (): boolean => {
  // Check user agent for mobile devices
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // Mobile device detection regex
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;

  // Check if matches mobile pattern
  const isMobileUA = mobileRegex.test(userAgent.toLowerCase());

  // Check for touch support (additional mobile indicator)
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Check screen width (mobile typically < 768px)
  const isSmallScreen = window.innerWidth < 768;

  return isMobileUA || (isTouchDevice && isSmallScreen);
};

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
 * @returns 'redirect' for mobile/PWA mode, 'popup' for desktop browser
 */
export const getAuthMethod = (): 'redirect' | 'popup' => {
  // Use redirect for:
  // 1. PWA mode (installed app)
  // 2. Mobile devices (popup doesn't work well)
  if (isPWAMode() || isMobileDevice()) {
    return 'redirect';
  }

  // Use popup only for desktop browsers
  return 'popup';
};
