import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f7ffe0',
          100: '#eeffc2',
          200: '#ddff85',
          300: '#ccff00',
          400: '#c2f200',
          500: '#b8e600',
          600: '#a3cc00',
          700: '#8fb300',
          800: '#7a9900',
          900: '#668000',
        },
        dark: {
          50: '#f6f6f6',
          100: '#e7e7e7',
          200: '#d1d1d1',
          300: '#b0b0b0',
          400: '#888888',
          500: '#6d6d6d',
          600: '#5d5d5d',
          700: '#4f4f4f',
          800: '#1a1a1a',
          900: '#111111',
          950: '#0a0a0a',
        },
      },
    },
  },
  plugins: [],
}
export default config
