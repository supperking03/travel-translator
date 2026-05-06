import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  StyleSheet,
  Platform,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LANGUAGES, Language, getLanguageByCode } from '@/constants/languages';
import { useTheme } from '@/constants/theme';

interface Props {
  selectedCode: string;
  onSelect: (code: string) => void;
  label?: string;
}

export function LanguageSelector({ selectedCode, onSelect, label }: Props) {
  const colors = useTheme();
  const scheme = useColorScheme();
  const isDark  = scheme !== 'light';
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const selected = getLanguageByCode(selectedCode);
  const filtered = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.nativeName.toLowerCase().includes(search.toLowerCase()) ||
      l.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (lang: Language) => {
    onSelect(lang.code);
    setVisible(false);
    setSearch('');
  };

  const pillShadow = isDark ? {} : {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  };

  return (
    <>
      {/* ── Selector pill ──────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }, pillShadow]}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        {label && (
          <Text style={[styles.pillLabel, { color: colors.primary }]}>{label}</Text>
        )}
        <Text style={styles.pillFlag}>{selected?.flag ?? '🌐'}</Text>
        <Text style={[styles.pillName, { color: colors.text }]} numberOfLines={1}>
          {selected?.name ?? 'Select'}
        </Text>
        <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
      </TouchableOpacity>

      {/* ── Bottom-sheet modal ─────────────────────────────────────────── */}
      <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>

            {/* Handle */}
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />

            {/* Header */}
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Select Language</Text>
              <TouchableOpacity
                onPress={() => { setVisible(false); setSearch(''); }}
                style={[styles.closeBtn, { backgroundColor: colors.surface }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={17} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search language…"
                placeholderTextColor={colors.textMuted}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Empty state */}
            {filtered.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🌐</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No results</Text>
                <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                  Try a different name or language code
                </Text>
              </View>
            )}

            {/* List */}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = item.code === selectedCode;
                return (
                  <TouchableOpacity
                    style={[
                      styles.langRow,
                      { borderBottomColor: colors.border },
                      isSelected && { backgroundColor: colors.primaryDim },
                    ]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.65}
                  >
                    <Text style={styles.itemFlag}>{item.flag}</Text>
                    <View style={styles.itemTextBlock}>
                      <Text style={[
                        styles.itemName,
                        { color: colors.text },
                        isSelected && { color: colors.primary, fontWeight: '700' },
                      ]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.itemNative, { color: colors.textMuted }]}>{item.nativeName}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  pillLabel: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pillFlag: { fontSize: 20 },
  pillName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },

  // Modal
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '84%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 6,
  },
  emptyEmoji: { fontSize: 36, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySub:   { fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },

  // List
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemFlag:      { fontSize: 26, width: 36, textAlign: 'center' },
  itemTextBlock: { flex: 1 },
  itemName:      { fontSize: 15, fontWeight: '500' },
  itemNative:    { fontSize: 12, marginTop: 2 },
});
