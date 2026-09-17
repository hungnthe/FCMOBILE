/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fifa: {
          dark: '#0a0e17',
          cardBg: '#131b2e',
          gold: '#f5c542',
          goldGlow: '#ffd700',
          toty: '#0052cc',
          icon: '#d4af37',
          futties: '#ff007f',
          hero: '#00c853',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
        display: ['Rajdhani', 'Outfit', 'sans-serif']
      },
      boxShadow: {
        'gold-glow': '0 0 25px rgba(245, 197, 66, 0.4)',
        'toty-glow': '0 0 25px rgba(0, 150, 255, 0.5)',
        'futties-glow': '0 0 25px rgba(255, 0, 127, 0.5)',
        'icon-glow': '0 0 25px rgba(212, 175, 55, 0.5)',
      }
    },
  },
  plugins: [],
}
