// ── Green brand palette ───────────────────────────────────────────────────────
export const Green = {
  950: '#061a12',
  900: '#0b2a1d',
  800: '#0f3d2a',
  700: '#155239',
  600: '#1f7a52',
  500: '#2aa274',
  400: '#46c98e',
  300: '#8de2bb',
  200: '#c6f2dc',
  100: '#e6f8ee',
  50:  '#f1faf4',
} as const;

// ── Ink / neutral palette ─────────────────────────────────────────────────────
export const Ink = {
  base:    '#0a1f17',   // primary text
  2:       '#2a3a32',   // secondary text
  3:       '#5a6b62',   // tertiary / labels / meta
  4:       '#8a9990',   // disabled / hint
  bg:      '#f5f7f3',   // page background
  surface: '#ffffff',   // card surface
  line:    '#e3ebe4',   // dividers, default borders
  line2:   '#d6e0d8',   // stronger borders
} as const;

// ── Semantic tint pairs ───────────────────────────────────────────────────────
export const Tint = {
  rose:   { bg: '#fbe9e6', ink: '#b94a3a', line: '#f3cfc7' },
  mint:   { bg: '#e2f3ea', ink: '#1f7a52', line: '#c7e5d2' },
  sky:    { bg: '#e4ecf6', ink: '#2c5aa0', line: '#cbd9ea' },
  sun:    { bg: '#f6ecd4', ink: '#a87413', line: '#ecdcaf' },
  violet: { bg: '#ece9f7', ink: '#5b48a8', line: '#ddd6f0' },
} as const;

export type TintName = keyof typeof Tint;

// ── Legacy color aliases (kept for backward compat) ───────────────────────────
export const Colors = {
  // Legacy names — screens still reference these
  forest:    Green[700],
  leaf:      Green[500],
  mist:      Green[50],
  ink:       Ink.base,
  inkLight:  Ink[3],
  white:     '#FFFFFF',
  red:       Tint.rose.ink,
  yellow:    '#F0AD4E',
  green:     Green[500],
  border:    Ink.line,
  cardBg:    Ink.surface,
  amber:     Tint.sun.ink,
  // New semantic aliases
  pageBg:    Ink.bg,
  surface:   Ink.surface,
  line:      Ink.line,
  inkBase:   Ink.base,
  ink2:      Ink[2],
  ink3:      Ink[3],
  ink4:      Ink[4],
  // Brand greens (convenient shorthand)
  green900:  Green[900],
  green800:  Green[800],
  green700:  Green[700],
  green600:  Green[600],
  green500:  Green[500],
  green400:  Green[400],
  green300:  Green[300],
  green200:  Green[200],
  green100:  Green[100],
  green50:   Green[50],
};

// ── Typography ────────────────────────────────────────────────────────────────
const FONT = 'Montserrat';

export const Typography = {
  // Legacy keys — used throughout existing screens
  display:  { fontFamily: FONT, fontSize: 28, fontWeight: '800' as const, color: Colors.forest },
  heading1: { fontFamily: FONT, fontSize: 20, fontWeight: '700' as const, color: Colors.ink },
  heading2: { fontFamily: FONT, fontSize: 15, fontWeight: '700' as const, color: Colors.ink },
  body:     { fontFamily: FONT, fontSize: 13, fontWeight: '400' as const, color: Colors.inkLight },
  label:    {
    fontFamily: FONT, fontSize: 11, fontWeight: '600' as const,
    color: Colors.ink, textTransform: 'uppercase' as const, letterSpacing: 0.8,
  },
  // Extended scale from design spec
  h1:       { fontFamily: FONT, fontSize: 30, fontWeight: '700' as const, letterSpacing: -1.5 },
  h3:       { fontFamily: FONT, fontSize: 15, fontWeight: '700' as const, letterSpacing: -0.075 },
  kpiValue: { fontFamily: FONT, fontSize: 38, fontWeight: '700' as const, letterSpacing: -1.75 },
  statLabel:{ fontFamily: FONT, fontSize: 11.5, fontWeight: '600' as const, letterSpacing: 0.35 },
  bodyMd:   { fontFamily: FONT, fontSize: 13, fontWeight: '500' as const },
  bodySm:   { fontFamily: FONT, fontSize: 12, fontWeight: '500' as const },
  brandName:{ fontFamily: FONT, fontSize: 18, fontWeight: '800' as const, letterSpacing: 1.44 },
  capsLabel:{ fontFamily: FONT, fontSize: 10.5, fontWeight: '600' as const, letterSpacing: 1.47, textTransform: 'uppercase' as const },
};

// ── Spacing ───────────────────────────────────────────────────────────────────
export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
  // Design spec values
  s4:  4,
  s6:  6,
  s8:  8,
  s10: 10,
  s12: 12,
  s14: 14,
  s16: 16,
  s18: 18,
  s20: 20,
  s22: 22,
  s24: 24,
  s28: 28,
  s32: 32,
  s40: 40,
};

// ── Radius ────────────────────────────────────────────────────────────────────
export const Radius = {
  sm:   8,   // pills, chips, small badges
  md:   12,  // calendar cards
  lg:   14,  // KPI / Open Day / professor cards
  xl:   18,  // section containers
  pill: 999,
};

// ── Shadow (approximated for React Native) ────────────────────────────────────
export const Shadow = {
  sm: {
    shadowColor: '#0a1f17',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#0a1f17',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
};

// ── Breakpoints ───────────────────────────────────────────────────────────────
export const Breakpoints = {
  tablet:  760,
  desktop: 1100,
  wide:    1400,
};
