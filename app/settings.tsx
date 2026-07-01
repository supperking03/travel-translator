import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useStore } from '@/store/useStore';
import { DS, useDSColors, useDSIsDark, DSColors } from '@/constants/designSystem';
import { useI18n } from '@/i18n/useI18n';
import { trackScreen } from '@/utils/analytics';

const UI_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
] as const;

const SUPPORT_URL = 'https://nomad-translator.com/support.html';
const PRIVACY_URL = 'https://nomad-translator.com/privacy-policy.html';

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

// ─── Theme picker row ─────────────────────────────────────────────────────────
type ThemePref = 'system' | 'light' | 'dark';
const THEME_OPTIONS: { key: ThemePref; icon: React.ComponentProps<typeof Ionicons>['name']; label: string }[] = [
  { key: 'light',  icon: 'sunny-outline',          label: 'Light'  },
  { key: 'system', icon: 'phone-portrait-outline',  label: 'Auto'   },
  { key: 'dark',   icon: 'moon-outline',            label: 'Dark'   },
];

function ThemePickerRow({
  value, onChange, colors, isDark,
}: {
  value: ThemePref; onChange: (v: ThemePref) => void;
  colors: DSColors; isDark: boolean;
}) {
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }, DS.shadow.level2(isDark)]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.surface }]}>
        <Ionicons name="contrast-outline" size={18} color={colors.primary} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.textPrimary, flex: 1 }]}>Appearance</Text>
      <View style={[styles.segmented, { backgroundColor: colors.background, borderColor: colors.border }]}>
        {THEME_OPTIONS.map((opt) => {
          const active = value === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => onChange(opt.key)}
              activeOpacity={0.75}
              style={[
                styles.segment,
                active && { backgroundColor: colors.surface, ...DS.shadow.level1(isDark) },
              ]}
            >
              <Ionicons
                name={opt.icon}
                size={13}
                color={active ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.segmentLabel, { color: active ? colors.primary : colors.textMuted }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const C      = useDSColors();
  const isDark = useDSIsDark();
  const t      = useI18n();
  const nav    = useNavigation();

  const {
    appLanguage, setAppLanguage,
    themePreference, setThemePreference,
  } = useStore();

  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  useEffect(() => { trackScreen('settings'); }, []);

  // Localize the navigation header title
  useEffect(() => {
    nav.setOptions({ title: t.sTitle });
  }, [t.sTitle, nav]);

  const currentUiLanguage = UI_LANGUAGES.find((lang) => lang.code === appLanguage) ?? UI_LANGUAGES[0];

  const openExternalLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open link', url);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['bottom']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {(
          <ActionRow
            icon="globe-outline"
            label={t.sAppLanguage ?? 'App Language'}
            description={currentUiLanguage.nativeName}
            onPress={() => setLanguageModalVisible(true)}
            isDark={isDark}
            colors={C}
          />
        )}

        {(
          <ThemePickerRow
            value={themePreference}
            onChange={setThemePreference}
            colors={C}
            isDark={isDark}
          />
        )}

        <View style={styles.footerLinks}>
          <TouchableOpacity
            onPress={() => { void openExternalLink(SUPPORT_URL); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.footerLinkText, { color: C.textMuted }]}>
              {t.sSupportLinkTitle ?? 'Support'}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.footerLinkDivider, { color: C.textMuted }]}>·</Text>

          <TouchableOpacity
            onPress={() => { void openExternalLink(PRIVACY_URL); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.footerLinkText, { color: C.textMuted }]}>
              {t.sPrivacyLinkTitle ?? 'Privacy Policy'}
            </Text>
          </TouchableOpacity>
        </View>

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
                    <Text style={styles.languageFlag}>{language.flag}</Text>
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

  segmented: {
    flexDirection: 'row',
    borderRadius: DS.radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs - 1,
    paddingHorizontal: DS.space.sm + 1,
    paddingVertical: DS.space.xs + 1,
    borderRadius: DS.radius.sm + 1,
  },
  segmentLabel: { ...DS.type.caption1, fontWeight: '600' },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingTop: DS.space.xs,
  },
  footerLinkText: {
    ...DS.type.caption1,
    fontWeight: '500',
  },
  footerLinkDivider: {
    ...DS.type.caption1,
  },

  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: DS.radius.xxl,
    borderTopRightRadius: DS.radius.xxl,
    maxHeight: '70%',
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
    gap: DS.space.sm + DS.space.xs,
    paddingHorizontal: DS.space.md + DS.space.xs,
    paddingVertical: DS.space.md - 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  languageFlag:   { fontSize: DS.icon.lg - 2, width: 32, textAlign: 'center' },
  languageText:   { flex: 1, gap: 2 },
  languageNative: { ...DS.type.subhead, fontWeight: '600' },
  languageName:   { ...DS.type.caption1 },
});
