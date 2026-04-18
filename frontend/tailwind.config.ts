import type { Config } from 'tailwindcss'

// Tokens extracted from payy.network. See docs/DESIGN_SYSTEM.md — authoritative.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#000000',
          elevated: '#161616',
          raised: '#242424',
          high: '#363636',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#E9E9E9',
          tertiary: '#D9D9D9',
          muted: '#8A8A8A',
          onAccent: '#000000',
        },
        accent: {
          DEFAULT: '#E0FF32',
          warm: '#E0F029',
          subtle: 'rgba(224,255,50,0.15)',
          glow: 'rgba(224,255,50,0.35)',
        },
        danger: '#FF3B3B',
        warning: '#FFB800',
        info: '#4A9EFF',
      },
      fontFamily: {
        display: ['"Inter Variable"', 'Inter', 'Geist', 'sans-serif'],
        body: ['"Inter Variable"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        hero: ['clamp(100px, 18vw, 220px)', { lineHeight: '0.8', letterSpacing: '-0.08em' }],
        display: ['clamp(72px, 12vw, 180px)', { lineHeight: '0.9', letterSpacing: '-0.06em' }],
        h1: ['clamp(56px, 8vw, 132px)', { lineHeight: '1', letterSpacing: '-0.04em' }],
        h2: ['clamp(40px, 5vw, 100px)', { lineHeight: '1', letterSpacing: '-0.03em' }],
        h3: ['40px', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        sm: '8px',
        md: '18px',
        lg: '24px',
        xl: '36px',
        '2xl': '48px',
      },
    },
  },
  plugins: [],
} satisfies Config
