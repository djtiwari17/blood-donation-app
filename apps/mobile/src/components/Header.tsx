import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '../theme';

interface Props {
  title: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  bgColor?: string;
  titleColor?: string;
}

export const Header: React.FC<Props> = ({
  title, onBack, rightElement, bgColor = colors.white, titleColor = colors.textPrimary,
}) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={titleColor} />
          </TouchableOpacity>
        ) : <View style={styles.backBtn} />}
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>{title}</Text>
        <View style={styles.right}>{rightElement ?? <View style={styles.backBtn} />}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: fonts.sizes.lg, fontWeight: '700' },
  right: { width: 40, alignItems: 'flex-end' },
});
