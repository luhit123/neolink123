/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Legacy medical colors (kept for compatibility)
                'medical-teal': '#0EA5E9',
                'medical-teal-light': '#38BDF8',
                'medical-blue': '#0284C7',
                'medical-blue-light': '#0EA5E9',
                'medical-green': '#16A34A',
                'medical-red': '#B91C1C',
                'medical-orange': '#C2410C',
                'hospital-bg': '#E0F2FE',
                'hospital-card': '#FFFFFF',

                // Material Design 3 Color Roles
                md: {
                    // Primary (Medical Teal)
                    primary: {
                        DEFAULT: '#0EA5E9',
                        dark: '#7DD3FC',
                    },
                    'on-primary': {
                        DEFAULT: '#FFFFFF',
                        dark: '#075985',
                    },
                    'primary-container': {
                        DEFAULT: '#E0F2FE',
                        dark: '#0C4A6E',
                    },
                    'on-primary-container': {
                        DEFAULT: '#075985',
                        dark: '#E0F2FE',
                    },

                    // Secondary
                    secondary: {
                        DEFAULT: '#0284C7',
                        dark: '#38BDF8',
                    },
                    'on-secondary': {
                        DEFAULT: '#FFFFFF',
                        dark: '#0C4A6E',
                    },

                    // Tertiary (Medical Green)
                    tertiary: {
                        DEFAULT: '#16A34A',
                        dark: '#4ADE80',
                    },

                    // Error
                    error: {
                        DEFAULT: '#DC2626',
                        dark: '#F87171',
                    },
                    'on-error': {
                        DEFAULT: '#FFFFFF',
                        dark: '#7F1D1D',
                    },

                    // Surface
                    background: {
                        DEFAULT: '#F8FAFC',
                        dark: '#0F172A',
                    },
                    'on-background': {
                        DEFAULT: '#0F172A',
                        dark: '#F8FAFC',
                    },
                    surface: {
                        DEFAULT: '#FFFFFF',
                        dark: '#1E293B',
                    },
                    'on-surface': {
                        DEFAULT: '#1E293B',
                        dark: '#E2E8F0',
                    },
                    'surface-variant': {
                        DEFAULT: '#F1F5F9',
                        dark: '#334155',
                    },

                    // Outline
                    outline: {
                        DEFAULT: '#CBD5E1',
                        dark: '#475569',
                    },
                },
            },
            boxShadow: {
                // Material Design 3 Elevation System
                'md-elevation-0': '0 0 0 0 rgba(0, 0, 0, 0)',
                'md-elevation-1': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                'md-elevation-2': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                'md-elevation-3': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                'md-elevation-4': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                'md-elevation-5': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            },
            spacing: {
                // Material Design 8dp grid system
                '0.5': '2px',
                '1': '4px',
                '1.5': '6px',
                '2': '8px',
                '3': '12px',
                '4': '16px',
                '5': '20px',
                '6': '24px',
                '7': '28px',
                '8': '32px',
                '10': '40px',
                '12': '48px', // Minimum touch target
                '14': '56px', // Recommended touch target
                '16': '64px',
                '20': '80px',
            },
            scale: {
                '98': '0.98', // For active/pressed states
            },
            transitionDuration: {
                // Material Design motion durations
                '50': '50ms',
                '100': '100ms',
                '150': '150ms',
                '200': '200ms',
                '250': '250ms',
                '300': '300ms',
                '350': '350ms',
                '400': '400ms',
                '450': '450ms',
                '500': '500ms',
                '600': '600ms',
            },
            transitionTimingFunction: {
                // Material Design easing curves
                'standard': 'cubic-bezier(0.4, 0.0, 0.2, 1)',
                'emphasized': 'cubic-bezier(0.2, 0.0, 0, 1)',
                'decelerate': 'cubic-bezier(0.0, 0.0, 0.2, 1)',
                'accelerate': 'cubic-bezier(0.4, 0.0, 1, 1)',
            },
            animation: {
                'ripple': 'ripple 600ms cubic-bezier(0.4, 0.0, 0.2, 1)',
                'shimmer': 'shimmer 2s infinite',
                'slide-up': 'slide-up 300ms cubic-bezier(0.4, 0.0, 0.2, 1)',
                'slide-down': 'slide-down 300ms cubic-bezier(0.4, 0.0, 0.2, 1)',
                'fade-in': 'fade-in 200ms cubic-bezier(0.4, 0.0, 0.2, 1)',
                'fade-out': 'fade-out 200ms cubic-bezier(0.4, 0.0, 0.2, 1)',
            },
            keyframes: {
                ripple: {
                    '0%': { transform: 'scale(0)', opacity: '1' },
                    '100%': { transform: 'scale(1)', opacity: '0' },
                },
                shimmer: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' },
                },
                'slide-up': {
                    '0%': { transform: 'translateY(100%)' },
                    '100%': { transform: 'translateY(0)' },
                },
                'slide-down': {
                    '0%': { transform: 'translateY(-100%)' },
                    '100%': { transform: 'translateY(0)' },
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'fade-out': {
                    '0%': { opacity: '1' },
                    '100%': { opacity: '0' },
                },
            },
        },
    },
    plugins: [],
}
