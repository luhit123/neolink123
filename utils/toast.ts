// ============================================================================
// TOAST NOTIFICATION SYSTEM
// Beautiful gradient toast notifications for user feedback
// ============================================================================

export type ToastType = 'success' | 'info' | 'warning' | 'error';

/**
 * Show a toast notification
 *
 * @param type - Type of toast (success, info, warning, error)
 * @param message - Message to display
 * @param duration - Duration in milliseconds (default: 4000ms)
 *
 * @example
 * showToast('success', '💊 3 medications added, 1 stopped');
 * showToast('warning', '⚠️ Fallback mode: 2 medications added');
 * showToast('error', '❌ Failed to sync medications');
 */
export function showToast(
  type: ToastType,
  message: string,
  duration: number = 4000
): void {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `
    fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[9999]
    px-4 sm:px-6 py-3 rounded-xl shadow-2xl
    max-w-md w-full mx-4
    flex items-center gap-3
    transition-all duration-300
  `.trim();

  // Add type-specific styles
  const styles: Record<ToastType, string> = {
    success: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white',
    info: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white',
    warning: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white',
    error: 'bg-gradient-to-r from-red-500 to-rose-600 text-white'
  };

  toast.className += ' ' + styles[type];

  // Icons for each type
  const icons: Record<ToastType, string> = {
    success: '✓',
    info: 'ℹ',
    warning: '⚠',
    error: '✕'
  };

  // Build toast via DOM nodes. SECURITY: the message is set with textContent (never
  // innerHTML) so a toast string that happens to contain markup (e.g. an error echoing
  // user/patient input) cannot inject HTML/script into the page.
  const iconEl = document.createElement('div');
  iconEl.className = 'w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold flex-shrink-0';
  iconEl.textContent = icons[type];

  const msgEl = document.createElement('div');
  msgEl.className = 'flex-1 font-medium text-sm leading-tight';
  msgEl.textContent = message;

  toast.replaceChildren(iconEl, msgEl);

  // Initial state (invisible)
  toast.style.opacity = '0';
  toast.style.transform = 'translate(-50%, 20px)';

  // Add to body
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, 0)';
  });

  // Animate out and remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 20px)';

    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

/**
 * Show a success toast with green gradient
 */
export function showSuccessToast(message: string, duration?: number): void {
  showToast('success', message, duration);
}

/**
 * Show an info toast with blue gradient
 */
export function showInfoToast(message: string, duration?: number): void {
  showToast('info', message, duration);
}

/**
 * Show a warning toast with amber gradient
 */
export function showWarningToast(message: string, duration?: number): void {
  showToast('warning', message, duration);
}

/**
 * Show an error toast with red gradient
 */
export function showErrorToast(message: string, duration?: number): void {
  showToast('error', message, duration);
}
