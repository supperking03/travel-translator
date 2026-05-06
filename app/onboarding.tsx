import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { DS, useDSColors, useDSIsDark } from '@/constants/designSystem';
import { useStore } from '@/store/useStore';
import { useI18n } from '@/i18n/useI18n';
import { getLanguageByCode } from '@/constants/languages';
import { DEFAULT_SOURCE, DEFAULT_TARGET } from '@/constants/languages';

const { width: W } = Dimensions.get('window');

const COMMON_CODES = [
  'en', 'es', 'fr', 'de',
  'it', 'pt', 'ja', 'ko',
  'zh', 'ar', 'ru', 'hi',
  'vi', 'th', 'id', 'nl',
];

const COMMON_LANGS = COMMON_CODES
  .map(getLanguageByCode)
  .filter(Boolean) as NonNullable<ReturnType<typeof getLanguageByCode>>[];

function detectDeviceLanguage(): string {
  try {
    const raw = new Intl.DateTimeFormat().resolvedOptions().locale; // e.g. "vi-VN"
    const code = raw.split(/[-_]/)[0].toLowerCase();
    return COMMON_CODES.includes(code) ? code : 'en';
  } catch {
    return 'en';
  }
}

// ─── Language tile ────────────────────────────────────────────────────────────
function LangTile({
  code, selected, onPress, colors, isDark,
}: {
  code: string; selected: boolean; onPress: () => void;
  colors: ReturnType<typeof useDSColors>; isDark: boolean;
}) {
  const lang = getLanguageByCode(code);
  if (!lang) return null;
  const tileW = (W - DS.space.lg * 2 - DS.space.sm * 3) / 4;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        tile.wrap,
        { width: tileW, backgroundColor: selected ? colors.primary : colors.surface },
        selected ? {} : { borderColor: colors.border, borderWidth: 1 },
        DS.shadow.level1(isDark),
      ]}
    >
      <Text style={tile.flag}>{lang.flag}</Text>
      <Text
        style={[tile.name, { color: selected ? colors.background : colors.textSecondary }]}
        numberOfLines={1}
      >
        {lang.name}
      </Text>
    </TouchableOpacity>
  );
}

const tile = StyleSheet.create({
  wrap: { borderRadius: DS.radius.lg, padding: DS.space.sm, alignItems: 'center', gap: DS.space.xs },
  flag: { fontSize: 26 },
  name: { ...DS.type.caption1, fontWeight: '600', textAlign: 'center' },
});

// ─── Onboarding screen ────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const C      = useDSColors();
  const isDark = useDSIsDark();
  const router = useRouter();
  const t      = useI18n();

  const { setSourceLang, setTargetLang, setOnboardingComplete, setAppLanguage } = useStore();

  // Detect device language once on mount
  const initialLang = useMemo(detectDeviceLanguage, []);
  const [nativeLang, setNativeLang] = useState(initialLang);
  const [step, setStep] = useState(0);
  const slideX = useRef(new Animated.Value(0)).current;

  // Sync detected language to store so UI is already in the right language
  useEffect(() => {
    setAppLanguage(initialLang);
  }, [initialLang, setAppLanguage]);

  const handleLangSelect = useCallback((code: string) => {
    setNativeLang(code);
    setAppLanguage(code); // immediately switches UI language
  }, [setAppLanguage]);

  const advance = useCallback(() => {
    Animated.timing(slideX, { toValue: -W, duration: 240, useNativeDriver: true }).start(() => {
      setStep(1);
      slideX.setValue(W);
      Animated.spring(slideX, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 0 }).start();
    });
  }, [slideX]);

  const retreat = useCallback(() => {
    Animated.timing(slideX, { toValue: W, duration: 200, useNativeDriver: true }).start(() => {
      setStep(0);
      slideX.setValue(-W);
      Animated.spring(slideX, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 0 }).start();
    });
  }, [slideX]);

  const finish = useCallback(() => {
    setSourceLang(nativeLang);
    setTargetLang(nativeLang === DEFAULT_TARGET ? DEFAULT_SOURCE : DEFAULT_TARGET);
    setOnboardingComplete(true);
    router.replace('/');
  }, [nativeLang, setSourceLang, setTargetLang, setOnboardingComplete, router]);

  const features = [
    { icon: 'airplane-outline'         as const, title: t.obFeat1Title, desc: t.obFeat1Desc },
    { icon: 'shield-checkmark-outline' as const, title: t.obFeat2Title, desc: t.obFeat2Desc },
    { icon: 'globe-outline'            as const, title: t.obFeat3Title, desc: t.obFeat3Desc },
  ];

  // ── Step 0: language picker ─────────────────────────────────────────────────
  const renderStep0 = () => (
    <View style={s.pickFlex}>
      <Text style={[s.pickHeadline, { color: C.textPrimary }]}>{t.obHeadline}</Text>
      <Text style={[s.pickSub, { color: C.textSecondary }]}>{t.obSub}</Text>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.langGrid}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {COMMON_LANGS.map(lang => (
          <LangTile
            key={lang.code}
            code={lang.code}
            selected={nativeLang === lang.code}
            onPress={() => handleLangSelect(lang.code)}
            colors={C}
            isDark={isDark}
          />
        ))}
      </ScrollView>

      <View style={s.ctaWrap}>
        <TouchableOpacity
          onPress={advance}
          style={[s.ctaBtn, { backgroundColor: C.primary }, DS.shadow.level2(isDark)]}
          activeOpacity={0.85}
        >
          <Text style={[s.ctaLabel, { color: C.background }]}>{t.obContinue}</Text>
          <Ionicons name="arrow-forward" size={DS.icon.sm} color={C.background} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Step 1: welcome + core values ───────────────────────────────────────────
  const renderStep1 = () => (
    <View style={s.welcomeFlex}>
      <Text style={s.heroEmoji}>🌍</Text>
      <View style={s.heroTitleRow}>
        <Text style={[s.heroWord, { color: C.textPrimary }]}>Free Offline</Text>
        <Text style={[s.heroWord, { color: C.accent }]}>Translator</Text>
      </View>
      <Text style={[s.heroSub, { color: C.textSecondary }]}>{t.obHeroSub}</Text>

      <View style={[s.featureCard, { backgroundColor: C.surface, borderColor: C.border }, DS.shadow.level1(isDark)]}>
        {features.map((f, i) => (
          <View key={f.icon}>
            <View style={s.featureRow}>
              <View style={[s.featureIcon, { backgroundColor: C.accentSoft }]}>
                <Ionicons name={f.icon} size={DS.icon.md} color={C.accent} />
              </View>
              <View style={s.featureText}>
                <Text style={[s.featureTitle, { color: C.textPrimary }]}>{f.title}</Text>
                <Text style={[s.featureDesc,  { color: C.textMuted   }]}>{f.desc}</Text>
              </View>
            </View>
            {i < features.length - 1 && (
              <View style={[s.featureDivider, { backgroundColor: C.border }]} />
            )}
          </View>
        ))}
      </View>

      <View style={s.ctaWrap}>
        <TouchableOpacity
          onPress={finish}
          style={[s.ctaBtn, { backgroundColor: C.primary }, DS.shadow.level2(isDark)]}
          activeOpacity={0.85}
        >
          <Text style={[s.ctaLabel, { color: C.background }]}>{t.obStart}</Text>
          <Ionicons name="arrow-forward" size={DS.icon.sm} color={C.background} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: C.background }]} edges={['top', 'left', 'right', 'bottom']}>

      <View style={s.navBar}>
        {step === 1 ? (
          <TouchableOpacity
            onPress={retreat}
            style={[s.backBtn, { backgroundColor: C.surface, borderColor: C.border }, DS.shadow.level1(isDark)]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={DS.icon.md} color={C.textSecondary} />
          </TouchableOpacity>
        ) : (
          <View style={s.backBtn} />
        )}
      </View>

      <Animated.View style={[s.slide, { transform: [{ translateX: slideX }] }]}>
        {step === 0 ? renderStep0() : renderStep1()}
      </Animated.View>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:  { flex: 1 },
  slide: { flex: 1, paddingHorizontal: DS.space.lg },

  navBar: {
    paddingHorizontal: DS.space.lg,
    paddingTop: DS.space.sm,
    paddingBottom: DS.space.xs,
    height: 52,
  },
  backBtn: {
    ...DS.control.iconBtnMd,
    borderRadius: DS.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  // Step 0
  pickFlex:     { flex: 1, paddingBottom: DS.space.sm },
  pickHeadline: { ...DS.type.title1, paddingTop: DS.space.sm },
  pickSub:      { ...DS.type.subhead, marginBottom: DS.space.sm, marginTop: DS.space.xs },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DS.space.sm,
    paddingBottom: DS.space.sm,
  },

  // Step 1
  welcomeFlex: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.md,
    paddingBottom: DS.space.lg,
  },
  heroEmoji:    { fontSize: 64 },
  heroTitleRow: { flexDirection: 'row', gap: DS.space.xs + 2, alignItems: 'baseline' },
  heroWord:     { ...DS.type.title1, fontWeight: '800' },
  heroSub:      { ...DS.type.subhead, textAlign: 'center', maxWidth: 260 },

  featureCard: {
    width: '100%',
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm + DS.space.xs,
    padding: DS.space.md,
  },
  featureIcon: {
    width: 42, height: 42,
    borderRadius: DS.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText:    { flex: 1, gap: 3 },
  featureTitle:   { ...DS.type.subhead, fontWeight: '700' },
  featureDesc:    { ...DS.type.footnote, lineHeight: 18 },
  featureDivider: { height: StyleSheet.hairlineWidth, marginLeft: DS.space.md + 42 + DS.space.sm + DS.space.xs },

  ctaWrap: { width: '100%', marginTop: DS.space.xs },
  ctaBtn: {
    height: DS.control.ctaHeight,
    borderRadius: DS.radius.lg + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
  },
  ctaLabel: { ...DS.type.headline },
});
