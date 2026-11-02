/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        volcano: {
          orange: '#ff5e13',
          red: '#e62e00',
          yellow: '#ffba08',
          dark: '#140c0b'
        }
      }
    },
  },
  plugins: [],
};
