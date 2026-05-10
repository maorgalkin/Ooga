/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'media', // Use OS/browser preference for dark mode
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Theme colors - dynamically generated, must be safelisted
    // Background colors
    { pattern: /bg-(purple|blue|green|indigo)-(100|200|400|500|600|700)/, variants: ['hover', 'dark'] },
    // Text colors  
    { pattern: /text-(purple|blue|green|indigo)-(400|600|700|900)/, variants: ['dark'] },
    // Border colors
    { pattern: /border-(purple|blue|green|indigo)-(300|500|600|800)/, variants: ['dark'] },
    // Gradient colors
    { pattern: /from-(purple|blue|green|indigo)-500/ },
    { pattern: /to-(purple|blue|green|indigo)-600/ },
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
