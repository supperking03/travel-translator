import React, { useCallback, useRef, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { ReactNativeZoomableView } from '@openspacelabs/react-native-zoomable-view';

import { useStore } from '@/store/useStore';
import { useLlama } from '@/hooks/useLlama';
import { LanguageSelector } from '@/components/LanguageSelector';
import { DS, useDSColors, useDSIsDark, DSColors } from '@/constants/designSystem';
import { getLanguageByCode } from '@/constants/languages';
import { useI18n } from '@/i18n/useI18n';
import { recognizeTextBlocksFromImage, TextBlock } from '@/utils/imageTextRecognition';

type TranslatedBlock = TextBlock & { translated: string; isPending: boolean };
type ImageTranslatePhase = 'idle' | 'ocr' | 'translating' | 'done' | 'error';
type ResultMode = 'text' | 'image';
const OCR_TRANSLATION_BATCH_CHAR_LIMIT = 900;
const OCR_TRANSLATION_BATCH_ITEM_LIMIT = 12;
const SUPPORTED_TEXT_FILE_EXTENSIONS = new Set([
  'txt', 'md', 'csv', 'json', 'xml', 'html', 'htm', 'log', 'yaml', 'yml',
]);

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

function isReadableTextFile(asset: DocumentPicker.DocumentPickerAsset): boolean {
  const mimeType = asset.mimeType?.toLowerCase() ?? '';
  if (mimeType.startsWith('text/')) return true;
  if (mimeType.includes('json') || mimeType.includes('xml')) return true;

  const fileName = asset.name?.toLowerCase() ?? '';
  const ext = fileName.includes('.') ? fileName.split('.').pop() ?? '' : '';
  return SUPPORTED_TEXT_FILE_EXTENSIONS.has(ext);
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

  const swapAngle = useRef(0);
  const swapAnim  = useRef(new Animated.Value(0)).current;

  const { translate, isReady } = useLlama();

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

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) return;
    if (!isReady) {
      router.push('/settings?focus=download');
      return;
    }
    Keyboard.dismiss();
    try {
      clearImagePreview();
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
    setResultMode('text');
  }, [sourceText, sourceLang, targetLang, isReady, translate, setIsTranslating, setTranslatedText, addHistory, router, clearImagePreview]);

  const handleCopy = useCallback(async () => {
    if (!translatedText) return;
    await Clipboard.setStringAsync(translatedText);
    Alert.alert(t.mCopied, '');
  }, [translatedText, t.mCopied]);

  const handleClear = useCallback(() => {
    clearImagePreview();
    setSourceText('');
    setTranslatedText('');
    setIsSpeaking(false);
    inputRef.current?.focus();
  }, [clearImagePreview, setSourceText, setTranslatedText]);

  const handleSourceTextChange = useCallback((text: string) => {
    if (imagePreviewUri) {
      clearImagePreview();
    }
    setSourceText(text);
  }, [clearImagePreview, imagePreviewUri, setSourceText]);

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
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Image translation failed');
      setImagePhase('error');
    }
  }, [addHistory, isReady, router, setIsTranslating, setSourceText, setTranslatedText, sourceLang, targetLang, translate]);


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
    await processImageTranslation(result.assets[0].uri);
  }, [processImageTranslation, t.mPhotoPermissionDesc, t.mPhotoPermissionTitle]);

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
    await processImageTranslation(result.assets[0].uri);
  }, [processImageTranslation, t.mCameraPermissionDesc, t.mCameraPermissionTitle]);

  const handlePickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/*', 'application/json', 'text/csv', 'application/xml', 'text/xml'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    if (!isReadableTextFile(asset)) {
      Alert.alert(
        t.mFileUnsupportedTitle ?? 'Unsupported file',
        t.mFileUnsupportedDesc ?? 'Please choose a text-based file like TXT, MD, CSV, JSON, or XML.'
      );
      return;
    }

    try {
      const content = await FileSystem.readAsStringAsync(asset.uri);
      const normalized = content.replace(/\r\n/g, '\n').trim();

      if (!normalized) {
        Alert.alert(
          t.mFileEmptyTitle ?? 'Empty file',
          t.mFileEmptyDesc ?? 'This file has no readable text to translate.'
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
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [
          t.mPhotoLibrary ?? 'Photo',
          t.mTakePhoto ?? 'Camera',
          t.mChooseFile ?? 'File',
          t.aCancel,
        ],
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
          {shouldShowResult && (
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
