import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signInWithUserID, sendPasswordResetByUserID, sendPasswordReset, signInWithGoogle, recordConsent } from '../services/authService';
import PrivacyPolicyModal from './PrivacyPolicyModal';
import { haptics } from '../utils/haptics';
import { validateUserID } from '../utils/userIdGenerator';
import { isMobileDevice } from '../utils/pwaDetection';

interface LoginProps {
  initialError?: string | null;
}

// Feature showcase slides
const showcaseSlides = [
  {
    id: 1,
    title: 'Save Time, Save Lives',
    description: 'Reduce documentation time by 60% and focus on what matters most - patient care',
    gradient: 'from-teal-500 to-cyan-500',
    icon: (
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    taglines: [
      'Less paperwork, more patient time',
      'Documentation in seconds, not hours',
      'Because every minute counts'
    ]
  },
  {
    id: 2,
    title: 'Seamless Referral Network',
    description: 'Connect NICU/PICU units across institutions for lightning-fast patient transfers',
    gradient: 'from-violet-500 to-purple-500',
    icon: (
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    taglines: [
      'One click. Instant referral.',
      'Breaking barriers in neonatal care',
      'Connected care, better outcomes'
    ]
  },
  {
    id: 3,
    title: 'AI-Powered Clinical Notes',
    description: 'Voice-to-text documentation with intelligent medical summarization',
    gradient: 'from-amber-500 to-orange-500',
    icon: (
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
    taglines: [
      'Speak. We document.',
      'AI that understands medicine',
      'More time for patients, less for paperwork'
    ]
  },
  {
    id: 4,
    title: 'World-Class Analytics',
    description: 'Comprehensive insights and reports at your fingertips - any data, one click',
    gradient: 'from-rose-500 to-pink-500',
    icon: (
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
    taglines: [
      'Any data. One click.',
      'Insights that drive decisions',
      'From raw data to actionable intelligence'
    ]
  }
];

const Login: React.FC<LoginProps> = ({ initialError }) => {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [success, setSuccess] = useState<string | null>(null);
  const isMobile = isMobileDevice();

  // Login state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isConsentChecked, setIsConsentChecked] = useState(false);
  const [isAiConsentChecked, setIsAiConsentChecked] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

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

  // Showcase carousel state
  const [activeSlide, setActiveSlide] = useState(0);

  // Refs
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Detect input type
  const isEmail = identifier.includes('@');

  // Auto-rotate carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % showcaseSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    haptics.tap();

    if (!isConsentChecked) {
      setError('Please accept the Privacy Policy to continue');
      setLoading(false);
      haptics.error();
      return;
    }

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

    if (!isEmail && !validateUserID(identifier)) {
      setError('Invalid UserID format. Use format like ABC001 or enter your email address.');
      setLoading(false);
      haptics.error();
      return;
    }

    if (rememberMe) {
      localStorage.setItem('neolink_remembered_identifier', identifier);
    } else {
      localStorage.removeItem('neolink_remembered_identifier');
    }

    try {
      const loginIdentifier = isEmail ? identifier.toLowerCase().trim() : identifier.toUpperCase().trim();
      const user = await signInWithUserID(loginIdentifier, password);
      // Record user consent upon successful login (including AI consent)
      await recordConsent(user.uid, isAiConsentChecked);
      setSuccess('Login successful! Redirecting...');
      haptics.success();
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in. Please check your credentials.');
      setLoading(false);
      haptics.error();
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    haptics.tap();

    // DPDP Compliance: Enforce consent BEFORE Google Sign-In
    if (!isConsentChecked) {
      setError('Please accept the Privacy Policy before signing in with Google');
      setGoogleLoading(false);
      haptics.error();
      return;
    }

    try {
      const user = await signInWithGoogle();
      if (user) {
        // Record both privacy and AI consent
        await recordConsent(user.uid, isAiConsentChecked);
        setSuccess('Google sign-in successful! Redirecting...');
        haptics.success();
      }
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      setError(err.message || 'Failed to sign in with Google');
      setGoogleLoading(false);
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

  const shouldFloat = (value: string, focused: boolean) => value.length > 0 || focused;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-900">
      {/* MOBILE/TABLET SHOWCASE CAROUSEL (Shows above login form on small screens) */}
      <div className="lg:hidden relative overflow-hidden py-8 px-6">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-800/50 to-slate-900">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-500/20 via-transparent to-transparent" />
        </div>

        {/* Compact Carousel Content */}
        <div className="relative z-10">
          <AnimatePresence mode="wait">
            {showcaseSlides.map((slide, index) => (
              index === activeSlide && (
                <motion.div
                  key={slide.id}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.4 }}
                  className="text-center"
                >
                  {/* Compact Icon + Title Row */}
                  <div className="flex items-center justify-center gap-4 mb-3">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${slide.gradient} shadow-lg`}>
                      <div className="text-white w-8 h-8">
                        {React.cloneElement(slide.icon as React.ReactElement, { className: 'w-8 h-8' } as any)}
                      </div>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white">
                      {slide.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="text-sm sm:text-base text-slate-400 mb-4 max-w-sm mx-auto">
                    {slide.description}
                  </p>

                  {/* Single tagline */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center justify-center gap-2"
                  >
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${slide.gradient}`} />
                    <p className={`text-sm font-medium bg-gradient-to-r ${slide.gradient} bg-clip-text text-transparent`}>
                      {slide.taglines[0]}
                    </p>
                  </motion.div>
                </motion.div>
              )
            ))}
          </AnimatePresence>

          {/* Compact Carousel Indicators */}
          <div className="flex justify-center gap-2 mt-5">
            {showcaseSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveSlide(index)}
                className={`transition-all duration-300 rounded-full ${index === activeSlide
                  ? 'w-6 h-1.5 bg-teal-500'
                  : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'
                  }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* LEFT SIDE - Login Form */}
      <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-20 py-8 lg:py-12 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-md mx-auto w-full">
          {/* Logo and Header */}
          <motion.div
            className="mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg shadow-teal-500/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">NeoLink</h1>
                <p className="text-slate-400 text-sm">Advanced Health Care Analytics</p>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
            <p className="text-slate-400">Sign in to access your dashboard</p>
          </motion.div>

          {/* Messages */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              </motion.div>
            )}

            {success && (
              <motion.div
                className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-xl"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-green-300 text-sm">{success}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Form */}
          <motion.form
            onSubmit={handleLogin}
            className="space-y-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {/* Identifier Input */}
            <div className="relative">
              <input
                ref={identifierRef}
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
              />
              <label
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
              {identifier && (
                <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-full font-medium ${isEmail ? 'bg-blue-500/20 text-blue-400' : 'bg-teal-500/20 text-teal-400'}`}>
                  {isEmail ? 'Email' : 'UserID'}
                </span>
              )}
            </div>

            {/* Password Input */}
            <div className="relative">
              <input
                ref={passwordRef}
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
              />
              <label
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
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
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
                  <div className={`w-5 h-5 rounded border-2 transition-all ${rememberMe ? 'bg-teal-500 border-teal-500' : 'border-white/20 group-hover:border-white/40'}`}>
                    {rememberMe && (
                      <svg className="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm text-slate-400 group-hover:text-slate-300">Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
                disabled={loading}
              >
                Forgot Password?
              </button>
            </div>

            {/* DPDP Consent Checkbox */}
            <div className={`p-4 rounded-xl border transition-all ${isConsentChecked ? 'bg-teal-500/5 border-teal-500/20' : 'bg-slate-800/20 border-white/5 hover:border-white/10'}`}>
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={isConsentChecked}
                    onChange={(e) => setIsConsentChecked(e.target.checked)}
                    className="sr-only"
                    disabled={loading}
                  />
                  <div className={`w-5 h-5 rounded border-2 transition-all ${isConsentChecked ? 'bg-teal-500 border-teal-500' : 'border-white/20 group-hover:border-white/40'}`}>
                    {isConsentChecked && (
                      <svg className="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-xs sm:text-sm text-slate-400 leading-snug">
                  I consent to the collection and processing of my personal and professional data in accordance with India&apos;s <button type="button" onClick={() => setShowPrivacyModal(true)} className="text-teal-400 hover:underline">DPDP Act 2023</button> as described in the <button type="button" onClick={() => setShowPrivacyModal(true)} className="text-teal-400 hover:underline">Privacy Policy</button>.
                </span>
              </label>
            </div>

            {/* DPDP AI Consent Checkbox (Optional - Third-Party Processors) */}
            <div className={`p-4 rounded-xl border transition-all ${isAiConsentChecked ? 'bg-blue-500/5 border-blue-500/20' : 'bg-slate-800/20 border-white/5 hover:border-white/10'}`}>
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={isAiConsentChecked}
                    onChange={(e) => setIsAiConsentChecked(e.target.checked)}
                    className="sr-only"
                    disabled={loading}
                  />
                  <div className={`w-5 h-5 rounded border-2 transition-all ${isAiConsentChecked ? 'bg-blue-500 border-blue-500' : 'border-white/20 group-hover:border-white/40'}`}>
                    {isAiConsentChecked && (
                      <svg className="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <span className="text-xs sm:text-sm text-slate-400 leading-snug">
                    <strong className="text-blue-400">(Optional)</strong> I consent to AI-powered clinical features that send <strong>de-identified</strong> health data to OpenAI and Google Gemini for analysis. <button type="button" onClick={() => setShowPrivacyModal(true)} className="text-blue-400 hover:underline">Learn more</button>
                  </span>
                  <p className="text-[10px] text-slate-500 mt-1">Unchecking this will disable AI clinical assistant, voice notes, and smart analytics.</p>
                </div>
              </label>
            </div>

            {/* Sign In Button */}
            <motion.button
              type="submit"
              disabled={loading || googleLoading}
              className={`
                w-full py-4 rounded-xl font-semibold text-white relative overflow-hidden transition-all
                ${loading || googleLoading
                  ? 'bg-teal-600/50 cursor-not-allowed'
                  : 'bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 shadow-lg shadow-teal-500/30'
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

            {/* Divider */}
            <div className="relative flex items-center gap-4 my-2">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-slate-500 text-sm">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Google Sign In Button */}
            <motion.button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              className={`
                w-full py-4 rounded-xl font-semibold relative overflow-hidden transition-all flex items-center justify-center gap-3
                ${loading || googleLoading
                  ? 'bg-white/5 cursor-not-allowed text-slate-500'
                  : 'bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20'
                }
              `}
              whileTap={{ scale: googleLoading ? 1 : 0.98 }}
            >
              {googleLoading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Connecting to Google...</span>
                </div>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </motion.button>
          </motion.form>

          {/* Security Badge */}
          <motion.div
            className="mt-8 flex items-center justify-center gap-2 text-slate-500 text-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>256-bit SSL Encrypted | PHI Compliant</span>
          </motion.div>

          {/* Company Info */}
          <motion.div
            className="mt-6 pt-6 border-t border-white/10 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-slate-400 text-xs mb-1">A product by</p>
            <p className="text-white font-semibold text-sm">Northeo Softcare Solutions</p>
            <div className="flex items-center justify-center gap-3 mt-1">
              <a
                href="https://northeosoftcare.in"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-400 hover:text-teal-300 text-xs transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                northeosoftcare.in
              </a>
              <span className="text-slate-600">|</span>
              <a
                href="mailto:contact@northeosoftcare.in"
                className="text-teal-400 hover:text-teal-300 text-xs transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                contact@northeosoftcare.in
              </a>
            </div>
          </motion.div>
        </div>
      </div>

      {/* RIGHT SIDE - Feature Showcase (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-500/20 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-500/20 via-transparent to-transparent" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M0 38.59l2.83-2.83 1.41 1.41L1.41 40H0v-1.41zM0 1.4l2.83 2.83 1.41-1.41L1.41 0H0v1.41zM38.59 40l-2.83-2.83 1.41-1.41L40 38.59V40h-1.41zM40 1.41l-2.83 2.83-1.41-1.41L38.59 0H40v1.41zM20 18.6l2.83-2.83 1.41 1.41L21.41 20l2.83 2.83-1.41 1.41L20 21.41l-2.83 2.83-1.41-1.41L18.59 20l-2.83-2.83 1.41-1.41L20 18.59z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full px-12 xl:px-20">
          {/* Feature Showcase */}
          <div className="w-full max-w-xl">
            <AnimatePresence mode="wait">
              {showcaseSlides.map((slide, index) => (
                index === activeSlide && (
                  <motion.div
                    key={slide.id}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.5 }}
                    className="text-center"
                  >
                    {/* Icon */}
                    <div className={`inline-flex p-6 rounded-3xl bg-gradient-to-br ${slide.gradient} shadow-2xl mb-8`}>
                      <div className="text-white">{slide.icon}</div>
                    </div>

                    {/* Title & Description */}
                    <h3 className="text-3xl xl:text-4xl font-bold text-white mb-4">
                      {slide.title}
                    </h3>
                    <p className="text-lg text-slate-400 mb-10 max-w-md mx-auto">
                      {slide.description}
                    </p>

                    {/* Taglines */}
                    <div className="space-y-3">
                      {slide.taglines.map((tagline, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.15 }}
                          className="flex items-center justify-center gap-3"
                        >
                          <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${slide.gradient}`} />
                          <p className={`text-lg font-medium bg-gradient-to-r ${slide.gradient} bg-clip-text text-transparent`}>
                            {tagline}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )
              ))}
            </AnimatePresence>

            {/* Carousel Indicators */}
            <div className="flex justify-center gap-2 mt-12">
              {showcaseSlides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveSlide(index)}
                  className={`transition-all duration-300 rounded-full ${index === activeSlide
                    ? 'w-8 h-2 bg-teal-500'
                    : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                    }`}
                />
              ))}
            </div>

            {/* Company Branding on Showcase Side */}
            <div className="mt-16 text-center">
              <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-5 py-2.5">
                <div className="w-6 h-6 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-white/80 text-sm font-medium">Powered by Northeo Softcare Solutions</span>
              </div>
            </div>
          </div>

          {/* Floating badges */}
          <motion.div
            className="absolute top-20 right-20 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-3"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Enterprise Grade</p>
                <p className="text-slate-400 text-xs">HIPAA Compliant & Secure</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="absolute bottom-20 left-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-3"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-500/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Built for Speed</p>
                <p className="text-slate-400 text-xs">Real-time sync across devices</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="absolute top-1/2 right-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-3"
            animate={{ x: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-500/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">AI-First Design</p>
                <p className="text-slate-400 text-xs">Smart automation at every step</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotPassword && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !resetLoading && closeForgotPasswordModal()}
            />

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
                onClick={(e) => e.stopPropagation()}
              >
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
                          className="mt-4 text-sm text-teal-400 hover:text-teal-300 font-medium"
                        >
                          Back to Login
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setResetMode('email');
                          setResetIdentifier('');
                        }}
                        className={`flex-1 py-2.5 px-3 rounded-md text-sm font-medium transition-all ${resetMode === 'email' ? 'bg-teal-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                          }`}
                      >
                        Use Email
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResetMode('userid');
                          setResetIdentifier('');
                        }}
                        className={`flex-1 py-2.5 px-3 rounded-md text-sm font-medium transition-all ${resetMode === 'userid' ? 'bg-teal-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                          }`}
                      >
                        Use UserID
                      </button>
                    </div>

                    <input
                      type={resetMode === 'email' ? 'email' : 'text'}
                      value={resetIdentifier}
                      onChange={(e) => setResetIdentifier(resetMode === 'userid' ? e.target.value.toUpperCase() : e.target.value)}
                      placeholder={resetMode === 'email' ? 'your.email@example.com' : 'ABC001'}
                      maxLength={resetMode === 'userid' ? 10 : undefined}
                      className={`w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 transition-all outline-none focus:border-teal-400 focus:bg-white/10 focus:ring-2 focus:ring-teal-400/20 ${resetMode === 'userid' ? 'font-mono tracking-wider' : ''}`}
                      disabled={resetLoading}
                      required
                    />

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={closeForgotPasswordModal}
                        disabled={resetLoading}
                        className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-all border border-white/10"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className={`flex-1 px-4 py-3 rounded-xl font-medium text-white transition-all ${resetLoading ? 'bg-teal-600/50 cursor-not-allowed' : 'bg-teal-500 hover:bg-teal-400 shadow-lg shadow-teal-500/30'
                          }`}
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
      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
    </div>
  );
};

export default Login;
