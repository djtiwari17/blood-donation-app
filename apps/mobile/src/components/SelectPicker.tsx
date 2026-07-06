import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, shadow } from '../theme';

interface Props {
  label?: string;
  value: string;
  options: string[];
  placeholder?: string;
  onSelect: (value: string) => void;
  error?: string;
}

export const SelectPicker: React.FC<Props> = ({ label, value, options, placeholder, onSelect, error }) => {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.picker, error ? styles.errorBorder : null]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.pickerText, !value && styles.placeholder]}>
          {value || placeholder || 'Select...'}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.gray} />
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} onPress={() => setOpen(false)} activeOpacity={1}>
          <View style={styles.dropdown}>
            <Text style={styles.dropdownTitle}>{label ?? 'Select'}</Text>
            <FlatList
              data={options}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item === value && styles.selectedOption]}
                  onPress={() => { onSelect(item); setOpen(false); }}
                >
                  <Text style={[styles.optionText, item === value && styles.selectedText]}>{item}</Text>
                  {item === value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

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
  errorBorder: { borderColor: colors.error },
  pickerText: { fontSize: fonts.sizes.base, color: colors.textPrimary },
  placeholder: { color: colors.textHint },
  error: { fontSize: fonts.sizes.xs, color: colors.error, marginTop: spacing.xs },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.lg },
  dropdown: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    maxHeight: 360,
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.grayPale,
  },
  selectedOption: { backgroundColor: colors.primaryPale },
  optionText: { fontSize: fonts.sizes.base, color: colors.textPrimary },
  selectedText: { color: colors.primary, fontWeight: '600' },
});
