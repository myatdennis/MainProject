import { Platform } from 'react-native';

const isIOS = Platform.OS === 'ios';

export const fonts = {
  display: isIOS ? 'System' : 'sans-serif',
  body: isIOS ? 'System' : 'sans-serif',
  mono: isIOS ? 'Courier' : 'monospace',
} as const;

export const fontSizes = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 34,
  '4xl': 40,
} as const;

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const lineHeights = {
  tight: 1.2,
  base: 1.5,
  relaxed: 1.75,
} as const;
