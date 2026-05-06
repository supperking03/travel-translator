import React, { useCallback, useRef, useState } from 'react';
import {
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
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';

import { useStore } from '@/store/useStore';
import { useLlama } from '@/hooks/useLlama';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useTheme } from '@/constants/theme';
import { getLanguageByCode } from '@/constants/languages';

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

// ─── Translate button ─────────────────────────────────────────────────────────
function TranslateButton({
  onPress, disabled, isTranslating, colors, isDark,
}: {
  onPress: () => void;
  disabled: boolean;
  isTranslating: boolean;
  colors: ReturnType<typeof useTheme>;
  isDark: boolean;
}) {
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
            ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border }
            : { backgroundColor: isTranslating ? colors.primaryDark : colors.primary, ...cardShadow(isDark) },
          { transform: [{ scale }] },
        ]}
      >
        {isTranslating ? (
          <>
            <ActivityIndicator color={colors.background} size="small" />
            <Text style={[styles.translateBtnText, { color: colors.background }]}>Translating…</Text>
          </>
        ) : (
          <>
            <Ionicons
              name="language"
              size={18}
              color={isEmpty ? colors.textMuted : colors.background}
            />
            <Text style={[styles.translateBtnText, {
              color: isEmpty ? colors.textMuted : colors.background,
              fontSize: isEmpty ? 14 : 16,
              fontWeight: isEmpty ? '500' : '700',
            }]}>
              {isEmpty ? 'Type something to translate' : 'Translate'}
            </Text>
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
  colors: ReturnType<typeof useTheme>;
  isDark: boolean;
}) {
  const lang = getLanguageByCode(targetLangCode);
  const canSpeak = !!lang?.ttsLocale;

  return (
    <View style={[
      styles.resultCard,
      { backgroundColor: colors.card, borderColor: colors.primary + '35' },
      cardShadow(isDark),
    ]}>
      {/* Accent bar */}
      <View style={[styles.resultAccentBar, { backgroundColor: colors.primary }]} />

      {/* Header */}
      <View style={[styles.resultHeader, { borderBottomColor: colors.border }]}>
        <Text style={styles.resultLangFlag}>{lang?.flag ?? '🌐'}</Text>
        <View style={styles.resultHeaderMeta}>
          <Text style={[styles.resultLangLabel, { color: colors.textMuted }]}>TRANSLATION</Text>
          <Text style={[styles.resultLangName, { color: colors.primary }]}>
            {lang?.name ?? 'Unknown'}
          </Text>
        </View>
      </View>

      {/* Text */}
      <Text style={[styles.resultText, { color: colors.text }]} selectable>
        {translatedText}
      </Text>

      {/* Actions */}
      <View style={[styles.resultActions, { borderTopColor: colors.border }]}>
        {canSpeak && (
          <TouchableOpacity
            style={[
              styles.actionChip,
              {
                backgroundColor: isSpeaking ? colors.primary : colors.primaryDim,
                borderWidth: 1,
                borderColor: isSpeaking ? colors.primary : colors.primary + '28',
              },
            ]}
            onPress={onSpeak}
            activeOpacity={0.75}
          >
            <Ionicons
              name={isSpeaking ? 'stop-circle' : 'volume-high-outline'}
              size={15}
              color={isSpeaking ? colors.background : colors.primary}
            />
            <Text style={[styles.actionChipText, { color: isSpeaking ? colors.background : colors.primary }]}>
              {isSpeaking ? 'Stop' : 'Speak'}
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
          <Ionicons name="copy-outline" size={15} color={colors.textSecondary} />
          <Text style={[styles.actionChipText, { color: colors.textSecondary }]}>Copy</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function TranslatorScreen() {
  const colors = useTheme();
  const scheme = useColorScheme();
  const isDark  = scheme !== 'light';
  const router  = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const swapAngle = useRef(0);
  const swapAnim  = useRef(new Animated.Value(0)).current;

  const {
    sourceLang, targetLang,
    sourceText, translatedText,
    isTranslating,
    setSourceLang, setTargetLang,
    setSourceText, setTranslatedText,
    setIsTranslating, swapLanguages,
    addHistory,
  } = useStore();

  const { translate, isReady } = useLlama();

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) return;
    if (!isReady) {
      Alert.alert(
        'Model Not Ready',
        'Please download the AI model first. Tap the status banner at the top.',
        [{ text: 'Go to Settings', onPress: () => router.push('/settings') }, { text: 'Cancel' }]
      );
      return;
    }
    if (sourceLang === targetLang) {
      Alert.alert('Same Language', 'Please select different source and target languages.');
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
    Alert.alert('Copied', 'Translation copied to clipboard');
  }, [translatedText]);

  const handleClear = useCallback(() => {
    setSourceText('');
    setTranslatedText('');
    setIsSpeaking(false);
    inputRef.current?.focus();
  }, [setSourceText, setTranslatedText]);

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
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
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
                <Text style={[styles.appTitle, { color: colors.text }]}>Travel</Text>
                <Text style={[styles.appTitleAccent, { color: colors.primary }]}>Translator</Text>
              </View>
              <Text style={[styles.appSubtitle, { color: colors.textMuted }]}>Offline · AI-powered</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              style={[styles.navIconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.75}
            >
              <Ionicons name="settings-outline" size={19} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* ── Language selector ─────────────────────────────────────────── */}
          <View style={[styles.langCard, { backgroundColor: colors.card, borderColor: colors.border }, cardShadow(isDark)]}>
            <View style={styles.langRow}>
              <LanguageSelector selectedCode={sourceLang} onSelect={setSourceLang} label="FROM" />

              <TouchableOpacity
                style={[styles.swapBtn, { backgroundColor: colors.primaryDim }]}
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
                  <Ionicons name="swap-horizontal" size={20} color={colors.primary} />
                </Animated.View>
              </TouchableOpacity>

              <LanguageSelector selectedCode={targetLang} onSelect={setTargetLang} label="TO" />
            </View>
          </View>

          {/* ── Input ─────────────────────────────────────────────────────── */}
          <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }, cardShadow(isDark)]}>
            <TextInput
              ref={inputRef}
              style={[styles.textInput, { color: colors.text }]}
              placeholder="Tap to type or paste…"
              placeholderTextColor={colors.textMuted}
              value={sourceText}
              onChangeText={setSourceText}
              multiline
              maxLength={1000}
              textAlignVertical="top"
            />
            <View style={[styles.inputFooter, { borderTopColor: colors.border }]}>
              {sourceText.length > 0 ? (
                <Text style={[styles.charCount, {
                  color: charNearLimit ? colors.warning : colors.textMuted,
                  fontWeight: charNearLimit ? '600' : '400',
                }]}>
                  {sourceText.length}/1000
                </Text>
              ) : (
                <View />
              )}
              <View style={styles.inputActions}>
                {sourceText.length > 0 && (
                  <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* ── Translate button ──────────────────────────────────────────── */}
          <TranslateButton
            onPress={handleTranslate}
            disabled={!sourceText.trim() || isTranslating}
            isTranslating={isTranslating}
            colors={colors}
            isDark={isDark}
          />

          {/* ── Result ────────────────────────────────────────────────────── */}
          {(translatedText !== '' || isTranslating) && (
            <View>
              {isTranslating && translatedText === '' ? (
                <View style={[styles.loadingCard, { backgroundColor: colors.card, borderColor: colors.border }, cardShadow(isDark)]}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.loadingTitle, { color: colors.text }]}>Translating…</Text>
                  <Text style={[styles.loadingSub, { color: colors.textMuted }]}>This may take a moment</Text>
                </View>
              ) : (
                <TranslationResultCard
                  translatedText={translatedText}
                  targetLangCode={targetLang}
                  isSpeaking={isSpeaking}
                  onSpeak={handleSpeak}
                  onCopy={handleCopy}
                  colors={colors}
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
  scroll: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },

  // Nav
  navRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  navTitleRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  appTitle:      { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  appTitleAccent:{ fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  appSubtitle:   { fontSize: 12, fontWeight: '500', marginTop: 2 },
  navIconBtn: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },

  // Language card
  langCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swapBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Input card
  inputCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  textInput: {
    fontSize: 17,
    lineHeight: 26,
    padding: 16,
    minHeight: 130,
    textAlignVertical: 'top',
  },
  inputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  charCount:    { fontSize: 12 },
  inputActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Translate button
  translateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 18,
  },
  translateBtnText: { fontSize: 16, fontWeight: '700' },

  // Loading card
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  loadingTitle: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  loadingSub:   { fontSize: 13 },

  // Result card
  resultCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  resultAccentBar: { height: 3 },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultLangFlag:  { fontSize: 24 },
  resultHeaderMeta:{ flex: 1 },
  resultLangLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  resultLangName:  { fontSize: 14, fontWeight: '700', marginTop: 1 },
  resultText: {
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 31,
    padding: 16,
    paddingTop: 14,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexWrap: 'wrap',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  actionChipText: { fontSize: 13, fontWeight: '600' },

  bottomSpacer: { height: 32 },
});
