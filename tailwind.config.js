/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sand: {
          50: '#faf8f3',
          100: '#f5f0e6',
          200: '#e9dfc8',
          300: '#d6c4a0',
          400: '#bd9f74',
          500: '#a0824f',
          600: '#836740',
          700: '#665135',
          800: '#4a3a27',
          900: '#312818',
        },
        field: {
          50: '#f0f6ee',
          100: '#dcecd6',
          200: '#b9d4ad',
          300: '#8fb87e',
          400: '#6b9a54',
          500: '#527e3e',
          600: '#3f6230',
          700: '#324e27',
          800: '#243a1d',
          900: '#16261100',
        },
        ink: {
          50: '#f7f6f4',
          100: '#eeece6',
          200: '#d9d6cc',
          300: '#b7b1a3',
          400: '#8a8576',
          500: '#67625a',
          600: '#4a463f',
          700: '#332f2a',
          800: '#1f1d1a',
          900: '#131210',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(22,20,15,0.04), 0 8px 24px -12px rgba(22,20,15,0.12)',
        card: '0 1px 3px rgba(22,20,15,0.06), 0 12px 32px -18px rgba(22,20,15,0.18)',
      },
    },
  },
  plugins: [],
};
