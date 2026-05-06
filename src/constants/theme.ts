import { useColorScheme } from 'react-native';

// ─── Dark palette (navy + teal) ───────────────────────────────────────────────
const DARK = {
  background:     '#0F172A',
  surface:        '#132238',
  card:           '#1A2E4A',
  border:         'rgba(255,255,255,0.07)',
  borderStrong:   'rgba(255,255,255,0.13)',
  primary:        '#22D3EE',
  primaryDim:     'rgba(34,211,238,0.13)',
  primaryDark:    '#0891B2',
  secondary:      '#10B981',
  secondaryDim:   'rgba(16,185,129,0.13)',
  warning:        '#F59E0B',
  warningDim:     'rgba(245,158,11,0.13)',
  error:          '#EF4444',
  errorDim:       'rgba(239,68,68,0.13)',
  text:           '#F8FAFC',
  textSecondary:  '#94A3B8',
  textMuted:      '#64748B',
  overlay:        'rgba(0,0,0,0.72)',
  // Quick-action tile accents (same in both modes — they're coloured tiles)
  tileSpeak:      '#22D3EE',
  tileCamera:     '#818CF8',
  tilePhrases:    '#10B981',
  tileSpeakBg:    'rgba(34,211,238,0.13)',
  tileCameraBg:   'rgba(129,140,248,0.13)',
  tilePhrasesBg:  'rgba(16,185,129,0.13)',
} as const;

// ─── Light palette ────────────────────────────────────────────────────────────
const LIGHT = {
  background:     '#F8FAFC',
  surface:        '#FFFFFF',
  card:           '#FFFFFF',
  border:         'rgba(0,0,0,0.07)',
  borderStrong:   'rgba(0,0,0,0.13)',
  primary:        '#0891B2',
  primaryDim:     'rgba(8,145,178,0.10)',
  primaryDark:    '#0E7490',
  secondary:      '#059669',
  secondaryDim:   'rgba(5,150,105,0.10)',
  warning:        '#D97706',
  warningDim:     'rgba(217,119,6,0.10)',
  error:          '#DC2626',
  errorDim:       'rgba(220,38,38,0.10)',
  text:           '#0F172A',
  textSecondary:  '#475569',
  textMuted:      '#94A3B8',
  overlay:        'rgba(0,0,0,0.55)',
  tileSpeak:      '#0891B2',
  tileCamera:     '#6366F1',
  tilePhrases:    '#059669',
  tileSpeakBg:    'rgba(8,145,178,0.10)',
  tileCameraBg:   'rgba(99,102,241,0.10)',
  tilePhrasesBg:  'rgba(5,150,105,0.10)',
} as const;

export type AppColors = typeof DARK;

export function useTheme(): AppColors {
  const scheme = useColorScheme();
  return scheme === 'light' ? (LIGHT as unknown as AppColors) : DARK;
}

// Legacy export — existing imports of COLORS keep working (dark palette)
export const COLORS: AppColors & { success: string; surfaceHigh: string } = {
  ...DARK,
  success:    '#10B981',
  surfaceHigh: '#1E3A5F',
};
