import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cck: {
          green: '#006341',
          'green-dark': '#004D31',
          'green-darker': '#00331f',
          'green-light': '#76B82A',
          'green-tint': '#e6f0eb',
          red: '#B21F24',
          'red-dark': '#8C1A1E',
          'red-tint': '#fdeded',
          paper: '#f7f5f0',
          'paper-2': '#efece5',
          surface: '#ffffff',
          'surface-2': '#fbfaf6',
          'surface-3': '#f1ede4',
          ink: '#1a1714',
          'ink-soft': '#3d3833',
          muted: '#7c7468',
          'muted-soft': '#a9a294',
          line: '#e6e1d6',
          'line-soft': '#efeadf',
          'line-strong': '#d4cdbc',
        },
        success: '#1b7a3d',
        warn: '#a86a08',
        danger: '#b21f24',
        info: '#1f5fb2',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
      },
      boxShadow: {
        xs: '0 1px 0 rgba(20, 16, 12, 0.04)',
        sm: '0 1px 2px rgba(20, 16, 12, 0.05), 0 1px 0 rgba(20, 16, 12, 0.04)',
        md: '0 4px 12px rgba(20, 16, 12, 0.06), 0 1px 0 rgba(20, 16, 12, 0.04)',
        lg: '0 16px 32px -8px rgba(20, 16, 12, 0.12), 0 6px 16px -6px rgba(20, 16, 12, 0.08)',
        xl: '0 32px 64px -12px rgba(20, 16, 12, 0.18), 0 12px 24px -12px rgba(20, 16, 12, 0.10)',
      },
      transitionTimingFunction: {
        'ease-out-soft': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}

export default config
