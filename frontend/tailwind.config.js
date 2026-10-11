/** @type {import('tailwindcss').Config} */
export default {
  content: { relative: true, files: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'] },
  theme: {
    extend: {
      colors: {
        'canvas': 'rgb(var(--color-canvas) / <alpha-value>)',
        'surface': 'rgb(var(--color-surface) / <alpha-value>)',
        'soft': 'rgb(var(--color-soft) / <alpha-value>)',
        'ink': 'rgb(var(--color-ink) / <alpha-value>)',
        'muted': 'rgb(var(--color-muted) / <alpha-value>)',
        'line': 'rgb(var(--color-line) / <alpha-value>)',
        'accent': 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--color-accent-hover) / <alpha-value>)',
        'accent-ink': 'rgb(var(--color-accent-ink) / <alpha-value>)',
        'accent-text': 'rgb(var(--color-accent-text) / <alpha-value>)',
        'success': 'rgb(var(--color-success) / <alpha-value>)',
        'warning': 'rgb(var(--color-warning) / <alpha-value>)',
        'danger': 'rgb(var(--color-danger) / <alpha-value>)',
      },
      fontFamily: { sans: ['Inter Display', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] },
    },
  },
  plugins: [],
};
