import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius } from '../theme';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: object;
}

export const Input: React.FC<Props> = ({
  label, error, rightIcon, onRightIconPress,
  containerStyle, secureTextEntry, ...rest
}) => {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputRow, focused && styles.focused, error ? styles.errorBorder : null]}>
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.textHint}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={hidden}
          {...rest}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setHidden(!hidden)} style={styles.icon}>
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.gray} />
          </TouchableOpacity>
        )}
        {rightIcon && !secureTextEntry && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.icon}>
            <Ionicons name={rightIcon} size={20} color={colors.gray} />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    minHeight: 50,
  },
  focused: { borderColor: colors.primary },
  errorBorder: { borderColor: colors.error },
  input: {
    flex: 1,
    fontSize: fonts.sizes.base,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  icon: { padding: spacing.xs },
  error: { fontSize: fonts.sizes.xs, color: colors.error, marginTop: spacing.xs },
});
