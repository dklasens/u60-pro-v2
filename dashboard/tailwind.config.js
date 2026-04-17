/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F2F5F9',
        'glass': 'rgba(255, 255, 255, 0.45)',
        'glass-hover': 'rgba(255, 255, 255, 0.60)',
        'glass-border': 'rgba(255, 255, 255, 0.50)',
        'glass-subtle': 'rgba(255, 255, 255, 0.30)',
        'glass-elevated': 'rgba(255, 255, 255, 0.60)',
        primary: {
          DEFAULT: '#3B8BEB',
          hover: '#2A7AD8',
          subtle: 'rgba(59, 139, 235, 0.10)',
        },
        accent: {
          DEFAULT: '#F0923B',
          hover: '#E07E2A',
          subtle: 'rgba(240, 146, 59, 0.10)',
        },
        text: {
          primary: '#1E293B',
          secondary: '#475569',
          muted: '#94A3B8',
        },
        divider: 'rgba(148, 163, 184, 0.20)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        glass: '20px',
        pill: '12px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(15, 23, 42, 0.08)',
        'glass-elevated': '0 16px 48px rgba(15, 23, 42, 0.12)',
        'glass-inner': 'inset 0 1px 0 rgba(255, 255, 255, 0.5)',
      },
      backdropBlur: {
        glass: '40px',
      },
    },
  },
  plugins: [],
}
