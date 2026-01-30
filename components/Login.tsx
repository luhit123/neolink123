import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signInWithGoogle, signInWithUserID, sendPasswordResetByUserID, sendPasswordReset } from '../services/authService';
import { haptics } from '../utils/haptics';
import { validateUserID } from '../utils/userIdGenerator';
import { isMobileDevice } from '../utils/pwaDetection';

interface LoginProps {
  initialError?: string | null;
}

const Login: React.FC<LoginProps> = ({ initialError }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [success, setSuccess] = useState<string | null>(null);
  const isMobile = isMobileDevice();

  // Login state
  const [identifier, setIdentifier] = useState(''); // Can be UserID or Email
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Input focus states for floating labels
  const [identifierFocused, setIdentifierFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Forgot password modal state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetMode, setResetMode] = useState<'userid' | 'email'>('email');
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetEmailSentTo, setResetEmailSentTo] = useState('');

  // Refs
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Detect input type
  const isEmail = identifier.includes('@');
  const inputType = isEmail ? 'email' : 'userid';

  // Load remembered identifier on mount
  useEffect(() => {
    const remembered = localStorage.getItem('neolink_remembered_identifier');
    if (remembered) {
      setIdentifier(remembered);
      setRememberMe(true);
    }
  }, []);

  // Clear messages after delay
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    haptics.tap();

    try {
      const result = await signInWithGoogle();
      if (result) {
        setSuccess('Successfully signed in!');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in with Google. Please try again.');
      haptics.error();
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    haptics.tap();

    // Validation
    if (!identifier.trim()) {
      setError('Please enter your UserID or Email');
      setLoading(false);
      identifierRef.current?.focus();
      haptics.error();
      return;
    }

    if (!password) {
      setError('Please enter your password');
      setLoading(false);
      passwordRef.current?.focus();
      haptics.error();
      return;
    }

    // Validate UserID format if not email
    if (!isEmail && !validateUserID(identifier)) {
      setError('Invalid UserID format. Use format like ABC001 or enter your email address.');
      setLoading(false);
      haptics.error();
      return;
    }

    // Remember identifier if checked
    if (rememberMe) {
      localStorage.setItem('neolink_remembered_identifier', identifier);
    } else {
      localStorage.removeItem('neolink_remembered_identifier');
    }

    try {
      const loginIdentifier = isEmail ? identifier.toLowerCase().trim() : identifier.toUpperCase().trim();
      await signInWithUserID(loginIdentifier, password);
      setSuccess('Login successful! Redirecting...');
      haptics.success();
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in. Please check your credentials.');
      setLoading(false);
      haptics.error();
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setError(null);
    haptics.tap();

    try {
      let emailSent = '';
      const trimmedIdentifier = resetIdentifier.trim();

      if (resetMode === 'userid') {
        if (!validateUserID(trimmedIdentifier)) {
          setError('Invalid UserID format. Use format like ABC001.');
          setResetLoading(false);
          haptics.error();
          return;
        }
        emailSent = await sendPasswordResetByUserID(trimmedIdentifier.toUpperCase());
      } else {
        if (!trimmedIdentifier || !trimmedIdentifier.includes('@')) {
          setError('Please enter a valid email address');
          setResetLoading(false);
          haptics.error();
          return;
        }
        await sendPasswordReset(trimmedIdentifier.toLowerCase());
        emailSent = trimmedIdentifier.toLowerCase();
      }

      setResetEmailSentTo(emailSent);
      setResetSuccess(true);
      setResetLoading(false);
      haptics.success();
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to send password reset email. Please try again.');
      setResetLoading(false);
      haptics.error();
    }
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPassword(false);
    setResetSuccess(false);
    setResetIdentifier('');
    setResetEmailSentTo('');
    setError(null);
  };

  // Floating label helper
  const shouldFloat = (value: string, focused: boolean) => value.length > 0 || focused;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      {/* Main Login Card */}
      <motion.div
        className="relative w-full max-w-md"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Glass card */}
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-8 relative overflow-hidden">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

          {/* Logo and Header */}
          <div className="relative text-center mb-8">
            <motion.div
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg shadow-teal-500/30 mb-4"
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.5, delay: 0.2, type: 'spring' }}
            >
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </motion.div>

            <motion.h1
              className="text-3xl font-bold text-white mb-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              NeoLink
            </motion.h1>
            <motion.p
              className="text-slate-400 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              PICU/NICU Medical Records System
            </motion.p>
          </div>

          {/* Messages */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl backdrop-blur-sm"
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500/30 flex items-center justify-center mt-0.5">
                    <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-red-300 text-sm flex-1">{error}</p>
                </div>
              </motion.div>
            )}

            {success && (
              <motion.div
                className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-xl backdrop-blur-sm"
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/30 flex items-center justify-center mt-0.5">
                    <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-green-300 text-sm flex-1">{success}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="relative space-y-5">
            {/* Identifier Input (UserID or Email) */}
            <div className="relative">
              <input
                ref={identifierRef}
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onFocus={() => setIdentifierFocused(true)}
                onBlur={() => setIdentifierFocused(false)}
                className={`
                  w-full px-4 py-4 pt-6 bg-white/5 border rounded-xl text-white placeholder-transparent
                  transition-all duration-200 outline-none
                  ${identifierFocused ? 'border-teal-400 bg-white/10 ring-2 ring-teal-400/20' : 'border-white/10 hover:border-white/20'}
                `}
                placeholder="UserID or Email"
                disabled={loading}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
              />
              <label
                htmlFor="identifier"
                className={`
                  absolute left-4 transition-all duration-200 pointer-events-none
                  ${shouldFloat(identifier, identifierFocused)
                    ? 'top-2 text-xs text-teal-400'
                    : 'top-1/2 -translate-y-1/2 text-slate-400'
                  }
                `}
              >
                UserID or Email
              </label>
              {/* Input type indicator */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {identifier && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`
                      text-xs px-2 py-1 rounded-full font-medium
                      ${isEmail ? 'bg-blue-500/20 text-blue-400' : 'bg-teal-500/20 text-teal-400'}
                    `}
                  >
                    {isEmail ? 'Email' : 'UserID'}
                  </motion.span>
                )}
              </div>
            </div>

            {/* Password Input */}
            <div className="relative">
              <input
                ref={passwordRef}
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                className={`
                  w-full px-4 py-4 pt-6 pr-12 bg-white/5 border rounded-xl text-white placeholder-transparent
                  transition-all duration-200 outline-none
                  ${passwordFocused ? 'border-teal-400 bg-white/10 ring-2 ring-teal-400/20' : 'border-white/10 hover:border-white/20'}
                `}
                placeholder="Password"
                disabled={loading}
                autoComplete="current-password"
              />
              <label
                htmlFor="password"
                className={`
                  absolute left-4 transition-all duration-200 pointer-events-none
                  ${shouldFloat(password, passwordFocused)
                    ? 'top-2 text-xs text-teal-400'
                    : 'top-1/2 -translate-y-1/2 text-slate-400'
                  }
                `}
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
                disabled={loading}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                )}
              </button>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`
                    w-5 h-5 rounded border-2 transition-all duration-200
                    ${rememberMe
                      ? 'bg-teal-500 border-teal-500'
                      : 'border-white/20 group-hover:border-white/40'
                    }
                  `}>
                    {rememberMe && (
                      <svg className="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setError(null);
                }}
                className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
                disabled={loading}
              >
                Forgot Password?
              </button>
            </div>

            {/* Sign In Button */}
            <motion.button
              type="submit"
              disabled={loading}
              className={`
                w-full py-4 rounded-xl font-semibold text-white relative overflow-hidden
                transition-all duration-200
                ${loading
                  ? 'bg-teal-600/50 cursor-not-allowed'
                  : 'bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 shadow-lg shadow-teal-500/30 hover:shadow-teal-500/40'
                }
              `}
              whileTap={{ scale: loading ? 1 : 0.98 }}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                <span>Sign In</span>
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-transparent text-slate-500 text-sm">or continue with</span>
            </div>
          </div>

          {/* Google Sign In */}
          <motion.button
            onClick={handleGoogleLogin}
            disabled={loading}
            className={`
              w-full py-3.5 rounded-xl font-medium text-white relative overflow-hidden
              bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20
              transition-all duration-200 flex items-center justify-center gap-3
              ${loading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            whileTap={{ scale: loading ? 1 : 0.98 }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>{isMobile ? 'Continue with Google' : 'Sign in with Google'}</span>
          </motion.button>

          {/* Security Badge */}
          <div className="mt-6 flex items-center justify-center gap-2 text-slate-500 text-xs">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>256-bit SSL Encrypted</span>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-6">
          Protected Health Information (PHI) Compliant
        </p>
      </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotPassword && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !resetLoading && closeForgotPasswordModal()}
            />

            {/* Modal */}
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-full max-w-md backdrop-blur-xl bg-slate-800/90 rounded-2xl shadow-2xl border border-white/10 p-6 relative"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={closeForgotPasswordModal}
                  disabled={resetLoading}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <h2 className="text-xl font-bold text-white mb-1">Reset Password</h2>
                <p className="text-slate-400 text-sm mb-5">
                  We'll send you an email with instructions to reset your password.
                </p>

                {resetSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-green-500/20 border border-green-500/30 rounded-xl"
                  >
                    <div className="flex items-start gap-3 text-green-300">
                      <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-semibold">Email Sent!</p>
                        <p className="text-sm mt-1 text-green-400">
                          Check your inbox at <span className="font-medium">{resetEmailSentTo}</span>
                        </p>
                        <button
                          onClick={closeForgotPasswordModal}
                          className="mt-4 text-sm text-teal-400 hover:text-teal-300 font-medium transition-colors"
                        >
                          Back to Login
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    {/* Mode Toggle */}
                    <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setResetMode('email');
                          setResetIdentifier('');
                        }}
                        className={`
                          flex-1 py-2.5 px-3 rounded-md text-sm font-medium transition-all
                          ${resetMode === 'email'
                            ? 'bg-teal-500 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white'
                          }
                        `}
                      >
                        Use Email
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResetMode('userid');
                          setResetIdentifier('');
                        }}
                        className={`
                          flex-1 py-2.5 px-3 rounded-md text-sm font-medium transition-all
                          ${resetMode === 'userid'
                            ? 'bg-teal-500 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white'
                          }
                        `}
                      >
                        Use UserID
                      </button>
                    </div>

                    {/* Input */}
                    <div>
                      <input
                        type={resetMode === 'email' ? 'email' : 'text'}
                        value={resetIdentifier}
                        onChange={(e) => setResetIdentifier(resetMode === 'userid' ? e.target.value.toUpperCase() : e.target.value)}
                        placeholder={resetMode === 'email' ? 'your.email@example.com' : 'ABC001'}
                        maxLength={resetMode === 'userid' ? 10 : undefined}
                        className={`
                          w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white
                          placeholder-slate-500 transition-all duration-200 outline-none
                          focus:border-teal-400 focus:bg-white/10 focus:ring-2 focus:ring-teal-400/20
                          ${resetMode === 'userid' ? 'font-mono tracking-wider' : ''}
                        `}
                        disabled={resetLoading}
                        autoCapitalize="none"
                        autoCorrect="off"
                        required
                      />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={closeForgotPasswordModal}
                        disabled={resetLoading}
                        className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-all disabled:opacity-50 border border-white/10"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className={`
                          flex-1 px-4 py-3 rounded-xl font-medium text-white transition-all
                          ${resetLoading
                            ? 'bg-teal-600/50 cursor-not-allowed'
                            : 'bg-teal-500 hover:bg-teal-400 shadow-lg shadow-teal-500/30'
                          }
                        `}
                      >
                        {resetLoading ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Sending...</span>
                          </div>
                        ) : (
                          <span>Send Reset Link</span>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Login;
