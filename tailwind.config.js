/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { panel: '#101724', ink: '#070d17', accent: '#56ebc3', violet: '#9485ff', muted: '#8c97ab' },
    fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'], mono: ['JetBrains Mono', 'ui-monospace', 'monospace'] },
    boxShadow: { glow: '0 0 38px rgba(77,234,193,.11)' }
  } },
  plugins: []
};
