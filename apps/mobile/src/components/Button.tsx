import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { colors, radius, fonts, spacing } from '../theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export const Button: React.FC<Props> = ({
  label, onPress, variant = 'primary', size = 'md',
  disabled, loading, style, textStyle, fullWidth = true,
}) => {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.primary} />
      ) : (
        <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`], textStyle]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: { width: '100%' },
  primary:   { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary },
  outline:   { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  ghost:     { backgroundColor: 'transparent' },
  danger:    { backgroundColor: colors.error },
  disabled:  { opacity: 0.5 },
  size_sm:   { paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md },
  size_md:   { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  size_lg:   { paddingVertical: spacing.base, paddingHorizontal: spacing.xl },
  text: { fontWeight: '600', letterSpacing: 0.3 },
  text_primary:   { color: colors.white },
  text_secondary: { color: colors.white },
  text_outline:   { color: colors.primary },
  text_ghost:     { color: colors.primary },
  text_danger:    { color: colors.white },
  textSize_sm:    { fontSize: fonts.sizes.sm },
  textSize_md:    { fontSize: fonts.sizes.base },
  textSize_lg:    { fontSize: fonts.sizes.lg },
});
