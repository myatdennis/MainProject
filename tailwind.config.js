/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Huddle Co. exact brand tokens
        sunrise: '#de7b12', // Sunrise Orange (updated per spec)
        deepred: '#D72638', // Deep Red Accent
        skyblue: '#3A7DFF', // Sky Blue
        forest: '#228B22', // Forest Green
        charcoal: '#1E1E1E', // Charcoal Block
        softwhite: '#F9F9F1', // Soft White
        slate: '#3F3F3F', // Slate text
        mist: '#E4E7EB', // Mist border
        cloud: '#F4F5F7', // Soft surface
        ink: '#222222', // Ink / Headlines
        navy: '#1E1E22', // Dark Navy
        hudbg: '#FFFDF9', // Soft site background
        gold: '#F6C87B', // Accent gold
        mutedgrey: '#9CA3AF',
        gray: {
          50: '#F8F9FB',
          100: '#F4F5F7',
          200: '#E4E7EB',
          300: '#C8CDD5',
          400: '#A0A6B1',
          500: '#7E8694',
          600: '#545454',
          700: '#3A3D45',
          800: '#1E1E22',
          900: '#0E1016',
        },
        blue: {
          50: '#E7F1F8',
          100: '#CDE3F0',
          200: '#9BC7E1',
          300: '#6AACD3',
          400: '#3A90C7',
          500: '#3A7DFF',
          600: '#206AA3',
          700: '#15507C',
          800: '#0F3856',
          900: '#082131',
        },
        green: {
          50: '#E6F6ED',
          100: '#C3EAD5',
          200: '#8BD7AD',
          300: '#58C386',
          400: '#3FB870',
          500: '#228B22',
          600: '#2F8B53',
          700: '#236A40',
          800: '#16472C',
          900: '#0C291A',
        },
        red: {
          50: '#FCEAEA',
          100: '#F7CDCD',
          200: '#EE9F9D',
          300: '#E5716E',
          400: '#DF524F',
          500: '#D72638',
          600: '#BF382D',
          700: '#962A22',
          800: '#6C1C17',
          900: '#40100D',
        },
        orange: {
          50: '#FFF3E6',
          100: '#FFE0BF',
          200: '#FFB973',
          300: '#FF9433',
          400: '#FA7E15',
          // Align mid-scale to brand orange
          500: '#de7b12',
          600: '#D67111',
          700: '#AF570C',
          800: '#7E3C07',
          900: '#4C2103',
        },
        amber: {
          50: '#FFF7EC',
          100: '#FFEFD6',
          200: '#FFD9A8',
          300: '#FFC070',
          400: '#FFAA3F',
          500: '#de7b12',
          600: '#C7670A',
          700: '#A25107',
          800: '#723604',
          900: '#432002',
        },
      },
      fontFamily: {
        heading: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '12px',
        xl: '16px',
        surface: '24px',
        btn: '14px',
      },
      boxShadow: {
        card: '0 4px 12px rgba(0,0,0,0.08)',
      },
      spacing: {
        card: '32px',
        modal: '32px',
      },
      fontSize: {
        h1: ['2.5rem', { lineHeight: '1.2', fontWeight: '700' }], // 40px
        h2: ['1.75rem', { lineHeight: '1.3', fontWeight: '700' }], // 28px
        h3: ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }], // 20px
        body: ['1rem', { lineHeight: '1.6', fontWeight: '400' }], // 16px
        small: ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }], // 14px
      },
    },
  },
  plugins: [],
};
