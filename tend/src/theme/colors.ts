export const colors = {
  // Backgrounds
  background: '#F8F7F4',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F1EE',

  // Borders
  border: '#E8E6E1',

  // Text
  textPrimary: '#1A1917',
  textSecondary: '#7A7672',

  // Brand
  accent: '#5B6AF0',
  accentWarm: '#E8824A',

  // Status
  success: '#4CAF82',
  warning: '#F0B429',
  danger: '#E05252',
  rehab: '#A78BFA',

  // Transparent
  overlay: 'rgba(0,0,0,0.4)',
  shadow: 'rgba(0,0,0,0.06)',
} as const;

export type Color = keyof typeof colors;
