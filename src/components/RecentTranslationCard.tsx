import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { AppColors } from '@/constants/theme';
import { getLanguageByCode } from '@/constants/languages';

interface Props {
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  onPress: () => void;
  colors: AppColors;
}

export function RecentTranslationCard({
  sourceText,
  translatedText,
  sourceLang,
  targetLang,
  onPress,
  colors,
}: Props) {
  const src = getLanguageByCode(sourceLang);
  const tgt = getLanguageByCode(targetLang);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {/* Language route */}
      <View style={styles.langRow}>
        <Text style={styles.flag}>{src?.flag ?? '🌐'}</Text>
        <Text style={[styles.arrow, { color: colors.textMuted }]}>→</Text>
        <Text style={styles.flag}>{tgt?.flag ?? '🌐'}</Text>
      </View>

      {/* Source */}
      <Text style={[styles.sourceText, { color: colors.text }]} numberOfLines={2}>
        {sourceText}
      </Text>

      {/* Translation */}
      <Text style={[styles.translatedText, { color: colors.textMuted }]} numberOfLines={1}>
        {translatedText}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 160,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  flag: {
    fontSize: 14,
  },
  arrow: {
    fontSize: 11,
    fontWeight: '600',
  },
  sourceText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  translatedText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
