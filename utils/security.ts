/**
 * Security Utilities for HIPAA-Compliant Medical Records Application
 *
 * This module provides XSS protection, input sanitization, and security helpers.
 */

import DOMPurify from 'dompurify';

// ==================== XSS PROTECTION ====================

/**
 * Sanitize HTML content to prevent XSS attacks
 * Use this for any user-generated or AI-generated content displayed as HTML
 */
export const sanitizeHTML = (dirty: string): string => {
  if (!dirty) return '';

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
      'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id'],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur']
  });
};

/**
 * Sanitize markdown-formatted text before rendering
 * Converts markdown to HTML and sanitizes
 */
export const sanitizeMarkdown = (markdown: string): string => {
  if (!markdown) return '';

  // Convert markdown to HTML (basic conversion)
  let html = markdown
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^\- (.*$)/gm, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Wrap loose text in paragraphs
  if (!html.startsWith('<')) {
    html = `<p>${html}</p>`;
  }

  // Sanitize the resulting HTML
  return sanitizeHTML(html);
};

/**
 * Strip all HTML tags, returning plain text
 * Use this when HTML is not needed at all
 */
export const stripHTML = (html: string): string => {
  if (!html) return '';
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [] });
};

// ==================== INPUT VALIDATION ====================

/**
 * Sanitize text input (no HTML allowed)
 */
export const sanitizeTextInput = (input: string): string => {
  if (!input) return '';
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .trim();
};

/**
 * Validate and sanitize email address
 */
export const sanitizeEmail = (email: string): string | null => {
  if (!email) return null;

  const sanitized = email.toLowerCase().trim();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(sanitized)) {
    return null;
  }

  return sanitized;
};

/**
 * Validate and sanitize phone number
 */
export const sanitizePhoneNumber = (phone: string): string => {
  if (!phone) return '';
  // Keep only digits, spaces, hyphens, parentheses, and plus sign
  return phone.replace(/[^\d\s\-\(\)\+]/g, '').trim();
};

/**
 * Sanitize patient ID (alphanumeric only)
 */
export const sanitizePatientId = (id: string): string => {
  if (!id) return '';
  return id.replace(/[^a-zA-Z0-9\-_]/g, '').trim();
};

/**
 * Sanitize medical record number
 */
export const sanitizeMRN = (mrn: string): string => {
  if (!mrn) return '';
  return mrn.replace(/[^a-zA-Z0-9\-\/]/g, '').trim().toUpperCase();
};

// ==================== PHI PROTECTION ====================

/**
 * Mask sensitive information for display (e.g., in logs)
 */
export const maskPHI = (data: string, showLast: number = 4): string => {
  if (!data || data.length <= showLast) return '****';
  return '*'.repeat(data.length - showLast) + data.slice(-showLast);
};

/**
 * Mask email for display
 */
export const maskEmail = (email: string): string => {
  if (!email || !email.includes('@')) return '****@****.***';

  const [local, domain] = email.split('@');
  const maskedLocal = local.length > 2
    ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
    : '**';

  return `${maskedLocal}@${domain}`;
};

/**
 * Mask name for logging (keeps first and last characters)
 */
export const maskName = (name: string): string => {
  if (!name || name.length <= 2) return '***';
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
};

// ==================== SECURITY HEADERS ====================

/**
 * Content Security Policy for the application
 */
export const CSP_POLICY = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", 'https://apis.google.com', 'https://www.gstatic.com'],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'img-src': ["'self'", 'data:', 'https:', 'blob:'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'connect-src': [
    "'self'",
    'https://*.firebaseio.com',
    'https://*.googleapis.com',
    'https://*.cloudfunctions.net',
    'wss://*.firebaseio.com',
    'https://api.openai.com',
    'https://api.deepgram.com',
    'https://*.supabase.co'
  ],
  'frame-src': ["'self'", 'https://*.firebaseapp.com'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': []
};

/**
 * Generate CSP header string
 */
export const generateCSPHeader = (): string => {
  return Object.entries(CSP_POLICY)
    .map(([directive, values]) => {
      if (values.length === 0) return directive;
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
};

// ==================== RATE LIMITING HELPERS ====================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Simple client-side rate limiting
 * For real protection, implement server-side rate limiting
 */
export const checkRateLimit = (
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): boolean => {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
};

// ==================== SESSION SECURITY ====================

/**
 * Generate a secure random token
 */
export const generateSecureToken = (length: number = 32): string => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Validate session timeout (for idle detection)
 */
export const isSessionExpired = (lastActivity: number, maxIdleMs: number = 30 * 60 * 1000): boolean => {
  return Date.now() - lastActivity > maxIdleMs;
};

// ==================== ENCRYPTION HELPERS ====================

/**
 * Hash sensitive data for comparison (not for passwords - use Firebase Auth)
 * This is for non-critical data fingerprinting
 */
export const hashData = async (data: string): Promise<string> => {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// ==================== EXPORT VALIDATION ====================

/**
 * Validate that exported data doesn't contain sensitive fields
 */
export const sanitizeForExport = <T extends Record<string, unknown>>(
  data: T,
  sensitiveFields: string[] = ['password', 'apiKey', 'token', 'secret', 'ssn', 'creditCard']
): Partial<T> => {
  const sanitized: Partial<T> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveFields.some(field =>
      lowerKey.includes(field.toLowerCase())
    );

    if (!isSensitive) {
      sanitized[key as keyof T] = value as T[keyof T];
    }
  }

  return sanitized;
};

export default {
  sanitizeHTML,
  sanitizeMarkdown,
  stripHTML,
  sanitizeTextInput,
  sanitizeEmail,
  sanitizePhoneNumber,
  sanitizePatientId,
  sanitizeMRN,
  maskPHI,
  maskEmail,
  maskName,
  generateCSPHeader,
  checkRateLimit,
  generateSecureToken,
  isSessionExpired,
  hashData,
  sanitizeForExport
};
