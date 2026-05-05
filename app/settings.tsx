import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useStore } from '@/store/useStore';
import { useLlama } from '@/hooks/useLlama';
import { isModelDownloaded, getModelFileSizeMB, deleteModel } from '@/utils/modelManager';
import { MODEL_SIZE_MB, MODEL_DOWNLOAD_URL } from '@/constants/model';
import { COLORS } from '@/constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { modelStatus, downloadProgress, modelError, clearHistory } = useStore();
  const { downloadAndLoad, cancelDownload, releaseModel } = useLlama();

  const [savedSizeMB, setSavedSizeMB] = useState<number | null>(null);

  useEffect(() => {
    getModelFileSizeMB().then(setSavedSizeMB);
  }, [modelStatus]);

  const handleDownload = () => {
    Alert.alert(
      'Download AI Model',
      `This will download the Hy-MT1.5-1.8B model (~${MODEL_SIZE_MB} MB). Make sure you are on Wi-Fi.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: downloadAndLoad },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Model',
      'This will remove the AI model from your device. You will need to re-download it to use translation.',
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
  };

  const handleClearHistory = () => {
    Alert.alert('Clear History', 'Delete all translation history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearHistory },
    ]);
  };

  const isDownloading = modelStatus === 'downloading';
  const isLoading = modelStatus === 'loading';
  const isReady = modelStatus === 'ready';
  const hasError = modelStatus === 'error';
  const notDownloaded = modelStatus === 'not_downloaded';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Model info card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Model</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Model</Text>
              <Text style={styles.rowValue}>Qwen3-1.7B</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Quantization</Text>
              <Text style={styles.rowValue}>Q4_K_M (standard)</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Size</Text>
              <Text style={styles.rowValue}>~{MODEL_SIZE_MB} MB</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Languages</Text>
              <Text style={styles.rowValue}>100+ languages</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Status</Text>
              <Text style={[
                styles.rowValue,
                isReady && { color: COLORS.success },
                hasError && { color: COLORS.error },
                (isDownloading || isLoading) && { color: COLORS.primary },
              ]}>
                {isReady ? 'Ready ✓'
                  : isDownloading ? `Downloading ${Math.round(downloadProgress * 100)}%`
                  : isLoading ? 'Loading...'
                  : hasError ? 'Error'
                  : 'Not downloaded'}
              </Text>
            </View>
            {savedSizeMB !== null && (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Saved size</Text>
                  <Text style={styles.rowValue}>{savedSizeMB} MB</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Download progress */}
        {isDownloading && (
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${downloadProgress * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {Math.round(downloadProgress * MODEL_SIZE_MB)} / {MODEL_SIZE_MB} MB
            </Text>
          </View>
        )}

        {/* Error detail */}
        {hasError && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Error loading model</Text>
            {modelError ? (
              <Text style={styles.errorText}>{modelError}</Text>
            ) : null}
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionGroup}>
            {(notDownloaded || hasError) && (
              <TouchableOpacity style={styles.primaryBtn} onPress={handleDownload}>
                <Text style={styles.primaryBtnText}>Download Model (~{MODEL_SIZE_MB} MB)</Text>
              </TouchableOpacity>
            )}

            {isDownloading && (
              <TouchableOpacity style={styles.dangerBtn} onPress={cancelDownload}>
                <Text style={styles.dangerBtnText}>Cancel Download</Text>
              </TouchableOpacity>
            )}

            {(isReady || savedSizeMB !== null) && !isDownloading && !isLoading && (
              <TouchableOpacity style={styles.dangerBtn} onPress={handleDelete}>
                <Text style={styles.dangerBtnText}>Delete Model</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          <View style={styles.actionGroup}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleClearHistory}>
              <Text style={styles.secondaryBtnText}>Clear Translation History</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <Text style={styles.aboutText}>
              Travel Translator uses the{' '}
              <Text style={styles.link}>Hy-MT1.5-1.8B</Text>{' '}
              model by Tencent's Hunyuan team, compressed to 462MB using Sherry 1.25-bit
              quantization (ACL 2026).{'\n\n'}
              All translation happens on-device. No data is ever sent to any server.{'\n\n'}
              Supports 33 languages and 1,056 translation directions, outperforming
              commercial APIs like Microsoft Translator on Chinese-Foreign benchmarks.
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: { flex: 1 },
  content: {
    padding: 16,
    gap: 20,
    paddingBottom: 40,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowLabel: {
    color: COLORS.text,
    fontSize: 15,
  },
  rowValue: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 16,
  },
  progressContainer: {
    gap: 6,
  },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  progressText: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'right',
  },
  errorCard: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  errorTitle: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
  },
  errorHint: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  actionGroup: {
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 13,
    padding: 15,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 13,
    padding: 15,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 15,
  },
  dangerBtn: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 13,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  dangerBtnText: {
    color: COLORS.error,
    fontWeight: '600',
    fontSize: 15,
  },
  aboutText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    padding: 16,
  },
  link: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
