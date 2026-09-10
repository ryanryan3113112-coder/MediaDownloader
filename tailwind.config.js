/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        discord: {
          blurple: '#5865F2',
          'blurple-hover': '#4752c4',
          dark: '#313338',
          darker: '#2b2d31',
          darkest: '#1e1f22',
          card: '#141517',
          sidebar: '#111214'
        },
        rpjg: {
          bg: '#080c16',
          panel: '#0f172a',
          surface: '#151f38',
          border: '#1e293b',
          borderHighlight: 'rgba(56, 189, 248, 0.4)',
          cyan: '#06b6d4',
          neon: '#38bdf8',
          glow: '#00f0ff',
          gold: '#f59e0b',
          goldGlow: '#fbbf24'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans TC', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Fira Code', 'Consolas', 'Monaco', 'monospace']
      },
      boxShadow: {
        'glow-cyan': '0 0 25px rgba(0, 240, 255, 0.35)',
        'glow-blurple': '0 0 25px rgba(88, 101, 242, 0.35)',
        'glow-gold': '0 0 25px rgba(245, 158, 11, 0.35)',
        'card': '0 10px 30px -10px rgba(0, 0, 0, 0.7)'
      }
    },
  },
  plugins: [],
};
