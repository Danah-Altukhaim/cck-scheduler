import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cck: {
          // Primary brand: CCK Green (PMS 3425 C). Use this for headlines,
          // primary actions and main brand surfaces.
          green: '#006341',
          'green-dark': '#004D31',
          'green-light': '#76B82A', // New Growth Green (PMS 368 C) — secondary
          'green-tint': '#E6F0EB',
          // Red is reserved for the maple-leaf mark and error/destructive
          // states — never as a primary action color.
          red: '#B21F24',
          'red-dark': '#8C1A1E',
          paper: '#faf8f4',
          ink: '#0F1115',
          line: '#e6e1d6',
          'line-soft': '#f0ebde',
          muted: '#7a7468',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 0 #e6e1d6, 0 0 0 1px #e6e1d6',
      },
    },
  },
  plugins: [],
}

export default config
