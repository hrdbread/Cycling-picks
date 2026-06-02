import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Press Start 2P everywhere for that old-school 8-bit text.
        arcade: ['"Press Start 2P"', 'monospace'],
        display: ['"Press Start 2P"', 'monospace'],
      },
      colors: {
        // Pure 4-shade monochrome — like the Game Boy Pocket / Pokemon Red
        // rendered in greyscale.
        pkm: {
          paper: '#f3f3ee',     // off-white "paper" (slight cream so it isn't blinding)
          chrome: '#bdbdb6',    // light gray
          shadow: '#5a5a55',    // mid gray
          stroke: '#0e0e0c',    // near-black ink
          highlight: '#fafaf2', // selected highlight
        },
      },
      keyframes: {
        slideInLeft: {
          '0%': { transform: 'translateX(-120%)', opacity: '0' },
          '70%': { transform: 'translateX(8%)', opacity: '1' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(120%)', opacity: '0' },
          '70%': { transform: 'translateX(-8%)', opacity: '1' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        vsZoom: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '60%': { transform: 'scale(1.4)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        flash: {
          '0%, 100%': { filter: 'invert(0)' },
          '50%': { filter: 'invert(1)' },
        },
        blink: {
          '0%, 60%': { opacity: '1' },
          '60.01%, 100%': { opacity: '0' },
        },
      },
      animation: {
        'slide-in-left': 'slideInLeft 0.6s steps(8, end) both',
        'slide-in-right': 'slideInRight 0.6s steps(8, end) both 0.1s',
        'vs-zoom': 'vsZoom 0.5s steps(6, end) both 0.4s',
        'flash': 'flash 0.6s steps(4, end) infinite',
        'blink': 'blink 1s steps(2, end) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
