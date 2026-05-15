export const Colors = {
  forest: '#1A5C38',
  leaf: '#3A8F5F',
  mist: '#F2FAF5',
  ink: '#1A1A1A',
  inkLight: 'rgba(26,26,26,0.6)',
  white: '#FFFFFF',
  red: '#D9534F',
  yellow: '#F0AD4E',
  green: '#3A8F5F',
  border: '#E0EDE6',
  cardBg: '#FFFFFF',
  amber: '#F59E0B',
};

export const Typography = {
  display: { fontSize: 28, fontWeight: '800' as const, color: Colors.forest },
  heading1: { fontSize: 20, fontWeight: '700' as const, color: Colors.ink },
  heading2: { fontSize: 15, fontWeight: '700' as const, color: Colors.ink },
  body: { fontSize: 13, fontWeight: '400' as const, color: Colors.inkLight },
  label: { fontSize: 11, fontWeight: '600' as const, color: Colors.ink, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};
