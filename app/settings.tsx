import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useStore } from '@/store/useStore';
import { useLlama } from '@/hooks/useLlama';
import { getModelFileSizeMB, deleteModel } from '@/utils/modelManager';
import { MODEL_SIZE_MB } from '@/constants/model';
import { DS, useDSColors, useDSIsDark, DSColors } from '@/constants/designSystem';
import { useI18n } from '@/i18n/useI18n';

const UI_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
] as const;

// ─── Status card ──────────────────────────────────────────────────────────────
function PackStatusCard({
  isReady, isDownloading, isLoading,
  downloadProgress, isDark, colors, subtitle, children,
}: {
  isReady: boolean; isDownloading: boolean; isLoading: boolean;
  downloadProgress: number; isDark: boolean; colors: DSColors;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const t = useI18n();

  const statusColor = isReady       ? colors.success
                    : isDownloading ? colors.primary
                    : isLoading     ? colors.primary
                    :                 colors.warning;

  const statusLabel = isReady       ? t.sStatusReady
                    : isDownloading ? t.sStatusLoading
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
          <Text style={[styles.cardSub, { color: colors.textMuted }]}>{subtitle ?? t.sPackSub}</Text>
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

      {children ? (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.packActions}>{children}</View>
        </>
      ) : null}
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

function PrimaryPackAction({
  label,
  onPress,
  colors,
  isDark,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  colors: DSColors;
  isDark: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      disabled={loading}
      style={[
        styles.primaryAction,
        { backgroundColor: colors.primary, opacity: loading ? 0.72 : 1 },
        DS.shadow.level2(isDark),
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.background} size="small" />
      ) : (
        <Ionicons name="cloud-download-outline" size={18} color={colors.background} />
      )}
      <Text style={[styles.primaryActionLabel, { color: colors.background }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const C      = useDSColors();
  const isDark = useDSIsDark();
  const t      = useI18n();
  const nav    = useNavigation();
  const params = useLocalSearchParams<{ focus?: string }>();

  const { modelStatus, downloadProgress, appLanguage, setAppLanguage } = useStore();
  const { downloadAndLoad, cancelDownload, releaseModel } = useLlama();

  const [savedSizeMB, setSavedSizeMB] = useState<number | null>(null);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

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
  const shouldHighlightDownload = params.focus === 'download' || notDownloaded || hasError;
  const canShowAppLanguage = isReady || savedSizeMB !== null;
  const currentUiLanguage = UI_LANGUAGES.find((lang) => lang.code === appLanguage) ?? UI_LANGUAGES[0];
  const packSubtitle =
    shouldHighlightDownload && !isReady && !isDownloading && !isLoading
      ? (t.sDownloadPackBenefitTitle ?? 'Translate offline after one download')
      : t.sPackSub;

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
          subtitle={packSubtitle}
        >
          {shouldHighlightDownload && !isReady && !isDownloading && !isLoading && (
            <View style={styles.primaryBlock}>
              <PrimaryPackAction
                label={t.sDownloadPack}
                onPress={handleDownload}
                colors={C}
                isDark={isDark}
              />
            </View>
          )}

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

          <View style={styles.rowGroup}>
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
        </PackStatusCard>

        {canShowAppLanguage && (
          <ActionRow
            icon="globe-outline"
            label={t.sAppLanguage ?? 'App Language'}
            description={currentUiLanguage.nativeName}
            onPress={() => setLanguageModalVisible(true)}
            isDark={isDark}
            colors={C}
          />
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={languageModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View style={[styles.overlay, { backgroundColor: C.overlay }]}>
          <View style={[styles.sheet, { backgroundColor: C.background }]}>
            <View style={[styles.handle, { backgroundColor: C.borderStrong }]} />

            <View style={[styles.sheetHeader, { borderBottomColor: C.border }]}>
              <Text style={[styles.sheetTitle, { color: C.textPrimary }]}>
                {t.sChooseAppLanguage ?? 'Choose App Language'}
              </Text>
              <TouchableOpacity
                onPress={() => setLanguageModalVisible(false)}
                style={[styles.closeBtn, { backgroundColor: C.surface }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={17} color={C.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {UI_LANGUAGES.map((language) => {
                const isSelected = language.code === appLanguage;
                return (
                  <TouchableOpacity
                    key={language.code}
                    onPress={() => {
                      setAppLanguage(language.code);
                      setLanguageModalVisible(false);
                    }}
                    activeOpacity={0.7}
                    style={[styles.languageRow, { borderBottomColor: C.border }]}
                  >
                    <View style={styles.languageText}>
                      <Text style={[styles.languageNative, { color: isSelected ? C.primary : C.textPrimary }]}>
                        {language.nativeName}
                      </Text>
                      <Text style={[styles.languageName, { color: C.textMuted }]}>{language.name}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={C.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  progressLabelRow: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm },
  progressText:     { flex: 1, ...DS.type.caption1 },
  progressPct:      { ...DS.type.caption1, fontWeight: '700' },
  progressTrack:    { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill:     { height: 6, borderRadius: 3 },
  packActions:      { padding: DS.space.md, gap: DS.space.sm + DS.space.xs },
  primaryBlock:     { gap: DS.space.sm },

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
  primaryAction: {
    minHeight: DS.control.ctaHeight,
    borderRadius: DS.radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.md,
  },
  primaryActionLabel: { ...DS.type.headline, fontWeight: '700' },

  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: DS.radius.xxl,
    borderTopRightRadius: DS.radius.xxl,
    maxHeight: '78%',
    paddingBottom: 24,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: DS.space.sm + DS.space.xs,
    marginBottom: DS.space.xs,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.md + DS.space.xs,
    paddingVertical: DS.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { ...DS.type.title3 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: DS.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.md + DS.space.xs,
    paddingVertical: DS.space.md - 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  languageText:   { flex: 1, gap: 2 },
  languageNative: { ...DS.type.subhead, fontWeight: '600' },
  languageName:   { ...DS.type.caption1 },
});
