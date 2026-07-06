import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  elevation?: 'sm' | 'md' | 'lg';
  padding?: number;
}

export const Card: React.FC<Props> = ({ children, style, elevation = 'sm', padding = spacing.base }) => (
  <View style={[styles.card, shadow[elevation], { padding }, style]}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
});
