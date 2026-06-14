import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Animated,
  ActivityIndicator,
  Image,
  LayoutChangeEvent,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { AudioSessionIos } from 'whisper.rn';
import { ReactNativeZoomableView } from '@openspacelabs/react-native-zoomable-view';

import { useStore } from '@/store/useStore';
import { useLlama } from '@/hooks/useLlama';
import { useWhisper } from '@/hooks/useWhisper';
import { LanguageSelector } from '@/components/LanguageSelector';
import { DS, useDSColors, useDSIsDark, DSColors } from '@/constants/designSystem';
import { getLanguageByCode } from '@/constants/languages';
import { useI18n } from '@/i18n/useI18n';
import { recognizeTextBlocksFromImage, TextBlock } from '@/utils/imageTextRecognition';
import { maybeAskForReview } from '@/utils/reviewPrompt';
import { track, trackScreen } from '@/utils/analytics';
import { stripWhisperNoise } from '@/constants/model';
import { extractTextFromFile, isSupportedTextImportFile } from '@/utils/importFileText';

type TranslatedBlock = TextBlock & { translated: string; isPending: boolean };
type ImageTranslatePhase = 'idle' | 'ocr' | 'translating' | 'done' | 'error';
type ResultMode = 'text' | 'image';
const OCR_TRANSLATION_BATCH_CHAR_LIMIT = 900;
const OCR_TRANSLATION_BATCH_ITEM_LIMIT = 12;
async function ensureMicrophonePermission() {
  if (Platform.OS !== 'android') return true;

  const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
  const alreadyGranted = await PermissionsAndroid.check(permission);
  if (alreadyGranted) return true;

  const result = await PermissionsAndroid.request(permission, {
    title: 'Microphone permission',
    message: 'Nomad Translator needs microphone access for offline voice translation.',
    buttonNegative: 'Cancel',
    buttonPositive: 'OK',
  });

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

type TranslationBatch = {
  indexes: number[];
  blocks: TextBlock[];
};

function getAdaptiveOverlayFontSize(block: TranslatedBlock, baseFontSize: number): number {
  if (block.isPending) return baseFontSize;

  const sourceLength = Math.max(block.text.trim().length, 1);
  const translatedLength = Math.max(block.translated.trim().length, 1);
  const growthRatio = translatedLength / sourceLength;

  if (growthRatio <= 1.15) {
    return baseFontSize;
  }

  if (growthRatio >= 2.4) {
    return Math.max(7, baseFontSize * 0.62);
  }

  if (growthRatio >= 1.8) {
    return Math.max(7.5, baseFontSize * 0.72);
  }

  if (growthRatio >= 1.45) {
    return Math.max(8, baseFontSize * 0.82);
  }

  return Math.max(8.5, baseFontSize * 0.9);
}

function splitBlocksForTranslation(blocks: TextBlock[]): TranslationBatch[] {
  const batches: TranslationBatch[] = [];
  let currentBatch: TextBlock[] = [];
  let currentIndexes: number[] = [];
  let currentChars = 0;

  for (const [index, block] of blocks.entries()) {
    const blockChars = block.text.length;
    const wouldOverflow =
      currentBatch.length >= OCR_TRANSLATION_BATCH_ITEM_LIMIT ||
      (currentBatch.length > 0 && currentChars + blockChars > OCR_TRANSLATION_BATCH_CHAR_LIMIT);

    if (wouldOverflow) {
      batches.push({ indexes: currentIndexes, blocks: currentBatch });
      currentBatch = [];
      currentIndexes = [];
      currentChars = 0;
    }

    currentBatch.push(block);
    currentIndexes.push(index);
    currentChars += blockChars;
  }

  if (currentBatch.length > 0) {
    batches.push({ indexes: currentIndexes, blocks: currentBatch });
  }

  return batches;
}

async function translateBlockBatch(
  blocks: TextBlock[],
  targetLangCode: string,
  translate: (text: string, sourceLang: string, targetLang: string) => Promise<string>
): Promise<string[]> {
  const targetName = getLanguageByCode(targetLangCode)?.name ?? targetLangCode;
  const numbered = blocks.map((block, index) => `${index + 1}. ${block.text}`).join('\n');
  const prompt = `Translate each numbered item to ${targetName}. Reply only with the numbered translations, same format:\n${numbered}`;
  const raw = await translate(prompt, 'auto', targetLangCode);

  const parsed = new Array<string>(blocks.length).fill('');
  for (const line of raw.split('\n')) {
    const match = line.match(/^(\d+)[.)]\s*(.+)$/);
    if (!match) continue;

    const idx = parseInt(match[1], 10) - 1;
    if (idx >= 0 && idx < blocks.length) {
      parsed[idx] = match[2].trim();
    }
  }

  return parsed.map((item, index) => item || blocks[index].text);
}

// ─── Translate button ─────────────────────────────────────────────────────────
function TranslateButton({
  onPress, disabled, isTranslating, isCabinMode, colors, isDark,
}: {
  onPress: () => void;
  disabled: boolean;
  isTranslating: boolean;
  isCabinMode: boolean;
  colors: DSColors;
  isDark: boolean;
}) {
  const t     = useI18n();
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 20 }).start();

  // Pulsing "listening" dot while cabin mode is recording, so the button reads as live.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isCabinMode) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isCabinMode, pulse]);

  const isEmpty = disabled && !isTranslating && !isCabinMode;

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
        ) : isCabinMode ? (
          <>
            <Animated.View style={[styles.translateBtnPulseDot, { backgroundColor: colors.background, opacity: pulse }]} />
            <Text style={[styles.translateBtnText, { color: colors.background }]}>
              {t.mStopAndTranslate ?? 'Stop & Translate'}
            </Text>
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
  translatedText,
  targetLangCode,
  isSpeaking,
  onSpeak,
  onCopy,
  colors,
  isDark,
  imagePreviewUri,
  imagePreviewBlocks,
  imageAspectRatio,
  resultMode,
  imagePhase,
  imageTranslatedCount,
  imageTotalCount,
  onToggleResultMode,
  onPreviewTouchStart,
  onPreviewTouchEnd,
}: {
  translatedText: string;
  targetLangCode: string;
  isSpeaking: boolean;
  onSpeak: () => void;
  onCopy: () => void;
  colors: DSColors;
  isDark: boolean;
  imagePreviewUri?: string | null;
  imagePreviewBlocks: TranslatedBlock[];
  imageAspectRatio?: number | null;
  resultMode: ResultMode;
  imagePhase: ImageTranslatePhase;
  imageTranslatedCount: number;
  imageTotalCount: number;
  onToggleResultMode?: () => void;
  onPreviewTouchStart?: () => void;
  onPreviewTouchEnd?: () => void;
}) {
  const t        = useI18n();
  const lang     = getLanguageByCode(targetLangCode);
  const canSpeak = !!lang?.ttsLocale;
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [selectedOverlayKey, setSelectedOverlayKey] = useState<string | null>(null);
  const hasImagePreview = !!imagePreviewUri && !!imageAspectRatio;

  const handlePreviewLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPreviewSize({ width, height });
  }, []);

  const handleOverlayPress = useCallback((block: TranslatedBlock, overlayKey: string) => {
    if (block.isPending || !block.translated.trim()) return;
    setSelectedOverlayKey(overlayKey);
    Alert.alert(
      block.text || 'Translation',
      block.translated,
      [
        {
          text: 'OK',
          onPress: () => setSelectedOverlayKey(null),
        },
      ],
      {
        onDismiss: () => setSelectedOverlayKey(null),
      }
    );
  }, []);

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
        {hasImagePreview && onToggleResultMode && (
          <TouchableOpacity
            style={[styles.modeSwitchBtn, { backgroundColor: colors.accentSoft, borderColor: colors.primary + '28' }]}
            onPress={onToggleResultMode}
            activeOpacity={0.75}
          >
            <Ionicons
              name={resultMode === 'image' ? 'document-text-outline' : 'image-outline'}
              size={DS.icon.xs + 2}
              color={colors.primary}
            />
            <Text style={[styles.modeSwitchText, { color: colors.primary }]}>
              {resultMode === 'image'
                ? (t.mViewText ?? 'View text')
                : (t.mViewImage ?? 'View image')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {resultMode === 'image' && hasImagePreview ? (
        <View style={styles.imageResultBody}>
          {imagePhase === 'translating' && imageTotalCount > 0 && (
            <View style={[styles.imageProgressBanner, { backgroundColor: colors.accentSoft, borderColor: colors.primary + '28' }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.imageProgressText, { color: colors.primary }]}>
                {`Translated ${imageTranslatedCount}/${imageTotalCount}`}
              </Text>
            </View>
          )}
          <View
            style={[styles.imagePreviewFrame, { backgroundColor: colors.background, aspectRatio: imageAspectRatio }]}
            onLayout={handlePreviewLayout}
            onTouchStart={onPreviewTouchStart}
            onTouchEnd={onPreviewTouchEnd}
            onTouchCancel={onPreviewTouchEnd}
          >
            {previewSize.width > 0 && previewSize.height > 0 && (
              <ReactNativeZoomableView
                maxZoom={5}
                minZoom={1}
                zoomStep={0.5}
                initialZoom={1}
                bindToBorders={false}
                style={styles.zoomablePreview}
                contentWidth={previewSize.width}
                contentHeight={previewSize.height}
              >
                <View style={{ width: previewSize.width, height: previewSize.height }}>
                  <Image
                    source={{ uri: imagePreviewUri }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="contain"
                  />

                  {imagePreviewBlocks.map((block, index) => {
                    const overlayKey = `${index}-${block.text}`;
                    const left = block.x * previewSize.width;
                    const top = block.y * previewSize.height;
                    const width = block.width * previewSize.width;
                    const height = block.height * previewSize.height;
                    const baseFontSize = Math.max(8, Math.min(height * 0.68, 15));
                    const fontSize = getAdaptiveOverlayFontSize(block, baseFontSize);
                    const isSelected = selectedOverlayKey === overlayKey;

                    return (
                      <Pressable
                        key={overlayKey}
                        disabled={block.isPending}
                        onPress={() => handleOverlayPress(block, overlayKey)}
                        style={[
                          styles.overlayBlock,
                          {
                            left,
                            top,
                            width,
                            minHeight: height,
                            backgroundColor: block.isPending
                              ? 'rgba(255,255,255,0.82)'
                              : isSelected
                                ? colors.primary + '33'
                                : 'rgba(255,255,255,0.9)',
                            borderWidth: isSelected ? 1 : 0,
                            borderColor: isSelected ? colors.primary : 'transparent',
                          },
                        ]}
                      >
                        {block.isPending ? (
                          <View style={styles.overlayLoading}>
                            <ActivityIndicator size="small" color={colors.primary} />
                          </View>
                        ) : (
                          <Text
                            style={[
                              styles.overlayText,
                              {
                                color: isSelected ? colors.primaryDark : '#0F172A',
                                fontSize,
                                lineHeight: Math.max(fontSize + 1, fontSize * 1.05),
                              },
                            ]}
                            numberOfLines={Math.max(1, Math.floor(height / Math.max(fontSize, 10)))}
                          >
                            {block.translated}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </ReactNativeZoomableView>
            )}
          </View>

          {imagePreviewBlocks.length === 0 && (
            <View style={[styles.inlineNotice, { backgroundColor: colors.warningSoft }]}>
              <Ionicons name="scan-outline" size={18} color={colors.warning} />
              <Text style={[styles.inlineNoticeText, { color: colors.warning }]}>
                {t.mNoTextFound ?? 'No text found in this image.'}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <Text style={[styles.resultText, { color: colors.textPrimary }]} selectable>
          {translatedText}
        </Text>
      )}

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
  const [imagePhase, setImagePhase] = useState<ImageTranslatePhase>('idle');
  const [imageError, setImageError] = useState('');
  const [imagePreviewUri, setImagePreviewUri] = useState<string | null>(null);
  const [imagePreviewBlocks, setImagePreviewBlocks] = useState<TranslatedBlock[]>([]);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [resultMode, setResultMode] = useState<ResultMode>('text');
  const [isPreviewTouchActive, setIsPreviewTouchActive] = useState(false);
  const [imageTranslatedCount, setImageTranslatedCount] = useState(0);
  const [imageTotalCount, setImageTotalCount] = useState(0);

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

  const outerScrollRef = useRef<ScrollView>(null);
  const cabinLangCodeRef = useRef<string | undefined>(undefined);
  const startCabinSessionRef = useRef<(() => Promise<void>) | null>(null);

  const swapAngle = useRef(0);
  const swapAnim  = useRef(new Animated.Value(0)).current;

  const { translate, isReady } = useLlama();
  const whisper = useWhisper();

  const [isCabinMode, setIsCabinMode] = useState(false);
  const cabinPulseAnim  = useRef(new Animated.Value(1)).current;
  const isCabinModeRef  = useRef(false);

  // Cabin mode is pure speech-to-text now: Whisper transcribes into the input box and the
  // user presses "Stop & Translate". This ref holds the running transcript across the 30s
  // session auto-restarts so the input doesn't blank out between sessions.
  const cabinTranscriptRef = useRef('');

  // Keep refs in sync so callbacks don't go stale
  const sourceLangRef = useRef(sourceLang);
  const targetLangRef = useRef(targetLang);
  useEffect(() => { sourceLangRef.current = sourceLang; }, [sourceLang]);
  useEffect(() => { targetLangRef.current = targetLang; }, [targetLang]);
  useEffect(() => { isCabinModeRef.current = isCabinMode; }, [isCabinMode]);

  useEffect(() => { trackScreen('translator'); }, []);

  // Pulse glow animation on the mic button while listening
  useEffect(() => {
    if (!isCabinMode) { cabinPulseAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cabinPulseAnim, { toValue: 1.22, duration: 750, useNativeDriver: true }),
        Animated.timing(cabinPulseAnim, { toValue: 1.00, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isCabinMode, cabinPulseAnim]);

  // Reset the running transcript so the next cabin session starts clean.
  const resetCabinState = useCallback(() => {
    cabinTranscriptRef.current = '';
  }, []);

  const stopCabinMode = useCallback(async () => {
    // Flip the ref synchronously (not via the isCabinMode effect, which runs a render later)
    // so the session's onDone auto-restart guard sees we're stopping and doesn't spin up a
    // new whisper session into a tearing-down audio session — that races into the iOS
    // "failed to set active" (560030580) error.
    isCabinModeRef.current = false;
    setIsCabinMode(false);
    await whisper.stopListening();
  }, [whisper]);

  const clearImagePreview = useCallback(() => {
    setImagePhase('idle');
    setImageError('');
    setImagePreviewUri(null);
    setImagePreviewBlocks([]);
    setImageAspectRatio(null);
    setResultMode('text');
    setIsPreviewTouchActive(false);
    setImageTranslatedCount(0);
    setImageTotalCount(0);
  }, []);

  // One whisper session (~30s). Restarts automatically while cabin mode is still on.
  // Pure speech-to-text: partials/finals just stream into the input box — no translation.
  const startCabinSession = useCallback(async () => {
    try {
      await whisper.startListening(
        cabinLangCodeRef.current,
        (partial) => {
          const clean = stripWhisperNoise(partial);
          // Skip empty partials — they'd blank out what the user already dictated.
          if (!clean) return;
          // Append to the committed transcript from prior sessions so the input keeps the
          // full text across the 30s session restarts.
          const base = cabinTranscriptRef.current;
          setSourceText(base ? `${base} ${clean}` : clean);
        },
        (final) => {
          const clean = stripWhisperNoise(final).trim();
          // Commit this session's final transcript to the running base.
          if (clean) {
            cabinTranscriptRef.current = cabinTranscriptRef.current
              ? `${cabinTranscriptRef.current} ${clean}`
              : clean;
            setSourceText(cabinTranscriptRef.current);
          }
          // Auto-restart while cabin mode is still on (covers utterances longer than one session).
          if (isCabinModeRef.current) {
            void startCabinSessionRef.current?.();
          } else {
            setIsCabinMode(false);
          }
        },
      );
    } catch (err) {
      isCabinModeRef.current = false;
      setIsCabinMode(false);
      Alert.alert(t.mVoiceErrorTitle ?? 'Voice Error', err instanceof Error ? err.message : (t.mVoiceErrorDesc ?? 'Couldn’t start voice input.'));
    }
  }, [whisper, setSourceText, t]);

  useEffect(() => { startCabinSessionRef.current = startCabinSession; }, [startCabinSession]);

  const handleCabinToggle = useCallback(async () => {
    if (isCabinMode) { await stopCabinMode(); return; }

    if (!whisper.isReady) {
      Alert.alert(
        t.mVoiceNotReadyTitle ?? 'Voice model not ready',
        t.mVoiceNotReadyDesc ?? 'Download the speech-to-text model in Settings to use voice input.',
        [
          { text: t.aCancel, style: 'cancel' },
          { text: t.aDownload, onPress: () => router.push('/settings') },
        ]
      );
      return;
    }

    const hasMicPermission = await ensureMicrophonePermission();
    if (!hasMicPermission) {
      Alert.alert(
        t.mVoiceErrorTitle ?? 'Voice Error',
        'Microphone permission is required to use voice input.',
      );
      return;
    }

    Keyboard.dismiss();
    clearImagePreview();

    // Fresh transcript: cabin mode dictates straight into the input.
    resetCabinState();
    setSourceText('');
    setTranslatedText('');
    isCabinModeRef.current = true;
    setIsCabinMode(true);

    cabinLangCodeRef.current = sourceLang === 'auto' ? undefined : sourceLang;
    await startCabinSession();
  }, [isCabinMode, whisper, sourceLang, clearImagePreview, stopCabinMode, startCabinSession, resetCabinState, setSourceText, setTranslatedText, t, router]);

  const runTranslate = useCallback(async (text: string, mode: 'text' | 'voice' = 'text') => {
    if (!text.trim()) return;
    if (!isReady) {
      router.push('/settings?focus=download');
      return;
    }
    Keyboard.dismiss();
    try {
      clearImagePreview();
      setIsTranslating(true);
      setTranslatedText('');
      const result = await translate(text, sourceLangRef.current, targetLangRef.current);
      setTranslatedText(result);
      addHistory({ sourceText: text, translatedText: result, sourceLang: sourceLangRef.current, targetLang: targetLangRef.current });
      track('translate', {
        mode,
        sourceLang: sourceLangRef.current,
        targetLang: targetLangRef.current,
        chars: text.length,
      });
      // Happy path: let the result land, then maybe ask for a review.
      setTimeout(() => { void maybeAskForReview(); }, 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Translation failed';
      Alert.alert('Translation Error', msg);
    } finally {
      setIsTranslating(false);
    }
    setResultMode('text');
  }, [isReady, translate, setIsTranslating, setTranslatedText, addHistory, router, clearImagePreview]);

  const handleTranslate = useCallback(() => {
    void runTranslate(sourceText);
  }, [runTranslate, sourceText]);

  // Cabin mode button: translate whatever has been dictated into the input right away, and
  // tear the mic down in the background. Awaiting the whisper capture-end before translating
  // added a visible delay (button flashed "Translate" before "Translating…"), so we don't
  // block on it — the input already holds the latest transcript.
  const handleStopAndTranslate = useCallback(() => {
    const text = useStore.getState().sourceText;
    void stopCabinMode();
    void runTranslate(text, 'voice');
  }, [stopCabinMode, runTranslate]);

  const handleCopy = useCallback(async () => {
    if (!translatedText) return;
    await Clipboard.setStringAsync(translatedText);
    track('copy_translation', { targetLang });
    Alert.alert(t.mCopied, '');
  }, [translatedText, targetLang, t.mCopied]);

  const handleClear = useCallback(() => {
    if (isCabinModeRef.current) void stopCabinMode();
    resetCabinState();
    clearImagePreview();
    setSourceText('');
    setTranslatedText('');
    setIsSpeaking(false);
    inputRef.current?.focus();
  }, [clearImagePreview, setSourceText, setTranslatedText, stopCabinMode, resetCabinState]);

  const handleSourceTextChange = useCallback((text: string) => {
    if (isCabinModeRef.current) void stopCabinMode();
    if (imagePreviewUri) clearImagePreview();
    setSourceText(text);
  }, [clearImagePreview, imagePreviewUri, setSourceText, stopCabinMode]);

  const processImageTranslation = useCallback(async (uri: string) => {
    if (!isReady) {
      router.push('/settings?focus=download');
      return;
    }

    Keyboard.dismiss();
    setIsSpeaking(false);
    setIsTranslating(false);
    setImageError('');
    setImagePreviewUri(uri);
    setImagePreviewBlocks([]);
    setImageTranslatedCount(0);
    setImageTotalCount(0);
    setResultMode('image');
    setTranslatedText('');

    Image.getSize(
      uri,
      (width, height) => setImageAspectRatio(width > 0 && height > 0 ? width / height : 1),
      () => setImageAspectRatio(1)
    );

    try {
      setImagePhase('ocr');
      const rawBlocks = await recognizeTextBlocksFromImage(uri, sourceLang);

      if (rawBlocks.length === 0) {
        setSourceText('');
        setTranslatedText('');
        setImagePreviewBlocks([]);
        setImageTranslatedCount(0);
        setImageTotalCount(0);
        setImagePhase('done');
        return;
      }

      const combinedSource = rawBlocks.map((block) => block.text).join('\n');
      const pendingBlocks = rawBlocks.map((block) => ({
        ...block,
        translated: '',
        isPending: true,
      }));
      const batches = splitBlocksForTranslation(rawBlocks);

      setSourceText(combinedSource);
      setImagePreviewBlocks(pendingBlocks);
      setImageTotalCount(rawBlocks.length);
      setImagePhase('translating');

      let translatedCount = 0;
      const translatedBlocks = [...pendingBlocks];

      for (const batch of batches) {
        const translations = await translateBlockBatch(batch.blocks, targetLang, translate);

        for (let i = 0; i < batch.indexes.length; i += 1) {
          const blockIndex = batch.indexes[i];
          translatedBlocks[blockIndex] = {
            ...translatedBlocks[blockIndex],
            translated: translations[i],
            isPending: false,
          };
          translatedCount += 1;
        }

        const partialTranslated = translatedBlocks
          .map((block) => block.translated || '...')
          .join('\n');

        setImagePreviewBlocks([...translatedBlocks]);
        setImageTranslatedCount(translatedCount);
        setTranslatedText(partialTranslated);
      }

      const combinedTranslated = translatedBlocks.map((block) => block.translated).join('\n');
      setTranslatedText(combinedTranslated);
      addHistory({
        sourceText: combinedSource,
        translatedText: combinedTranslated,
        sourceLang: 'auto',
        targetLang,
      });
      setImagePhase('done');
      track('translate', { mode: 'image', targetLang, blocks: rawBlocks.length });
      // Happy path: a full image was just translated — let it land, then maybe ask for a review.
      setTimeout(() => { void maybeAskForReview(); }, 800);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Image translation failed');
      setImagePhase('error');
    }
  }, [addHistory, isReady, router, setIsTranslating, setSourceText, setTranslatedText, sourceLang, targetLang, translate]);


  const handlePickPhoto = useCallback(async () => {
    try {
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
      await processImageTranslation(result.assets[0].uri);
    } catch (err) {
      Alert.alert(
        t.sErrorTitle ?? 'Something went wrong',
        err instanceof Error ? err.message : 'Could not open the photo library.'
      );
    }
  }, [processImageTranslation, t.mPhotoPermissionDesc, t.mPhotoPermissionTitle, t.sErrorTitle]);

  const handleTakePhoto = useCallback(async () => {
    try {
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
      await processImageTranslation(result.assets[0].uri);
    } catch (err) {
      Alert.alert(
        t.sErrorTitle ?? 'Something went wrong',
        err instanceof Error ? err.message : 'Could not open the camera.'
      );
    }
  }, [processImageTranslation, t.mCameraPermissionDesc, t.mCameraPermissionTitle, t.sErrorTitle]);

  const handlePickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'text/*',
        'application/json',
        'text/csv',
        'application/xml',
        'text/xml',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    if (!isSupportedTextImportFile(asset.name, asset.mimeType)) {
      Alert.alert(
        t.mFileUnsupportedTitle ?? 'Unsupported file',
        t.mFileUnsupportedDesc ?? 'Please choose TXT, MD, CSV, JSON, XML, DOCX, or a text-based PDF.'
      );
      return;
    }

    try {
      const { text: normalized, warning } = await extractTextFromFile(asset.uri, asset.name ?? 'imported-file');

      if (!normalized || warning === 'pdf') {
        Alert.alert(
          t.mFileEmptyTitle ?? 'Empty file',
          warning === 'pdf'
            ? 'Could not extract text from this PDF. It may be a scanned PDF; try choosing an image page instead.'
            : t.mFileEmptyDesc ?? 'This file has no readable text to translate.'
        );
        return;
      }

      clearImagePreview();
      setIsSpeaking(false);
      setSourceText(normalized);
      setTranslatedText('');
      inputRef.current?.focus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not read this file.';
      Alert.alert(
        t.mFileReadErrorTitle ?? 'Could not open file',
        message
      );
    }
  }, [clearImagePreview, setSourceText, setTranslatedText, t.mFileEmptyDesc, t.mFileEmptyTitle, t.mFileReadErrorTitle, t.mFileUnsupportedDesc, t.mFileUnsupportedTitle]);

  const handleImageOptions = useCallback(() => {
    const options = [
      t.mPhotoLibrary ?? 'Photo',
      t.mTakePhoto ?? 'Camera',
      t.mChooseFile ?? 'File',
      t.aCancel,
    ];

    if (Platform.OS !== 'ios') {
      Alert.alert(
        t.mImageOptionsTitle ?? 'Choose input',
        undefined,
        [
          { text: options[0], onPress: () => void handlePickPhoto() },
          { text: options[1], onPress: () => void handleTakePhoto() },
          { text: options[2], onPress: () => void handlePickFile() },
          { text: options[3], style: 'cancel' },
        ],
      );
      return;
    }

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: 3,
      },
      (buttonIndex) => {
        if (buttonIndex === 0) {
          void handlePickPhoto();
        } else if (buttonIndex === 1) {
          void handleTakePhoto();
        } else if (buttonIndex === 2) {
          void handlePickFile();
        }
      }
    );
  }, [handlePickFile, handlePickPhoto, handleTakePhoto, t.aCancel, t.mChooseFile, t.mPhotoLibrary, t.mTakePhoto]);

  const speakText = useCallback(async (textToSpeak: string, langCode: string) => {
    const lang = getLanguageByCode(langCode);
    if (!lang?.ttsLocale || !textToSpeak.trim()) return;
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    // Cabin mode (and any prior Whisper session) leaves the iOS audio session in the
    // PlayAndRecord category, which routes TTS to the quiet earpiece at record-level gain.
    // Force it back to Playback so speech comes out the main speaker at full media volume.
    if (Platform.OS === 'ios') {
      try {
        await AudioSessionIos.setCategory(AudioSessionIos.Category.Playback, []);
        await AudioSessionIos.setActive(true);
      } catch { /* best-effort — fall through and speak anyway */ }
    }
    setIsSpeaking(true);
    track('tts_speak', { lang: langCode });
    Speech.speak(textToSpeak, {
      language: lang.ttsLocale,
      rate: 0.9,
      onDone:    () => setIsSpeaking(false),
      onError:   () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
    });
  }, [isSpeaking]);

  const handleSpeak = useCallback(() => {
    void speakText(translatedText, targetLang);
  }, [speakText, translatedText, targetLang]);

  const handleSwap = useCallback(() => {
    setIsSpeaking(false);
    // While cabin mode is recording, keep the dictated transcript in the input and just
    // swap the languages — swapLanguages() would move the (empty) translatedText into the
    // input and wipe the transcript.
    if (isCabinModeRef.current) {
      setSourceLang(targetLang);
      setTargetLang(sourceLang);
    } else {
      swapLanguages();
    }
    swapAngle.current += 360;
    Animated.spring(swapAnim, {
      toValue: swapAngle.current,
      useNativeDriver: true,
      speed: 12,
      bounciness: 4,
    }).start();
  }, [swapLanguages, swapAnim, sourceLang, targetLang, setSourceLang, setTargetLang]);

  const charNearLimit = sourceText.length > 9000;
  const isImageProcessing = imagePhase === 'ocr' || imagePhase === 'translating';
  const shouldShowResult = translatedText !== '' || isTranslating || imagePhase !== 'idle';
  const shouldLockPageScroll = isPreviewTouchActive && resultMode === 'image' && !!imagePreviewUri && !isImageProcessing;

  if (!onboardingComplete) return <Redirect href="/onboarding" />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={outerScrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          scrollEnabled={!shouldLockPageScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Nav ──────────────────────────────────────────────────────── */}
          <View style={styles.navRow}>
            <View>
              <View style={styles.navTitleRow}>
                <Text style={[styles.appTitle, { color: C.textPrimary }]}>Nomad</Text>
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
              onChangeText={handleSourceTextChange}
              multiline
              maxLength={10000}
              textAlignVertical="top"
            />
            <View style={[styles.inputFooter, { borderTopColor: C.border }]}>
              {charNearLimit ? (
                <Text style={[styles.charCount, { color: C.warning, fontWeight: '600' }]}>
                  {sourceText.length}/10000
                </Text>
              ) : isCabinMode ? (
                <View style={styles.listeningBadge}>
                  <View style={[styles.listeningDot, { backgroundColor: C.primary }]} />
                  <Text style={[styles.listeningText, { color: C.primary }]}>{t.mListening ?? 'Listening…'}</Text>
                </View>
              ) : (
                <View />
              )}
              <View style={styles.inputActions}>
                <TouchableOpacity
                  onPress={handleImageOptions}
                  hitSlop={{ top: DS.space.sm, bottom: DS.space.sm, left: DS.space.sm, right: DS.space.sm }}
                >
                  <Ionicons name="image-outline" size={20} color={C.primary} />
                </TouchableOpacity>

                {/* Cabin translation mic */}
                <TouchableOpacity
                  onPress={() => void handleCabinToggle()}
                  hitSlop={{ top: DS.space.sm, bottom: DS.space.sm, left: DS.space.sm, right: DS.space.sm }}
                >
                  <Animated.View style={[
                    styles.cabinMicBtn,
                    isCabinMode
                      ? { backgroundColor: C.primary, ...DS.shadow.level2(isDark) }
                      : { backgroundColor: 'transparent' },
                    { transform: [{ scale: cabinPulseAnim }] },
                  ]}>
                    <Ionicons
                      name={isCabinMode ? 'mic' : 'mic-outline'}
                      size={20}
                      color={isCabinMode ? C.background : C.primary}
                    />
                  </Animated.View>
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
          {/* In cabin mode the button becomes "Stop & Translate": stop listening + translate. */}
          <TranslateButton
            onPress={isCabinMode ? () => void handleStopAndTranslate() : handleTranslate}
            disabled={isCabinMode ? false : (!sourceText.trim() || isTranslating)}
            isTranslating={isTranslating}
            isCabinMode={isCabinMode}
            colors={C}
            isDark={isDark}
          />

          {/* ── Result / Loading ──────────────────────────────────────────── */}
          {!isCabinMode && shouldShowResult && (
            <View>
              {(isTranslating && translatedText === '') || (imagePhase === 'ocr') ? (
                <View style={[styles.loadingCard, { backgroundColor: C.surface, borderColor: C.border }, DS.shadow.level2(isDark)]}>
                  <ActivityIndicator size="large" color={C.primary} />
                  <Text style={[styles.loadingTitle, { color: C.textPrimary }]}>
                    {imagePhase === 'ocr' || isImageProcessing
                      ? (imagePhase === 'ocr' ? (t.mReadingText ?? 'Reading text from image…') : t.mTranslating)
                      : t.mTranslating}
                  </Text>
                  <Text style={[styles.loadingSub, { color: C.textMuted }]}>{t.mLoadingSub}</Text>
                </View>
              ) : imagePhase === 'error' ? (
                <View style={[styles.loadingCard, { backgroundColor: C.surface, borderColor: C.danger + '35' }, DS.shadow.level2(isDark)]}>
                  <Ionicons name="alert-circle-outline" size={42} color={C.danger} />
                  <Text style={[styles.loadingTitle, { color: C.textPrimary }]}>Image translation failed</Text>
                  <Text style={[styles.loadingSub, { color: C.textMuted, textAlign: 'center' }]}>{imageError}</Text>
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
                  imagePreviewUri={imagePreviewUri}
                  imagePreviewBlocks={imagePreviewBlocks}
                  imageAspectRatio={imageAspectRatio}
                  resultMode={resultMode}
                  imagePhase={imagePhase}
                  imageTranslatedCount={imageTranslatedCount}
                  imageTotalCount={imageTotalCount}
                  onPreviewTouchStart={() => setIsPreviewTouchActive(true)}
                  onPreviewTouchEnd={() => setIsPreviewTouchActive(false)}
                  onToggleResultMode={imagePreviewUri ? () => {
                    setResultMode((current) => current === 'image' ? 'text' : 'image');
                  } : undefined}
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

  cabinMicBtn: {
    width: 30,
    height: 30,
    borderRadius: DS.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listeningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs,
  },
  listeningDot: {
    width: 6,
    height: 6,
    borderRadius: DS.radius.full,
  },
  listeningText: {
    ...DS.type.caption1,
    fontWeight: '600' as const,
  },

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
  translateBtnPulseDot: {
    width: 10,
    height: 10,
    borderRadius: DS.radius.full,
  },

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
  modeSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs,
    paddingHorizontal: DS.space.sm,
    paddingVertical: DS.space.xs + 1,
    borderRadius: DS.radius.full,
    borderWidth: 1,
  },
  modeSwitchText: { ...DS.type.caption1, fontWeight: '700' },
  resultText: {
    ...DS.type.title3,
    fontWeight: '500',
    padding: DS.space.md,
    paddingTop: DS.space.sm + DS.space.xs,
  },
  imageResultBody: {
    padding: DS.space.md,
    gap: DS.space.sm,
  },
  imageProgressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.sm + DS.space.xs,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.md,
    borderWidth: 1,
  },
  imageProgressText: { ...DS.type.footnote, fontWeight: '700' },
  imagePreviewFrame: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: DS.radius.lg,
    position: 'relative',
  },
  zoomablePreview: {
    flex: 1,
  },
  overlayBlock: {
    position: 'absolute',
    borderRadius: 4,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 3,
    paddingVertical: 2,
    zIndex: 2,
  },
  overlayLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  overlayText: {
    width: '100%',
    color: '#0F172A',
    fontWeight: '700',
    textAlign: 'left',
    includeFontPadding: false,
  },
  inlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    paddingHorizontal: DS.space.sm + DS.space.xs,
    paddingVertical: DS.space.sm,
    borderRadius: DS.radius.md,
  },
  inlineNoticeText: { ...DS.type.footnote, fontWeight: '600', flex: 1 },
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
