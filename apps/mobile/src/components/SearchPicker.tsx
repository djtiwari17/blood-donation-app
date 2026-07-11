import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList, TextInput,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../theme';

export interface SearchPickerResult {
  shortName: string;
  displayName: string;
}

interface Props<T extends SearchPickerResult> {
  label?: string;
  value: string;
  placeholder?: string;
  onSelect: (result: T) => void;
  error?: string;
  disabled?: boolean;
  disabledHint?: string;
  search: (query: string) => Promise<T[]>;
  minQueryLength?: number;
  debounceMs?: number;
}

export function SearchPicker<T extends SearchPickerResult>({
  label, value, placeholder, onSelect, error, disabled, disabledHint,
  search, minQueryLength = 2, debounceMs = 400,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // invalidate any in-flight search so it can't setState after unmount
    requestIdRef.current++;
  }, []);

  const runSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < minQueryLength) {
      setResults([]);
      setLoading(false);
      setSearchError(false);
      return;
    }

    setLoading(true);
    setSearchError(false);
    const thisRequestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await search(text);
        if (thisRequestId === requestIdRef.current) setResults(res);
      } catch {
        if (thisRequestId === requestIdRef.current) setSearchError(true);
      } finally {
        if (thisRequestId === requestIdRef.current) setLoading(false);
      }
    }, debounceMs);
  }, [search, minQueryLength, debounceMs]);

  const close = () => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setSearchError(false);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.picker, error ? styles.errorBorder : null, disabled && styles.disabledPicker]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={disabled ? 1 : 0.8}
      >
        <Text style={[styles.pickerText, !value && styles.placeholder]}>
          {value || (disabled ? disabledHint : placeholder) || 'Select...'}
        </Text>
        <Ionicons name={disabled ? 'lock-closed-outline' : 'search'} size={18} color={colors.gray} />
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <TouchableOpacity style={styles.overlay} onPress={close} activeOpacity={1}>
          <TouchableOpacity style={styles.dropdown} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.dropdownTitle}>{label ?? 'Search'}</Text>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.gray} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={runSearch}
                placeholder={placeholder ?? 'Type to search...'}
                placeholderTextColor={colors.textHint}
                autoFocus
              />
            </View>

            {loading && (
              <View style={styles.centerBox}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}

            {!loading && searchError && (
              <View style={styles.centerBox}>
                <Text style={styles.emptyText}>Search failed. Check your connection and try again.</Text>
              </View>
            )}

            {!loading && !searchError && query.trim().length >= minQueryLength && results.length === 0 && (
              <View style={styles.centerBox}>
                <Text style={styles.emptyText}>No matches found.</Text>
              </View>
            )}

            {!loading && !searchError && (
              <FlatList
                data={results}
                keyExtractor={(item, idx) => `${item.shortName}-${idx}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.option}
                    onPress={() => { onSelect(item); close(); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionText}>{item.shortName}</Text>
                      <Text style={styles.optionSubText} numberOfLines={1}>{item.displayName}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { fontSize: fonts.sizes.sm, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '500' },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  disabledPicker: { backgroundColor: colors.grayPale },
  errorBorder: { borderColor: colors.error },
  pickerText: { fontSize: fonts.sizes.base, color: colors.textPrimary },
  placeholder: { color: colors.textHint },
  error: { fontSize: fonts.sizes.xs, color: colors.error, marginTop: spacing.xs },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  dropdown: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    maxHeight: 440,
    ...shadow.lg,
  },
  dropdownTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: '700',
    color: colors.textPrimary,
    padding: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.base,
    marginVertical: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: fonts.sizes.base, color: colors.textPrimary },
  centerBox: { padding: spacing.lg, alignItems: 'center' },
  emptyText: { fontSize: fonts.sizes.sm, color: colors.textSecondary, textAlign: 'center' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.grayPale,
  },
  optionText: { fontSize: fonts.sizes.base, color: colors.textPrimary, fontWeight: '500' },
  optionSubText: { fontSize: fonts.sizes.xs, color: colors.textSecondary, marginTop: 2 },
});
