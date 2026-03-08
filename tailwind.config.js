/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0e1a',
        surface: '#111827',
        surface2: '#1a2235',
        border: '#1e2d45',
        accent: '#00d4aa',
        patient: '#3b82f6',
        donor: '#10b981',
        clinic: '#8b5cf6',
        muted: '#64748b',
      },
      fontFamily: {
        mono: ['Space Mono', 'monospace'],
        sans: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
