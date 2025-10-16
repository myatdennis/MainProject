import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          soft: 'var(--color-primary-soft)',
          strong: 'var(--color-primary-strong)',
          foreground: 'var(--color-on-primary)'
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          soft: 'var(--color-secondary-soft)',
          foreground: 'var(--color-on-secondary)'
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          foreground: 'var(--color-on-accent)'
        },
        info: {
          DEFAULT: 'var(--color-info)',
          soft: 'var(--color-info-soft)',
          border: 'var(--color-info-border)',
          foreground: 'var(--color-on-info)'
        },
        success: {
          DEFAULT: 'var(--color-success)',
          soft: 'var(--color-success-soft)',
          border: 'var(--color-success-border)',
          foreground: 'var(--color-on-success)'
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          soft: 'var(--color-warning-soft)',
          border: 'var(--color-warning-border)',
          foreground: 'var(--color-on-warning)'
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          soft: 'var(--color-danger-soft)',
          border: 'var(--color-danger-border)',
          foreground: 'var(--color-on-danger)'
        },
        background: 'var(--color-background)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          subtle: 'var(--color-surface-subtle)',
          elevated: 'var(--color-surface-elevated)',
          inverse: 'var(--color-surface-inverse)'
        },
        inverse: {
          foreground: 'var(--color-surface-inverse-foreground)'
        },
        foreground: {
          DEFAULT: 'var(--color-foreground)',
          subtle: 'var(--color-foreground-subtle)'
        },
        muted: {
          DEFAULT: 'var(--color-muted)'
        },
        border: {
          DEFAULT: 'var(--color-border)',
          subtle: 'var(--color-border-subtle)'
        },
        overlay: {
          soft: 'var(--color-overlay-soft)',
          DEFAULT: 'var(--color-overlay)',
          strong: 'var(--color-overlay-strong)'
        },
        focus: 'var(--color-focus-ring)'
      },
      fontFamily: {
        heading: ['Montserrat', ...defaultTheme.fontFamily.sans],
        body: ['Lato', ...defaultTheme.fontFamily.sans],
        accent: ['Quicksand', ...defaultTheme.fontFamily.sans]
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)'
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        modal: 'var(--shadow-modal)',
        focus: '0 0 0 4px var(--color-focus-ring)'
      },
      transitionDuration: {
        fast: '150ms',
        brand: '220ms',
        slow: '320ms'
      },
      transitionTimingFunction: {
        brand: 'var(--ease-brand)'
      }
    },
    container: {
      center: true,
      padding: {
        DEFAULT: '1.5rem',
        lg: '2rem',
        xl: '3rem'
      }
    }
  },
  plugins: []
};
