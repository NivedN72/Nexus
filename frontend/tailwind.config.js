/** @type {import('tailwindcss').Config} */
export default {
  content: { relative: true, files: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'] },
  theme: {
    extend: {
      colors: {"canvas": "#eef0f5", "surface": "#ffffff", "soft": "#f6f7f9", "ink": "#242426", "muted": "#5d6069", "line": "#dfe2e8", "accent": "#d1ff5f", "accent-hover": "#c1ef4f", "accent-ink": "#41581c", "success": "#24633c", "warning": "#795316", "danger": "#9b2a3b"},
      fontFamily: { sans: ['Inter Display', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] },
    },
  },
  plugins: [],
};
