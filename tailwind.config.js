/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sunrise: '#F28C1A', // Sunrise Orange
        deepred: '#E6473A', // Deep Red Accent
        skyblue: '#2B84C6', // Signature Blue
        forest: '#3BAA66', // Forest Green
        charcoal: '#1E1E1E', // Charcoal Block
        softwhite: '#F9F9F1', // Soft White
        slate: '#3F3F3F', // Slate text
        mist: '#E4E7EB', // Mist border
        cloud: '#F4F5F7', // Soft surface
        ink: '#10172A', // Deep Ink
        gold: '#F6C87B', // Accent gold
        blue: {
          50: '#E7F1F8',
          100: '#CDE3F0',
          200: '#9BC7E1',
          300: '#6AACD3',
          400: '#3A90C7',
          500: '#2B84C6',
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
          500: '#3BAA66',
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
          500: '#E6473A',
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
          500: '#F28C1A',
          600: '#D67111',
          700: '#AF570C',
          800: '#7E3C07',
          900: '#4C2103',
        },
      },
      fontFamily: {
        heading: ['Montserrat', 'sans-serif'],
        body: ['Lato', 'Quicksand', 'sans-serif'],
      },
      borderRadius: {
        lg: '12px',
        xl: '16px',
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
