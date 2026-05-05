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
import { LANGUAGES, Language, getLanguageByCode } from '@/constants/languages';
import { COLORS } from '@/constants/theme';

interface Props {
  selectedCode: string;
  onSelect: (code: string) => void;
  label?: string;
}

export function LanguageSelector({ selectedCode, onSelect, label }: Props) {
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

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setVisible(true)}>
        {label && <Text style={styles.label}>{label}</Text>}
        <Text style={styles.flag}>{selected?.flag ?? '🌐'}</Text>
        <Text style={styles.langName}>{selected?.name ?? 'Select'}</Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Language</Text>
              <TouchableOpacity onPress={() => { setVisible(false); setSearch(''); }}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search language..."
              placeholderTextColor={COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.langItem,
                    item.code === selectedCode && styles.langItemSelected,
                  ]}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={styles.itemFlag}>{item.flag}</Text>
                  <View style={styles.itemTextBlock}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemNative}>{item.nativeName}</Text>
                  </View>
                  {item.code === selectedCode && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
    flex: 1,
  },
  label: {
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 2,
  },
  flag: {
    fontSize: 20,
  },
  langName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  chevron: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    color: COLORS.textMuted,
    fontSize: 18,
    padding: 4,
  },
  searchInput: {
    margin: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 15,
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  langItemSelected: {
    backgroundColor: COLORS.primaryDim,
  },
  itemFlag: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  itemTextBlock: {
    flex: 1,
  },
  itemName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
  },
  itemNative: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  checkmark: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
  },
});
