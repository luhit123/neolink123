import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signInWithGoogle, signInWithUserID, sendPasswordResetByUserID, sendPasswordReset } from '../services/authService';
import { initializeRecaptcha, sendOTP, verifyOTP, findPhoneByUserID, cleanupRecaptcha } from '../services/phoneAuthService';
import Ripple from './material/Ripple';
import { haptics } from '../utils/haptics';
import { validateUserID } from '../utils/userIdGenerator';
import { isMobileDevice } from '../utils/pwaDetection';

type LoginMode = 'google' | 'userid';
type UserIDLoginMethod = 'password' | 'otp';

const Login: React.FC = () => {
  const [mode, setMode] = useState<LoginMode>('userid');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMobile = isMobileDevice();

  // UserID login state
  const [userID, setUserID] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP login state
  const [loginMethod, setLoginMethod] = useState<UserIDLoginMethod>('password');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Forgot password modal state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetMode, setResetMode] = useState<'userid' | 'email'>('userid'); // Reset by UserID or Email
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
      await signInWithGoogle();
      // In PWA mode, the page will redirect away
      // In browser mode, the popup will handle auth
      // Auth state listener in App.tsx will handle navigation in both cases
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in. Please try again.');
      setLoading(false);
      haptics.error();
    }
  };

  const handleUserIDLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    haptics.tap();

    // Validate UserID format
    if (!validateUserID(userID)) {
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
      await signInWithUserID(userID.toUpperCase(), password);
      // Auth state listener in App.tsx will handle navigation
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in. Please try again.');
      setLoading(false);
      haptics.error();
    }
  };

  // Initialize reCAPTCHA on component mount
  useEffect(() => {
    initializeRecaptcha('recaptcha-container');

    return () => {
      cleanupRecaptcha();
    };
  }, []);

  // Resend OTP timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSendOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    haptics.tap();

    // Validate UserID format
    if (!validateUserID(userID)) {
      setError('Invalid UserID format. Must be 3 letters + 3 digits (e.g., GUW001)');
      setLoading(false);
      haptics.error();
      return;
    }

    try {
      // Find phone number for this UserID
      const phone = await findPhoneByUserID(userID.toUpperCase());
      setPhoneNumber(phone);

      // Initialize reCAPTCHA if not already initialized
      if (!document.getElementById('recaptcha-container')?.hasChildNodes()) {
        initializeRecaptcha('recaptcha-container');
      }

      // Send OTP
      await sendOTP(phone);
      setOtpSent(true);
      setResendTimer(60); // 60 seconds resend timer
      setLoading(false);
      haptics.success();
    } catch (err: any) {
      console.error('Error sending OTP:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
      setLoading(false);
      haptics.error();
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    haptics.tap();

    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      setLoading(false);
      haptics.error();
      return;
    }

    try {
      await verifyOTP(otp);
      // Auth state listener in App.tsx will handle navigation
      haptics.success();
    } catch (err: any) {
      console.error('Error verifying OTP:', err);
      setError(err.message || 'Invalid OTP. Please try again.');
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
        // Validate UserID format
        if (!validateUserID(resetUserID)) {
          setError('Invalid UserID format. Must be 3 letters + 3 digits (e.g., GUW001)');
          setResetLoading(false);
          haptics.error();
          return;
        }

        // Send password reset email by UserID
        emailSent = await sendPasswordResetByUserID(resetUserID.toUpperCase());
      } else {
        // Validate email
        if (!resetEmail || !resetEmail.includes('@')) {
          setError('Please enter a valid email address');
          setResetLoading(false);
          haptics.error();
          return;
        }

        // Send password reset email directly
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
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated Background with Gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600">
        {/* Animated Blobs */}
        <motion.div
          className="absolute top-0 left-0 w-96 h-96 bg-medical-teal/30 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl"
          animate={{
            x: [0, -50, 0],
            y: [0, -100, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 w-96 h-96 bg-sky-300/30 rounded-full blur-3xl"
          animate={{
            x: [-50, 50, -50],
            y: [50, -50, 50],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Glassmorphism Login Card */}
      <motion.div
        className="relative backdrop-blur-2xl bg-white/20 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] border border-white/30 p-8 w-full max-w-md"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{
          type: 'spring',
          stiffness: 260,
          damping: 20,
        }}
      >
        {/* Glass Inner Container */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg"
      >
        {/* Logo/Icon with Pulse Animation */}
        <motion.div
          className="flex justify-center mb-6"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        >
          <motion.div
            className="relative"
            animate={{
              boxShadow: [
                "0 0 20px rgba(20, 184, 166, 0.5)",
                "0 0 40px rgba(20, 184, 166, 0.8)",
                "0 0 20px rgba(20, 184, 166, 0.5)",
              ]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <div className="bg-gradient-to-br from-medical-teal to-blue-600 p-5 rounded-2xl shadow-xl">
              <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </motion.div>
        </motion.div>

        {/* Title with Gradient */}
        <motion.h1
          className="text-4xl font-bold text-center mb-2 bg-gradient-to-r from-medical-teal via-blue-600 to-indigo-600 bg-clip-text text-transparent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          NeoLink
        </motion.h1>
        <motion.p
          className="text-slate-700 text-center font-medium mb-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          PICU/NICU Medical Records
        </motion.p>
        <motion.p
          className="text-slate-500 text-center text-sm mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          Secure Healthcare Management System
        </motion.p>

        {/* Login Mode Tabs with Enhanced Design */}
        <div className="relative flex gap-3 mb-6 p-1 bg-slate-100/50 rounded-xl backdrop-blur-sm">
          <motion.button
            onClick={() => {
              setMode('userid');
              setError(null);
              haptics.tap();
            }}
            className={`relative flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 overflow-hidden ${
              mode === 'userid'
                ? 'text-white shadow-lg'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
            whileTap={{ scale: 0.98 }}
          >
            {mode === 'userid' && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-medical-teal to-blue-600"
                layoutId="activeTab"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span className="hidden sm:inline">UserID / Email</span>
              <span className="sm:hidden">Password</span>
            </span>
          </motion.button>
          <motion.button
            onClick={() => {
              setMode('google');
              setError(null);
              haptics.tap();
            }}
            className={`relative flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 overflow-hidden ${
              mode === 'google'
                ? 'text-white shadow-lg'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
            whileTap={{ scale: 0.98 }}
          >
            {mode === 'google' && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-medical-teal to-blue-600"
                layoutId="activeTab"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Google</span>
            </span>
          </motion.button>
        </div>

        {/* Error Message */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <p className="text-medical-red text-sm text-center">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Login Forms */}
        <AnimatePresence mode="wait">
          {mode === 'userid' ? (
            <motion.form
              key="userid-form"
              onSubmit={handleUserIDLogin}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* UserID Input with Icon */}
              <div>
                <label htmlFor="userID" className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-medical-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                  UserID or Email
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-medical-teal">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <input
                    id="userID"
                    type="text"
                    value={userID}
                    onChange={(e) => setUserID(e.target.value.toUpperCase())}
                    placeholder="GUW001 or email@example.com"
                    maxLength={50}
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-medical-teal/50 focus:border-medical-teal transition-all font-mono text-lg tracking-wider bg-white/50 backdrop-blur-sm"
                    disabled={loading}
                    required
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1.5 ml-1">UserID format: 3 letters + 3 digits (e.g., GUW001)</p>
              </div>

              {/* Login Method Toggle */}
              <div className="flex gap-2 p-1 bg-slate-100/50 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('password');
                    setOtpSent(false);
                    setOtp('');
                    setError(null);
                    haptics.tap();
                  }}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                    loginMethod === 'password'
                      ? 'bg-white text-medical-teal shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🔑 Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('otp');
                    setError(null);
                    haptics.tap();
                  }}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                    loginMethod === 'otp'
                      ? 'bg-white text-medical-teal shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📱 OTP
                </button>
              </div>

              {/* Password Input with Enhanced Design */}
              {loginMethod === 'password' && (
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-medical-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-medical-teal">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-12 pr-12 py-3.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-medical-teal/50 focus:border-medical-teal transition-all bg-white/50 backdrop-blur-sm"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-medical-teal transition-colors"
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
              )}

              {/* OTP Login Fields */}
              {loginMethod === 'otp' && (
                <>
                  {!otpSent ? (
                    <div>
                      <button
                        type="button"
                        onClick={handleSendOTP}
                        disabled={loading || !userID}
                        className="w-full bg-gradient-to-r from-medical-teal to-blue-600 hover:shadow-xl text-white font-bold py-4 px-4 rounded-xl shadow-lg transition-shadow disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>Sending OTP...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span>Send OTP</span>
                          </>
                        )}
                      </button>
                      <p className="text-xs text-slate-500 mt-2 text-center">We'll send a 6-digit OTP to your registered phone number</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="otp" className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4 text-medical-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Enter OTP
                        </label>
                        <div className="relative">
                          <input
                            id="otp"
                            type="text"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="123456"
                            maxLength={6}
                            className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-medical-teal/50 focus:border-medical-teal transition-all font-mono text-2xl text-center tracking-widest bg-white/50 backdrop-blur-sm"
                            disabled={loading}
                            required
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-2 text-center">
                          OTP sent to {phoneNumber?.replace(/(\d{3})(\d{3})(\d{4})/, '+$1 ***-***-$3')}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSendOTP}
                          disabled={loading || resendTimer > 0}
                          className="flex-1 py-2 px-4 border border-medical-teal text-medical-teal rounded-lg hover:bg-medical-teal/5 transition-colors disabled:opacity-50 text-sm font-medium"
                        >
                          {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOtpSent(false);
                            setOtp('');
                            setPhoneNumber('');
                          }}
                          className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm font-medium"
                        >
                          Change UserID
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Enhanced Sign In Button with Gradient */}
              {loginMethod === 'password' && (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-6"
              >
                <Ripple
                  className="w-full bg-gradient-to-r from-medical-teal via-blue-600 to-indigo-600 hover:shadow-xl text-white font-bold py-4 px-4 rounded-xl shadow-lg overflow-hidden transition-shadow"
                  disabled={loading}
                >
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        <span className="text-lg">Sign In</span>
                      </>
                    )}
                  </button>
                </Ripple>
              </motion.div>
              )}

              {/* OTP Verify Button */}
              {loginMethod === 'otp' && otpSent && (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-6"
              >
                <Ripple
                  className="w-full bg-gradient-to-r from-medical-teal via-blue-600 to-indigo-600 hover:shadow-xl text-white font-bold py-4 px-4 rounded-xl shadow-lg overflow-hidden transition-shadow"
                  disabled={loading}
                >
                  <button
                    type="button"
                    onClick={handleVerifyOTP}
                    disabled={loading || otp.length !== 6}
                    className="w-full flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-lg">Verify OTP</span>
                      </>
                    )}
                  </button>
                </Ripple>
              </motion.div>
              )}

              {/* Forgot Password Link */}
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-medical-teal hover:underline"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setError(null);
                  }}
                  disabled={loading}
                >
                  Forgot Password?
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.div
              key="google-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Enhanced Google Sign In Button */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Ripple
                  className="w-full bg-white hover:bg-white/90 text-gray-800 font-semibold py-4 px-6 rounded-xl shadow-xl border-2 border-slate-200 hover:border-medical-teal/30 overflow-hidden transition-all backdrop-blur-sm bg-white/50"
                  disabled={loading}
                >
                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-medical-teal"></div>
                        <span className="text-lg">{isMobile ? 'Redirecting to Google...' : 'Signing in...'}</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span className="text-lg">Sign in with Google</span>
                      </>
                    )}
                  </button>
                </Ripple>
              </motion.div>

              <motion.div
                className="mt-6 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-blue-700 font-medium">Quick access for all users</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info Text with Enhanced Styling */}
        <motion.div
          className="mt-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-center gap-2 text-slate-600 text-sm">
            <svg className="w-4 h-4 text-medical-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p>Secure access to patient records</p>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Protected by enterprise-grade encryption
          </p>
        </motion.div>
        </div>
      </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotPassword && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !resetLoading && setShowForgotPassword(false)}
            />

            {/* Modal */}
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-medical-teal/20">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Reset Password</h2>
                <p className="text-slate-600 text-sm mb-6">
                  We'll send you an email with instructions to reset your password.
                </p>

                {resetSuccess ? (
                  <motion.div
                    className="p-4 bg-green-50 border border-green-200 rounded-lg"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="flex items-center gap-3 text-green-700">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-semibold">Email Sent!</p>
                        <p className="text-sm">Check your inbox at <strong>{resetEmailSentTo}</strong> for password reset instructions.</p>
                        <button
                          onClick={() => {
                            setShowForgotPassword(false);
                            setResetSuccess(false);
                            setResetUserID('');
                            setResetEmail('');
                            setResetEmailSentTo('');
                            setError(null);
                          }}
                          className="mt-3 text-sm text-medical-teal hover:underline font-medium"
                        >
                          Back to Login
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    {/* Reset Mode Toggle */}
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setResetMode('userid');
                          setResetEmail('');
                        }}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                          resetMode === 'userid'
                            ? 'bg-white text-medical-teal shadow'
                            : 'text-slate-600 hover:text-slate-900'
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
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                          resetMode === 'email'
                            ? 'bg-white text-medical-teal shadow'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Use Email
                      </button>
                    </div>

                    {/* Conditional Input */}
                    {resetMode === 'userid' ? (
                      <div>
                        <label htmlFor="resetUserID" className="block text-sm font-medium text-slate-700 mb-2">
                          User ID
                        </label>
                        <input
                          id="resetUserID"
                          type="text"
                          value={resetUserID}
                          onChange={(e) => setResetUserID(e.target.value.toUpperCase())}
                          placeholder="e.g., GUW001"
                          maxLength={6}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-teal focus:border-transparent font-mono text-lg tracking-wider"
                          disabled={resetLoading}
                          required
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          We'll send the reset email to your registered email address
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label htmlFor="resetEmail" className="block text-sm font-medium text-slate-700 mb-2">
                          Email Address
                        </label>
                        <input
                          id="resetEmail"
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="your.email@example.com"
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-teal focus:border-transparent"
                          disabled={resetLoading}
                          required
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          Enter the email address you used to sign up
                        </p>
                      </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3 mt-6">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(false);
                          setResetUserID('');
                          setResetEmail('');
                          setError(null);
                        }}
                        disabled={resetLoading}
                        className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <Ripple
                        className="flex-1 bg-medical-teal hover:bg-medical-teal/90 text-white rounded-lg overflow-hidden"
                        disabled={resetLoading}
                      >
                        <button
                          type="submit"
                          disabled={resetLoading}
                          className="w-full px-4 py-3 font-semibold flex items-center justify-center gap-2"
                        >
                          {resetLoading ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                              <span>Sending...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <span>Send Reset Email</span>
                            </>
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

      {/* reCAPTCHA Container (invisible) */}
      <div id="recaptcha-container"></div>
    </div>
  );
};

export default Login;
