import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: {
          50:  '#faf7f2',
          100: '#f5f0e8',
          200: '#ede3d0',
          300: '#ddd0b8',
          400: '#c9b99a',
        },
        ink: {
          900: '#1c1814',
          700: '#3d3329',
          500: '#6b5c48',
          300: '#a8967f',
        },
        amber: {
          400: '#f59e0b',
          500: '#d97706',
          600: '#b45309',
        },
        sage: {
          200: '#d1e8d4',
          600: '#4a7c59',
          700: '#3a6147',
        },
        crimson: {
          100: '#fce8e8',
          200: '#f8d0d0',
          600: '#b91c1c',
          700: '#991b1b',
        },
        stone: {
          100: '#f5f5f4',
          200: '#e7e5e4',
          600: '#57534e',
          700: '#44403c',
        },
      },
      fontFamily: {
        display: ['"Crimson Text"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:  '0 1px 3px rgba(28,24,20,0.06)',
        modal: '0 8px 32px rgba(28,24,20,0.18)',
      },
    },
  },
  plugins: [],
} satisfies Config;
