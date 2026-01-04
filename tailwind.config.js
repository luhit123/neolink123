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
                'medical-teal': '#0EA5E9',
                'medical-teal-light': '#38BDF8',
                'medical-blue': '#0284C7',
                'medical-blue-light': '#0EA5E9',
                'medical-green': '#16A34A',
                'medical-red': '#B91C1C',
                'medical-orange': '#C2410C',
                'hospital-bg': '#E0F2FE',
                'hospital-card': '#FFFFFF',
            },
        },
    },
    plugins: [],
}
