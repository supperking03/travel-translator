import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useStore } from '@/store/useStore';
import { useLlama } from '@/hooks/useLlama';
import { getModelFileSizeMB, deleteModel } from '@/utils/modelManager';
import { MODEL_SIZE_MB } from '@/constants/model';
import { DS, useDSColors, useDSIsDark, DSColors } from '@/constants/designSystem';
import { useI18n } from '@/i18n/useI18n';

// ─── Status card ──────────────────────────────────────────────────────────────
function PackStatusCard({
  isReady, isDownloading, isLoading,
  downloadProgress, isDark, colors,
}: {
  isReady: boolean; isDownloading: boolean; isLoading: boolean;
  downloadProgress: number; isDark: boolean; colors: DSColors;
}) {
  const t = useI18n();

  const statusColor = isReady       ? colors.success
                    : isDownloading ? colors.primary
                    : isLoading     ? colors.primary
                    :                 colors.warning;

  const statusLabel = isReady       ? t.sStatusReady
                    : isDownloading ? `${Math.round(downloadProgress * 100)}%`
                    : isLoading     ? t.sStatusLoading
                    :                 t.sStatusNotInstalled;

  const iconName: React.ComponentProps<typeof Ionicons>['name'] =
    isReady       ? 'checkmark-circle-outline'
    : isDownloading ? 'cloud-download-outline'
    : isLoading   ? 'hourglass-outline'
    :               'cloud-outline';

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, DS.shadow.level2(isDark)]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: `${statusColor}18` }]}>
          <Ionicons name={iconName} size={26} color={statusColor} />
        </View>
        <View style={styles.cardMeta}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t.sPackTitle}</Text>
          <Text style={[styles.cardSub, { color: colors.textMuted }]}>{t.sPackSub}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {isDownloading && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.progressWrap}>
            <View style={styles.progressLabelRow}>
              <Ionicons name="cloud-download-outline" size={13} color={colors.primary} />
              <Text style={[styles.progressText, { color: colors.textMuted }]}>
                {`${Math.round(downloadProgress * MODEL_SIZE_MB)} MB / ${MODEL_SIZE_MB} MB`}
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
  colors: DSColors;
}) {
  const fg     = variant === 'danger' ? colors.danger     : colors.textPrimary;
  const iconBg = variant === 'danger' ? colors.dangerSoft : colors.surface;
  const iconFg = variant === 'danger' ? colors.danger     : colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }, DS.shadow.level2(isDark)]}
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
  const C      = useDSColors();
  const isDark = useDSIsDark();
  const t      = useI18n();
  const nav    = useNavigation();

  const { modelStatus, downloadProgress, clearHistory } = useStore();
  const { downloadAndLoad, cancelDownload, releaseModel } = useLlama();

  const [savedSizeMB, setSavedSizeMB] = useState<number | null>(null);

  // Localize the navigation header title
  useEffect(() => {
    nav.setOptions({ title: t.sTitle });
  }, [t.sTitle, nav]);

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
      t.sDownloadPack,
      `~${MODEL_SIZE_MB} MB. ${t.sDownloadPackDesc.split('·')[1]?.trim() ?? ''}`,
      [
        { text: t.aCancel, style: 'cancel' },
        { text: t.aDownload, onPress: downloadAndLoad },
      ]
    );

  const handleRedownload = () =>
    Alert.alert(
      t.sRedownload,
      `~${MODEL_SIZE_MB} MB`,
      [
        { text: t.aCancel, style: 'cancel' },
        {
          text: t.aDownload,
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
      t.sDeletePack,
      t.sDeletePackDesc,
      [
        { text: t.aCancel, style: 'cancel' },
        {
          text: t.aDelete,
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
    Alert.alert(t.sClearHistory, '', [
      { text: t.aCancel, style: 'cancel' },
      { text: t.aClear, style: 'destructive', onPress: clearHistory },
    ]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['bottom']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        <PackStatusCard
          isReady={isReady}
          isDownloading={isDownloading}
          isLoading={isLoading}
          downloadProgress={downloadProgress}
          isDark={isDark}
          colors={C}
        />

        {hasError && (
          <View style={[styles.errorCard, { backgroundColor: C.dangerSoft, borderColor: `${C.danger}35` }]}>
            <View style={[styles.errorIcon, { backgroundColor: `${C.danger}18` }]}>
              <Ionicons name="alert-circle-outline" size={20} color={C.danger} />
            </View>
            <View style={styles.errorText}>
              <Text style={[styles.errorTitle, { color: C.danger }]}>{t.sErrorTitle}</Text>
              <Text style={[styles.errorDesc, { color: C.textSecondary }]}>{t.sErrorDesc}</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: C.textMuted }]}>{t.sSectionPack}</Text>
          <View style={styles.rowGroup}>

            {(notDownloaded || hasError) && (
              <ActionRow
                icon="cloud-download-outline"
                label={t.sDownloadPack}
                description={t.sDownloadPackDesc}
                onPress={handleDownload}
                isDark={isDark}
                colors={C}
              />
            )}

            {isDownloading && (
              <ActionRow
                icon="close-circle-outline"
                label={t.sCancelDownload}
                variant="danger"
                onPress={cancelDownload}
                isDark={isDark}
                colors={C}
              />
            )}

            {isReady && !isDownloading && (
              <ActionRow
                icon="refresh-outline"
                label={t.sCheckUpdates}
                description={t.sCheckUpdatesDesc}
                onPress={() => Alert.alert(t.sCheckUpdates, t.sStatusReady)}
                isDark={isDark}
                colors={C}
              />
            )}

            {(isReady || savedSizeMB !== null) && !isDownloading && !isLoading && (
              <ActionRow
                icon="arrow-down-circle-outline"
                label={t.sRedownload}
                description={t.sRedownloadDesc}
                onPress={handleRedownload}
                isDark={isDark}
                colors={C}
              />
            )}

            {(isReady || savedSizeMB !== null) && !isDownloading && !isLoading && (
              <ActionRow
                icon="trash-outline"
                label={t.sDeletePack}
                description={t.sDeletePackDesc}
                variant="danger"
                onPress={handleDelete}
                isDark={isDark}
                colors={C}
              />
            )}
          </View>
        </View>

        <View style={[styles.privacyCard, { backgroundColor: C.successSoft, borderColor: `${C.success}28` }]}>
          <View style={[styles.privacyIcon, { backgroundColor: `${C.success}18` }]}>
            <Ionicons name="shield-checkmark-outline" size={22} color={C.success} />
          </View>
          <View style={styles.privacyText}>
            <Text style={[styles.privacyTitle, { color: C.textPrimary }]}>{t.sPrivacyTitle}</Text>
            <Text style={[styles.privacyDesc, { color: C.textSecondary }]}>{t.sPrivacyDesc}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: C.textMuted }]}>{t.sSectionData}</Text>
          <View style={styles.rowGroup}>
            <ActionRow
              icon="time-outline"
              label={t.sClearHistory}
              description={t.sClearHistoryDesc}
              onPress={handleClearHistory}
              isDark={isDark}
              colors={C}
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
  scroll: { paddingHorizontal: DS.space.md, paddingTop: DS.space.md, gap: DS.space.md },

  card: {
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm + DS.space.xs,
    padding: DS.space.md,
  },
  cardIcon: {
    width: 52, height: 52,
    borderRadius: DS.radius.md + 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMeta:  { flex: 1, gap: DS.space.xs - 1 },
  cardTitle: { ...DS.type.subhead, fontWeight: '700' },
  cardSub:   { ...DS.type.caption1, lineHeight: 17 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs + 1,
    paddingHorizontal: DS.space.sm + DS.space.xs,
    paddingVertical: DS.space.xs + 2,
    borderRadius: DS.radius.full,
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...DS.type.caption2, fontWeight: '700' },
  divider:    { height: StyleSheet.hairlineWidth },

  progressWrap:     { padding: DS.space.md, gap: DS.space.sm },
  progressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.xs + 2 },
  progressText:     { flex: 1, ...DS.type.caption1 },
  progressPct:      { ...DS.type.caption1, fontWeight: '700' },
  progressTrack:    { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill:     { height: 6, borderRadius: 3 },

  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm + DS.space.xs,
    padding: DS.space.sm + DS.space.xs,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
  },
  errorIcon:  { width: 38, height: 38, borderRadius: DS.radius.md - 1, alignItems: 'center', justifyContent: 'center' },
  errorText:  { flex: 1, gap: DS.space.xs - 2 },
  errorTitle: { ...DS.type.footnote, fontWeight: '700' },
  errorDesc:  { ...DS.type.caption1, lineHeight: 17 },

  section:      { gap: DS.space.sm + DS.space.xs },
  sectionLabel: { ...DS.type.label, letterSpacing: 1.3, paddingHorizontal: 2 },
  rowGroup:     { gap: DS.space.sm + DS.space.xs },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm + DS.space.xs,
    padding: DS.space.sm + DS.space.xs,
    borderRadius: DS.radius.lg,
    borderWidth: 1,
  },
  rowIcon: {
    width: 40, height: 40,
    borderRadius: DS.radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText:  { flex: 1, gap: DS.space.xs - 2 },
  rowLabel: { ...DS.type.subhead, fontWeight: '600' },
  rowDesc:  { ...DS.type.caption1, lineHeight: 17 },

  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm + DS.space.xs,
    padding: DS.space.md,
    borderRadius: DS.radius.xl - 2,
    borderWidth: 1,
  },
  privacyIcon: {
    width: 46, height: 46, borderRadius: DS.radius.md + 2,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  privacyText:  { flex: 1, gap: DS.space.xs },
  privacyTitle: { ...DS.type.subhead, fontWeight: '700' },
  privacyDesc:  { ...DS.type.footnote, lineHeight: 19 },
});
