import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ModelStatus } from '@/store/useStore';
import { COLORS } from '@/constants/theme';

interface Props {
  status: ModelStatus;
  downloadProgress: number;
  error: string | null;
}

const STATUS_CONFIG: Record<ModelStatus, { label: string; color: string; dot: string }> = {
  not_downloaded: { label: 'Model not downloaded', color: COLORS.warning, dot: '○' },
  downloading: { label: 'Downloading...', color: COLORS.primary, dot: '⬇' },
  loading: { label: 'Loading model...', color: COLORS.primary, dot: '◌' },
  ready: { label: 'AI Ready', color: COLORS.success, dot: '●' },
  error: { label: 'Error', color: COLORS.error, dot: '✕' },
};

export function ModelStatusBadge({ status, downloadProgress, error }: Props) {
  const router = useRouter();
  const config = STATUS_CONFIG[status];

  return (
    <TouchableOpacity
      style={styles.badge}
      onPress={() => router.push('/settings')}
      activeOpacity={0.7}
    >
      {status === 'downloading' || status === 'loading' ? (
        <ActivityIndicator size="small" color={config.color} style={styles.spinner} />
      ) : (
        <Text style={[styles.dot, { color: config.color }]}>{config.dot}</Text>
      )}
      <Text style={[styles.label, { color: config.color }]}>
        {status === 'downloading'
          ? `Downloading ${Math.round(downloadProgress * 100)}%`
          : error && status === 'error'
          ? 'Error — tap to fix'
          : config.label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: {
    fontSize: 10,
  },
  spinner: {
    transform: [{ scale: 0.7 }],
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
