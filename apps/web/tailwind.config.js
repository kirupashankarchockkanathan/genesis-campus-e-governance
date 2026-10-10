/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Open Sans"', '"Proxima Nova"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Amrita brand identity (amrita.edu/branding): AM Maroon #A4123F is the primary colour (600),
        // black 90% (#1A1A1A) the secondary. Never the Amrita Vidyalayam blue (#033368).
        brand: {
          50: '#fbeff3',
          100: '#f7dde5',
          200: '#eebccc',
          300: '#e08ea8',
          400: '#cb5b7d',
          500: '#b82c58',
          600: '#a4123f',
          700: '#8a0f35',
          800: '#730d2d',
          900: '#5a0a24',
          950: '#3d0617',
        },
        // Success (approved, verified, registration open) stays green so it never reads as the brand red.
        ok: { 50: '#e8f5ee', 500: '#2a9d6a', 700: '#1b7a4f' },
        canvas: '#f7f5f5',
        ink: { DEFAULT: '#1a1a1a', soft: '#5b5557', mute: '#8f8789' },
        line: '#e9e4e5',
        amber: { soft: '#fdf3e1', ink: '#a8680f' },
        rose: { soft: '#fdeeed', ink: '#c0392b' },
        sky: { soft: '#e9f0fb', ink: '#3b64b8' },
        plum: { soft: '#f1eaf6', ink: '#7a4ea0' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(26,26,26,0.05), 0 4px 16px rgba(26,26,26,0.05)',
        pop: '0 20px 60px rgba(58,5,22,0.28)',
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
