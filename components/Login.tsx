import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signInWithGoogle, signInWithUserID, sendPasswordResetByUserID, sendPasswordReset } from '../services/authService';
import Ripple from './material/Ripple';
import { haptics } from '../utils/haptics';
import { validateUserID } from '../utils/userIdGenerator';
import { isMobileDevice } from '../utils/pwaDetection';

interface LoginProps {
  initialError?: string | null;
}

const Login: React.FC<LoginProps> = ({ initialError }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const isMobile = isMobileDevice();

  // Login state
  const [userID, setUserID] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password modal state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetMode, setResetMode] = useState<'userid' | 'email'>('userid');
  const [resetUserID, setResetUserID] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetEmailSentTo, setResetEmailSentTo] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    haptics.tap();

    try {
      console.log('🔄 Starting Google login...');
      const result = await signInWithGoogle();

      if (result) {
        // Popup successful - user is signed in
        console.log('✅ Google login successful:', result.email);
        // Auth state listener in App.tsx will handle the rest
      } else {
        // Redirect flow was used as fallback (rare case)
        console.log('🔄 Redirect flow initiated...');
      }
    } catch (err: any) {
      console.error('❌ Login error:', err);
      setError(err.message || 'Failed to sign in. Please try again.');
      haptics.error();
    } finally {
      // Always reset loading state for popup flow
      setLoading(false);
    }
  };

  const handleUserIDLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    haptics.tap();

    // Validate UserID format (if not email)
    const isEmail = userID.includes('@');
    if (!isEmail && !validateUserID(userID)) {
      setError('Invalid UserID format. Must be 3 letters + 3 digits (e.g., GUW001)');
      setLoading(false);
      haptics.error();
      return;
    }

    if (!password) {
      setError('Please enter your password');
      setLoading(false);
      haptics.error();
      return;
    }

    try {
      await signInWithUserID(isEmail ? userID : userID.toUpperCase(), password);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in. Please try again.');
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

      if (resetMode === 'userid') {
        if (!validateUserID(resetUserID)) {
          setError('Invalid UserID format. Must be 3 letters + 3 digits (e.g., GUW001)');
          setResetLoading(false);
          haptics.error();
          return;
        }
        emailSent = await sendPasswordResetByUserID(resetUserID.toUpperCase());
      } else {
        if (!resetEmail || !resetEmail.includes('@')) {
          setError('Please enter a valid email address');
          setResetLoading(false);
          haptics.error();
          return;
        }
        await sendPasswordReset(resetEmail.toLowerCase());
        emailSent = resetEmail.toLowerCase();
      }

      setResetEmailSentTo(emailSent);
      setResetSuccess(true);
      setResetLoading(false);
      haptics.success();
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to send password reset email.');
      setResetLoading(false);
      haptics.error();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-4">
      {/* Login Card */}
      <motion.div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Medical Logo */}
        <div className="flex justify-center mb-6">
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 p-4 rounded-xl shadow-lg">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-center text-slate-800 mb-1">
          NeoLink
        </h1>
        <p className="text-slate-500 text-center text-sm mb-6">
          PICU/NICU Medical Records System
        </p>

        {/* Error Message */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <p className="text-red-600 text-sm text-center">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Login Form */}
        <form onSubmit={handleUserIDLogin} className="space-y-4">
          {/* UserID/Email Input */}
          <div>
            <label htmlFor="userID" className="block text-sm font-medium text-slate-700 mb-1.5">
              UserID or Email
            </label>
            <input
              id="userID"
              type="text"
              value={userID}
              onChange={(e) => setUserID(e.target.value.includes('@') ? e.target.value : e.target.value.toUpperCase())}
              placeholder="GUW001 or email@example.com"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors text-slate-800"
              disabled={loading}
              required
            />
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors text-slate-800"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                disabled={loading}
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
          </div>

          {/* Sign In Button */}
          <Ripple
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-lg transition-colors overflow-hidden"
            disabled={loading}
          >
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </Ripple>

          {/* Forgot Password Link */}
          <div className="text-center">
            <button
              type="button"
              className="text-sm text-teal-600 hover:text-teal-700 hover:underline transition-colors"
              onClick={() => {
                setShowForgotPassword(true);
                setError(null);
              }}
              disabled={loading}
            >
              Forgot Password?
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-white text-slate-400">or continue with</span>
          </div>
        </div>

        {/* Google Sign In */}
        <Ripple
          className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium py-3 rounded-lg transition-colors overflow-hidden"
          disabled={loading}
        >
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>{isMobile ? 'Continue with Google' : 'Sign in with Google'}</span>
          </button>
        </Ripple>

        {/* Security Notice */}
        <div className="mt-6 flex items-center justify-center gap-2 text-slate-500 text-xs">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Secure healthcare data access</span>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotPassword && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/40 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !resetLoading && setShowForgotPassword(false)}
            />

            {/* Modal */}
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                <h2 className="text-xl font-bold text-slate-800 mb-1">Reset Password</h2>
                <p className="text-slate-500 text-sm mb-5">
                  We'll send you an email with instructions to reset your password.
                </p>

                {resetSuccess ? (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-3 text-green-700">
                      <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-medium">Email Sent!</p>
                        <p className="text-sm mt-1">Check your inbox at <strong>{resetEmailSentTo}</strong></p>
                        <button
                          onClick={() => {
                            setShowForgotPassword(false);
                            setResetSuccess(false);
                            setResetUserID('');
                            setResetEmail('');
                            setResetEmailSentTo('');
                            setError(null);
                          }}
                          className="mt-3 text-sm text-teal-600 hover:underline font-medium"
                        >
                          Back to Login
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    {/* Reset Mode Toggle */}
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setResetMode('userid');
                          setResetEmail('');
                        }}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${resetMode === 'userid'
                          ? 'bg-white text-teal-600 shadow-sm'
                          : 'text-slate-600 hover:text-slate-800'
                          }`}
                      >
                        Use UserID
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResetMode('email');
                          setResetUserID('');
                        }}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${resetMode === 'email'
                          ? 'bg-white text-teal-600 shadow-sm'
                          : 'text-slate-600 hover:text-slate-800'
                          }`}
                      >
                        Use Email
                      </button>
                    </div>

                    {/* Conditional Input */}
                    {resetMode === 'userid' ? (
                      <div>
                        <label htmlFor="resetUserID" className="block text-sm font-medium text-slate-700 mb-1.5">
                          User ID
                        </label>
                        <input
                          id="resetUserID"
                          type="text"
                          value={resetUserID}
                          onChange={(e) => setResetUserID(e.target.value.toUpperCase())}
                          placeholder="e.g., GUW001"
                          maxLength={6}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono tracking-wider"
                          disabled={resetLoading}
                          required
                        />
                      </div>
                    ) : (
                      <div>
                        <label htmlFor="resetEmail" className="block text-sm font-medium text-slate-700 mb-1.5">
                          Email Address
                        </label>
                        <input
                          id="resetEmail"
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="your.email@example.com"
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          disabled={resetLoading}
                          required
                        />
                      </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(false);
                          setResetUserID('');
                          setResetEmail('');
                          setError(null);
                        }}
                        disabled={resetLoading}
                        className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <Ripple
                        className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg overflow-hidden"
                        disabled={resetLoading}
                      >
                        <button
                          type="submit"
                          disabled={resetLoading}
                          className="w-full px-4 py-2.5 font-medium flex items-center justify-center gap-2"
                        >
                          {resetLoading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                              <span>Sending...</span>
                            </>
                          ) : (
                            <span>Send Reset Email</span>
                          )}
                        </button>
                      </Ripple>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Login;
