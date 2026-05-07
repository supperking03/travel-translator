import React, { useCallback, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';

import { useStore } from '@/store/useStore';
import { useLlama } from '@/hooks/useLlama';
import { LanguageSelector } from '@/components/LanguageSelector';
import { DS, useDSColors, useDSIsDark, DSColors } from '@/constants/designSystem';
import { getLanguageByCode } from '@/constants/languages';
import { useI18n } from '@/i18n/useI18n';
import { recognizeTextFromImage } from '@/utils/imageTextRecognition';

// ─── Translate button ─────────────────────────────────────────────────────────
function TranslateButton({
  onPress, disabled, isTranslating, colors, isDark,
}: {
  onPress: () => void;
  disabled: boolean;
  isTranslating: boolean;
  colors: DSColors;
  isDark: boolean;
}) {
  const t     = useI18n();
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 20 }).start();

  const isEmpty = disabled && !isTranslating;

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={isEmpty ? undefined : onIn}
      onPressOut={isEmpty ? undefined : onOut}
      disabled={disabled || isTranslating}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          styles.translateBtn,
          isEmpty
            ? { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border }
            : {
                backgroundColor: isTranslating ? colors.primaryDark : colors.primary,
                ...DS.shadow.level2(isDark),
              },
          { transform: [{ scale }] },
        ]}
      >
        {isTranslating ? (
          <>
            <ActivityIndicator color={colors.background} size="small" />
            <Text style={[styles.translateBtnText, { color: colors.background }]}>{t.mTranslating}</Text>
          </>
        ) : (
          <>
            <Ionicons name="language" size={DS.icon.sm} color={isEmpty ? colors.textMuted : colors.background} />
            <Text style={[styles.translateBtnText, { color: isEmpty ? colors.textMuted : colors.background }]}>{t.mTranslate}</Text>
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Result card ──────────────────────────────────────────────────────────────
function TranslationResultCard({
  translatedText, targetLangCode, isSpeaking, onSpeak, onCopy, colors, isDark,
}: {
  translatedText: string;
  targetLangCode: string;
  isSpeaking: boolean;
  onSpeak: () => void;
  onCopy: () => void;
  colors: DSColors;
  isDark: boolean;
}) {
  const t        = useI18n();
  const lang     = getLanguageByCode(targetLangCode);
  const canSpeak = !!lang?.ttsLocale;

  return (
    <View style={[
      styles.resultCard,
      { backgroundColor: colors.surface, borderColor: colors.primary + '35' },
      DS.shadow.level2(isDark),
    ]}>
      {/* Accent bar */}
      <View style={[styles.resultAccentBar, { backgroundColor: colors.primary }]} />

      {/* Header */}
      <View style={[styles.resultHeader, { borderBottomColor: colors.border }]}>
        <Text style={styles.resultLangFlag}>{lang?.flag ?? '🌐'}</Text>
        <View style={styles.resultHeaderMeta}>
          <Text style={[styles.resultLangLabel, { color: colors.textMuted }]}>{t.mTranslationLabel.toUpperCase()}</Text>
          <Text style={[styles.resultLangName, { color: colors.primary }]}>
            {lang?.name ?? 'Unknown'}
          </Text>
        </View>
      </View>

      {/* Translated text */}
      <Text style={[styles.resultText, { color: colors.textPrimary }]} selectable>
        {translatedText}
      </Text>

      {/* Action chips */}
      <View style={[styles.resultActions, { borderTopColor: colors.border }]}>
        {canSpeak && (
          <TouchableOpacity
            style={[
              styles.actionChip,
              {
                backgroundColor: isSpeaking ? colors.primary : colors.accentSoft,
                borderWidth: 1,
                borderColor: isSpeaking ? colors.primary : colors.primary + '28',
              },
            ]}
            onPress={onSpeak}
            activeOpacity={0.75}
          >
            <Ionicons
              name={isSpeaking ? 'stop-circle' : 'volume-high-outline'}
              size={DS.icon.xs + 3}
              color={isSpeaking ? colors.background : colors.primary}
            />
            <Text style={[styles.actionChipText, { color: isSpeaking ? colors.background : colors.primary }]}>
              {isSpeaking ? t.mStop : t.mSpeak}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionChip, {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }]}
          onPress={onCopy}
          activeOpacity={0.75}
        >
          <Ionicons name="copy-outline" size={DS.icon.xs + 3} color={colors.textSecondary} />
          <Text style={[styles.actionChipText, { color: colors.textSecondary }]}>{t.mCopy}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function TranslatorScreen() {
  const C       = useDSColors();
  const isDark  = useDSIsDark();
  const t       = useI18n();
  const router  = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isReadingImage, setIsReadingImage] = useState(false);

  const {
    sourceLang, targetLang,
    sourceText, translatedText,
    isTranslating,
    setSourceLang, setTargetLang,
    setSourceText, setTranslatedText,
    setIsTranslating, swapLanguages,
    addHistory,
    onboardingComplete,
  } = useStore();

  const swapAngle = useRef(0);
  const swapAnim  = useRef(new Animated.Value(0)).current;

  const { translate, isReady } = useLlama();

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) return;
    if (!isReady) {
      router.push('/settings?focus=download');
      return;
    }
    Keyboard.dismiss();
    try {
      setIsTranslating(true);
      setTranslatedText('');
      const result = await translate(sourceText, sourceLang, targetLang);
      setTranslatedText(result);
      addHistory({ sourceText, translatedText: result, sourceLang, targetLang });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Translation failed';
      Alert.alert('Translation Error', msg);
    } finally {
      setIsTranslating(false);
    }
  }, [sourceText, sourceLang, targetLang, isReady, translate, setIsTranslating, setTranslatedText, addHistory, router]);

  const handleCopy = useCallback(async () => {
    if (!translatedText) return;
    await Clipboard.setStringAsync(translatedText);
    Alert.alert(t.mCopied, '');
  }, [translatedText]);

  const handleClear = useCallback(() => {
    setSourceText('');
    setTranslatedText('');
    setIsSpeaking(false);
    inputRef.current?.focus();
  }, [setSourceText, setTranslatedText]);

  const handleRecognizedImage = useCallback(async (imageUri: string) => {
    try {
      setIsReadingImage(true);
      const extracted = (await recognizeTextFromImage(imageUri)).trim();

      if (!extracted) {
        Alert.alert(t.mNoTextFound ?? 'No text found in this image.');
        return;
      }

      setSourceText(extracted);
      setTranslatedText('');
      inputRef.current?.focus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read text from image.';
      Alert.alert('Image Text Error', message);
    } finally {
      setIsReadingImage(false);
    }
  }, [setSourceText, setTranslatedText, t.mNoTextFound]);

  const handlePickPhoto = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t.mPhotoPermissionTitle ?? 'Photo access required',
        t.mPhotoPermissionDesc ?? 'Allow photo access to choose an image for translation.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
      selectionLimit: 1,
    });

    if (result.canceled || !result.assets[0]?.uri) return;
    await handleRecognizedImage(result.assets[0].uri);
  }, [handleRecognizedImage, t.mPhotoPermissionDesc, t.mPhotoPermissionTitle]);

  const handleTakePhoto = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t.mCameraPermissionTitle ?? 'Camera permission required',
        t.mCameraPermissionDesc ?? 'Allow camera access to take a photo for translation.'
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]?.uri) return;
    await handleRecognizedImage(result.assets[0].uri);
  }, [handleRecognizedImage, t.mCameraPermissionDesc, t.mCameraPermissionTitle]);

  const handleImageOptions = useCallback(() => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [
          t.mPhotoLibrary ?? 'Photo',
          t.mTakePhoto ?? 'Camera',
          t.aCancel,
        ],
        cancelButtonIndex: 2,
      },
      (buttonIndex) => {
        if (buttonIndex === 0) {
          void handlePickPhoto();
        } else if (buttonIndex === 1) {
          void handleTakePhoto();
        }
      }
    );
  }, [handlePickPhoto, handleTakePhoto, t.aCancel, t.mPhotoLibrary, t.mTakePhoto]);

  const handleSpeak = useCallback(() => {
    const lang = getLanguageByCode(targetLang);
    if (!lang?.ttsLocale) return;
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    Speech.speak(translatedText, {
      language: lang.ttsLocale,
      rate: 0.9,
      onDone:    () => setIsSpeaking(false),
      onError:   () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
    });
  }, [isSpeaking, translatedText, targetLang]);

  const handleSwap = useCallback(() => {
    setIsSpeaking(false);
    swapLanguages();
    swapAngle.current += 360;
    Animated.spring(swapAnim, {
      toValue: swapAngle.current,
      useNativeDriver: true,
      speed: 12,
      bounciness: 4,
    }).start();
  }, [swapLanguages, swapAnim]);

  const charNearLimit = sourceText.length > 800;

  if (!onboardingComplete) return <Redirect href="/onboarding" />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Nav ──────────────────────────────────────────────────────── */}
          <View style={styles.navRow}>
            <View>
              <View style={styles.navTitleRow}>
                <Text style={[styles.appTitle, { color: C.textPrimary }]}>AI Offline</Text>
                <Text style={[styles.appTitleAccent, { color: C.primary }]}>Translator</Text>
              </View>
              <Text style={[styles.appSubtitle, { color: C.textMuted }]}>{t.mSubtitle}</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              style={[styles.navIconBtn, { backgroundColor: C.surface, borderColor: C.border }, DS.shadow.level1(isDark)]}
              activeOpacity={0.75}
            >
              <Ionicons name="settings-outline" size={DS.icon.md - 1} color={C.primary} />
            </TouchableOpacity>
          </View>

          {/* ── Input ─────────────────────────────────────────────────────── */}
          <View style={[styles.inputCard, { backgroundColor: C.surface, borderColor: C.border }, DS.shadow.level1(isDark)]}>
            <TextInput
              ref={inputRef}
              style={[styles.textInput, { color: C.textPrimary }]}
              placeholder={t.mPlaceholder}
              placeholderTextColor={C.textMuted}
              value={sourceText}
              onChangeText={setSourceText}
              multiline
              maxLength={1000}
              textAlignVertical="top"
            />
            <View style={[styles.inputFooter, { borderTopColor: C.border }]}>
              {charNearLimit ? (
                <Text style={[styles.charCount, { color: C.warning, fontWeight: '600' }]}>
                  {sourceText.length}/1000
                </Text>
              ) : (
                <View />
              )}
              <View style={styles.inputActions}>
                <TouchableOpacity
                  onPress={handleImageOptions}
                  disabled={isReadingImage}
                  hitSlop={{ top: DS.space.sm, bottom: DS.space.sm, left: DS.space.sm, right: DS.space.sm }}
                >
                  {isReadingImage ? (
                    <ActivityIndicator size="small" color={C.primary} />
                  ) : (
                    <Ionicons name="image-outline" size={20} color={C.primary} />
                  )}
                </TouchableOpacity>
                {sourceText.length > 0 && (
                  <TouchableOpacity onPress={handleClear} hitSlop={{ top: DS.space.sm, bottom: DS.space.sm, left: DS.space.sm, right: DS.space.sm }}>
                    <Ionicons name="close-circle" size={22} color={C.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* ── Language selector ─────────────────────────────────────────── */}
          <View style={[styles.langCard, { backgroundColor: C.surface, borderColor: C.border }, DS.shadow.level1(isDark)]}>
            <View style={styles.langRow}>
              <LanguageSelector selectedCode={sourceLang} onSelect={setSourceLang} label="FROM" />
              <TouchableOpacity
                style={[styles.swapBtn, { backgroundColor: C.accentSoft }]}
                onPress={handleSwap}
                activeOpacity={0.75}
              >
                <Animated.View style={{
                  transform: [{
                    rotate: swapAnim.interpolate({
                      inputRange: [0, 360],
                      outputRange: ['0deg', '360deg'],
                      extrapolate: 'extend',
                    }),
                  }],
                }}>
                  <Ionicons name="swap-horizontal" size={DS.icon.md} color={C.primary} />
                </Animated.View>
              </TouchableOpacity>
              <LanguageSelector selectedCode={targetLang} onSelect={setTargetLang} label="TO" />
            </View>
          </View>

          {/* ── Translate button ──────────────────────────────────────────── */}
          <TranslateButton
            onPress={handleTranslate}
            disabled={!sourceText.trim() || isTranslating}
            isTranslating={isTranslating}
            colors={C}
            isDark={isDark}
          />

          {/* ── Result / Loading ──────────────────────────────────────────── */}
          {(translatedText !== '' || isTranslating) && (
            <View>
              {isTranslating && translatedText === '' ? (
                <View style={[styles.loadingCard, { backgroundColor: C.surface, borderColor: C.border }, DS.shadow.level2(isDark)]}>
                  <ActivityIndicator size="large" color={C.primary} />
                  <Text style={[styles.loadingTitle, { color: C.textPrimary }]}>{t.mTranslating}</Text>
                  <Text style={[styles.loadingSub, { color: C.textMuted }]}>{t.mLoadingSub}</Text>
                </View>
              ) : (
                <TranslationResultCard
                  translatedText={translatedText}
                  targetLangCode={targetLang}
                  isSpeaking={isSpeaking}
                  onSpeak={handleSpeak}
                  onCopy={handleCopy}
                  colors={C}
                  isDark={isDark}
                />
              )}
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:  { flex: 1 },
  flex:  { flex: 1 },
  scroll: { paddingHorizontal: DS.space.md, paddingTop: 14, gap: DS.space.sm + DS.space.xs },

  // Nav
  navRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: DS.space.xs },
  navTitleRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  appTitle:       { ...DS.type.title2, fontWeight: '800' },
  appTitleAccent: { ...DS.type.title2, fontWeight: '800' },
  appSubtitle:    { ...DS.type.caption1, fontWeight: '500', marginTop: 2 },
  navIconBtn: {
    ...DS.control.iconBtnMd,
    borderRadius: DS.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  // Language card
  langCard: {
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    padding: DS.space.sm + DS.space.xs,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
  },
  swapBtn: {
    ...DS.control.iconBtnMd,
    borderRadius: DS.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Input card
  inputCard: {
    borderRadius: DS.radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  textInput: {
    ...DS.type.body,
    padding: DS.space.md,
    height: 100,
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  inputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: DS.space.md - 2,
    paddingVertical: DS.space.sm + DS.space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  charCount:    { ...DS.type.caption1 },
  inputActions: { flexDirection: 'row', alignItems: 'center', gap: DS.space.sm + DS.space.xs },

  // Translate button
  translateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm,
    height: DS.control.ctaHeight,
    borderRadius: DS.radius.lg + 2,
  },
  translateBtnText: { ...DS.type.callout, fontWeight: '700' },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: DS.space.xl,
    gap: DS.space.xs,
  },
  emptyEmoji: { fontSize: 44, marginBottom: DS.space.xs },
  emptyTitle: { ...DS.type.subhead, fontWeight: '600' },
  emptySub:   { ...DS.type.footnote },

  // Loading card
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: DS.space.sm + DS.space.xs,
    paddingVertical: DS.space.xxl - DS.space.xs,
    paddingHorizontal: DS.space.md,
    borderRadius: DS.radius.xl,
    borderWidth: 1,
  },
  loadingTitle: { ...DS.type.callout, fontWeight: '600', marginTop: DS.space.xs },
  loadingSub:   { ...DS.type.footnote },

  // Result card
  resultCard: {
    borderRadius: DS.radius.xl,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  resultAccentBar:  { height: 3 },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm + DS.space.xs,
    paddingHorizontal: DS.space.md,
    paddingVertical: DS.space.sm + DS.space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultLangFlag:   { fontSize: DS.icon.lg },
  resultHeaderMeta: { flex: 1 },
  resultLangLabel:  { ...DS.type.label },
  resultLangName:   { ...DS.type.subhead, fontWeight: '700', marginTop: 1 },
  resultText: {
    ...DS.type.title3,
    fontWeight: '500',
    padding: DS.space.md,
    paddingTop: DS.space.sm + DS.space.xs,
  },
  resultActions: {
    flexDirection: 'row',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.sm + DS.space.xs,
    paddingVertical: DS.space.sm + DS.space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexWrap: 'wrap',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs + 1,
    paddingHorizontal: DS.space.sm + DS.space.xs,
    paddingVertical: DS.space.sm + 1,
    borderRadius: DS.radius.full,
  },
  actionChipText: { ...DS.type.footnote, fontWeight: '600' },

  bottomSpacer: { height: DS.space.xl },
});
