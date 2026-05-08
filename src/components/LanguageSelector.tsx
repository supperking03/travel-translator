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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LANGUAGES, Language, getLanguageByCode } from '@/constants/languages';
import { DS, useDSColors, useDSIsDark } from '@/constants/designSystem';

interface Props {
  selectedCode: string;
  onSelect: (code: string) => void;
  label?: string;
  subtle?: boolean;
}

export function LanguageSelector({ selectedCode, onSelect, label, subtle }: Props) {
  const C      = useDSColors();
  const isDark = useDSIsDark();
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const isIOS = Platform.OS === 'ios';

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

  const closeModal = () => {
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
        style={subtle
          ? styles.pillSubtle
          : [styles.pill, { backgroundColor: C.surface, borderColor: C.border }, pillShadow]}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        {!subtle && label && (
          <Text style={[styles.pillLabel, { color: C.primary }]}>{label}</Text>
        )}
        <Text style={subtle ? styles.pillFlagSubtle : styles.pillFlag}>{selected?.flag ?? '🌐'}</Text>
        <Text
          style={[subtle ? styles.pillNameSubtle : styles.pillName, { color: subtle ? C.textSecondary : C.textPrimary }]}
          numberOfLines={1}
        >
          {selected?.name ?? 'Select'}
        </Text>
        <Ionicons name="chevron-down" size={subtle ? 11 : 12} color={C.textMuted} />
      </TouchableOpacity>

      {/* ── Bottom-sheet modal ─────────────────────────────────────────── */}
      <Modal
        visible={visible}
        animationType="slide"
        transparent={!isIOS}
        statusBarTranslucent={!isIOS}
        presentationStyle={isIOS ? 'pageSheet' : undefined}
        allowSwipeDismissal={isIOS}
        onRequestClose={closeModal}
      >
        <View style={[isIOS ? styles.iosScreen : styles.overlay, { backgroundColor: isIOS ? C.background : C.overlay }]}>
          <View style={[isIOS ? styles.iosSheet : styles.sheet, { backgroundColor: C.background }]}>

            {/* Handle */}
            {!isIOS && <View style={[styles.handle, { backgroundColor: C.borderStrong }]} />}

            {/* Header */}
            <View style={[styles.sheetHeader, { borderBottomColor: C.border }]}>
              <Text style={[styles.sheetTitle, { color: C.textPrimary }]}>Select Language</Text>
              <TouchableOpacity
                onPress={closeModal}
                style={[styles.closeBtn, { backgroundColor: C.surface }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={17} color={C.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.searchWrap, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Ionicons name="search" size={16} color={C.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: C.textPrimary }]}
                placeholder="Search language…"
                placeholderTextColor={C.textMuted}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={C.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Empty state */}
            {filtered.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🌐</Text>
                <Text style={[styles.emptyTitle, { color: C.textPrimary }]}>No results</Text>
                <Text style={[styles.emptySub, { color: C.textMuted }]}>
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
                      { borderBottomColor: C.border },
                      isSelected && { backgroundColor: C.accentSoft },
                    ]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.65}
                  >
                    <Text style={styles.itemFlag}>{item.flag}</Text>
                    <View style={styles.itemTextBlock}>
                      <Text style={[
                        styles.itemName,
                        { color: C.textPrimary },
                        isSelected && { color: C.primary, fontWeight: '700' },
                      ]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.itemNative, { color: C.textMuted }]}>{item.nativeName}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={C.primary} />
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
  // Pill (default)
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: DS.space.xs + 2,
    paddingHorizontal: DS.space.sm + DS.space.xs,
    paddingVertical: DS.space.sm + DS.space.xs,
    borderRadius: DS.radius.md + 2,
    borderWidth: 1,
  },
  pillLabel:    { ...DS.type.label, textTransform: 'uppercase' },
  pillFlag:     { fontSize: DS.icon.md },
  pillName:     { flex: 1, ...DS.type.subhead, fontWeight: '600' },

  // Pill (subtle)
  pillSubtle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.xs,
    paddingHorizontal: DS.space.xs + 2,
    paddingVertical: DS.space.xs,
  },
  pillFlagSubtle:   { fontSize: 15 },
  pillNameSubtle:   { ...DS.type.footnote, fontWeight: '600' },

  // Modal
  iosScreen: { flex: 1 },
  iosSheet: {
    flex: 1,
    paddingBottom: Platform.OS === 'ios' ? 20 : DS.space.md,
  },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: DS.radius.xxl,
    borderTopRightRadius: DS.radius.xxl,
    maxHeight: '84%',
    paddingBottom: Platform.OS === 'ios' ? 34 : DS.space.md,
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
  sheetTitle: { ...DS.type.title3, letterSpacing: -0.2 },
  closeBtn: {
    width: 32, height: 32,
    borderRadius: DS.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DS.space.sm,
    margin: DS.space.sm + DS.space.xs,
    paddingHorizontal: DS.space.sm + DS.space.xs,
    paddingVertical: DS.space.sm + DS.space.xs,
    borderRadius: DS.radius.md + 2,
    borderWidth: 1,
  },
  searchInput: { flex: 1, ...DS.type.subhead, paddingVertical: 0 },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: DS.space.xxl,
    gap: DS.space.xs + 2,
  },
  emptyEmoji: { fontSize: DS.icon.xl + DS.space.sm, marginBottom: DS.space.xs },
  emptyTitle: { ...DS.type.callout, fontWeight: '600' },
  emptySub:   { ...DS.type.footnote, textAlign: 'center', paddingHorizontal: DS.space.xl },

  // List
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: DS.space.md + DS.space.xs,
    paddingVertical: DS.space.md - 1,
    gap: DS.space.sm + DS.space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemFlag:      { fontSize: DS.icon.lg - 2, width: 36, textAlign: 'center' },
  itemTextBlock: { flex: 1 },
  itemName:      { ...DS.type.subhead, fontWeight: '500' },
  itemNative:    { ...DS.type.caption1, marginTop: 2 },
});
