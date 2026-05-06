import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ModelStatus } from '@/store/useStore';
import { useTheme } from '@/constants/theme';

interface Props {
  status: ModelStatus;
  downloadProgress: number;
  error: string | null;
}

export function ModelStatusBadge({ status, downloadProgress, error }: Props) {
  const colors = useTheme();
  const router = useRouter();

  const isReady        = status === 'ready';
  const isDownloading  = status === 'downloading';
  const isLoading      = status === 'loading';
  const isError        = status === 'error';
  const isSpinning     = isDownloading || isLoading;

  // Status accent color
  const accent = isReady    ? colors.secondary
               : isError    ? colors.error
               : isSpinning ? colors.primary
               :              colors.warning;

  const statusLabel = isReady       ? 'Offline Ready'
                    : isDownloading ? `Downloading ${Math.round(downloadProgress * 100)}%`
                    : isLoading     ? 'Loading model…'
                    : isError       ? (error ? 'Error — tap to fix' : 'Error')
                    :                 'Download model';

  const subtitle = isReady ? 'No Internet Needed'
                 : isError ? 'Tap to go to settings'
                 :           'Tap to manage';

  return (
    <TouchableOpacity
      onPress={() => router.push('/settings')}
      activeOpacity={0.8}
      style={[
        styles.banner,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Left: animated indicator */}
      <View style={[styles.iconWrap, { backgroundColor: `${accent}22` }]}>
        {isSpinning ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <Ionicons
            name={
              isReady ? 'wifi'
              : isError ? 'alert-circle'
              : 'cloud-download-outline'
            }
            size={18}
            color={accent}
          />
        )}
      </View>

      {/* Center: text */}
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: colors.text }]}>{statusLabel}</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>{subtitle}</Text>
      </View>

      {/* Right: progress bar (downloading only) OR chevron */}
      {isDownloading ? (
        <View style={styles.progressWrap}>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.primary, width: `${downloadProgress * 100}%` as any },
              ]}
            />
          </View>
          <Text style={[styles.progressPct, { color: colors.primary }]}>
            {Math.round(downloadProgress * 100)}%
          </Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 11, fontWeight: '500' },
  progressWrap: { alignItems: 'flex-end', gap: 4 },
  progressTrack: {
    width: 64,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: 2 },
  progressPct: { fontSize: 10, fontWeight: '700' },
});
