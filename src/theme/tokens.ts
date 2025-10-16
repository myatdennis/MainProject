export type ThemeMode = 'light' | 'dark';

type TokenValue = string | number;

type TokenDictionary<T extends TokenValue = TokenValue> = Record<string, T>;

export const colorTokens: Record<ThemeMode, TokenDictionary> = {
  light: {
    primary: '#FF8895',
    primaryStrong: '#FF6F80',
    primarySoft: '#FFE5E8',
    secondary: '#D72638',
    secondarySoft: '#FDE2E5',
    accent: '#3A7FFF',
    success: '#2D9B66',
    successSoft: '#E6F4EF',
    successBorder: '#B8E4CF',
    warning: '#F5A524',
    warningSoft: '#FFF3D6',
    warningBorder: '#F7D79C',
    danger: '#D72638',
    dangerSoft: '#FDE2E5',
    dangerBorder: '#F5B7BF',
    info: '#3A7FFF',
    infoSoft: '#E6EEFF',
    infoBorder: '#C3D4FF',
    background: '#F9FAFB',
    surface: '#FFFFFF',
    surfaceSubtle: '#F3F4F6',
    surfaceElevated: '#FFFFFF',
    surfaceInverse: '#111827',
    surfaceInverseForeground: '#F9FAFB',
    foreground: '#1F2933',
    foregroundSubtle: '#374151',
    muted: '#6B7280',
    border: '#E5E7EB',
    borderSubtle: '#ECEEF3',
    focusRing: 'rgba(58, 127, 255, 0.35)',
    overlay: 'rgba(17, 24, 39, 0.55)',
    overlayStrong: 'rgba(17, 24, 39, 0.75)'
  },
  dark: {
    primary: '#FF97A3',
    primaryStrong: '#FF6B7D',
    primarySoft: 'rgba(255, 136, 149, 0.18)',
    secondary: '#F04A5A',
    secondarySoft: 'rgba(240, 74, 90, 0.2)',
    accent: '#6EA0FF',
    success: '#43C586',
    successSoft: 'rgba(67, 197, 134, 0.2)',
    successBorder: 'rgba(67, 197, 134, 0.45)',
    warning: '#F5C66D',
    warningSoft: 'rgba(245, 198, 109, 0.24)',
    warningBorder: 'rgba(245, 198, 109, 0.5)',
    danger: '#FF4D62',
    dangerSoft: 'rgba(255, 77, 98, 0.22)',
    dangerBorder: 'rgba(255, 77, 98, 0.5)',
    info: '#6EA0FF',
    infoSoft: 'rgba(110, 160, 255, 0.22)',
    infoBorder: 'rgba(110, 160, 255, 0.5)',
    background: '#111827',
    surface: '#1F2937',
    surfaceSubtle: '#161F2A',
    surfaceElevated: '#242F3D',
    surfaceInverse: '#F9FAFB',
    surfaceInverseForeground: '#0B1220',
    foreground: '#F9FAFB',
    foregroundSubtle: '#E5E7EB',
    muted: '#9CA3AF',
    border: '#2D3646',
    borderSubtle: '#1F2734',
    focusRing: 'rgba(110, 160, 255, 0.45)',
    overlay: 'rgba(3, 7, 18, 0.7)',
    overlayStrong: 'rgba(3, 7, 18, 0.85)'
  }
};

export const typographyTokens = {
  headingFont: 'Montserrat',
  bodyFont: 'Lato',
  accentFont: 'Quicksand',
  scale: {
    h1: { size: '2.25rem', weight: 700, lineHeight: 1.3 },
    h2: { size: '1.75rem', weight: 600, lineHeight: 1.35 },
    h3: { size: '1.5rem', weight: 600, lineHeight: 1.4 },
    body: { size: '1rem', weight: 400, lineHeight: 1.6 },
    small: { size: '0.875rem', weight: 400, lineHeight: 1.5 }
  }
};

export const radiusTokens = {
  xs: '6px',
  sm: '8px',
  md: '10px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  pill: '999px'
};

export const shadowTokens = {
  card: '0 20px 45px -24px rgba(17, 24, 39, 0.25)',
  cardDark: '0 18px 44px -20px rgba(3, 7, 18, 0.65)',
  modal: '0 30px 70px -35px rgba(17, 24, 39, 0.45)',
  modalDark: '0 40px 80px -32px rgba(3, 7, 18, 0.8)',
  focus: '0 0 0 4px rgba(58, 127, 255, 0.35)'
};

export const spacingTokens: TokenDictionary = {
  xs: '0.5rem',
  sm: '0.75rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem'
};

export const animationTokens = {
  durations: {
    fast: '150ms',
    base: '220ms',
    slow: '320ms'
  },
  easing: {
    brand: 'cubic-bezier(0.4, 0, 0.2, 1)',
    entrance: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)'
  }
};

export const themeMeta = {
  brand: 'The Huddle Co.',
  version: '2025.02',
  updatedAt: new Date().toISOString()
};

export type DesignTokens = {
  colors: typeof colorTokens;
  typography: typeof typographyTokens;
  radii: typeof radiusTokens;
  shadows: typeof shadowTokens;
  spacing: typeof spacingTokens;
  animation: typeof animationTokens;
  meta: typeof themeMeta;
};

export const designTokens: DesignTokens = {
  colors: colorTokens,
  typography: typographyTokens,
  radii: radiusTokens,
  shadows: shadowTokens,
  spacing: spacingTokens,
  animation: animationTokens,
  meta: themeMeta
};
