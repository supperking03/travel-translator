import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import { useStore } from '@/store/useStore';
import { useLlama } from '@/hooks/useLlama';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ModelStatusBadge } from '@/components/ModelStatus';
import { COLORS } from '@/constants/theme';
import { getLanguageByCode } from '@/constants/languages';

export default function TranslatorScreen() {
  const inputRef = useRef<TextInput>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const {
    sourceLang,
    targetLang,
    sourceText,
    translatedText,
    isTranslating,
    modelStatus,
    downloadProgress,
    modelError,
    setSourceLang,
    setTargetLang,
    setSourceText,
    setTranslatedText,
    setIsTranslating,
    swapLanguages,
    addHistory,
  } = useStore();

  const { translate, isReady } = useLlama();

  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim()) return;

    if (!isReady) {
      Alert.alert(
        'Model Not Ready',
        'Please download the AI model first. Tap the status badge at the top to go to settings.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (sourceLang === targetLang) {
      Alert.alert('Same Language', 'Please select different source and target languages.');
      return;
    }

    try {
      setIsTranslating(true);
      setTranslatedText('');
      const result = await translate(sourceText, sourceLang, targetLang);
      setTranslatedText(result);
      addHistory({
        sourceText,
        translatedText: result,
        sourceLang,
        targetLang,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Translation failed';
      Alert.alert('Translation Error', msg);
    } finally {
      setIsTranslating(false);
    }
  }, [sourceText, sourceLang, targetLang, isReady, translate, setIsTranslating, setTranslatedText, addHistory]);

  const handleCopy = useCallback(async () => {
    if (!translatedText) return;
    await Clipboard.setStringAsync(translatedText);
    Alert.alert('Copied', 'Translation copied to clipboard');
  }, [translatedText]);

  const handleClear = useCallback(() => {
    Speech.stop();
    setIsSpeaking(false);
    setSourceText('');
    setTranslatedText('');
    inputRef.current?.focus();
  }, [setSourceText, setTranslatedText]);

  // Stop speech when translation changes
  useEffect(() => {
    Speech.stop();
    setIsSpeaking(false);
  }, [translatedText]);

  const handleSpeak = useCallback(async () => {
    if (isSpeaking) {
      await Speech.stop();
      setIsSpeaking(false);
      return;
    }

    const lang = getLanguageByCode(targetLang);
    if (!lang?.ttsLocale) return;

    setIsSpeaking(true);
    Speech.speak(translatedText, {
      language: lang.ttsLocale,
      rate: 0.9,
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
    });
  }, [isSpeaking, translatedText, targetLang]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Status bar */}
          <View style={styles.statusRow}>
            <ModelStatusBadge
              status={modelStatus}
              downloadProgress={downloadProgress}
              error={modelError}
            />
            {sourceText.length > 0 && (
              <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Language row */}
          <View style={styles.langRow}>
            <LanguageSelector
              selectedCode={sourceLang}
              onSelect={setSourceLang}
              label="FROM"
            />
            <TouchableOpacity style={styles.swapBtn} onPress={swapLanguages}>
              <Text style={styles.swapIcon}>⇄</Text>
            </TouchableOpacity>
            <LanguageSelector
              selectedCode={targetLang}
              onSelect={setTargetLang}
              label="TO"
            />
          </View>

          {/* Source input */}
          <View style={styles.card}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="Enter text to translate..."
              placeholderTextColor={COLORS.textMuted}
              value={sourceText}
              onChangeText={setSourceText}
              multiline
              maxLength={1000}
              textAlignVertical="top"
              returnKeyType="default"
            />
            <View style={styles.inputFooter}>
              <Text style={styles.charCount}>{sourceText.length}/1000</Text>
            </View>
          </View>

          {/* Translate button */}
          <TouchableOpacity
            style={[
              styles.translateBtn,
              (!sourceText.trim() || isTranslating) && styles.translateBtnDisabled,
            ]}
            onPress={handleTranslate}
            disabled={!sourceText.trim() || isTranslating}
            activeOpacity={0.8}
          >
            {isTranslating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.translateBtnText}>
                {isReady ? '↓  Translate' : '↓  Translate (download model first)'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Translation output */}
          {(translatedText || isTranslating) && (
            <View style={styles.card}>
              {isTranslating && !translatedText ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={COLORS.primary} size="small" />
                  <Text style={styles.loadingText}>Translating...</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.translatedText} selectable>
                    {translatedText}
                  </Text>
                  <View style={styles.outputFooter}>
                    {getLanguageByCode(targetLang)?.ttsLocale && (
                      <TouchableOpacity
                        style={[styles.actionBtn, isSpeaking && styles.actionBtnActive]}
                        onPress={handleSpeak}
                      >
                        <Text style={[styles.actionBtnText, isSpeaking && styles.actionBtnTextActive]}>
                          {isSpeaking ? '■  Stop' : '▶  Speak'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.actionBtn} onPress={handleCopy}>
                      <Text style={styles.actionBtnText}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Empty state */}
          {!sourceText && !translatedText && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🌍</Text>
              <Text style={styles.emptyTitle}>Offline AI Translation</Text>
              <Text style={styles.emptySubtitle}>
                100+ languages · No internet needed{'\n'}Powered by Qwen3-1.7B
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearBtnText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swapBtn: {
    backgroundColor: COLORS.surface,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapIcon: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  textInput: {
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 26,
    padding: 16,
    minHeight: 120,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  charCount: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  translateBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  translateBtnDisabled: {
    opacity: 0.5,
  },
  translateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    minHeight: 60,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
  translatedText: {
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 26,
    padding: 16,
  },
  outputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionBtn: {
    backgroundColor: COLORS.primaryDim,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  actionBtnActive: {
    backgroundColor: COLORS.primary,
  },
  actionBtnText: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  actionBtnTextActive: {
    color: '#fff',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 52,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
