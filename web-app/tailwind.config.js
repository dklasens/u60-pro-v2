/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        slds: {
          blue: '#0176D3',
          blueHover: '#014486',
          bg: '#F3F3F3', // SLDS secondary background
          border: '#C9C9C9',
        }
      },
      boxShadow: {
        'macos': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'macos-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025), 0 0 0 1px rgba(0, 0, 0, 0.02)',
        'macos-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02), 0 0 0 1px rgba(0, 0, 0, 0.02)',
        'macos-focus': '0 0 0 3px rgba(1, 118, 211, 0.4)', // SLDS blue for focus
      }
    },
  },
  plugins: [],
}
