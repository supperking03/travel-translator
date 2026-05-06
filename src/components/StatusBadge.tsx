import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { ModelStatus } from '@/store/useStore';
import { AppColors } from '@/constants/theme';

interface Props {
  status: ModelStatus;
  downloadProgress?: number;
  colors: AppColors;
}

const DOT_COLOR: Record<ModelStatus, keyof AppColors> = {
  ready:          'secondary',
  downloading:    'primary',
  loading:        'primary',
  error:          'error',
  not_downloaded: 'warning',
};

const LABEL: Record<ModelStatus, string> = {
  ready:          'Offline Ready',
  downloading:    'Downloading',
  loading:        'Loading model…',
  error:          'Error — tap to fix',
  not_downloaded: 'No model installed',
};

export function StatusBadge({ status, downloadProgress = 0, colors }: Props) {
  const accentKey = DOT_COLOR[status];
  const accent = colors[accentKey] as string;
  const isSpinning = status === 'downloading' || status === 'loading';

  return (
    <View style={[styles.pill, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {isSpinning ? (
        <ActivityIndicator size="small" color={accent} style={styles.spinner} />
      ) : (
        <View style={[styles.dot, { backgroundColor: accent }]} />
      )}
      <Text style={[styles.label, { color: accent }]}>
        {status === 'downloading'
          ? `Downloading ${Math.round(downloadProgress * 100)}%`
          : LABEL[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 24,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  spinner: {
    transform: [{ scale: 0.72 }],
    width: 14,
    height: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
