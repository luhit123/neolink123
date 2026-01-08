/**
 * Material Design 3 Theme System
 * Based on Medical Teal primary color (#0EA5E9)
 * Follows Material Design 3 color roles and token system
 */

export interface Material3Theme {
  colors: {
    // Primary colors (Medical Teal)
    primary: string;
    onPrimary: string;
    primaryContainer: string;
    onPrimaryContainer: string;

    // Secondary colors
    secondary: string;
    onSecondary: string;
    secondaryContainer: string;
    onSecondaryContainer: string;

    // Tertiary colors
    tertiary: string;
    onTertiary: string;
    tertiaryContainer: string;
    onTertiaryContainer: string;

    // Error colors
    error: string;
    onError: string;
    errorContainer: string;
    onErrorContainer: string;

    // Surface colors
    background: string;
    onBackground: string;
    surface: string;
    onSurface: string;
    surfaceVariant: string;
    onSurfaceVariant: string;

    // Outline
    outline: string;
    outlineVariant: string;

    // Special
    scrim: string;
    inverseSurface: string;
    inverseOnSurface: string;
    inversePrimary: string;
  };
  elevation: {
    level0: string;
    level1: string;
    level2: string;
    level3: string;
    level4: string;
    level5: string;
  };
  typography: {
    displayLarge: string;
    displayMedium: string;
    displaySmall: string;
    headlineLarge: string;
    headlineMedium: string;
    headlineSmall: string;
    titleLarge: string;
    titleMedium: string;
    titleSmall: string;
    bodyLarge: string;
    bodyMedium: string;
    bodySmall: string;
    labelLarge: string;
    labelMedium: string;
    labelSmall: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
}

// Light Theme (Medical Professional)
export const lightTheme: Material3Theme = {
  colors: {
    // Primary - Medical Teal
    primary: '#0EA5E9', // Sky 500
    onPrimary: '#FFFFFF',
    primaryContainer: '#E0F2FE', // Sky 100
    onPrimaryContainer: '#075985', // Sky 800

    // Secondary - Medical Blue
    secondary: '#0284C7', // Sky 600
    onSecondary: '#FFFFFF',
    secondaryContainer: '#BAE6FD', // Sky 200
    onSecondaryContainer: '#0C4A6E', // Sky 900

    // Tertiary - Medical Green
    tertiary: '#16A34A', // Green 600
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#DCFCE7', // Green 100
    onTertiaryContainer: '#14532D', // Green 900

    // Error - Medical Red
    error: '#DC2626', // Red 600
    onError: '#FFFFFF',
    errorContainer: '#FEE2E2', // Red 100
    onErrorContainer: '#7F1D1D', // Red 900

    // Surface
    background: '#F8FAFC', // Slate 50
    onBackground: '#0F172A', // Slate 900
    surface: '#FFFFFF',
    onSurface: '#1E293B', // Slate 800
    surfaceVariant: '#F1F5F9', // Slate 100
    onSurfaceVariant: '#475569', // Slate 600

    // Outline
    outline: '#CBD5E1', // Slate 300
    outlineVariant: '#E2E8F0', // Slate 200

    // Special
    scrim: 'rgba(0, 0, 0, 0.32)',
    inverseSurface: '#1E293B', // Slate 800
    inverseOnSurface: '#F8FAFC', // Slate 50
    inversePrimary: '#7DD3FC', // Sky 300
  },
  elevation: {
    level0: '0 0 0 0 rgba(0, 0, 0, 0)',
    level1: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    level2: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    level3: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    level4: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    level5: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  typography: {
    // Display - Largest text
    displayLarge: 'text-5xl font-normal tracking-tight', // 48px
    displayMedium: 'text-4xl font-normal tracking-tight', // 36px
    displaySmall: 'text-3xl font-normal', // 30px

    // Headline
    headlineLarge: 'text-2xl font-semibold', // 24px
    headlineMedium: 'text-xl font-semibold', // 20px
    headlineSmall: 'text-lg font-semibold', // 18px

    // Title
    titleLarge: 'text-base font-semibold', // 16px
    titleMedium: 'text-sm font-semibold tracking-wide', // 14px
    titleSmall: 'text-xs font-semibold tracking-wide', // 12px

    // Body
    bodyLarge: 'text-base font-normal', // 16px
    bodyMedium: 'text-sm font-normal', // 14px
    bodySmall: 'text-xs font-normal', // 12px

    // Label
    labelLarge: 'text-sm font-medium', // 14px
    labelMedium: 'text-xs font-medium tracking-wide', // 12px
    labelSmall: 'text-xs font-medium tracking-wider', // 11px
  },
  spacing: {
    xs: '4px', // 0.5 unit
    sm: '8px', // 1 unit
    md: '16px', // 2 units
    lg: '24px', // 3 units
    xl: '32px', // 4 units
    xxl: '48px', // 6 units
  },
};

// Dark Theme (Medical Professional - Night Mode)
export const darkTheme: Material3Theme = {
  colors: {
    // Primary - Medical Teal (adjusted for dark)
    primary: '#7DD3FC', // Sky 300
    onPrimary: '#075985', // Sky 800
    primaryContainer: '#0C4A6E', // Sky 900
    onPrimaryContainer: '#E0F2FE', // Sky 100

    // Secondary
    secondary: '#38BDF8', // Sky 400
    onSecondary: '#0C4A6E', // Sky 900
    secondaryContainer: '#075985', // Sky 800
    onSecondaryContainer: '#BAE6FD', // Sky 200

    // Tertiary
    tertiary: '#4ADE80', // Green 400
    onTertiary: '#14532D', // Green 900
    tertiaryContainer: '#166534', // Green 800
    onTertiaryContainer: '#DCFCE7', // Green 100

    // Error
    error: '#F87171', // Red 400
    onError: '#7F1D1D', // Red 900
    errorContainer: '#991B1B', // Red 800
    onErrorContainer: '#FEE2E2', // Red 100

    // Surface
    background: '#0F172A', // Slate 900
    onBackground: '#F8FAFC', // Slate 50
    surface: '#1E293B', // Slate 800
    onSurface: '#E2E8F0', // Slate 200
    surfaceVariant: '#334155', // Slate 700
    onSurfaceVariant: '#CBD5E1', // Slate 300

    // Outline
    outline: '#475569', // Slate 600
    outlineVariant: '#334155', // Slate 700

    // Special
    scrim: 'rgba(0, 0, 0, 0.64)',
    inverseSurface: '#E2E8F0', // Slate 200
    inverseOnSurface: '#1E293B', // Slate 800
    inversePrimary: '#0EA5E9', // Sky 500
  },
  elevation: {
    level0: '0 0 0 0 rgba(0, 0, 0, 0)',
    level1: '0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(100, 116, 139, 0.12)',
    level2: '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.24)',
    level3: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.24)',
    level4: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
    level5: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.16)',
  },
  typography: {
    // Display
    displayLarge: 'text-5xl font-normal tracking-tight',
    displayMedium: 'text-4xl font-normal tracking-tight',
    displaySmall: 'text-3xl font-normal',

    // Headline
    headlineLarge: 'text-2xl font-semibold',
    headlineMedium: 'text-xl font-semibold',
    headlineSmall: 'text-lg font-semibold',

    // Title
    titleLarge: 'text-base font-semibold',
    titleMedium: 'text-sm font-semibold tracking-wide',
    titleSmall: 'text-xs font-semibold tracking-wide',

    // Body
    bodyLarge: 'text-base font-normal',
    bodyMedium: 'text-sm font-normal',
    bodySmall: 'text-xs font-normal',

    // Label
    labelLarge: 'text-sm font-medium',
    labelMedium: 'text-xs font-medium tracking-wide',
    labelSmall: 'text-xs font-medium tracking-wider',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
};

// Helper function to get current theme
export const getTheme = (isDark: boolean): Material3Theme => {
  return isDark ? darkTheme : lightTheme;
};

// Animation constants
export const animations = {
  // Duration
  duration: {
    short1: 50,
    short2: 100,
    short3: 150,
    short4: 200,
    medium1: 250,
    medium2: 300,
    medium3: 350,
    medium4: 400,
    long1: 450,
    long2: 500,
    long3: 550,
    long4: 600,
    extraLong1: 700,
    extraLong2: 800,
    extraLong3: 900,
    extraLong4: 1000,
  },

  // Easing
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    emphasized: 'cubic-bezier(0.2, 0.0, 0, 1)',
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
  },

  // Spring configs
  spring: {
    gentle: { type: 'spring' as const, stiffness: 120, damping: 14 },
    default: { type: 'spring' as const, stiffness: 170, damping: 20 },
    bouncy: { type: 'spring' as const, stiffness: 200, damping: 12 },
    snappy: { type: 'spring' as const, stiffness: 300, damping: 25 },
  },
};

// Touch target minimum size
export const touchTarget = {
  minSize: 48, // 48dp minimum for Android
  recommended: 56, // 56dp recommended for important actions
};

// Material Design 3 State Layers (for interactive elements)
export const stateLayers = {
  hover: {
    light: 'rgba(14, 165, 233, 0.08)', // 8% primary
    dark: 'rgba(125, 211, 252, 0.08)',
  },
  focus: {
    light: 'rgba(14, 165, 233, 0.12)', // 12% primary
    dark: 'rgba(125, 211, 252, 0.12)',
  },
  press: {
    light: 'rgba(14, 165, 233, 0.16)', // 16% primary
    dark: 'rgba(125, 211, 252, 0.16)',
  },
  drag: {
    light: 'rgba(14, 165, 233, 0.16)',
    dark: 'rgba(125, 211, 252, 0.16)',
  },
};

export default { lightTheme, darkTheme, getTheme, animations, touchTarget, stateLayers };
