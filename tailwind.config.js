/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          black: 'var(--color-black)',
          red: 'var(--color-red)',
          'red-dark': 'var(--color-red-dark)',
          green: 'var(--color-green)',
          'green-dark': 'var(--color-green-dark)',
          gray: 'var(--color-gray)',
          'gray-light': 'var(--color-gray-light)',
          bg: 'var(--color-bg)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
