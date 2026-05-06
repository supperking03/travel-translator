// ─── Travel Translator Design System Tokens ───────────────────────────────────
import { useColorScheme } from 'react-native';

// ── Color palettes ────────────────────────────────────────────────────────────
const COLORS_LIGHT = {
  background:      '#F8FAFC',
  surface:         '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  textPrimary:     '#0F172A',
  textSecondary:   '#475569',
  textMuted:       '#94A3B8',
  border:          '#E2E8F0',
  borderStrong:    'rgba(0,0,0,0.12)',
  primary:         '#0F172A',   // navy CTA in light mode
  primaryDark:     '#1E293B',
  accent:          '#22D3EE',   // teal highlight
  accentSoft:      'rgba(34,211,238,0.12)',
  success:         '#10B981',
  successSoft:     'rgba(16,185,129,0.12)',
  warning:         '#F59E0B',
  warningSoft:     'rgba(245,158,11,0.12)',
  danger:          '#EF4444',
  dangerSoft:      'rgba(239,68,68,0.12)',
  overlay:         'rgba(0,0,0,0.50)',
} as const;

const COLORS_DARK = {
  background:      '#020617',
  surface:         '#0F172A',
  surfaceElevated: '#132238',
  textPrimary:     '#F8FAFC',
  textSecondary:   '#CBD5E1',
  textMuted:       '#64748B',
  border:          '#1E293B',
  borderStrong:    'rgba(255,255,255,0.12)',
  primary:         '#22D3EE',   // teal CTA in dark mode
  primaryDark:     '#0891B2',
  accent:          '#22D3EE',
  accentSoft:      'rgba(34,211,238,0.13)',
  success:         '#10B981',
  successSoft:     'rgba(16,185,129,0.13)',
  warning:         '#F59E0B',
  warningSoft:     'rgba(245,158,11,0.13)',
  danger:          '#F87171',
  dangerSoft:      'rgba(248,113,113,0.13)',
  overlay:         'rgba(0,0,0,0.72)',
} as const;

export type DSColors = typeof COLORS_DARK;

export function useDSColors(): DSColors {
  const scheme = useColorScheme();
  return scheme === 'light' ? (COLORS_LIGHT as unknown as DSColors) : COLORS_DARK;
}

export function useDSIsDark(): boolean {
  return useColorScheme() !== 'light';
}

// ── Design tokens ─────────────────────────────────────────────────────────────
export const DS = {

  // ── Typography (SF Pro Display scale) ─────────────────────────────────────
  type: {
    display:  { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.5, lineHeight: 41 },
    title1:   { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.4, lineHeight: 34 },
    title2:   { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3, lineHeight: 28 },
    title3:   { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.2, lineHeight: 26 },
    headline: { fontSize: 17, fontWeight: '600' as const, letterSpacing: 0,    lineHeight: 22 },
    body:     { fontSize: 17, fontWeight: '400' as const, letterSpacing: 0,    lineHeight: 26 },
    callout:  { fontSize: 16, fontWeight: '400' as const, letterSpacing: 0,    lineHeight: 21 },
    subhead:  { fontSize: 15, fontWeight: '400' as const, letterSpacing: 0,    lineHeight: 20 },
    footnote: { fontSize: 13, fontWeight: '400' as const, letterSpacing: 0,    lineHeight: 18 },
    caption1: { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0,    lineHeight: 16 },
    caption2: { fontSize: 11, fontWeight: '400' as const, letterSpacing: 0.07, lineHeight: 13 },
    label:    { fontSize: 9,  fontWeight: '800' as const, letterSpacing: 1.0,  lineHeight: 12 },
  },

  // ── Spacing (8pt grid) ─────────────────────────────────────────────────────
  space: {
    xs:   4,
    sm:   8,
    md:   16,
    lg:   24,
    xl:   32,
    xxl:  48,
  },

  // ── Border radius ──────────────────────────────────────────────────────────
  radius: {
    sm:   8,
    md:   12,
    lg:   16,
    xl:   20,
    xxl:  28,
    full: 999,
  },

  // ── Shadows (2-level, dark mode = none) ────────────────────────────────────
  shadow: {
    level1: (isDark: boolean): object => isDark ? {} : {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 2,
    },
    level2: (isDark: boolean): object => isDark ? {} : {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 4,
    },
  },

  // ── Icon sizes ─────────────────────────────────────────────────────────────
  icon: {
    xs:  12,
    sm:  16,
    md:  20,
    lg:  24,
    xl:  28,
  },

  // ── Control sizes ──────────────────────────────────────────────────────────
  control: {
    iconBtnSm: { width: 32, height: 32 },
    iconBtnMd: { width: 40, height: 40 },
    iconBtnLg: { width: 48, height: 48 },
    ctaHeight:  56,
    inputMin:   130,
  },
} as const;
