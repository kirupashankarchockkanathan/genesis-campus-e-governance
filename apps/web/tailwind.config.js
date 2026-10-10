/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eaf5f1',
          100: '#d6ece5',
          200: '#b0d9cc',
          300: '#7fc0ad',
          400: '#4da189',
          500: '#23826a',
          600: '#12705c',
          700: '#0c5a4b',
          800: '#0b4a3f',
          900: '#093b33',
          950: '#062a25',
        },
        canvas: '#f4f7f5',
        ink: { DEFAULT: '#0c3b33', soft: '#5a736c', mute: '#8aa09a' },
        line: '#e3ebe7',
        amber: { soft: '#fdf3e1', ink: '#a8680f' },
        rose: { soft: '#fdeeed', ink: '#c0392b' },
        sky: { soft: '#e9f0fb', ink: '#3b64b8' },
        plum: { soft: '#f1eaf6', ink: '#7a4ea0' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(12,59,51,0.04), 0 4px 16px rgba(12,59,51,0.04)',
        pop: '0 20px 60px rgba(6,42,37,0.25)',
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.25rem' },
      keyframes: {
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        pop: { '0%': { opacity: 0, transform: 'scale(.96)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
      },
      animation: { fadeUp: 'fadeUp .35s ease both', pop: 'pop .2s ease both' },
    },
  },
  plugins: [],
};
