// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'caretFlash': 'caretFlash 1s ease-in-out infinite',
        'fadeIn': 'fadeIn 0.3s ease-in',
      },
      keyframes: {
        caretFlash: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        fadeIn: {
          'from': { opacity: '0', transform: 'translateY(-10px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      colors: {
        // You can add custom colors from your app.config.js here
        // For example:
        // correct: 'var(--theme-correct)',
        // incorrect: 'var(--theme-incorrect)',
      }
    },
  },
  plugins: [],
}