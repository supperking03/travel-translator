import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useStore } from '@/store/useStore';
import { useLlama } from '@/hooks/useLlama';
import { getModelFileSizeMB, deleteModel } from '@/utils/modelManager';
import { MODEL_SIZE_MB } from '@/constants/model';
import { useTheme } from '@/constants/theme';

function cardShadow(isDark: boolean) {
  if (isDark) return {};
  return {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  };
}

// ─── Status card ──────────────────────────────────────────────────────────────
function PackStatusCard({
  isReady, isDownloading, isLoading,
  downloadProgress, isDark,
  colors,
}: {
  isReady: boolean; isDownloading: boolean; isLoading: boolean;
  downloadProgress: number; isDark: boolean;
  colors: ReturnType<typeof useTheme>;
}) {
  const statusColor = isReady       ? colors.secondary
                    : isDownloading ? colors.primary
                    : isLoading     ? colors.primary
                    :                 colors.warning;

  const statusLabel = isReady       ? 'Ready'
                    : isDownloading ? `${Math.round(downloadProgress * 100)}%`
                    : isLoading     ? 'Loading…'
                    :                 'Not installed';

  const iconName: React.ComponentProps<typeof Ionicons>['name'] =
    isReady       ? 'checkmark-circle-outline'
    : isDownloading ? 'cloud-download-outline'
    : isLoading   ? 'hourglass-outline'
    :               'cloud-outline';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, cardShadow(isDark)]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: `${statusColor}18` }]}>
          <Ionicons name={iconName} size={26} color={statusColor} />
        </View>
        <View style={styles.cardMeta}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Offline Translation Pack</Text>
          <Text style={[styles.cardSub, { color: colors.textMuted }]}>Works without internet · 33 languages</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Download progress */}
      {isDownloading && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.progressWrap}>
            <View style={styles.progressLabelRow}>
              <Ionicons name="cloud-download-outline" size={13} color={colors.primary} />
              <Text style={[styles.progressText, { color: colors.textMuted }]}>
                {`${Math.round(downloadProgress * MODEL_SIZE_MB)} MB of ${MODEL_SIZE_MB} MB`}
              </Text>
              <Text style={[styles.progressPct, { color: colors.primary }]}>
                {Math.round(downloadProgress * 100)}%
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.primary, width: `${downloadProgress * 100}%` as any },
                ]}
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

// ─── Action row ───────────────────────────────────────────────────────────────
function ActionRow({
  icon, label, description, onPress, variant = 'default', isDark, colors,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  description?: string;
  onPress: () => void;
  variant?: 'default' | 'danger';
  isDark: boolean;
  colors: ReturnType<typeof useTheme>;
}) {
  const fg     = variant === 'danger' ? colors.error   : colors.text;
  const iconBg = variant === 'danger' ? colors.errorDim : colors.surface;
  const iconFg = variant === 'danger' ? colors.error   : colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }, cardShadow(isDark)]}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconFg} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: fg }]}>{label}</Text>
        {description && (
          <Text style={[styles.rowDesc, { color: colors.textMuted }]}>{description}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const colors = useTheme();
  const scheme = useColorScheme();
  const isDark  = scheme !== 'light';

  const { modelStatus, downloadProgress, modelError, clearHistory } = useStore();
  const { downloadAndLoad, cancelDownload, releaseModel } = useLlama();

  const [savedSizeMB, setSavedSizeMB] = useState<number | null>(null);

  useEffect(() => {
    getModelFileSizeMB().then(setSavedSizeMB);
  }, [modelStatus]);

  const isDownloading = modelStatus === 'downloading';
  const isLoading     = modelStatus === 'loading';
  const isReady       = modelStatus === 'ready';
  const hasError      = modelStatus === 'error';
  const notDownloaded = modelStatus === 'not_downloaded';

  const handleDownload = () =>
    Alert.alert(
      'Download Language Pack',
      `This will download ~${MODEL_SIZE_MB} MB. Best done on Wi-Fi.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: downloadAndLoad },
      ]
    );

  const handleRedownload = () =>
    Alert.alert(
      'Re-download Pack',
      `This will re-download the full pack (~${MODEL_SIZE_MB} MB). Best done on Wi-Fi.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Re-download',
          onPress: async () => {
            await releaseModel();
            await deleteModel();
            downloadAndLoad();
          },
        },
      ]
    );

  const handleDelete = () =>
    Alert.alert(
      'Delete Pack',
      "This removes the offline pack from your device. You'll need to re-download it to translate.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await releaseModel();
            await deleteModel();
            setSavedSizeMB(null);
          },
        },
      ]
    );

  const handleClearHistory = () =>
    Alert.alert('Clear History', 'Delete all translation history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearHistory },
    ]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Status card ────────────────────────────────────────────────── */}
        <PackStatusCard
          isReady={isReady}
          isDownloading={isDownloading}
          isLoading={isLoading}
          downloadProgress={downloadProgress}
          isDark={isDark}
          colors={colors}
        />

        {/* ── Error banner ───────────────────────────────────────────────── */}
        {hasError && (
          <View style={[styles.errorCard, { backgroundColor: colors.errorDim, borderColor: `${colors.error}35` }]}>
            <View style={[styles.errorIcon, { backgroundColor: `${colors.error}18` }]}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
            </View>
            <View style={styles.errorText}>
              <Text style={[styles.errorTitle, { color: colors.error }]}>Something went wrong</Text>
              <Text style={[styles.errorDesc, { color: colors.textSecondary }]}>
                Try deleting and re-downloading the pack.
              </Text>
            </View>
          </View>
        )}

        {/* ── Pack actions ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>LANGUAGE PACK</Text>
          <View style={styles.rowGroup}>

            {(notDownloaded || hasError) && (
              <ActionRow
                icon="cloud-download-outline"
                label="Download Pack"
                description={`~${MODEL_SIZE_MB} MB · Recommended on Wi-Fi`}
                onPress={handleDownload}
                isDark={isDark}
                colors={colors}
              />
            )}

            {isDownloading && (
              <ActionRow
                icon="close-circle-outline"
                label="Cancel Download"
                variant="danger"
                onPress={cancelDownload}
                isDark={isDark}
                colors={colors}
              />
            )}

            {isReady && !isDownloading && (
              <ActionRow
                icon="refresh-outline"
                label="Check for Updates"
                description="Make sure you have the latest version"
                onPress={() => Alert.alert('Up to Date', 'Your offline pack is already the latest version.')}
                isDark={isDark}
                colors={colors}
              />
            )}

            {(isReady || savedSizeMB !== null) && !isDownloading && !isLoading && (
              <ActionRow
                icon="arrow-down-circle-outline"
                label="Re-download Pack"
                description="Replace with a fresh copy"
                onPress={handleRedownload}
                isDark={isDark}
                colors={colors}
              />
            )}

            {(isReady || savedSizeMB !== null) && !isDownloading && !isLoading && (
              <ActionRow
                icon="trash-outline"
                label="Delete Pack"
                description="Frees ~1.1 GB on your device"
                variant="danger"
                onPress={handleDelete}
                isDark={isDark}
                colors={colors}
              />
            )}
          </View>
        </View>

        {/* ── Privacy banner ─────────────────────────────────────────────── */}
        <View style={[styles.privacyCard, { backgroundColor: colors.secondaryDim, borderColor: `${colors.secondary}28` }]}>
          <View style={[styles.privacyIcon, { backgroundColor: `${colors.secondary}18` }]}>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.secondary} />
          </View>
          <View style={styles.privacyText}>
            <Text style={[styles.privacyTitle, { color: colors.text }]}>100% Private</Text>
            <Text style={[styles.privacyDesc, { color: colors.textSecondary }]}>
              All translations happen on your device. Nothing is ever sent to a server.
            </Text>
          </View>
        </View>

        {/* ── Data ───────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>DATA</Text>
          <View style={styles.rowGroup}>
            <ActionRow
              icon="time-outline"
              label="Clear Translation History"
              description="Remove all past translations"
              onPress={handleClearHistory}
              isDark={isDark}
              colors={colors}
            />
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:  { flex: 1 },
  flex:  { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },

  // Status card
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMeta:  { flex: 1, gap: 3 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardSub:   { fontSize: 12, lineHeight: 17 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  divider:    { height: StyleSheet.hairlineWidth },

  // Progress
  progressWrap: { padding: 16, gap: 8 },
  progressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressText: { flex: 1, fontSize: 12 },
  progressPct:  { fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: 6, borderRadius: 3 },

  // Error
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  errorIcon:  { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  errorText:  { flex: 1, gap: 2 },
  errorTitle: { fontSize: 13, fontWeight: '700' },
  errorDesc:  { fontSize: 12, lineHeight: 17 },

  // Section
  section:      { gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3, paddingHorizontal: 2 },
  rowGroup:     { gap: 10 },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  rowIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText:  { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowDesc:  { fontSize: 12, lineHeight: 17 },

  // Privacy
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  privacyIcon: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  privacyText:  { flex: 1, gap: 4 },
  privacyTitle: { fontSize: 14, fontWeight: '700' },
  privacyDesc:  { fontSize: 13, lineHeight: 19 },
});
