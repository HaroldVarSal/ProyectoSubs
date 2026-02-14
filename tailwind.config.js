/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'alchemy-dark': '#050505',
        'neon-cyan': '#00e5ff',
        'neon-purple': '#7b61ff',
      },
    },
  },
  plugins: [],
}