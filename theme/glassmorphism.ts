/**
 * Glassmorphism Design System for Neolink Healthcare App
 *
 * Premium glass-style design tokens and utilities for creating
 * a modern, elegant healthcare application interface.
 */

export const glassmorphism = {
  /**
   * Backdrop blur variations for glass effect
   */
  backdrop: {
    light: 'backdrop-blur-xl bg-white/60',
    medium: 'backdrop-blur-2xl bg-white/80',
    heavy: 'backdrop-blur-3xl bg-white/90',
    tinted: 'backdrop-blur-xl bg-gradient-to-br from-white/70 to-sky-50/70',
    tintedPurple: 'backdrop-blur-xl bg-gradient-to-br from-white/70 to-purple-50/70',
    tintedGreen: 'backdrop-blur-xl bg-gradient-to-br from-white/70 to-emerald-50/70',
    dark: 'backdrop-blur-xl bg-slate-900/80',
    darkTinted: 'backdrop-blur-xl bg-gradient-to-br from-slate-900/80 to-slate-800/80',
  },

  /**
   * Border styles with subtle opacity and glows
   */
  border: {
    light: 'border border-white/20',
    medium: 'border border-white/30',
    heavy: 'border border-white/40',
    glow: 'border border-white/30 shadow-lg shadow-sky-500/10',
    glowPurple: 'border border-white/30 shadow-lg shadow-purple-500/10',
    glowGreen: 'border border-white/30 shadow-lg shadow-emerald-500/10',
    glowRed: 'border border-white/30 shadow-lg shadow-red-500/10',
    glowYellow: 'border border-white/30 shadow-lg shadow-yellow-500/10',
  },

  /**
   * Shadow elevations for depth hierarchy
   */
  shadow: {
    soft: 'shadow-2xl shadow-black/5',
    elevated: 'shadow-2xl shadow-sky-500/20',
    floating: 'shadow-[0_20px_70px_-10px_rgba(14,165,233,0.3)]',
    floatingHover: 'shadow-[0_25px_80px_-10px_rgba(14,165,233,0.4)]',
    card: 'shadow-[0_8px_30px_rgba(0,0,0,0.08)]',
    cardHover: 'shadow-[0_12px_40px_rgba(0,0,0,0.12)]',
    inner: 'shadow-inner shadow-black/10',
  },

  /**
   * Animation configurations (for Framer Motion)
   */
  animation: {
    spring: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 25,
    },
    springBouncy: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 20,
    },
    springSmooth: {
      type: 'spring' as const,
      stiffness: 200,
      damping: 30,
    },
    smooth: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number], // Material Design easing
    },
    fast: {
      duration: 0.15,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
    slow: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },

  /**
   * Gradient backgrounds
   */
  gradient: {
    primary: 'bg-gradient-to-br from-sky-400 to-blue-600',
    primarySubtle: 'bg-gradient-to-br from-sky-50 to-blue-100',
    success: 'bg-gradient-to-br from-emerald-400 to-green-600',
    successSubtle: 'bg-gradient-to-br from-emerald-50 to-green-100',
    warning: 'bg-gradient-to-br from-yellow-400 to-orange-600',
    warningSubtle: 'bg-gradient-to-br from-yellow-50 to-orange-100',
    danger: 'bg-gradient-to-br from-red-400 to-rose-600',
    dangerSubtle: 'bg-gradient-to-br from-red-50 to-rose-100',
    purple: 'bg-gradient-to-br from-purple-400 to-indigo-600',
    purpleSubtle: 'bg-gradient-to-br from-purple-50 to-indigo-100',
    glass: 'bg-gradient-to-br from-white/40 to-white/10',
  },

  /**
   * Status-based glow colors for patient priorities
   */
  statusGlow: {
    critical: 'border-2 border-red-300 shadow-[0_0_30px_rgba(239,68,68,0.4)]',
    urgent: 'border-2 border-orange-300 shadow-[0_0_20px_rgba(249,115,22,0.3)]',
    routine: 'border border-sky-200 shadow-[0_0_15px_rgba(14,165,233,0.2)]',
    improving: 'border border-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]',
  },

  /**
   * Common class combinations for components
   */
  components: {
    card: 'backdrop-blur-xl bg-white/70 border border-white/20 rounded-3xl shadow-[0_20px_70px_-10px_rgba(14,165,233,0.3)] transition-all duration-300',
    cardHover: 'hover:shadow-[0_25px_80px_-10px_rgba(14,165,233,0.4)] hover:bg-white/75',
    button: 'backdrop-blur-lg bg-white/60 border border-white/30 rounded-xl shadow-lg hover:bg-white/70 transition-all duration-200',
    input: 'backdrop-blur-lg bg-white/50 border border-white/30 rounded-lg shadow-sm focus:bg-white/60 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 transition-all',
    modal: 'backdrop-blur-2xl bg-white/90 border border-white/20 rounded-3xl shadow-[0_30px_90px_-10px_rgba(0,0,0,0.3)]',
    chip: 'backdrop-blur-lg bg-white/70 border border-white/20 rounded-full px-4 py-1.5 text-sm font-medium shadow-md',
  },
};

/**
 * Utility function to combine glassmorphism classes
 */
export const glassClasses = (...classes: string[]) => {
  return classes.filter(Boolean).join(' ');
};

/**
 * Priority-based styling helper
 */
export const getPriorityStyle = (priority: 'critical' | 'urgent' | 'routine' | 'improving' = 'routine') => {
  return glassmorphism.statusGlow[priority];
};

/**
 * Outcome-based color scheme
 */
export const outcomeColors = {
  'In Progress': {
    bg: 'bg-blue-500',
    text: 'text-blue-700',
    border: 'border-blue-300',
    glow: 'shadow-[0_0_15px_rgba(59,130,246,0.2)]',
    subtle: 'bg-blue-50',
  },
  'Discharged': {
    bg: 'bg-green-500',
    text: 'text-green-700',
    border: 'border-green-300',
    glow: 'shadow-[0_0_15px_rgba(34,197,94,0.2)]',
    subtle: 'bg-green-50',
  },
  'Deceased': {
    bg: 'bg-red-500',
    text: 'text-red-700',
    border: 'border-red-300',
    glow: 'shadow-[0_0_15px_rgba(239,68,68,0.2)]',
    subtle: 'bg-red-50',
  },
  'Referred': {
    bg: 'bg-orange-500',
    text: 'text-orange-700',
    border: 'border-orange-300',
    glow: 'shadow-[0_0_15px_rgba(249,115,22,0.2)]',
    subtle: 'bg-orange-50',
  },
  'Step Down': {
    bg: 'bg-purple-500',
    text: 'text-purple-700',
    border: 'border-purple-300',
    glow: 'shadow-[0_0_15px_rgba(168,85,247,0.2)]',
    subtle: 'bg-purple-50',
  },
} as const;

/**
 * Unit-based color scheme
 */
export const unitColors = {
  NICU: {
    primary: 'from-blue-400 to-cyan-600',
    light: 'from-blue-50 to-cyan-100',
    glow: 'shadow-cyan-500/20',
  },
  PICU: {
    primary: 'from-purple-400 to-pink-600',
    light: 'from-purple-50 to-pink-100',
    glow: 'shadow-purple-500/20',
  },
  SNCU: {
    primary: 'from-emerald-400 to-teal-600',
    light: 'from-emerald-50 to-teal-100',
    glow: 'shadow-emerald-500/20',
  },
  HDU: {
    primary: 'from-orange-400 to-red-600',
    light: 'from-orange-50 to-red-100',
    glow: 'shadow-orange-500/20',
  },
  'General Ward': {
    primary: 'from-slate-400 to-gray-600',
    light: 'from-slate-50 to-gray-100',
    glow: 'shadow-slate-500/20',
  },
} as const;

export default glassmorphism;
