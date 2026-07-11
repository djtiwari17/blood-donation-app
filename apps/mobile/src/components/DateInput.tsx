import React, { useState } from 'react';
import { Platform, Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Input } from './Input';
import { colors, fonts, spacing, radius } from '../theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  mode?: 'date' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
};

const pad = (n: number) => String(n).padStart(2, '0');
const formatDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const formatDateTime = (d: Date) => `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Parse the field's current "DD/MM/YYYY[ HH:MM]" text so the picker opens on it
function parseValue(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const [, d, mo, y, h, mi] = m;
  const parsed = new Date(
    parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10),
    h ? parseInt(h, 10) : 0, mi ? parseInt(mi, 10) : 0,
  );
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Text input with a working calendar picker on the right icon.
// Hand-typing stays supported; the picker just fills the field in the same format.
export const DateInput: React.FC<Props> = ({
  label, value, onChangeText, placeholder, error,
  mode = 'date', minimumDate, maximumDate,
}) => {
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(new Date());

  const initial = () => parseValue(value) ?? new Date();
  const commit = (d: Date) => onChangeText(mode === 'datetime' ? formatDateTime(d) : formatDate(d));

  const openAndroid = () => {
    DateTimePickerAndroid.open({
      value: initial(),
      mode: 'date',
      minimumDate,
      maximumDate,
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        if (mode === 'date') {
          commit(date);
          return;
        }
        // Android has no combined datetime dialog — chain date → time
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: true,
          onChange: (timeEvent, dateTime) => {
            if (timeEvent.type === 'set' && dateTime) commit(dateTime);
          },
        });
      },
    });
  };

  const openPicker = () => {
    if (Platform.OS === 'android') {
      openAndroid();
    } else {
      setIosDraft(initial());
      setIosPickerOpen(true);
    }
  };

  return (
    <>
      <Input
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        error={error}
        rightIcon="calendar-outline"
        onRightIconPress={openPicker}
      />

      {/* iOS: spinner in a bottom sheet with Cancel/Done */}
      <Modal
        visible={iosPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIosPickerOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setIosPickerOpen(false)} hitSlop={8}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { commit(iosDraft); setIosPickerOpen(false); }}
                hitSlop={8}
              >
                <Text style={styles.done}>Done</Text>
              </TouchableOpacity>
            </View>
            {iosPickerOpen && (
              <DateTimePicker
                value={iosDraft}
                mode={mode === 'datetime' ? 'datetime' : 'date'}
                display="spinner"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={(_event, date) => { if (date) setIosDraft(date); }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
  },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  cancel: { fontSize: fonts.sizes.base, color: colors.textSecondary },
  done: { fontSize: fonts.sizes.base, color: colors.primary, fontWeight: '700' },
});
